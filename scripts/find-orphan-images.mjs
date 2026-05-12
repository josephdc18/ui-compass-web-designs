#!/usr/bin/env node
// Walks every text-ish source file in scope and records which image basenames
// are referenced anywhere. Diffs against the actual contents of
// src/assets/images/ and writes orphans to scripts/orphan-images.txt.
//
// Exclusion rules:
//   1. Any *.png matching <slug>-card.png or <slug>-dark-card.png — eleventy-img
//      shortcode auto-discovers dark siblings (.eleventy.js:115-118).
//   2. Anything under src/assets/images/uploads/ — Decap CMS media folder.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const IMAGES_DIR = path.join(ROOT, 'src/assets/images');

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

const orphans = [];
const referenced = [];
const protectedByCard = [];
const protectedByUpload = [];

for (const name of allImages) {
  // CMS uploads exclusion (none exist yet but kept for future-proofing).
  if (name.startsWith('uploads/')) { protectedByUpload.push(name); continue; }

  // *-card / *-dark-card exclusion. eleventy-img discovers dark siblings
  // automatically; if the light version is referenced anywhere, exclude the
  // dark too. We approximate by always excluding both.
  const base = name.replace(/\.[^.]+$/, '');
  if (/-card$|-dark-card$/.test(base)) {
    const lightBase = base.replace(/-dark-card$/, '-card');
    if (haystack.includes(lightBase)) { protectedByCard.push(name); continue; }
  }

  // Default reference check: filename appears anywhere in source text.
  if (haystack.includes(name)) {
    referenced.push(name);
  } else {
    orphans.push(name);
  }
}

// Output the deletion list. Each line is a relative path so it can be piped
// straight to `git rm` after review.
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
