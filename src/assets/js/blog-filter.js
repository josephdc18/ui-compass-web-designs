/* Search, category, and Saved filtering for the flat blog index. */
(function () {
  'use strict';

  var root = document.getElementById('insight-archive');
  if (!root) return;

  var nodes = Array.from(root.querySelectorAll('[data-search]'));
  var tabs = Array.from(root.querySelectorAll('[data-filter]'));
  var search = document.getElementById('blog-search');
  var empty = document.getElementById('archive-empty');
  var savedTab = root.querySelector('[data-filter="saved"]');
  var savedCount = root.querySelector('[data-saved-filter-count]');
  var validFilters = new Set(tabs.map(function (tab) { return tab.dataset.filter; }));
  var activeFilter = 'all';
  var query = '';
  var savedUrls = new Set();

  function normalizeUrl(url) {
    if (window.uicBookmarks && typeof window.uicBookmarks.normalize === 'function') {
      return window.uicBookmarks.normalize(url);
    }
    return String(url || '').replace(/\/+$/, '') + '/';
  }

  function readSavedUrls() {
    var urls = window.uicBookmarks && typeof window.uicBookmarks.urls === 'function'
      ? window.uicBookmarks.urls()
      : [];
    savedUrls = new Set(urls.map(normalizeUrl));
  }

  function fromHash() {
    var value = '';
    try { value = decodeURIComponent(location.hash.replace(/^#/, '')).toLowerCase(); } catch (e) {}
    return validFilters.has(value) ? value : 'all';
  }

  // The single visibility/state writer for the index.
  function apply() {
    var pageUrls = new Set(nodes.map(function (node) { return normalizeUrl(node.dataset.url); }));
    var intersection = 0;
    savedUrls.forEach(function (url) { if (pageUrls.has(url)) intersection += 1; });
    var visible = 0;

    nodes.forEach(function (node) {
      var url = normalizeUrl(node.dataset.url);
      var categoryMatch = activeFilter === 'all' ||
        (activeFilter === 'saved' ? savedUrls.has(url) : node.dataset.category === activeFilter);
      var searchMatch = !query || (node.dataset.search || '').indexOf(query) !== -1;
      var show = categoryMatch && searchMatch;
      node.hidden = !show;
      if (show) visible += 1;
    });

    tabs.forEach(function (tab) {
      tab.setAttribute('aria-pressed', String(tab.dataset.filter === activeFilter));
    });
    if (savedCount) savedCount.textContent = String(intersection);
    if (savedTab) savedTab.hidden = intersection === 0;
    if (empty) empty.hidden = visible !== 0;
  }

  function setFilter(value, updateHash) {
    activeFilter = validFilters.has(value) ? value : 'all';
    if (updateHash) {
      var hash = activeFilter === 'all' ? '' : '#' + encodeURIComponent(activeFilter);
      history.replaceState(null, '', location.pathname + location.search + hash);
    }
    apply();
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () { setFilter(tab.dataset.filter, true); });
  });

  var debounceTimer;
  if (search) {
    search.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        query = search.value.trim().toLowerCase();
        apply();
      }, 120);
    });
  }

  root.addEventListener('click', function (event) {
    if (!event.target.closest('[data-clear-filters]')) return;
    query = '';
    if (search) search.value = '';
    setFilter('all', true);
    if (search) search.focus();
  });

  document.addEventListener('keydown', function (event) {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k' || !search) return;
    event.preventDefault();
    search.focus();
    search.select();
  });

  window.addEventListener('hashchange', function () {
    activeFilter = fromHash();
    apply();
  });
  document.addEventListener('uic:bookmarks-changed', function () {
    readSavedUrls();
    apply();
  });

  // The site navbar is position:fixed AND collapses its top bar on scroll, so a
  // hardcoded sticky offset is wrong at one end or the other — 60px left the
  // toolbar 12px behind the settled navbar, and the unscrolled navbar is twice
  // that tall again. Measure the row that does not collapse: .cs-container is
  // border-box and carries its own padding inside the measured height, so the
  // rect height is the whole answer. Same custom property and same measurement
  // toc.js publishes on a post; the two never run on the same page.
  var navRow = document.querySelector('#cs-navigation .cs-container');
  function publishNavOffset() {
    document.documentElement.style.setProperty(
      '--reader-sticky-offset', navRow.getBoundingClientRect().height + 'px');
  }
  if (navRow) {
    publishNavOffset();
    // The row only, never #cs-navigation itself — observing the navbar would
    // fire on every frame of its 300ms collapse transition.
    if (window.ResizeObserver) new ResizeObserver(publishNavOffset).observe(navRow);
    window.addEventListener('resize', publishNavOffset);
  }

  readSavedUrls();
  activeFilter = fromHash();
  apply();
})();
