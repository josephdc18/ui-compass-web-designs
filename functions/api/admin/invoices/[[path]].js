/**
 * Admin Invoices API — catch-all route handler
 * GET    /api/admin/invoices            — List invoices (with filters)
 * POST   /api/admin/invoices            — Create invoice with items
 * GET    /api/admin/invoices/:id        — Invoice detail with items
 * PUT    /api/admin/invoices/:id        — Update invoice (full item replace)
 * POST   /api/admin/invoices/:id/send   — Send invoice to client
 * POST   /api/admin/invoices/:id/mark-paid — Mark invoice as paid
 */

import { requirePortalAdminAuth } from '../../../lib/portal-admin-auth.js';
import { checkRateLimit } from '../../../lib/security.js';
import { preflight } from '../../../lib/preflight.js';
import { ensureMigrations } from '../../../lib/migrate.js';
import { getTaxRate } from '../../../lib/tax-rate.js';

const INV_ADMIN_MIGRATIONS = { pack: 'invoicing', migrations: [] };
let invAdminMigrated = false;

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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
  };
  if (isAllowed && origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Valid status transitions
const STATUS_TRANSITIONS = {
  draft: ['sent', 'cancelled'],
  sent: ['viewed', 'overdue', 'cancelled'],
  viewed: ['paid', 'cancelled'],
  paid: [],
  overdue: ['paid', 'cancelled'],
  cancelled: [],
};

function canTransition(from, to) {
  return (STATUS_TRANSITIONS[from] || []).includes(to);
}

async function generateInvoiceId() {
  var arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function calculateTotals(items, taxRate) {
  let subtotal = 0;
  const processed = items.map(item => {
    const qty = Math.max(1, parseInt(item.quantity) || 1);
    const unitPrice = parseInt(item.unit_price) || 0;
    const lineTotal = qty * unitPrice;
    subtotal += lineTotal;
    return { description: item.description, quantity: qty, unit_price: unitPrice, line_total: lineTotal };
  });
  const rate = parseFloat(taxRate) || 0;
  const tax = Math.round(subtotal * rate);
  const total = subtotal + tax;
  return { items: processed, subtotal, tax_rate: rate, tax, total };
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
  const path = pathParts.join('/');
  const method = request.method;
  const url = new URL(request.url);

  try {
    if (!invAdminMigrated) {
      try { await ensureMigrations(db, INV_ADMIN_MIGRATIONS); invAdminMigrated = true; }
      catch (e) { console.error('[AdminInvoices] Migration failed:', e); return addCors(errorResponse('Database migration failed. Contact administrator.', 503)); }
    }

    if ((method === 'POST' || method === 'PUT') &&
        !(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
      return addCors(errorResponse('Content-Type must be application/json', 415));
    }

    // GET /api/admin/invoices — list
    if (method === 'GET' && path === '') {
      const clientId = url.searchParams.get('client_id');
      const status = url.searchParams.get('status');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = `SELECT i.*, c.name as client_name, c.email as client_email,
                    (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) as item_count
                   FROM invoices i
                   LEFT JOIN clients c ON c.id = i.client_id
                   WHERE 1=1`;
      const binds = [];
      if (clientId) { query += ' AND i.client_id = ?'; binds.push(clientId); }
      if (status) { query += ' AND i.status = ?'; binds.push(status); }
      query += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
      binds.push(limit, offset);

      const rows = await db.prepare(query).bind(...binds).all();
      return addCors(jsonResponse({ invoices: rows.results || [] }));
    }

    // POST /api/admin/invoices — create
    if (method === 'POST' && path === '') {
      const rl = await checkRateLimit(db, 'inv:admin:create', 30, 1);
      if (!rl.allowed) return addCors(errorResponse('Too many requests', 429, { 'Retry-After': '60' }));

      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { client_id, title, due_date, tax_rate, notes, items } = body || {};
      if (!client_id) return addCors(errorResponse('client_id is required', 400));
      if (!title || !title.trim()) return addCors(errorResponse('title is required', 400));
      if (!items || !Array.isArray(items) || items.length === 0) return addCors(errorResponse('At least one item is required', 400));

      for (const item of items) {
        if (!item.description || !item.description.trim()) return addCors(errorResponse('Each item must have a description', 400));
        if (!item.unit_price && item.unit_price !== 0) return addCors(errorResponse('Each item must have a unit_price (in cents)', 400));
      }

      // Verify client exists
      const client = await db.prepare('SELECT id FROM clients WHERE id = ?').bind(client_id).first();
      if (!client) return addCors(errorResponse('Client not found', 404));

      const effectiveTaxRate = tax_rate !== undefined ? tax_rate : await getTaxRate(db, env);
      const calc = calculateTotals(items, effectiveTaxRate);
      const invoiceId = await generateInvoiceId();

      // Atomic create: invoice + items in one D1 batch
      const stmts = [
        db.prepare(
          `INSERT INTO invoices (id, client_id, title, due_date, tax_rate, notes, subtotal, tax, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(invoiceId, client_id, title.trim(), due_date || null, calc.tax_rate, notes || null, calc.subtotal, calc.tax, calc.total),
      ];
      for (const item of calc.items) {
        stmts.push(
          db.prepare(
            'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)'
          ).bind(invoiceId, item.description, item.quantity, item.unit_price, item.line_total)
        );
      }
      await db.batch(stmts);

      const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first();
      if (!invoice) return addCors(errorResponse('Failed to create invoice', 500));
      const createdItems = await db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').bind(invoiceId).all();
      return addCors(jsonResponse({ invoice: { ...invoice, items: createdItems.results || [] } }, 201));
    }

    // GET /api/admin/invoices/:id — detail
    if (method === 'GET' && pathParts.length === 1 && pathParts[0] && !pathParts[0].includes('/')) {
      const id = pathParts[0];
      const invoice = await db.prepare(
        `SELECT i.*, c.name as client_name, c.email as client_email
         FROM invoices i LEFT JOIN clients c ON c.id = i.client_id WHERE i.id = ?`
      ).bind(id).first();
      if (!invoice) return addCors(errorResponse('Invoice not found', 404));
      const itemRows = await db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').bind(id).all();
      return addCors(jsonResponse({ invoice: { ...invoice, items: itemRows.results || [] } }));
    }

    // PUT /api/admin/invoices/:id — update
    if (method === 'PUT' && pathParts.length === 1 && pathParts[0] && !pathParts[0].includes('/')) {
      const id = pathParts[0];
      const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
      if (!invoice) return addCors(errorResponse('Invoice not found', 404));
      if (invoice.status === 'paid' || invoice.status === 'cancelled') {
        return addCors(errorResponse('Cannot edit a ' + invoice.status + ' invoice', 400));
      }

      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { title, due_date, tax_rate, notes, items, status } = body || {};

      // Status change
      if (status && status !== invoice.status) {
        if (!canTransition(invoice.status, status)) {
          return addCors(errorResponse('Invalid status transition: ' + invoice.status + ' -> ' + status, 400));
        }
      }

      const hasItems = Array.isArray(items);
      const hasTaxRate = tax_rate !== undefined;
      let newTaxRate = hasTaxRate ? (parseFloat(tax_rate) || 0) : invoice.tax_rate;
      let newSubtotal = invoice.subtotal;
      let newTax = invoice.tax;
      let newTotal = invoice.total;
      let calcItems = null;

      // If items provided, recalculate from line items.
      // If only tax_rate changed, recalculate tax/total from existing subtotal.
      if (hasItems) {
        if (items.length === 0) return addCors(errorResponse('At least one item is required', 400));
        for (const item of items) {
          if (!item.description || !item.description.trim()) return addCors(errorResponse('Each item must have a description', 400));
          if (!item.unit_price && item.unit_price !== 0) return addCors(errorResponse('Each item must have a unit_price (in cents)', 400));
        }
        const calc = calculateTotals(items, newTaxRate);
        calcItems = calc.items;
        newTaxRate = calc.tax_rate;
        newSubtotal = calc.subtotal;
        newTax = calc.tax;
        newTotal = calc.total;
      } else if (hasTaxRate) {
        newTax = Math.round(newSubtotal * newTaxRate);
        newTotal = newSubtotal + newTax;
      }

      const newTitle = title !== undefined ? title.trim() : invoice.title;
      const newDueDate = due_date !== undefined ? due_date : invoice.due_date;
      const newNotes = notes !== undefined ? notes : invoice.notes;
      const newStatus = status || invoice.status;
      const updateStmt = db.prepare(
        `UPDATE invoices SET title = ?, due_date = ?, tax_rate = ?, notes = ?, status = ?,
         subtotal = ?, tax = ?, total = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`
      ).bind(newTitle, newDueDate, newTaxRate, newNotes, newStatus, newSubtotal, newTax, newTotal, id);

      // Atomic update when replacing line items
      if (calcItems) {
        const stmts = [updateStmt, db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').bind(id)];
        for (const item of calcItems) {
          stmts.push(
            db.prepare(
              'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)'
            ).bind(id, item.description, item.quantity, item.unit_price, item.line_total)
          );
        }
        await db.batch(stmts);
      } else {
        await updateStmt.run();
      }

      const updated = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
      const updatedItems = await db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').bind(id).all();
      return addCors(jsonResponse({ invoice: { ...updated, items: updatedItems.results || [] } }));
    }

    // POST /api/admin/invoices/:id/send
    if (method === 'POST' && pathParts.length === 2 && pathParts[1] === 'send') {
      const id = pathParts[0];
      const invoice = await db.prepare(
        `SELECT i.*, c.name as client_name, c.email as client_email
         FROM invoices i LEFT JOIN clients c ON c.id = i.client_id WHERE i.id = ?`
      ).bind(id).first();
      if (!invoice) return addCors(errorResponse('Invoice not found', 404));
      if (!canTransition(invoice.status, 'sent')) {
        return addCors(errorResponse('Invalid status transition: ' + invoice.status + ' -> sent', 400));
      }

      await db.prepare(
        `UPDATE invoices SET status = 'sent', sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
      ).bind(id).run();

      // Send email via Resend if configured
      let emailSent = false;
      if (env.RESEND_API_KEY && invoice.client_email) {
        try {
          const siteUrl = (env.SITE_URL || '').replace(/\/+$/, '');
          const businessName = env.BUSINESS_NAME || 'Invoice';
          const portalUrl = siteUrl + '/portal/';
          const emailBody = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:2rem;">' +
            '<h2 style="margin:0 0 1rem;">' + escapeHtml(businessName) + '</h2>' +
            '<p>Hi ' + escapeHtml(invoice.client_name || 'there') + ',</p>' +
            '<p>You have a new invoice: <strong>' + escapeHtml(invoice.title) + '</strong></p>' +
            '<p><strong>Total:</strong> $' + (invoice.total / 100).toFixed(2) + '</p>' +
            (invoice.due_date ? '<p><strong>Due:</strong> ' + escapeHtml(invoice.due_date) + '</p>' : '') +
            '<p><a href="' + escapeHtml(portalUrl) + '" style="display:inline-block;padding:0.75rem 1.5rem;background:#3b82f6;color:#fff;text-decoration:none;border-radius:0.5rem;font-weight:600;">View Invoice</a></p>' +
            '<p style="color:#6b7280;font-size:0.875rem;">Log into your portal to view details and pay online.</p>' +
          '</div>';

          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: env.RESEND_FROM || ('invoices@' + (env.SITE_URL ? new URL(env.SITE_URL).hostname : 'example.com')),
              to: [invoice.client_email],
              subject: 'New Invoice from ' + businessName + ': ' + invoice.title,
              html: emailBody,
            }),
          });
          if (resendRes.ok) {
            emailSent = true;
          } else {
            const resendErr = await resendRes.text().catch(function() { return ''; });
            console.error('[AdminInvoices] Email provider error:', resendRes.status, resendErr);
          }
        } catch (emailErr) {
          console.error('[AdminInvoices] Email send failed:', emailErr);
        }
      }

      const updated = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
      return addCors(jsonResponse({ invoice: updated, email_sent: emailSent }));
    }

    // POST /api/admin/invoices/:id/mark-paid
    if (method === 'POST' && pathParts.length === 2 && pathParts[1] === 'mark-paid') {
      const id = pathParts[0];
      const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
      if (!invoice) return addCors(errorResponse('Invoice not found', 404));
      if (!canTransition(invoice.status, 'paid')) {
        return addCors(errorResponse('Invalid status transition: ' + invoice.status + ' -> paid', 400));
      }

      let body; try { body = await request.json(); } catch { body = {}; }
      const paymentMethod = body.payment_method || 'manual';
      const validMethods = ['stripe','manual','cash','check','zelle'];
      if (!validMethods.includes(paymentMethod)) return addCors(errorResponse('Invalid payment_method', 400));

      await db.prepare(
        `UPDATE invoices SET status = 'paid', paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         payment_method = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
      ).bind(paymentMethod, id).run();

      const updated = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
      return addCors(jsonResponse({ invoice: updated }));
    }

    return addCors(errorResponse('Not found', 404));
  } catch (error) {
    console.error('[AdminInvoices] Error:', error);
    return addCors(errorResponse('Internal server error', 500));
  }
}
