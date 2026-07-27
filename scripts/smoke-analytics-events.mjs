#!/usr/bin/env node
/**
 * Smoke test for src/assets/js/analytics-events.js against the BUILT pages.
 *
 * The file is all delegation and capture-phase ordering, so the only test that
 * proves anything is a real browser clicking real exported markup. window.umami
 * is stubbed before the page scripts run (the tracker itself is blocked so the
 * test never phones home), and every track() call is recorded.
 *
 * Serves public/ over http so root-relative /assets/ URLs resolve.
 *
 *   node scripts/smoke-analytics-events.mjs
 *   CHROME_PATH="/path/to/Chrome" node scripts/smoke-analytics-events.mjs
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public");
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at:\n  ${CHROME}\nSet CHROME_PATH to your Chrome binary.`);
  process.exit(1);
}
if (!existsSync(ROOT)) {
  console.error(`No build at ${ROOT}. Run: npx @11ty/eleventy`);
  process.exit(1);
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
                ".svg": "image/svg+xml", ".json": "application/json" };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  try {
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function openPage(path) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    // Never hit the real trackers, and don't wait on remote assets.
    if (/umami|googletagmanager|google-analytics|fonts\.g/.test(r.url())) return r.abort();
    if (!r.url().startsWith(BASE)) return r.abort();
    r.continue();
  });
  await page.evaluateOnNewDocument(() => {
    window.__events = [];
    window.umami = { track: (name, props) => window.__events.push({ name, props }) };
  });
  await page.goto(BASE + path, { waitUntil: "load" });
  return page;
}

// Click without navigating: cancel the default in the bubble phase, which runs
// after the capture-phase tracker has already seen the click.
async function clickNoNav(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error("no element for " + sel);
    const stop = (e) => e.preventDefault();
    document.addEventListener("click", stop, false);
    el.click();
    document.removeEventListener("click", stop, false);
  }, selector);
}

const events = (page) => page.evaluate(() => window.__events);

try {
  // ---- home: FAQ open/close + quote CTA + header nav CTA ----
  {
    const page = await openPage("/");

    await clickNoNav(page, ".cs-faq-item .cs-button");
    let ev = await events(page);
    const faq = ev.find((e) => e.name === "FAQ Open");
    check("FAQ Open fires on first click", !!faq, faq && `q="${faq.props.question.slice(0, 40)}…"`);
    check("FAQ Open carries a non-empty question", !!faq && faq.props.question.length > 0);

    // Second click closes it — must NOT fire again.
    const before = (await events(page)).length;
    await clickNoNav(page, ".cs-faq-item .cs-button");
    const after = (await events(page)).length;
    check("FAQ close does not fire an event", after === before, `${before} -> ${after}`);

    // Header CTA -> /contact/
    await page.evaluate(() => (window.__events = []));
    await clickNoNav(page, "#cs-navigation a.cs-nav-button");
    ev = await events(page);
    const nav = ev.find((e) => e.name === "Quote CTA");
    check("Header CTA fires Quote CTA", !!nav, nav && `zone=${nav.props.zone} label="${nav.props.label}"`);
    check("Header CTA zone is 'header'", !!nav && nav.props.zone === "header", nav && nav.props.zone);

    // A cs-button-solid that does NOT point at /contact/ must stay silent.
    await page.evaluate(() => (window.__events = []));
    const other = await page.$('a.cs-button-solid[href="/pricing/"]');
    if (other) {
      await clickNoNav(page, 'a.cs-button-solid[href="/pricing/"]');
      const n = (await events(page)).length;
      check("Non-contact solid button stays silent", n === 0, `${n} events`);
    }
    await page.close();
  }

  // ---- contact page: tel / mailto / directions / social / form submit ----
  {
    const page = await openPage("/contact/");

    const cases = [
      ['a[href^="tel:"]', "Call Click"],
      ['a[href^="mailto:"]', "Email Click"],
      ['a[href*="maps.app.goo.gl"], a[href*="google.com/maps"]', "Directions Click"],
      ['a[href*="linkedin.com"]', "Social Click"],
    ];
    for (const [sel, expected] of cases) {
      await page.evaluate(() => (window.__events = []));
      const el = await page.$(sel);
      if (!el) { check(`${expected} (no matching link on /contact/)`, true, "skipped"); continue; }
      await clickNoNav(page, sel);
      const ev = await events(page);
      const hit = ev.find((e) => e.name === expected);
      check(`${expected} fires`, !!hit, hit && `zone=${hit.props.zone}${hit.props.network ? ` network=${hit.props.network}` : ""}`);
    }

    // Form submit — requestSubmit() so validation + both listeners run for real.
    await page.evaluate(() => (window.__events = []));
    await page.evaluate(() => {
      const f = document.querySelector("form.cs-form");
      f.querySelectorAll("[required]").forEach((i) => {
        i.value = i.type === "email" ? "a@b.com" : "test";
      });
      f.requestSubmit();
    });
    const ev = await events(page);
    const sub = ev.find((e) => e.name === "Form Submit");
    check("Form Submit fires", !!sub, sub && `form="${sub.props.form}"`);
    check("Form Submit names the form", !!sub && sub.props.form === "Contact Form", sub && sub.props.form);

    /* zoneOf branches other than 'header'. The header top bar owns the first
       tel:/mailto: on the page, so without scoping the selectors every zone
       above resolves to 'header' and these branches go untested. */
    for (const [scope, expected] of [["#contact-1392", "contact-strip"], ["#cs-footer-309", "footer"]]) {
      const sel = `${scope} a[href^="tel:"], ${scope} a[href^="mailto:"]`;
      const el = await page.$(sel);
      if (!el) { check(`zone '${expected}' (no contact link in ${scope})`, false, "selector matched nothing"); continue; }
      await page.evaluate(() => (window.__events = []));
      await clickNoNav(page, sel);
      const z = (await events(page))[0];
      check(`zone resolves to '${expected}'`, !!z && z.props.zone === expected, z && `${z.name} zone=${z.props.zone}`);
    }
    await page.close();
  }

  // ---- /ko/: same delegation must work on the duplicated locale tree ----
  {
    const page = await openPage("/ko/");
    await clickNoNav(page, ".cs-faq-item .cs-button");
    const ev = await events(page);
    const faq = ev.find((e) => e.name === "FAQ Open");
    check("FAQ Open fires on /ko/", !!faq, faq && `page=${faq.props.page}`);
    check("page prop is the ko path", !!faq && faq.props.page.startsWith("/ko/"), faq && faq.props.page);
    await page.close();
  }

  // ---- tracker blocked: must not throw ----
  {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (r) => (r.url().startsWith(BASE) ? r.continue() : r.abort()));
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE + "/", { waitUntil: "load" });
    await clickNoNav(page, ".cs-faq-item .cs-button");
    check("No errors when window.umami is absent", errors.length === 0, errors.join("; "));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
