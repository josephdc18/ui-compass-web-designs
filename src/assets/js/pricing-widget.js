/**
 * pricing-widget.js
 * Drives the inline pricing widget on /pricing/ (#price-widget-1701).
 * Vanilla JS only. No deps. Self-executing IIFE.
 *
 * Responsibilities:
 *  - State (siteType, pages, blog, view) with localStorage + URL-param sync
 *  - Segmented controls with FLIP-style sliding pill
 *  - Stepper + drag-to-scrub on the page count
 *  - Switch (blog) with ARIA
 *  - Live calculation + animated number rolls + breakdown line slide-in/out
 *  - Sticky summary chip via IntersectionObserver
 *  - prefers-reduced-motion respected throughout
 *
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ DISABLED ON 2026-05-09. The IIFE below is DEFINED but NEVER INVOKED
 * (the trailing `()` was removed — see the very last line of this file).
 * The matching markup is commented out in src/pages/pricing.html and the
 * matching stylesheet is gated behind `@media (width: 0px)` in
 * src/css/pricing-widget.css. To restore: change the final `)` to `)()`
 * and follow the steps in LLM/CLAUDE.md → "Parked / disabled code".
 */
/* WIDGET-DISABLED — IIFE defined but not invoked. See bottom of file. */
(function () {
  'use strict';

  /* ─────────────────  Config  ───────────────── */
  var PRICING = {
    monthly: { base: 150 },
    lump:    { base: 3000, perPage: 100, freePages: 5, blogAddon: 250, hosting: 25 },
    store:   { startsAt: 6500 }
  };
  var DEFAULTS = { siteType: 'brochure', pages: 5, blog: false, view: 'both' };
  var LIMITS   = { pagesMin: 1, pagesMax: 30 };
  var STORAGE_KEY = 'uic_pw_v1';
  var SCRUB_PX_PER_UNIT = 10;
  var ROLL_DURATION = 280;

  /* ─────────────────  Boot  ───────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var root = document.querySelector('[data-pricing-widget]');
    if (!root) return;

    var els = collectElements(root);
    var state = hydrate();
    var prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Watch for the user toggling reduced-motion mid-session.
    try {
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) {
        prefersReduce = e.matches;
      });
    } catch (e) { /* Safari < 14 */ }

    /* Tracks last-rendered numeric values so we can animate from→to. */
    var lastTotals = { monthly: null, lump: null };

    bindSegmented(root, 'siteType', function (val) {
      state.siteType = val;
      // Auto-orient: picking "Blog" implies the blog add-on is on; "Brochure" turns it off.
      if (val === 'blog') setSwitch('blog', true);
      if (val === 'brochure') setSwitch('blog', false);
      // "Online store" → render the store-only card; hide the view toggle.
      root.dataset.state = val;
      render({ source: 'siteType' });
      persist();
    });

    bindSegmented(root, 'view', function (val) {
      state.view = val;
      render({ source: 'view' });
      persist();
    });

    bindStepper(els, function (newVal, prev) {
      state.pages = newVal;
      render({ source: 'pages', changed: prev !== newVal });
      persist();
    });

    bindSwitch(root, 'blog', function (on) {
      state.blog = on;
      render({ source: 'blog' });
      persist();
    });

    bindReset(root, function () {
      Object.assign(state, DEFAULTS);
      writeAllControls();
      render({ source: 'reset' });
      persist();
    });

    bindCardCtas(root);

    setupStickyChip(root);

    // Initial paint + pill positioning. Use rAF so initial layout is settled.
    writeAllControls();
    requestAnimationFrame(function () {
      updateAllPills();
      render({ source: 'init' });
      // Re-place pills after fonts load (font swap can change widths).
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(updateAllPills).catch(function () {});
      }
    });

    // Keep the pill correctly positioned on window resize.
    var resizeRaf = null;
    window.addEventListener('resize', function () {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(updateAllPills);
    }, { passive: true });

    /* ─────────────────  DOM helpers  ───────────────── */
    function collectElements(rootEl) {
      return {
        root: rootEl,
        pagesField: rootEl.querySelector('[data-pages-field]'),
        pagesInput: rootEl.querySelector('[data-pages-input]'),
        pagesDisplay: rootEl.querySelector('[data-scrub]'),
        stepperBtns: rootEl.querySelectorAll('[data-stepper] [data-step]'),
        cardsWrap: rootEl.querySelector('[data-cards]'),
        cardMonthly: rootEl.querySelector('[data-card="monthly"]'),
        cardLump: rootEl.querySelector('[data-card="lump"]'),
        cardStore: rootEl.querySelector('[data-card="store"]'),
        chip: document.querySelector('[data-pw-chip]'),
        chipSummary: document.querySelector('[data-chip-summary]')
      };
    }

    /* ─────────────────  State persistence  ───────────────── */
    function hydrate() {
      var s = Object.assign({}, DEFAULTS);
      // localStorage first.
      try {
        var stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (stored && typeof stored === 'object') Object.assign(s, stored);
      } catch (e) { /* ignore */ }
      // URL params override (so a shared link wins).
      try {
        var params = new URLSearchParams(window.location.search);
        if (params.has('pages')) {
          var p = parseInt(params.get('pages'), 10);
          if (!isNaN(p)) s.pages = clampPages(p);
        }
        if (params.has('blog')) s.blog = params.get('blog') === '1' || params.get('blog') === 'true';
        if (params.has('view')) {
          var v = params.get('view');
          if (v === 'both' || v === 'monthly' || v === 'lump') s.view = v;
        }
        if (params.has('type')) {
          var t = params.get('type');
          if (t === 'brochure' || t === 'blog' || t === 'store') s.siteType = t;
        }
      } catch (e) { /* ignore */ }
      // Sanity clamp.
      s.pages = clampPages(s.pages);
      return s;
    }

    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) { /* private mode */ }
      // Sync URL (replaceState — no history pollution).
      try {
        var params = new URLSearchParams();
        if (state.siteType !== DEFAULTS.siteType) params.set('type', state.siteType);
        if (state.pages !== DEFAULTS.pages)       params.set('pages', String(state.pages));
        if (state.blog !== DEFAULTS.blog)         params.set('blog', state.blog ? '1' : '0');
        if (state.view !== DEFAULTS.view)         params.set('view', state.view);
        var qs = params.toString();
        var newUrl = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
        window.history.replaceState(null, '', newUrl);
      } catch (e) { /* ignore */ }
    }

    function writeAllControls() {
      // Segmented controls
      ['siteType', 'view'].forEach(function (group) {
        var seg = root.querySelector('[data-segmented="' + group + '"]');
        if (!seg) return;
        var current = state[group];
        seg.querySelectorAll('button[role="radio"]').forEach(function (btn) {
          var isActive = btn.dataset.value === current;
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
          btn.tabIndex = isActive ? 0 : -1;
        });
      });
      root.dataset.state = state.siteType;
      // Stepper
      if (els.pagesInput) els.pagesInput.value = state.pages;
      // (input itself is the spinbutton; no need to mirror aria-valuenow on the wrapper)
      // Switch
      var sw = root.querySelector('[data-switch="blog"]');
      if (sw) {
        sw.setAttribute('aria-checked', state.blog ? 'true' : 'false');
        var lbl = sw.querySelector('[data-switch-state]');
        if (lbl) lbl.textContent = state.blog ? 'on' : 'off';
      }
    }

    /* ─────────────────  Segmented control (sliding pill via FLIP)  ───────────────── */
    function bindSegmented(rootEl, group, onChange) {
      var seg = rootEl.querySelector('[data-segmented="' + group + '"]');
      if (!seg) return;
      var btns = Array.prototype.slice.call(seg.querySelectorAll('button[role="radio"]'));
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.getAttribute('aria-checked') === 'true') return;
          btns.forEach(function (b) {
            b.setAttribute('aria-checked', 'false');
            b.tabIndex = -1;
          });
          btn.setAttribute('aria-checked', 'true');
          btn.tabIndex = 0;
          updatePill(seg);
          onChange(btn.dataset.value);
        });
        btn.addEventListener('keydown', function (e) {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          var idx = btns.indexOf(btn);
          var next = e.key === 'ArrowRight' ? (idx + 1) % btns.length : (idx - 1 + btns.length) % btns.length;
          btns[next].focus();
          btns[next].click();
        });
      });
    }

    function updatePill(seg) {
      var pill = seg.querySelector('.pw-pill');
      var active = seg.querySelector('button[aria-checked="true"]');
      if (!pill || !active) return;
      var segRect = seg.getBoundingClientRect();
      var btnRect = active.getBoundingClientRect();
      var styles = window.getComputedStyle(seg);
      var padL = parseFloat(styles.paddingLeft) || 0;
      var padT = parseFloat(styles.paddingTop) || 0;
      pill.style.width = btnRect.width + 'px';
      pill.style.height = btnRect.height + 'px';
      pill.style.transform = 'translate(' +
        (btnRect.left - segRect.left - padL) + 'px, ' +
        (btnRect.top - segRect.top - padT) + 'px)';
    }

    function updateAllPills() {
      root.querySelectorAll('[data-segmented]').forEach(updatePill);
    }

    /* ─────────────────  Stepper + drag-to-scrub  ───────────────── */
    function bindStepper(elsRef, onChange) {
      // ± buttons
      elsRef.stepperBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var step = parseInt(btn.dataset.step, 10) || 0;
          changePages(state.pages + step);
        });
      });
      // Direct typing
      if (elsRef.pagesInput) {
        elsRef.pagesInput.addEventListener('input', function () {
          var v = parseInt(elsRef.pagesInput.value, 10);
          if (isNaN(v)) return;  // keep partial input editable
          changePages(v);
        });
        elsRef.pagesInput.addEventListener('blur', function () {
          // On blur, force-clamp into bounds.
          var v = parseInt(elsRef.pagesInput.value, 10);
          if (isNaN(v)) v = DEFAULTS.pages;
          changePages(v);
        });
        // Arrow keys handled natively by <input type="number">.
      }
      // Drag the digit horizontally to scrub.
      bindDragScrub(elsRef.pagesDisplay);

      function changePages(next) {
        var clamped = clampPages(next);
        var prev = state.pages;
        if (prev === clamped) {
          if (elsRef.pagesInput && parseInt(elsRef.pagesInput.value, 10) !== clamped) {
            elsRef.pagesInput.value = clamped;
          }
          return;
        }
        if (elsRef.pagesInput) elsRef.pagesInput.value = clamped;
        // (input itself is the spinbutton; aria-valuenow not needed on the wrapper)
        onChange(clamped, prev);
        // Disable ± at limits
        elsRef.stepperBtns.forEach(function (btn) {
          var step = parseInt(btn.dataset.step, 10) || 0;
          var wouldBe = clampPages(clamped + step);
          btn.disabled = wouldBe === clamped;
        });
      }
    }

    function bindDragScrub(displayEl) {
      if (!displayEl) return;
      var dragging = false;
      var startX = 0;
      var startVal = 0;
      var pointerId = null;
      var moved = false;

      displayEl.addEventListener('pointerdown', function (e) {
        // Don't hijack clicks on the input itself.
        if (e.target.tagName === 'INPUT') return;
        dragging = true;
        moved = false;
        startX = e.clientX;
        startVal = state.pages;
        pointerId = e.pointerId;
        displayEl.dataset.dragging = 'true';
        try { displayEl.setPointerCapture(pointerId); } catch (err) { /* noop */ }
      });

      window.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 3) moved = true;
        var step = Math.round(dx / SCRUB_PX_PER_UNIT);
        var next = clampPages(startVal + step);
        if (next === state.pages) return;
        state.pages = next;
        if (els.pagesInput) els.pagesInput.value = next;
        // (no aria-valuenow on wrapper — input is the spinbutton)
        render({ source: 'pages-scrub' });
        persist();
      });

      window.addEventListener('pointerup', function (e) {
        if (!dragging) return;
        dragging = false;
        displayEl.dataset.dragging = 'false';
        try { if (pointerId !== null) displayEl.releasePointerCapture(pointerId); } catch (err) { /* noop */ }
        // If the pointer didn't move, treat it as a click → focus the input for typing.
        if (!moved && els.pagesInput) {
          els.pagesInput.focus();
          els.pagesInput.select();
        }
      });
    }

    /* ─────────────────  Switch  ───────────────── */
    function bindSwitch(rootEl, name, onChange) {
      var btn = rootEl.querySelector('[data-switch="' + name + '"]');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var next = btn.getAttribute('aria-checked') !== 'true';
        setSwitch(name, next);
        onChange(next);
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        btn.click();
      });
    }

    function setSwitch(name, on) {
      var btn = root.querySelector('[data-switch="' + name + '"]');
      if (!btn) return;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      var lbl = btn.querySelector('[data-switch-state]');
      if (lbl) lbl.textContent = on ? 'on' : 'off';
      state[name] = on;
    }

    /* ─────────────────  Reset  ───────────────── */
    function bindReset(rootEl, onReset) {
      var btn = rootEl.querySelector('[data-pw-reset]');
      if (!btn) return;
      btn.addEventListener('click', function () {
        onReset();
        // Re-position pills after the controls' DOM has been rewritten.
        requestAnimationFrame(updateAllPills);
      });
    }

    /* ─────────────────  Card CTAs (carry context to /contact/)  ───────────────── */
    function bindCardCtas(rootEl) {
      var ctas = rootEl.querySelectorAll('[data-cta]');
      function refresh() {
        ctas.forEach(function (a) {
          var plan = a.dataset.cta;
          var qs = new URLSearchParams();
          qs.set('plan', plan);
          if (state.siteType !== DEFAULTS.siteType) qs.set('type', state.siteType);
          if (state.pages !== DEFAULTS.pages) qs.set('pages', String(state.pages));
          if (state.blog) qs.set('blog', '1');
          a.href = '/contact/?' + qs.toString();
        });
      }
      refresh();
      // Re-run on every render — cheap.
      bindCardCtas.refresh = refresh;
    }

    /* ─────────────────  Calculation  ───────────────── */
    function calc() {
      var extraPages = Math.max(0, state.pages - PRICING.lump.freePages);
      var extraCost = extraPages * PRICING.lump.perPage;
      var blogCost = state.blog ? PRICING.lump.blogAddon : 0;
      var lumpTotal = PRICING.lump.base + extraCost + blogCost;
      var monthlyTotal = PRICING.monthly.base;
      return {
        monthlyTotal: monthlyTotal,
        lumpTotal: lumpTotal,
        extraPages: extraPages,
        extraCost: extraCost,
        blogCost: blogCost,
        hasExtras: extraPages > 0,
        hasBlog: state.blog
      };
    }

    /* ─────────────────  Render  ───────────────── */
    function render(opts) {
      opts = opts || {};
      var siteType = state.siteType;

      // Toggle which cards are visible.
      if (siteType === 'store') {
        showCard(els.cardStore);
        hideCard(els.cardMonthly);
        hideCard(els.cardLump);
        els.cardsWrap.dataset.view = 'store';
      } else {
        hideCard(els.cardStore);
        var view = state.view;
        if (view === 'monthly') {
          showCard(els.cardMonthly);
          hideCard(els.cardLump);
        } else if (view === 'lump') {
          hideCard(els.cardMonthly);
          showCard(els.cardLump);
        } else {
          showCard(els.cardMonthly);
          showCard(els.cardLump);
        }
        els.cardsWrap.dataset.view = view;
      }

      // For brochure/blog: update prices and breakdown.
      if (siteType !== 'store') {
        var c = calc();
        updateCardPrice(els.cardMonthly, c.monthlyTotal, opts);
        updateCardPrice(els.cardLump, c.lumpTotal, opts);
        updateBreakdown(els.cardMonthly, 'monthly', c, opts);
        updateBreakdown(els.cardLump, 'lump', c, opts);
        lastTotals.monthly = c.monthlyTotal;
        lastTotals.lump = c.lumpTotal;
      }

      // Refresh CTA hrefs to carry current selections into /contact/.
      if (typeof bindCardCtas.refresh === 'function') bindCardCtas.refresh();

      // Update sticky chip text.
      updateChipSummary();

      // Update "Show me" view-toggle pill in case view changed.
      var viewSeg = root.querySelector('[data-segmented="view"]');
      if (viewSeg) updatePill(viewSeg);
    }

    function showCard(card) {
      if (!card || !card.hasAttribute('hidden')) return;
      card.removeAttribute('hidden');
      if (!prefersReduce) {
        card.classList.remove('is-entering');
        // Force reflow so animation re-runs.
        void card.offsetWidth;
        card.classList.add('is-entering');
      }
    }
    function hideCard(card) {
      if (!card || card.hasAttribute('hidden')) return;
      card.setAttribute('hidden', '');
    }

    function updateCardPrice(card, target, opts) {
      if (!card) return;
      var amountEl = card.querySelector('[data-roller]');
      if (!amountEl) return;
      var prev = parseInt(amountEl.dataset.target || amountEl.textContent.replace(/,/g, ''), 10);
      if (isNaN(prev)) prev = target;
      amountEl.dataset.target = String(target);
      if (prev === target) return;
      // Pulse the price block when the number changes.
      var priceEl = card.querySelector('[data-price]');
      if (priceEl && opts.source !== 'init' && opts.source !== 'view') {
        priceEl.classList.remove('is-flash');
        void priceEl.offsetWidth;
        priceEl.classList.add('is-flash');
      }
      animateNumber(amountEl, prev, target);
    }

    function updateBreakdown(card, kind, c, opts) {
      if (!card) return;
      // Extra pages line
      var extraLine = card.querySelector('[data-line="extraPages"]');
      if (extraLine) {
        var countEl = extraLine.querySelector('[data-extra-count]');
        var costEl = extraLine.querySelector('[data-extra-cost]');
        if (countEl) countEl.textContent = String(c.extraPages);
        if (costEl) costEl.textContent = formatNumber(c.extraCost);
        if (c.hasExtras) {
          showLine(extraLine, opts.source === 'pages' || opts.source === 'pages-scrub');
        } else {
          hideLine(extraLine);
        }
      }
      // Blog line
      var blogLine = card.querySelector('[data-line="blog"]');
      if (blogLine) {
        if (c.hasBlog) showLine(blogLine, opts.source === 'blog' || opts.source === 'siteType');
        else hideLine(blogLine);
      }
      // Monthly-only "rolled" note appears once there's any extra cost.
      if (kind === 'monthly') {
        var rolledLine = card.querySelector('[data-line="rolled"]');
        if (rolledLine) {
          if (c.hasExtras || c.hasBlog) showLine(rolledLine, false);
          else hideLine(rolledLine);
        }
      }
    }

    function showLine(line, pulse) {
      var wasHidden = line.hasAttribute('hidden');
      if (wasHidden) line.removeAttribute('hidden');
      if (pulse && !prefersReduce) {
        line.classList.remove('is-pulse');
        void line.offsetWidth;
        line.classList.add('is-pulse');
        setTimeout(function () { line.classList.remove('is-pulse'); }, 900);
      }
    }
    function hideLine(line) {
      if (!line.hasAttribute('hidden')) line.setAttribute('hidden', '');
      line.classList.remove('is-pulse');
    }

    /* ─────────────────  Number rolling (rAF + ease-out cubic)  ───────────────── */
    function animateNumber(el, from, to) {
      if (prefersReduce) {
        el.textContent = formatNumber(to);
        return;
      }
      var start = performance.now();
      var delta = to - from;
      function frame(now) {
        var t = Math.min(1, (now - start) / ROLL_DURATION);
        var eased = 1 - Math.pow(1 - t, 3);
        var current = Math.round(from + delta * eased);
        el.textContent = formatNumber(current);
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    /* ─────────────────  Sticky summary chip  ───────────────── */
    function setupStickyChip(rootEl) {
      var chip = els.chip;
      if (!chip || !('IntersectionObserver' in window)) return;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          // Show the chip when we're scrolled BELOW the widget (not above it).
          var pastWidget = !entry.isIntersecting && entry.boundingClientRect.top < 0;
          if (pastWidget) {
            chip.removeAttribute('hidden');
            chip.setAttribute('aria-hidden', 'false');
          } else {
            chip.setAttribute('hidden', '');
            chip.setAttribute('aria-hidden', 'true');
          }
        });
      }, { threshold: 0, rootMargin: '0px 0px -80% 0px' });
      observer.observe(rootEl);
    }

    function updateChipSummary() {
      if (!els.chipSummary) return;
      var parts = [];
      parts.push(state.pages + (state.pages === 1 ? ' page' : ' pages'));
      if (state.blog) parts.push('blog');
      if (state.siteType === 'store') {
        parts.push('store · $6,500+');
      } else {
        var c = calc();
        if (state.view === 'monthly') {
          parts.push('$' + formatNumber(c.monthlyTotal) + '/mo');
        } else if (state.view === 'lump') {
          parts.push('$' + formatNumber(c.lumpTotal));
        } else {
          parts.push('$' + formatNumber(c.lumpTotal) + ' or $' + formatNumber(c.monthlyTotal) + '/mo');
        }
      }
      els.chipSummary.textContent = parts.join(' · ');
    }

    /* ─────────────────  Utils  ───────────────── */
    function clampPages(v) {
      v = parseInt(v, 10);
      if (isNaN(v)) v = DEFAULTS.pages;
      return Math.max(LIMITS.pagesMin, Math.min(LIMITS.pagesMax, v));
    }

    function formatNumber(n) {
      // 1234 → "1,234". Plain comma every 3 digits.
      return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  }
});  /* WIDGET-DISABLED — to restore, change `)` to `)()` so the IIFE runs again. */
