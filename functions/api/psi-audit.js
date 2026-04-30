/**
 * POST /api/psi-audit — start a PageSpeed Insights audit.
 *
 * Two-phase architecture (POST → poll) because PSI commonly takes 22-30s and
 * Cloudflare Pages Functions cap a single request at 30s wallclock. We accept
 * the job, queue it via ctx.waitUntil, and let the client poll /api/psi-audit/:id.
 */

import { preflight } from '../lib/preflight.js';
import { isValidEmail, sanitizeString, checkRateLimit } from '../lib/security.js';
import { sendEmail } from '../lib/email.js';
import { broadcastPush } from '../scheduler/lib/push.js';
import {
  INDUSTRY_WHITELIST,
  validateUrl,
  buildPsiUrl,
  distillPsi,
  extractScreenshotBytes,
  buildUserEmail,
  buildOwnerEmail,
} from '../lib/psi.js';

// ----------------------------------------------------------------------------
// CORS + JSON helpers (mirrors functions/api/form.js)
// ----------------------------------------------------------------------------

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = [
    env.SITE_URL,
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:8788',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8788',
  ].filter(Boolean);
  const corsOrigin = allowed.includes(origin) ? origin : allowed[0] || '*';
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function jsonResponse(data, status, request, env, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request, env),
      ...(extraHeaders || {}),
    },
  });
}

function hasDatabase(env) {
  return typeof env?.DB?.prepare === 'function';
}

// ----------------------------------------------------------------------------
// Cleanup — runs at the start of every POST. Indexed by expires_at so it's cheap.
// Deletes the R2 screenshot before the row to avoid orphans.
// ----------------------------------------------------------------------------

async function cleanupExpired(env) {
  try {
    const expired = await env.DB.prepare(
      `SELECT id, screenshot_r2_key FROM psi_audit_jobs WHERE expires_at < datetime('now') LIMIT 50`
    ).all();
    const rows = expired?.results || [];
    if (rows.length === 0) return;

    await Promise.allSettled(
      rows.filter(r => r.screenshot_r2_key).map(r => env.MEDIA_BUCKET.delete(r.screenshot_r2_key))
    );

    await env.DB.prepare(
      `DELETE FROM psi_audit_jobs WHERE id IN (${rows.map(() => '?').join(',')})`
    ).bind(...rows.map(r => r.id)).run();
  } catch (err) {
    console.error('[PSI Audit] cleanupExpired error:', err);
  }
}

// ----------------------------------------------------------------------------
// Main entry
// ----------------------------------------------------------------------------

