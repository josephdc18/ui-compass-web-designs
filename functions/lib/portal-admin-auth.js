/**
 * Portal Admin Auth — simple bearer token check with timing-safe comparison.
 * Uses CRM_ADMIN_TOKEN env var. Returns 500 if not configured.
 */

import { secureCompare } from './security.js';

/**
 * Verify admin bearer token from Authorization header.
 * Uses constant-time comparison to prevent timing attacks.
 * Returns 500 if CRM_ADMIN_TOKEN is not configured.
 */
export async function requirePortalAdminAuth(request, env) {
  const expectedToken = (typeof env.CRM_ADMIN_TOKEN === 'string' && env.CRM_ADMIN_TOKEN.length > 0)
    ? env.CRM_ADMIN_TOKEN
    : null;

  if (!expectedToken) {
    return { ok: false, error: 'Admin token not configured', status: 500 };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }

  const match = await secureCompare(token, expectedToken);
  if (!match) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }

  return { ok: true };
}
