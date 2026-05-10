/**
 * llm.js
 *
 * Anthropic API client for generating populated graphic data + IG/FB/LI copy
 * variants for a single backlog topic. Calls Claude via raw fetch (no SDK
 * required). Uses prompt caching on BRAND.md and the output contract so the
 * same blocks aren't re-billed across the seven weekly calls.
 *
 * Public entry point:
 *   await generatePostCopy(env, { topic, template, sources, requiredFields, date })
 *
 * Returns:
 *   { graphic: {...required fields...}, instagram: '...', facebook: '...', linkedin: '...' }
 *
 * Throws on hard failures (HTTP error, invalid JSON twice, linter fail twice).
 */

import { BRAND, SOURCES } from './_bundled.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 4000;

// Word-count targets (BRAND.md spec)
const COPY_TARGETS = {
    instagram: { min: 100, max: 180 },
    facebook: { min: 150, max: 250 },
    linkedin: { min: 200, max: 400 },
};

// --- Output contract (cached across all 7 weekly calls) ---

const OUTPUT_CONTRACT = `# Output Contract

You produce a single JSON object — nothing else. No prose before or after. The shape:

\`\`\`json
{
  "graphic": { ...template-specific fields... },
  "instagram": "string — 100-180 words plus 4-6 hashtags on the final line",
  "facebook":  "string — 150-250 words plus 4-6 hashtags on the final line",
  "linkedin":  "string — 200-400 words plus 4-6 hashtags on the final line"
}
\`\`\`

The required fields for the \`graphic\` object are listed below per template.
For text fields that take an italic-emerald accent (\`headlineEm\`, \`subheadEm\`, \`statementEm\`, etc.) you provide the EXACT substring of the parent field that should be wrapped in \`<em>\`. The substring must appear verbatim in the parent text — case and punctuation must match. If you don't want an italic accent, omit the \`...Em\` field entirely.

For multi-line text fields (headline, statement), use literal \`\\n\` for line breaks. The renderer will convert them to \`<br>\`.

For body copy that needs bold emphasis on a phrase (e.g. stat-hero bullets, comparison verdict), wrap that phrase in \`<strong>...</strong>\`. The renderer permits \`<strong>\`, \`<em>\`, and \`<br>\` inline; everything else is escaped.

# Voice rules — non-negotiable

Read BRAND.md above for the full list. Hard rules:

- No emojis anywhere, including hashtag blocks.
- No em-dashes (— or –). Use periods, commas, parentheses, or two short sentences.
- Short declarative sentences. One idea per sentence.
- Second person for the audience: "your site", "your visitors". Never "businesses" or "people".
- Stat-first hooks. Lead with a number, year, percentage, or contrarian claim. Never with "In today's world..." or "Did you know...".
- No hedging: avoid "might", "could potentially", "in some cases", "perhaps". Make the claim or cut the sentence.
- No corporate-speak: no "leverage", "synergy", "robust", "best-in-class", "industry-leading".
- No AI tells: no "delve", "in the realm of", "it's worth noting", "in essence", "let's explore", "in conclusion".
- No exclamation marks. Period.
- Sentences must not start with "So,".
- End each platform copy with a CTA + a single question line.

# Anti-fabrication rules

- Numbers in the copy MUST appear verbatim in the source notes provided in the user message. Do not invent statistics. If the topic has no usable number, lead with a claim instead.
- Do not invent client names, employee names, or city populations.
- The headline + subhead must paraphrase the topic line itself, not introduce a new claim.

# Hashtags

4-6 hashtags per platform, on a single line at the end of the copy. Mix:
- Brand: \`#UICompass\`
- Location: \`#DallasWebDesign\`, \`#FortWorthBusiness\`, or \`#DFWSmallBusiness\`
- Topic-specific: pick from #WebDesign, #PageSpeed, #CoreWebVitals, #SmallBusinessWebsite, #SEO, #Accessibility, #WCAG depending on the topic
Order: most specific to most general. No emojis in hashtags.
`;

// --- System prompt builder ---

