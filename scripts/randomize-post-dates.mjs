#!/usr/bin/env node
/**
 * Reassign every blog post a random publication date inside a window, then
 * keep everything that derives from a date in sync.
 *
 * Three things depend on a post's date and would otherwise drift:
 *   1. `date:` in the post's own frontmatter (and `updated:`, where present,
 *      which must never precede it).
 *   2. The Korean mirror of a post, which has to carry the same date as its
 *      English counterpart or the two language versions disagree.
 *   3. The `Issue Nº NN · Month YYYY` line baked into the card artwork.
 *      NN is the post's chronological position, so it only settles once every
 *      date is assigned.
 *
 * Card HTML is rewritten here; re-render afterwards:
 *   node scripts/randomize-post-dates.mjs --seed 20260827
 *   node scripts/render-card-local.mjs --all-existing
 *
 * Flags:
 *   --seed <n>    deterministic shuffle (default 1); same seed, same dates
 *   --from <date> window start, inclusive (default 2025-09-01)
 *   --to <date>   window end, exclusive   (default 2026-08-25)
 *   --dry-run     print the assignment, write nothing
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EN_DIR = path.join(ROOT, 'src/blog');
const KO_DIR = path.join(ROOT, 'src/ko/blog');
const CARDS_DIR = path.join(ROOT, 'content-kit/blog-cards');

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
const DRY = process.argv.includes('--dry-run');
const SEED = Number(arg('seed', 1));
const FROM = new Date(`${arg('from', '2025-09-01')}T00:00:00Z`).getTime();
const TO = new Date(`${arg('to', '2026-08-25')}T00:00:00Z`).getTime();

// mulberry32 — small, seedable, good enough for shuffling dates.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Posts publish during working hours, not at 3am — the times are cosmetic but
// an implausible one shows up in the byline.
function randomDate() {
  const day = FROM + Math.floor(rand() * ((TO - FROM) / 86400000)) * 86400000;
  const hour = 13 + Math.floor(rand() * 6);   // 13:00–18:59 UTC
  const minute = Math.floor(rand() * 60);
  return new Date(day + hour * 3600000 + minute * 60000);
}

const slugOf = (file) => path.basename(file, '.md');

// Not every post can float freely. A few are anchored to something outside the
// site — an event they discuss in the past tense, a dataset published on a
// known date — or to each other, because one names the other as follow-up
// reading. Randomising through those produces posts that describe the future.
const NOT_BEFORE = {
  // Discusses Google retiring FAQ rich results, in the past tense.
  'structured-data-after-faq-rich-results': '2026-07-01',
  // Cites the 2026 WebAIM Million, published in the spring.
  'wcag-2-2-aa-in-five-minutes': '2026-04-01',
};
// `slug: predecessor` — slug must publish strictly after predecessor.
const AFTER = {
  // Sends the reader to the matrix post as the next thing to read.
  'site-by-service-matrix': 'a-page-per-suburb-for-trades',
  // Supersedes the FAQ-rich-result post it links back to.
  'structured-data-after-faq-rich-results': 'faq-schema-3x-screen-space',
};

const enFiles = (await readdir(EN_DIR))
  .filter((f) => f.endsWith('.md'))
  .sort();
const knownSlugs = new Set(enFiles.map(slugOf));
for (const [slug, before] of Object.entries(AFTER)) {
  if (!knownSlugs.has(slug) || !knownSlugs.has(before)) {
    throw new Error(`AFTER references a slug that does not exist: ${slug} -> ${before}`);
  }
}

// Unique days: two posts sharing a date makes the chronological Issue numbers
// arbitrary and the archive ordering unstable.
function draw() {
  const used = new Set();
  const assignment = new Map();
  for (const file of enFiles) {
    const slug = slugOf(file);
    const floor = NOT_BEFORE[slug] ? new Date(`${NOT_BEFORE[slug]}T00:00:00Z`).getTime() : FROM;
    let date;
    let guard = 0;
    do {
      date = randomDate();
      if (guard++ > 10000) throw new Error(`could not place ${slug} inside the window`);
    } while (used.has(date.toISOString().slice(0, 10)) || date.getTime() < floor);
    used.add(date.toISOString().slice(0, 10));
    assignment.set(slug, date);
  }
  return assignment;
}

let assignment;
for (let attempt = 1; ; attempt++) {
  assignment = draw();
  const ok = Object.entries(AFTER)
    .every(([slug, before]) => assignment.get(slug) > assignment.get(before));
  if (ok) break;
  if (attempt > 500) throw new Error('ordering constraints could not be satisfied');
}

// Issue numbers run oldest → newest.
const chronological = [...assignment.entries()].sort((a, b) => a[1] - b[1]);
const issueNo = new Map(chronological.map(([slug], i) => [slug, i + 1]));

// --- frontmatter ------------------------------------------------------------

// Rewrites one top-level scalar key inside the frontmatter block only, so a
// `date:` appearing in body prose is never touched.
function setFrontmatterKey(text, key, value) {
  const end = text.indexOf('\n---', 3);
  if (!text.startsWith('---') || end < 0) throw new Error('no frontmatter block');
  const head = text.slice(0, end);
  const tail = text.slice(end);
  const re = new RegExp(`^${key}:.*$`, 'm');
  if (!re.test(head)) return null;
  return head.replace(re, `${key}: ${value}`) + tail;
}

async function stampPost(dir, slug, date) {
  const file = path.join(dir, `${slug}.md`);
  if (!existsSync(file)) return false;
  const text = await readFile(file, 'utf8');
  let next = setFrontmatterKey(text, 'date', date.toISOString());
  if (next === null) throw new Error(`${file}: no date: key`);
  // `updated:` must not predate publication.
  const withUpdated = setFrontmatterKey(next, 'updated', date.toISOString());
  if (withUpdated !== null) next = withUpdated;
  if (!DRY) await writeFile(file, next);
  return true;
}

let stamped = 0;
let mirrored = 0;
for (const [slug, date] of chronological) {
  await stampPost(EN_DIR, slug, date);
  stamped++;
  // The Korean set mirrors English slugs; keep the pair on one date.
  if (await stampPost(KO_DIR, slug, date)) mirrored++;
}

// --- card artwork -----------------------------------------------------------

// Every card carries `Issue Nº NN · <label>` in its top strip. The label is a
// month for date-led cards and a topic for the rest; both get renumbered, and
// a month label is refreshed to the post's new month.
const ISSUE_RE = /(Issue Nº\s*)(\d+)(\s*·\s*)([^<]*)/;
const MONTH_LABEL_RE = new RegExp(`^\\s*(${MONTHS.join('|')})\\s+\\d{4}\\s*$`);

let cardsTouched = 0;
const cardFiles = existsSync(CARDS_DIR)
  ? (await readdir(CARDS_DIR)).filter((f) => f.endsWith('.html'))
  : [];

for (const file of cardFiles) {
  const slug = path.basename(file, '.html').replace(/-dark$/, '');
  const date = assignment.get(slug);
  if (!date) continue;
  const p = path.join(CARDS_DIR, file);
  const html = await readFile(p, 'utf8');
  const match = html.match(ISSUE_RE);
  if (!match) continue;
  const label = MONTH_LABEL_RE.test(match[4])
    ? `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
    : match[4];
  const next = html.replace(ISSUE_RE, `$1${issueNo.get(slug)}$3${label}`);
  if (next !== html) {
    if (!DRY) await writeFile(p, next);
    cardsTouched++;
  }
}

for (const [slug, date] of chronological) {
  console.log(
    `${String(issueNo.get(slug)).padStart(2)}  ${date.toISOString().slice(0, 10)}  ${slug}`
  );
}
console.log(
  `\n${stamped} posts stamped, ${mirrored} Korean mirrors synced, ` +
  `${cardsTouched} cards renumbered${DRY ? ' (dry run — nothing written)' : ''}.`
);
if (!DRY && cardsTouched) {
  console.log('Re-render the cards so the artwork matches: node scripts/render-card-local.mjs --all-existing');
}
