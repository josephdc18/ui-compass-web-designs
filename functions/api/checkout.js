/**
 * Checkout API — POST /api/checkout
 *
 * Accepts cart items, validates against D1 products table,
 * creates a Stripe Checkout Session, returns the session URL.
 * No Stripe SDK — uses direct fetch to Stripe API.
 *
 * Body: { items: [{ productId, variantId, quantity }] }
 * Returns: { url: "https://checkout.stripe.com/..." }
 */

function getCorsHeaders(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = [env.SITE_URL, 'http://localhost:8080', 'http://localhost:3000', 'http://localhost:8788', 'http://127.0.0.1:8788'].filter(Boolean);
    return {
        'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || '*'),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

export async function onRequestOptions({ request, env }) {
    return new Response(null, { status: 204, headers: getCorsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
    const cors = getCorsHeaders(request, env);

    try {
        const { items } = await request.json();

        if (!Array.isArray(items) || items.length === 0) {
            return new Response(JSON.stringify({ error: 'Cart is empty' }), {
                status: 400, headers: { 'Content-Type': 'application/json', ...cors },
            });
        }

        // Validate and price each item from D1
        const lineItems = [];
        for (const cartItem of items) {
            const productId = parseInt(cartItem.productId, 10);
            if (!productId || productId <= 0) continue;

            const product = await env.DB
                .prepare('SELECT id, name, price_cents, inventory_count, image_url FROM products WHERE id = ? AND active = 1')
                .bind(productId)
                .first();

            if (!product) continue;

            let priceCents = product.price_cents;
            let itemName = product.name;

            // Check variant if specified
            if (cartItem.variantId) {
                const variant = await env.DB
                    .prepare('SELECT id, name, price_cents, inventory_count FROM product_variants WHERE id = ? AND product_id = ?')
                    .bind(parseInt(cartItem.variantId, 10), productId)
                    .first();
                if (variant) {
                    priceCents = variant.price_cents;
                    itemName = product.name + ' — ' + variant.name;
                }
            }

            const quantity = Math.max(1, Math.min(99, parseInt(cartItem.quantity, 10) || 1));

            lineItems.push({
                productId: product.id,
                variantId: cartItem.variantId ? parseInt(cartItem.variantId, 10) : null,
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: itemName,
                        ...(product.image_url ? { images: [product.image_url] } : {}),
                    },
                    unit_amount: priceCents,
                },
                quantity,
            });
        }

        if (lineItems.length === 0) {
            return new Response(JSON.stringify({ error: 'No valid items in cart' }), {
                status: 400, headers: { 'Content-Type': 'application/json', ...cors },
            });
        }

        // Create Stripe Checkout Session via direct API call
        const siteUrl = env.SITE_URL || new URL(request.url).origin;
        const body = new URLSearchParams();
        body.append('mode', 'payment');
        body.append('success_url', siteUrl + '/order-confirmation/?session_id={CHECKOUT_SESSION_ID}');
        body.append('cancel_url', siteUrl + '/cart/');

        // Build cart metadata for webhook inventory decrement
        const cartMeta = [];

        for (let i = 0; i < lineItems.length; i++) {
            const li = lineItems[i];
            body.append('line_items[' + i + '][price_data][currency]', li.price_data.currency);
            body.append('line_items[' + i + '][price_data][product_data][name]', li.price_data.product_data.name);
            if (li.price_data.product_data.images) {
                body.append('line_items[' + i + '][price_data][product_data][images][0]', li.price_data.product_data.images[0]);
            }
            body.append('line_items[' + i + '][price_data][unit_amount]', String(li.price_data.unit_amount));
            body.append('line_items[' + i + '][quantity]', String(li.quantity));
            cartMeta.push({ productId: li.productId, variantId: li.variantId || null, quantity: li.quantity });
        }

        // Attach cart snapshot as session metadata so webhook can decrement inventory
        body.append('metadata[cart_items]', JSON.stringify(cartMeta));

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });

        const session = await stripeRes.json();

        if (!stripeRes.ok) {
            console.error('[Checkout] Stripe error:', session);
            return new Response(JSON.stringify({ error: 'Payment service error' }), {
                status: 502, headers: { 'Content-Type': 'application/json', ...cors },
            });
        }

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { 'Content-Type': 'application/json', ...cors },
        });
    } catch (err) {
        console.error('[Checkout] Error:', err);
        return new Response(JSON.stringify({ error: 'Checkout failed' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...cors },
        });
    }
}
