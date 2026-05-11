// Archive category filter — toggles cs-tab[aria-pressed] and the [hidden]
// attribute on cs-row entries based on each row's data-category. Filter state
// is synced to location.hash so refresh + back-button + shareable URLs work.
// Falls back to a no-op if the archive section isn't on the page.
(function () {
  'use strict';

  var root = document.getElementById('insight-archive');
  if (!root) return;

  var tabs = root.querySelectorAll('.cs-tab');
  var rows = document.querySelectorAll('#archive-grid .cs-row');
  var empty = document.getElementById('archive-empty');
  if (!tabs.length || !rows.length) return;

  var VALID = ['all', 'strategy', 'seo', 'performance', 'design'];

  function normalize(value) {
    var v = (value || '').replace(/^#/, '').toLowerCase();
    return VALID.indexOf(v) !== -1 ? v : 'all';
  }

  function setFilter(filter, updateHash) {
    filter = normalize(filter);
    var visibleCount = 0;

    tabs.forEach(function (t) {
      t.setAttribute('aria-pressed', t.dataset.filter === filter ? 'true' : 'false');
    });

    rows.forEach(function (r) {
      var cat = (r.dataset.category || '').toLowerCase();
      var match = filter === 'all' || cat === filter;
      r.hidden = !match;
      if (match) visibleCount++;
    });

    if (empty) empty.hidden = visibleCount > 0;

    if (updateHash) {
      var newHash = filter === 'all' ? '' : '#' + filter;
      if (newHash !== location.hash) {
        history.replaceState(null, '', newHash || location.pathname + location.search);
      }
    }
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function (e) {
      e.preventDefault();
      setFilter(t.dataset.filter || 'all', true);
    });
  });

  // Cluster-header "View all" links use href="#strategy" etc; clicking one
  // updates the hash, which our hashchange listener picks up. No extra wiring
  // needed beyond standard browser behavior.
  window.addEventListener('hashchange', function () {
    setFilter(location.hash, false);
  });

  setFilter(location.hash, false);
})();
