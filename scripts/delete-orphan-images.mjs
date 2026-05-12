#!/usr/bin/env node
// Applies the deletion list produced by scripts/find-orphan-images.mjs.
//   1. Reads scripts/orphan-images.txt (one path per line).
//   2. Verifies each path is under src/assets/images/ (defensive — refuses
//      to touch anything outside that directory).
//   3. Without --apply, prints a summary and exits (dry-run is the default).
//   4. With --apply, deletes each orphan file and prunes its matching entry
//      from src/assets/images/_sources.json. Writes the JSON back with stable
//      key ordering so diffs stay readable.
//
// Usage:
//   node scripts/delete-orphan-images.mjs              # dry-run (default)
//   node scripts/delete-orphan-images.mjs --apply      # actually delete

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const LIST_PATH = path.join(ROOT, 'scripts/orphan-images.txt');
const IMAGES_DIR = path.join(ROOT, 'src/assets/images');
const SOURCES_JSON = path.join(IMAGES_DIR, '_sources.json');
const APPLY = process.argv.includes('--apply');

if (!fs.existsSync(LIST_PATH)) {
  console.error(`Missing ${path.relative(ROOT, LIST_PATH)}. Run find-orphan-images.mjs first.`);
  process.exit(1);
}

const lines = fs.readFileSync(LIST_PATH, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

if (lines.length === 0) {
  console.log('Kill list is empty — nothing to delete.');
  process.exit(0);
}

// Safety gate: every entry must resolve under src/assets/images/.
const targets = [];
const invalid = [];
for (const rel of lines) {
  const abs = path.resolve(ROOT, rel);
  if (!abs.startsWith(IMAGES_DIR + path.sep)) {
    invalid.push(rel);
    continue;
  }
  targets.push({ rel, abs, basename: path.basename(rel) });
}

if (invalid.length) {
  console.error('Refusing to delete paths outside src/assets/images/:');
  for (const r of invalid) console.error(`  ${r}`);
  process.exit(1);
}

// Stats before mutation.
let totalBytes = 0;
let missing = 0;
for (const t of targets) {
  try { totalBytes += fs.statSync(t.abs).size; }
  catch { missing++; }
}

console.log(`Kill list contains:           ${targets.length} files`);
console.log(`Already missing on disk:      ${missing}`);
console.log(`Total disk to reclaim:        ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(``);

// Pre-compute the _sources.json pruning. Keys in that file are of the form
// "assets/images/<basename>" (no leading slash). Build a Set of basenames
// being removed so we can drop matching entries.
const removedBasenames = new Set(targets.map((t) => t.basename));
const sources = fs.existsSync(SOURCES_JSON)
  ? JSON.parse(fs.readFileSync(SOURCES_JSON, 'utf8'))
  : null;

let prunedEntries = 0;
if (sources) {
  for (const key of Object.keys(sources)) {
    if (removedBasenames.has(path.basename(key))) prunedEntries++;
  }
}
console.log(`_sources.json entries to prune: ${prunedEntries}`);
console.log(``);

if (!APPLY) {
  console.log('Dry run — no changes made. Re-run with --apply to delete.');
  console.log('Sample of the first 10 kill targets:');
  for (const t of targets.slice(0, 10)) console.log(`  ${t.rel}`);
  process.exit(0);
}

// --- Apply ---------------------------------------------------------------
let deleted = 0;
for (const t of targets) {
  try {
    fs.unlinkSync(t.abs);
    deleted++;
  } catch (err) {
    if (err && err.code === 'ENOENT') continue;
    console.error(`Failed to delete ${t.rel}: ${err.message}`);
  }
}

let prunedFinal = 0;
if (sources) {
  for (const key of Object.keys(sources)) {
    if (removedBasenames.has(path.basename(key))) {
      delete sources[key];
      prunedFinal++;
    }
  }
  // Keep keys sorted so the diff is stable across runs.
  const sortedKeys = Object.keys(sources).sort();
  const ordered = {};
  for (const k of sortedKeys) ordered[k] = sources[k];
  fs.writeFileSync(SOURCES_JSON, JSON.stringify(ordered, null, 2) + '\n');
}

console.log(`Deleted files:                  ${deleted}`);
console.log(`Pruned _sources.json entries:   ${prunedFinal}`);
console.log(``);
console.log('Done. Recommended next steps:');
console.log('  1. git status                # confirm only deletions + _sources.json edit');
console.log('  2. npm run build             # confirm no "image not found" warnings');
console.log('  3. commit deletions separately from the shortcode conversion');
