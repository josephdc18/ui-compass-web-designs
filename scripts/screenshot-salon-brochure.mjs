#!/usr/bin/env node
/**
 * Screenshot content-kit/salon-brochure.html as one tall PNG via Browserless.
 * Uses fullPage to capture the entire scroll height.
 */
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HTML_PATH = resolve(ROOT, "content-kit/salon-brochure.html");
const OUT_PATH = resolve(ROOT, "content-kit/salon-brochure.png");

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

const html = await readFile(HTML_PATH, "utf8");

const res = await fetch(`${BASE}/screenshot?token=${encodeURIComponent(TOKEN)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    html,
    options: { type: "png", fullPage: true, omitBackground: false },
    viewport: { width: 1200, height: 1600, deviceScaleFactor: 2 },
    gotoOptions: { waitUntil: "networkidle0" },
    waitForTimeout: 1500,
  }),
});

if (!res.ok) {
  console.error(`Browserless ${res.status}: ${(await res.text()).slice(0, 400)}`);
  process.exit(1);
}

const buf = Buffer.from(await res.arrayBuffer());
await writeFile(OUT_PATH, buf);
console.log(`✓ wrote ${OUT_PATH} (${(buf.length / 1024).toFixed(1)} KB)`);
