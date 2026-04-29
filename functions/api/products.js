/**
 * Products API — GET /api/products
 *
 * Returns active products from D1. Supports optional category filter.
 * Used by shop page at runtime for dynamic product display.
 *
 * Query params:
 *   ?category=widgets   — filter by category
 *   ?limit=20           — max results (default 50)
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
    const category = url.searchParams.get('category') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit'), 10) || 50, 100);

    try {
        let query, params;
        if (category) {
            query = `
                SELECT id, name, slug, description, price_cents, compare_at_price_cents,
                       category, image_url, inventory_count
                FROM products
                WHERE active = 1 AND category = ?
                ORDER BY sort_order ASC, name ASC
                LIMIT ?
            `;
            params = [category, limit];
        } else {
            query = `
                SELECT id, name, slug, description, price_cents, compare_at_price_cents,
                       category, image_url, inventory_count
                FROM products
                WHERE active = 1
                ORDER BY sort_order ASC, name ASC
                LIMIT ?
            `;
            params = [limit];
        }

        const { results } = await env.DB.prepare(query).bind(...params).all();

        // Include variants for each product
        const products = [];
        for (const product of results || []) {
            const { results: variants } = await env.DB
                .prepare('SELECT id, name, price_cents, sku, inventory_count FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC')
                .bind(product.id)
                .all();

            products.push({
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
            });
        }

        return new Response(JSON.stringify(products), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60',
                ...getCorsHeaders(request, env),
            },
        });
    } catch (err) {
        console.error('[Products API] Error:', err);
        return new Response(JSON.stringify({ error: 'Failed to fetch products' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request, env) },
        });
    }
}
