/**
 * Portal JWT auth — HS256 sign/verify for client-facing portal endpoints.
 * Uses Web Crypto API. Explicitly enforces alg: HS256 on verification.
 */

function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlEncode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

async function getHmacKey(env) {
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Sign a portal JWT with HS256. 24-hour expiry.
 */
export async function signPortalJWT(clientId, email, name, env) {
  const key = await getHmacKey(env);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    sub: String(clientId),
    email: email || '',
    name: name || '',
    role: 'portal_client',
    iat: now,
    exp: now + 86400,
  }));
  const data = new TextEncoder().encode(header + '.' + payload);
  const sig = base64urlEncode(await crypto.subtle.sign('HMAC', key, data));
  return header + '.' + payload + '.' + sig;
}

/**
 * Verify a portal JWT. Enforces HS256 algorithm, checks expiry and role.
 * @returns {{ valid: boolean, clientId?: number, email?: string, name?: string }}
 */
export async function verifyPortalToken(token, env) {
  const fail = { valid: false };
  if (!token || typeof token !== 'string') return fail;

  const parts = token.split('.');
  if (parts.length !== 3) return fail;

  try {
    // Decode and enforce algorithm
    const headerJson = JSON.parse(base64urlDecode(parts[0]));
    if (headerJson.alg !== 'HS256') return fail;

    const key = await getHmacKey(env);
    const data = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const sigBytes = Uint8Array.from(base64urlDecode(parts[2]), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
    if (!valid) return fail;

    const payload = JSON.parse(base64urlDecode(parts[1]));
    if (payload.role !== 'portal_client') return fail;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return fail;

    return {
      valid: true,
      clientId: Number(payload.sub),
      email: payload.email || '',
      name: payload.name || '',
    };
  } catch {
    return fail;
  }
}
