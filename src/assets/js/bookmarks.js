/**
 * Bookmarks (Save for later)
 * - Stores up to 200 entries in localStorage under 'uic_bookmarks'.
 * - Toggles the Save button state on the current article.
 * - On the /saved page, renders the list with search + sort + remove.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'uic_bookmarks';
  var MAX_ENTRIES = 200;

  function getBookmarks() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveBookmarks(arr) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, MAX_ENTRIES))); }
    catch (e) { /* private mode / quota */ }
  }
  function isBookmarked(url) {
    return getBookmarks().some(function (b) { return b.url === url; });
  }

  function showToast(message) {
    if (typeof window.uicShowToast === 'function') return window.uicShowToast(message);
    var toast = document.querySelector('.copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'copy-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.classList.remove('show'); }, 2000);
  }

  function setButtonState(btn, on) {
    if (!btn) return;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
    var empty = btn.querySelector('.bookmark-empty');
    var filled = btn.querySelector('.bookmark-filled');
    if (empty) empty.style.display = on ? 'none' : '';
    if (filled) filled.style.display = on ? '' : 'none';
    var label = btn.querySelector('.action-label');
    if (label) label.textContent = on ? 'Saved' : 'Save';
  }

  function toggleBookmark() {
    var url = window.location.pathname;
    var btn = document.getElementById('bookmarkBtn');
    var bookmarks = getBookmarks();
    if (isBookmarked(url)) {
      bookmarks = bookmarks.filter(function (b) { return b.url !== url; });
      saveBookmarks(bookmarks);
      setButtonState(btn, false);
      showToast('Bookmark removed');
    } else {
      var titleEl = document.querySelector('.blog-h1') || document.querySelector('h1');
      var descEl = document.querySelector('meta[name="description"]');
      bookmarks.unshift({
        url: url,
        title: titleEl ? titleEl.textContent.trim() : document.title,
        description: descEl ? descEl.content : '',
        savedAt: new Date().toISOString()
      });
      saveBookmarks(bookmarks);
      setButtonState(btn, true);
      showToast('Saved to bookmarks');
    }
  }

  function initButton() {
    var btn = document.getElementById('bookmarkBtn');
    if (!btn) return;
    btn.addEventListener('click', toggleBookmark);
    if (isBookmarked(window.location.pathname)) setButtonState(btn, true);
  }

  // ---------- /saved page renderer ----------
  function renderSavedList() {
    var list = document.getElementById('savedBookmarksList');
    if (!list) return;

    var search = document.getElementById('savedSearchInput');
    var sort = document.getElementById('savedSortOrder');

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    }
    function fmtDate(iso) {
      try {
        var d = new Date(iso);
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      } catch (e) { return ''; }
    }

    function paint() {
      var items = getBookmarks();
      var q = (search && search.value || '').toLowerCase().trim();
      if (q) {
        items = items.filter(function (b) {
          return (b.title || '').toLowerCase().indexOf(q) !== -1 ||
                 (b.description || '').toLowerCase().indexOf(q) !== -1;
        });
      }
      var order = sort && sort.value || 'newest';
      if (order === 'newest') items.sort(function (a, b) { return (b.savedAt || '').localeCompare(a.savedAt || ''); });
      else if (order === 'oldest') items.sort(function (a, b) { return (a.savedAt || '').localeCompare(b.savedAt || ''); });
      else if (order === 'title') items.sort(function (a, b) { return (a.title || '').localeCompare(b.title || ''); });

      if (!items.length) {
        list.innerHTML = '<li class="saved-empty">No saved articles yet. Tap the Save button on any post to bookmark it.</li>';
        return;
      }
      list.innerHTML = items.map(function (b) {
        return '<li class="saved-card">' +
          '<a href="' + escapeHtml(b.url) + '">' + escapeHtml(b.title) + '</a>' +
          (b.description ? '<p>' + escapeHtml(b.description) + '</p>' : '') +
          '<div class="saved-meta">' +
            '<time datetime="' + escapeHtml(b.savedAt || '') + '">Saved ' + escapeHtml(fmtDate(b.savedAt)) + '</time>' +
            '<button type="button" class="saved-remove" data-remove="' + escapeHtml(b.url) + '" aria-label="Remove bookmark">Remove</button>' +
          '</div>' +
        '</li>';
      }).join('');
    }

    list.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-remove]');
      if (!rm) return;
      var u = rm.getAttribute('data-remove');
      saveBookmarks(getBookmarks().filter(function (b) { return b.url !== u; }));
      paint();
    });
    if (search) search.addEventListener('input', paint);
    if (sort) sort.addEventListener('change', paint);

    paint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initButton();
      renderSavedList();
    });
  } else {
    initButton();
    renderSavedList();
  }
})();
