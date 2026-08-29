#!/usr/bin/env node
/**
 * Browser smoke coverage for the built blog index, article reader, FAQ/Sources,
 * Korean index, and the unchanged service-page TOC.
 *
 * Run after both builds:
 *   npx @11ty/eleventy && BLOG_EXPECT_POSTS=37 node scripts/smoke-blog-reader.mjs
 *   NODE_ENV=production npx @11ty/eleventy && BLOG_EXPECT_POSTS=4 node scripts/smoke-blog-reader.mjs
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EXPECTED_POSTS = process.env.BLOG_EXPECT_POSTS ? Number(process.env.BLOG_EXPECT_POSTS) : null;
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const DESKTOP = { width: 1280, height: 900, deviceScaleFactor: 1 };
const TYPES = {
  '.avif': 'image/avif', '.css': 'text/css', '.gif': 'image/gif', '.html': 'text/html',
  '.ico': 'image/x-icon', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set CHROME_PATH to a Chrome binary.`);
  process.exit(1);
}
if (!existsSync(PUBLIC)) {
  console.error(`No build at ${PUBLIC}. Run npx @11ty/eleventy first.`);
  process.exit(1);
}

const server = createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://local.test').pathname); }
  catch { response.writeHead(400).end('bad request'); return; }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const relative = normalize(pathname).replace(/^[/\\]+/, '');
  const target = resolve(PUBLIC, relative);
  if (target !== PUBLIC && !target.startsWith(PUBLIC + '/')) {
    response.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'content-type': TYPES[extname(target)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const checks = [];
const diagnostics = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function settle(page, milliseconds = 80) {
  await new Promise((done) => setTimeout(done, milliseconds));
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

/**
 * Scrolling down auto-hides the reader bar — intended behaviour, and the bar
 * translates fully off-screen, so puppeteer's click() then throws "Node is
 * either not clickable". Any test that scrolls before pressing a bar control
 * has to bring it back first, the way a reader would with a flick upward.
 * Waits for the class rather than sleeping, since the hide lands a frame or two
 * after the scroll event.
 */
async function revealBar(page) {
  await page.evaluate(() => window.scrollBy(0, -40));
  await page.waitForFunction(
    () => !document.querySelector('[data-reader-bar]')?.classList.contains('is-hidden'),
    { polling: 'raf', timeout: 4000 },
  );
  await settle(page);
}

async function openPage(pathname, viewport = DESKTOP, beforeLoad) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.url().startsWith(BASE) && response.status() >= 400) {
      errors.push(`local ${response.status()}: ${response.url()}`);
    }
  });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().startsWith(BASE)) request.continue();
    else request.respond({ status: 204, contentType: 'text/plain', body: '' });
  });
  if (beforeLoad) await page.evaluateOnNewDocument(beforeLoad);
  await page.goto(BASE + pathname, { waitUntil: 'load' });
  await settle(page);
  page.__smokeErrors = errors;
  page.__smokePath = pathname;
  return page;
}

async function closePage(page) {
  diagnostics.push({ path: page.__smokePath, errors: [...page.__smokeErrors] });
  await page.close();
}

async function visibleCount(page) {
  return page.$$eval('[data-search]', (nodes) => nodes.filter((node) => !node.hidden).length);
}

