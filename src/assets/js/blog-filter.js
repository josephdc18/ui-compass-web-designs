// Archive category filter — toggles cs-tab[aria-current] and the [hidden]
// attribute on cs-row entries based on each row's data-category. Falls back
// to a no-op if the archive section isn't on the page.
(function () {
  'use strict';

  var root = document.getElementById('insight-archive');
  if (!root) return;

  var tabs = root.querySelectorAll('.cs-tab');
  var rows = document.querySelectorAll('#archive-grid .cs-row');
  var empty = document.getElementById('archive-empty');
  if (!tabs.length || !rows.length) return;

  function setFilter(filter) {
    var visibleCount = 0;

    tabs.forEach(function (t) {
      if (t.dataset.filter === filter) {
        t.setAttribute('aria-current', 'true');
      } else {
        t.removeAttribute('aria-current');
      }
    });

    rows.forEach(function (r) {
      var cat = (r.dataset.category || '').toLowerCase();
      var match = filter === 'all' || cat === filter;
      r.hidden = !match;
      if (match) visibleCount++;
    });

    if (empty) empty.hidden = visibleCount > 0;
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function (e) {
      e.preventDefault();
      setFilter(t.dataset.filter || 'all');
    });
  });

  // "View all" links from each cluster header pre-set the archive filter
  // and then scroll into view via the in-page anchor.
  document.querySelectorAll('.cs-view-all[data-archive-tab]').forEach(function (link) {
    link.addEventListener('click', function () {
      setFilter(link.dataset.archiveTab);
    });
  });

  setFilter('all');
})();
