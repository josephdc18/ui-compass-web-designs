#!/usr/bin/env node
/**
 * Capture the deterministic promo film to a 1080x1350 MP4 (or verification stills).
 *
 * The page exposes window.__promo.seek(ms) which renders every pixel as a pure
 * function of the clock, so we step frame-by-frame headlessly and the result is
 * identical to interactive playback. Uses the system Chrome via puppeteer-core
 * (no bundled Chromium) and the npm-bundled static ffmpeg (no brew).
 *
 *   node scripts/capture-promo.mjs                 # -> content-kit/promo.mp4 @30fps
 *   node scripts/capture-promo.mjs --fps 24
 *   node scripts/capture-promo.mjs --frames 0,4000,10600,17100   # verify stills
 *   CHROME_PATH="/path/to/Chrome" node scripts/capture-promo.mjs
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import ffmpegPkg from "@ffmpeg-installer/ffmpeg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = resolve(ROOT, "content-kit/promo.html");
const OUT = resolve(ROOT, "content-kit/promo.mp4");
const STILLS = resolve(ROOT, "content-kit/promo-frames");
const W = 1080, H = 1350;

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at:\n  ${CHROME}\nSet CHROME_PATH to your Chrome binary.`);
  process.exit(1);
}

const framesArg = arg("--frames", null);
const fps = parseInt(arg("--fps", "30"), 10);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  await page.goto(pathToFileURL(HTML).href + "?export=1", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForFunction(() => window.__promo && typeof window.__promo.seek === "function", { timeout: 8000 });

  const DUR = await page.evaluate(() => window.__promo.duration);

  // helper: seek + double-rAF flush + screenshot the exact stage box
  async function shot(t, path) {
    await page.evaluate((ms) => window.__promo.seek(ms), t);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return page.screenshot({ path, clip: { x: 0, y: 0, width: W, height: H }, type: path ? undefined : "png" });
  }

  if (framesArg) {
    await mkdir(STILLS, { recursive: true });
    const ts = framesArg.split(",").map((s) => parseInt(s.trim(), 10));
    for (const t of ts) {
      const p = resolve(STILLS, `t-${String(t).padStart(6, "0")}.png`);
      await shot(t, p);
      console.log("✓ still", t, "->", p);
    }
  } else {
    const total = Math.round((DUR / 1000) * fps) + 1;
    console.log(`Rendering ${total} frames @${fps}fps (${(DUR / 1000).toFixed(1)}s) -> ${OUT}`);
    const ff = spawn(ffmpegPkg.path, [
      "-y",
      "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
      "-movflags", "+faststart", "-preset", "medium", "-crf", "18",
      OUT,
    ], { stdio: ["pipe", "inherit", "inherit"] });

    for (let f = 0; f < total; f++) {
      const t = Math.min(DUR, (f / fps) * 1000);
      const buf = await shot(t, undefined);
      if (!ff.stdin.write(buf)) await once(ff.stdin, "drain");
      if (f % 60 === 0) process.stdout.write(`\r  frame ${f}/${total}  (${((f / total) * 100).toFixed(0)}%)   `);
    }
    ff.stdin.end();
    await once(ff, "close");
    console.log(`\n✓ wrote ${OUT}`);
  }

  if (errors.length) {
    console.error("\n⚠ page reported errors:\n" + errors.join("\n"));
    process.exitCode = 3;
  } else {
    console.log("✓ no console/page errors");
  }
} finally {
  await browser.close();
}
