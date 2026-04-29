/**
 * Portal Media API — catch-all route handler
 * GET  /api/portal/media                — Published files grouped by collection
 * GET  /api/portal/media/:id/file       — Stream binary from R2
 * GET  /api/portal/media/:id/download   — Stream binary with Content-Disposition
 * GET  /api/portal/media/packages       — List delivery packages
 * GET  /api/portal/media/packages/:id/download — Download package ZIP
 */

import { verifyPortalToken } from '../../../lib/portal-auth.js';
import { preflight } from '../../../lib/preflight.js';
import { checkRateLimit } from '../../../lib/security.js';
import { ensureMigrations } from '../../../lib/migrate.js';

const MEDIA_PORTAL_MIGRATIONS = { pack: 'media', migrations: [] };
let mediaPortalMigrated = false;

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  const check = preflight(env, ['JWT_SECRET']);
  if (!check.ok) return addCors(errorResponse(check.error, 500));

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const auth = await verifyPortalToken(token, env);
  if (!auth.valid) return addCors(errorResponse('Unauthorized', 401));

  const db = env.DB;
  const bucket = env.MEDIA_BUCKET;
  if (!bucket) return addCors(errorResponse('MEDIA_BUCKET not configured', 500));

  const clientId = auth.clientId;
  const pathParts = params.path || [];
  const path = pathParts.join('/');
  const method = request.method;

  try {
    if (!mediaPortalMigrated) {
      try { await ensureMigrations(db, MEDIA_PORTAL_MIGRATIONS); mediaPortalMigrated = true; }
      catch (e) { console.error('[PortalMedia] Migration failed:', e); return addCors(errorResponse('Database migration failed. Contact administrator.', 503)); }
    }

    // GET /api/portal/media — published files grouped by collection
    if (method === 'GET' && path === '') {
      const rows = await db.prepare(
        `SELECT id, category, collection_name, filename, file_size, content_type, title, description, thumbnail_base64, created_at
         FROM media_files WHERE client_id = ? AND is_published = 1
         ORDER BY collection_name ASC, created_at DESC`
      ).bind(clientId).all();
      const files = rows.results || [];

      // Group by collection
      const collectionMap = {};
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var name = f.collection_name || 'Uncategorized';
        if (!collectionMap[name]) collectionMap[name] = [];
        collectionMap[name].push(f);
      }
      const collections = Object.keys(collectionMap).map(function(name) {
        return { name: name, files: collectionMap[name] };
      });

      return addCors(jsonResponse({ collections: collections }));
    }

    // GET /api/portal/media/:id/file — stream binary
    if (method === 'GET' && pathParts.length === 2 && pathParts[1] === 'file') {
      const id = pathParts[0];
      const file = await db.prepare(
        'SELECT * FROM media_files WHERE id = ? AND client_id = ? AND is_published = 1'
      ).bind(id, clientId).first();
      if (!file) return addCors(errorResponse('File not found', 404));

      const obj = await bucket.get(file.r2_key);
      if (!obj) return addCors(errorResponse('File not found in storage', 404));

      const headers = new Headers(corsHeaders);
      headers.set('Content-Type', file.content_type || 'application/octet-stream');
      if (file.file_size) headers.set('Content-Length', String(file.file_size));
      headers.set('Cache-Control', 'private, max-age=3600');

      return new Response(obj.body, { status: 200, headers });
    }

    // GET /api/portal/media/:id/download — stream with Content-Disposition
    if (method === 'GET' && pathParts.length === 2 && pathParts[1] === 'download') {
      const id = pathParts[0];
      const file = await db.prepare(
        'SELECT * FROM media_files WHERE id = ? AND client_id = ? AND is_published = 1'
      ).bind(id, clientId).first();
      if (!file) return addCors(errorResponse('File not found', 404));

      const obj = await bucket.get(file.r2_key);
      if (!obj) return addCors(errorResponse('File not found in storage', 404));

      // Increment download count
      try {
        await db.prepare(
          `UPDATE media_files SET download_count = download_count + 1,
           last_downloaded_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
        ).bind(id).run();
      } catch (_) {}

      const headers = new Headers(corsHeaders);
      headers.set('Content-Type', file.content_type || 'application/octet-stream');
      if (file.file_size) headers.set('Content-Length', String(file.file_size));
      headers.set('Content-Disposition', 'attachment; filename="' + (file.filename || 'download').replace(/"/g, '_') + '"');

      return new Response(obj.body, { status: 200, headers });
    }

    // GET /api/portal/media/packages — list packages with computed is_expired
    if (method === 'GET' && path === 'packages') {
      const rows = await db.prepare(
        `SELECT id, filename, file_size, status, expires_at, download_count, last_downloaded_at, created_at
         FROM delivery_packages WHERE client_id = ?
         ORDER BY created_at DESC`
      ).bind(clientId).all();
      const packages = (rows.results || []).map(function(pkg) {
        var isExpired = false;
        if (pkg.expires_at) {
          isExpired = new Date(pkg.expires_at) < new Date();
        }
        return Object.assign({}, pkg, { is_expired: isExpired });
      });
      return addCors(jsonResponse({ packages: packages }));
    }

    // GET /api/portal/media/packages/:id/download — download package ZIP
    if (method === 'GET' && pathParts.length === 3 && pathParts[0] === 'packages' && pathParts[2] === 'download') {
      const pkgId = pathParts[1];

      // Rate limit: 20 downloads per client per 60 minutes
      const rl = await checkRateLimit(db, `media:pkg:dl:${clientId}`, 20, 60);
      if (!rl.allowed) return addCors(errorResponse('Download rate limit exceeded. Try again later.', 429, { 'Retry-After': '3600' }));

      const pkg = await db.prepare(
        'SELECT * FROM delivery_packages WHERE id = ? AND client_id = ?'
      ).bind(pkgId, clientId).first();
      if (!pkg) return addCors(errorResponse('Package not found', 404));

      if (pkg.status !== 'ready') return addCors(errorResponse('Package is not available (status: ' + pkg.status + ')', 400));

      // Check expiry
      if (pkg.expires_at && new Date(pkg.expires_at) < new Date()) {
        return addCors(errorResponse('Package has expired', 410));
      }

      const obj = await bucket.get(pkg.r2_key);
      if (!obj) return addCors(errorResponse('Package not found in storage', 404));

      // Increment download count
      try {
        await db.prepare(
          `UPDATE delivery_packages SET download_count = download_count + 1,
           last_downloaded_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
        ).bind(pkgId).run();
      } catch (_) {}

      const headers = new Headers(corsHeaders);
      headers.set('Content-Type', 'application/zip');
      if (pkg.file_size) headers.set('Content-Length', String(pkg.file_size));
      headers.set('Content-Disposition', 'attachment; filename="' + (pkg.filename || 'package.zip').replace(/"/g, '_') + '"');

      return new Response(obj.body, { status: 200, headers });
    }

    return addCors(errorResponse('Not found', 404));
  } catch (error) {
    console.error('[PortalMedia] Error:', error);
    return addCors(errorResponse('Internal server error', 500));
  }
}
