/**
 * Admin Clients API — catch-all route handler
 * GET    /api/admin/clients           — List all clients
 * POST   /api/admin/clients           — Create client
 * GET    /api/admin/clients/:id       — Get single client
 * PUT    /api/admin/clients/:id       — Update client
 * DELETE /api/admin/clients/:id       — Deactivate client (soft delete)
 * POST   /api/admin/clients/:id/send-link — Send magic link
 */

import { requirePortalAdminAuth } from '../../../lib/portal-admin-auth.js';
import { createNotification } from '../../../lib/notifications.js';
import { sendEmail } from '../../../lib/email.js';
import { sha256, generateToken, sanitizeString, isValidEmail, hashPassword } from '../../../lib/security.js';
import { preflight } from '../../../lib/preflight.js';
import { ensureMigrations } from '../../../lib/migrate.js';

const PORTAL_ADMIN_MIGRATIONS = { pack: 'portal', migrations: [] };
let adminMigrated = false;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
function errorResponse(message, status = 400) { return jsonResponse({ error: message }, status); }
function escapeHtml(v) { if (v == null) return ''; return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map(s => s.trim())
    : [env.SITE_URL || ''].map(s => s.replace(/\/+$/, ''));
  const isDev = !env.SITE_URL || String(env.SITE_URL).startsWith('http://localhost');
  const isAllowed = isDev ? origin.startsWith('http://localhost') : allowed.includes(origin);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
  const addCors = (res) => { for (const [k,v] of Object.entries(corsHeaders)) res.headers.set(k,v); return res; };

  const pf = preflight(env, []);
  if (!pf.ok) return addCors(errorResponse(pf.error, 500));

  const authResult = await requirePortalAdminAuth(request, env);
  if (!authResult.ok) return addCors(errorResponse(authResult.error, authResult.status));

  const db = env.DB;
  const pathParts = params.path || [];
  const method = request.method;

  try {
    if (!adminMigrated) {
      try { await ensureMigrations(db, PORTAL_ADMIN_MIGRATIONS); adminMigrated = true; }
      catch (e) { console.error('[AdminClients] Migration failed:', e); return addCors(errorResponse('Database migration failed. Contact administrator.', 503)); }
    }

    if ((method === 'POST' || method === 'PUT' || method === 'DELETE') &&
        !(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
      return addCors(errorResponse('Content-Type must be application/json', 415));
    }

    // GET /api/admin/clients — list
    if (method === 'GET' && pathParts.length === 0) {
      const rows = await db.prepare(
        'SELECT id, name, email, portal_enabled, is_active, last_portal_login, created_at, password_hash IS NOT NULL as has_password FROM clients ORDER BY created_at DESC'
      ).all();
      return addCors(jsonResponse({ clients: rows.results || [] }));
    }

    // POST /api/admin/clients — create
    if (method === 'POST' && pathParts.length === 0) {
      let body;
      try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { name, email, notes, password, portal_enabled } = body || {};
      if (!name || typeof name !== 'string') return addCors(errorResponse('name is required', 400));
      const cleanName = sanitizeString(name, 200);
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      if (cleanEmail && !isValidEmail(cleanEmail)) return addCors(errorResponse('Invalid email', 400));
      const cleanNotes = notes ? sanitizeString(notes, 2000) : null;
      const cleanPassword = typeof password === 'string' ? password : '';
      if (cleanPassword && cleanPassword.length < 8) return addCors(errorResponse('Password must be at least 8 characters', 400));
      const passwordHash = cleanPassword ? await hashPassword(cleanPassword) : null;
      const portalEnabled = portal_enabled !== undefined
        ? (portal_enabled ? 1 : 0)
        : (passwordHash ? 1 : 0);

      const result = await db.prepare(
        'INSERT INTO clients (name, email, notes, password_hash, portal_enabled) VALUES (?, ?, ?, ?, ?)'
      ).bind(cleanName, cleanEmail, cleanNotes, passwordHash, portalEnabled).run();
      const id = result?.meta?.last_row_id;
      return addCors(jsonResponse({ id, name: cleanName, email: cleanEmail, portal_enabled: !!portalEnabled, has_password: !!passwordHash }, 201));
    }

    // Routes with :id
    if (pathParts.length >= 1) {
      const clientId = pathParts[0];

      // GET /api/admin/clients/:id
      if (method === 'GET' && pathParts.length === 1) {
        const client = await db.prepare('SELECT * FROM clients WHERE id = ?').bind(clientId).first();
        if (!client) return addCors(errorResponse('Not found', 404));
        return addCors(jsonResponse({ client }));
      }

      // PUT /api/admin/clients/:id
      if (method === 'PUT' && pathParts.length === 1) {
        let body;
        try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
        const updates = [];
        const binds = [];
        if (body.name !== undefined) { updates.push('name = ?'); binds.push(sanitizeString(body.name, 200)); }
        if (body.email !== undefined) {
          const e = body.email ? body.email.trim().toLowerCase() : null;
          if (e && !isValidEmail(e)) return addCors(errorResponse('Invalid email', 400));
          updates.push('email = ?'); binds.push(e);
        }
        if (body.notes !== undefined) { updates.push('notes = ?'); binds.push(sanitizeString(body.notes, 2000)); }
        if (body.password !== undefined) {
          if (body.password === null || body.password === '') {
            updates.push('password_hash = ?'); binds.push(null);
          } else {
            if (typeof body.password !== 'string' || body.password.length < 8) {
              return addCors(errorResponse('Password must be at least 8 characters', 400));
            }
            const pwHash = await hashPassword(body.password);
            updates.push('password_hash = ?'); binds.push(pwHash);
            if (body.portal_enabled === undefined) {
              updates.push('portal_enabled = ?'); binds.push(1);
            }
          }
        }
        if (body.portal_enabled !== undefined) { updates.push('portal_enabled = ?'); binds.push(body.portal_enabled ? 1 : 0); }
        if (updates.length === 0) return addCors(errorResponse('No fields to update', 400));
        updates.push('updated_at = CURRENT_TIMESTAMP');
        binds.push(clientId);
        await db.prepare('UPDATE clients SET ' + updates.join(', ') + ' WHERE id = ?').bind(...binds).run();
        return addCors(jsonResponse({ success: true }));
      }

      // DELETE /api/admin/clients/:id — soft delete
      if (method === 'DELETE' && pathParts.length === 1) {
        await db.prepare('UPDATE clients SET is_active = 0, portal_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(clientId).run();
        return addCors(jsonResponse({ success: true }));
      }

      // POST /api/admin/clients/:id/send-link
      if (method === 'POST' && pathParts[1] === 'send-link') {
        const client = await db.prepare('SELECT id, name, email FROM clients WHERE id = ?').bind(clientId).first();
        if (!client) return addCors(errorResponse('Client not found', 404));
        if (!client.email) return addCors(errorResponse('Client has no email', 400));

        const token = generateToken(32);
        const tokenHash = await sha256(token);
        await db.prepare(
          `INSERT INTO portal_sessions (client_id, token_hash, type, expires_at)
           VALUES (?, ?, 'magic_link', datetime('now', '+24 hours'))`
        ).bind(client.id, tokenHash).run();
        await db.prepare('UPDATE clients SET portal_enabled = 1 WHERE id = ?').bind(client.id).run();

        const siteUrl = (env.SITE_URL || 'https://example.com').replace(/\/+$/, '');
        const portalUrl = siteUrl + '/portal/?token=' + token;
        const businessName = env.BUSINESS_NAME || 'your service provider';
        const safeName = escapeHtml(client.name || 'there');

        await sendEmail(env, {
          to: client.email,
          subject: businessName + ' — Your Client Portal Access',
          html: '<p>Hi ' + safeName + ',</p><p>Click the link below to access your client portal:</p><p><a href="' + escapeHtml(portalUrl) + '" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;font-weight:600;">Open Portal</a></p><p style="font-size:12px;color:#999;">This link expires in 24 hours.</p>',
          text: 'Hi ' + (client.name || 'there') + ',\n\nAccess your client portal: ' + portalUrl + '\n\nThis link expires in 24 hours.',
        });

        return addCors(jsonResponse({ success: true, message: 'Magic link sent' }));
      }
    }

    return addCors(errorResponse('Not found', 404));
  } catch (error) {
    console.error('[AdminClients] Error:', error);
    return addCors(errorResponse('Internal server error', 500));
  }
}
