/**
 * Product Detail API — GET /api/products/:id
 *
 * Returns a single product by ID or slug, including variants.
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

export async function onRequestGet({ request, env, params }) {
    const identifier = params.id;

    try {
        // Try by slug first, then by ID
        let product = await env.DB
            .prepare('SELECT * FROM products WHERE slug = ? AND active = 1')
            .bind(identifier)
            .first();

        if (!product && /^\d+$/.test(identifier)) {
            product = await env.DB
                .prepare('SELECT * FROM products WHERE id = ? AND active = 1')
                .bind(parseInt(identifier, 10))
                .first();
        }

        if (!product) {
            return new Response(JSON.stringify({ error: 'Product not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request, env) },
            });
        }

        const { results: variants } = await env.DB
            .prepare('SELECT id, name, price_cents, sku, inventory_count FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC')
            .bind(product.id)
            .all();

        const result = {
            ...product,
            price: (product.price_cents / 100).toFixed(2),
            compareAtPrice: product.compare_at_price_cents
                ? (product.compare_at_price_cents / 100).toFixed(2)
                : null,
            inStock: product.inventory_count > 0,
            variants: (variants || []).map(v => ({
                ...v,
                price: (v.price_cents / 100).toFixed(2),
                inStock: v.inventory_count > 0,
            })),
        };

        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60',
                ...getCorsHeaders(request, env),
            },
        });
    } catch (err) {
        console.error('[Product Detail API] Error:', err);
        return new Response(JSON.stringify({ error: 'Failed to fetch product' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request, env) },
        });
    }
}
