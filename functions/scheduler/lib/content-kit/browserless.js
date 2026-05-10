/**
 * browserless.js
 *
 * Screenshot client for Browserless.io. Takes populated HTML and returns PNG bytes.
 *
 * Renders at 1080×1350 viewport at deviceScaleFactor=2 (so the PNG comes back
 * 2160×2700 — high enough for retina display on Instagram).
 *
 * Wait strategy: networkidle0 (so Google Fonts WOFF2 fetch settles) + a small
 * post-idle buffer to absorb any race between network-idle and CSS application.
 *
 * Throws on hard failures (HTTP error, timeout). The orchestrator catches and
 * isolates per-post so one screenshot failure doesn't kill the whole batch.
 */

const BROWSERLESS_URL = 'https://chrome.browserless.io/screenshot';
const SCREENSHOT_TIMEOUT_MS = 30_000;

/**
 * Capture a 1080×1350 PNG of the given HTML via Browserless.
 *
 * @param {object} env - Worker env. Must have BROWSERLESS_API_KEY.
 * @param {string} html - Populated template HTML.
 * @returns {Promise<Uint8Array>} PNG bytes.
 */
export async function screenshot(env, html) {
    if (!env.BROWSERLESS_API_KEY) {
        throw new Error('BROWSERLESS_API_KEY not configured');
    }

    const url = `${BROWSERLESS_URL}?token=${encodeURIComponent(env.BROWSERLESS_API_KEY)}`;

    const body = {
        html,
        viewport: {
            width: 1080,
            height: 1350,
            deviceScaleFactor: 2,
        },
        gotoOptions: {
            waitUntil: 'networkidle0',
            timeout: 25_000,
        },
        // Extra time after networkidle0 for fonts to swap and CSS animations to settle.
        waitForTimeout: 1200,
        options: {
            type: 'png',
            fullPage: false,
            // Clip to the canvas dimensions (templates render at exactly 1080×1350).
            clip: { x: 0, y: 0, width: 1080, height: 1350 },
            omitBackground: false,
        },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCREENSHOT_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            throw new Error(`Browserless screenshot timed out after ${SCREENSHOT_TIMEOUT_MS}ms`);
        }
        throw new Error(`Browserless fetch failed: ${err.message}`);
    }
    clearTimeout(timer);

    if (!response.ok) {
        // Try to surface a useful error message from the body.
        let detail = '';
        try {
            detail = await response.text();
        } catch (_) {
            /* ignore */
        }
        throw new Error(`Browserless ${response.status}: ${detail.slice(0, 240)}`);
    }

    const buf = await response.arrayBuffer();
    return new Uint8Array(buf);
}
