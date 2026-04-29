/**
 * GET /api/psi-audit/:id — poll a queued audit.
 *
 * Status decision tree:
 *   - unknown id            → 404
 *   - pending + age > 10min → 410 (user gave up; we don't honor stale polls)
 *   - pending + age > 75s   → self-heal: mark TIMEOUT, return error
 *   - pending               → return { status:'pending', progressHint }
 *   - complete              → return { status:'complete', result }
 *   - error                 → return { status:'error', code, message }
 */

const POLL_VALIDITY_SECONDS = 600;   // 10 minutes
const STALE_PENDING_SECONDS = 75;    // self-heal threshold

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function jsonResponse(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request, env) },
  });
}

function hasDatabase(env) {
  return typeof env?.DB?.prepare === 'function';
}

function progressHintFrom(secondsSinceStart, hasStarted) {
  if (!hasStarted) return 'queued';
  if (secondsSinceStart < 5) return 'fetching';
  if (secondsSinceStart < 15) return 'analyzing';
  return 'finalizing';
}

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(request, env) });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, request, env);
  }

  if (!hasDatabase(env)) {
    console.error('[PSI Poll] DB binding is not configured');
    return jsonResponse({ error: 'Audit service is not configured' }, 503, request, env);
  }

  const jobId = params?.id;
  if (typeof jobId !== 'string' || jobId.length < 16 || jobId.length > 64) {
    return jsonResponse({ error: 'Invalid job ID' }, 400, request, env);
  }

  // Project all timestamps as ISO UTC so JS new Date() parses them correctly.
  let row;
  try {
    row = await env.DB.prepare(
      `SELECT id, status, result_json, error_code, error_message,
              strftime('%Y-%m-%dT%H:%M:%SZ', created_at) AS created_at_iso,
              strftime('%Y-%m-%dT%H:%M:%SZ', started_at) AS started_at_iso
       FROM psi_audit_jobs WHERE id = ?`
    ).bind(jobId).first();
  } catch (err) {
    console.error('[PSI Poll] DB read failed:', err);
    return jsonResponse({ error: 'Lookup failed' }, 500, request, env);
  }

  if (!row) return jsonResponse({ error: 'Audit not found' }, 404, request, env);

  if (row.status === 'complete') {
    let result = null;
    try { result = JSON.parse(row.result_json || 'null'); } catch { /* ignore */ }
    return jsonResponse({ status: 'complete', result }, 200, request, env);
  }

  if (row.status === 'error') {
    return jsonResponse({
      status: 'error',
      code: row.error_code || 'INTERNAL',
      message: row.error_message || 'Audit failed',
    }, 200, request, env);
  }

  // status === 'pending' — apply staleness rules
  const now = Date.now();
  const createdMs = row.created_at_iso ? new Date(row.created_at_iso).getTime() : now;
  const startedMs = row.started_at_iso ? new Date(row.started_at_iso).getTime() : null;
  const ageSeconds = (now - createdMs) / 1000;
  const sinceStart = startedMs != null ? (now - startedMs) / 1000 : ageSeconds;

  // Polling validity expired — user gave up, we won't keep handing back pending forever
  if (ageSeconds > POLL_VALIDITY_SECONDS) {
    return jsonResponse({ error: 'Audit expired without completing' }, 410, request, env);
  }

  // Stale pending — self-heal. ctx.waitUntil may have been killed before its catch fired.
  if (sinceStart > STALE_PENDING_SECONDS) {
    try {
      await env.DB.prepare(
        `UPDATE psi_audit_jobs
            SET status='error', error_code='TIMEOUT',
                error_message='Audit did not complete in time',
                completed_at=datetime('now')
          WHERE id=? AND status='pending'`
      ).bind(jobId).run();
    } catch (err) {
      console.error('[PSI Poll] self-heal failed:', err);
    }
    return jsonResponse({
      status: 'error',
      code: 'TIMEOUT',
      message: 'Audit did not complete in time',
    }, 200, request, env);
  }

  return jsonResponse({
    status: 'pending',
    progressHint: progressHintFrom(sinceStart, startedMs != null),
  }, 200, request, env);
}
