/**
 * Stripe Invoice Webhook — handles checkout.session.completed
 * POST /api/webhooks/stripe-invoice
 */

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = {};
  sigHeader.split(',').forEach(function(part) {
    const [k, v] = part.split('=');
    parts[k] = v;
  });
  const timestamp = parts['t'];
  const v1Sig = parts['v1'];
  if (!timestamp || !v1Sig) return false;

  // Reject timestamps older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (isNaN(age) || age > 300 || age < -60) return false;

  const signedPayload = timestamp + '.' + payload;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-time comparison
  if (expected.length !== v1Sig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ v1Sig.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const db = env.DB;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[StripeInvoiceWebhook] STRIPE_WEBHOOK_SECRET not configured');
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const payload = await request.text();
  const sigHeader = request.headers.get('stripe-signature') || '';

  try {
    const valid = await verifyStripeSignature(payload, sigHeader, webhookSecret);
    if (!valid) {
      console.error('[StripeInvoiceWebhook] Invalid signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const event = JSON.parse(payload);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const sessionId = session.id;
      const paymentIntentId = session.payment_intent || null;

      // Find invoice by checkout session ID
      const invoice = await db.prepare(
        'SELECT * FROM invoices WHERE stripe_checkout_session_id = ?'
      ).bind(sessionId).first();

      if (!invoice) {
        console.warn('[StripeInvoiceWebhook] No invoice found for session:', sessionId);
        return new Response(JSON.stringify({ received: true, matched: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Cancelled invoices are terminal and must never transition to paid.
      if (invoice.status === 'cancelled') {
        console.warn('[StripeInvoiceWebhook] Ignoring paid event for cancelled invoice:', invoice.id);
        return new Response(JSON.stringify({ received: true, ignored_cancelled: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Idempotent replay: same payment intent already stored
      if (invoice.stripe_payment_intent_id) {
        if (!paymentIntentId || invoice.stripe_payment_intent_id === paymentIntentId) {
          return new Response(JSON.stringify({ received: true, already_processed: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        console.error('[StripeInvoiceWebhook] Payment intent mismatch for invoice', invoice.id, invoice.stripe_payment_intent_id, paymentIntentId);
        return new Response(JSON.stringify({ received: true, payment_intent_mismatch: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Idempotent: if already paid, just return 200
      if (invoice.status === 'paid') {
        return new Response(JSON.stringify({ received: true, already_paid: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Mark as paid
      await db.prepare(
        `UPDATE invoices SET status = 'paid', paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         payment_method = 'stripe', stripe_payment_intent_id = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
      ).bind(paymentIntentId, invoice.id).run();

      console.log('[StripeInvoiceWebhook] Invoice marked paid:', invoice.id);
      return new Response(JSON.stringify({ received: true, invoice_id: invoice.id, status: 'paid' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Unhandled event type — acknowledge receipt
    return new Response(JSON.stringify({ received: true, type: event.type }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[StripeInvoiceWebhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
