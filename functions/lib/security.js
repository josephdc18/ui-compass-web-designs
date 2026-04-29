/**
 * Security utilities — crypto helpers for portal auth, password hashing, rate limiting.
 * Uses Web Crypto API (available in Workers and Node 16+).
 */

/**
 * SHA-256 hash, returns hex string.
 */
export async function sha256(str) {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a cryptographically secure random token (hex string).
 * @param {number} bytes — number of random bytes (default 32 = 64 hex chars)
 */
export function generateToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a password using PBKDF2 with SHA-256.
 * Format: pbkdf2:600000:base64(salt):base64(hash)
 */
export async function hashPassword(password) {
  const iterations = 600000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hashBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBits)));
  return `pbkdf2:${iterations}:${saltB64}:${hashB64}`;
}

/**
 * Verify a password against a stored hash.
 * Supports PBKDF2 format and legacy SHA-256 format.
 * @returns {{ valid: boolean, needsRehash: boolean }}
 */
export async function verifyPassword(password, storedHash) {
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 4) return { valid: false, needsRehash: false };
    const iterations = parseInt(parts[1], 10);
    const salt = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
    const expectedHash = atob(parts[3]);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const hashBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const computedHash = String.fromCharCode(...new Uint8Array(hashBits));
    const valid = computedHash === expectedHash;
    const needsRehash = valid && iterations < 600000;
    return { valid, needsRehash };
  }
  // Legacy SHA-256 fallback
  const computed = await sha256(password);
  const valid = computed === storedHash;
  return { valid, needsRehash: valid };
}

/**
 * Constant-time string comparison using Web Crypto API.
 */
export async function secureCompare(a, b) {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  if (aBuf.length !== bBuf.length) return false;
  if (typeof crypto?.subtle?.timingSafeEqual === 'function') {
    try {
      const maybe = crypto.subtle.timingSafeEqual(aBuf, bBuf);
      return typeof maybe?.then === 'function' ? !!(await maybe) : !!maybe;
    } catch {}
  }
  const key = await crypto.subtle.importKey(
    'raw',
    crypto.getRandomValues(new Uint8Array(32)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigA = new Uint8Array(await crypto.subtle.sign('HMAC', key, aBuf));
  const sigB = new Uint8Array(await crypto.subtle.sign('HMAC', key, bBuf));
  let result = 0;
  for (let i = 0; i < sigA.length; i++) result |= sigA[i] ^ sigB[i];
  return result === 0;
}

/**
 * Sanitize a string for safe display — strip tags, trim, truncate.
 */
export function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\0/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Basic email validation.
 */
export function isValidEmail(email) {
  if (typeof email !== 'string' || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Check rate limit using D1 rate_limits table.
 * `expiresAt` is projected through strftime so JS can parse it as UTC reliably
 * (SQLite's bare datetime() returns 'YYYY-MM-DD HH:MM:SS' which `new Date()`
 * interprets as local time on most engines — that silently corrupts retry math).
 * @returns {{ allowed: boolean, remaining: number, expiresAt: string|null }}
 */
export async function checkRateLimit(db, key, maxCount, windowMinutes) {
  await db.prepare('DELETE FROM rate_limits WHERE expires_at < datetime(\'now\')').run();
  const windowModifier = '+' + windowMinutes + ' minutes';
  await db.prepare(
    `INSERT INTO rate_limits (key, count, window_start, expires_at)
     VALUES (?, 1, datetime('now'), datetime('now', ?))
     ON CONFLICT(key) DO UPDATE SET
       count = CASE
         WHEN rate_limits.expires_at < datetime('now') THEN 1
         ELSE rate_limits.count + 1
       END,
       window_start = CASE
         WHEN rate_limits.expires_at < datetime('now') THEN datetime('now')
         ELSE rate_limits.window_start
       END,
       expires_at = CASE
         WHEN rate_limits.expires_at < datetime('now') THEN datetime('now', ?)
         ELSE rate_limits.expires_at
       END`
  ).bind(key, windowModifier, windowModifier).run();
  const current = await db.prepare(
    `SELECT count, strftime('%Y-%m-%dT%H:%M:%SZ', expires_at) AS expires_at_iso
     FROM rate_limits WHERE key = ?`
  ).bind(key).first();
  const currentCount = Number(current?.count || 0);
  const expiresAt = current?.expires_at_iso || null;
  if (currentCount > maxCount) return { allowed: false, remaining: 0, expiresAt };
  return { allowed: true, remaining: Math.max(0, maxCount - currentCount), expiresAt };
}
