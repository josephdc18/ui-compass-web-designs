#!/usr/bin/env node
// Walks every text-ish source file in scope and records which image basenames
// are referenced anywhere. Diffs against the actual contents of
// src/assets/images/ and writes orphans to scripts/orphan-images.txt.
//
// Exclusion rules:
//   1. Any *.png matching <slug>-card.webp or <slug>-dark-card.webp — eleventy-img
//      shortcode auto-discovers dark siblings (.eleventy.js:115-118).
//   2. Anything under src/assets/images/uploads/ — Decap CMS media folder.
//   3. src/assets/images/_sources.json is EXCLUDED from the haystack — it lists
//      every local image filename so including it would mark every image as
//      referenced. It is read separately, for origin-slug grouping only.
//   4. After filename-only orphan determination, run an origin-slug pass: if a
//      candidate orphan shares its `_sources.json` origin slug with another
//      file that IS referenced, demote it back to "protected". This catches
//      <picture> blocks whose AVIF/WebP/JPEG variants have different hashed
//      local filenames but were sourced from the same origin image — deleting
//      the unreferenced fallback would break the in-use <source srcset>.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const IMAGES_DIR = path.join(ROOT, 'src/assets/images');
const SOURCES_JSON = path.join(IMAGES_DIR, '_sources.json');

// Directories to scan for references. The whole repo minus node_modules and
// build output so we don't miss anything.
const SCAN_DIRS = [
  'src',
  'public/admin',     // Decap config + any custom files
  'database',
  'functions',
  'content-kit',
  'scripts',
  '_reference',
  '.eleventy.js',
];

// File extensions whose content we'll grep for image basenames.
const TEXT_EXTS = new Set([
  '.html', '.htm', '.njk', '.md', '.markdown',
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.css', '.scss',
  '.json', '.yml', '.yaml', '.xml', '.svg',
  '.txt',
]);

function walk(dir, hits) {
  let stat;
  try { stat = fs.statSync(dir); } catch { return; }
  if (stat.isFile()) {
    // Exclude _sources.json — see comment block above.
    if (path.resolve(dir) === SOURCES_JSON) return;
    const ext = path.extname(dir).toLowerCase();
    if (TEXT_EXTS.has(ext)) hits.push(dir);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === '.cache') continue;
    walk(path.join(dir, ent.name), hits);
  }
}

const files = [];
for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);

// Concatenate every text source into one big string for substring matching.
// Using a single haystack is much faster than running ripgrep N times.
let haystack = '';
for (const f of files) {
  try { haystack += '\n' + fs.readFileSync(f, 'utf8'); } catch { /* binary */ }
}

const allImages = fs.readdirSync(IMAGES_DIR).filter((n) => {
  const ext = path.extname(n).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg'].includes(ext);
});

// --- Origin-slug grouping (extra safety) ----------------------------------
// Build a Map<localFilename, originSlug> from _sources.json so we can detect
// "this orphan candidate has a sibling that IS referenced". Origin slug rules:
//   - URL basename, drop extension.
//   - Strip a trailing -[a-f0-9]{8,} hash only if it matches that exact shape.
//     (Don't blindly strip after the last hyphen; "phone-green" stays "phone-green".)

function originSlugFromUrl(url) {
  try {
    const u = new URL(url);
    const base = path.basename(u.pathname);
    const noExt = base.replace(/\.[^.]+$/, '');
    return noExt.replace(/-[a-f0-9]{8,}$/i, '');
  } catch {
    return null;
  }
}

const filenameToSlug = new Map();   // local basename -> slug
const slugToFilenames = new Map();  // slug -> Set<basename>
if (fs.existsSync(SOURCES_JSON)) {
  const sources = JSON.parse(fs.readFileSync(SOURCES_JSON, 'utf8'));
  for (const [localPath, entry] of Object.entries(sources)) {
    const basename = path.basename(localPath);
    const slug = originSlugFromUrl(entry?.origin || '');
    if (!slug) continue;
    filenameToSlug.set(basename, slug);
    if (!slugToFilenames.has(slug)) slugToFilenames.set(slug, new Set());
    slugToFilenames.get(slug).add(basename);
  }
}

// --- First pass: filename-only orphan determination -----------------------
const orphanCandidates = [];
const referenced = [];
const protectedByCard = [];
const protectedByUpload = [];

for (const name of allImages) {
  // CMS uploads exclusion.
  if (name.startsWith('uploads/')) { protectedByUpload.push(name); continue; }

  // *-card / *-dark-card exclusion. eleventy-img discovers dark siblings
  // automatically; if the light version is referenced anywhere, exclude the
  // dark too.
  const base = name.replace(/\.[^.]+$/, '');
  if (/-card$|-dark-card$/.test(base)) {
    const lightBase = base.replace(/-dark-card$/, '-card');
    if (haystack.includes(lightBase)) { protectedByCard.push(name); continue; }
  }

  // Default reference check: filename appears anywhere in source text.
  if (haystack.includes(name)) {
    referenced.push(name);
  } else {
    orphanCandidates.push(name);
  }
}

// --- Second pass: origin-slug safety -------------------------------------
// If any orphan candidate shares its slug with a file that IS referenced,
// keep it. This protects <picture> blocks whose siblings have different
// hashed local filenames but came from the same origin source.
const orphans = [];
const protectedBySlug = [];

const referencedSet = new Set(referenced);

for (const name of orphanCandidates) {
  const slug = filenameToSlug.get(name);
  if (!slug) {
    // Not in _sources.json (or no origin) — purely filename-based decision.
    orphans.push(name);
    continue;
  }
  const siblings = slugToFilenames.get(slug) || new Set();
  let siblingReferenced = false;
  for (const sib of siblings) {
    if (sib === name) continue;
    if (referencedSet.has(sib)) { siblingReferenced = true; break; }
  }
  if (siblingReferenced) {
    protectedBySlug.push(name);
  } else {
    orphans.push(name);
  }
}

// Output the deletion list. Each line is a relative path so it can be piped
// straight to scripts/delete-orphan-images.mjs after review.
const outPath = path.join(ROOT, 'scripts/orphan-images.txt');
fs.writeFileSync(
  outPath,
  orphans.map((n) => `src/assets/images/${n}`).join('\n') + '\n',
);

// Stats.
console.log(`Total images in src/assets/images/: ${allImages.length}`);
console.log(`Referenced anywhere in source:       ${referenced.length}`);
console.log(`Protected by *-card pattern:         ${protectedByCard.length}`);
console.log(`Protected by uploads/ folder:        ${protectedByUpload.length}`);
console.log(`Protected by origin-slug grouping:   ${protectedBySlug.length}`);
console.log(`Orphan candidates for deletion:      ${orphans.length}`);
console.log(``);
console.log(`Wrote candidate list to: ${path.relative(ROOT, outPath)}`);

// Size impact estimate.
let bytes = 0;
for (const n of orphans) {
  try { bytes += fs.statSync(path.join(IMAGES_DIR, n)).size; } catch {}
}
const mb = (bytes / 1024 / 1024).toFixed(2);
console.log(`Estimated disk reclaim:              ${mb} MB`);
