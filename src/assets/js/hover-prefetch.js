/**
 * Hover Prefetch
 * Pre-fetches same-origin links after a 65ms hover or first touchstart, so the
 * destination is already in the HTTP cache by the time the user clicks.
 *
 * - Skips on Save-Data, slow connections, and recently-scrolled pages (avoids prefetching
 *   links the user is just scrolling past).
 * - Caps to 2 in-flight requests so we never starve the main page.
 * - Keep-alive cache lives in memory; the browser HTTP cache (or service worker) holds
 *   the actual bytes once the request completes.
 */
(function () {
  'use strict';

  var inFlight = new Set();
  var done = new Set();
  var MAX_IN_FLIGHT = 2;
  var HOVER_DELAY_MS = 65;
  var SCROLL_BLOCK_MS = 300;

  function ok(link) {
    if (!link || !link.href) return false;
    if (link.origin !== location.origin) return false;
    if (link.hasAttribute('download')) return false;
    if (link.target && link.target !== '_self') return false;
    if (link.href.indexOf('#') !== -1 && link.href.split('#')[0] === location.href.split('#')[0]) return false;
    if (link.protocol !== 'http:' && link.protocol !== 'https:') return false;
    if (link.dataset.noPrefetch === 'true') return false;
    return true;
  }

  function networkOk() {
    var c = navigator.connection;
    if (!c) return true;
    if (c.saveData) return false;
    var et = c.effectiveType;
    if (et === '2g' || et === 'slow-2g') return false;
    return true;
  }

  var lastScroll = 0;
  window.addEventListener('scroll', function () { lastScroll = Date.now(); }, { passive: true });
  function recentlyScrolled() { return Date.now() - lastScroll < SCROLL_BLOCK_MS; }

  function prefetch(link) {
    if (!ok(link) || !networkOk() || recentlyScrolled()) return;
    var url = link.href;
    if (done.has(url) || inFlight.has(url) || inFlight.size >= MAX_IN_FLIGHT) return;
    inFlight.add(url);
    fetch(url, { headers: { Accept: 'text/html' }, credentials: 'same-origin', priority: 'low' })
      .then(function (r) { if (r.ok) done.add(url); })
      .catch(function () {})
      .finally(function () { inFlight.delete(url); });
  }

  var hoverTimer = null;
  var hoveredLink = null;

  document.addEventListener('pointerenter', function (e) {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    var link = e.target && e.target.closest && e.target.closest('a');
    if (!link) return;
    hoveredLink = link;
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      if (hoveredLink === link) prefetch(link);
    }, HOVER_DELAY_MS);
  }, true);

  document.addEventListener('pointerleave', function () {
    if (hoverTimer) clearTimeout(hoverTimer);
    hoveredLink = null;
  }, true);

  document.addEventListener('touchstart', function (e) {
    var link = e.target && e.target.closest && e.target.closest('a');
    if (link) prefetch(link);
  }, { passive: true, capture: true });
})();
