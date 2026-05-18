#!/usr/bin/env node
/**
 * Screenshot content-kit/iphone-wallpaper.html at 1290×2796 via Browserless.
 * Inlines src/assets/logo-on-dark.svg so the path resolves remotely.
 */
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HTML_PATH = resolve(ROOT, "content-kit/iphone-wallpaper.html");
const OUT_PATH = resolve(ROOT, "content-kit/iphone-wallpaper.png");
const LOGO_PATH = resolve(ROOT, "content-kit/assets/uic-vertical.svg");

const LOGO_DATA_URI = (() => {
  if (!existsSync(LOGO_PATH)) return null;
  const b64 = readFileSync(LOGO_PATH).toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
})();

function inlineLogo(html) {
  if (!LOGO_DATA_URI) return html;
  return html.replace(
    /src=("[^"]*uic-vertical\.svg"|'[^']*uic-vertical\.svg')/g,
    `src="${LOGO_DATA_URI}"`
  );
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
  console.error("Missing BROWSERLESS_API_KEY in .dev.vars.");
  process.exit(1);
}

const html = inlineLogo(await readFile(HTML_PATH, "utf8"));

const res = await fetch(`${BASE}/screenshot?token=${encodeURIComponent(TOKEN)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    html,
    options: { type: "png", fullPage: false, omitBackground: false },
    viewport: { width: 1290, height: 2796, deviceScaleFactor: 1 },
    gotoOptions: { waitUntil: "networkidle0" },
    waitForTimeout: 1200,
  }),
});

if (!res.ok) {
  console.error(`Browserless ${res.status}: ${(await res.text()).slice(0, 400)}`);
  process.exit(1);
}

const buf = Buffer.from(await res.arrayBuffer());
await writeFile(OUT_PATH, buf);
console.log(`✓ wrote ${OUT_PATH} (${(buf.length / 1024).toFixed(1)} KB)`);
