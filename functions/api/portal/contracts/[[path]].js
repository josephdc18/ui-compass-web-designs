/**
 * Portal Contracts API — client-facing contract list
 * GET /api/portal/contracts — List contracts for authenticated client
 */

import { verifyPortalToken } from '../../../lib/portal-auth.js';
import { preflight } from '../../../lib/preflight.js';
import { withExecutionStatus } from '../../../lib/contract-lifecycle.js';
import { ensureMigrations } from '../../../lib/migrate.js';

const ESIGN_PORTAL_MIGRATIONS = { pack: 'esign', migrations: [] };
let esignPortalMigrated = false;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function errorResponse(message, status = 400) { return jsonResponse({ error: message }, status); }

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

  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const auth = await verifyPortalToken(token, env);
  if (!auth.valid) return addCors(errorResponse('Unauthorized', 401));

  const db = env.DB;
  try {
    if (!esignPortalMigrated) {
      try { await ensureMigrations(db, ESIGN_PORTAL_MIGRATIONS); esignPortalMigrated = true; }
      catch (e) { console.error('[PortalContracts] Migration failed:', e); return addCors(errorResponse('Database migration failed. Contact administrator.', 503)); }
    }
    const rows = await db.prepare(
      `SELECT id, contract_type, status, signed_at, sent_at, created_at, countersign_required, provider_signed_at, template_version
       FROM contract_instances WHERE client_id = ? ORDER BY created_at DESC`
    ).bind(auth.clientId).all();
    const contracts = (rows.results || []).map(withExecutionStatus);
    return addCors(jsonResponse({ contracts }));
  } catch (error) {
    console.error('[PortalContracts] Error:', error);
    return addCors(errorResponse('Internal server error', 500));
  }
}
