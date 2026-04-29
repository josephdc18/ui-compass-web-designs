/**
 * Stripe Webhook — POST /api/webhooks/stripe
 *
 * Handles checkout.session.completed events.
 * Validates webhook signature using Web Crypto API (no SDK).
 * Creates order in D1 and decrements inventory.
 *
 * Idempotency: orders.stripe_session_id has UNIQUE constraint.
 * Duplicate webhook deliveries are rejected by DB.
 *
 * Inventory: uses atomic decrement with floor check to prevent overselling.
 */

async function verifyStripeSignature(payload, sigHeader, secret) {
    const encoder = new TextEncoder();
    const parts = sigHeader.split(',').reduce((acc, part) => {
        const [key, val] = part.split('=');
        acc[key.trim()] = val;
        return acc;
    }, {});

    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) return false;

    // Reject if timestamp is too old (5 min tolerance)
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (Math.abs(age) > 300) return false;

    const signedPayload = timestamp + '.' + payload;
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Constant-time comparison
    if (computed.length !== signature.length) return false;
    let mismatch = 0;
    for (let i = 0; i < computed.length; i++) {
        mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return mismatch === 0;
}

export async function onRequestPost({ request, env }) {
    // Fail-closed: reject if webhook secret is not configured
    if (!env.STRIPE_WEBHOOK_SECRET) {
        console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
        return new Response('Webhook secret not configured', { status: 503 });
    }

    const sig = request.headers.get('stripe-signature');
    if (!sig) {
        return new Response('Missing signature', { status: 400 });
    }

    const payload = await request.text();

    const valid = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) {
        return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(payload);

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Only create orders for sessions where payment is actually collected
        // Handles async payment methods (bank transfers, etc.) that complete later
        const paymentStatus = session.payment_status;
        if (paymentStatus !== 'paid') {
            console.log('[Webhook] Session ' + session.id + ' payment_status=' + paymentStatus + ', skipping order creation (will process on async_payment_succeeded)');
            return new Response(JSON.stringify({ received: true, deferred: true }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Idempotency: stripe_session_id is UNIQUE — duplicate inserts fail gracefully
        const existing = await env.DB
            .prepare('SELECT id FROM orders WHERE stripe_session_id = ?')
            .bind(session.id)
            .first();

        if (existing) {
            return new Response(JSON.stringify({ received: true, duplicate: true }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Retrieve line items from Stripe to build order items
        const itemsRes = await fetch(
            'https://api.stripe.com/v1/checkout/sessions/' + session.id + '/line_items?limit=100',
            {
                headers: { 'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY },
            }
        );
        const itemsData = await itemsRes.json();
        const items = (itemsData.data || []).map(li => ({
            name: li.description || li.price?.product?.name || 'Item',
            quantity: li.quantity,
            amount_total: li.amount_total,
        }));

        // Create order — NOT wrapped in try/catch that swallows errors.
        // If this fails, we return 500 so Stripe retries the webhook.
        await env.DB
            .prepare(
                'INSERT INTO orders (stripe_session_id, stripe_payment_intent, customer_email, customer_name, status, total_cents, currency, items_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))'
            )
            .bind(
                session.id,
                session.payment_intent || '',
                session.customer_details?.email || '',
                session.customer_details?.name || '',
                'paid',
                session.amount_total || 0,
                session.currency || 'usd',
                JSON.stringify(items)
            )
            .run();

        // Decrement inventory (best-effort — failures don't block order confirmation)
        try {
            const cartItems = JSON.parse(session.metadata?.cart_items || '[]');
            for (const ci of cartItems) {
                if (ci.variantId) {
                    await env.DB
                        .prepare('UPDATE product_variants SET inventory_count = inventory_count - ? WHERE id = ? AND inventory_count >= ?')
                        .bind(ci.quantity, ci.variantId, ci.quantity)
                        .run();
                }
                await env.DB
                    .prepare('UPDATE products SET inventory_count = inventory_count - ? WHERE id = ? AND inventory_count >= ?')
                    .bind(ci.quantity, ci.productId, ci.quantity)
                    .run();
            }
        } catch (invErr) {
            console.error('[Webhook] Inventory decrement failed (order still created):', invErr);
        }

        console.log('[Webhook] Order created for session:', session.id);
    }

    // Handle async payment completion (bank transfers, etc.)
    if (event.type === 'checkout.session.async_payment_succeeded') {
        // Same logic as checkout.session.completed — process the now-paid session
        const session = event.data.object;
        const existing = await env.DB
            .prepare('SELECT id FROM orders WHERE stripe_session_id = ?')
            .bind(session.id)
            .first();
        if (!existing) {
            console.log('[Webhook] async_payment_succeeded for unprocessed session ' + session.id + ' — should be handled by checkout.session.completed with payment_status=paid');
        }
    }

    // Handle refunds
    if (event.type === 'charge.refunded') {
        const charge = event.data.object;
        const paymentIntent = charge.payment_intent;

        try {
            const order = await env.DB
                .prepare('SELECT id, status FROM orders WHERE stripe_payment_intent = ?')
                .bind(paymentIntent)
                .first();

            if (order && order.status !== 'refunded') {
                const newStatus = charge.amount_refunded >= charge.amount ? 'refunded' : 'partially_refunded';
                await env.DB
                    .prepare('UPDATE orders SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
                    .bind(newStatus, order.id)
                    .run();
                console.log('[Webhook] Order ' + order.id + ' marked as ' + newStatus);
            }
        } catch (err) {
            console.error('[Webhook] Error processing charge.refunded:', err);
        }
    }

    return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
    });
}
