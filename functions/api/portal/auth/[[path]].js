/**
 * Portal Auth API — catch-all route handler
 * GET  /api/portal/auth/verify         — Verify magic link token, return JWT
 * POST /api/portal/auth/login          — Password login, return JWT
 * POST /api/portal/auth/set-password   — Set password (requires JWT)
 * POST /api/portal/auth/forgot-password — Send password recovery link
 * GET  /api/portal/auth/check          — Check JWT validity
 */

import { sha256, hashPassword, verifyPassword, checkRateLimit, sanitizeString } from '../../../lib/security.js';
import { signPortalJWT, verifyPortalToken } from '../../../lib/portal-auth.js';
import { createNotification, createNotificationThrottled } from '../../../lib/notifications.js';
import { sendEmail } from '../../../lib/email.js';
import { preflight } from '../../../lib/preflight.js';
import { ensureMigrations } from '../../../lib/migrate.js';
import { generateToken } from '../../../lib/security.js';

const PORTAL_MIGRATIONS = { pack: 'portal', migrations: [] };
let migrated = false;

function escapeHtml(value) {
  if (value == null) return '';
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function errorResponse(message, status = 400, extraHeaders = {}) {
  return jsonResponse({ error: message }, status, extraHeaders);
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map(s => s.trim())
    : [env.SITE_URL || ''].map(s => s.replace(/\/+$/, ''));
  const isDev = !env.SITE_URL || String(env.SITE_URL).startsWith('http://localhost');
  const isAllowed = isDev
    ? origin.startsWith('http://localhost')
    : allowed.includes(origin);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
  };
  if (isAllowed && origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

async function verifyPortalAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  return verifyPortalToken(token, env);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const addCors = (res) => {
    for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
    return res;
  };

  const path = (params.path || []).join('/');
  const method = request.method;

  if ((method === 'POST' || method === 'PUT' || method === 'DELETE') &&
      !(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
    return addCors(errorResponse('Content-Type must be application/json', 415));
  }

  try {
    // One-time migration guard (fail-closed)
    if (!migrated) {
      try { await ensureMigrations(env.DB, PORTAL_MIGRATIONS); migrated = true; }
      catch (e) { console.error('[PortalAuth] Migration failed:', e); return addCors(errorResponse('Database migration failed. Contact administrator.', 503)); }
    }

    // GET /api/portal/auth/verify?token=xxx
    if (method === 'GET' && path === 'verify') {
      const check = preflight(env, ['JWT_SECRET']);
      if (!check.ok) return addCors(errorResponse(check.error, 500));

      const db = env.DB;
      const token = url.searchParams.get('token');
      if (!token) return addCors(errorResponse('Missing token', 400));

      const tokenHash = await sha256(token);
      const session = await db.prepare(
        `SELECT ps.id, ps.client_id, ps.type, ps.is_used, ps.expires_at,
                c.name, c.email, c.password_hash, c.avatar_base64, c.last_portal_login
         FROM portal_sessions ps
         JOIN clients c ON c.id = ps.client_id
         WHERE ps.token_hash = ? AND ps.is_used = 0 AND ps.expires_at > datetime('now')`
      ).bind(tokenHash).first();

      if (!session) return addCors(errorResponse('Invalid or expired link', 401));

      await db.prepare('UPDATE portal_sessions SET is_used = 1 WHERE id = ?').bind(session.id).run();
      await db.prepare(
        'UPDATE clients SET last_portal_login = datetime(\'now\'), portal_enabled = 1 WHERE id = ?'
      ).bind(session.client_id).run();

      if (!session.last_portal_login) {
        try {
          await createNotification(db, {
            recipientType: 'admin', type: 'portal_account_created',
            title: 'Portal Account Activated',
            message: ((session.name || '').trim() || 'A client') + ' activated their client portal',
          });
        } catch (_) {}
      }

      const jwt = await signPortalJWT(session.client_id, session.email, session.name, env);
      return addCors(jsonResponse({
        token: jwt,
        auth_mode: session.type === 'password_recovery' ? 'recovery' : 'login_link',
        client: {
          id: session.client_id, name: session.name, email: session.email,
          hasPassword: !!session.password_hash, avatar_base64: session.avatar_base64 || null,
        },
      }));
    }

    // POST /api/portal/auth/login
    if (method === 'POST' && path === 'login') {
      const check = preflight(env, ['JWT_SECRET']);
      if (!check.ok) return addCors(errorResponse(check.error, 500));

      const db = env.DB;
      let body;
      try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON body', 400)); }

      const { email, password } = body || {};
      if (!email || !password) return addCors(errorResponse('Email and password are required', 400));

      // Rate limit: 5 per 15 min per email
      const rl = await checkRateLimit(db, 'login:' + email.toLowerCase(), 5, 15);
      if (!rl.allowed) return addCors(errorResponse('Too many login attempts. Try again later.', 429, { 'Retry-After': '60' }));

      const client = await db.prepare(
        'SELECT * FROM clients WHERE LOWER(TRIM(email)) = ? AND portal_enabled = 1'
      ).bind(email.toLowerCase().trim()).first();
      if (!client || !client.password_hash) return addCors(errorResponse('Invalid credentials', 401));

      const { valid, needsRehash } = await verifyPassword(password, client.password_hash);
      if (!valid) return addCors(errorResponse('Invalid credentials', 401));

      if (needsRehash) {
        const newHash = await hashPassword(password);
        await db.prepare('UPDATE clients SET password_hash = ? WHERE id = ?').bind(newHash, client.id).run();
      }

      await db.prepare('UPDATE clients SET last_portal_login = datetime(\'now\') WHERE id = ?').bind(client.id).run();
      const jwt = await signPortalJWT(client.id, client.email, client.name, env);
      return addCors(jsonResponse({
        token: jwt,
        client: {
          id: client.id, name: client.name, email: client.email,
          hasPassword: true, avatar_base64: client.avatar_base64 || null,
        },
      }));
    }

    // POST /api/portal/auth/set-password
    if (method === 'POST' && path === 'set-password') {
      const check = preflight(env, ['JWT_SECRET']);
      if (!check.ok) return addCors(errorResponse(check.error, 500));

      const auth = await verifyPortalAuth(request, env);
      if (!auth.valid) return addCors(errorResponse('Unauthorized', 401));

      let body;
      try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON body', 400)); }
      const { password } = body || {};
      if (!password || password.length < 8) return addCors(errorResponse('Password must be at least 8 characters', 400));

      const db = env.DB;
      const passwordHash = await hashPassword(password);
      await db.prepare('UPDATE clients SET password_hash = ? WHERE id = ?').bind(passwordHash, auth.clientId).run();
      return addCors(jsonResponse({ success: true }));
    }

    // POST /api/portal/auth/forgot-password
    if (method === 'POST' && path === 'forgot-password') {
      const db = env.DB;
      const genericSuccess = () => addCors(jsonResponse({
        success: true, message: 'If that email is in our system, a recovery link has been sent.',
      }));

      let body;
      try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON body', 400)); }
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!email) return addCors(errorResponse('Email is required', 400));

      // Rate limit: 3 per 5 min per email
      const rl = await checkRateLimit(db, 'forgot:' + email, 3, 5);
      if (!rl.allowed) return genericSuccess();

      const client = await db.prepare(
        'SELECT id, name, email FROM clients WHERE LOWER(TRIM(email)) = ? LIMIT 1'
      ).bind(email).first();
      if (!client) return genericSuccess();

      const token = generateToken(32);
      const tokenHash = await sha256(token);
      const ip = request.headers.get('CF-Connecting-IP');
      const ua = request.headers.get('User-Agent');

      await db.prepare(
        `INSERT INTO portal_sessions (client_id, token_hash, type, ip_address, user_agent, expires_at)
         VALUES (?, ?, 'password_recovery', ?, ?, datetime('now', '+1 hour'))`
      ).bind(client.id, tokenHash, ip, ua).run();

      await db.prepare('UPDATE clients SET portal_enabled = 1 WHERE id = ?').bind(client.id).run();

      const siteUrl = (env.SITE_URL || 'https://example.com').replace(/\/+$/, '');
      const portalUrl = siteUrl + '/portal/?token=' + token;
      const businessName = env.BUSINESS_NAME || 'your service provider';
      const safeName = escapeHtml(client.name || 'there');

      try {
        await sendEmail(env, {
          to: client.email,
          subject: businessName + ' — Reset Your Portal Password',
          html: '<p>Hi ' + safeName + ',</p><p>We received a request to reset your client portal password.</p><p><a href="' + escapeHtml(portalUrl) + '" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;font-weight:600;">Reset Password</a></p><p style="font-size:12px;color:#999;">This link expires in 1 hour. If you did not request this, ignore this email.</p>',
          text: 'Hi ' + (client.name || 'there') + ',\n\nReset your password: ' + portalUrl + '\n\nThis link expires in 1 hour.',
        });
      } catch (e) {
        console.error('[PortalAuth] Email send failed:', e);
      }

      return genericSuccess();
    }

    // GET /api/portal/auth/check
    if (method === 'GET' && path === 'check') {
      const check = preflight(env, ['JWT_SECRET']);
      if (!check.ok) return addCors(errorResponse(check.error, 500));

      const auth = await verifyPortalAuth(request, env);
      if (!auth.valid) return addCors(errorResponse('Unauthorized', 401));

      const db = env.DB;
      const client = await db.prepare(
        'SELECT id, name, email, password_hash IS NOT NULL as has_password, avatar_base64 FROM clients WHERE id = ?'
      ).bind(auth.clientId).first();
      if (!client) return addCors(errorResponse('Client not found', 404));

      return addCors(jsonResponse({
        client: {
          id: client.id, name: client.name, email: client.email,
          hasPassword: !!client.has_password, avatar_base64: client.avatar_base64 || null,
        },
      }));
    }

    return addCors(errorResponse('Not found', 404));
  } catch (error) {
    console.error('[PortalAuth] Error:', error);
    return addCors(errorResponse('Internal server error', 500));
  }
}
