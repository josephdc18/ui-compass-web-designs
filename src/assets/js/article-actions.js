/**
 * Article Actions
 * - Reading time (words / 200 wpm)
 * - Focus mode toggle (persists to localStorage)
 * - Share dropdown with native share / copy / email / print / X / Facebook / LinkedIn / Reddit
 * - Lazy-loads listen.js the first time the user clicks "Listen"
 *
 * Bookmarks are wired in bookmarks.js. Tooltips in tooltips.js. Print extras in print-extras.js.
 */
(function () {
  'use strict';

  var FOCUS_KEY = 'uic_focus_mode';

  // ---------- Reading time ----------
  function initReadingTime() {
    var el = document.getElementById('readingTimeText');
    if (!el) return;
    var article = document.querySelector('.article-content') ||
                  document.querySelector('.blog-article') ||
                  document.querySelector('main');
    if (!article) { el.textContent = '1 min read'; return; }
    var words = (article.textContent || '').trim().split(/\s+/).filter(Boolean).length;
    var minutes = Math.max(1, Math.ceil(words / 200));
    el.textContent = minutes === 1 ? '1 min read' : minutes + ' min read';
  }

  // ---------- Focus mode ----------
  function applyFocusMode(on) {
    document.body.classList.toggle('focus-mode', on);
    var btn = document.getElementById('focusModeBtn');
    if (btn) {
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
      var on1 = btn.querySelector('.focus-icon-on');
      var off = btn.querySelector('.focus-icon-off');
      if (on1) on1.style.display = on ? 'none' : '';
      if (off) off.style.display = on ? '' : 'none';
      var label = btn.querySelector('[data-focus-label]');
      if (label) label.textContent = on ? 'Exit' : 'Focus';
    }
    try {
      if (on) localStorage.setItem(FOCUS_KEY, '1');
      else localStorage.removeItem(FOCUS_KEY);
    } catch (e) { /* private mode etc. */ }
  }

  function toggleFocusMode() {
    applyFocusMode(!document.body.classList.contains('focus-mode'));
  }

  function initFocusMode() {
    var btn = document.getElementById('focusModeBtn');
    var exit = document.querySelector('[data-focus-exit]');
    if (btn) btn.addEventListener('click', toggleFocusMode);
    if (exit) exit.addEventListener('click', function () { applyFocusMode(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('focus-mode')) applyFocusMode(false);
    });
    try {
      if (localStorage.getItem(FOCUS_KEY) === '1') applyFocusMode(true);
    } catch (e) { /* ignore */ }
  }

  // ---------- Share ----------
  function getShareData() {
    var meta = document.querySelector('meta[name="description"]');
    return {
      title: document.title,
      text: meta ? meta.content : '',
      url: window.location.href
    };
  }

  function showCopyToast(message) {
    var toast = document.querySelector('.copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'copy-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(function () { toast.classList.remove('show'); }, 2500);
  }
  // Expose globally so bookmarks.js can reuse it.
  window.uicShowToast = showCopyToast;

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); showCopyToast('Link copied'); }
    catch (e) { showCopyToast('Could not copy'); }
    document.body.removeChild(ta);
  }

  function copyLink() {
    var url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(function () { showCopyToast('Link copied'); })
        .catch(function () { fallbackCopy(url); });
    } else {
      fallbackCopy(url);
    }
  }

  function openWindow(url, w, h) {
    var width = w || 600;
    var height = h || 400;
    window.open(url, '_blank', 'width=' + width + ',height=' + height + ',menubar=no,toolbar=no,noopener,noreferrer');
  }

  function doShare(action) {
    var d = getShareData();
    var encUrl = encodeURIComponent(d.url);
    var encTitle = encodeURIComponent(d.title);
    var encText = encodeURIComponent(d.text);
    switch (action) {
      case 'native':
        if (navigator.share) navigator.share(d).catch(function () {});
        break;
      case 'copy':
        copyLink();
        break;
      case 'email':
        window.location.href = 'mailto:?subject=' + encTitle + '&body=' + encodeURIComponent(d.text + '\n\nRead more: ' + d.url);
        break;
      case 'print':
        window.print();
        break;
      case 'twitter':
        openWindow('https://twitter.com/intent/tweet?text=' + encTitle + '&url=' + encUrl);
        break;
      case 'facebook':
        openWindow('https://www.facebook.com/sharer/sharer.php?u=' + encUrl);
        break;
      case 'linkedin':
        openWindow('https://www.linkedin.com/sharing/share-offsite/?url=' + encUrl);
        break;
      case 'reddit':
        openWindow('https://www.reddit.com/submit?url=' + encUrl + '&title=' + encTitle, 600, 600);
        break;
    }
  }

  function initShare() {
    // There can be more than one .share-wrapper on the page (e.g. inline meta
    // share + the desktop vertical rail). Each wraps its own toggle button
    // and dropdown; bind them independently so they don't fight each other.
    var wrappers = document.querySelectorAll('.share-wrapper');
    if (!wrappers.length) return;
    var allDropdowns = [];

    wrappers.forEach(function (wrapper) {
      // Toggle anchor: legacy #shareBtn or the data-attribute variant in the rail.
      var btn = wrapper.querySelector('[data-share-toggle], #shareBtn');
      var dropdown = wrapper.querySelector('.share-dropdown');
      if (!btn || !dropdown) return;
      allDropdowns.push({ btn: btn, dropdown: dropdown });

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = dropdown.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
        if (open) {
          // Hide the platform-native share option when Web Share API isn't available.
          var native = dropdown.querySelector('[data-share-native], #nativeShareBtn');
          if (native) native.style.display = navigator.share ? '' : 'none';
        }
      });

      // Wrapper-scoped delegation: covers the icon row AND items inside the
      // dropdown. The toggle button stops propagation so it doesn't double-fire.
      wrapper.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-share]');
        if (!trigger) return;
        doShare(trigger.dataset.share);
        if (dropdown.contains(trigger)) {
          dropdown.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // Click outside any wrapper closes every dropdown; Escape does the same.
    function closeAll() {
      allDropdowns.forEach(function (d) {
        d.dropdown.classList.remove('open');
        d.btn.setAttribute('aria-expanded', 'false');
      });
    }
    document.addEventListener('click', function (e) {
      var inside = Array.prototype.some.call(wrappers, function (w) { return w.contains(e.target); });
      if (!inside) closeAll();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });
  }

  // ---------- Listen (lazy-load on first click) ----------
  function initListenLoader() {
    var btn = document.getElementById('listenBtn');
    if (!btn) return;
    var loaded = false;
    btn.addEventListener('click', function listenClick() {
      if (loaded) return;
      loaded = true;
      var s = document.createElement('script');
      var v = document.querySelector('link[href*="/css/blog-extras.css"]');
      var hash = '';
      if (v) {
        var m = v.getAttribute('href').match(/v=([^&]+)/);
        if (m) hash = '?v=' + m[1];
      }
      s.src = '/assets/js/listen.js' + hash;
      s.defer = true;
      s.onload = function () {
        // listen.js binds its own click handler; replay the original click so it starts immediately.
        if (typeof window.uicListenStart === 'function') window.uicListenStart();
      };
      document.head.appendChild(s);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initReadingTime();
      initFocusMode();
      initShare();
      initListenLoader();
    });
  } else {
    initReadingTime();
    initFocusMode();
    initShare();
    initListenLoader();
  }
})();
