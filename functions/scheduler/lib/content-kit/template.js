/**
 * template.js
 *
 * Per-template population using Cloudflare's built-in HTMLRewriter.
 *
 * Each template has a `register(rewriter, data)` function that wires up the
 * appropriate selector→handler pairs to substitute placeholder content with
 * the LLM-generated payload. A universal post-step inlines the brand logo as
 * a base64 data URI so Browserless can render the asset without a network fetch.
 *
 * Usage:
 *   const html = await populateTemplate('process-steps', { eyebrow, headline, ... });
 *
 * Throws if `name` is unknown or required fields are missing for that template.
 */

import { TEMPLATES, LOGO_SVG_BASE64 } from './_bundled.js';

// --- HTML helpers ---

function escapeHtml(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Render a single text field that may contain a `<br>` (from `\n`) and
 * optionally an italic-emerald `<em>` accent on a substring. Sanitizes input
 * — the LLM should NOT inject any other HTML.
 */
function renderInline(text, emPart) {
    if (text == null || text === '') return '';
    const raw = String(text);

    let result;
    if (emPart && raw.indexOf(emPart) >= 0) {
        const idx = raw.indexOf(emPart);
        result =
            escapeHtml(raw.slice(0, idx)) +
            '<em>' +
            escapeHtml(emPart) +
            '</em>' +
            escapeHtml(raw.slice(idx + emPart.length));
    } else {
        result = escapeHtml(raw);
    }

    // Convert literal newlines to <br> for line-broken headlines/statements.
    return result.replace(/\n/g, '<br>');
}

/**
 * Render a body string that may contain inline `<strong>` markers from the LLM.
 * Allowed inline tags: <strong>, <em>, <br>. Everything else is escaped.
 */
function renderBodyInline(text) {
    if (text == null || text === '') return '';
    const raw = String(text);

    // Tokenize on allowed tags
    const ALLOWED = /<\/?(strong|em|br)\s*\/?>/gi;
    let result = '';
    let last = 0;
    let m;
    while ((m = ALLOWED.exec(raw)) !== null) {
        result += escapeHtml(raw.slice(last, m.index));
        result += m[0].toLowerCase();
        last = m.index + m[0].length;
    }
    result += escapeHtml(raw.slice(last));

    return result.replace(/\n/g, '<br>');
}

// --- Element handlers ---

function setText(text) {
    return {
        element(el) {
            el.setInnerContent(text == null ? '' : String(text), { html: false });
        },
    };
}

function setHtml(html) {
    return {
        element(el) {
            el.setInnerContent(html == null ? '' : String(html), { html: true });
        },
    };
}

/**
 * Counter-aware handler. Returns a fresh object whose .element callback pulls
 * from `arr[i++]`. Pass a `formatter(item, index)` to derive the inner HTML.
 */
function indexedHandler(arr, formatter, opts = {}) {
    let i = 0;
    return {
        element(el) {
            const item = arr[i];
            i++;
            if (item === undefined || item === null) return;
            const html = formatter(item, i - 1);
            if (html == null) return;
            el.setInnerContent(String(html), { html: opts.html !== false });
        },
    };
}

// --- Score-ring helpers ---

const RING_CIRCUMFERENCE = 603.19; // 2 * pi * 96 (matches scorecard template r=96)

function ringDashoffset(value) {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    return (RING_CIRCUMFERENCE * (1 - v / 100)).toFixed(2);
}

// --- Per-template registration functions ---

const SHAPES = {
    'process-steps': {
        required: ['eyebrow', 'headline', 'steps'],
        register(rewriter, data) {
            rewriter.on('.pill-eyebrow', setText(data.eyebrow));
            rewriter.on('.headline', setHtml(renderInline(data.headline, data.headlineEm)));
            rewriter.on('.subhead', setHtml(renderInline(data.subhead, data.subheadEm)));

            const steps = data.steps || [];
            rewriter.on(
                '.flow .pill .t',
                indexedHandler(steps, (s) => renderInline(s.t || ''), { html: true })
            );
            rewriter.on(
                '.flow .pill .d',
                indexedHandler(steps, (s) => renderInline(s.d || ''), { html: true })
            );

            rewriter.on('.meta .date', setText(data.date));
        },
    },

    'reasons-list': {
        required: ['eyebrow', 'headline', 'items'],
        register(rewriter, data) {
            rewriter.on('.pill-eyebrow', setText(data.eyebrow));
            rewriter.on('.headline', setHtml(renderInline(data.headline, data.headlineEm)));
            rewriter.on('.subhead', setHtml(renderInline(data.subhead, data.subheadEm)));

            const items = data.items || [];
            rewriter.on(
                '.cards .card .title',
                indexedHandler(items, (it) => renderInline(it.title || ''), { html: true })
            );
            rewriter.on(
                '.cards .card .desc',
                indexedHandler(items, (it) => renderInline(it.desc || ''), { html: true })
            );

            rewriter.on('.meta .date', setText(data.date));
        },
    },

    'stat-hero': {
        required: ['eyebrow', 'headline', 'statNum', 'statCaption'],
        register(rewriter, data) {
            rewriter.on('.pill-eyebrow', setText(data.eyebrow));
            rewriter.on('.headline', setHtml(renderInline(data.headline, data.headlineEm)));
            rewriter.on('.subhead', setHtml(renderInline(data.subhead, data.subheadEm)));

            // statNum + optional unit. Template structure: `<div class="stat-num">8.5<span class="unit">s</span></div>`
            const numHtml = data.statUnit
                ? escapeHtml(data.statNum) + '<span class="unit">' + escapeHtml(data.statUnit) + '</span>'
                : escapeHtml(data.statNum);
            rewriter.on('.stat-num', setHtml(numHtml));

            rewriter.on('.stat-caption', setHtml(renderInline(data.statCaption, data.statCaptionEm)));

            const bullets = data.bullets || [];
            // Template structure: `<div class="bullet"><span>...</span></div>`. Replace the inner <span> content.
            rewriter.on(
                '.bullets .bullet span',
                indexedHandler(bullets, (b) => renderBodyInline(b), { html: true })
            );

            rewriter.on('.source', setText(data.source));
            rewriter.on('.meta .date', setText(data.date));
        },
    },

    scorecard: {
        required: ['eyebrow', 'headline', 'scores'],
        register(rewriter, data) {
            rewriter.on('.pill-eyebrow', setText(data.eyebrow));
            rewriter.on('.headline', setHtml(renderInline(data.headline, data.headlineEm)));
            rewriter.on('.subhead', setHtml(renderInline(data.subhead, data.subheadEm)));

            const scores = data.scores || [];

            // Score numbers
            rewriter.on(
                '.scores .ring-num',
                indexedHandler(scores, (s) => escapeHtml(String(s.value ?? 0)), { html: true })
            );

            // Score labels
            rewriter.on(
                '.scores .score-label',
                indexedHandler(scores, (s) => renderInline(s.label || ''), { html: true })
            );

            // Ring fill: replace the static `s-NN` class with an inline style derived from the score.
            // Keeps the base `ring-fill` class so the shared styles still apply.
            let ringIdx = 0;
            rewriter.on('.scores .ring-fill', {
                element(el) {
                    const s = scores[ringIdx++];
                    if (!s) return;
                    el.setAttribute('class', 'ring-fill');
                    el.setAttribute(
                        'style',
                        `stroke-dashoffset: ${ringDashoffset(s.value)};`
                    );
                },
            });

            rewriter.on('.caption', setHtml(renderBodyInline(data.caption)));
            rewriter.on('.meta .date', setText(data.date));
        },
    },

    comparison: {
        required: ['eyebrow', 'headline', 'sideA', 'sideB', 'rows'],
        register(rewriter, data) {
            rewriter.on('.pill-eyebrow', setText(data.eyebrow));
            rewriter.on('.headline', setHtml(renderInline(data.headline, data.headlineEm)));
            rewriter.on('.subhead', setHtml(renderInline(data.subhead, data.subheadEm)));

            rewriter.on('.vs-headers .side.left', setText(data.sideA));
            rewriter.on('.vs-headers .side.right', setText(data.sideB));

            const rows = data.rows || [];

            rewriter.on(
                '.vs-row .vs-label',
                indexedHandler(rows, (r) => escapeHtml(r.label || ''), { html: true })
            );

            // Each value cell may have an optional `<i class="unit">` tag.
            const formatValue = (val, unit) => {
                if (unit) return escapeHtml(val) + '<i class="unit">' + escapeHtml(unit) + '</i>';
                return escapeHtml(val);
            };

            rewriter.on(
                '.vs-pair .left',
                indexedHandler(rows, (r) => formatValue(r.valA, r.valAUnit), { html: true })
            );
            rewriter.on(
                '.vs-pair .right',
                indexedHandler(rows, (r) => formatValue(r.valB, r.valBUnit), { html: true })
            );

            rewriter.on('.vs-verdict', setHtml(renderBodyInline(data.verdict)));
            rewriter.on('.meta .date', setText(data.date));
        },
    },

    anatomy: {
        required: ['eyebrow', 'headline', 'parts'],
        register(rewriter, data) {
            rewriter.on('.pill-eyebrow', setText(data.eyebrow));
            rewriter.on('.headline', setHtml(renderInline(data.headline, data.headlineEm)));
            rewriter.on('.subhead', setHtml(renderInline(data.subhead, data.subheadEm)));

            const parts = data.parts || [];
            rewriter.on(
                '.callout .label',
                indexedHandler(parts, (p) => renderInline(p.label || ''), { html: true })
            );
            rewriter.on(
                '.callout .desc',
                indexedHandler(parts, (p) => renderInline(p.desc || ''), { html: true })
            );

            rewriter.on('.meta .date', setText(data.date));
        },
    },

    manifesto: {
        required: ['eyebrow', 'statement'],
        register(rewriter, data) {
            rewriter.on('.pill-eyebrow', setText(data.eyebrow));
            rewriter.on('.statement', setHtml(renderInline(data.statement, data.statementEm)));
            rewriter.on('.byline', setHtml(renderInline(data.byline, data.bylineEm)));
            rewriter.on('.meta .date', setText(data.date));
        },
    },
};

// --- Public API ---

/**
 * Populate a template with the given data. Returns the resulting HTML string.
 *
 * @param {string} name - Template id (matches a key in SHAPES / TEMPLATES).
 * @param {object} data - Template-specific payload. Required fields per template:
 *                        listed in SHAPES[name].required.
 */
export async function populateTemplate(name, data) {
    const shape = SHAPES[name];
    if (!shape) throw new Error(`Unknown template: ${name}`);
    const html = TEMPLATES[name];
    if (!html) throw new Error(`Template HTML not bundled: ${name}`);

    // Validate required fields
    for (const key of shape.required) {
        if (data[key] === undefined || data[key] === null || data[key] === '') {
            throw new Error(`Template ${name} requires field: ${key}`);
        }
    }

    // HTMLRewriter is a Cloudflare Workers built-in. In Node tests it's polyfilled
    // by importing from a different module — but for now this is Worker-only.
    if (typeof HTMLRewriter === 'undefined') {
        throw new Error('HTMLRewriter is only available in the Cloudflare Workers runtime');
    }

    const rewriter = new HTMLRewriter();
    shape.register(rewriter, data);

    // Universal: inline the brand logo as a data URI so Browserless can render
    // it without resolving the relative `../assets/logo.svg` path.
    const dataUri = `data:image/svg+xml;base64,${LOGO_SVG_BASE64}`;
    rewriter.on('img[src*="logo.svg"]', {
        element(el) {
            el.setAttribute('src', dataUri);
        },
    });

    // Stream-transform the bundled template HTML.
    const response = new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=utf-8' },
    });
    const transformed = rewriter.transform(response);
    return await transformed.text();
}

/**
 * Returns the list of known template names (matches the keys in SHAPES).
 */
export function getKnownTemplates() {
    return Object.keys(SHAPES);
}

/**
 * Returns the required field list for a given template — useful for the LLM
 * prompt (so the model knows which keys to populate).
 */
export function getRequiredFields(name) {
    const shape = SHAPES[name];
    if (!shape) return null;
    return [...shape.required];
}
