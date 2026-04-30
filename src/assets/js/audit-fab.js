/**
 * audit-fab.js — real-time PageSpeed audit FAB.
 *
 * State machine: idle → opening → form → submitting → polling → results | error → closing
 * No frameworks, no dependencies. Plays nicely with site-effects.js press feedback.
 */
(function () {
  'use strict';

  // ----- Constants ---------------------------------------------------------
  const STATE_KEY = 'uic_audit_state';
  const SEEN_KEY = 'uic_audit_fab_seen';
  const POLL_INTERVAL_MS = 2000;
  const POLL_TIMEOUT_MS = 60000;
  const RESUME_MAX_AGE_MS = 10 * 60 * 1000;
  const MAGNETIC_STRENGTH = 0.18;
  const MAGNETIC_MAX_PX = 6;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const STATUS_COPY = {
    queued: 'Starting your audit…',
    fetching: 'Crawling your page…',
    analyzing: 'Measuring Core Web Vitals…',
    finalizing: 'Generating recommendations…',
    long: 'Almost there — your site is taking a moment.',
  };

  // ----- State -------------------------------------------------------------
  const state = {
    stage: 'form',
    jobId: null,
    pollTimer: null,
    pollStartedAt: 0,
    statusRotateTimer: null,
    magneticBound: false,
    activeRafs: [],
  };

  let dom = {};

  // ----- Utilities ---------------------------------------------------------
  const mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
  const reduceMotion = () => mq('(prefers-reduced-motion: reduce)');
  const canHover = () => mq('(hover: hover) and (pointer: fine)');

  function bucket(score) {
    if (score == null) return 'none';
    if (score >= 90) return 'good';
    if (score >= 50) return 'amber';
    return 'poor';
  }

  function formatMs(ms) {
    if (ms == null) return '—';
    if (ms < 1000) return ms + ' ms';
    return (ms / 1000).toFixed(2) + ' s';
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function stripMd(s) {
    return String(s == null ? '' : s).replace(/\[([^\]]+)\]\(([^)]*)\)/g, '$1');
  }

  function safeStorageGet(area, key) {
    try { return area.getItem(key); } catch { return null; }
  }
  function safeStorageSet(area, key, val) {
    try { area.setItem(key, val); } catch { /* quota / privacy mode — ignore */ }
  }
  function safeStorageRemove(area, key) {
    try { area.removeItem(key); } catch { /* ignore */ }
  }

  // ----- Stage management --------------------------------------------------
  function setStage(name) {
    state.stage = name;
    dom.dialog.dataset.stage = name;
    dom.stageContents.forEach(s => {
      s.hidden = s.dataset.stageContent !== name;
    });
  }

  // ----- Dialog open / close -----------------------------------------------
  function openDialog() {
    dom.fab.classList.add('is-acknowledged');
    safeStorageSet(localStorage, SEEN_KEY, '1');
    dom.fab.setAttribute('aria-expanded', 'true');

    if (typeof dom.dialog.showModal === 'function') {
      dom.dialog.showModal();
    } else {
      // Safari <15.4 fallback. Modal-ish behavior; pair with manual ESC.
      dom.dialog.setAttribute('open', '');
      dom.dialog.classList.add('audit-dialog--fallback-open');
      document.addEventListener('keydown', fallbackEsc);
    }

    requestAnimationFrame(() => {
      const focusEl = dom.dialog.querySelector(
        '[data-stage-content="' + state.stage + '"] input:not([type=hidden]):not([disabled]), ' +
        '[data-stage-content="' + state.stage + '"] select'
      );
      if (focusEl) focusEl.focus();
    });
  }

  function closeDialog() {
    if (typeof dom.dialog.close === 'function' && dom.dialog.open) {
      dom.dialog.close();
    } else {
      dom.dialog.removeAttribute('open');
      dom.dialog.classList.remove('audit-dialog--fallback-open');
      document.removeEventListener('keydown', fallbackEsc);
      onDialogClose();
    }
  }

  function fallbackEsc(e) {
    if (e.key === 'Escape') closeDialog();
  }

  function onDialogClose() {
    dom.fab.setAttribute('aria-expanded', 'false');
    cancelPoll();
    cancelStatusRotation();
    cancelAllRafs();
    // Keep form values for retry-without-retyping; reset stage to form.
    setStage('form');
  }

  // Click on backdrop closes — backdrop clicks register on the dialog itself.
  function onDialogClick(e) {
    if (e.target === dom.dialog) closeDialog();
  }

  // ----- Magnetic hover ----------------------------------------------------
  function bindMagnetic() {
    if (state.magneticBound) return;
    if (!canHover() || reduceMotion()) return;
    state.magneticBound = true;

    let raf = null;
    let active = false;

    const move = (e) => {
      const r = dom.fab.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) * MAGNETIC_STRENGTH;
      const dy = (e.clientY - cy) * MAGNETIC_STRENGTH;
      const tx = Math.max(-MAGNETIC_MAX_PX, Math.min(MAGNETIC_MAX_PX, dx));
      const ty = Math.max(-MAGNETIC_MAX_PX, Math.min(MAGNETIC_MAX_PX, dy));
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        dom.fab.style.setProperty('--audit-fab-tx', tx + 'px');
        dom.fab.style.setProperty('--audit-fab-ty', ty + 'px');
      });
    };

    const enter = () => {
      if (active) return;
      active = true;
      window.addEventListener('mousemove', move, { passive: true });
    };
    const leave = () => {
      active = false;
      window.removeEventListener('mousemove', move);
      if (raf) cancelAnimationFrame(raf);
      dom.fab.style.removeProperty('--audit-fab-tx');
      dom.fab.style.removeProperty('--audit-fab-ty');
    };

    dom.fab.addEventListener('mouseenter', enter);
    dom.fab.addEventListener('mouseleave', leave);
  }

  // ----- Form validation ---------------------------------------------------
  function validateField(name, value) {
    if (name === 'industry') {
      return value ? null : 'Please pick an industry';
    }
    if (name === 'email') {
      if (!value) return 'We need an email to send you the report';
      if (!EMAIL_RE.test(value)) return 'That email doesn\'t look right';
      return null;
    }
    if (name === 'url') {
      if (!value) return 'Please enter your website URL';
      let normalized = /^https?:\/\//i.test(value) ? value : 'https://' + value;
      try {
        const u = new URL(normalized);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'URL must use http or https';
        const host = u.hostname.toLowerCase();
        if (!host.includes('.')) return 'URL needs a domain (like example.com)';
        if (host === 'localhost' || /^127\./.test(host)) return 'Public URLs only';
      } catch {
        return 'That doesn\'t look like a valid URL';
      }
      return null;
    }
    if (name === 'consent') {
      return value ? null : 'Please confirm you have permission';
    }
    return null;
  }

  function setFieldError(field, msg) {
    const errEl = dom.form.querySelector('[data-field-error="' + field + '"]');
    if (!errEl) return;
    errEl.textContent = msg || '';
    const wrapper = errEl.closest('.audit-field, .audit-consent');
    if (!wrapper) return;
    wrapper.classList.toggle('is-invalid', !!msg);
  }

  function setFormError(msg) {
    dom.formError.textContent = msg || '';
    dom.formError.classList.toggle('is-visible', !!msg);
  }

  function clearAllErrors() {
    setFormError('');
    ['industry', 'email', 'url', 'consent'].forEach(f => setFieldError(f, ''));
  }

  // ----- Submit ------------------------------------------------------------
  async function onSubmit(e) {
    e.preventDefault();
    clearAllErrors();

    const fd = new FormData(dom.form);
    const industry = String(fd.get('industry') || '').trim();
    const email = String(fd.get('email') || '').trim();
    let url = String(fd.get('url') || '').trim();
    const consent = !!dom.form.elements.consent.checked;
    const _hp = String(fd.get('_hp') || '');

    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;

    let firstInvalid = null;
    const checks = [
      ['industry', industry],
      ['email', email],
      ['url', url],
      ['consent', consent],
    ];
    for (const [name, value] of checks) {
      const err = validateField(name, value);
      if (err) {
        setFieldError(name, err);
        if (!firstInvalid) firstInvalid = name;
      }
    }
    if (firstInvalid) {
      const focusEl = dom.form.querySelector('[data-audit-field="' + firstInvalid + '"]');
      if (focusEl) focusEl.focus();
      return;
    }

    const submitBtn = dom.form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    setStage('loading');
    startStatusRotation('queued');

    let res;
    try {
      // Tag installed-PWA traffic so the server can skip owner-side rate limits
      // while testing in production. Trivially spoofable from curl, but only the
      // owner installs this site as a PWA, so the bypass is acceptable here.
      var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || navigator.standalone === true;
      var headers = { 'Content-Type': 'application/json' };
      if (isStandalone) headers['X-PWA'] = '1';
      res = await fetch('/api/psi-audit', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ industry, email, url, consent, _hp }),
      });
    } catch (err) {
      console.error('[Audit FAB] submit network error:', err);
      cancelStatusRotation();
      if (submitBtn) submitBtn.disabled = false;
      setStage('error');
      renderError({
        title: 'Connection problem',
        message: 'We couldn\'t reach the audit service. Check your connection and try again.',
      });
      return;
    }

    if (submitBtn) submitBtn.disabled = false;

    if (res.status === 429) {
      const body = await safeJson(res);
      cancelStatusRotation();
      setStage('error');
      const sec = body.retryAfterSeconds || 60;
      const mins = Math.ceil(sec / 60);
      renderError({
        title: 'Too many audits',
        message: 'You\'ve hit your audit limit. Try again in about ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.',
      });
      return;
    }

    if (!res.ok) {
      const body = await safeJson(res);
      cancelStatusRotation();
      if (body.field) {
        setStage('form');
        setFieldError(body.field, body.error || 'Invalid');
      } else {
        setStage('error');
        renderError({
          title: 'Something went wrong',
          message: body.error || 'Please try again.',
        });
      }
      return;
    }

    const body = await safeJson(res);
    if (!body.jobId) {
      cancelStatusRotation();
      setStage('error');
      renderError({ title: 'Unexpected response', message: 'Please try again.' });
      return;
    }

    state.jobId = body.jobId;
    state.pollStartedAt = Date.now();
    safeStorageSet(sessionStorage, STATE_KEY, JSON.stringify({ jobId: body.jobId, ts: Date.now() }));
    startPolling(body.jobId);
  }

  async function safeJson(res) {
    try { return await res.json(); } catch { return {}; }
  }

  // ----- Polling -----------------------------------------------------------
  function startPolling(jobId) {
    cancelPoll();
    state.pollStartedAt = state.pollStartedAt || Date.now();

    const poll = async () => {
      if (Date.now() - state.pollStartedAt > POLL_TIMEOUT_MS) {
        cancelPoll();
        cancelStatusRotation();
        setStage('error');
        renderError({
          title: 'Audit took too long',
          message: 'PageSpeed is slow right now. Try again in a moment.',
        });
        return;
      }
      let res;
      try {
        res = await fetch('/api/psi-audit/' + encodeURIComponent(jobId));
      } catch (err) {
        // transient — keep polling
        return;
      }
      if (res.status === 410) {
        cancelPoll();
        cancelStatusRotation();
        setStage('error');
        renderError({ title: 'Audit expired', message: 'Please try again.' });
        return;
      }
      if (!res.ok) return; // transient — keep polling
      const body = await safeJson(res);
      if (body.status === 'pending') {
        updateStatusFromHint(body.progressHint);
        return;
      }
      if (body.status === 'complete') {
        cancelPoll();
        cancelStatusRotation();
        safeStorageRemove(sessionStorage, STATE_KEY);
        renderResults(body.result || {});
        return;
      }
      if (body.status === 'error') {
        cancelPoll();
        cancelStatusRotation();
        safeStorageRemove(sessionStorage, STATE_KEY);
        setStage('error');
        renderError(errorCopy(body.code, body.message));
      }
    };

    poll();
    state.pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  }

  function cancelPoll() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
  }

  // ----- Loading status copy ----------------------------------------------
  function startStatusRotation(initialHint) {
    cancelStatusRotation();
    updateStatusFromHint(initialHint || 'queued');
    state.statusRotateTimer = setTimeout(() => {
      if (state.stage === 'loading' && dom.statusText) {
        dom.statusText.textContent = STATUS_COPY.long;
      }
    }, 25000);
  }
  function cancelStatusRotation() {
    if (state.statusRotateTimer) {
      clearTimeout(state.statusRotateTimer);
      state.statusRotateTimer = null;
    }
  }
  function updateStatusFromHint(hint) {
    if (state.stage !== 'loading' || !dom.statusText) return;
    const copy = STATUS_COPY[hint];
    if (copy && dom.statusText.textContent !== copy) {
      dom.statusText.textContent = copy;
    }
  }

  // ----- Error copy --------------------------------------------------------
  function errorCopy(code, message) {
    switch (code) {
      case 'UNAUDITABLE': return {
        title: 'We couldn\'t audit that URL',
        message: 'It might be blocking PageSpeed, behind authentication, or returning errors. Double-check the URL or try a different page.',
      };
      case 'TIMEOUT': return {
        title: 'Audit timed out',
        message: 'PageSpeed took longer than expected. Try again in a moment, or contact us for a hands-on audit.',
      };
      case 'PSI_DOWN': return {
        title: 'PageSpeed is down',
        message: 'Google\'s service is having a moment. Try again in a few minutes.',
      };
      case 'PSI_QUOTA': return {
        title: 'We\'re at our daily audit limit',
        message: 'Try again tomorrow, or contact us for a manual audit.',
      };
      default: return {
        title: 'Something went wrong',
        message: message || 'Please try again.',
      };
    }
  }
  function renderError({ title, message }) {
    if (dom.errorTitle) dom.errorTitle.textContent = title;
    if (dom.errorMessage) dom.errorMessage.textContent = message;
  }

  // ----- Results rendering -------------------------------------------------
  function renderResults(result) {
    setStage('results');
    cancelAllRafs();

    if (dom.summary) dom.summary.textContent = computeSummaryLine(result);
    if (dom.heading) requestAnimationFrame(() => dom.heading.focus());

    renderScreenshot(result);
    renderGauges(result.scores || {});
    renderVitals(result.vitals || {});
    renderOpportunities(result.topOpportunities || []);

    if (dom.cta) {
      const params = new URLSearchParams({
        subject: 'Audit Recovery',
        url: result.finalUrl || '',
        perf: String(result.scores && result.scores.performance != null ? result.scores.performance : ''),
      });
      dom.cta.href = '/contact/?' + params.toString();
    }

    if (typeof navigator.vibrate === 'function' && !reduceMotion()) {
      try { navigator.vibrate(10); } catch { /* ignore */ }
    }
  }

  function computeSummaryLine(result) {
    const scores = result.scores || {};
    const perf = scores.performance;
    if (perf == null) return 'Here\'s your audit detail.';
    let topPct = 80;
    if (perf >= 90) topPct = 10;
    else if (perf >= 80) topPct = 25;
    else if (perf >= 70) topPct = 40;
    else if (perf >= 50) topPct = 60;
    const totalSavingsMs = (result.topOpportunities || []).reduce((sum, o) => sum + (o.savingsMs || 0), 0);
    const savingsSec = totalSavingsMs / 1000;
    if (perf >= 90 && savingsSec < 0.5) {
      return 'Your site is already in the top 10% — that\'s rare. Want to keep it there?';
    }
    if (savingsSec >= 0.5) {
      return 'Your site is in the top ' + topPct + '% — and you could save ' + savingsSec.toFixed(1) + 's on mobile load.';
    }
    return 'Your site is in the top ' + topPct + '%. Here\'s the detail.';
  }

  function renderScreenshot(result) {
    if (!dom.screenshot) return;
    const wrap = dom.screenshot.closest('.audit-results__shot');
    wrap.classList.remove('is-loaded');
    if (!result.screenshotUrl) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';
    let host = '';
    try { host = new URL(result.finalUrl).hostname; } catch { /* ignore */ }
    dom.screenshot.alt = 'Mobile screenshot of ' + (host || 'your site');

    // Small delay so the user perceives the blurred state before the defocus
    // animation runs (otherwise on cache-hits the blur barely registers).
    const reveal = () => setTimeout(() => wrap.classList.add('is-loaded'), 200);
    dom.screenshot.onload = reveal;
    dom.screenshot.onerror = () => { wrap.style.display = 'none'; };
    dom.screenshot.src = result.screenshotUrl;
    // Cache-safe: if the browser already has the image, `onload` won't fire,
    // and the screenshot would stay permanently blurred without this check.
    if (dom.screenshot.complete && dom.screenshot.naturalWidth > 0) {
      reveal();
    }
  }

  function renderGauges(scores) {
    const items = [
      { key: 'performance',   label: 'Performance',    value: scores.performance },
      { key: 'accessibility', label: 'Accessibility',  value: scores.accessibility },
      { key: 'bestPractices', label: 'Best Practices', value: scores.bestPractices },
      { key: 'seo',           label: 'SEO',            value: scores.seo },
    ];
    dom.gauges.innerHTML = '';
    items.forEach((item, i) => {
      const fig = document.createElement('figure');
      fig.className = 'audit-gauge';
      fig.dataset.bucket = bucket(item.value);
      fig.setAttribute('role', 'listitem');
      fig.setAttribute('aria-label',
        item.label + ' score: ' + (item.value == null ? 'unavailable' : item.value + ' out of 100'));

      const wrap = document.createElement('div');
      wrap.className = 'audit-gauge__svg-wrap';

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('aria-hidden', 'true');
      const track = document.createElementNS(svgNS, 'circle');
      track.setAttribute('class', 'audit-gauge__track');
      track.setAttribute('cx', '50'); track.setAttribute('cy', '50');
      track.setAttribute('r', '44'); track.setAttribute('pathLength', '100');
      const arc = document.createElementNS(svgNS, 'circle');
      arc.setAttribute('class', 'audit-gauge__arc');
      arc.setAttribute('cx', '50'); arc.setAttribute('cy', '50');
      arc.setAttribute('r', '44'); arc.setAttribute('pathLength', '100');
      svg.appendChild(track);
      svg.appendChild(arc);

      const valueEl = document.createElement('span');
      valueEl.className = 'audit-gauge__value';
      valueEl.textContent = reduceMotion()
        ? (item.value == null ? '—' : String(item.value))
        : '0';

      wrap.appendChild(svg);
      wrap.appendChild(valueEl);

      const cap = document.createElement('figcaption');
      cap.className = 'audit-gauge__label';
      cap.textContent = item.label;

      fig.appendChild(wrap);
      fig.appendChild(cap);
      dom.gauges.appendChild(fig);

      const target = item.value == null ? 0 : item.value;

      if (reduceMotion()) {
        arc.style.strokeDashoffset = String(100 - target);
        return;
      }

      // Stagger between gauges so they unfold (100ms per gauge)
      const delay = i * 100;
      const startTimer = setTimeout(() => {
        // Trigger CSS arc transition
        arc.style.strokeDashoffset = String(100 - target);

        // Number count-up via rAF, eased to feel tied to the arc
        const duration = 1600;
        const startMs = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - startMs) / duration);
          const eased = easeOutCubic(p);
          valueEl.textContent = Math.round(target * eased);
          if (p < 1) state.activeRafs.push(requestAnimationFrame(tick));
          else valueEl.textContent = item.value == null ? '—' : String(target);
        };
        state.activeRafs.push(requestAnimationFrame(tick));
      }, delay);
      state.activeRafs.push(startTimer);
    });
  }

  function cancelAllRafs() {
    state.activeRafs.forEach(id => {
      try { cancelAnimationFrame(id); } catch { /* ignore */ }
      try { clearTimeout(id); } catch { /* ignore */ }
    });
    state.activeRafs = [];
  }

  function renderVitals(v) {
    if (!dom.vitals) return;
    const safe = (k) => v && v[k] ? v[k] : { ms: null, label: null };
    const lcp = safe('lcp'), cls = safe('cls'), inp = safe('inp'), fcp = safe('fcp'), ttfb = safe('ttfb');

    const rows = [
      { label: 'LCP',  value: formatMs(lcp.ms),  bucket: lcp.label || 'none' },
      { label: 'CLS',  value: cls.value == null ? '—' : Number(cls.value).toFixed(3), bucket: cls.label || 'none' },
      { label: 'INP',  value: inp.ms == null ? '—' : formatMs(inp.ms), bucket: inp.label || 'none' },
      { label: 'FCP',  value: formatMs(fcp.ms),  bucket: fcp.label || 'none' },
      { label: 'TTFB', value: formatMs(ttfb.ms), bucket: ttfb.label || 'none' },
    ];
    // Map bucket names to CSS bucket attribute values
    const bucketCss = (b) => {
      if (b === 'good') return 'good';
      if (b === 'needs-improvement') return 'amber';
      if (b === 'poor') return 'poor';
      return 'none';
    };

    dom.vitals.innerHTML = '';
    rows.forEach(r => {
      const li = document.createElement('li');
      li.className = 'audit-vital';
      li.dataset.bucket = bucketCss(r.bucket);

      const lbl = document.createElement('span');
      lbl.className = 'audit-vital__label';
      lbl.textContent = r.label;

      const val = document.createElement('span');
      val.className = 'audit-vital__value';
      val.textContent = r.value;

      li.appendChild(lbl);
      li.appendChild(val);
      dom.vitals.appendChild(li);
    });

    if (dom.vitalsNote) {
      dom.vitalsNote.hidden = !(inp.ms == null);
    }
  }

  function renderOpportunities(opps) {
    if (!dom.opps || !dom.oppsList) return;
    dom.oppsList.innerHTML = '';
    if (!opps || opps.length === 0) {
      dom.opps.hidden = true;
      return;
    }
    opps.slice(0, 3).forEach(o => {
      const li = document.createElement('li');
      li.className = 'audit-opp';
      // textContent prevents any markup injection from PSI titles
      li.appendChild(document.createTextNode(stripMd(o.title || '')));
      if (o.savingsMs && o.savingsMs > 0) {
        const tag = document.createElement('span');
        tag.className = 'audit-opp__savings';
        tag.textContent = 'Save ' + formatMs(o.savingsMs);
        li.appendChild(document.createTextNode(' '));
        li.appendChild(tag);
      }
      dom.oppsList.appendChild(li);
    });
    dom.opps.hidden = false;
  }

  // ----- Restart -----------------------------------------------------------
  function restart() {
    cancelPoll();
    cancelStatusRotation();
    cancelAllRafs();
    state.jobId = null;
    safeStorageRemove(sessionStorage, STATE_KEY);
    setStage('form');
  }

  // ----- Resume after reload ----------------------------------------------
  function tryResume() {
    const raw = safeStorageGet(sessionStorage, STATE_KEY);
    if (!raw) return false;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { safeStorageRemove(sessionStorage, STATE_KEY); return false; }
    if (!parsed || !parsed.jobId || !parsed.ts) {
      safeStorageRemove(sessionStorage, STATE_KEY);
      return false;
    }
    if (Date.now() - parsed.ts > RESUME_MAX_AGE_MS) {
      safeStorageRemove(sessionStorage, STATE_KEY);
      return false;
    }
    openDialog();
    setStage('loading');
    state.pollStartedAt = parsed.ts; // count toward original timeout
    startStatusRotation('analyzing');
    startPolling(parsed.jobId);
    return true;
  }

  // ----- Init --------------------------------------------------------------
  function init() {
    const fab = document.querySelector('[data-audit-fab]');
    const dialog = document.querySelector('[data-audit-dialog]');
    if (!fab || !dialog) return;

    dom = {
      fab,
      dialog,
      panel: dialog.querySelector('[data-audit-panel]'),
      stageContents: dialog.querySelectorAll('[data-stage-content]'),
      form: dialog.querySelector('[data-audit-form]'),
      formError: dialog.querySelector('[data-audit-form-error]'),
      statusText: dialog.querySelector('[data-audit-status]'),
      heading: dialog.querySelector('[data-audit-results-heading]'),
      summary: dialog.querySelector('[data-audit-summary]'),
      screenshot: dialog.querySelector('[data-audit-screenshot]'),
      gauges: dialog.querySelector('[data-audit-gauges]'),
      vitals: dialog.querySelector('[data-audit-vitals]'),
      vitalsNote: dialog.querySelector('[data-audit-vitals-note]'),
      opps: dialog.querySelector('[data-audit-opps]'),
      oppsList: dialog.querySelector('[data-audit-opps-list]'),
      cta: dialog.querySelector('[data-audit-cta]'),
      errorTitle: dialog.querySelector('[data-audit-error-title]'),
      errorMessage: dialog.querySelector('[data-audit-error-message]'),
    };

    if (safeStorageGet(localStorage, SEEN_KEY) === '1') {
      fab.classList.add('is-acknowledged');
    }

    // The FAB ships with the `hidden` attribute so it doesn't FOUC before the
    // async-loaded CSS arrives. Remove it now — CSS controls visibility from here
    // (`opacity:0` until `body.scroll` toggles in).
    fab.removeAttribute('hidden');

    // If the page restored mid-scroll on reload, the inline scroll handler in
    // base.html hasn't fired yet — kick it so `body.scroll` is set correctly.
    if ((document.documentElement.scrollTop || 0) > 0) {
      document.body.classList.add('scroll');
    }

    fab.addEventListener('click', openDialog);
    // Inline triggers — any element with `data-audit-trigger` opens the dialog,
    // so copy can read "Tap the Free Audit button" while also being the button.
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-audit-trigger]');
      if (!trigger) return;
      e.preventDefault();
      openDialog();
    });
    dialog.addEventListener('close', onDialogClose);
    dialog.addEventListener('click', onDialogClick);

    dialog.querySelectorAll('[data-audit-close]').forEach(b => b.addEventListener('click', closeDialog));
    dialog.querySelectorAll('[data-audit-restart]').forEach(b => b.addEventListener('click', restart));

    if (dom.form) dom.form.addEventListener('submit', onSubmit);

    bindMagnetic();
    tryResume();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
