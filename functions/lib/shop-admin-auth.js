/**
 * Shop Admin Auth Middleware
 *
 * Simple token-based authentication for admin API routes.
 * Uses CRM_ADMIN_TOKEN env var. Returns 500 if not configured.
 *
 * Clients send: Authorization: Bearer <token>
 */

export function requireAdminAuth(request, env) {
    const expectedToken = (typeof env.CRM_ADMIN_TOKEN === 'string' && env.CRM_ADMIN_TOKEN.length > 0)
        ? env.CRM_ADMIN_TOKEN
        : null;

    if (!expectedToken) {
        return { ok: false, error: 'Admin token not configured', status: 500 };
    }

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (!token || token !== expectedToken) {
        return { ok: false, error: 'Unauthorized', status: 401 };
    }

    return { ok: true };
}
