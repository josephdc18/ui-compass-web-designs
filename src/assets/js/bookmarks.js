/** Durable/session bookmarks plus the /saved/ renderer. */
(function () {
  'use strict';

  var STORAGE_KEY = 'uic_bookmarks';
  var MAX_ENTRIES = 200;
  var sessionBookmarks = null;

  function normalizeUrl(value) {
    try {
      var parsed = new URL(String(value || ''), window.location.origin);
      var pathname;
      try { pathname = decodeURIComponent(parsed.pathname); } catch (e) { pathname = parsed.pathname; }
      pathname = pathname.replace(/\/+$/, '');
      return (pathname || '/') + (pathname === '' || pathname === '/' ? '' : '/');
    } catch (e) { return ''; }
  }

  function announceChange() {
    document.dispatchEvent(new CustomEvent('uic:bookmarks-changed'));
  }

  function parseStored(raw) {
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Bookmarks are not an array');
    return parsed;
  }

  function getBookmarks() {
    if (sessionBookmarks) return sessionBookmarks.slice();
    try {
      return parseStored(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      try { localStorage.setItem(STORAGE_KEY, '[]'); } catch (ignored) { sessionBookmarks = []; }
      return [];
    }
  }

  function saveBookmarks(items) {
    var next = items.slice(0, MAX_ENTRIES);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      sessionBookmarks = null;
      announceChange();
      return true;
    } catch (e) {
      sessionBookmarks = next;
      announceChange();
      return false;
    }
  }

  function has(url) {
    var normalized = normalizeUrl(url);
    return getBookmarks().some(function (item) { return normalizeUrl(item && item.url) === normalized; });
  }

  function messages() {
    var el = document.querySelector('[data-reader-messages]');
    return {
      save: el && el.dataset.save || 'Save',
      saved: el && el.dataset.saved || 'Saved',
      toastSaved: el && el.dataset.toastSaved || 'Saved to bookmarks',
      toastRemoved: el && el.dataset.toastRemoved || 'Bookmark removed',
      toastSession: el && el.dataset.toastSession || 'Saved for this session — your browser is blocking storage.'
    };
  }

  function showToast(message) {
    if (typeof window.uicShowToast === 'function') return window.uicShowToast(message);
    var toast = document.querySelector('.copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'copy-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.classList.remove('show'); }, 2500);
  }

  function bookmarkButtons() {
    return document.querySelectorAll('#bookmarkBtn, [data-share-bookmark]');
  }

  function setButtonState(button, on) {
    if (!button) return;
    var copy = messages();
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));
    var empty = button.querySelector('.bookmark-empty');
    var filled = button.querySelector('.bookmark-filled');
    var label = button.querySelector('.action-label');
    if (empty) empty.style.display = on ? 'none' : '';
    if (filled) filled.style.display = on ? '' : 'none';
    if (label) label.textContent = on ? copy.saved : copy.save;
  }

  function renderButtons() {
    var on = has(window.location.pathname);
    bookmarkButtons().forEach(function (button) { setButtonState(button, on); });
  }

  function toggleBookmark() {
    var copy = messages();
    var url = normalizeUrl(window.location.pathname);
    var items = getBookmarks();
    var removing = has(url);
    if (removing) {
      items = items.filter(function (item) { return normalizeUrl(item && item.url) !== url; });
    } else {
      var title = document.querySelector('.post-title, .blog-h1, h1');
      var description = document.querySelector('meta[name="description"]');
      items.unshift({
        url: url,
        title: title ? title.textContent.trim() : document.title,
        description: description ? description.content : '',
        savedAt: new Date().toISOString()
      });
    }
    var durable = saveBookmarks(items);
    renderButtons();
    showToast(durable ? (removing ? copy.toastRemoved : copy.toastSaved) : copy.toastSession);
  }

  function initButtons() {
    bookmarkButtons().forEach(function (button) { button.addEventListener('click', toggleBookmark); });
    renderButtons();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function safeBlogPath(value) {
    try {
      var parsed = new URL(String(value || ''), window.location.origin);
      if (parsed.origin !== window.location.origin) return '';
      var normalized = normalizeUrl(parsed.pathname);
      return /^\/(?:ko\/)?blog\/[^/]+\/$/.test(normalized) ? normalized : '';
    } catch (e) { return ''; }
  }

  function renderSavedList() {
    var list = document.getElementById('savedBookmarksList');
    if (!list) return;
    var search = document.getElementById('savedSearchInput');
    var sort = document.getElementById('savedSortOrder');

    function formatDate(value) {
      var date = new Date(value);
      return isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function paint() {
      var query = (search && search.value || '').trim().toLowerCase();
      var items = getBookmarks().map(function (item) {
        return Object.assign({}, item, { safeUrl: safeBlogPath(item && item.url) });
      }).filter(function (item) { return item.safeUrl; });
      if (query) items = items.filter(function (item) {
        return String(item.title || '').toLowerCase().indexOf(query) !== -1 || String(item.description || '').toLowerCase().indexOf(query) !== -1;
      });
      var order = sort && sort.value || 'newest';
      if (order === 'oldest') items.sort(function (a, b) { return String(a.savedAt || '').localeCompare(String(b.savedAt || '')); });
      else if (order === 'title') items.sort(function (a, b) { return String(a.title || '').localeCompare(String(b.title || '')); });
      else items.sort(function (a, b) { return String(b.savedAt || '').localeCompare(String(a.savedAt || '')); });

      if (!items.length) {
        list.innerHTML = '<li class="saved-empty">No saved articles yet. Tap the Save button on any post to bookmark it.</li>';
        return;
      }
      list.innerHTML = items.map(function (item) {
        return '<li class="saved-card"><a href="' + escapeHtml(item.safeUrl) + '">' + escapeHtml(item.title) + '</a>' +
          (item.description ? '<p>' + escapeHtml(item.description) + '</p>' : '') +
          '<div class="saved-meta"><time datetime="' + escapeHtml(item.savedAt) + '">Saved ' + escapeHtml(formatDate(item.savedAt)) + '</time>' +
          '<button type="button" class="saved-remove" data-remove="' + escapeHtml(item.safeUrl) + '" aria-label="Remove bookmark">Remove</button></div></li>';
      }).join('');
    }

    list.addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove]');
      if (!button) return;
      var url = normalizeUrl(button.dataset.remove);
      saveBookmarks(getBookmarks().filter(function (item) { return normalizeUrl(item && item.url) !== url; }));
      paint();
    });
    if (search) search.addEventListener('input', paint);
    if (sort) sort.addEventListener('change', paint);
    document.addEventListener('uic:bookmarks-changed', paint);
    paint();
  }

  window.uicBookmarks = {
    urls: function () { return getBookmarks().map(function (item) { return normalizeUrl(item && item.url); }).filter(Boolean); },
    has: has,
    normalize: normalizeUrl
  };

  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    sessionBookmarks = null;
    announceChange();
    renderButtons();
  });

  function init() { initButtons(); renderSavedList(); announceChange(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
