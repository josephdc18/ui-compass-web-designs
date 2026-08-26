#!/usr/bin/env node
/**
 * Dependency-free smoke test for the MATH 3316 study app
 * (_reference/MATH 3316 study guide/index.html).
 *
 * Boots the page's inline <script> against a minimal DOM stub (no browser,
 * no npm deps — node built-ins only) and asserts the core invariants:
 *   - the script boots without throwing
 *   - validateQuestionBank() is clean and the bank is the expected size
 *   - invNormCDF + least-squares math are accurate
 *   - recordAttempt() drives mastery + the spaced-repetition queue
 *   - legacy localStorage progress migrates into the versioned state
 *
 * Full DOM/interaction coverage (clicking mastery answers, running an exam,
 * SVG rendering, drag) requires a real browser or a DOM library; this script
 * is the fast, zero-setup guard. Run:  node scripts/smoke-math3316.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = resolve(ROOT, '_reference/MATH 3316 study guide/index.html');

const html = readFileSync(HTML, 'utf8');
const main = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0];

// --- minimal DOM/window/localStorage stub (enough for the script to boot) ---
const idCache = {};
function makeEl(attrs = {}) {
  const el = {
    _a: attrs, style: {}, _cls: new Set(), className: '', value: '',
    scrollTop: 0, scrollHeight: 1000, clientHeight: 800, scrollWidth: 800, clientWidth: 800,
    files: [], options: [], parentElement: null, parentNode: null,
    classList: {
      toggle: (c, on) => { const has = el._cls.has(c); const v = on === undefined ? !has : !!on; v ? el._cls.add(c) : el._cls.delete(c); return v; },
      add: (...c) => c.forEach(x => el._cls.add(x)), remove: (...c) => c.forEach(x => el._cls.delete(x)), contains: c => el._cls.has(c),
    },
    getAttribute: k => (k in el._a ? el._a[k] : null), setAttribute: (k, v) => { el._a[k] = String(v); }, removeAttribute: k => { delete el._a[k]; },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    appendChild: c => { if (c) { c.parentElement = el; c.parentNode = el; } return c; },
    insertBefore: c => { if (c) { c.parentElement = el; c.parentNode = el; } return c; },
    removeChild: c => c, remove() {}, click() {},
    getBoundingClientRect: () => ({ top: 200, left: 0, width: 320, height: 200 }),
    querySelector: () => null, querySelectorAll: () => [], closest: () => null, focus() {},
    get innerHTML() { return el._h || ''; }, set innerHTML(v) { el._h = v; },
    get textContent() { return el._t || ''; }, set textContent(v) { el._t = String(v); },
  };
  el.parentElement = el.parentNode = makeOrphan();
  return el;
}
let orphan;
function makeOrphan() { if (!orphan) { orphan = { appendChild() {}, insertBefore() {}, querySelector: () => null, querySelectorAll: () => [] }; } return orphan; }
const documentElement = makeEl();
const sectionCtl = ['section-1', 'section-2', 'section-3', 'section-4', 'section-5', 'section-6', 'section-7', 'section-8', 'quiz'].map(id => makeEl({ 'data-section-control': id }));
const document = {
  documentElement, body: makeEl(),
  addEventListener() {}, createElement: () => makeEl(),
  getElementById: id => idCache[id] || (idCache[id] = makeEl({ id })),
  querySelector: sel => (/\bmain\b/.test(sel) ? makeEl() : null),
  querySelectorAll: sel => (sel.includes('data-section-control') ? sectionCtl : sel.includes('data-toc') ? [] : []),
};
const store = {};
store['m3316-progress'] = JSON.stringify({ complete: { 'section-3': true }, weak: { 'section-5': true } }); // legacy seed for migration test
const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };

const ctx = {
  document, localStorage, console,
  window: { addEventListener() {}, matchMedia: () => ({ matches: false }), location: { hash: '' } },
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
};
ctx.globalThis = ctx;
vm.createContext(ctx);

const results = [];
const assert = (n, c, e = '') => results.push([!!c, n, e]);

let booted = true;
try {
  vm.runInContext(main + '\n;globalThis.__x={get app(){return app;},validateQuestionBank,invNormCDF,computeLSRL,recordAttempt,getDueReviewEntries,cloneDefaultState,QUESTION_BANK};', ctx);
} catch (e) { booted = false; console.error(e.stack || e.message); }
const X = ctx.__x || {};
assert('script boots without throwing', booted);
assert('app.state initialised', X.app && typeof X.app.state === 'object');

if (booted) {
  assert('question bank has 56 items', X.QUESTION_BANK.length === 56, 'n=' + X.QUESTION_BANK.length);
  assert('validateQuestionBank clean', X.validateQuestionBank().length === 0);
  assert('legacy progress migrated (section-3 complete)', !!X.app.state.completedSections['section-3']);
  assert('legacy progress migrated (section-5 weak)', !!X.app.state.weakTopics['section-5']);

  const near = (a, b, t = 0.005) => Math.abs(a - b) <= t;
  assert('invNormCDF(0.975) ≈ 1.96', near(X.invNormCDF(0.975), 1.95996, 0.001));
  const fit = X.computeLSRL([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }]);
  assert('least-squares y=2x → b=2, r=1', near(fit.b, 2) && near(fit.r, 1));

  X.app.state = X.cloneDefaultState();
  X.recordAttempt({ questionId: 's7-q6', wasCorrect: false, source: 'mastery' });
  assert('missed mastery question enters review queue', X.getDueReviewEntries().some(e => e.questionId === 's7-q6'));
  X.recordAttempt({ questionId: 's7-q1', wasCorrect: true, source: 'mastery' });
  X.recordAttempt({ questionId: 's7-q2', wasCorrect: true, source: 'mastery' });
  X.recordAttempt({ questionId: 's7-q4', wasCorrect: true, source: 'mastery' });
  X.recordAttempt({ questionId: 's7-q8', wasCorrect: true, source: 'mastery' });
  assert('mastering a section marks it complete', !!X.app.state.completedSections['section-7'], 'score=' + (X.app.state.mastery['section-7'] || {}).score);
}

let fails = 0;
for (const [ok, n, e] of results) { if (!ok) fails++; console.log((ok ? 'PASS' : 'FAIL').padEnd(5) + n + (e ? ' — ' + e : '')); }
console.log('\n' + (fails ? `*** ${fails}/${results.length} FAILED ***` : `ALL PASS (${results.length} checks)`));
process.exit(fails ? 1 : 0);
