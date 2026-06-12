/* hero-anatomy.js — press & hold the homepage hero to dissect it.
   A spring-driven master value (--xray, 0→1) is the ONLY style JS writes
   per frame; local.css derives staged ramps (grids → dissolve → measure →
   labels) from it. Every annotation is read from getComputedStyle and
   getBoundingClientRect at build time, so the redlines cannot lie.
   The rAF loop only runs while something is moving — it parks itself
   the moment the spring settles and no hint needs following. */
(() => {
  'use strict';

  const section = document.getElementById('hero-1950');
  if (!section) return;
  const dissect = document.querySelector('.ha-dissect');
  const header = document.getElementById('cs-navigation');
  const hint = section.querySelector('.ha-cursor-hint');
  const toggle = document.getElementById('ha-spec-toggle');
  const live = document.getElementById('ha-spec-live');
  const img = section.querySelector('.cs-background img');
  const stamp = section.querySelector('.ha-stamp');
  if (!dissect || !toggle || !img) return;

  /* The dissect ships inside <main>, but main carries a view-transition-name
     (root.css), which forces a stacking context — nothing inside it can ever
     paint above the fixed header (z-index 10000), whatever its own z-index.
     Re-parent to <body> so the 10050 layer actually wins. */
  if (dissect.parentElement !== document.body) document.body.appendChild(dissect);

  /* ── Tuning constants ──────────────────────────────────────────── */
  const SPRING_IN = 0.085;
  const SPRING_OUT = 0.07;
  const SNAP_EPS = 0.0005;
  const HOLD_DELAY = 120;
  const MEASURE_OFF = 12;
  const ARROW = 5;
  const TOGGLE_GLIDE = 800;
  const MOVE_CANCEL = 10;
  const ENTRANCE = 2200;
  const ENTRANCE_HOLD = 450;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => innerWidth < 768;

  /* containers get no width hairline; labels treat only leaves as solid */
  const NO_HAIR = new Set(['section', 'navbar', 'topbar']);
  const LEAF_IDS = ['topper', 'title', 'text', 'button', 'worklink', 'logo', 'navcta', 'navul'];
  /* ── State ─────────────────────────────────────────────────────── */
  let X = 0, lastX = NaN;
  let holding = false, pinned = false;
  let owner = 'physics';            // "physics" | "tween"
  let tween = null;
  let heldOnce = false;
  let armTimer = 0, armX = 0, armY = 0;
  let px = innerWidth / 2, py = innerHeight / 2, hx = px, hy = py;
  let over = false;
  let built = false;
  let specs = [];                   // [{ id, el, rect, type }] — cached at build
  let secPageLeft = 0, secPageTop = 0;
  let rafId = 0;

  const linear = (t) => t;
  const power3InOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ── Owner protocol — one owner for X, ever ────────────────────── */
  function startTween(to, dur, ease) {
    owner = 'tween';
    tween = { from: X, to, start: performance.now(), dur, ease };
    ensureLoop();
  }
  function killTween() { tween = null; owner = 'physics'; }

  /* ── The driver — one write per frame, loop parks when idle ────── */
  function step(now) {
    if (owner === 'tween' && tween) {
      const t = Math.min(1, (now - tween.start) / tween.dur);
      X = tween.from + (tween.to - tween.from) * tween.ease(t);
      if (t >= 1) { tween = null; owner = 'physics'; }
    } else if (owner === 'physics' && !reduced) {
      const target = holding || pinned ? 1 : 0;
      const k = target === 1 ? SPRING_IN : SPRING_OUT;
      X += (target - X) * k;
      if (Math.abs(target - X) < SNAP_EPS) X = target;   // settle & stop writing
    }

    if (X !== lastX) {
      lastX = X;
      document.body.style.setProperty('--xray', X.toFixed(4));   // THE write
      if (X >= 0.9 && holding && !heldOnce) heldOnce = true;   // hint graduates
    }

    /* cursor hint — lerped follower */
    if (hint && !isMobile()) {
      hx += (px - hx) * 0.1;
      hy += (py - hy) * 0.1;
      hint.style.transform = `translate(${(hx + 18).toFixed(1)}px, ${(hy + 22).toFixed(1)}px)`;
      const show = over && !holding && !pinned && !heldOnce && X < 0.1;
      hint.classList.toggle('ha-on', show);
    }

    /* park the loop when nothing moves and nothing follows the cursor */
    const settled = !tween && !holding && !pinned && X === 0;
    const following = over && !heldOnce && !isMobile();
    if (settled && !following) { rafId = 0; return; }
    rafId = requestAnimationFrame(step);
  }
  function ensureLoop() {
    if (!rafId) rafId = requestAnimationFrame(step);
  }

  /* ── Token resolution — the card says --primary, never rgb() ───── */
  const TOKENS = ['--primary', '--primaryLight', '--secondary', '--headerColor',
    '--bodyTextColor', '--bodyTextColorWhite', '--dark', '--medium'];
  let tokenColors = [];
  function parseRGB(s) {
    const m = s.match(/-?[\d.]+(?:e-?\d+)?/g);
    if (!m) return [0, 0, 0];
    let [r, g, b] = m.map(Number);
    if (s.startsWith('color(')) { r *= 255; g *= 255; b *= 255; }  /* color(srgb r g b) is 0–1 */
    return [r, g, b];
  }
  function alphaOf(s) {
    const m = s.match(/-?[\d.]+(?:e-?\d+)?/g);
    return m && m.length >= 4 ? +m[3] : 1;
  }
  function resolveTokens() {
    const probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.appendChild(probe);
    tokenColors = TOKENS.map((name) => {
      probe.style.color = `var(${name})`;
      return { name, rgb: parseRGB(getComputedStyle(probe).color) };
    });
    probe.remove();
  }
  function tokenName(color) {
    const c = parseRGB(color);
    let best = null, bestD = Infinity;
    for (const t of tokenColors) {
      const d = (c[0] - t.rgb[0]) ** 2 + (c[1] - t.rgb[1]) ** 2 + (c[2] - t.rgb[2]) ** 2;
      if (d < bestD) { bestD = d; best = t.name; }
    }
    return best || '--bodyTextColorWhite';
  }

  /* ── Computed-style readers — annotations that cannot lie ──────── */
  function famName(fontFamily) {
    const f = fontFamily.split(',')[0].replace(/['"]/g, '').trim().toUpperCase();
    return f || 'SYSTEM';
  }
  function trackPct(cs) {
    const fs = parseFloat(cs.fontSize);
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
    const pct = (ls / fs) * 100;
    const s = (Math.round(pct * 10) / 10).toString();
    return pct > 0 ? `+${s}` : s;
  }
  function typeBits(el) {
    const cs = getComputedStyle(el);
    const fs = Math.round(parseFloat(cs.fontSize));
    const lhRaw = parseFloat(cs.lineHeight);
    return {
      fam: famName(cs.fontFamily),
      fs,
      lh: Number.isFinite(lhRaw) ? Math.round(lhRaw) : Math.round(fs * 1.2),
      wght: cs.fontWeight,
      track: trackPct(cs),
      color: tokenName(cs.color),
      bg: alphaOf(cs.backgroundColor) > 0 ? tokenName(cs.backgroundColor) : '—',
      opacity: (Math.round(parseFloat(cs.opacity) * 100) / 100).toString(),
      radius: Math.round(parseFloat(cs.borderTopLeftRadius)) || 0,
      margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft']
        .map((p) => Math.round(parseFloat(cs[p]))).join(' '),
      pad: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
        .map((p) => Math.round(parseFloat(cs[p]))).join(' '),
      gap: Math.round(parseFloat(cs.columnGap)) || 0,
      z: cs.zIndex,
    };
  }
  function imgBasename() {
    try {
      const src = img.currentSrc || img.src;
      return decodeURIComponent(src.split('/').pop().split('?')[0]) || 'hero-coding.jpg';
    } catch (_) { return 'hero-coding.jpg'; }
  }
  function redlineText(id, t) {
    switch (id) {
      case 'title': return `${t.fam} · ${t.fs}/${t.lh} · WGHT ${t.wght} · ${t.track}%`;
      case 'text': return `${t.fam} · ${t.fs}/${t.lh} · ${t.color} · OPACITY ${t.opacity}`;
      case 'topper': return `BG ${t.bg} · TRACK ${t.track}% · RADIUS ${t.radius}`;
      case 'button': return `BG ${t.bg} · ${t.fam} ${t.fs}/${t.lh} · WGHT ${t.wght}`;
      case 'worklink': return `${t.fam} · ${t.fs}/${t.lh} · WGHT ${t.wght} · HOVER --primaryLight`;
      case 'navbar': return `BG ${t.bg} · Z ${t.z} · W 100%`;
      case 'logo': return `LOGO.SVG · OBJECT-CONTAIN · AR 509:174`;
      case 'navul': return `${t.fam} · ${t.fs}/${t.lh} · GAP ${t.gap}`;
      case 'navcta': return `BG ${t.bg} · ${t.fam} ${t.fs}/${t.lh} · WGHT ${t.wght}`;
      default: return `${t.fam} · ${t.fs}/${t.lh} · ${t.track}%`;
    }
  }


  /* ── Measurement overlays — built once, never in the hold path ─── */
  const SVG = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    const n = document.createElementNS(SVG, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  let maskSeq = 0;
  function buildMeasure(spec) {
    const { rect, id } = spec;
    const PAD = 24, w = rect.w, h = rect.h;
    const svg = svgEl('svg', {
      class: 'ha-measure',
      width: w + PAD * 2, height: h + PAD * 2,
    });
    svg.style.left = `${rect.x - PAD}px`;
    svg.style.top = `${rect.y - PAD}px`;

    /* the dashed box draws on around its perimeter: a solid mask rect
       sweeps the same path (same dash technique as the hairlines) and
       progressively reveals the dashed stroke beneath it */
    const mid = `ha-bm-${maskSeq++}`;
    const boxAttrs = {
      x: PAD + 0.5, y: PAD + 0.5, width: Math.max(1, w - 1), height: Math.max(1, h - 1),
      pathLength: 100,
    };
    const defs = svgEl('defs', {});
    const mask = svgEl('mask', { id: mid, maskUnits: 'userSpaceOnUse',
      x: 0, y: 0, width: w + PAD * 2, height: h + PAD * 2 });
    mask.appendChild(svgEl('rect', { ...boxAttrs, class: 'ha-draw' }));
    defs.appendChild(mask);
    svg.appendChild(defs);
    svg.appendChild(svgEl('rect', { ...boxAttrs, class: 'ha-dash-box', mask: `url(#${mid})` }));

    if (!NO_HAIR.has(id)) {
      const y = PAD - MEASURE_OFF;
      const hair = svgEl('line', { x1: PAD, y1: y, x2: PAD + w, y2: y, class: 'ha-hairline' });
      hair.style.setProperty('--len', w.toFixed(1));
      svg.appendChild(hair);
      svg.appendChild(svgEl('path', {
        d: `M ${PAD + ARROW} ${y - 3} L ${PAD} ${y} L ${PAD + ARROW} ${y + 3}`, class: 'ha-arrow' }));
      svg.appendChild(svgEl('path', {
        d: `M ${PAD + w - ARROW} ${y - 3} L ${PAD + w} ${y} L ${PAD + w - ARROW} ${y + 3}`, class: 'ha-arrow' }));
    }
    return svg;
  }
  function buildGap(a, b) {
    const gap = b.rect.y - (a.rect.y + a.rect.h);
    const x = Math.max(a.rect.x, b.rect.x) + 16;
    const top = a.rect.y + a.rect.h;
    const svg = svgEl('svg', { class: 'ha-measure', width: 90, height: gap });
    svg.style.left = `${x - 20}px`;
    svg.style.top = `${top}px`;
    const hair = svgEl('line', { x1: 20, y1: 0, x2: 20, y2: gap, class: 'ha-hairline' });
    hair.style.setProperty('--len', gap.toFixed(1));
    svg.appendChild(hair);
    svg.appendChild(svgEl('path', { d: `M 17 ${ARROW} L 20 0 L 23 ${ARROW}`, class: 'ha-arrow' }));
    svg.appendChild(svgEl('path', { d: `M 17 ${gap - ARROW} L 20 ${gap} L 23 ${gap - ARROW}`, class: 'ha-arrow' }));
    const label = svgEl('text', { x: 28, y: gap / 2 + 3 });
    label.textContent = `↕ ${Math.round(gap)}`;
    svg.appendChild(label);
    return { svg, label, left: x - 20, top };
  }
  /* ── Label layout — measured widths, candidate positions, no text
     ever lands on other text or on a neighbouring element ──────────── */
  function placeLabels(secW, gapSvgs) {
    const items = specs.filter((s) => s.id !== 'section');
    const obstacles = specs.filter((s) => LEAF_IDS.includes(s.id)).map((s) => s.rect);
    const placed = [];
    const inter = (a, b, pad) =>
      a.x < b.x + b.w + pad && a.x + a.w + pad > b.x &&
      a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
    const blocked = (r, self) =>
      placed.some((p) => inter(r, p, 6)) ||
      obstacles.some((o) => o !== self && inter(r, o, 2));

    const jobs = [];
    const mk = (txt) => {
      const el = document.createElement('div');
      el.className = 'ha-redline';
      el.textContent = txt;
      dissect.appendChild(el);
      return el;
    };
    for (const sp of items) {
      jobs.push({ sp, el: mk(`${Math.round(sp.rect.w)} × ${Math.round(sp.rect.h)}`), dims: true });
      /* the long type redlines need horizontal room mobile doesn't have */
      if (!isMobile()) jobs.push({ sp, el: mk(redlineText(sp.id, sp.type)), dims: false });
    }
    for (const j of jobs) { j.w = j.el.offsetWidth; j.h = j.el.offsetHeight || 13; }   // one reflow

    for (const j of jobs) {
      const r = j.sp.rect;
      const cands = j.dims ? [
        { x: r.x + r.w - j.w, y: r.y - 28 },                 // above, right-aligned
        { x: r.x + r.w + 10, y: r.y + r.h / 2 - j.h / 2 },   // beside, right
        { x: r.x + r.w - j.w, y: r.y + r.h + 8 },            // below, right-aligned
      ] : [
        { x: r.x, y: r.y - 28 },                             // above, left-aligned
        { x: r.x, y: r.y + r.h + 8 },                        // below, left-aligned
        { x: r.x + r.w + 12, y: r.y + r.h / 2 - j.h / 2 },   // beside, right
        { x: r.x + 6, y: r.y + 6 },                          // inside, last resort
      ];
      let pos = null;
      for (const c of cands) {
        if (c.y < 4) continue;   // never force a label above the canvas
        const cc = { x: Math.max(8, Math.min(c.x, secW - j.w - 8)), y: Math.max(4, c.y), w: j.w, h: j.h };
        if (!blocked(cc, r)) { pos = cc; break; }
      }
      if (!pos) {
        const c = cands[cands.length - 1];
        pos = { x: Math.max(8, Math.min(c.x, secW - j.w - 8)), y: Math.max(4, c.y), w: j.w, h: j.h };
      }
      j.el.style.left = `${pos.x}px`;
      j.el.style.top = `${pos.y}px`;
      placed.push(pos);
    }

    /* gap labels — nudge right until clear; hopeless ones keep only the hairline */
    for (const g of gapSvgs) {
      let bb;
      try { bb = g.label.getBBox(); } catch (_) { continue; }
      const r = { x: g.left + bb.x, y: g.top + bb.y, w: bb.width, h: bb.height };
      const startX = r.x;
      let tries = 0;
      while (blocked(r, null) && tries++ < 8) r.x += 24;
      if (tries > 8) { g.label.remove(); continue; }
      if (r.x !== startX) g.label.setAttribute('x', +g.label.getAttribute('x') + (r.x - startX));
      placed.push(r);
    }
  }

  let buildRetries = 0;
  function buildAll() {
    /* local.css loads async — never build raw SVG against missing styles */
    if (getComputedStyle(dissect).position !== 'absolute') {
      if (buildRetries++ < 20) setTimeout(buildAll, 250);
      return;
    }
    /* measure with the entrance pre-state lifted so rects aren't read
       mid-transform — sync remove/add never reaches the screen */
    const wasBooting = document.documentElement.classList.contains('ha-booting');
    if (wasBooting) document.documentElement.classList.remove('ha-booting');

    built = true;
    dissect.textContent = '';

    resolveTokens();
    const secRect = section.getBoundingClientRect();
    secPageLeft = secRect.left + scrollX;
    secPageTop = secRect.top + scrollY;
    dissect.style.top = `${secPageTop}px`;
    dissect.style.left = `${secPageLeft}px`;
    dissect.style.width = `${secRect.width}px`;
    dissect.style.height = `${secRect.height}px`;

    specs = [...document.querySelectorAll('[data-spec]')]
      .map((el) => {
        const id = el.dataset.specId;
        const r = el.getBoundingClientRect();
        return {
          id, el,
          rect: { x: r.left - secRect.left, y: r.top - secRect.top, w: r.width, h: r.height },
          type: typeBits(el),
        };
      })
      /* the size gate alone decides what mobile annotates: the hamburger-
         hidden nav list and CTA collapse to zero-rects and drop out, while
         the visible header (navbar, logo, top bar) keeps its redlines */
      .filter((sp) => sp.id === 'section' || (sp.rect.w > 8 && sp.rect.h > 8));

    const mobile = isMobile();
    for (const s of specs) {
      if (s.id !== 'section' || !mobile) dissect.appendChild(buildMeasure(s));
    }

    /* gap hairlines to the nearest annotated neighbour below */
    const gapSvgs = [];
    const annotated = specs.filter((s) => s.id !== 'section');
    for (const a of annotated) {
      let best = null, bestGap = Infinity;
      for (const b of annotated) {
        if (b === a) continue;
        const gap = b.rect.y - (a.rect.y + a.rect.h);
        const overlap = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w) - Math.max(a.rect.x, b.rect.x);
        if (gap > 6 && gap < 220 && overlap > 24 && gap < bestGap) { bestGap = gap; best = b; }
      }
      if (best) {
        const g = buildGap(a, best);
        dissect.appendChild(g.svg);
        gapSvgs.push(g);
      }
    }

    placeLabels(secRect.width, gapSvgs);

    if (wasBooting) document.documentElement.classList.add('ha-booting');
  }
  function ensureBuilt() { if (!built) buildAll(); }


  /* ── Input ─────────────────────────────────────────────────────── */
  function beginHold() {
    armTimer = 0;
    holding = true;
    if (reduced) startTween(1, 250, linear);
    else killTween();   // physics claims X from wherever it stands
    ensureLoop();
  }
  function endHold() {
    clearTimeout(armTimer); armTimer = 0;
    if (!holding) return;
    holding = false;
    if (reduced && !pinned) startTween(0, 250, linear);
  }
  const onPointerDown = (e) => {
    if (e.target.closest('a, button, label, input')) return;
    if (owner === 'tween' && !reduced) killTween();   // a press kills the entrance
    ensureBuilt();
    armX = e.clientX; armY = e.clientY;
    clearTimeout(armTimer);
    armTimer = setTimeout(beginHold, HOLD_DELAY);
  };
  const onPointerEnter = () => {
    over = true;
    ensureBuilt();
    ensureLoop();
  };
  const onPointerLeave = () => { over = false; };
  const onPointerMove = (e) => {
    px = e.clientX; py = e.clientY; over = true;
    ensureLoop();
    if (armTimer && Math.hypot(e.clientX - armX, e.clientY - armY) > MOVE_CANCEL) {
      clearTimeout(armTimer); armTimer = 0;   // scroll-intent guard
    }
  };
  const onContextMenu = (e) => { if (holding || armTimer) e.preventDefault(); };
  for (const t of [section, header].filter(Boolean)) {
    t.addEventListener('pointerdown', onPointerDown);
    t.addEventListener('pointerenter', onPointerEnter);
    t.addEventListener('pointerleave', onPointerLeave);
    t.addEventListener('pointermove', onPointerMove);
    t.addEventListener('pointerup', endHold);
    t.addEventListener('pointercancel', endHold);
    t.addEventListener('contextmenu', onContextMenu);
  }

  toggle.addEventListener('change', () => {
    ensureBuilt();
    pinned = toggle.checked;
    section.toggleAttribute('data-pinned', pinned);
    if (live) live.textContent = pinned ? 'Spec view on' : 'Spec view off';
    if (reduced) startTween(pinned ? 1 : 0, 250, linear);
    else startTween(pinned ? 1 : 0, TOGGLE_GLIDE, power3InOut);
  });

  /* the header is position:fixed — its hero-relative geometry changes with
     scroll (and body.scroll collapses the top bar), so re-measure once
     scrolling settles */
  let scrollT = 0, lastScrollY = scrollY;
  addEventListener('scroll', () => {
    if (!built) return;
    clearTimeout(scrollT);
    scrollT = setTimeout(() => {
      if (scrollY === lastScrollY) return;
      lastScrollY = scrollY;
      buildAll();
    }, 200);
  }, { passive: true });

  /* ── Re-measure outside the hold path ──────────────────────────── */
  let resizeT = 0;
  addEventListener('resize', () => {
    if (!built) return;
    clearTimeout(resizeT);
    resizeT = setTimeout(buildAll, 150);
  });

  /* theme flips swap every token — rebuild so the cards keep telling
     the truth (site-effects.js toggles body.dark-mode) */
  let themeT = 0;
  let lastDark = document.body.classList.contains('dark-mode');
  new MutationObserver(() => {
    const dark = document.body.classList.contains('dark-mode');
    if (dark === lastDark) return;        // body.scroll churns the class list too
    lastDark = dark;
    if (!built) return;
    clearTimeout(themeT);
    themeT = setTimeout(buildAll, 350);   // wait out the theme wipe transition
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* ── Placeholder stamp — written from the actual response ──────── */
  function stampReal() {
    if (!stamp) return;
    try {
      const dims = img.naturalWidth ? ` · ${img.naturalWidth}×${img.naturalHeight}` : '';
      const entry = performance.getEntriesByName(img.currentSrc)[0];
      const kb = entry && entry.transferSize > 0
        ? ` · ${Math.round(entry.transferSize / 1024)} KB` : '';
      stamp.textContent = `${imgBasename()}${dims}${kb} · OBJECT-COVER`;
    } catch (_) { /* keep the literal */ }
  }
  if (img.complete && img.naturalWidth) stampReal();
  else img.addEventListener('load', stampReal);

  /* ── Entrance — born as a blueprint ────────────────────────────── */
  /* The inline script in index.html set html.ha-booting before first
     paint (once per session, never for reduced-motion), so the page is
     currently holding the full-x-ray pre-state. Measure the clean layout
     without ever painting it, restore the boot, then release. */
  const html = document.documentElement;
  const booting = html.classList.contains('ha-booting');
  if (booting) {
    try { sessionStorage.setItem('ha-booted', '1'); } catch (_) {}
    X = 1;
    owner = 'tween';                 // parks physics until the glide begins
    document.body.style.setProperty('--xray', '1');
    const begin = () => {
      buildAll();                    // measures with the boot state lifted
      document.body.classList.add('ha-reveal');
      /* release once local.css has applied (so the reveal transitions exist),
         with a frame cap so a stalled stylesheet can't hold the page hostage */
      const release = (tries) => {
        if (tries < 60 && getComputedStyle(dissect).position !== 'absolute') {
          requestAnimationFrame(() => release(tries + 1));
          return;
        }
        requestAnimationFrame(() => requestAnimationFrame(() => {
          html.classList.remove('ha-booting');
        }));
      };
      release(0);
      setTimeout(() => {
        if (owner === 'tween' && !tween) startTween(0, ENTRANCE, power3InOut);
      }, ENTRANCE_HOLD);
    };
    /* measure AFTER webfonts land — otherwise the boxes are drawn against
       the fallback-font layout and sit visibly off until the re-measure */
    const fontsReady = document.fonts && document.fonts.ready
      ? document.fonts.ready : Promise.resolve();
    Promise.race([
      fontsReady,
      new Promise((res) => setTimeout(res, 1500)),
    ]).then(begin);
    ensureLoop();
  }

  /* ── Mount — everything heavy waits for idle or first touch ────── */
  function idleBuild() { if (!built) buildAll(); }
  if ('requestIdleCallback' in window) requestIdleCallback(idleBuild, { timeout: 4000 });
  else setTimeout(idleBuild, 2500);

  if (document.fonts && document.fonts.ready) {
    /* re-measure once webfonts land — metrics shift, redlines must not lie.
       After an entrance, wait it out so rects aren't read mid-transform. */
    document.fonts.ready.then(() => {
      setTimeout(() => { if (built) buildAll(); }, booting ? 2600 : 100);
    });
  }
})();
