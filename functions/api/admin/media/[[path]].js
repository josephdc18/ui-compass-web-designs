/**
 * Admin Media API — catch-all route handler
 * GET    /api/admin/media             — List files (with filters)
 * GET    /api/admin/media/packages    — List delivery packages
 * POST   /api/admin/media/upload      — Upload file (FormData)
 * PUT    /api/admin/media/:id         — Update metadata
 * DELETE /api/admin/media/:id         — Delete file (R2 first, then DB)
 * POST   /api/admin/media/package     — Create delivery package (ZIP)
 */

import { requirePortalAdminAuth } from '../../../lib/portal-admin-auth.js';
import { checkRateLimit } from '../../../lib/security.js';
import { preflight } from '../../../lib/preflight.js';
import { ensureMigrations } from '../../../lib/migrate.js';
import { sanitizeFilename, buildR2Key, uploadToR2, deleteFromR2 } from '../../../lib/media-storage.js';
import { generateDeliveryPackage } from '../../../lib/delivery-package.js';

const MEDIA_ADMIN_MIGRATIONS = { pack: 'media', migrations: [] };
let mediaAdminMigrated = false;

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } });
}
function errorResponse(message, status = 400, extraHeaders = {}) { return jsonResponse({ error: message }, status, extraHeaders); }

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map(s => s.trim()) : [env.SITE_URL || ''].map(s => s.replace(/\/+$/, ''));
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
  const bucket = env.MEDIA_BUCKET;
  if (!bucket) return addCors(errorResponse('MEDIA_BUCKET not configured', 500));

  const pathParts = params.path || [];
  const path = pathParts.join('/');
  const method = request.method;
  const url = new URL(request.url);

  try {
    if (!mediaAdminMigrated) {
      try { await ensureMigrations(db, MEDIA_ADMIN_MIGRATIONS); mediaAdminMigrated = true; }
      catch (e) { console.error('[AdminMedia] Migration failed:', e); return addCors(errorResponse('Database migration failed. Contact administrator.', 503)); }
    }

    // GET /api/admin/media — list files
    if (method === 'GET' && path === '') {
      const clientId = url.searchParams.get('client_id');
      const category = url.searchParams.get('category');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = `SELECT m.*, c.name as client_name
                   FROM media_files m
                   LEFT JOIN clients c ON c.id = m.client_id
                   WHERE 1=1`;
      const binds = [];
      if (clientId) { query += ' AND m.client_id = ?'; binds.push(clientId); }
      if (category) { query += ' AND m.category = ?'; binds.push(category); }
      query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
      binds.push(limit, offset);

      const rows = await db.prepare(query).bind(...binds).all();
      return addCors(jsonResponse({ files: rows.results || [] }));
    }

    // GET /api/admin/media/packages — list delivery packages
    if (method === 'GET' && path === 'packages') {
      const clientId = url.searchParams.get('client_id');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = `SELECT p.*, c.name as client_name
                   FROM delivery_packages p
                   LEFT JOIN clients c ON c.id = p.client_id
                   WHERE 1=1`;
      const binds = [];
      if (clientId) { query += ' AND p.client_id = ?'; binds.push(clientId); }
      query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      binds.push(limit, offset);

      const rows = await db.prepare(query).bind(...binds).all();
      return addCors(jsonResponse({ packages: rows.results || [] }));
    }

    // POST /api/admin/media/upload — upload file
    if (method === 'POST' && path === 'upload') {
      const rl = await checkRateLimit(db, 'media:admin:upload', 60, 1);
      if (!rl.allowed) return addCors(errorResponse('Too many requests', 429, { 'Retry-After': '60' }));

      const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
      if (!contentType.includes('multipart/form-data')) {
        return addCors(errorResponse('Content-Type must be multipart/form-data', 415));
      }

      let formData;
      try { formData = await request.formData(); } catch { return addCors(errorResponse('Invalid form data', 400)); }

      const file = formData.get('file');
      const clientId = formData.get('client_id');
      const category = formData.get('category') || 'document';
      const collectionName = formData.get('collection_name') || null;
      const title = formData.get('title') || null;

      if (!file || typeof file === 'string') return addCors(errorResponse('file is required', 400));
      if (!clientId) return addCors(errorResponse('client_id is required', 400));

      const validCategories = ['photo', 'video', 'document'];
      if (!validCategories.includes(category)) return addCors(errorResponse('Invalid category. Must be: photo, video, document', 400));

      // Verify client exists
      const client = await db.prepare('SELECT id FROM clients WHERE id = ?').bind(clientId).first();
      if (!client) return addCors(errorResponse('Client not found', 404));

      const filename = sanitizeFilename(file.name);
      const fileType = file.type || 'application/octet-stream';
      const arrayBuf = await file.arrayBuffer();
      const fileSize = arrayBuf.byteLength;

      // Upload to R2
      const r2Key = buildR2Key(clientId, filename);
      await uploadToR2(bucket, r2Key, arrayBuf, fileType);

      // Insert DB row
      await db.prepare(
        `INSERT INTO media_files (client_id, category, collection_name, r2_key, filename, file_size, content_type, title)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(clientId, category, collectionName, r2Key, filename, fileSize, fileType, title).run();

      const inserted = await db.prepare(
        'SELECT * FROM media_files WHERE r2_key = ? ORDER BY created_at DESC LIMIT 1'
      ).bind(r2Key).first();

      return addCors(jsonResponse({ file: inserted }, 201));
    }

    // PUT /api/admin/media/:id — update metadata
    if (method === 'PUT' && pathParts.length === 1 && pathParts[0] && !pathParts[0].includes('/')) {
      const id = pathParts[0];
      const existing = await db.prepare('SELECT * FROM media_files WHERE id = ?').bind(id).first();
      if (!existing) return addCors(errorResponse('File not found', 404));

      if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
        return addCors(errorResponse('Content-Type must be application/json', 415));
      }

      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { title, collection_name, is_published, description } = body || {};

      const newTitle = title !== undefined ? title : existing.title;
      const newCollection = collection_name !== undefined ? collection_name : existing.collection_name;
      const newPublished = is_published !== undefined ? (is_published ? 1 : 0) : existing.is_published;
      const newDescription = description !== undefined ? description : existing.description;

      await db.prepare(
        `UPDATE media_files SET title = ?, collection_name = ?, is_published = ?, description = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
      ).bind(newTitle, newCollection, newPublished, newDescription, id).run();

      const updated = await db.prepare('SELECT * FROM media_files WHERE id = ?').bind(id).first();
      return addCors(jsonResponse({ file: updated }));
    }

    // DELETE /api/admin/media/:id — delete file (R2 first, then DB)
    if (method === 'DELETE' && pathParts.length === 1 && pathParts[0] && !pathParts[0].includes('/')) {
      const id = pathParts[0];
      const existing = await db.prepare('SELECT * FROM media_files WHERE id = ?').bind(id).first();
      if (!existing) return addCors(errorResponse('File not found', 404));

      // Delete R2 object first
      try {
        await deleteFromR2(bucket, existing.r2_key);
      } catch (r2Err) {
        console.error('[AdminMedia] R2 delete failed:', r2Err);
        return addCors(errorResponse('Failed to delete file from storage', 500));
      }

      // Then delete DB row
      try {
        await db.prepare('DELETE FROM media_files WHERE id = ?').bind(id).run();
      } catch (dbErr) {
        console.error('[AdminMedia] DB delete failed after R2 success (orphaned R2 key):', existing.r2_key, dbErr);
        // R2 succeeded, return 200 — orphaned R2 is cleanup debt
        return addCors(jsonResponse({ deleted: true, warning: 'File removed from storage but database cleanup failed' }));
      }

      return addCors(jsonResponse({ deleted: true }));
    }

    // POST /api/admin/media/package — create delivery package
    if (method === 'POST' && path === 'package') {
      const rl = await checkRateLimit(db, 'media:admin:package', 10, 1);
      if (!rl.allowed) return addCors(errorResponse('Too many requests', 429, { 'Retry-After': '60' }));

      if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
        return addCors(errorResponse('Content-Type must be application/json', 415));
      }

      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { client_id, file_ids, filename } = body || {};

      if (!client_id) return addCors(errorResponse('client_id is required', 400));
      if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
        return addCors(errorResponse('file_ids must be a non-empty array', 400));
      }

      // Verify client exists
      const client = await db.prepare('SELECT id FROM clients WHERE id = ?').bind(client_id).first();
      if (!client) return addCors(errorResponse('Client not found', 404));

      try {
        const pkg = await generateDeliveryPackage(env, db, client_id, file_ids, filename || null);
        return addCors(jsonResponse({ package: pkg }, 201));
      } catch (pkgErr) {
        console.error('[AdminMedia] Package creation failed:', pkgErr);
        return addCors(errorResponse('Package creation failed: ' + pkgErr.message, 500));
      }
    }

    return addCors(errorResponse('Not found', 404));
  } catch (error) {
    console.error('[AdminMedia] Error:', error);
    return addCors(errorResponse('Internal server error', 500));
  }
}
