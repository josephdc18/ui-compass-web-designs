/**
 * topic-selector.js
 *
 * Parses content-kit/BACKLOG.md (bundled), filters out claimed and recently-used
 * entries via D1, scores remaining candidates, and returns one pick per template.
 *
 * Returns: { picks: Pick[], warnings: Warning[], weekId: string }
 *
 * A `Pick` is a single backlog entry chosen for the week:
 *   { template, text, hash, section, sources, score }
 *
 * Scoring (higher wins):
 *   +10  has at least one source reference
 *    +3  per additional source (capped at 3 sources)
 *    +2  if entry's section was NOT used in the last 4 weeks (variety bonus)
 *    +0..1  stable per-week random tiebreak (deterministic from hash + weekId + template)
 *
 * Dedup: entries used in the last 84 days are skipped entirely. Tracked in D1
 * `content_kit_usage` keyed by entry_hash.
 */

import { BACKLOG } from './_bundled.js';

export const ALLOWED_TEMPLATES = new Set([
    'process-steps',
    'reasons-list',
    'stat-hero',
    'scorecard',
    'comparison',
    'anatomy',
    'manifesto',
]);

const SECTION_RE = /^##\s+(.+?)\s*$/;
const ENTRY_RE = /^-\s+(.+?)\s*$/;
const TEMPLATE_HINT_RE = /\(([a-z][a-z0-9-]*)\)/g;
const SRC_BLOCK_RE = /\[src:\s*([^\]]+)\]/i;
const CLAIMED_RE = /\[claimed\]/i;

/**
 * Parse the bundled BACKLOG.md into structured entries.
 *
 * Returns: Array<{ text, hash, section, template?, sources: string[], claimed: boolean }>
 *
 * Lines without a recognized `(template-name)` hint or claimed entries are
 * still returned but with `template = null` so callers can filter explicitly.
 */
