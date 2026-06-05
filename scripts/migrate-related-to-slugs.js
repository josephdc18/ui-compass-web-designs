#!/usr/bin/env node
/**
 * One-off migration: rewrite blog post `related:` frontmatter from the old
 * `[{ url, title }, ...]` shape to a flat slug array `[pageName, ...]`.
 *
 * The Decap CMS schema uses a `relation` widget (value_field: pageName) that
 * stores picked posts as bare slugs. The Nunjucks layout looks them up via
 * `collections.post` matched on `post.data.pageName == slug`, then pulls
 * image/topper/title/date from the live post data.
 *
 *   Usage:  node scripts/migrate-related-to-slugs.js [--dry-run]
 *
 * Fails loudly if any URL does not resolve to a known pageName. That is better
 * than silently producing dead related-guide links.
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const BLOG_DIRS = ['./src/blog', './src/ko/blog'];
const DRY = process.argv.includes('--dry-run');

process.chdir(path.resolve(__dirname, '..'));

function blogFiles() {
  const files = [];
  for (const dir of BLOG_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith('.md')) files.push(path.join(dir, name));
    }
  }
  return files;
}

function buildPageNameIndex(files) {
  const idx = new Map();
  for (const full of files) {
    const { data } = matter.read(full);
    if (!data.pageName) {
      console.warn(`[warn] ${full} has no pageName - skipping in index`);
      continue;
    }
    const matches = idx.get(data.pageName) || [];
    matches.push(full);
    idx.set(data.pageName, matches);
  }
  return idx;
}

function slugFromUrl(value) {
  if (!value) return null;
  return String(value)
    .replace(/^\/(?:ko\/)?blog\//, '')
    .replace(/\/$/, '')
    .trim();
}

function migrateOne(filePath, pageNameIndex) {
  const parsed = matter.read(filePath);
  const related = parsed.data.related;
  if (!Array.isArray(related) || related.length === 0) return null;

  if (related.every((entry) => typeof entry === 'string')) return null;

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
      errors.push(`  - URL ${entry.url} -> slug "${slug}" matches no existing pageName`);
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
  return { contents: matter.stringify(parsed.content, parsed.data) };
}

function main() {
  const files = blogFiles();
  const pageNameIndex = buildPageNameIndex(files);
  console.log(`[info] indexed ${pageNameIndex.size} posts by pageName`);

  let migrated = 0;
  let unchanged = 0;
  let errored = 0;

  for (const full of files) {
    const result = migrateOne(full, pageNameIndex);
    if (result === null) {
      unchanged++;
      continue;
    }
    if (result.error) {
      errored++;
      continue;
    }
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
