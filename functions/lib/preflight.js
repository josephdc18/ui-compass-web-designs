/**
 * Startup config validation — checks required env vars exist.
 * Called on first request per isolate. Caches result per module load.
 */

const _preflightCache = new Map();

/**
 * Validate that all required secrets are present.
 * @param {object} env — Worker env bindings
 * @param {string[]} requiredSecrets — list of env var names
 * @returns {{ ok: boolean, error?: string }}
 */
export function preflight(env, requiredSecrets) {
  const cacheKey = requiredSecrets.join(',');
  if (_preflightCache.has(cacheKey)) return _preflightCache.get(cacheKey);

  const isDev = !env.SITE_URL || String(env.SITE_URL).startsWith('http://localhost');
  const missing = requiredSecrets.filter(s => typeof env[s] !== 'string' || env[s].length === 0);

  if (missing.length > 0) {
    const commands = missing.map(s => 'npx wrangler pages secret put ' + s).join('\n  ');
    const msg = 'Missing required secrets: ' + missing.join(', ') + '. Set via:\n  ' + commands;
    if (isDev) {
      console.warn('[Preflight] ' + msg);
      const result = { ok: true };
      _preflightCache.set(cacheKey, result);
      return result;
    }
    const result = { ok: false, error: msg };
    _preflightCache.set(cacheKey, result);
    return result;
  }

  const result = { ok: true };
  _preflightCache.set(cacheKey, result);
  return result;
}
