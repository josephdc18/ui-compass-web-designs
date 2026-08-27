import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const ROOTS = ['src/blog', 'src/ko/blog'];
const BLOCK_STATUSES = new Set([401, 403, 406, 418, 429, 503]);

// Hosts that refuse a non-browser client. The value is the set of statuses to
// treat as "blocked, not broken" for that host — most serve a normal refusal
// code, but Google's help centre answers a bot with a plain 404, so it needs
// 404 tolerated for that host and nowhere else.
const BOT_BLOCK_ALLOWLIST = new Map([
  ['w3.org', BLOCK_STATUSES],
  ['www.w3.org', BLOCK_STATUSES],
  ['irs.gov', BLOCK_STATUSES],
  ['www.irs.gov', BLOCK_STATUSES],
  ['support.google.com', new Set([...BLOCK_STATUSES, 404])],
]);

// icann.org routinely takes more than 15s to answer a HEAD.
const TIMEOUT_MS = 30_000;
const CONCURRENCY = 6;

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(directory, entry.name));
}

async function collectSources() {
  const files = (await Promise.all(ROOTS.map(markdownFiles))).flat();
  const sources = new Map();
  const malformed = [];

  for (const file of files) {
    const { data } = matter(await readFile(file, 'utf8'));
    if (!Array.isArray(data.sources)) continue;

    data.sources.forEach((source, index) => {
      const label = typeof source?.label === 'string' ? source.label.trim() : '';
      const url = typeof source?.url === 'string' ? source.url.trim() : '';
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        parsed = null;
      }

      if (!label || !parsed || parsed.protocol !== 'https:') {
        malformed.push(`${file} sources[${index}] must have a label and an absolute https URL`);
        return;
      }

      if (!sources.has(url)) sources.set(url, []);
      sources.get(url).push(`${file} (${label})`);
    });
  }

  return { sources, malformed };
}

async function request(url, method) {
  let response;
  try {
    response = await fetch(url, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'user-agent': 'UI-Compass-Source-Checker/1.0 (+https://uicompass.com)',
        accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
      },
    });
  } catch (error) {
    // Some hosts (icann.org among them) accept the HEAD connection and then
    // never answer it, while the same URL responds fine to GET. Treat a failed
    // HEAD as inconclusive rather than as a dead link.
    if (method === 'HEAD') return request(url, 'GET');
    throw error;
  }

  if (method === 'HEAD' && (response.status === 405 || response.status === 501)) {
    return request(url, 'GET');
  }

  return response;
}

async function check(url, references) {
  const host = new URL(url).hostname.toLowerCase();
  const tolerated = BOT_BLOCK_ALLOWLIST.get(host);
  const allowlisted = Boolean(tolerated);

  try {
    const response = await request(url, 'HEAD');
    if (response.ok) {
      return { kind: 'ok', url, status: response.status, finalUrl: response.url, references };
    }
    if (allowlisted && tolerated.has(response.status)) {
      return { kind: 'allowlisted', url, status: response.status, finalUrl: response.url, references };
    }
    return { kind: 'failed', url, status: response.status, finalUrl: response.url, references };
  } catch (error) {
    if (allowlisted) {
      return { kind: 'allowlisted', url, error: error.message, references };
    }
    return { kind: 'failed', url, error: error.message, references };
  }
}

async function inBatches(entries) {
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < entries.length) {
      const current = entries[cursor++];
      results.push(await check(current[0], current[1]));
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker));
  return results;
}

const { sources, malformed } = await collectSources();
const results = await inBatches([...sources.entries()]);

for (const message of malformed) console.error(`[source-check] INVALID ${message}`);

for (const result of results.sort((a, b) => a.url.localeCompare(b.url))) {
  const redirect = result.finalUrl && result.finalUrl !== result.url ? ` -> ${result.finalUrl}` : '';
  const detail = result.status ? `${result.status}` : result.error;
  if (result.kind === 'ok') {
    console.log(`[source-check] OK ${detail} ${result.url}${redirect}`);
  } else if (result.kind === 'allowlisted') {
    console.warn(`[source-check] ALLOWLISTED ${detail} ${result.url}${redirect}`);
  } else {
    console.error(`[source-check] FAILED ${detail} ${result.url}${redirect}`);
    for (const reference of result.references) console.error(`  used by ${reference}`);
  }
}

const failed = malformed.length + results.filter((result) => result.kind === 'failed').length;
console.log(
  `[source-check] Checked ${sources.size} unique URL${sources.size === 1 ? '' : 's'}; ` +
    `${results.filter((result) => result.kind === 'allowlisted').length} allowlisted; ${failed} failed.`,
);

if (failed) process.exitCode = 1;
