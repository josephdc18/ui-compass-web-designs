/**
 * Portal Notifications API — catch-all route handler
 * GET  /api/portal/notifications        — List notifications for authenticated client
 * POST /api/portal/notifications/read   — Mark notification(s) as read
 * GET  /api/portal/notifications/count  — Unread count
 */

import { verifyPortalToken } from '../../../lib/portal-auth.js';
import { preflight } from '../../../lib/preflight.js';
import { ensureMigrations } from '../../../lib/migrate.js';

const PORTAL_NOTIFICATIONS_MIGRATIONS = { pack: 'portal', migrations: [] };
let notificationsMigrated = false;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
function errorResponse(message, status = 400) { return jsonResponse({ error: message }, status); }

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map(s => s.trim())
    : [env.SITE_URL || ''].map(s => s.replace(/\/+$/, ''));
  const isDev = !env.SITE_URL || String(env.SITE_URL).startsWith('http://localhost');
  const isAllowed = isDev ? origin.startsWith('http://localhost') : allowed.includes(origin);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
  };
  if (isAllowed && origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const corsHeaders = getCorsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  const addCors = (res) => { for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v); return res; };

  const check = preflight(env, ['JWT_SECRET']);
  if (!check.ok) return addCors(errorResponse(check.error, 500));

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const auth = await verifyPortalToken(token, env);
  if (!auth.valid) return addCors(errorResponse('Unauthorized', 401));

  const db = env.DB;
  const path = (params.path || []).join('/');
  const method = request.method;

  try {
    if (!notificationsMigrated) {
      try { await ensureMigrations(db, PORTAL_NOTIFICATIONS_MIGRATIONS); notificationsMigrated = true; }
      catch (e) { console.error('[PortalNotifications] Migration failed:', e); return addCors(errorResponse('Database migration failed. Contact administrator.', 503)); }
    }

    if ((method === 'POST' || method === 'PUT' || method === 'DELETE') &&
        !(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
      return addCors(errorResponse('Content-Type must be application/json', 415));
    }

    // GET /api/portal/notifications
    if (method === 'GET' && (path === '' || path === 'list')) {
      const limit = Math.min(parseInt(new URL(request.url).searchParams.get('limit') || '50'), 100);
      const rows = await db.prepare(
        `SELECT id, type, title, message, action_url, is_read, created_at, read_at
         FROM portal_notifications
         WHERE recipient_type = 'client' AND recipient_id = ?
         ORDER BY created_at DESC LIMIT ?`
      ).bind(auth.clientId, limit).all();
      return addCors(jsonResponse({ notifications: rows.results || [] }));
    }

    // GET /api/portal/notifications/count
    if (method === 'GET' && path === 'count') {
      const row = await db.prepare(
        `SELECT COUNT(*) as count FROM portal_notifications
         WHERE recipient_type = 'client' AND recipient_id = ? AND is_read = 0`
      ).bind(auth.clientId).first();
      return addCors(jsonResponse({ unread: row?.count || 0 }));
    }

    // POST /api/portal/notifications/read
    if (method === 'POST' && path === 'read') {
      let body;
      try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { ids } = body || {};
      if (!Array.isArray(ids) || ids.length === 0) return addCors(errorResponse('ids array required', 400));
      const placeholders = ids.map(() => '?').join(',');
      await db.prepare(
        `UPDATE portal_notifications SET is_read = 1, read_at = datetime('now')
         WHERE id IN (${placeholders}) AND recipient_type = 'client' AND recipient_id = ?`
      ).bind(...ids, auth.clientId).run();
      return addCors(jsonResponse({ success: true }));
    }

    return addCors(errorResponse('Not found', 404));
  } catch (error) {
    console.error('[PortalNotifications] Error:', error);
    return addCors(errorResponse('Internal server error', 500));
  }
}
