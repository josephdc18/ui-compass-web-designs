/**
 * Admin Products API — /api/admin/products
 *
 * CRUD operations for product management.
 * Protected by CRM_ADMIN_TOKEN (Bearer auth).
 *
 * GET    /api/admin/products           — List all products (including inactive)
 * POST   /api/admin/products           — Create product
 * PUT    /api/admin/products?id=123    — Update product (with optional variant sync)
 * DELETE /api/admin/products?id=123    — Soft-delete (set active=0)
 */

import { requireAdminAuth } from '../../lib/shop-admin-auth.js';

// --- Hard limits (reject abusive payloads early) ---
var MAX_VARIANTS = 50;
var MAX_NAME_LEN = 200;
var MAX_SLUG_LEN = 200;
var MAX_DESCRIPTION_LEN = 5000;
var MAX_SKU_LEN = 100;
var MAX_CATEGORY_LEN = 200;
var MAX_IMAGE_URL_LEN = 2000;
var MAX_BODY_BYTES = 102400; // 100KB

function validateProductFields(body, isCreate) {
    if (isCreate) {
        if (!body.name || typeof body.name !== 'string' || !body.name.trim()) return 'name is required';
        if (!body.slug || typeof body.slug !== 'string' || !body.slug.trim()) return 'slug is required';
        if (body.price_cents === undefined || body.price_cents === null) return 'price_cents is required';
    }
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.length > MAX_NAME_LEN)) {
        return 'name must be a string under ' + MAX_NAME_LEN + ' chars';
    }
    if (body.slug !== undefined && (typeof body.slug !== 'string' || body.slug.length > MAX_SLUG_LEN)) {
        return 'slug must be a string under ' + MAX_SLUG_LEN + ' chars';
    }
    if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > MAX_DESCRIPTION_LEN)) {
        return 'description max ' + MAX_DESCRIPTION_LEN + ' chars';
    }
    if (body.category !== undefined && (typeof body.category !== 'string' || body.category.length > MAX_CATEGORY_LEN)) {
        return 'category max ' + MAX_CATEGORY_LEN + ' chars';
    }
    if (body.image_url !== undefined && (typeof body.image_url !== 'string' || body.image_url.length > MAX_IMAGE_URL_LEN)) {
        return 'image_url max ' + MAX_IMAGE_URL_LEN + ' chars';
    }
    if (body.price_cents !== undefined) {
        var p = parseInt(body.price_cents, 10);
        if (isNaN(p) || p < 0) return 'price_cents must be a non-negative integer';
    }
    if (body.compare_at_price_cents !== undefined && body.compare_at_price_cents !== null) {
        var cp = parseInt(body.compare_at_price_cents, 10);
        if (isNaN(cp) || cp < 0) return 'compare_at_price_cents must be a non-negative integer';
    }
    if (body.inventory_count !== undefined) {
        var ic = parseInt(body.inventory_count, 10);
        if (isNaN(ic) || ic < 0) return 'inventory_count must be a non-negative integer';
    }
    if (Array.isArray(body.variants)) {
        if (body.variants.length > MAX_VARIANTS) return 'Max ' + MAX_VARIANTS + ' variants per product';
        for (var vi = 0; vi < body.variants.length; vi++) {
            var v = body.variants[vi];
            if (!v.name || typeof v.name !== 'string') return 'Each variant needs a name';
            if (v.name.length > MAX_NAME_LEN) return 'Variant name max ' + MAX_NAME_LEN + ' chars';
            var vp = parseInt(v.price_cents, 10);
            if (isNaN(vp) || vp < 0) return 'Variant price_cents must be non-negative';
            if (v.sku && (typeof v.sku !== 'string' || v.sku.length > MAX_SKU_LEN)) return 'Variant SKU max ' + MAX_SKU_LEN + ' chars';
        }
    }
    return null; // valid
}

