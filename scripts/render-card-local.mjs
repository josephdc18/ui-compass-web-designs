#!/usr/bin/env node
/**
 * Render a blog card locally with the installed Chrome, instead of Browserless.
 *
 * Same contract as scripts/screenshot-blog-card.mjs — reads
 * content-kit/blog-cards/<slug>.html, writes src/assets/images/<slug>-card.webp
 * at 1200x630 @2x — but costs nothing and works offline. The Browserless
 * script stays the canonical path for CI; this is the one to use while
 * iterating on a card design.
 *
 * Usage:
 *   node scripts/render-card-local.mjs <slug> [<slug> ...]
 *   node scripts/render-card-local.mjs --all          # every card missing a PNG
 *   node scripts/render-card-local.mjs --file a.html out.webp [w] [h]
 *
 * CHROME_PATH overrides the browser binary.
 */
import puppeteer from 'puppeteer-core';
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARDS_DIR = path.join(ROOT, 'content-kit/blog-cards');
const OUT_DIR = path.join(ROOT, 'src/assets/images');
const LOGO_PATH = path.join(ROOT, 'content-kit/assets/logo.svg');

const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Mirrors inlineLogo() in screenshot-blog-card.mjs: base64 the brand mark so
// the card renders identically whether it is loaded from disk or posted to a
// remote renderer with no working directory.
const LOGO_DATA_URI = existsSync(LOGO_PATH)
  ? `data:image/svg+xml;base64,${readFileSync(LOGO_PATH).toString('base64')}`
  : null;

function inlineLogo(html) {
  if (!LOGO_DATA_URI) return html;
  return html.replace(/(<img\b[^>]*\bdata-inline-logo\b[^>]*>)/gi, (tag) =>
    tag.replace(/\bsrc=("[^"]*"|'[^']*')/, `src="${LOGO_DATA_URI}"`)
  );
}

async function withBrowser(fn) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb'],
  });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

async function shoot(browser, html, outPath, width, height, baseDir) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  // Write to a scratch file inside the card's own directory and navigate to
  // it, rather than setContent(): a real file:// document is what makes
  // relative asset paths inside the card resolve.
  const scratch = path.join(baseDir, `._render-${process.pid}.html`);
  await writeFile(scratch, html);
  try {
    await page.goto(pathToFileURL(scratch).href, { waitUntil: 'networkidle0', timeout: 60_000 });
  } finally {
    await rm(scratch, { force: true });
  }
  // Webfonts from Google Fonts land after networkidle in some runs.
  await page.evaluate(() => document.fonts.ready);
  // WebP, not PNG. These cards are 2400x1260 renders that feed the eleventy-img
  // pipeline, which re-encodes them to 400/850/1920 webp+jpeg — nothing serves
  // the source. As PNG each one was ~3.1MB and every re-render committed a fresh
  // 3.1MB blob; at quality 92 the same card is ~236KB and the derivative it
  // produces is byte-comparable (34KB vs 31KB at 1920w, visually identical).
  await page.screenshot({ path: outPath, type: 'webp', quality: 92 });
  await page.close();
  console.log(`wrote ${path.relative(ROOT, outPath)}`);
}

const args = process.argv.slice(2);

if (args[0] === '--file') {
  const [, input, output, w = '1200', h = '630'] = args;
  const html = inlineLogo(await readFile(input, 'utf8'));
  await withBrowser((b) =>
    shoot(b, html, path.resolve(output), Number(w), Number(h), path.dirname(path.resolve(input)))
  );
} else {
  let slugs = args.filter((a) => !a.startsWith('--'));
  // --all renders only what is missing (the cheap catch-up after adding a
  // card); --all-existing re-renders everything, which is what you want after
  // editing the shared shell or renumbering the issue lines.
  if (args.includes('--all') || args.includes('--all-existing')) {
    const everything = args.includes('--all-existing');
    const files = await readdir(CARDS_DIR);
    slugs = files
      .filter((f) => f.endsWith('.html'))
      .map((f) => f.replace(/\.html$/, ''))
      .filter((slug) => everything || !existsSync(path.join(OUT_DIR, cardFile(slug))));
  }
  if (!slugs.length) {
    console.error('usage: render-card-local.mjs <slug>... | --all | --all-existing | --file in.html out.webp [w] [h]');
    process.exit(1);
  }
  await withBrowser(async (browser) => {
    for (const slug of slugs) {
      const htmlPath = path.join(CARDS_DIR, `${slug}.html`);
      if (!existsSync(htmlPath)) {
        console.warn(`no card html for ${slug}, skipping`);
        continue;
      }
      const html = inlineLogo(await readFile(htmlPath, 'utf8'));
      await shoot(browser, html, path.join(OUT_DIR, cardFile(slug)), 1200, 630, CARDS_DIR);
    }
  });
}

// "<slug>-dark" renders to "<slug>-dark-card.webp" so the eleventy image
// shortcode's light/dark pairing keeps working.
function cardFile(slug) {
  return slug.endsWith('-dark')
    ? `${slug.replace(/-dark$/, '')}-dark-card.webp`
    : `${slug}-card.webp`;
}
