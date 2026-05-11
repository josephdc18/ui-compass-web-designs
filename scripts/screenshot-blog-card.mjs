#!/usr/bin/env node
/**
 * Screenshot a blog card via Browserless.
 *
 * Usage:
 *   BROWSERLESS_TOKEN=xxx node scripts/screenshot-blog-card.mjs <slug>
 *   # or all cards that don't yet have an image:
 *   BROWSERLESS_TOKEN=xxx node scripts/screenshot-blog-card.mjs --all
 *
 * Reads:  content-kit/blog-cards/<slug>.html
 * Writes: src/assets/images/<slug>-card.png
 *
 * Browserless docs: https://docs.browserless.io/HTTP-APIs/screenshot
 * Endpoint override: set BROWSERLESS_URL (default https://chrome.browserless.io).
 */
import { readFile, writeFile, readdir, access } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CARDS_DIR = resolve(ROOT, "content-kit/blog-cards");
const OUT_DIR = resolve(ROOT, "src/assets/images");
const LOGO_PATH = resolve(ROOT, "content-kit/assets/logo.svg");

const LOGO_DATA_URI = (() => {
  if (!existsSync(LOGO_PATH)) return null;
  const b64 = readFileSync(LOGO_PATH).toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
})();

// Replace any <img ... data-inline-logo> src with the inlined data URI so the
// HTML works both locally (relative path to ../assets/logo.svg) and via
// Browserless (which has no working directory to resolve relative URLs).
function inlineLogo(html) {
  if (!LOGO_DATA_URI) return html;
  return html.replace(
    /(<img\b[^>]*\bdata-inline-logo\b[^>]*>)/gi,
    (tag) => tag.replace(/\bsrc=("[^"]*"|'[^']*')/, `src="${LOGO_DATA_URI}"`)
  );
}

// Load .dev.vars (Wrangler-style KEY=VALUE file) into process.env if not already set.
function loadDevVars() {
  const path = resolve(ROOT, ".dev.vars");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDevVars();

const TOKEN = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
const BASE = process.env.BROWSERLESS_URL || "https://chrome.browserless.io";

if (!TOKEN) {
  console.error("Missing BROWSERLESS_API_KEY in .dev.vars (or BROWSERLESS_TOKEN env).");
  process.exit(1);
}

async function shoot(slug) {
  const htmlPath = resolve(CARDS_DIR, `${slug}.html`);
  const outPath = resolve(OUT_DIR, `${slug}-card.png`);
  const html = inlineLogo(await readFile(htmlPath, "utf8"));

  const url = `${BASE}/screenshot?token=${encodeURIComponent(TOKEN)}`;
  const body = {
    html,
    options: { type: "png", fullPage: false, omitBackground: false },
    viewport: { width: 1200, height: 630, deviceScaleFactor: 2 },
    gotoOptions: { waitUntil: "networkidle0" },
    waitForTimeout: 800,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browserless ${res.status}: ${text.slice(0, 400)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buf);
  console.log(`✓ ${slug} → ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

const args = process.argv.slice(2);
let slugs = [];

if (args[0] === "--all") {
  const files = await readdir(CARDS_DIR);
  for (const f of files) {
    if (!f.endsWith(".html")) continue;
    const slug = basename(f, ".html");
    if (await exists(resolve(OUT_DIR, `${slug}-card.png`))) continue;
    slugs.push(slug);
  }
} else if (args.length) {
  slugs = args.map((s) => s.replace(/\.html$/, ""));
} else {
  console.error("Usage: node scripts/screenshot-blog-card.mjs <slug> | --all");
  process.exit(1);
}

for (const slug of slugs) {
  try { await shoot(slug); }
  catch (err) { console.error(`✗ ${slug}: ${err.message}`); process.exitCode = 1; }
}