function getCorsHeaders(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = [env.SITE_URL, 'http://localhost:8080', 'http://localhost:3000', 'http://localhost:8788', 'http://127.0.0.1:8788'].filter(Boolean);
    return {
        'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || '*'),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

    try {
        const { results } = await env.DB
            .prepare('SELECT * FROM products ORDER BY sort_order ASC, name ASC')
            .all();

        const products = [];
        for (const p of results || []) {
            const { results: variants } = await env.DB
                .prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC')
                .bind(p.id)
                .all();
            products.push({ ...p, active: Boolean(p.active), variants: variants || [] });
        }

        return json(products, 200, request, env);
    } catch (err) {
        console.error('[Admin Products] List error:', err);
        return json({ error: 'Failed to list products' }, 500, request, env);
    }
}

export async function onRequestPost({ request, env }) {
    const auth = requireAdminAuth(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status, request, env);

    // Payload size check
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
        return json({ error: 'Request body too large (max 100KB)' }, 413, request, env);
    }

    try {
        const body = await request.json();

        // Validate all fields
        const validationError = validateProductFields(body, true);
        if (validationError) return json({ error: validationError }, 400, request, env);

        const { name, slug, description, price_cents, compare_at_price_cents, category, image_url, inventory_count, sort_order } = body;

        const result = await env.DB
            .prepare(
                'INSERT INTO products (name, slug, description, price_cents, compare_at_price_cents, category, image_url, inventory_count, sort_order, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime(\'now\'), datetime(\'now\'))'
            )
            .bind(
                name.slice(0, MAX_NAME_LEN), slug.slice(0, MAX_SLUG_LEN),
                (description || '').slice(0, MAX_DESCRIPTION_LEN), parseInt(price_cents, 10),
                compare_at_price_cents ? parseInt(compare_at_price_cents, 10) : null,
                (category || '').slice(0, MAX_CATEGORY_LEN),
                (image_url || '').slice(0, MAX_IMAGE_URL_LEN),
                Math.max(0, parseInt(inventory_count, 10) || 0),
                parseInt(sort_order, 10) || 0
            )
            .run();

        // Create variants if provided
        if (Array.isArray(body.variants) && body.variants.length > 0) {
            const stmts = [];
            for (let i = 0; i < body.variants.length; i++) {
                const v = body.variants[i];
                if (!v.name || !v.price_cents) continue;
                stmts.push(
                    env.DB.prepare('INSERT INTO product_variants (product_id, name, price_cents, sku, inventory_count, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))')
                        .bind(result.meta.last_row_id, v.name.slice(0, MAX_NAME_LEN),
                              parseInt(v.price_cents, 10), (v.sku || '').slice(0, MAX_SKU_LEN),
                              Math.max(0, parseInt(v.inventory_count, 10) || 0), i)
                );
            }
            if (stmts.length > 0) await env.DB.batch(stmts);
        }

        return json({ id: result.meta.last_row_id, message: 'Product created' }, 201, request, env);
    } catch (err) {
        if (String(err).includes('UNIQUE constraint')) {
            return json({ error: 'Slug already exists' }, 409, request, env);
        }
        console.error('[Admin Products] Create error:', err);
        return json({ error: 'Failed to create product' }, 500, request, env);
    }
}

export async function onRequestPut({ request, env }) {
    const auth = requireAdminAuth(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status, request, env);

    // Payload size check
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
        return json({ error: 'Request body too large (max 100KB)' }, 413, request, env);
    }

    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id'), 10);
    if (!id) return json({ error: 'id query param required' }, 400, request, env);

    try {
        const body = await request.json();

        // Validate fields (not a create — fields are optional)
        const validationError = validateProductFields(body, false);
        if (validationError) return json({ error: validationError }, 400, request, env);

        const fields = [];
        const values = [];
        const stringLimits = { name: MAX_NAME_LEN, slug: MAX_SLUG_LEN, description: MAX_DESCRIPTION_LEN, category: MAX_CATEGORY_LEN, image_url: MAX_IMAGE_URL_LEN };

        for (const [key, val] of Object.entries(body)) {
            if (key === 'variants') continue; // handled separately
            if (['name', 'slug', 'description', 'category', 'image_url'].includes(key)) {
                fields.push(key + ' = ?');
                values.push(typeof val === 'string' ? val.slice(0, stringLimits[key] || 200) : val);
            } else if (['price_cents', 'compare_at_price_cents', 'inventory_count', 'sort_order', 'active'].includes(key)) {
                fields.push(key + ' = ?');
                values.push(val === null ? null : parseInt(val, 10));
            }
        }

        if (fields.length === 0 && !Array.isArray(body.variants)) {
            return json({ error: 'No valid fields to update' }, 400, request, env);
        }

        // Update product fields
        if (fields.length > 0) {
            fields.push("updated_at = datetime('now')");
            values.push(id);
            await env.DB
                .prepare('UPDATE products SET ' + fields.join(', ') + ' WHERE id = ?')
                .bind(...values)
                .run();
        }

        // Atomic variant sync via D1 batch — if any INSERT fails, DELETE is rolled back
        if (Array.isArray(body.variants)) {
            const stmts = [
                env.DB.prepare('DELETE FROM product_variants WHERE product_id = ?').bind(id),
            ];
            for (let i = 0; i < body.variants.length; i++) {
                const v = body.variants[i];
                if (!v.name || !v.price_cents) continue;
                stmts.push(
                    env.DB.prepare('INSERT INTO product_variants (product_id, name, price_cents, sku, inventory_count, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))')
                        .bind(id, v.name.slice(0, MAX_NAME_LEN),
                              parseInt(v.price_cents, 10), (v.sku || '').slice(0, MAX_SKU_LEN),
                              Math.max(0, parseInt(v.inventory_count, 10) || 0), i)
                );
            }
            await env.DB.batch(stmts);
        }

        return json({ message: 'Product updated' }, 200, request, env);
    } catch (err) {
        if (String(err).includes('UNIQUE constraint')) {
            return json({ error: 'Slug already exists' }, 409, request, env);
        }
        console.error('[Admin Products] Update error:', err);
        return json({ error: 'Failed to update product' }, 500, request, env);
    }
}

export async function onRequestDelete({ request, env }) {
    const auth = requireAdminAuth(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status, request, env);

    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id'), 10);
    if (!id) return json({ error: 'id query param required' }, 400, request, env);

    try {
        // Soft delete — set active = 0
        await env.DB
            .prepare("UPDATE products SET active = 0, updated_at = datetime('now') WHERE id = ?")
            .bind(id)
            .run();

        return json({ message: 'Product deactivated' }, 200, request, env);
    } catch (err) {
        console.error('[Admin Products] Delete error:', err);
        return json({ error: 'Failed to delete product' }, 500, request, env);
    }
}
