/**
 * Portal Messaging API — catch-all route handler
 * GET  /api/portal/messages           — Get conversation messages
 * POST /api/portal/messages/send      — Send message
 * POST /api/portal/messages/react     — Toggle reaction
 * POST /api/portal/messages/edit      — Edit own message (within 15 min)
 * POST /api/portal/messages/delete    — Delete own message (within 1 hour)
 * POST /api/portal/messages/typing    — Update typing indicator
 * GET  /api/portal/messages/poll      — Long poll for new messages
 * POST /api/portal/messages/read      — Mark as read
 */

import { verifyPortalToken } from '../../../lib/portal-auth.js';
import { preflight } from '../../../lib/preflight.js';
import { createNotification } from '../../../lib/notifications.js';
import { checkRateLimit, sanitizeString } from '../../../lib/security.js';
import { ensureMigrations } from '../../../lib/migrate.js';

const MSG_PORTAL_MIGRATIONS = { pack: 'messaging', migrations: [] };
let msgPortalMigrated = false;

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } });
}
function errorResponse(message, status = 400, extraHeaders = {}) { return jsonResponse({ error: message }, status, extraHeaders); }

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map(s => s.trim()) : [env.SITE_URL || ''].map(s => s.replace(/\/+$/, ''));
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

const EMOJI_RE = /^[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D\u{1F3FB}-\u{1F3FF}\u20E3#*0-9]+$/u;
const GIPHY_DOMAINS = ['i.giphy.com', 'media.giphy.com', 'media0.giphy.com', 'media1.giphy.com', 'media2.giphy.com', 'media3.giphy.com', 'media4.giphy.com'];
function isValidGiphyUrl(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && GIPHY_DOMAINS.includes(u.hostname); } catch { return false; }
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const corsHeaders = getCorsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  const addCors = (res) => { for (const [k,v] of Object.entries(corsHeaders)) res.headers.set(k,v); return res; };

  const check = preflight(env, ['JWT_SECRET']);
  if (!check.ok) return addCors(errorResponse(check.error, 500));

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const auth = await verifyPortalToken(token, env);
  if (!auth.valid) return addCors(errorResponse('Unauthorized', 401));

  const db = env.DB;
  const clientId = auth.clientId;
  const path = (params.path || []).join('/');
  const method = request.method;
  const url = new URL(request.url);

  try {
    if (!msgPortalMigrated) {
      try { await ensureMigrations(db, MSG_PORTAL_MIGRATIONS); msgPortalMigrated = true; }
      catch (e) { console.error('[PortalMessages] Migration failed:', e); return addCors(errorResponse('Database migration failed. Contact administrator.', 503)); }
    }

    if ((method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
        !(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
      return addCors(errorResponse('Content-Type must be application/json', 415));
    }

    // Get or create conversation for this client
    async function getConversation() {
      let conv = await db.prepare('SELECT * FROM conversations WHERE client_id = ?').bind(clientId).first();
      if (!conv) {
        await db.prepare('INSERT INTO conversations (client_id) VALUES (?)').bind(clientId).run();
        conv = await db.prepare('SELECT * FROM conversations WHERE client_id = ?').bind(clientId).first();
      }
      return conv;
    }

    // GET messages
    if (method === 'GET' && (path === '' || path === 'list')) {
      const conv = await getConversation();
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const rows = await db.prepare(
        `SELECT m.*, mr_agg.reactions FROM messages m
         LEFT JOIN (
           SELECT message_id, json_group_array(json_object('emoji', emoji, 'reactor_type', reactor_type, 'reactor_id', reactor_id)) as reactions
           FROM message_reactions GROUP BY message_id
         ) mr_agg ON mr_agg.message_id = m.id
         WHERE m.conversation_id = ?
         ORDER BY m.created_at DESC, m.id DESC LIMIT ?`
      ).bind(conv.id, limit).all();
      const messages = (rows.results || []).reverse().map(m => ({
        ...m, reactions: m.reactions ? JSON.parse(m.reactions) : [],
        body: m.is_deleted ? null : m.body,
      }));
      return addCors(jsonResponse({
        conversation_id: conv.id, messages,
        admin_last_read_at: conv.admin_last_read_at || null,
        admin_last_read_id: conv.admin_last_read_id || null,
        business_name: env.BUSINESS_NAME || 'Support',
      }));
    }

    // POST send
    if (method === 'POST' && path === 'send') {
      const rl = await checkRateLimit(db, `msg:client:${clientId}`, 30, 1);
      if (!rl.allowed) return addCors(errorResponse('Too many requests', 429, { 'Retry-After': '60' }));
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { body: msgBody, client_dedup_id, message_type, gif_url, gif_preview_url, gif_title, reply_to_id } = body || {};
      if (!client_dedup_id) return addCors(errorResponse('client_dedup_id is required', 400));

      const conv = await getConversation();
      const type = message_type || 'text';
      if (type === 'gif' && gif_url && !isValidGiphyUrl(gif_url)) return addCors(errorResponse('Invalid GIF URL', 400));
      if (type === 'text' && (!msgBody || !msgBody.trim())) return addCors(errorResponse('Message body is required', 400));
      const cleanBody = type === 'text' ? sanitizeString(msgBody, 5000) : null;

      try {
        await db.prepare(
          `INSERT INTO messages (conversation_id, sender_type, sender_id, body, client_dedup_id, message_type, gif_url, gif_preview_url, gif_title, reply_to_id)
           VALUES (?, 'client', ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(conv.id, String(clientId), cleanBody, client_dedup_id, type, gif_url || null, gif_preview_url || null, gif_title || null, reply_to_id || null).run();
      } catch (e) {
        if (String(e.message || '').includes('UNIQUE')) {
          const existing = await db.prepare(
            'SELECT id FROM messages WHERE sender_type = \'client\' AND sender_id = ? AND client_dedup_id = ?'
          ).bind(String(clientId), client_dedup_id).first();
          return addCors(jsonResponse({ id: existing?.id, deduplicated: true }));
        }
        throw e;
      }

      await db.prepare(`UPDATE conversations SET last_message_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).bind(conv.id).run();

      try {
        await createNotification(db, {
          recipientType: 'admin', type: 'new_message', title: 'New Message',
          message: `${auth.name || 'A client'} sent you a message`,
        });
      } catch (_) {}

      const msg = await db.prepare('SELECT * FROM messages WHERE client_dedup_id = ? AND sender_type = \'client\' AND sender_id = ?').bind(client_dedup_id, String(clientId)).first();
      return addCors(jsonResponse({ message: msg }, 201));
    }

    // POST react
    if (method === 'POST' && path === 'react') {
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { message_id, emoji } = body || {};
      if (!message_id || !emoji) return addCors(errorResponse('message_id and emoji required', 400));
      if (!EMOJI_RE.test(emoji)) return addCors(errorResponse('Invalid emoji', 400));

      // Verify message belongs to client's conversation
      const conv = await getConversation();
      const msg = await db.prepare('SELECT id FROM messages WHERE id = ? AND conversation_id = ?').bind(message_id, conv.id).first();
      if (!msg) return addCors(errorResponse('Message not found', 404));

      const countRow = await db.prepare('SELECT COUNT(DISTINCT emoji) as cnt FROM message_reactions WHERE message_id = ?').bind(message_id).first();
      const existing = await db.prepare(
        'SELECT id FROM message_reactions WHERE message_id = ? AND reactor_type = \'client\' AND reactor_id = ? AND emoji = ?'
      ).bind(message_id, String(clientId), emoji).first();
      if (existing) {
        await db.prepare('DELETE FROM message_reactions WHERE id = ?').bind(existing.id).run();
        return addCors(jsonResponse({ toggled: 'off' }));
      }
      if ((countRow?.cnt || 0) >= 6) return addCors(errorResponse('Max 6 unique reactions per message', 400));
      await db.prepare(
        'INSERT INTO message_reactions (message_id, reactor_type, reactor_id, emoji) VALUES (?, \'client\', ?, ?)'
      ).bind(message_id, String(clientId), emoji).run();
      return addCors(jsonResponse({ toggled: 'on' }));
    }

    // POST edit
    if (method === 'POST' && path === 'edit') {
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { message_id, body: newBody } = body || {};
      if (!message_id || !newBody?.trim()) return addCors(errorResponse('message_id and body required', 400));
      const msg = await db.prepare(
        'SELECT * FROM messages WHERE id = ? AND sender_type = \'client\' AND sender_id = ? AND is_deleted = 0'
      ).bind(message_id, String(clientId)).first();
      if (!msg) return addCors(errorResponse('Message not found', 404));
      if (Date.now() - new Date(msg.created_at).getTime() > 15 * 60 * 1000) return addCors(errorResponse('Edit window expired', 403));
      await db.prepare(
        `UPDATE messages SET body = ?, is_edited = 1, edited_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
      ).bind(sanitizeString(newBody, 5000), message_id).run();
      return addCors(jsonResponse({ success: true }));
    }

    // POST delete
    if (method === 'POST' && path === 'delete') {
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { message_id } = body || {};
      if (!message_id) return addCors(errorResponse('message_id required', 400));
      const msg = await db.prepare(
        'SELECT * FROM messages WHERE id = ? AND sender_type = \'client\' AND sender_id = ? AND is_deleted = 0'
      ).bind(message_id, String(clientId)).first();
      if (!msg) return addCors(errorResponse('Message not found', 404));
      if (Date.now() - new Date(msg.created_at).getTime() > 60 * 60 * 1000) return addCors(errorResponse('Delete window expired', 403));
      await db.prepare(
        `UPDATE messages SET body = NULL, is_deleted = 1, deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
      ).bind(message_id).run();
      return addCors(jsonResponse({ success: true }));
    }

    // POST typing
    if (method === 'POST' && path === 'typing') {
      const rl = await checkRateLimit(db, `typing:client:${clientId}`, 25, 1);
      if (!rl.allowed) return addCors(errorResponse('Too many requests', 429, { 'Retry-After': '60' }));
      const conv = await getConversation();
      await db.prepare(
        `INSERT INTO typing_indicators (conversation_id, sender_type, sender_id, updated_at)
         VALUES (?, 'client', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
         ON CONFLICT(conversation_id, sender_type, sender_id) DO UPDATE SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
      ).bind(conv.id, String(clientId)).run();
      return addCors(jsonResponse({ success: true }));
    }

    // GET poll
    if (method === 'GET' && path === 'poll') {
      const rl = await checkRateLimit(db, `poll:client:${clientId}`, 40, 1);
      if (!rl.allowed) return addCors(errorResponse('Too many requests', 429, { 'Retry-After': '60' }));
      const conv = await getConversation();
      const afterTime = url.searchParams.get('after_time');
      const afterId = url.searchParams.get('after_id');
      let query = 'SELECT * FROM messages WHERE conversation_id = ?';
      const binds = [conv.id];
      if (afterTime && afterId) {
        query += ' AND (created_at > ? OR (created_at = ? AND id > ?))';
        binds.push(afterTime, afterTime, afterId);
      }
      query += ' ORDER BY created_at ASC, id ASC LIMIT 50';
      const [rows, typing] = await Promise.all([
        db.prepare(query).bind(...binds).all(),
        db.prepare(
          `SELECT sender_type FROM typing_indicators
           WHERE conversation_id = ? AND sender_type = 'admin' AND updated_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 seconds')`
        ).bind(conv.id).all(),
      ]);
      return addCors(jsonResponse({
        messages: (rows.results || []).map(m => ({ ...m, body: m.is_deleted ? null : m.body })),
        typing: (typing.results || []),
        admin_last_read_at: conv.admin_last_read_at || null,
        admin_last_read_id: conv.admin_last_read_id || null,
      }));
    }

    // POST read
    if (method === 'POST' && path === 'read') {
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const conv = await getConversation();
      const { last_read_id, last_read_at } = body || {};
      const readAt = last_read_at || new Date().toISOString();
      const readId = last_read_id || null;
      await db.prepare(
        `UPDATE conversations SET client_last_read_at = ?, client_last_read_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ? AND (client_last_read_at IS NULL OR client_last_read_at < ? OR (client_last_read_at = ? AND COALESCE(client_last_read_id, '') < COALESCE(?, '')))`
      ).bind(readAt, readId, conv.id, readAt, readAt, readId).run();
      return addCors(jsonResponse({ success: true }));
    }

    return addCors(errorResponse('Not found', 404));
  } catch (error) {
    console.error('[PortalMessages] Error:', error);
    return addCors(errorResponse('Internal server error', 500));
  }
}
