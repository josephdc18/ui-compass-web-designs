/** Mobile reader toolbar, sheets, preferences, and keyboard/pointer behavior. */
(function () {
  'use strict';

  var bar = document.querySelector('[data-reader-bar]');
  if (!bar) return;
  var panels = Array.from(document.querySelectorAll('.reader-panel[data-panel]'));
  var triggers = Array.from(bar.querySelectorAll('[data-panel-toggle]'));
  var scrim = document.querySelector('[data-scrim]');
  var mobile = window.matchMedia('(max-width: 63.99rem)');
  var currentPanel = null;
  var lockedY = 0;
  var lockSnapshot = null;
  var lastTrigger = null;

  function panelByName(name) { return panels.find(function (panel) { return panel.dataset.panel === name; }); }
  function triggerByName(name) { return triggers.find(function (trigger) { return trigger.dataset.panelToggle === name; }); }
  function focusable(root) {
    return Array.from(root.querySelectorAll('a[href], button:not([disabled]):not([hidden]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(function (element) { return !element.hidden && element.getClientRects().length; });
  }

  function lockScroll() {
    if (lockSnapshot) return;
    lockedY = window.scrollY;
    lockSnapshot = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width
    };
    document.body.style.position = 'fixed';
    document.body.style.top = -lockedY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function unlockScroll() {
    if (!lockSnapshot) return;
    document.body.style.position = lockSnapshot.position;
    document.body.style.top = lockSnapshot.top;
    document.body.style.left = lockSnapshot.left;
    document.body.style.right = lockSnapshot.right;
    document.body.style.width = lockSnapshot.width;
    lockSnapshot = null;
    window.scrollTo(0, lockedY);
  }

  function setOutsideInert(on) {
    ['#cs-navigation', '#cs-footer-309'].forEach(function (selector) {
      var element = document.querySelector(selector);
      if (element) element.inert = !!on;
    });
  }

  function setModalAttributes() {
    panels.forEach(function (panel) {
      var heading = panel.querySelector('[id]');
      if (mobile.matches) {
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        if (heading) panel.setAttribute('aria-labelledby', heading.id);
      } else {
        panel.removeAttribute('role');
        panel.removeAttribute('aria-modal');
        panel.removeAttribute('aria-labelledby');
      }
    });
  }

  // The sole writer of panel open/closed state and its dependent page state.
  function setPanel(name, open, options) {
    options = options || {};
    if (open && !mobile.matches) return;
    var next = open ? panelByName(name) : null;
    var previousTrigger = lastTrigger;
    if (next) lastTrigger = triggerByName(name);

    panels.forEach(function (panel) {
      var isOpen = panel === next;
      panel.dataset.open = String(isOpen);
      panel.setAttribute('aria-hidden', mobile.matches ? String(!isOpen) : 'false');
      panel.style.transform = '';
    });
    triggers.forEach(function (trigger) {
      trigger.setAttribute('aria-expanded', String(!!next && trigger.dataset.panelToggle === name));
    });
    currentPanel = next;
    if (scrim) {
      scrim.hidden = !next;
      scrim.classList.toggle('is-open', !!next);
    }
    document.body.classList.toggle('reader-sheet-open', !!next);
    setOutsideInert(!!next);
    if (next) lockScroll();
    else unlockScroll();

    if (next) {
      var initialFocus = next.querySelector('[data-panel-close]') || focusable(next)[0];
      if (initialFocus) initialFocus.focus({ preventScroll: true });
      requestAnimationFrame(function () {
        // Keep a frame fallback for engines that reject focus on a
        // just-unhidden dialog before its transition has painted.
        if (!next.contains(document.activeElement) && initialFocus) initialFocus.focus({ preventScroll: true });
      });
      window.setTimeout(function () {
        // Some pointer implementations restore focus to the activating button
        // after its click handlers finish. Reassert the dialog focus in the
        // next task, but only if this sheet is still the active one.
        if (currentPanel === next && !next.contains(document.activeElement) && initialFocus) {
          initialFocus.focus({ preventScroll: true });
        }
      }, 0);
      window.setTimeout(function () {
        if (currentPanel === next && !next.contains(document.activeElement) && initialFocus) {
          initialFocus.focus({ preventScroll: true });
        }
      }, 50);
    } else if (options.restoreFocus !== false && previousTrigger && document.contains(previousTrigger)) {
      previousTrigger.focus();
      lastTrigger = null;
    }
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var name = trigger.dataset.panelToggle;
      setPanel(name, !(currentPanel && currentPanel.dataset.panel === name));
    });
  });
  panels.forEach(function (panel) {
    panel.addEventListener('click', function (event) {
      if (event.target.closest('[data-panel-close]')) setPanel(panel.dataset.panel, false);
    });
  });
  if (scrim) scrim.addEventListener('click', function () { if (currentPanel) setPanel(currentPanel.dataset.panel, false); });

  document.addEventListener('keydown', function (event) {
    if (!currentPanel) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setPanel(currentPanel.dataset.panel, false);
      return;
    }
    if (event.key !== 'Tab') return;
    var items = focusable(currentPanel);
    if (!items.length) { event.preventDefault(); return; }
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  document.addEventListener('uic:reader-close-panels', function (event) {
    if (!currentPanel) return;
    // toc.js closes the sheet on its way to a heading and asks to keep focus
    // off the trigger, so the jump can land focus on the heading instead.
    var restoreFocus = !(event.detail && event.detail.restoreFocus === false);
    setPanel(currentPanel.dataset.panel, false, { restoreFocus: restoreFocus });
  });
  document.addEventListener('uic:focus-changed', function (event) {
    if (event.detail && event.detail.on && currentPanel) setPanel(currentPanel.dataset.panel, false, { restoreFocus: false });
  });

  function handleBreakpoint() {
    if (!mobile.matches && currentPanel) setPanel(currentPanel.dataset.panel, false, { restoreFocus: false });
    setModalAttributes();
    if (!mobile.matches) setOutsideInert(false);
  }
  if (mobile.addEventListener) mobile.addEventListener('change', handleBreakpoint);
  else mobile.addListener(handleBreakpoint);
  setModalAttributes();

  // One Tab stop in the toolbar, with arrow/Home/End movement.
  var toolbarButtons = Array.from(bar.querySelectorAll('.reader-action'));
  function visibleToolbarButtons() { return toolbarButtons.filter(function (button) { return !button.hidden && button.getClientRects().length; }); }
  bar.addEventListener('keydown', function (event) {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key) === -1) return;
    var buttons = visibleToolbarButtons();
    if (!buttons.length) return;
    event.preventDefault();
    var index = Math.max(0, buttons.indexOf(document.activeElement));
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = buttons.length - 1;
    else index = (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    toolbarButtons.forEach(function (button) { button.tabIndex = button === buttons[index] ? 0 : -1; });
    buttons[index].focus();
  });
  bar.addEventListener('focusin', function (event) {
    if (!event.target.classList.contains('reader-action')) return;
    toolbarButtons.forEach(function (button) { button.tabIndex = button === event.target ? 0 : -1; });
    bar.classList.remove('is-hidden');
  });

  // Pointer drag on the sheet handle.
  panels.forEach(function (panel) {
    var handle = panel.querySelector('[data-sheet-handle]');
    if (!handle) return;
    var startY = 0;
    var lastY = 0;
    var startedAt = 0;
    var pointerId = null;
    handle.addEventListener('pointerdown', function (event) {
      if (!mobile.matches || !currentPanel || currentPanel !== panel) return;
      pointerId = event.pointerId;
      startY = lastY = event.clientY;
      startedAt = performance.now();
      handle.setPointerCapture(pointerId);
      panel.classList.add('is-dragging');
    });
    handle.addEventListener('pointermove', function (event) {
      if (event.pointerId !== pointerId) return;
      lastY = event.clientY;
      panel.style.transform = 'translateY(' + Math.max(0, lastY - startY) + 'px)';
    });
    function finish(event) {
      if (event.pointerId !== pointerId) return;
      var distance = Math.max(0, lastY - startY);
      var velocity = distance / Math.max(1, performance.now() - startedAt);
      pointerId = null;
      panel.classList.remove('is-dragging');
      panel.style.transform = '';
      if (distance > 72 || velocity > 0.55) setPanel(panel.dataset.panel, false);
    }
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  });

  // Preferences.
  function renderPreferences() {
    var prefs = window.uicReaderPrefs ? window.uicReaderPrefs.get() : { size: 'm', speed: 1 };
    document.querySelectorAll('[data-reader-size]').forEach(function (button) { button.setAttribute('aria-checked', String(button.dataset.readerSize === prefs.size)); });
    document.querySelectorAll('[data-reader-speed]').forEach(function (button) { button.setAttribute('aria-checked', String(Number(button.dataset.readerSpeed) === Number(prefs.speed))); });
  }
  document.addEventListener('click', function (event) {
    var size = event.target.closest('button[data-reader-size]');
    if (size && window.uicReaderPrefs) { window.uicReaderPrefs.set({ size: size.dataset.readerSize }); renderPreferences(); return; }
    var speed = event.target.closest('button[data-reader-speed]');
    if (speed && window.uicArticle) { window.uicArticle.setListenRate(Number(speed.dataset.readerSpeed)); renderPreferences(); return; }
    if (event.target.closest('button[data-reader-reset]') && window.uicReaderPrefs) {
      var prefs = window.uicReaderPrefs.reset();
      if (window.uicArticle) {
        window.uicArticle.setFocus(false);
        if (window.uicListen) window.uicListen.setRate(prefs.speed);
      }
      renderPreferences();
      return;
    }
    if (event.target.closest('.reader-panel--share [data-share]') && currentPanel) setPanel(currentPanel.dataset.panel, false);
  });
  document.addEventListener('uic:reader-prefs-changed', renderPreferences);
  renderPreferences();
  var nativeShare = document.querySelector('.reader-panel--share [data-share-native]');
  if (nativeShare) nativeShare.hidden = !navigator.share;

  // Scroll-direction auto-hide with hysteresis.
  var lastY = window.scrollY;
  var accumulated = 0;
  window.addEventListener('scroll', function () {
    var nextY = window.scrollY;
    var delta = nextY - lastY;
    if ((delta > 0) !== (accumulated > 0)) accumulated = 0;
    accumulated += delta;
    lastY = nextY;
    var state = window.uicArticle ? window.uicArticle.getListenState() : 'idle';
    var protectedState = currentPanel || bar.contains(document.activeElement) || state === 'playing' || state === 'loading';
    if (protectedState || nextY < 100 || accumulated < -12) bar.classList.remove('is-hidden');
    else if (accumulated > 20) bar.classList.add('is-hidden');
  }, { passive: true });

  window.uicReader = { setPanel: setPanel, getOpenPanel: function () { return currentPanel && currentPanel.dataset.panel; } };
})();
