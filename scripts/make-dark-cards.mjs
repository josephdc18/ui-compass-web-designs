#!/usr/bin/env node
/**
 * Transforms each light card HTML into a dark sibling at <slug>-dark.html.
 * Pure text substitution — color vars, background gradients, grain blend
 * mode, brand-mark filter, phone-frame fill, drop-shadow alpha.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CARDS_DIR = resolve(ROOT, "content-kit/blog-cards");

// Ordered substitutions. First match wins, so put more-specific patterns first.
const SUBS = [
  // === :root color variables ===
  [/--bg-1:#f7f2ea/g, "--bg-1:#0d1411"],
  [/--bg-2:#efe7d8/g, "--bg-2:#1a221d"],
  [/--cream-deep:#d6c4a8/g, "--cream-deep:rgba(250,251,252,0.30)"],
  [/--cream:#e6d9c7/g, "--cream:#2a2e25"],
  [/--primary:#006940/g, "--primary:#00bd74"],
  [/--primary-l:#00bd74/g, "--primary-l:#006940"],
  [/--header:#1f1c19/g, "--header:#fafbfc"],
  [/--body:#4e4b66/g, "--body:rgba(250,251,252,0.75)"],
  [/--muted:#8a8474/g, "--muted:rgba(250,251,252,0.45)"],
  [/--hairline:rgba\(31,28,25,0\.22\)/g, "--hairline:rgba(250,251,252,0.20)"],
  [/--line-soft:rgba\(31,28,25,0\.10\)/g, "--line-soft:rgba(250,251,252,0.08)"],
  [/--line-soft:rgba\(31,28,25,0\.12\)/g, "--line-soft:rgba(250,251,252,0.10)"],
  [/--paper:#fdfaf3/g, "--paper:#1c2520"],   // audit-pad bg → dark green-tinted

  // === Card background gradients ===
  [/rgba\(0,105,64,0\.10\)/g, "rgba(0,189,116,0.16)"],
  [/rgba\(230,217,199,0\.55\)/g, "rgba(0,189,116,0.06)"],

  // === Grain SVG ===
  [/mix-blend-mode: multiply; opacity: 0\.18/g, "mix-blend-mode: screen; opacity: 0.10"],
  [
    /feColorMatrix values="0 0 0 0 0\.13  0 0 0 0 0\.11  0 0 0 0 0\.09  0 0 0 0\.55 0"/g,
    'feColorMatrix values="0 0 0 0 0.95  0 0 0 0 0.96  0 0 0 0 0.98  0 0 0 0.45 0"',
  ],

  // === Brand mark logo — invert to white ===
  [
    /\.brand-mark \{ width: 36px; height: 36px; flex: none; display: block; \}/g,
    ".brand-mark { width: 36px; height: 36px; flex: none; display: block; filter: brightness(0) invert(1); opacity: 0.92; }",
  ],

  // === Anatomy phone drop-shadow → deeper ===
  [
    /filter: drop-shadow\(0 18px 36px rgba\(31,28,25,0\.18\)\)/g,
    "filter: drop-shadow(0 22px 44px rgba(0,0,0,0.55))",
  ],

  // === Anatomy phone frame fill ===
  [
    /<rect x="0" y="0" width="180" height="360" rx="26" fill="#1f1c19"\/>/g,
    '<rect x="0" y="0" width="180" height="360" rx="26" fill="#3a3530"/>',
  ],
  [
    /<rect x="5" y="5" width="170" height="350" rx="22" fill="#0e0d0a"\/>/g,
    '<rect x="5" y="5" width="170" height="350" rx="22" fill="#1a1814"/>',
  ],
  [
    /<rect x="68" y="5" width="44" height="11" rx="5\.5" fill="#1f1c19"\/>/g,
    '<rect x="68" y="5" width="44" height="11" rx="5.5" fill="#1a1814"/>',
  ],

  // === Comparison .col.l / .col.r muted bg → lighter alpha on dark ===
  [/rgba\(31,28,25,0\.04\)/g, "rgba(250,251,252,0.04)"],
  [/rgba\(31,28,25,0\.22\)/g, "rgba(250,251,252,0.22)"],

  // === Audit-pad shadow on dark — deeper ===
  [
    /box-shadow: 0 14px 28px rgba\(31,28,25,0\.10\), 0 2px 6px rgba\(31,28,25,0\.05\)/g,
    "box-shadow: 0 14px 28px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.30)",
  ],

  // === Title tag (just append "(Dark)" so the screenshot logs are readable) ===
  [/<title>([^<]*?)<\/title>/, "<title>$1 (Dark)</title>"],

  // === Blanket greens — runs AFTER specific rules so already-converted
  // values are skipped. Pushes any remaining hardcoded brand green to its
  // brighter sibling so SVG strokes/fills read on the dark canvas. ===
  [/#006940/g, "#00bd74"],
  [/rgba\(0,105,64,/g, "rgba(0,189,116,"],
];

function transform(html) {
  let out = html;
  for (const [pattern, replacement] of SUBS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

const files = (await readdir(CARDS_DIR))
  .filter((f) => f.endsWith(".html") && !f.endsWith("-dark.html"));

let count = 0;
for (const file of files) {
  const src = resolve(CARDS_DIR, file);
  const dst = resolve(CARDS_DIR, file.replace(/\.html$/, "-dark.html"));
  const html = await readFile(src, "utf8");
  await writeFile(dst, transform(html));
  count++;
  console.log(`✓ ${basename(dst)}`);
}
console.log(`\n${count} dark cards written.`);
