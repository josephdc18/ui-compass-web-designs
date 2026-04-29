/**
 * Admin Messaging API — catch-all route handler
 * GET    /api/admin/messages/conversations       — List conversations with unread counts
 * GET    /api/admin/messages/conversation/:id     — Get messages for a conversation
 * POST   /api/admin/messages/send                 — Send message to a conversation
 * POST   /api/admin/messages/react                — Toggle reaction on a message
 * POST   /api/admin/messages/edit                 — Edit a message (within 15 min)
 * POST   /api/admin/messages/delete               — Soft-delete a message (within 1 hour)
 * POST   /api/admin/messages/typing               — Update typing indicator
 * GET    /api/admin/messages/poll                  — Long poll for new messages
 * POST   /api/admin/messages/read                  — Mark conversation as read
 * GET    /api/admin/messages/giphy                 — Search GIFs
 */

import { requirePortalAdminAuth } from '../../../lib/portal-admin-auth.js';
import { createNotification } from '../../../lib/notifications.js';
import { checkRateLimit, sanitizeString } from '../../../lib/security.js';
import { preflight } from '../../../lib/preflight.js';
import { ensureMigrations } from '../../../lib/migrate.js';

const MSG_ADMIN_MIGRATIONS = { pack: 'messaging', migrations: [] };
let msgAdminMigrated = false;

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

  const pf = preflight(env, []);
  if (!pf.ok) return addCors(errorResponse(pf.error, 500));

  const authResult = await requirePortalAdminAuth(request, env);
  if (!authResult.ok) return addCors(errorResponse(authResult.error, authResult.status));

  const db = env.DB;
  const path = (params.path || []).join('/');
  const method = request.method;
  const url = new URL(request.url);

  try {
    if (!msgAdminMigrated) {
      try { await ensureMigrations(db, MSG_ADMIN_MIGRATIONS); msgAdminMigrated = true; }
      catch (e) { console.error('[AdminMessages] Migration failed:', e); return addCors(errorResponse('Database migration failed. Contact administrator.', 503)); }
    }

    if ((method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
        !(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
      return addCors(errorResponse('Content-Type must be application/json', 415));
    }

    // GET conversations
    if (method === 'GET' && path === 'conversations') {
      const rows = await db.prepare(
        `SELECT c.id, c.client_id, c.last_message_at, c.admin_last_read_at, c.admin_last_read_id,
                cl.name as client_name, cl.email as client_email, cl.avatar_base64, cl.last_portal_login,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id
                  AND m.sender_type = 'client'
                  AND (c.admin_last_read_at IS NULL OR m.created_at > c.admin_last_read_at
                    OR (m.created_at = c.admin_last_read_at AND m.id > COALESCE(c.admin_last_read_id, '')))) as unread_count,
                (SELECT body FROM messages m2 WHERE m2.conversation_id = c.id
                  AND m2.is_deleted = 0 ORDER BY m2.created_at DESC LIMIT 1) as last_message_preview
         FROM conversations c
         JOIN clients cl ON cl.id = c.client_id
         ORDER BY c.last_message_at DESC NULLS LAST`
      ).all();
      return addCors(jsonResponse({ conversations: rows.results || [] }));
    }

    // GET conversation/:id messages
    if (method === 'GET' && path.startsWith('conversation/')) {
      const convId = path.split('/')[1];
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const before = url.searchParams.get('before');
      let query = `SELECT m.*, mr_agg.reactions FROM messages m
        LEFT JOIN (
          SELECT message_id, json_group_array(json_object('emoji', emoji, 'reactor_type', reactor_type, 'reactor_id', reactor_id)) as reactions
          FROM message_reactions GROUP BY message_id
        ) mr_agg ON mr_agg.message_id = m.id
        WHERE m.conversation_id = ?`;
      const binds = [convId];
      if (before) { query += ' AND m.created_at < ?'; binds.push(before); }
      query += ' ORDER BY m.created_at DESC, m.id DESC LIMIT ?';
      binds.push(limit);
      const rows = await db.prepare(query).bind(...binds).all();
      const messages = (rows.results || []).reverse().map(m => ({
        ...m, reactions: m.reactions ? JSON.parse(m.reactions) : [],
        body: m.is_deleted ? null : m.body,
      }));

      // Typing indicator
      const [typing, convMeta] = await Promise.all([
        db.prepare(
          `SELECT sender_type, sender_id FROM typing_indicators
           WHERE conversation_id = ? AND updated_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 seconds')`
        ).bind(convId).all(),
        db.prepare(
          'SELECT client_last_read_at, client_last_read_id FROM conversations WHERE id = ?'
        ).bind(convId).first(),
      ]);

      return addCors(jsonResponse({
        messages, typing: (typing.results || []),
        client_last_read_at: convMeta?.client_last_read_at || null,
        client_last_read_id: convMeta?.client_last_read_id || null,
      }));
    }

    // POST send
    if (method === 'POST' && path === 'send') {
      const rl = await checkRateLimit(db, 'msg:admin', 60, 1);
      if (!rl.allowed) return addCors(errorResponse('Too many requests', 429, { 'Retry-After': '60' }));
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { conversation_id, client_id, body: msgBody, client_dedup_id, message_type, gif_url, gif_preview_url, gif_title, reply_to_id } = body || {};
      if (!client_dedup_id) return addCors(errorResponse('client_dedup_id is required', 400));

      let convId = conversation_id;
      // Auto-create conversation if needed
      if (!convId && client_id) {
        let existing = await db.prepare('SELECT id FROM conversations WHERE client_id = ?').bind(client_id).first();
        if (existing) { convId = existing.id; }
        else {
          const result = await db.prepare('INSERT INTO conversations (client_id) VALUES (?)').bind(client_id).run();
          const created = await db.prepare('SELECT id FROM conversations WHERE client_id = ?').bind(client_id).first();
          convId = created?.id;
        }
      }
      if (!convId) return addCors(errorResponse('conversation_id or client_id required', 400));

      const type = message_type || 'text';
      if (type === 'gif' && gif_url && !isValidGiphyUrl(gif_url)) return addCors(errorResponse('Invalid GIF URL', 400));
      if (type === 'text' && (!msgBody || !msgBody.trim())) return addCors(errorResponse('Message body is required', 400));

      const cleanBody = type === 'text' ? sanitizeString(msgBody, 5000) : null;

      try {
        await db.prepare(
          `INSERT INTO messages (conversation_id, sender_type, sender_id, body, client_dedup_id, message_type, gif_url, gif_preview_url, gif_title, reply_to_id)
           VALUES (?, 'admin', 'admin', ?, ?, ?, ?, ?, ?, ?)`
        ).bind(convId, cleanBody, client_dedup_id, type, gif_url || null, gif_preview_url || null, gif_title || null, reply_to_id || null).run();
      } catch (e) {
        if (String(e.message || '').includes('UNIQUE')) {
          const existing = await db.prepare(
            `SELECT id, created_at FROM messages WHERE sender_type = 'admin' AND sender_id = 'admin' AND client_dedup_id = ?`
          ).bind(client_dedup_id).first();
          return addCors(jsonResponse({ id: existing?.id, deduplicated: true }));
        }
        throw e;
      }

      await db.prepare(`UPDATE conversations SET last_message_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).bind(convId).run();

      // Notify client
      const conv = await db.prepare('SELECT client_id FROM conversations WHERE id = ?').bind(convId).first();
      if (conv) {
        const businessName = env.BUSINESS_NAME || 'Support';
        try {
          await createNotification(db, {
            recipientType: 'client', recipientId: conv.client_id,
            type: 'new_message', title: 'New Message',
            message: `New message from ${businessName}`,
          });
        } catch (_) {}
      }

      const msg = await db.prepare('SELECT * FROM messages WHERE client_dedup_id = ? AND sender_type = \'admin\'').bind(client_dedup_id).first();
      return addCors(jsonResponse({ message: msg }, 201));
    }

    // POST react
    if (method === 'POST' && path === 'react') {
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { message_id, emoji } = body || {};
      if (!message_id || !emoji) return addCors(errorResponse('message_id and emoji required', 400));
      if (!EMOJI_RE.test(emoji)) return addCors(errorResponse('Invalid emoji', 400));

      // Check max 6 unique reactions per message
      const countRow = await db.prepare('SELECT COUNT(DISTINCT emoji) as cnt FROM message_reactions WHERE message_id = ?').bind(message_id).first();
      const existing = await db.prepare(
        `SELECT id FROM message_reactions WHERE message_id = ? AND reactor_type = 'admin' AND reactor_id = 'admin' AND emoji = ?`
      ).bind(message_id, emoji).first();
      if (existing) {
        await db.prepare('DELETE FROM message_reactions WHERE id = ?').bind(existing.id).run();
        return addCors(jsonResponse({ toggled: 'off' }));
      }
      if ((countRow?.cnt || 0) >= 6) return addCors(errorResponse('Max 6 unique reactions per message', 400));
      await db.prepare(
        `INSERT INTO message_reactions (message_id, reactor_type, reactor_id, emoji) VALUES (?, 'admin', 'admin', ?)`
      ).bind(message_id, emoji).run();
      return addCors(jsonResponse({ toggled: 'on' }));
    }

    // POST edit
    if (method === 'POST' && path === 'edit') {
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { message_id, body: newBody } = body || {};
      if (!message_id || !newBody?.trim()) return addCors(errorResponse('message_id and body required', 400));
      const msg = await db.prepare(
        `SELECT * FROM messages WHERE id = ? AND sender_type = 'admin' AND is_deleted = 0`
      ).bind(message_id).first();
      if (!msg) return addCors(errorResponse('Message not found', 404));
      const created = new Date(msg.created_at).getTime();
      if (Date.now() - created > 15 * 60 * 1000) return addCors(errorResponse('Edit window expired (15 min)', 403));
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
        `SELECT * FROM messages WHERE id = ? AND sender_type = 'admin' AND is_deleted = 0`
      ).bind(message_id).first();
      if (!msg) return addCors(errorResponse('Message not found', 404));
      const created = new Date(msg.created_at).getTime();
      if (Date.now() - created > 60 * 60 * 1000) return addCors(errorResponse('Delete window expired (1 hour)', 403));
      await db.prepare(
        `UPDATE messages SET body = NULL, is_deleted = 1, deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
      ).bind(message_id).run();
      return addCors(jsonResponse({ success: true }));
    }

    // POST typing
    if (method === 'POST' && path === 'typing') {
      const rl = await checkRateLimit(db, 'typing:admin', 25, 1);
      if (!rl.allowed) return addCors(errorResponse('Too many requests', 429, { 'Retry-After': '60' }));
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { conversation_id } = body || {};
      if (!conversation_id) return addCors(errorResponse('conversation_id required', 400));
      await db.prepare(
        `INSERT INTO typing_indicators (conversation_id, sender_type, sender_id, updated_at)
         VALUES (?, 'admin', 'admin', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
         ON CONFLICT(conversation_id, sender_type, sender_id) DO UPDATE SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
      ).bind(conversation_id).run();
      return addCors(jsonResponse({ success: true }));
    }

    // GET poll
    if (method === 'GET' && path === 'poll') {
      const rl = await checkRateLimit(db, 'poll:admin', 40, 1);
      if (!rl.allowed) return addCors(errorResponse('Too many requests', 429, { 'Retry-After': '60' }));
      const convId = url.searchParams.get('conversation_id');
      const afterTime = url.searchParams.get('after_time');
      const afterId = url.searchParams.get('after_id');
      if (!convId) return addCors(errorResponse('conversation_id required', 400));

      let query = 'SELECT * FROM messages WHERE conversation_id = ?';
      const binds = [convId];
      if (afterTime && afterId) {
        query += ' AND (created_at > ? OR (created_at = ? AND id > ?))';
        binds.push(afterTime, afterTime, afterId);
      }
      query += ' ORDER BY created_at ASC, id ASC LIMIT 50';
      const [rows, typing, pollConvMeta] = await Promise.all([
        db.prepare(query).bind(...binds).all(),
        db.prepare(
          `SELECT sender_type FROM typing_indicators
           WHERE conversation_id = ? AND sender_type = 'client' AND updated_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 seconds')`
        ).bind(convId).all(),
        db.prepare(
          'SELECT client_last_read_at, client_last_read_id FROM conversations WHERE id = ?'
        ).bind(convId).first(),
      ]);

      return addCors(jsonResponse({
        messages: (rows.results || []).map(m => ({ ...m, body: m.is_deleted ? null : m.body })),
        typing: (typing.results || []),
        client_last_read_at: pollConvMeta?.client_last_read_at || null,
        client_last_read_id: pollConvMeta?.client_last_read_id || null,
      }));
    }

    // POST read
    if (method === 'POST' && path === 'read') {
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { conversation_id, last_read_id, last_read_at } = body || {};
      if (!conversation_id) return addCors(errorResponse('conversation_id required', 400));
      const readAt = last_read_at || new Date().toISOString();
      const readId = last_read_id || null;
      await db.prepare(
        `UPDATE conversations SET admin_last_read_at = ?, admin_last_read_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ? AND (admin_last_read_at IS NULL OR admin_last_read_at < ? OR (admin_last_read_at = ? AND COALESCE(admin_last_read_id, '') < COALESCE(?, '')))`
      ).bind(readAt, readId, conversation_id, readAt, readAt, readId).run();
      return addCors(jsonResponse({ success: true }));
    }

    // GET giphy
    if (method === 'GET' && path === 'giphy') {
      const apiKey = env.GIPHY_API_KEY;
      if (!apiKey) return addCors(errorResponse('GIF search not configured', 503));
      const q = url.searchParams.get('q') || '';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const endpoint = q
        ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&offset=${offset}&rating=g`;
      const res = await fetch(endpoint);
      if (!res.ok) return addCors(errorResponse('Giphy request failed', 502));
      const data = await res.json();
      const gifs = (data.data || []).map(g => ({
        id: g.id,
        title: g.title,
        url: g.images?.original?.url || '',
        preview_url: g.images?.fixed_width_small?.url || g.images?.preview_gif?.url || '',
        width: g.images?.original?.width,
        height: g.images?.original?.height,
      }));
      return addCors(jsonResponse({ gifs, total: data.pagination?.total_count || 0 }));
    }

    return addCors(errorResponse('Not found', 404));
  } catch (error) {
    console.error('[AdminMessages] Error:', error);
    return addCors(errorResponse('Internal server error', 500));
  }
}