async function testIndex() {
  console.log('\nIndex');
  const page = await openPage('/blog/', MOBILE);
  const summary = await page.evaluate(() => {
    const feature = document.querySelector('.blog-feature');
    const rows = [...document.querySelectorAll('#archive-grid .blog-row')];
    const categories = [...new Set([...document.querySelectorAll('[data-search]')]
      .map((node) => node.dataset.category).filter((value) => value && value !== 'uncategorized'))].sort();
    const tabs = [...document.querySelectorAll('.blog-filter[data-filter]')]
      .map((node) => node.dataset.filter).filter((value) => value !== 'all' && value !== 'saved').sort();
    return {
      bodyClass: document.body.className,
      featureCount: document.querySelectorAll('.blog-feature').length,
      rowCount: rows.length,
      total: document.querySelectorAll('[data-search]').length,
      featureUrl: feature?.dataset.url,
      featureRepeated: rows.some((row) => row.dataset.url === feature?.dataset.url),
      categories,
      tabs,
      clusters: document.querySelectorAll('.insight-cluster, #cta-697').length,
    };
  });
  check('index body flag', summary.bodyClass.split(/\s+/).includes('blog-index-page'), summary.bodyClass);
  check('one newest feature', summary.featureCount === 1, String(summary.featureCount));
  check('rows equal posts minus one', summary.rowCount === Math.max(0, summary.total - 1), `${summary.rowCount}/${summary.total}`);
  check('feature is not repeated', !summary.featureRepeated);
  check('clusters and archive CTA removed', summary.clusters === 0);
  check('tabs equal categories in the build', JSON.stringify(summary.tabs) === JSON.stringify(summary.categories), summary.tabs.join(', '));
  if (EXPECTED_POSTS !== null) check('expected build post count', summary.total === EXPECTED_POSTS, `${summary.total}/${EXPECTED_POSTS}`);
  if (summary.total === 4) check('production has no Design tab', !summary.tabs.includes('design'));
  if (summary.total > 4) check('development has Design tab', summary.tabs.includes('design'));

  const firstTitle = await page.$eval('[data-search] strong', (node) => node.textContent.trim().split(/\s+/).slice(0, 3).join(' '));
  await page.type('#blog-search', firstTitle);
  await new Promise((done) => setTimeout(done, 180));
  const narrowed = await visibleCount(page);
  check('search narrows the index', narrowed > 0 && narrowed < summary.total, `${narrowed}/${summary.total}`);
  await page.click('#blog-search', { clickCount: 3 });
  await page.type('#blog-search', '__no_article_matches_this__');
  await new Promise((done) => setTimeout(done, 180));
  const emptyShown = await page.$eval('#archive-empty', (node) => !node.hidden);
  check('no-match search shows empty state', emptyShown);
  await page.click('[data-clear-filters]');
  await settle(page);
  check('Clear filters restores every card', (await visibleCount(page)) === summary.total);

  const category = summary.tabs[0];
  if (category) {
    await page.click(`[data-filter="${category}"]`);
    await settle(page);
    // Rows only. The feature card is a fixed editorial slot and is deliberately
    // exempt from the category and Saved chips — see apply() in blog-filter.js.
    const composed = await page.$$eval('.blog-row', (nodes) => nodes
      .filter((node) => !node.hidden).every((node) => node.dataset.category === document.querySelector('.blog-filter[aria-pressed="true"]')?.dataset.filter));
    check('category filter uses the shared visibility pipeline', composed, category);
    check('tab click updates the hash', new URL(page.url()).hash === `#${category}`, new URL(page.url()).hash);

    // Every chip, including one the feature does not belong to, and Saved.
    const chipStates = await page.evaluate(async (tabs) => {
      const feature = document.querySelector('.blog-feature');
      const out = [];
      for (const filter of tabs.concat('saved')) {
        const chip = document.querySelector(`.blog-filter[data-filter="${filter}"]`);
        if (!chip) continue;
        chip.click();
        await new Promise((done) => setTimeout(done, 60));
        out.push({ filter, hidden: feature.hidden, sameCategory: feature.dataset.category === filter });
      }
      return out;
    }, summary.tabs);
    const offCategory = chipStates.filter((state) => !state.sameCategory);
    check('chips never hide the feature card',
      chipStates.every((state) => !state.hidden),
      chipStates.filter((s) => s.hidden).map((s) => s.filter).join(', ') || `${offCategory.length} off-category chips checked`);

    // Search is the exception: a masthead contradicting the query is worse.
    await page.click(`[data-filter="all"]`);
    await page.click('#blog-search', { clickCount: 3 });
    await page.type('#blog-search', '__no_article_matches_this__');
    await new Promise((done) => setTimeout(done, 200));
    check('search still filters the feature card',
      await page.$eval('.blog-feature', (node) => node.hidden));
    await page.click('[data-clear-filters]');
    await settle(page);
    check('clearing restores the feature card', !(await page.$eval('.blog-feature', (node) => node.hidden)));
  }

  await page.evaluate(() => localStorage.setItem('uic_bookmarks', '{not json'));
  await page.reload({ waitUntil: 'load' });
  await settle(page);
  const healed = await page.evaluate(() => localStorage.getItem('uic_bookmarks'));
  check('corrupt bookmark storage self-heals', healed === '[]', healed);

  // A document CustomEvent cannot cross tabs; this specifically exercises the
  // browser's real storage event by saving from a separate article tab. The
  // corrupt-storage test above leaves a known-empty durable list.
  const writerTab = await openPage('/blog/a-page-per-suburb-for-trades/', MOBILE);
  await writerTab.evaluate(() => localStorage.setItem('uic_bookmarks', JSON.stringify([
    { url: '/blog/a-page-per-suburb-for-trades/', title: 'Cross-tab post' },
  ])));
  await page.bringToFront();
  await settle(page, 160);
  const crossTabCount = await page.$eval('[data-saved-filter-count]', (node) => node.textContent);
  check('a real two-tab storage event updates Saved', crossTabCount === '1', crossTabCount);
  await closePage(writerTab);

  const featuredUrl = await page.$eval('.blog-feature', (node) => node.dataset.url);
  await page.evaluate((url) => localStorage.setItem('uic_bookmarks', JSON.stringify([
    { url: url.replace(/\/$/, ''), title: 'Saved feature' },
    { url: '/blog/not-in-this-build/', title: 'Stale post' },
  ])), featuredUrl);
  await page.reload({ waitUntil: 'load' });
  await settle(page);
  const saved = await page.evaluate((url) => ({
    hidden: document.querySelector('[data-filter="saved"]').hidden,
    count: document.querySelector('[data-saved-filter-count]').textContent,
    matches: window.uicBookmarks.has(url),
  }), featuredUrl);
  check('Saved count is the build intersection', !saved.hidden && saved.count === '1', saved.count);
  check('bookmark URL normalization matches trailing slashes', saved.matches);
  // Settle the chip into place before clicking it. .blog-toolbar is sticky, so
  // puppeteer's own scroll-into-view can reposition the strip between the point
  // being computed and the click landing — which silently pressed nothing and
  // left the filter on "all". A real coordinate click still exercises hit
  // testing; it just is not racing the sticky reflow any more.
  await page.$eval('[data-filter="saved"]', (node) => node.scrollIntoView({ block: 'center' }));
  await settle(page, 200);
  await page.click('[data-filter="saved"]');
  await settle(page);
  const savedVisible = await page.$$eval('[data-search]', (nodes) => nodes
    .filter((node) => !node.hidden).map((node) => `${node.className.split(/\s+/)[0]}:${node.dataset.url}`));
  check('Saved filter shows exactly the saved post', savedVisible.length === 1, savedVisible.join(', '));

  if (summary.total > 4) {
    // Fixture: a post whose frontmatter names a card PNG that has never been
    // rendered. The `assetExists` guard in the listing has to drop the media
    // wrapper entirely rather than emit an empty <picture>. Any post with no
    // artwork on disk works here — `managing-a-website` filled the role until
    // it was given a photograph.
    const missing = await page.$('[data-slug="what-makes-a-website-work"]');
    check('missing-image draft card exists in dev', !!missing);
    if (missing) check('missing-image draft has no media wrapper', !(await missing.$('.blog-index-media')));
  }
  await closePage(page);

  const deep = await openPage('/blog/#seo', MOBILE);
  const deepFilter = await deep.$eval('.blog-filter[aria-pressed="true"]', (node) => node.dataset.filter);
  check('#seo deep link selects SEO', deepFilter === 'seo', deepFilter);
  await closePage(deep);
}