export async function onRequest(context) {
  const { request, env, waitUntil } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(request, env) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, request, env);
  }

  if (!hasDatabase(env)) {
    console.error('[PSI Audit] DB binding is not configured');
    return jsonResponse({ error: 'Audit service is not configured' }, 503, request, env);
  }

  const pre = preflight(env, ['PSI_API_KEY', 'RESEND_API_KEY']);
  if (!pre.ok) {
    console.error('[PSI Audit] preflight failed:', pre.error);
    return jsonResponse({ error: 'Audit service is not configured' }, 503, request, env);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, request, env);
  }

  // 1. Honeypot — bots fill hidden fields. Silent fake-success, no DB writes.
  if (typeof body._hp === 'string' && body._hp.trim().length > 0) {
    return jsonResponse(
      {
        jobId: crypto.randomUUID(),
        pollUrl: '/api/psi-audit/' + crypto.randomUUID(),
        estimatedSeconds: 25,
      },
      202,
      request,
      env
    );
  }

  // 2. Consent — pre-check before any rate-limit accounting
  if (body.consent !== true) {
    return jsonResponse({ error: 'You must confirm you have permission to audit this URL', field: 'consent' }, 403, request, env);
  }

  // 3. Validation — shape checks, no rate-limit accounting yet
  const industry = typeof body.industry === 'string' ? body.industry.trim() : '';
  if (!INDUSTRY_WHITELIST.includes(industry)) {
    return jsonResponse({ error: 'Pick an industry from the list', field: 'industry' }, 400, request, env);
  }

  const email = sanitizeString(body.email, 254).toLowerCase();
  if (!isValidEmail(email)) {
    return jsonResponse({ error: 'That email doesn\'t look right', field: 'email' }, 400, request, env);
  }

  const urlCheck = validateUrl(body.url);
  if (!urlCheck.valid) {
    return jsonResponse({ error: urlCheck.error, field: 'url' }, 400, request, env);
  }
  const targetUrl = urlCheck.normalized;
  const targetHost = urlCheck.host;

  // 4. Rate limits — only after the body has passed shape checks.
  // Bypass when the request hits this function via localhost (i.e. `wrangler pages dev`)
  // so iterating on the UI doesn't make you wait an hour. Production traffic always
  // arrives at the real hostname so this branch can never run there.
  // Also bypass when the client sends X-PWA: 1 — the audit FAB sets this only
  // when running in standalone (installed-PWA) mode, which only the owner does
  // while testing prod-only errors. Header is trivially spoofable from curl, so
  // this is explicitly an "honor system" bypass for owner traffic, not a security control.
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const userAgent = (request.headers.get('User-Agent') || '').slice(0, 500);
  const reqHost = new URL(request.url).hostname;
  const isLocalDev = reqHost === 'localhost' || reqHost === '127.0.0.1' || reqHost === '0.0.0.0';
  const isPwa = request.headers.get('X-PWA') === '1';

  if (!isLocalDev && !isPwa) {
    const limits = [
      { key: `psi:ip:${ip}`,           max: 3,  window: 60   },
      { key: `psi:email:${email}`,     max: 5,  window: 1440 },
      { key: `psi:host:${targetHost}`, max: 10, window: 1440 },
    ];

    for (const lim of limits) {
      let r;
      try {
        r = await checkRateLimit(env.DB, lim.key, lim.max, lim.window);
      } catch (err) {
        console.error('[PSI Audit] rate limit check failed:', err);
        return jsonResponse({ error: 'Audit service is not ready. Try again soon.' }, 503, request, env);
      }
      if (!r.allowed) {
        const retryAfterSeconds = r.expiresAt ? Math.max(1, Math.ceil((new Date(r.expiresAt).getTime() - Date.now()) / 1000)) : lim.window * 60;
        return jsonResponse(
          { error: 'Too many audits. Try again later.', retryAfterSeconds },
          429,
          request,
          env,
          { 'Retry-After': String(retryAfterSeconds) }
        );
      }
    }
  }

  // Cleanup expired rows + R2 screenshots (cheap, indexed)
  await cleanupExpired(env);

  // Insert pending job
  const jobId = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO psi_audit_jobs
        (id, status, industry, email, url, ip_address, expires_at)
       VALUES (?, 'pending', ?, ?, ?, ?, datetime('now', '+30 days'))`
    ).bind(jobId, industry, email, targetUrl, ip).run();
  } catch (dbErr) {
    console.error('[PSI Audit] insert job failed:', dbErr);
    return jsonResponse({ error: 'Could not start audit. Try again.' }, 500, request, env);
  }

  // Kick off the actual work — runs after we've already responded.
  waitUntil(runAudit(env, {
    jobId, targetUrl, targetHost, industry, email, ip, userAgent,
  }));

  // Broadcast a push to anyone subscribed (Joseph + admins via the PWA-only
  // footer toggle). Fires in parallel with runAudit so the response isn't held.
  // VAPID not configured? broadcastPush no-ops gracefully — see scheduler/lib/push.js.
  waitUntil(broadcastAuditPush(env, { email, host: targetHost, industry, jobId })
    .catch(err => console.error('[PSI Audit] broadcastPush error:', err)));

  return jsonResponse(
    { jobId, pollUrl: '/api/psi-audit/' + jobId, estimatedSeconds: 25 },
    202,
    request,
    env
  );
}

async function broadcastAuditPush(env, { email, host, industry, jobId }) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return; // not configured
  return broadcastPush(env, {
    title: 'New audit started',
    body: email + ' just ran an audit on ' + host + ' (' + industry + ')',
    icon: '/assets/favicons/android-chrome-192x192.png',
    badge: '/assets/favicons/favicon-32x32.png',
    tag: 'audit-' + jobId,
    url: '/',
    data: { type: 'audit', jobId, email, host, industry },
  });
}

// ----------------------------------------------------------------------------
// Background work — kicked off via ctx.waitUntil after the response is sent.
// Total budget: 30s shared across all waitUntil tasks. PSI capped at 24s,
// leaving ~6s for distill + R2 + D1 + Resend × 2.
// ----------------------------------------------------------------------------

async function runAudit(env, ctx) {
  const { jobId, targetUrl, targetHost, industry, email, ip, userAgent } = ctx;

  // Stamp started_at + bump attempts. The poll handler keys staleness off these.
  try {
    await env.DB.prepare(
      `UPDATE psi_audit_jobs SET started_at=datetime('now'), attempts=attempts+1 WHERE id=?`
    ).bind(jobId).run();
  } catch (err) {
    console.error('[PSI Audit] stamp started_at failed:', err);
  }

  let summary;
  let screenshotKey = null;

  try {
    const psi = await fetchPsi(env.PSI_API_KEY, targetUrl);

    // PSI may return 200 with an embedded runtime error (e.g. page blocked Lighthouse)
    const runtimeError = psi?.lighthouseResult?.runtimeError;
    if (runtimeError && runtimeError.code !== 'NO_ERROR') {
      throw new PsiError('UNAUDITABLE', runtimeError.message || 'Page could not be audited');
    }

    summary = distillPsi(psi, targetUrl);

    // Screenshot → R2 (best-effort: a missing screenshot doesn't fail the audit)
    const bytes = extractScreenshotBytes(psi);
    if (bytes) {
      screenshotKey = `audits/${jobId}.jpg`;
      try {
        await env.MEDIA_BUCKET.put(screenshotKey, bytes, {
          httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=2592000' },
        });
      } catch (r2Err) {
        console.error('[PSI Audit] R2 put failed:', r2Err);
        screenshotKey = null;
      }
    }

    // Wire the screenshot URL into the summary BEFORE we persist result_json,
    // so the poll handler returns it to the client without an extra hop.
    summary.screenshotUrl = screenshotKey ? '/api/audit-screenshot/' + jobId : null;
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    const code = err instanceof PsiError ? err.code : (isAbort ? 'TIMEOUT' : 'INTERNAL');
    console.error('[PSI Audit] runAudit error:', code, err?.message || err);
    try {
      await env.DB.prepare(
        `UPDATE psi_audit_jobs SET status='error', error_code=?, error_message=?, completed_at=datetime('now') WHERE id=?`
      ).bind(code, String(err?.message || err).slice(0, 500), jobId).run();
    } catch (dbErr) {
      console.error('[PSI Audit] failed to record error:', dbErr);
    }
    return;
  }

  // Persist completion
  try {
    await env.DB.prepare(
      `UPDATE psi_audit_jobs
         SET status='complete', result_json=?, screenshot_r2_key=?, completed_at=datetime('now')
       WHERE id=?`
    ).bind(JSON.stringify(summary), screenshotKey, jobId).run();
  } catch (err) {
    console.error('[PSI Audit] mark complete failed:', err);
  }

  // Lead row in form_submissions for unified inbox
  try {
    await env.DB.prepare(
      `INSERT INTO form_submissions (id, form_name, data, ip_address, user_agent, status, created_at)
       VALUES (?, 'psi-audit', ?, ?, ?, 'new', datetime('now'))`
    ).bind(
      crypto.randomUUID(),
      JSON.stringify({ jobId, industry, email, url: targetUrl, scores: summary.scores }),
      ip,
      userAgent
    ).run();
  } catch (err) {
    console.error('[PSI Audit] lead insert failed:', err);
  }

  // Emails — fire in parallel, never let one failure block the other
  const siteUrl = (env.SITE_URL || '').replace(/\/+$/, '');
  const screenshotUrl = screenshotKey ? `${siteUrl}/api/audit-screenshot/${jobId}` : null;
  const userEmail = buildUserEmail({ summary, screenshotUrl: screenshotUrl || '', siteUrl, host: targetHost });
  const ownerTo = env.NOTIFICATION_EMAIL;
  const ownerEmail = buildOwnerEmail({ summary, lead: { email, industry, ip, userAgent }, host: targetHost, siteUrl, jobId });

  const emails = [
    sendEmail(env, { to: email, subject: `Your PageSpeed audit for ${targetHost}`, html: userEmail.html, text: userEmail.text }),
  ];
  if (ownerTo) {
    emails.push(sendEmail(env, { to: ownerTo, subject: `[Audit Lead] ${email} ran audit on ${targetHost}`, html: ownerEmail.html, text: ownerEmail.text }));
  }
  await Promise.allSettled(emails);
}

// ----------------------------------------------------------------------------
// PSI fetch with a 24s overall AbortController — see plan budget table
// ----------------------------------------------------------------------------

class PsiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const PSI_TIMEOUT_MS = 24000;
const PSI_MAX_ATTEMPTS = 3;
const PSI_RETRY_DELAYS_MS = [1000, 2000];

function abortError() {
  return new DOMException('PSI request timed out', 'AbortError');
}

function delay(ms, signal) {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    };
    const onDone = () => {
      cleanup();
      resolve();
    };
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    timer = setTimeout(onDone, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function throwForPsiResponse(res) {
  // PSI quota signals: 429, or 403 with a quotaExceeded / rateLimitExceeded /
  // dailyLimitExceeded reason in the JSON error envelope. Read the body once
  // (it's small) so we can route it to the right user-facing copy.
  if (res.status === 429) {
    throw new PsiError('PSI_QUOTA', 'PSI rate limit reached');
  }
  if (res.status === 403) {
    let body;
    try { body = await res.json(); } catch { body = null; }
    const reasons = body?.error?.errors?.map(e => String(e.reason || '').toLowerCase()) || [];
    const msg = String(body?.error?.message || '');
    const isQuota =
      reasons.some(r => r.includes('quota') || r.includes('rate') || r.includes('dailylimit')) ||
      /quota|rate.?limit|exceeded/i.test(msg);
    if (isQuota) {
      throw new PsiError('PSI_QUOTA', body?.error?.message || 'PSI quota exceeded');
    }
    throw new PsiError('UNAUDITABLE', body?.error?.message || 'PSI HTTP 403');
  }
  // Other 4xx: the URL is the problem. 5xx: PSI is the problem.
  const isClient = res.status >= 400 && res.status < 500;
  throw new PsiError(isClient ? 'UNAUDITABLE' : 'PSI_DOWN', `PSI HTTP ${res.status}`);
}

function toPsiError(err) {
  if (err instanceof PsiError || err?.name === 'AbortError') return err;
  return new PsiError('PSI_DOWN', err?.message || 'PSI request failed');
}

async function fetchPsi(apiKey, targetUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
  try {
    for (let attempt = 1; attempt <= PSI_MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(buildPsiUrl(targetUrl, apiKey), { signal: controller.signal });
        if (!res.ok) await throwForPsiResponse(res);
        return await res.json();
      } catch (err) {
        const psiErr = toPsiError(err);
        const retryable = psiErr instanceof PsiError && psiErr.code === 'PSI_DOWN';
        if (!retryable || attempt === PSI_MAX_ATTEMPTS) {
          throw psiErr;
        }
        console.warn('[PSI Audit] retrying PSI after transient failure:', psiErr.message);
        await delay(PSI_RETRY_DELAYS_MS[attempt - 1] || 2000, controller.signal);
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
