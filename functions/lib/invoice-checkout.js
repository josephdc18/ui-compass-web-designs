/**
 * Invoice Checkout — Stripe Checkout Session creation
 * All amounts in cents.
 */

export function normalizeInvoiceDueDate(inputDate) {
  if (!inputDate) return null;
  var d = new Date(inputDate);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

export async function generateVerificationToken() {
  var arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  var token = Array.from(arr, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  var encoded = new TextEncoder().encode(token);
  var hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  var hashArr = Array.from(new Uint8Array(hashBuf));
  var hash = hashArr.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  return { token: token, hash: hash };
}

export async function createInvoiceCheckoutSession(env, options) {
  var { invoiceId, invoiceTitle, customerEmail, amountCents, verificationToken, dueDate } = options;
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');

  var businessName = env.BUSINESS_NAME || 'Invoice';
  var siteUrl = (env.SITE_URL || '').replace(/\/+$/, '');
  var successUrl = siteUrl + '/portal/?payment=success&invoice=' + encodeURIComponent(invoiceId);
  var cancelUrl = siteUrl + '/portal/?payment=cancelled&invoice=' + encodeURIComponent(invoiceId);

  var body = new URLSearchParams();
  body.append('mode', 'payment');
  body.append('payment_method_types[]', 'card');
  body.append('line_items[0][price_data][currency]', 'usd');
  body.append('line_items[0][price_data][unit_amount]', String(amountCents));
  body.append('line_items[0][price_data][product_data][name]', businessName + ' Invoice ' + invoiceId.slice(0, 8));
  if (invoiceTitle) body.append('line_items[0][price_data][product_data][description]', invoiceTitle);
  body.append('line_items[0][quantity]', '1');
  if (customerEmail) body.append('customer_email', customerEmail);
  body.append('success_url', successUrl);
  body.append('cancel_url', cancelUrl);
  body.append('metadata[invoice_id]', invoiceId);
  if (verificationToken) body.append('metadata[verification_token]', verificationToken);

  var res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(env.STRIPE_SECRET_KEY + ':'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    var errData = await res.json().catch(function() { return {}; });
    throw new Error('Stripe error: ' + (errData.error?.message || res.statusText));
  }

  var session = await res.json();
  return { sessionId: session.id, url: session.url };
}
