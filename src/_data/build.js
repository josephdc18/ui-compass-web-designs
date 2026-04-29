/**
 * Build-time data for cache busting and versioning
 *
 * This generates fresh values on each build, used by:
 * - Service worker cache versioning
 * - Asset cache-busting
 *
 * Usage in templates:
 *   {{ build.timestamp }}  → 1706472000000
 *   {{ build.version }}    → 2024-01-28
 *   {{ build.hash }}       → a1b2c3d4
 */

module.exports = function () {
    const now = new Date();

    return {
        // Unix timestamp - changes every build
        timestamp: Date.now(),

        // Human-readable date version
        version: now.toISOString().split('T')[0], // YYYY-MM-DD

        // Short hash for cache keys
        hash: Date.now().toString(36).slice(-8),

        // Full ISO string
        buildTime: now.toISOString(),

        // Environment detection
        env: process.env.NODE_ENV || 'development',
    };
};
