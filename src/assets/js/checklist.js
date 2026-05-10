/* Website Launch Checklist
 * - Loads + persists checkbox state in localStorage under 'checklist-v1'.
 * - Updates the global progress (output text + <progress value>) on every change.
 * - Updates per-category counts and a "complete" data flag for styling hooks.
 * - Toolbar: Reset all (with confirm), Print/Save as PDF, Collapse/Expand all.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'checklist-v1';
  var SAVE_DEBOUNCE_MS = 250;

  function init() {
    var list = document.getElementById('checklist-list-1101');
    if (!list) return;

    var inputs = list.querySelectorAll('input[type="checkbox"][data-item-id]');
    if (!inputs.length) return;

    var categories = list.querySelectorAll('.cs-category');
    var output = document.querySelector('[data-progress-output]');
    var bar = document.querySelector('[data-progress-bar]');
    var toggleBtn = document.querySelector('[data-toggle-all]');
    var toggleLabel = document.querySelector('[data-toggle-all-label]');
    var printBtn = document.querySelector('[data-print-checklist]');
    var resetBtn = document.querySelector('[data-reset-checklist]');

    var saved = readState();
    for (var i = 0; i < inputs.length; i++) {
      var id = inputs[i].dataset.itemId;
      if (id && saved[id]) inputs[i].checked = true;
    }

    if (bar) bar.max = inputs.length;
    refreshAll(categories, inputs, output, bar);

    var saveTimer = null;
    function scheduleSave() {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        saveTimer = null;
        writeState(inputs);
      }, SAVE_DEBOUNCE_MS);
    }

    list.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'INPUT' || t.type !== 'checkbox') return;
      refreshAll(categories, inputs, output, bar);
      scheduleSave();
    });

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var anyClosed = false;
        for (var c = 0; c < categories.length; c++) {
          if (!categories[c].open) { anyClosed = true; break; }
        }
        var openAll = anyClosed;
        for (var c2 = 0; c2 < categories.length; c2++) {
          categories[c2].open = openAll;
        }
        if (toggleLabel) toggleLabel.textContent = openAll ? 'Collapse all' : 'Expand all';
        toggleBtn.setAttribute('aria-pressed', String(!openAll));
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', function () {
        window.print();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        var checkedCount = 0;
        for (var k = 0; k < inputs.length; k++) {
          if (inputs[k].checked) checkedCount++;
        }
        if (checkedCount === 0) return;
        var ok = window.confirm('Clear all ' + checkedCount + ' completed items? This cannot be undone.');
        if (!ok) return;
        for (var m = 0; m < inputs.length; m++) inputs[m].checked = false;
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch (err) { /* private mode etc. */ }
        refreshAll(categories, inputs, output, bar);
      });
    }
  }

  function refreshAll(categories, inputs, output, bar) {
    var totalDone = 0;
    var total = inputs.length;
    for (var i = 0; i < total; i++) {
      if (inputs[i].checked) totalDone++;
    }
    var pct = total === 0 ? 0 : Math.round((totalDone / total) * 100);
    if (output) {
      output.textContent = totalDone + ' of ' + total + ' complete · ' + pct + '%';
    }
    if (bar) bar.value = totalDone;

    for (var c = 0; c < categories.length; c++) {
      var cat = categories[c];
      var catInputs = cat.querySelectorAll('input[type="checkbox"][data-item-id]');
      var done = 0;
      for (var k = 0; k < catInputs.length; k++) {
        if (catInputs[k].checked) done++;
      }
      var doneEl = cat.querySelector('[data-cat-done]');
      var totalEl = cat.querySelector('[data-cat-total]');
      if (doneEl) doneEl.textContent = String(done);
      if (totalEl && !totalEl.textContent) totalEl.textContent = String(catInputs.length);
      cat.dataset.catComplete = (catInputs.length > 0 && done === catInputs.length) ? 'true' : 'false';
    }
  }

  function readState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function writeState(inputs) {
    var state = {};
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].checked) {
        var id = inputs[i].dataset.itemId;
        if (id) state[id] = true;
      }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) { /* storage unavailable or quota exceeded */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
