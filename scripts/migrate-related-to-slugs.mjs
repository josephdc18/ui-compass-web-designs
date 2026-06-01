#!/usr/bin/env node
/**
 * One-off migration: rewrite blog post `related:` frontmatter from the old
 * `[{ url, title }, …]` shape to a flat slug array `[pageName, …]`.
 *
 * The new Decap CMS schema uses a `relation` widget (value_field: pageName)
 * that stores picked posts as bare slugs. The Nunjucks layout looks them up
 * via `collections.post` matched on `post.data.pageName == slug`, then pulls
 * image/topper/title/date from the live post data.
 *
 *   Usage:  node scripts/migrate-related-to-slugs.mjs [--dry-run]
 *
 * Fails loudly if any URL doesn't resolve to a known pageName — better to
 * surface the broken link now than ship a silent dead reference.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import matter from 'gray-matter';

// EN-only. The Decap blog collection (src/admin/config.yml) targets
// src/blog/ exclusively, so the new relation widget can only pick EN posts
// — and the Nunjucks layout matches `collections.post` (EN-tagged) by
// pageName. KO posts are translated standalones with no `related:` field.
const BLOG_DIR = './src/blog';
const DRY = process.argv.includes('--dry-run');

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
process.chdir(path.resolve(__dirname, '..'));

function buildPageNameIndex() {
  const idx = new Map();
  for (const name of fs.readdirSync(BLOG_DIR)) {
    if (!name.endsWith('.md')) continue;
    const full = path.join(BLOG_DIR, name);
    const { data } = matter.read(full);
    if (!data.pageName) {
      console.warn(`[warn] ${full} has no pageName — skipping in index`);
      continue;
    }
    if (idx.has(data.pageName)) {
      console.error(`[error] duplicate pageName "${data.pageName}" in ${full} and ${idx.get(data.pageName)}`);
      process.exit(1);
    }
    idx.set(data.pageName, full);
  }
  return idx;
}

/** Strip `/blog/` prefix and trailing `/` to extract slug from URL. */
function slugFromUrl(u) {
  if (!u) return null;
  return String(u).replace(/^\/(?:ko\/)?blog\//, '').replace(/\/$/, '').trim();
}

function migrateOne(filePath, pageNameIndex) {
  const parsed = matter.read(filePath);
  const related = parsed.data.related;
  if (!Array.isArray(related) || related.length === 0) return null;

  // Already migrated? — every entry is a string.
  if (related.every((r) => typeof r === 'string')) return null;

  const newRelated = [];
  const errors = [];
  for (const entry of related) {
    if (typeof entry === 'string') {
      newRelated.push(entry);
      continue;
    }
    const slug = slugFromUrl(entry && entry.url);
    if (!slug) {
      errors.push(`  - entry has no resolvable URL: ${JSON.stringify(entry)}`);
      continue;
    }
    if (!pageNameIndex.has(slug)) {
      errors.push(`  - URL ${entry.url} → slug "${slug}" matches no existing pageName`);
      continue;
    }
    newRelated.push(slug);
  }

  if (errors.length > 0) {
    console.error(`[error] ${filePath}:`);
    for (const e of errors) console.error(e);
    return { error: true };
  }

  parsed.data.related = newRelated;
  const out = matter.stringify(parsed.content, parsed.data);
  return { contents: out };
}

function main() {
  const pageNameIndex = buildPageNameIndex();
  console.log(`[info] indexed ${pageNameIndex.size} posts by pageName`);

  let migrated = 0;
  let unchanged = 0;
  let errored = 0;
  for (const name of fs.readdirSync(BLOG_DIR)) {
    if (!name.endsWith('.md')) continue;
    const full = path.join(BLOG_DIR, name);
    const result = migrateOne(full, pageNameIndex);
    if (result === null) { unchanged++; continue; }
    if (result.error) { errored++; continue; }
    if (DRY) {
      console.log(`[dry-run] would migrate ${full}`);
      migrated++;
    } else {
      fs.writeFileSync(full, result.contents);
      console.log(`[ok] migrated ${full}`);
      migrated++;
    }
  }

  console.log(`\n[summary] migrated ${migrated}, unchanged ${unchanged}, errored ${errored}`);
  if (errored > 0) process.exit(1);
}

main();
