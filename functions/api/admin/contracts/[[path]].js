/**
 * Admin Contracts API — catch-all route handler
 * GET    /api/admin/contracts              — List all contracts
 * POST   /api/admin/contracts              — Create contract
 * GET    /api/admin/contracts/:id          — Get contract detail
 * POST   /api/admin/contracts/:id/send     — Send contract for signing
 * POST   /api/admin/contracts/:id/void     — Void a contract
 * POST   /api/admin/contracts/:id/countersign — Admin countersign
 * GET    /api/admin/contracts/:id/events   — Get audit trail
 * GET    /api/admin/contracts/:id/verify   — Verify hash chain
 */

import { requirePortalAdminAuth } from '../../../lib/portal-admin-auth.js';
import { generateContractHTML, sanitizeContractHTML } from '../../../lib/contract-template.js';
import { hashContractHTML, generateMagicLinkToken } from '../../../lib/esign-crypto.js';
import { recordEvent, getEventChain, verifyChain } from '../../../lib/esign-events.js';
import { createNotification } from '../../../lib/notifications.js';
import { sendEmail } from '../../../lib/email.js';
import { withExecutionStatus } from '../../../lib/contract-lifecycle.js';
import { sanitizeString } from '../../../lib/security.js';
import { preflight } from '../../../lib/preflight.js';
import { ensureMigrations } from '../../../lib/migrate.js';