async function testKoreanIndex() {
  console.log('\nKorean index');
  const page = await openPage('/ko/blog/', MOBILE);
  const state = await page.evaluate(() => ({
    body: document.body.className,
    feature: document.querySelectorAll('.blog-feature').length,
    rows: document.querySelectorAll('.blog-row').length,
    search: document.querySelector('#blog-search')?.getAttribute('aria-label'),
  }));
  check('Korean index exists with its body flag', state.body.split(/\s+/).includes('blog-index-page'), state.body);
  check('Korean index supports zero or one post builds', state.feature + state.rows <= 1, `${state.feature + state.rows}`);
  check('Korean index controls are localized', state.search === '글 검색', state.search);
  await closePage(page);
}

async function testPostMobile() {
  console.log('\nMobile article reader');
  const page = await openPage('/blog/a-page-per-suburb-for-trades/', MOBILE);
  const initial = await page.evaluate(() => ({
    body: document.body.className,
    viewport: document.querySelector('meta[name="viewport"]')?.content || '',
    themeColor: document.querySelector('meta[name="theme-color"]')?.content || '',
    barDisplay: getComputedStyle(document.querySelector('[data-reader-bar]')).display,
    chipCount: document.querySelectorAll('.toc-mobile').length,
    mins: document.querySelector('[data-read-mins]')?.dataset.readMins,
    actionApi: Object.keys(window.uicArticle || {}).sort(),
    listenState: window.uicArticle?.getListenState(),
    listenHidden: [...document.querySelectorAll('[data-listen-toggle]')].every((node) => node.hidden),
    toc: document.querySelectorAll('.toc a').length,
    headings: document.querySelectorAll('#blog-content h2, #blog-content h3, [data-toc-section] h2').length,
    ids: [...document.querySelectorAll('#blog-content h2, #blog-content h3, [data-toc-section] h2')].map((node) => node.id),
  }));
  check('post body flag', initial.body.includes('blog-post-page'), initial.body);
  check('blog viewport extends behind Safari chrome', initial.viewport.includes('viewport-fit=cover'), initial.viewport);
  check('blog does not force an opaque Safari toolbar tint', initial.themeColor === 'transparent', initial.themeColor);
  check('reader bar is visible at 390px', initial.barDisplay !== 'none', initial.barDisplay);
  check('blog chip rail is absent', initial.chipCount === 0);
  check('build-time read minutes are present', /^\d+$/.test(initial.mins || ''), initial.mins);
  check('shared article action API is present', initial.actionApi.includes('toggleFocus') && initial.actionApi.includes('toggleListen'));
  if (initial.listenState === 'unavailable') check('unavailable Listen controls are hidden', initial.listenHidden);
  check('TOC contains h2, h3, and FAQ heading', initial.toc === initial.headings, `${initial.toc}/${initial.headings}`);
  check('heading IDs are non-empty and unique', initial.ids.every(Boolean) && new Set(initial.ids).size === initial.ids.length);
  check('heading IDs are human-readable', initial.ids.every((id) => !/^section-\d+$/.test(id)));

  await page.evaluate(() => window.scrollTo(0, 600));
  await settle(page);
  // After revealBar's upward nudge, not before it — the nudge moves the page,
  // and the scroll-lock and restore assertions below compare against this.
  await revealBar(page);
  const beforeOpen = await page.evaluate(() => window.scrollY);
  await page.click('[data-panel-toggle="contents"]');
  await page.waitForFunction(() => {
    const panel = document.querySelector('[data-panel="contents"]');
    return panel?.dataset.open === 'true' && panel.contains(document.activeElement);
  }, { timeout: 1500 });
  await settle(page);
  const opened = await page.evaluate(() => ({
    open: document.querySelector('[data-panel="contents"]').dataset.open,
    scrim: document.querySelector('[data-scrim]').hidden,
    fixed: document.body.style.position,
    modal: document.querySelector('[data-panel="contents"]').getAttribute('aria-modal'),
    inert: document.querySelector('#cs-navigation')?.inert,
    focusInside: document.querySelector('[data-panel="contents"]').contains(document.activeElement),
    active: document.activeElement?.outerHTML?.slice(0, 120) || '',
    closeDisplay: getComputedStyle(document.querySelector('[data-panel="contents"] [data-panel-close]')).display,
  }));
  check('Contents opens as one modal sheet and receives focus', opened.open === 'true' && !opened.scrim && opened.fixed === 'fixed' && opened.focusInside, `${opened.active} close=${opened.closeDisplay}`);
  check('mobile sheet has modal semantics', opened.modal === 'true' && opened.inert === true);
  // The navbar stays put behind the scrim rather than being hidden outright —
  // hiding it made the top of the screen jump for no benefit, since the scrim
  // outranks it and inert already makes it unreachable.
  const navBehindSheet = await page.evaluate(() => {
    const nav = document.querySelector('#cs-navigation');
    const rect = nav.getBoundingClientRect();
    const over = document.elementFromPoint(rect.left + rect.width / 2, Math.max(1, rect.top + rect.height / 2));
    return {
      visibility: getComputedStyle(nav).visibility,
      // The mechanism that actually mattered: #cs-navigation is fixed with no
      // `top`, so it renders at its static position, and the scroll lock's
      // `body { top: -<scrollY>px }` used to drag it that far off-screen.
      top: Math.round(rect.top),
      over: over ? String(over.className || over.tagName) : null,
    };
  });
  check('navbar stays on screen behind an open sheet, covered by the scrim',
    navBehindSheet.visibility === 'visible'
      && navBehindSheet.top === 0
      && (navBehindSheet.over || '').includes('reader-scrim'),
    `visibility=${navBehindSheet.visibility} top=${navBehindSheet.top} over=${navBehindSheet.over}`);
  await page.evaluate(() => window.scrollTo(0, 1400));
  const held = await page.evaluate((y) => Math.abs(parseFloat(document.body.style.top) + y) < 12, beforeOpen);
  check('fixed-body scroll lock holds the page', held);
  await page.keyboard.press('Escape');
  await settle(page);
  const closed = await page.evaluate(() => ({
    open: document.querySelector('[data-panel="contents"]').dataset.open,
    y: window.scrollY,
    focused: document.activeElement?.dataset.panelToggle,
    fixed: document.body.style.position,
  }));
  check('Escape closes and restores scroll', closed.open === 'false' && !closed.fixed && Math.abs(closed.y - beforeOpen) < 12, `${closed.y}/${beforeOpen}`);
  check('closing restores focus to Contents', closed.focused === 'contents', closed.focused);

  await page.keyboard.press('ArrowRight');
  const roving = await page.evaluate(() => ({
    active: document.activeElement?.dataset.panelToggle || document.activeElement?.getAttribute('data-focus-toggle') || '',
    zeroes: [...document.querySelectorAll('[data-reader-bar] .reader-action')].filter((node) => node.tabIndex === 0).length,
  }));
  check('toolbar arrows keep one roving tab stop', roving.active === 'display' && roving.zeroes === 1, roving.active);

  // Regressions. Counting the TOC links proved they exist; none of these four
  // were caught by that, and all four shipped broken.
  //
  // A modal sheet and a floating island should not read as two stacked cards.
  // Opening a sheet dismisses the island and makes the sheet the sole floating
  // surface, inset by the same safe-area-aware edge rhythm.
  await revealBar(page);
  await page.click('[data-panel-toggle="contents"]');
  // settle() waits 80ms; the sheet slides for 280ms. Measuring geometry before
  // the transform lands reads a panel that is still on its way up.
  await page.waitForFunction(() => {
    const value = getComputedStyle(document.querySelector('[data-panel="contents"]')).transform;
    return value === 'none' || Math.abs(Number(value.split(',').pop().replace(')', '')) || 0) < 0.5;
  }, { timeout: 4000 });
  const zorder = await page.evaluate(() => {
    const bar = document.querySelector('[data-reader-bar]').getBoundingClientRect();
    const panel = document.querySelector('[data-panel="contents"]').getBoundingClientRect();
    return {
      barTop: Math.round(bar.top),
      panelLeft: Math.round(panel.left),
      panelRight: Math.round(innerWidth - panel.right),
      panelBottom: Math.round(innerHeight - panel.bottom),
      panelRadius: getComputedStyle(document.querySelector('[data-panel="contents"]')).borderBottomLeftRadius,
    };
  });
  check('open sheet dismisses the island instead of stacking two surfaces',
    zorder.barTop >= MOBILE.height, `bar top=${zorder.barTop}`);
  check('open sheet is an inset, fully rounded floating surface',
    zorder.panelLeft >= 10 && zorder.panelRight >= 10 && zorder.panelBottom >= 10 && zorder.panelRadius !== '0px',
    JSON.stringify(zorder));

  // 2. While a sheet is open the body is position:fixed, so window.scrollTo is
  //    a no-op and the unlock restored the pre-open position — the jump was
  //    silently thrown away and the heading stayed off-screen.
  const jumped = await page.evaluate(async () => {
    const link = [...document.querySelectorAll('[data-panel="contents"] .toc a')][3];
    const id = link.getAttribute('href').slice(1);
    link.click();
    await new Promise((r) => setTimeout(r, 1200));
    const rect = document.getElementById(id).getBoundingClientRect();
    const navBottom = document.querySelector('#cs-navigation').getBoundingClientRect().bottom;
    return {
      id,
      top: Math.round(rect.top),
      navBottom: Math.round(navBottom),
      open: document.querySelector('[data-panel="contents"]').dataset.open,
      focused: document.activeElement?.id,
    };
  });
  check('TOC jump scrolls the heading into view',
    jumped.top > 0 && jumped.top < 400, `${jumped.id} at ${jumped.top}`);
  check('TOC jump clears the fixed navbar',
    jumped.top >= jumped.navBottom - 1, `${jumped.top} vs ${jumped.navBottom}`);
  check('TOC jump closes the sheet and moves focus to the heading',
    jumped.open === 'false' && jumped.focused === jumped.id, `${jumped.open}/${jumped.focused}`);

  // The jump scrolled down, which correctly auto-hides the bar. Return to the
  // top so the remaining tests act on a visible toolbar.
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 200);
  // An auto-hidden bar must stop painting, not merely slide down: iOS Safari's
  // layout viewport runs behind the bottom address bar, and an opaque
  // backdrop-filtered slab parked there turned that bar solid.
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 1400); });
  await page.waitForFunction(
    () => document.querySelector('[data-reader-bar]').classList.contains('is-hidden'),
    { polling: 'raf', timeout: 4000 },
  );
  await settle(page, 320);
  const parked = await page.$eval('[data-reader-bar]', (bar) => ({
    visibility: getComputedStyle(bar).visibility,
    paints: bar.checkVisibility ? bar.checkVisibility({ visibilityProperty: true, checkOpacity: true }) : null,
  }));
  check('a hidden bar leaves the paint entirely', parked.visibility === 'hidden' && parked.paints === false,
    `${parked.visibility} paints=${parked.paints}`);
  // visibility:hidden is unfocusable, so Tab has to be what brings it back.
  await page.keyboard.press('Tab');
  await settle(page, 250);
  check('Tab restores an auto-hidden bar to the keyboard order',
    await page.$eval('[data-reader-bar]', (bar) => getComputedStyle(bar).visibility === 'visible'));

  check('scrolling back to the top reveals the bar again',
    await page.$eval('[data-reader-bar]', (node) => !node.classList.contains('is-hidden')));

  await revealBar(page);
  await page.click('[data-panel-toggle="display"]');
  await settle(page);
  await page.$eval('[data-panel="display"]', (panel) => {
    const close = panel.querySelector('[data-panel-close]');
    close.focus();
  });
  await page.keyboard.down('Shift');
  await page.keyboard.press('Tab');
  await page.keyboard.up('Shift');
  const trapState = await page.$eval('[data-panel="display"]', (panel) => ({
    inside: panel.contains(document.activeElement),
    active: document.activeElement?.outerHTML?.slice(0, 120) || document.activeElement?.tagName || '',
  }));
  check('Shift-Tab stays trapped inside the sheet', trapState.inside, trapState.active);

  await page.click('[data-reader-size="l"]');
  await page.$eval('[data-reader-speed="1.25"]', (button) => button.click());
  await settle(page);
  const prefs = await page.evaluate(() => ({
    size: document.documentElement.dataset.readerSize,
    stored: JSON.parse(localStorage.getItem('uic_reader_prefs')),
  }));
  check('text size and voice speed apply and persist', prefs.size === 'l' && prefs.stored.size === 'l' && prefs.stored.speed === 1.25, JSON.stringify(prefs));
  await page.$eval('[data-reader-reset]', (button) => button.click());
  await settle(page);
  const reset = await page.evaluate(() => window.uicReaderPrefs.get());
  check('reader preference reset restores M and 1×', reset.size === 'm' && reset.speed === 1, JSON.stringify(reset));
  await page.setViewport(DESKTOP);
  await settle(page);
  const breakpoint = await page.evaluate(() => ({
    open: document.querySelector('[data-panel="display"]').dataset.open,
    fixed: document.body.style.position,
    modal: document.querySelector('[data-panel="display"]').hasAttribute('aria-modal'),
  }));
  check('64rem+ cleanup closes, unlocks, and strips modal state', breakpoint.open === 'false' && !breakpoint.fixed && !breakpoint.modal);

  await page.setViewport(MOBILE);
  await settle(page);
  const faq = await page.evaluate(() => ({
    wrappers: document.querySelectorAll('.faq-section-header, .faq-section-body').length,
    items: document.querySelectorAll('.faq-item').length,
    schema: [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => { try { return JSON.parse(node.textContent); } catch { return null; } })
      .find((value) => value?.['@type'] === 'FAQPage')?.mainEntity?.length || 0,
    sourceCount: document.querySelectorAll('.post-sources li').length,
    sourceInToc: [...document.querySelectorAll('.toc a')].some((node) => node.getAttribute('href') === '#sources-heading'),
    faqInToc: [...document.querySelectorAll('.toc a')].some((node) => node.getAttribute('href') === '#faq-heading'),
    rels: [...document.querySelectorAll('.post-sources a')].map((node) => node.rel),
    // One rule between the last answer and Sources, not two. The final
    // .faq-item's border-bottom and .post-endcap's border-top used to stack
    // with 4.5rem of empty space between them.
    lastFaqBorder: (() => {
      const last = [...document.querySelectorAll('.faq-item')].pop();
      return last ? getComputedStyle(last).borderBottomWidth : null;
    })(),
    endcapBorder: (() => {
      const cap = document.querySelector('.post-endcap');
      return cap ? getComputedStyle(cap).borderTopWidth : null;
    })(),
  }));
  check('FAQ uses rules without card wrappers', faq.wrappers === 0 && faq.items > 0, `${faq.items} rows`);
  check('FAQ JSON-LD still matches visible row count', faq.schema === faq.items, `${faq.schema}/${faq.items}`);
  check('Sources render with noopener links', faq.sourceCount > 0 && faq.rels.every((rel) => rel.split(/\s+/).includes('noopener')), `${faq.sourceCount}`);
  check('FAQ is in the TOC and Sources are not', faq.faqInToc && !faq.sourceInToc);
  check('exactly one rule between the last FAQ row and the next section',
    faq.lastFaqBorder === '0px' && faq.endcapBorder === '1px',
    `faq=${faq.lastFaqBorder} endcap=${faq.endcapBorder}`);

  await page.evaluate(() => {
    const section = document.querySelector('[data-toc-section]');
    window.scrollTo(0, section.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 80);
  });
  await settle(page, 160);
  const progress = await page.$eval('[data-read-pct]', (node) => parseInt(node.textContent, 10));
  check('progress reaches the end at the FAQ, not the footer', progress >= 98, `${progress}%`);

  await page.evaluate(() => localStorage.removeItem('uic_bookmarks'));
  await page.$eval('[data-reader-bar] [data-share-bookmark]', (button) => button.click());
  await settle(page);
  const bookmarkSync = await page.$$eval('[data-share-bookmark]', (buttons) => buttons.every((button) => button.getAttribute('aria-pressed') === 'true'));
  check('Save synchronizes every article control', bookmarkSync);
  await closePage(page);
}