export function parseBacklog(markdown = BACKLOG) {
    const out = [];
    let section = null;

    for (const rawLine of markdown.split('\n')) {
        const line = rawLine.trimEnd();

        const sectionMatch = line.match(SECTION_RE);
        if (sectionMatch) {
            section = sectionMatch[1].trim();
            continue;
        }

        const entryMatch = line.match(ENTRY_RE);
        if (!entryMatch) continue;

        const text = entryMatch[1];

        // Find the template hint — pick the first one that matches an allowed name.
        // Older backlog lines may have unrelated parens like "(Real stat from ...)" — we ignore those.
        let template = null;
        TEMPLATE_HINT_RE.lastIndex = 0;
        let hintMatch;
        while ((hintMatch = TEMPLATE_HINT_RE.exec(text)) !== null) {
            const candidate = hintMatch[1].toLowerCase();
            if (ALLOWED_TEMPLATES.has(candidate)) {
                template = candidate;
                break;
            }
        }

        // Sources — comma-separated, may have prefix `sources/` and `.md` suffix.
        const srcMatch = text.match(SRC_BLOCK_RE);
        const sources = srcMatch
            ? srcMatch[1]
                  .split(',')
                  .map((s) => s.trim().replace(/^sources\//, '').replace(/\.md$/, ''))
                  .filter(Boolean)
            : [];

        const claimed = CLAIMED_RE.test(text);
        const hash = fnv1aHash(normalizeForHash(text));

        out.push({ text, hash, section, template, sources, claimed });
    }

    return out;
}

/**
 * FNV-1a 32-bit hash → 8-char lowercase hex.
 *
 * Synchronous (works in Workers without async), deterministic, plenty of
 * collision resistance for ~hundreds of backlog entries.
 */
export function fnv1aHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Normalize entry text for stable hashing — strip whitespace + template hint
 * + source ref + claimed marker so cosmetic edits don't bust the dedup key.
 */
function normalizeForHash(text) {
    return text
        .replace(SRC_BLOCK_RE, '')
        .replace(TEMPLATE_HINT_RE, '')
        .replace(CLAIMED_RE, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * ISO week id like "2026-W19". UTC.
 */
export function isoWeekId(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    // Set to Thursday of the current ISO week (Mon=1 ... Sun=7)
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function scoreEntry(entry, recentSections, weekId) {
    let score = 0;
    if (entry.sources.length > 0) score += 10;
    score += Math.min(entry.sources.length, 3) * 3;
    if (entry.section && !recentSections.has(entry.section)) score += 2;
    // Stable per-week tiebreak — deterministic random in [0, 1)
    const tie = parseInt(fnv1aHash(entry.hash + weekId + entry.template), 16) / 0xffffffff;
    score += tie;
    return score;
}

/**
 * Main entry point. Returns one pick per template (where possible) plus warnings
 * for templates with no eligible candidates.
 *
 * Accepts an optional `now` for testing; defaults to the current date.
 *
 * If `env.DB` is not provided (testing path), dedup lookups are skipped.
 */
export async function selectWeeklyTopics(env, opts = {}) {
    const now = opts.now || new Date();
    const weekId = isoWeekId(now);
    const allEntries = parseBacklog(opts.backlog || BACKLOG);

    // D1 lookups (skip in pure-test mode where env.DB is absent)
    let usedHashes = new Set();
    let recentSections = new Set();
    if (env && env.DB) {
        const cutoff84 = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000).toISOString();
        const cutoff28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();

        try {
            const used = await env.DB.prepare(
                `SELECT entry_hash FROM content_kit_usage WHERE used_at > ?`
            )
                .bind(cutoff84)
                .all();
            usedHashes = new Set((used.results || []).map((r) => r.entry_hash));
        } catch (err) {
            console.warn('[topic-selector] dedup lookup failed:', err.message);
        }

        try {
            const sections = await env.DB.prepare(
                `SELECT DISTINCT section FROM content_kit_usage WHERE used_at > ? AND section IS NOT NULL`
            )
                .bind(cutoff28)
                .all();
            recentSections = new Set((sections.results || []).map((r) => r.section));
        } catch (err) {
            console.warn('[topic-selector] section lookup failed:', err.message);
        }
    }

    // Filter to eligible entries
    const eligible = allEntries.filter(
        (e) => e.template && ALLOWED_TEMPLATES.has(e.template) && !e.claimed && !usedHashes.has(e.hash)
    );

    // Group by template
    const byTemplate = {};
    for (const e of eligible) {
        (byTemplate[e.template] = byTemplate[e.template] || []).push(e);
    }

    // Pick top-scoring candidate per template
    const picks = [];
    const warnings = [];

    for (const template of ALLOWED_TEMPLATES) {
        const candidates = byTemplate[template] || [];
        if (candidates.length === 0) {
            warnings.push({
                template,
                message: 'No eligible backlog entries for this template (all claimed, used recently, or none added yet)',
            });
            continue;
        }
        const scored = candidates
            .map((e) => ({ ...e, score: scoreEntry(e, recentSections, weekId) }))
            .sort((a, b) => b.score - a.score);
        picks.push(scored[0]);
    }

    return { picks, warnings, weekId };
}

/**
 * Record a successful weekly pick set in D1. Called by the orchestrator after
 * the email has been sent successfully.
 */
export async function recordPicks(env, picks, weekId, now = new Date()) {
    if (!env || !env.DB) return;
    const usedAt = now.toISOString();

    for (const pick of picks) {
        try {
            await env.DB.prepare(
                `INSERT OR REPLACE INTO content_kit_usage
                 (entry_hash, used_at, template, section, week, source_refs)
                 VALUES (?, ?, ?, ?, ?, ?)`
            )
                .bind(
                    pick.hash,
                    usedAt,
                    pick.template,
                    pick.section || null,
                    weekId,
                    JSON.stringify(pick.sources || [])
                )
                .run();
        } catch (err) {
            console.error(`[topic-selector] failed to record pick ${pick.hash}:`, err.message);
        }
    }
}