function buildSystem(template, requiredFields) {
    const shapeBlock = `# This week's template: \`${template}\`\n\nRequired \`graphic\` fields for this template:\n${requiredFields
        .map((f) => `- \`${f}\``)
        .join('\n')}\n\nFollow the field semantics described in the bundled template HTML and the contract above.`;

    return [
        // BRAND.md — cached
        {
            type: 'text',
            text: BRAND,
            cache_control: { type: 'ephemeral' },
        },
        // Output contract — cached
        {
            type: 'text',
            text: OUTPUT_CONTRACT,
            cache_control: { type: 'ephemeral' },
        },
        // Per-template shape — not cached (varies per call)
        {
            type: 'text',
            text: shapeBlock,
        },
    ];
}

// --- User prompt builder ---

function buildUser({ topic, sources, date }) {
    const sourceParts = (sources || []).map((slug) => {
        const md = SOURCES[slug];
        if (!md) return `## Source: ${slug}\n\n_(source file not bundled — skip)_`;
        // Truncate per source so a wordy source file doesn't blow the prompt.
        const truncated = md.length > 4000 ? md.slice(0, 4000) + '\n\n_[truncated]_' : md;
        return `## Source: ${slug}\n\n${truncated}`;
    });

    return [
        `# Topic`,
        '',
        `> ${topic}`,
        '',
        `# Today's date`,
        '',
        date,
        '',
        `# Source notes`,
        '',
        sourceParts.length > 0 ? sourceParts.join('\n\n---\n\n') : '_No source notes available — write from the topic alone, but still respect anti-fabrication rules (no invented numbers)._',
        '',
        '---',
        '',
        'Produce the JSON now. Output the JSON object only — no markdown fences, no commentary.',
    ].join('\n');
}

// --- Voice linter ---

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}]/u;
const EM_DASH_RE = /[–—]/;
const BANNED_PHRASES = [
    /\bdelve\b/i,
    /\bin the realm of\b/i,
    /\bit's worth noting\b/i,
    /\bin essence\b/i,
    /\bgame[- ]changing\b/i,
    /\brevolutionary\b/i,
    /\bin today's digital landscape\b/i,
    /\bdid you know that\b/i,
    /\bwe're excited to announce\b/i,
    /\blet's explore\b/i,
    /\bin conclusion\b/i,
    /\bleverage\b/i,
    /\bsynergy\b/i,
    /\brobust\b/i,
    /\bbest-in-class\b/i,
    /\bindustry-leading\b/i,
];
const STARTS_WITH_SO_RE = /(^|\.\s+)So,\s/;
const EXCLAMATION_RE = /!/;

function lintCopy(copy, label) {
    const violations = [];
    if (EMOJI_RE.test(copy)) violations.push(`${label}: contains an emoji`);
    if (EM_DASH_RE.test(copy)) violations.push(`${label}: contains an em-dash or en-dash`);
    if (EXCLAMATION_RE.test(copy)) violations.push(`${label}: contains an exclamation mark`);
    if (STARTS_WITH_SO_RE.test(copy)) violations.push(`${label}: a sentence starts with "So,"`);
    for (const re of BANNED_PHRASES) {
        if (re.test(copy)) violations.push(`${label}: contains banned phrase ${re}`);
    }
    return violations;
}

function wordCount(text) {
    return (String(text || '').trim().match(/\S+/g) || []).length;
}

/**
 * Validate the parsed LLM output. Returns array of violation strings (empty = OK).
 */
function validateOutput(parsed, requiredFields) {
    const violations = [];

    // Required top-level keys
    if (!parsed || typeof parsed !== 'object') {
        return ['Output is not an object'];
    }
    if (!parsed.graphic || typeof parsed.graphic !== 'object') {
        violations.push('Missing graphic object');
    } else {
        for (const f of requiredFields) {
            const v = parsed.graphic[f];
            if (v === undefined || v === null || v === '') {
                violations.push(`Missing required graphic field: ${f}`);
            }
        }
    }

    // Per-platform copy
    for (const platform of ['instagram', 'facebook', 'linkedin']) {
        const copy = parsed[platform];
        if (!copy || typeof copy !== 'string') {
            violations.push(`Missing ${platform} copy`);
            continue;
        }
        violations.push(...lintCopy(copy, platform));
        const wc = wordCount(copy);
        const target = COPY_TARGETS[platform];
        if (wc < target.min) {
            violations.push(`${platform}: ${wc} words (under min ${target.min})`);
        } else if (wc > target.max) {
            violations.push(`${platform}: ${wc} words (over max ${target.max})`);
        }
        // Hashtag presence — last non-empty line should contain at least one #
        const lines = copy.trim().split('\n').filter((l) => l.trim());
        const lastLine = lines[lines.length - 1] || '';
        if (!lastLine.includes('#')) {
            violations.push(`${platform}: last line must contain hashtags`);
        }
    }

    // Lint graphic text fields too — short text may also contain emoji etc.
    if (parsed.graphic) {
        for (const [k, v] of Object.entries(parsed.graphic)) {
            if (typeof v === 'string') {
                violations.push(...lintCopy(v, `graphic.${k}`));
            }
        }
    }

    return violations;
}