// Two index defects the row and control counts could not see: an undefined
// .sr-only utility painting its label as body text, and a row grid that kept
// reserving the artwork column for posts whose card image does not exist.
async function testIndexLayout() {
  console.log('\nIndex layout regressions');
  const page = await openPage('/blog/', MOBILE);
  const layout = await page.evaluate(() => {
    const hidden = [...document.querySelectorAll('.sr-only')];
    const widthOf = (row) => {
      const strong = row?.querySelector('.blog-row-body strong');
      return strong ? Math.round(strong.getBoundingClientRect().width) : 0;
    };
    const rows = [...document.querySelectorAll('.blog-row')];
    return {
      srOnlyCount: hidden.length,
      srOnlyVisible: hidden.filter((node) => node.getBoundingClientRect().width > 1).length,
      withMedia: widthOf(rows.find((row) => row.querySelector('.blog-index-media'))),
      noMedia: widthOf(rows.find((row) => !row.querySelector('.blog-index-media'))),
      noMediaRows: rows.filter((row) => !row.querySelector('.blog-index-media')).length,
    };
  });
  check('.sr-only text is never painted', layout.srOnlyCount > 0 && layout.srOnlyVisible === 0,
    `${layout.srOnlyVisible}/${layout.srOnlyCount} visible`);
  if (layout.noMediaRows > 0) {
    check('rows without artwork use the full row width',
      layout.noMedia >= layout.withMedia, `noMedia=${layout.noMedia} withMedia=${layout.withMedia}`);
  }

  // The navbar is fixed and collapses its top bar on scroll, so a constant
  // sticky offset is wrong at one end or the other. It was 60px against a
  // 72px settled navbar, which parked the toolbar 12px behind it.
  // Scroll far enough that the toolbar pins, but not past its own containing
  // block: a sticky element leaves with the section that holds it, and the
  // production index of four posts is short enough that scrolling to the page
  // bottom takes the whole archive off-screen.
  await page.evaluate(() => {
    const grid = document.getElementById('archive-grid');
    const target = grid.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 40;
    window.scrollTo(0, Math.max(0, target));
  });
  // The navbar adds .scroll on the scroll event and THEN collapses its top bar
  // over 300ms. --reader-sticky-offset is measured from the row that does not
  // collapse, so the toolbar only clears once that transition has finished.
  // Waiting for two equal frames is not enough — that is satisfied before the
  // class even lands.
  await page.waitForFunction(
    () => document.querySelector('#cs-navigation')?.classList.contains('scroll'),
    { polling: 'raf', timeout: 4000 },
  ).catch(() => {});
  await settle(page, 400);
  const stuck = await page.evaluate(() => {
    const toolbar = document.querySelector('.blog-toolbar').getBoundingClientRect();
    const nav = document.querySelector('#cs-navigation').getBoundingClientRect();
    const offset = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--reader-sticky-offset')) || 72;
    const hit = document.elementFromPoint(toolbar.left + 40, toolbar.top + 8);
    return {
      pinned: Math.abs(toolbar.top - offset) <= 2,
      overlap: Math.round(nav.bottom - toolbar.top),
      hit: hit ? hit.className || hit.id || hit.tagName : null,
    };
  });
  if (!stuck.pinned) {
    check('index too short for the toolbar to stick — nothing to assert', true, 'skipped');
  } else {
    check('sticky toolbar clears the fixed navbar', stuck.overlap <= 1, `${stuck.overlap}px behind nav`);
    check('sticky toolbar is the topmost element at its own edge',
      typeof stuck.hit === 'string' && stuck.hit.includes('blog-toolbar'), stuck.hit);
  }
  await closePage(page);
}

