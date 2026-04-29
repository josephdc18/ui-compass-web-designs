/**
 * Admin Orders API — /api/admin/orders
 *
 * Read-only order management.
 * Protected by CRM_ADMIN_TOKEN (Bearer auth).
 *
 * GET /api/admin/orders              — List orders (newest first)
 * GET /api/admin/orders?id=123       — Get single order
 * GET /api/admin/orders?status=paid  — Filter by status
 */

import { requireAdminAuth } from '../../lib/shop-admin-auth.js';

function getCorsHeaders(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = [env.SITE_URL, 'http://localhost:8080', 'http://localhost:3000', 'http://localhost:8788', 'http://127.0.0.1:8788'].filter(Boolean);
    return {
        'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || '*'),
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

function json(data, status, request, env) {
    return new Response(JSON.stringify(data), {
        status, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request, env) },
    });
}

export async function onRequestOptions({ request, env }) {
    return new Response(null, { status: 204, headers: getCorsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
    const auth = requireAdminAuth(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status, request, env);

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const status = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit'), 10) || 50, 200);

    try {
        if (id) {
            const order = await env.DB
                .prepare('SELECT * FROM orders WHERE id = ?')
                .bind(parseInt(id, 10))
                .first();

            if (!order) return json({ error: 'Order not found' }, 404, request, env);

            order.items = JSON.parse(order.items_json || '[]');
            return json(order, 200, request, env);
        }

        let query, params;
        if (status) {
            query = 'SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ?';
            params = [status, limit];
        } else {
            query = 'SELECT * FROM orders ORDER BY created_at DESC LIMIT ?';
            params = [limit];
        }

        const { results } = await env.DB.prepare(query).bind(...params).all();
        const orders = (results || []).map(o => ({
            ...o,
            items: JSON.parse(o.items_json || '[]'),
            total: (o.total_cents / 100).toFixed(2),
        }));

        return json(orders, 200, request, env);
    } catch (err) {
        console.error('[Admin Orders] Error:', err);
        return json({ error: 'Failed to fetch orders' }, 500, request, env);
    }
}
