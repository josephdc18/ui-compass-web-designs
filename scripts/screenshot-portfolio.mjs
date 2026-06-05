#!/usr/bin/env node
/**
 * Screenshot a live URL via Browserless and save it as a portfolio hero.
 *
 * Usage:
 *   BROWSERLESS_API_KEY=xxx node scripts/screenshot-portfolio.mjs <slug> <url>
 *                                                                 [width] [height]
 *
 * Defaults: viewport 1920x1100 @ 2x DPR → 3840x2200. Pass width/height to
 * override (e.g. `... <slug> <url> 1440 900` for a tighter hero crop).
 */
import { writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "src/assets/images");
const DEV_VARS = resolve(ROOT, ".dev.vars");

function loadDevVars() {
  if (!existsSync(DEV_VARS)) return;
  for (const line of readFileSync(DEV_VARS, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#\n]+?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadDevVars();

const TOKEN = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
const BASE = process.env.BROWSERLESS_URL || "https://chrome.browserless.io";

if (!TOKEN) {
  console.error("Missing BROWSERLESS_API_KEY in .dev.vars (or BROWSERLESS_TOKEN env).");
  process.exit(1);
}

async function shoot(slug, url, viewportW, viewportH) {
  const outPath = resolve(OUT_DIR, `${slug}-hero.png`);
  const api = `${BASE}/screenshot?token=${encodeURIComponent(TOKEN)}`;
  const width = Number(viewportW) || 1920;
  const height = Number(viewportH) || 1100;

  // Post-load cleanup: remove first-visit tour modals (e.g. VBC's welcome
   // tour) and any blocked/error overlay from third-party video iframes
   // (Browserless IPs get geo-restricted by some CDNs, leaving an ugly
   // "restricted access" message on top of TC Visuals' hero).
  const cleanupScript = `
    (function () {
      function purge() {
        var sels = [
          '[role="dialog"]', '[aria-modal="true"]',
          '.modal', '.modal-backdrop', '.modal-overlay', '.modal-open',
          '[class*="tour"]', '[class*="Tour"]',
          '[class*="onboarding"]', '[class*="Onboarding"]',
          '[id*="tour"]', '[data-tour]',
          'iframe[src*="vimeo"]', 'iframe[src*="youtube"]',
          'iframe[src*="youtu.be"]', 'iframe[src*="player."]'
        ];
        sels.forEach(function (s) {
          document.querySelectorAll(s).forEach(function (el) { el.remove(); });
        });
        document.documentElement.style.overflow = 'auto';
        if (document.body) document.body.style.overflow = 'auto';
      }
      purge();
      setTimeout(purge, 500);
      setTimeout(purge, 1500);
      setTimeout(purge, 3000);
    })();
  `;

  const body = {
    url,
    options: { type: "png", fullPage: false, omitBackground: false },
    viewport: { width, height, deviceScaleFactor: 2 },
    gotoOptions: { waitUntil: "networkidle2", timeout: 60000 },
    addScriptTag: [{ content: cleanupScript }],
    waitForTimeout: 4000,
  };

  const res = await fetch(api, {
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

const [, , slug, url, w, h] = process.argv;
if (!slug || !url) {
  console.error("Usage: node scripts/screenshot-portfolio.mjs <slug> <url> [width] [height]");
  process.exit(2);
}
shoot(slug, url, w, h).catch((e) => { console.error(e.message); process.exit(1); });
