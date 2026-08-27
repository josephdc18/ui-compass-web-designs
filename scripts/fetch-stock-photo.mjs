#!/usr/bin/env node
/**
 * Search Openverse for CC0 stock photography and download candidates for review.
 *
 * Openverse is the Creative Commons search API. We restrict to sources that
 * carry modern, editorially usable stock (StockSnap, Rawpixel, Nappy) and to
 * the CC0 license, so nothing downloaded here carries an attribution
 * obligation. Provenance is still recorded in src/assets/images/_sources.json
 * to match how the rest of the image library is tracked.
 *
 * Usage:
 *   # Fetch candidates into the scratch dir for visual review:
 *   node scripts/fetch-stock-photo.mjs search "laptop workspace" --out /tmp/cand --n 8
 *
 *   # Promote a reviewed candidate into the site image library:
 *   node scripts/fetch-stock-photo.mjs adopt <candidate.json> <slug>
 *
 * The two-step shape is deliberate: search results are not reviewed, and an
 * unreviewed stock photo is not something that should land in src/ by accident.
 */
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES_DIR = path.join(ROOT, 'src/assets/images');
const SOURCES_JSON = path.join(IMAGES_DIR, '_sources.json');

// StockSnap's CDN rejects requests without a browser-shaped UA and referer.
const FETCH_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  referer: 'https://stocksnap.io/',
};

const ALLOWED_SOURCES = 'stocksnap,rawpixel,nappy';

async function search(query, { n = 8, out, source = ALLOWED_SOURCES } = {}) {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.searchParams.set('q', query);
  url.searchParams.set('source', source);
  url.searchParams.set('license', 'cc0');
  url.searchParams.set('page_size', String(n));

  const res = await fetch(url, { headers: { 'user-agent': 'uicompass-image-tool/1.0' } });
  if (!res.ok) throw new Error(`Openverse ${res.status} for "${query}"`);
  const body = await res.json();

  await mkdir(out, { recursive: true });
  const picked = [];

  for (const [i, r] of body.results.entries()) {
    const file = path.join(out, `${slugify(query)}-${i}.jpg`);
    const img = await fetch(r.url, { headers: FETCH_HEADERS });
    if (!img.ok) {
      console.warn(`  skip ${r.url} → ${img.status}`);
      continue;
    }
    const buf = Buffer.from(await img.arrayBuffer());
    // A tiny response is an error page, not a photo.
    if (buf.length < 20_000) {
      console.warn(`  skip ${r.url} → ${buf.length} bytes`);
      continue;
    }
    await writeFile(file, buf);
    const meta = {
      file,
      title: r.title,
      license: r.license,
      licenseUrl: r.license_url,
      creator: r.creator,
      source: r.source,
      origin: r.url,
      landing: r.foreign_landing_url,
    };
    await writeFile(file.replace(/\.jpg$/, '.json'), JSON.stringify(meta, null, 2));
    picked.push(meta);
    console.log(`  ${file}  ${r.title} (${r.source}, ${r.license})`);
  }

  return picked;
}

async function adopt(metaPath, slug) {
  const meta = JSON.parse(await readFile(metaPath, 'utf8'));
  const dest = path.join(IMAGES_DIR, `${slug}-photo.jpg`);
  await writeFile(dest, await readFile(meta.file));

  const sources = existsSync(SOURCES_JSON)
    ? JSON.parse(await readFile(SOURCES_JSON, 'utf8'))
    : {};
  sources[`assets/images/${slug}-photo.jpg`] = {
    origin: meta.origin,
    landingPage: meta.landing,
    creator: meta.creator,
    license: meta.license,
    licenseUrl: meta.licenseUrl,
    provider: meta.source,
    downloadedAt: new Date().toISOString(),
    note: 'CC0 via Openverse. No attribution required; recorded for provenance.',
  };
  await writeFile(SOURCES_JSON, JSON.stringify(sources, null, 2) + '\n');
  console.log(`adopted → ${dest}`);
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'search') {
  const query = rest[0];
  const flag = (name, dflt) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : dflt;
  };
  await search(query, { n: Number(flag('n', 8)), out: flag('out', '/tmp/stock'), source: flag('source', ALLOWED_SOURCES) });
} else if (cmd === 'adopt') {
  await adopt(rest[0], rest[1]);
} else if (cmd === 'batch') {
  // batch <json-file> — [{ query, out }] so one run can gather every topic.
  const jobs = JSON.parse(await readFile(rest[0], 'utf8'));
  for (const job of jobs) {
    console.log(`\n# ${job.query}`);
    await search(job.query, { n: job.n ?? 6, out: job.out });
  }
} else {
  console.error('usage: fetch-stock-photo.mjs search <query> [--n N] [--out DIR] | adopt <meta.json> <slug> | batch <jobs.json>');
  process.exit(1);
}