const ESIGN_ADMIN_MIGRATIONS = { pack: 'esign', migrations: [] };
let esignAdminMigrated = false;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function errorResponse(message, status = 400) { return jsonResponse({ error: message }, status); }
function escapeHtml(v) { if (v == null) return ''; return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

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
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || null;

  try {
    if (!esignAdminMigrated) {
      try { await ensureMigrations(db, ESIGN_ADMIN_MIGRATIONS); esignAdminMigrated = true; }
      catch (e) { console.error('[AdminContracts] Migration failed:', e); return addCors(errorResponse('Database migration failed. Contact administrator.', 503)); }
    }
    if ((method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
        !(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
      return addCors(errorResponse('Content-Type must be application/json', 415));
    }

    // GET /api/admin/contracts — list
    if (method === 'GET' && pathParts.length === 0) {
      const rows = await db.prepare(
        `SELECT ci.*, c.name as client_name, c.email as client_email
         FROM contract_instances ci JOIN clients c ON c.id = ci.client_id
         ORDER BY ci.created_at DESC`
      ).all();
      return addCors(jsonResponse({ contracts: (rows.results || []).map(withExecutionStatus) }));
    }

    // POST /api/admin/contracts — create
    if (method === 'POST' && pathParts.length === 0) {
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { client_id, title, sections, effectiveDate, countersign_required, contract_html: rawHtml } = body || {};
      if (!client_id) return addCors(errorResponse('client_id is required', 400));

      const client = await db.prepare('SELECT id, name, email FROM clients WHERE id = ?').bind(client_id).first();
      if (!client) return addCors(errorResponse('Client not found', 404));

      const businessName = env.BUSINESS_NAME || 'Service Provider';
      const businessEmail = env.BUSINESS_EMAIL || '';
      const businessAddress = env.BUSINESS_ADDRESS || '';

      const unsafeHtml = rawHtml || generateContractHTML({
        businessName, businessEmail, businessAddress,
        clientName: client.name, clientEmail: client.email,
        title: title || 'Service Agreement', sections: sections || [],
        effectiveDate: effectiveDate || new Date().toISOString(),
      });
      const html = sanitizeContractHTML(unsafeHtml);

      const contractHash = await hashContractHTML(html);
      const result = await db.prepare(
        `INSERT INTO contract_instances (client_id, contract_html, contract_hash, countersign_required, signer_email)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(client_id, html, contractHash, countersign_required !== undefined ? (countersign_required ? 1 : 0) : 1, client.email).run();

      const contractId = await db.prepare('SELECT id FROM contract_instances WHERE contract_hash = ? AND client_id = ? ORDER BY created_at DESC LIMIT 1').bind(contractHash, client_id).first();
      await recordEvent(db, { contractId: contractId?.id, eventType: 'contract_created', data: { contract_hash: contractHash }, actor: 'admin', ip: clientIP, userAgent });
      return addCors(jsonResponse({ id: contractId?.id, contract_hash: contractHash }, 201));
    }

    // Routes with :id
    if (pathParts.length >= 1) {
      const contractId = pathParts[0];
      const contract = await db.prepare('SELECT * FROM contract_instances WHERE id = ?').bind(contractId).first();
      if (!contract) return addCors(errorResponse('Contract not found', 404));

      // Immutability guard for signed contracts
      if (contract.status === 'signed' && method === 'POST' && !['countersign', 'void', 'events', 'verify'].includes(pathParts[1])) {
        await recordEvent(db, { contractId, eventType: 'contract_mutation_attempted', data: { action: pathParts[1] || 'update' }, actor: 'admin', ip: clientIP, userAgent });
        return addCors(errorResponse('Signed contracts cannot be modified', 403));
      }

      // GET detail
      if (method === 'GET' && pathParts.length === 1) {
        const client = await db.prepare('SELECT name, email FROM clients WHERE id = ?').bind(contract.client_id).first();
        return addCors(jsonResponse({ contract: withExecutionStatus({ ...contract, client_name: client?.name, client_email: client?.email }) }));
      }

      // POST send
      if (method === 'POST' && pathParts[1] === 'send') {
        if (contract.status !== 'draft') return addCors(errorResponse('Only draft contracts can be sent', 400));
        const client = await db.prepare('SELECT id, name, email FROM clients WHERE id = ?').bind(contract.client_id).first();
        if (!client?.email) return addCors(errorResponse('Client has no email', 400));

        const { token, hash } = await generateMagicLinkToken();
        await db.prepare(
          `INSERT INTO signing_sessions (contract_id, client_id, token_hash, expires_at)
           VALUES (?, ?, ?, datetime('now', '+72 hours'))`
        ).bind(contractId, client.id, hash).run();

        await db.prepare(
          `UPDATE contract_instances SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
        ).bind(contractId).run();

        const siteUrl = (env.SITE_URL || 'https://example.com').replace(/\/+$/, '');
        const signUrl = `${siteUrl}/sign/?token=${token}`;
        const businessName = env.BUSINESS_NAME || 'your service provider';

        await sendEmail(env, {
          to: client.email,
          subject: `${businessName} — Contract Ready for Signing`,
          html: `<p>Hi ${escapeHtml(client.name || 'there')},</p><p>Your service agreement is ready for review and signing.</p><p><a href="${escapeHtml(signUrl)}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;font-weight:600;">Review & Sign</a></p><p style="font-size:12px;color:#999;">This link expires in 72 hours.</p>`,
          text: `Hi ${client.name || 'there'},\n\nYour agreement is ready: ${signUrl}\n\nThis link expires in 72 hours.`,
        });

        await recordEvent(db, { contractId, eventType: 'contract_sent', data: { email: client.email }, actor: 'admin', ip: clientIP, userAgent });
        return addCors(jsonResponse({ success: true, message: 'Contract sent' }));
      }

      // POST void
      if (method === 'POST' && pathParts[1] === 'void') {
        if (['voided', 'expired'].includes(contract.status)) return addCors(errorResponse('Contract already voided/expired', 400));
        let body; try { body = await request.json(); } catch { body = {}; }
        const reason = sanitizeString(body?.reason || 'Voided by admin', 500);
        await db.prepare(
          `UPDATE contract_instances SET status = 'voided', voided_at = datetime('now'), voided_reason = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(reason, contractId).run();
        await recordEvent(db, { contractId, eventType: 'contract_voided', data: { reason }, actor: 'admin', ip: clientIP, userAgent });
        return addCors(jsonResponse({ success: true }));
      }

      // POST countersign
      if (method === 'POST' && pathParts[1] === 'countersign') {
        if (contract.status !== 'signed') return addCors(errorResponse('Contract must be signed first', 400));
        if (!contract.countersign_required) return addCors(errorResponse('Countersign not required', 400));
        if (contract.provider_signed_at) return addCors(errorResponse('Already countersigned', 400));
        let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
        const { signer_name, signer_email } = body || {};
        if (!signer_name) return addCors(errorResponse('signer_name required', 400));

        await db.prepare(
          `UPDATE contract_instances SET provider_signed_at = datetime('now'), provider_signer_name = ?, provider_signer_email = ?,
             provider_signer_ip = ?, provider_signer_user_agent = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(signer_name, signer_email || null, clientIP, userAgent, contractId).run();
        await recordEvent(db, { contractId, eventType: 'provider_countersigned', data: { signer_name, signer_email }, actor: 'admin', ip: clientIP, userAgent });
        return addCors(jsonResponse({ success: true }));
      }

      // GET events — audit trail
      if (method === 'GET' && pathParts[1] === 'events') {
        const events = await getEventChain(db, contractId);
        return addCors(jsonResponse({ events }));
      }

      // GET verify — hash chain verification
      if (method === 'GET' && pathParts[1] === 'verify') {
        const result = await verifyChain(db, contractId);
        return addCors(jsonResponse(result));
      }
    }

    return addCors(errorResponse('Not found', 404));
  } catch (error) {
    console.error('[AdminContracts] Error:', error);
    return addCors(errorResponse('Internal server error', 500));
  }
}
