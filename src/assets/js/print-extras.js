/**
 * Print Extras
 * - Inserts a print header (site name + URL with anchor of nearest visible heading) and a footer
 *   (QR code that links back online + "Scan to view online" label) only on print.
 * - Cleans them up on `afterprint` so the DOM stays untouched in normal viewing.
 *
 * QR code is fetched from api.qrserver.com on demand. It is referenced in an <img> with onerror
 * fallback to a plain-text URL line, so an offline print still produces a usable footer.
 *
 * Zero runtime cost outside of `beforeprint` / `afterprint`.
 */
(function () {
  'use strict';

  var SITE_NAME = 'UI Compass Web Designs';
  var STICKY_OFFSET = 100;

  function getNearestHeadingId() {
    if (window.scrollY <= 200) return null;
    var heads = document.querySelectorAll(
      '.article-content h2[id], .article-content h3[id], [data-toc-section] h2[id]'
    );
    if (!heads.length) return null;
    var bestId = null;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top <= STICKY_OFFSET) bestId = heads[i].id;
      else break;
    }
    return bestId;
  }

  function injectPrintExtras() {
    if (document.querySelector('.print-header')) return;
    var anchor = getNearestHeadingId();
    var baseUrl = window.location.origin + window.location.pathname + window.location.search;
    var url = baseUrl + (anchor ? '#' + anchor : (window.location.hash || ''));

    var header = document.createElement('div');
    header.className = 'print-header';
    header.innerHTML = '<strong></strong> &mdash; <span></span>';
    header.querySelector('strong').textContent = SITE_NAME;
    header.querySelector('span').textContent = url;

    var footer = document.createElement('div');
    footer.className = 'print-footer';
    var qr = document.createElement('img');
    qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=4&data=' + encodeURIComponent(url);
    qr.alt = 'QR code to view this page online';
    qr.className = 'print-qr';
    qr.width = 96;
    qr.height = 96;
    var fallback = document.createElement('span');
    fallback.className = 'print-qr-fallback';
    fallback.textContent = 'View online: ' + url;
    qr.onerror = function () {
      qr.style.display = 'none';
      fallback.style.display = 'block';
    };
    var label = document.createElement('span');
    label.className = 'print-qr-label';
    label.textContent = 'Scan to view online';

    footer.appendChild(qr);
    footer.appendChild(fallback);
    footer.appendChild(label);

    var article = document.querySelector('.blog-article') || document.querySelector('main');
    if (article) {
      article.insertBefore(header, article.firstChild);
      article.appendChild(footer);
    }
  }

  function clearPrintExtras() {
    var h = document.querySelector('.print-header');
    var f = document.querySelector('.print-footer');
    if (h && h.parentNode) h.parentNode.removeChild(h);
    if (f && f.parentNode) f.parentNode.removeChild(f);
  }

  window.addEventListener('beforeprint', injectPrintExtras);
  window.addEventListener('afterprint', clearPrintExtras);

  // Some browsers (Safari) only fire matchMedia on print, not the events.
  if (window.matchMedia) {
    var mql = window.matchMedia('print');
    if (mql.addEventListener) {
      mql.addEventListener('change', function (e) {
        if (e.matches) injectPrintExtras(); else clearPrintExtras();
      });
    }
  }
})();
