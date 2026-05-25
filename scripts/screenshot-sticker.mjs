#!/usr/bin/env node
/**
 * Sticker build pipeline.
 *
 * Input:
 *   content-kit/sticker.html       — design source (1575×825 incl. 0.125" bleed)
 *   src/assets/logo-on-dark.svg    — inner paths substituted in place of the
 *                                    LOGO_INLINE marker so the halo filter
 *                                    can dilate the actual letterforms.
 *
 * Outputs (under content-kit/):
 *   sticker.png            — print-ready raster @ 300 DPI, transparent bg.
 *                            The visible artwork's outer edge IS the cut.
 *   sticker.pdf            — same as PDF for printer upload (5.25" × 2.75")
 *
 * Cut: contour cut around the UIC + WEB DESIGNS silhouette.
 * The 28px accent-green halo around the artwork doubles as visible
 * border and bleed margin, so the printer's contour cut never reveals
 * white paper.
 */
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HTML_PATH = resolve(ROOT, "content-kit/sticker.html");
const LOGO_PATH = resolve(ROOT, "src/assets/logo-on-dark.svg");
const OUT_DIR = resolve(ROOT, "content-kit");

function loadLogoInner() {
  if (!existsSync(LOGO_PATH)) return null;
  const raw = readFileSync(LOGO_PATH, "utf8");
  // Strip the outer <svg> wrapper so the paths can be nested inside our
  // own <svg> with its own viewBox.
  const match = raw.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/i);
  return match ? match[1] : null;
}

// Split the logo SVG's <path> elements into two buckets keyed by fill:
//   greens  — outer letter shapes + dark depth-shading paths. These go
//             inside the halo group; feMorphology dilates them to form
//             the accent-green silhouette ring around the UIC mark.
//             All green shades are recolored to bg-green so the letter
//             bodies read as one solid dark-green mass.
//   creams  — the cream "shadow cut" highlights that trace the inner
//             edges of the U/I/C. These are rendered ON TOP of the halo
//             group, NOT included as halo sources — so the accent halo
//             can't notch inward where the cream details are.
const GREEN_SHADES = /#(?:43925c|41915a|3d9157|33864b|33844a|39894f|3e9358|45945e|2f8044|2f7f43|328746)/gi;
const CREAM_SHADE = /#fafbfc/i;

function splitLogoPaths(inner) {
  const tags = inner.match(/<path\b[^>]*\/?>/g) || [];
  const greens = [];
  const creams = [];
  for (const tag of tags) {
    if (CREAM_SHADE.test(tag)) {
      creams.push(tag);
    } else {
      greens.push(tag.replace(GREEN_SHADES, "#0a5f3a"));
    }
  }
  return { greens: greens.join("\n"), creams: creams.join("\n") };
}

function inlineLogo(html) {
  const inner = loadLogoInner();
  if (!inner) return html;
  const { greens, creams } = splitLogoPaths(inner);
  return html
    .replace(/<!--\s*GREEN_LOGO_INLINE\s*-->/, greens)
    .replace(/<!--\s*CREAM_LOGO_INLINE\s*-->/, creams);
}

function loadDevVars() {
  const path = resolve(ROOT, ".dev.vars");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDevVars();

const TOKEN = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
const BASE = process.env.BROWSERLESS_URL || "https://chrome.browserless.io";
if (!TOKEN) {
  console.error("Missing BROWSERLESS_API_KEY in .dev.vars.");
  process.exit(1);
}

async function blScreenshot(html) {
  const res = await fetch(`${BASE}/screenshot?token=${encodeURIComponent(TOKEN)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      options: { type: "png", fullPage: false, omitBackground: true },
      viewport: { width: 1575, height: 825, deviceScaleFactor: 1 },
      gotoOptions: { waitUntil: "networkidle0" },
      waitForTimeout: 1500,
    }),
  });
  if (!res.ok) {
    throw new Error(`Browserless screenshot ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function blPdf(html) {
  const res = await fetch(`${BASE}/pdf?token=${encodeURIComponent(TOKEN)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      options: {
        width: "5.25in",
        height: "2.75in",
        printBackground: true,
        margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" },
        preferCSSPageSize: false,
      },
      gotoOptions: { waitUntil: "networkidle0" },
      waitForTimeout: 1500,
    }),
  });
  if (!res.ok) {
    throw new Error(`Browserless pdf ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

const html = inlineLogo(await readFile(HTML_PATH, "utf8"));

console.log("→ Rendering sticker.png (print artwork, transparent bg)");
const printPng = await blScreenshot(html);
await writeFile(resolve(OUT_DIR, "sticker.png"), printPng);
console.log(`  ✓ sticker.png (${(printPng.length / 1024).toFixed(1)} KB)`);

console.log("→ Rendering sticker.pdf (printer upload)");
const pdf = await blPdf(html);
await writeFile(resolve(OUT_DIR, "sticker.pdf"), pdf);
console.log(`  ✓ sticker.pdf (${(pdf.length / 1024).toFixed(1)} KB)`);

console.log("\nAll sticker assets written to content-kit/");
console.log("Cut: contour-cut around the UIC + WEB DESIGNS silhouette.");
console.log("Upload sticker.pdf and tell the printer \"die-cut to artwork contour, bleed already included\".");
