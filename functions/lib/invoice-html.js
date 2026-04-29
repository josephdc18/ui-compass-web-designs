/**
 * Invoice HTML Generator
 * Renders a full HTML invoice document for display/printing.
 * All monetary values are in cents — divided by 100 for display.
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatCurrency(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return escapeHtml(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function generateInvoiceHTML(invoice, env) {
  var businessName = (env && env.BUSINESS_NAME) ? escapeHtml(env.BUSINESS_NAME) : 'Invoice';
  var items = invoice.items || [];
  var client = invoice.client || {};

  var itemRows = items.map(function(item) {
    return '<tr>' +
      '<td style="padding:0.5rem;border-bottom:1px solid #e5e7eb;">' + escapeHtml(item.description) + '</td>' +
      '<td style="padding:0.5rem;border-bottom:1px solid #e5e7eb;text-align:center;">' + (item.quantity || 1) + '</td>' +
      '<td style="padding:0.5rem;border-bottom:1px solid #e5e7eb;text-align:right;">' + formatCurrency(item.unit_price) + '</td>' +
      '<td style="padding:0.5rem;border-bottom:1px solid #e5e7eb;text-align:right;">' + formatCurrency(item.line_total) + '</td>' +
    '</tr>';
  }).join('');

  var statusBadge = '';
  if (invoice.status) {
    var colors = { draft:'#6b7280', sent:'#3b82f6', viewed:'#8b5cf6', paid:'#22c55e', overdue:'#ef4444', cancelled:'#9ca3af' };
    var bg = colors[invoice.status] || '#6b7280';
    statusBadge = '<span style="display:inline-block;padding:0.25rem 0.75rem;border-radius:999px;font-size:0.75rem;font-weight:600;color:#fff;background:' + bg + ';text-transform:uppercase;">' + escapeHtml(invoice.status) + '</span>';
  }

  var payLink = '';
  if (invoice.pay_url && (invoice.status === 'sent' || invoice.status === 'viewed')) {
    payLink = '<div style="text-align:center;margin:2rem 0;">' +
      '<a href="' + escapeHtml(invoice.pay_url) + '" style="display:inline-block;padding:0.75rem 2rem;background:#3b82f6;color:#fff;text-decoration:none;border-radius:0.5rem;font-weight:600;font-size:1rem;">Pay Now</a>' +
    '</div>';
  }

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice - ' + escapeHtml(invoice.title || '') + '</title>' +
    '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;color:#1a1a1a;background:#fff;}' +
    '.inv-container{max-width:800px;margin:0 auto;}' +
    'table{width:100%;border-collapse:collapse;}' +
    'th{text-align:left;padding:0.5rem;border-bottom:2px solid #1a1a1a;font-weight:600;}' +
    '@media print{body{padding:0;}.inv-no-print{display:none!important;}}</style></head><body>' +
    '<div class="inv-container">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2rem;">' +
        '<div><h1 style="margin:0 0 0.25rem;font-size:1.75rem;">' + businessName + '</h1><p style="margin:0;color:#6b7280;font-size:0.875rem;">Invoice</p></div>' +
        '<div style="text-align:right;">' + statusBadge + '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:2rem;gap:2rem;">' +
        '<div>' +
          '<h3 style="margin:0 0 0.5rem;font-size:0.875rem;color:#6b7280;text-transform:uppercase;">Bill To</h3>' +
          (client.name ? '<div style="font-weight:600;">' + escapeHtml(client.name) + '</div>' : '') +
          (client.email ? '<div style="color:#6b7280;">' + escapeHtml(client.email) + '</div>' : '') +
          (client.phone ? '<div style="color:#6b7280;">' + escapeHtml(client.phone) + '</div>' : '') +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div><strong>Invoice:</strong> ' + escapeHtml(invoice.title || '') + '</div>' +
          '<div><strong>Date:</strong> ' + formatDate(invoice.created_at) + '</div>' +
          (invoice.due_date ? '<div><strong>Due:</strong> ' + formatDate(invoice.due_date) + '</div>' : '') +
          (invoice.paid_at ? '<div style="color:#22c55e;"><strong>Paid:</strong> ' + formatDate(invoice.paid_at) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<table>' +
        '<thead><tr>' +
          '<th>Description</th>' +
          '<th style="text-align:center;">Qty</th>' +
          '<th style="text-align:right;">Unit Price</th>' +
          '<th style="text-align:right;">Total</th>' +
        '</tr></thead>' +
        '<tbody>' + itemRows + '</tbody>' +
      '</table>' +
      '<div style="margin-top:1rem;text-align:right;">' +
        '<div style="margin-bottom:0.25rem;"><strong>Subtotal:</strong> ' + formatCurrency(invoice.subtotal || 0) + '</div>' +
        (invoice.tax > 0 ? '<div style="margin-bottom:0.25rem;"><strong>Tax (' + ((invoice.tax_rate || 0) * 100).toFixed(2) + '%):</strong> ' + formatCurrency(invoice.tax) + '</div>' : '') +
        '<div style="font-size:1.25rem;font-weight:700;margin-top:0.5rem;padding-top:0.5rem;border-top:2px solid #1a1a1a;"><strong>Total:</strong> ' + formatCurrency(invoice.total || 0) + '</div>' +
      '</div>' +
      (invoice.notes ? '<div style="margin-top:2rem;padding:1rem;background:#f9fafb;border-radius:0.5rem;"><strong>Notes:</strong><p style="margin:0.5rem 0 0;white-space:pre-wrap;">' + escapeHtml(invoice.notes) + '</p></div>' : '') +
      payLink +
    '</div></body></html>';
}
