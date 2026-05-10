/**
 * zip.js
 *
 * Bundle the week's posts into a single zip using fflate (already a workspace
 * dep, works in Cloudflare Workers, no native bindings).
 *
 * Layout:
 *   content-kit-YYYY-WW.zip
 *   ├── README.md
 *   ├── 01-process-steps/
 *   │   ├── graphic.png
 *   │   ├── graphic.html
 *   │   ├── copy-instagram.md
 *   │   ├── copy-facebook.md
 *   │   └── copy-linkedin.md
 *   ├── 02-reasons-list/
 *   │   └── ...
 *   └── ...
 *
 * Also exports `bytesToBase64Chunked` — needed because the email layer must
 * base64-encode the zip for Resend, and `String.fromCharCode(...bytes)` blows
 * the stack at multi-MB sizes.
 */

import { zipSync, strToU8 } from 'fflate';

/**
 * Build a zip archive from an array of post objects.
 *
 * Each post: {
 *   index: 1..N,             // ordering / folder prefix
 *   template: 'process-steps',
 *   topic: '...',            // for README
 *   sources: ['...'],        // for README
 *   html: '<!doctype...>',   // populated template (optional but recommended)
 *   png: Uint8Array,         // screenshot (optional — null on screenshot fail)
 *   instagram: '...',        // copy markdown
 *   facebook: '...',
 *   linkedin: '...',
 *   error: string|null,      // per-post failure note (sets stub instead of png)
 * }
 *
 * @param {Array} posts
 * @param {string} readmeMarkdown
 * @returns {Uint8Array}
 */
export function buildZip(posts, readmeMarkdown) {
    const archive = {};
    archive['README.md'] = strToU8(readmeMarkdown || '');

    for (const post of posts) {
        const idx = String(post.index || 0).padStart(2, '0');
        const folder = `${idx}-${post.template || 'unknown'}`;

        if (post.png) {
            archive[`${folder}/graphic.png`] = post.png;
        } else if (post.error) {
            archive[`${folder}/graphic-FAILED.txt`] = strToU8(
                `Screenshot failed: ${post.error}\n\n` +
                    `The populated HTML is included as graphic.html — open it in a 1080×1350 viewport ` +
                    `and screenshot manually if needed.\n`
            );
        }

        if (post.html) {
            archive[`${folder}/graphic.html`] = strToU8(post.html);
        }
        if (post.instagram) {
            archive[`${folder}/copy-instagram.md`] = strToU8(post.instagram);
        }
        if (post.facebook) {
            archive[`${folder}/copy-facebook.md`] = strToU8(post.facebook);
        }
        if (post.linkedin) {
            archive[`${folder}/copy-linkedin.md`] = strToU8(post.linkedin);
        }
    }

    return zipSync(archive, { level: 6 });
}

/**
 * Encode bytes as base64 in chunks small enough to avoid blowing the call stack.
 * Workers have no Buffer; `btoa` requires a binary string.
 *
 * @param {Uint8Array} bytes
 * @returns {string} base64
 */
export function bytesToBase64Chunked(bytes) {
    const CHUNK = 0x8000; // 32KB at a time
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}
