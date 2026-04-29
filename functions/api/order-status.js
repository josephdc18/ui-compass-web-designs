/**
 * Order Status API — GET /api/order-status?session_id=cs_xxx
 *
 * Server-side verification of checkout session status.
 * Called by order confirmation page to verify payment before showing success.
 * Checks D1 for the order (created by webhook) — does NOT trust client-side params alone.
 */

function getCorsHeaders(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = [env.SITE_URL, 'http://localhost:8080', 'http://localhost:3000', 'http://localhost:8788', 'http://127.0.0.1:8788'].filter(Boolean);
    return {
        'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || '*'),
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

export async function onRequestOptions({ request, env }) {
    return new Response(null, { status: 204, headers: getCorsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');
    const cors = getCorsHeaders(request, env);

    if (!sessionId || !/^cs_/.test(sessionId)) {
        return new Response(JSON.stringify({ status: 'invalid' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...cors },
        });
    }

    try {
        // Check if webhook has created the order
        const order = await env.DB
            .prepare('SELECT id, status, customer_email FROM orders WHERE stripe_session_id = ?')
            .bind(sessionId)
            .first();

        if (order && order.status === 'paid') {
            return new Response(JSON.stringify({
                status: 'paid',
                email: order.customer_email || '',
            }), {
                headers: { 'Content-Type': 'application/json', ...cors },
            });
        }

        // Order not yet created — webhook may still be processing
        return new Response(JSON.stringify({ status: 'pending' }), {
            headers: { 'Content-Type': 'application/json', ...cors },
        });
    } catch (err) {
        console.error('[Order Status] Error:', err);
        return new Response(JSON.stringify({ status: 'error' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...cors },
        });
    }
}