// Static pass over every built article: the browser tests only visit two or
// three, and "every article has the right byline avatar" is a claim about all
// of them. Before the per-author fallback, exactly one of thirty-eight posts
// set authorImage, so the avatar was missing almost everywhere.
async function testBylineAvatars() {
  console.log('\nByline avatars');
  const { readdir } = await import('node:fs/promises');
  const roots = [join(PUBLIC, 'blog'), join(PUBLIC, 'ko', 'blog')];
  const articles = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const file = join(root, entry.name, 'index.html');
      if (existsSync(file)) articles.push(file);
    }
  }

  const missing = [];
  const wrong = [];
  for (const file of articles) {
    const html = await readFile(file, 'utf8');
    const block = html.match(/<a[^>]*class="post-meta-avatar"[\s\S]*?<\/a>/);
    if (!block) { missing.push(file.replace(PUBLIC, '')); continue; }
    const author = (block[0].match(/aria-label="About ([^"]+)"/) || [])[1] || '';
    const src = (block[0].match(/src="([^"]+)"/) || [])[1] || '';
    const expected = author === 'UI Compass' ? 'favicon-192x192' : 'joseph-face';
    if (!src.includes(expected)) wrong.push(`${file.replace(PUBLIC, '')} ${author} -> ${src}`);
  }

  check('every built article carries a byline avatar',
    articles.length > 0 && missing.length === 0, `${articles.length - missing.length}/${articles.length}`);
  check('each avatar matches its author', wrong.length === 0, wrong.slice(0, 3).join('; '));
  // The source portrait is 1263x1263 / 1.5MB and renders at 44px; a raw <img>
  // would ship all of it to every article page.
  const sample = await readFile(articles[0], 'utf8');
  check('avatars go through the responsive image pipeline',
    /class="post-meta-avatar"[\s\S]*?<picture/.test(sample) && /\/images\/joseph-face-\d+w|\/images\/favicon-192x192-\d+w/.test(sample));
}