// --- Anthropic API call ---

async function callAnthropic(env, { system, user, model, maxTokens }) {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const body = {
        model: model || env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
    };

    const response = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Anthropic ${response.status}: ${detail.slice(0, 240)}`);
    }

    const json = await response.json();
    const text = (json.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

    return { text, usage: json.usage || null };
}

/**
 * Strip a leading ```json fence and trailing ``` if the model wrapped its
 * response in markdown despite our instruction not to.
 */
function stripJsonFence(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('```')) {
        return trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return trimmed;
}

function safeJsonParse(text) {
    try {
        return { ok: true, value: JSON.parse(stripJsonFence(text)) };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

// --- Public API ---

/**
 * Generate populated graphic data + IG/FB/LI copy for one topic.
 *
 * @param {object} env - Worker env (needs ANTHROPIC_API_KEY).
 * @param {object} args
 * @param {string} args.topic - Backlog entry text.
 * @param {string} args.template - Template id (e.g. 'process-steps').
 * @param {string[]} args.sources - Source file slugs (without .md).
 * @param {string[]} args.requiredFields - Fields the graphic object must include.
 * @param {string} args.date - Already-formatted date string (e.g. "May 12, 2026").
 *
 * @returns {Promise<{ graphic: object, instagram: string, facebook: string, linkedin: string, usage: object|null }>}
 */
export async function generatePostCopy(env, args) {
    const { topic, template, sources = [], requiredFields, date } = args;

    if (!topic) throw new Error('generatePostCopy: topic required');
    if (!template) throw new Error('generatePostCopy: template required');
    if (!requiredFields || requiredFields.length === 0) {
        throw new Error('generatePostCopy: requiredFields required');
    }

    const system = buildSystem(template, requiredFields);
    let user = buildUser({ topic, sources, date });
    let lastViolations = null;
    let lastUsage = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
        const { text, usage } = await callAnthropic(env, { system, user });
        lastUsage = usage;

        const parsed = safeJsonParse(text);
        if (!parsed.ok) {
            if (attempt === 2) {
                throw new Error(`LLM returned invalid JSON twice: ${parsed.error}`);
            }
            user = `${user}\n\n---\n\nYour previous response could not be parsed as JSON: ${parsed.error}\n\nReturn ONLY the JSON object, no markdown fences, no commentary.`;
            continue;
        }

        // Inject the date into the graphic if the LLM omitted it (it's not the LLM's job to know today's date).
        if (parsed.value && parsed.value.graphic && !parsed.value.graphic.date) {
            parsed.value.graphic.date = date;
        }

        const violations = validateOutput(parsed.value, requiredFields);
        if (violations.length === 0) {
            return {
                graphic: parsed.value.graphic,
                instagram: parsed.value.instagram,
                facebook: parsed.value.facebook,
                linkedin: parsed.value.linkedin,
                usage,
            };
        }

        // Lint failed — retry with violations quoted back.
        lastViolations = violations;
        if (attempt === 2) {
            throw new Error(
                `LLM output failed voice linter twice: ${violations.slice(0, 6).join('; ')}`
            );
        }

        user = `${user}\n\n---\n\nYour previous response had these violations:\n\n${violations
            .map((v) => `- ${v}`)
            .join('\n')}\n\nFix every violation and return the corrected JSON object only.`;
    }

    // Should be unreachable.
    throw new Error('Unexpected end of generatePostCopy retry loop');
}
