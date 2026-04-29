/**
 * Portal Invoices API — catch-all route handler
 * GET  /api/portal/invoices           — List client's invoices
 * GET  /api/portal/invoices/:id       — Invoice detail with rendered HTML
 * POST /api/portal/invoices/:id/pay-link — Generate Stripe checkout URL
 */

import { verifyPortalToken } from '../../../lib/portal-auth.js';
import { preflight } from '../../../lib/preflight.js';
import { checkRateLimit } from '../../../lib/security.js';
import { ensureMigrations } from '../../../lib/migrate.js';
import { generateInvoiceHTML } from '../../../lib/invoice-html.js';
import { createInvoiceCheckoutSession, generateVerificationToken } from '../../../lib/invoice-checkout.js';

const INV_PORTAL_MIGRATIONS = { pack: 'invoicing', migrations: [] };
let invPortalMigrated = false;

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
  const pathParts = params.path || [];
  const path = pathParts.join('/');
  const method = request.method;

  try {
    if (!invPortalMigrated) {
      try { await ensureMigrations(db, INV_PORTAL_MIGRATIONS); invPortalMigrated = true; }
      catch (e) { console.error('[PortalInvoices] Migration failed:', e); return addCors(errorResponse('Database migration failed. Contact administrator.', 503)); }
    }

    if ((method === 'POST') &&
        !(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
      return addCors(errorResponse('Content-Type must be application/json', 415));
    }

    // GET /api/portal/invoices — list client's invoices (exclude drafts)
    if (method === 'GET' && path === '') {
      const rows = await db.prepare(
        `SELECT id, title, status, due_date, total, created_at, sent_at, paid_at
         FROM invoices
         WHERE client_id = ?
           AND (status IN ('sent','viewed','overdue','paid') OR (status = 'cancelled' AND sent_at IS NOT NULL))
         ORDER BY created_at DESC`
      ).bind(clientId).all();
      return addCors(jsonResponse({ invoices: rows.results || [] }));
    }

    // GET /api/portal/invoices/:id — detail with rendered HTML
    if (method === 'GET' && pathParts.length === 1 && pathParts[0] && !pathParts[0].includes('/')) {
      const id = pathParts[0];
      const invoice = await db.prepare(
        `SELECT i.*, c.name as client_name, c.email as client_email
         FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
         WHERE i.id = ? AND i.client_id = ?
           AND (i.status IN ('sent','viewed','overdue','paid') OR (i.status = 'cancelled' AND i.sent_at IS NOT NULL))`
      ).bind(id, clientId).first();
      if (!invoice) return addCors(errorResponse('Invoice not found', 404));

      const itemRows = await db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').bind(id).all();
      const items = itemRows.results || [];

      // Auto-transition sent → viewed
      if (invoice.status === 'sent') {
        await db.prepare(
          `UPDATE invoices SET status = 'viewed', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
        ).bind(id).run();
        invoice.status = 'viewed';
      }

      const invoiceData = {
        ...invoice,
        items: items,
        client: { name: invoice.client_name, email: invoice.client_email },
      };

      const html = generateInvoiceHTML(invoiceData, env);
      return addCors(jsonResponse({ invoice: { ...invoice, items }, html }));
    }

    // POST /api/portal/invoices/:id/pay-link — generate Stripe checkout
    if (method === 'POST' && pathParts.length === 2 && pathParts[1] === 'pay-link') {
      const rl = await checkRateLimit(db, `inv:paylink:${clientId}`, 10, 1);
      if (!rl.allowed) return addCors(errorResponse('Too many requests', 429, { 'Retry-After': '60' }));

      const id = pathParts[0];
      const invoice = await db.prepare(
        `SELECT i.*, c.email as client_email
         FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
         WHERE i.id = ? AND i.client_id = ?`
      ).bind(id, clientId).first();
      if (!invoice) return addCors(errorResponse('Invoice not found', 404));
      if (invoice.status === 'paid') return addCors(errorResponse('Invoice already paid', 400));
      if (invoice.status === 'cancelled') return addCors(errorResponse('Invoice is cancelled', 400));
      if (invoice.status === 'draft') return addCors(errorResponse('Invoice not available', 400));

      if (!env.STRIPE_SECRET_KEY) return addCors(errorResponse('Payment not configured', 503));

      const { token: verificationToken, hash } = await generateVerificationToken();

      // Store checkout session and verification hash
      const session = await createInvoiceCheckoutSession(env, {
        invoiceId: invoice.id,
        invoiceTitle: invoice.title,
        customerEmail: invoice.client_email,
        amountCents: invoice.total,
        verificationToken: verificationToken,
        dueDate: invoice.due_date,
      });

      await db.prepare(
        `UPDATE invoices SET stripe_checkout_session_id = ?, verification_token_hash = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
      ).bind(session.sessionId, hash, id).run();

      return addCors(jsonResponse({ url: session.url }));
    }

    return addCors(errorResponse('Not found', 404));
  } catch (error) {
    console.error('[PortalInvoices] Error:', error);
    return addCors(errorResponse('Internal server error', 500));
  }
}