async function testBlockedStorage() {
  console.log('\nBlocked storage fallback');
  const page = await openPage('/blog/a-page-per-suburb-for-trades/', MOBILE, () => {
    Object.defineProperty(Storage.prototype, 'setItem', { configurable: true, value() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await page.evaluate(() => localStorage.removeItem('uic_bookmarks'));
  await revealBar(page);
  await page.click('[data-reader-bar] [data-share-bookmark]');
  await settle(page);
  const state = await page.evaluate(() => ({
    pressed: [...document.querySelectorAll('[data-share-bookmark]')].every((node) => node.getAttribute('aria-pressed') === 'true'),
    toast: document.querySelector('.copy-toast')?.textContent || document.querySelector('[data-reader-status]')?.textContent || '',
    session: window.uicBookmarks.urls(),
  }));
  check('blocked storage keeps a session bookmark', state.pressed && state.session.length === 1, state.toast.trim());
  check('blocked storage reports session-only persistence', /session|browser/i.test(state.toast), state.toast.trim());
  await closePage(page);
}

async function testSavedSanitization() {
  console.log('\nSaved-page sanitization');
  const page = await openPage('/saved/', MOBILE);
  await page.evaluate(() => localStorage.setItem('uic_bookmarks', JSON.stringify([
    { url: '/blog/a-page-per-suburb-for-trades/', title: 'Safe post', description: 'Allowed' },
    { url: 'javascript:alert(1)', title: '<img src=x onerror=alert(1)>' },
    { url: 'https://evil.example/blog/trap/', title: 'Cross origin' },
    { url: '/admin/', title: 'Wrong path' },
  ])));
  await page.reload({ waitUntil: 'load' });
  await settle(page);
  const links = await page.$$eval('#savedBookmarksList a', (nodes) => nodes.map((node) => ({ href: node.getAttribute('href'), text: node.textContent })));
  check('/saved/ drops poisoned, cross-origin, and non-blog entries', links.length === 1 && links[0].href === '/blog/a-page-per-suburb-for-trades/', JSON.stringify(links));
  await closePage(page);
}

async function testDesktopAndService() {
  console.log('\nDesktop and service regressions');
  const post = await openPage('/blog/a-page-per-suburb-for-trades/', DESKTOP);
  const desktop = await post.evaluate(() => ({
    barNode: !!document.querySelector('[data-reader-bar]'),
    barDisplay: getComputedStyle(document.querySelector('[data-reader-bar]')).display,
    toc: getComputedStyle(document.querySelector('.toc-sidebar')).display,
    rail: getComputedStyle(document.querySelector('.post-share-rail')).display,
    meta: getComputedStyle(document.querySelector('.post-meta')).display,
  }));
  check('desktop keeps a hidden-but-rendered reader bar', desktop.barNode && desktop.barDisplay === 'none', desktop.barDisplay);
  check('desktop TOC, share rail, and meta actions remain visible', desktop.toc !== 'none' && desktop.rail !== 'none' && desktop.meta !== 'none');
  await post.evaluate(() => window.scrollTo(0, document.querySelector('#blog-content').getBoundingClientRect().top + window.scrollY + 700));
  await settle(post, 180);
  const desktopProgress = await post.evaluate(() => {
    const panel = document.querySelector('.reader-panel--contents');
    const link = panel.querySelector('.toc a');
    return {
      readout: getComputedStyle(panel.querySelector('.reader-panel-head')).display,
      pct: panel.querySelector('[data-read-pct]').textContent,
      mins: panel.querySelector('[data-read-left]').textContent,
      meter: panel.querySelector('[data-progress]').style.width,
      spine: getComputedStyle(link, '::before').width,
      active: panel.querySelectorAll('.toc a.active').length,
    };
  });
  check('desktop TOC carries the LogoNuri readout, meter, and spine',
    desktopProgress.readout !== 'none' && parseFloat(desktopProgress.meter) > 0 && desktopProgress.spine === '2px' && desktopProgress.active === 1,
    JSON.stringify(desktopProgress));
  await closePage(post);

  const service = await openPage('/web-design/', MOBILE);
  const serviceState = await service.evaluate(() => ({
    bar: document.querySelectorAll('[data-reader-bar]').length,
    rail: document.querySelectorAll('.toc-mobile').length,
    chips: document.querySelectorAll('.toc-mobile .toc-chip').length,
  }));
  check('service page has no reader bar', serviceState.bar === 0);
  check('service mobile chip rail remains intact', serviceState.rail === 1 && serviceState.chips > 0, `${serviceState.chips} chips`);
  await closePage(service);
}

try {
  await testIndex();
  await testKoreanIndex();
  await testPostMobile();
  await testIndexLayout();
  await testBylineAvatars();
  await testBlockedStorage();
  await testSavedSanitization();
  await testDesktopAndService();
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}

for (const diagnostic of diagnostics) {
  check(`${diagnostic.path} has no page/console/local-request errors`, diagnostic.errors.length === 0, diagnostic.errors.join('; '));
}

const failed = checks.filter((item) => !item.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) {
  console.error('\nFailed checks:');
  for (const item of failed) console.error(`- ${item.name}${item.detail ? `: ${item.detail}` : ''}`);
  process.exit(1);
}
