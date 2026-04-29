/* Site Effects bundle */

(function() {
  'use strict';

  function getStoredTheme() {
    try {
      return window.localStorage ? window.localStorage.getItem('theme') : null;
    } catch (err) {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      if (window.localStorage) window.localStorage.setItem('theme', theme);
    } catch (err) {
      // Storage can be unavailable in sandboxed or private contexts.
    }
  }

  function prefersDarkScheme() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function setDarkMode(isDark) {
    if (!document.body) return false;
    document.body.classList.toggle('dark-mode', isDark);
    setStoredTheme(isDark ? 'dark' : 'light');
    updateTogglePressed(isDark);
    return isDark;
  }

  function updateTogglePressed(isDark) {
    var toggles = document.querySelectorAll('[id^="dark-mode-toggle"]');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-pressed', String(isDark));
    }
  }

  window.pbApplySavedTheme = function pbApplySavedTheme() {
    var saved = getStoredTheme();
    var shouldUseDark = saved === 'dark' || (!saved && prefersDarkScheme());
    return setDarkMode(shouldUseDark);
  };

  window.pbToggleDarkMode = function pbToggleDarkMode() {
    var isDark = !(document.body && document.body.classList.contains('dark-mode'));
    return setDarkMode(isDark);
  };
})();


(function() {
  'use strict';

  var PRESS_SELECTOR = 'a[href], button, .cs-button-solid, .cs-button-stroke, .cs-button-transparent, .cs-li-link, .hamburger-menu, .theme-toggle, #dark-mode-toggle, #go-top, #pb-go-top, [data-press]';
  var activePressed = new Set();

  function findPressTarget(target) {
    if (!target || typeof target.closest !== 'function') return null;
    var el = target.closest(PRESS_SELECTOR);
    if (!el || el.matches('[data-no-press]') || el.closest('[data-no-press]')) return null;
    return el;
  }

  function clearPressed() {
    activePressed.forEach(function(el) {
      if (el && el.classList) el.classList.remove('is-pressed');
    });
    activePressed.clear();
  }

  document.addEventListener('touchstart', function(e) {
    var el = findPressTarget(e.target);
    if (!el) return;
    activePressed.add(el);
    el.classList.add('is-pressed');
  }, { passive: true });

  document.addEventListener('touchend', clearPressed, { passive: true });
  document.addEventListener('touchcancel', clearPressed, { passive: true });
})();

(function() {
  'use strict';

  function pbInitGoTopRing() {
    var wrap = document.querySelector('.pb-go-top-progress');
    if (!wrap || wrap.dataset.pbGoTopBound === 'true') return;
    var button = wrap.querySelector('#pb-go-top');
    if (!button) return;
    wrap.dataset.pbGoTopBound = 'true';

    var ticking = false;

    function getProgress() {
      var doc = document.documentElement;
      var max = Math.max(1, doc.scrollHeight - window.innerHeight);
      return Math.min(1, Math.max(0, window.scrollY / max));
    }

    function update() {
      ticking = false;
      var visible = window.scrollY > window.innerHeight * 0.25;
      wrap.classList.toggle('pb-visible', visible);
      wrap.setAttribute('aria-hidden', String(!visible));
      button.tabIndex = visible ? 0 : -1;
      wrap.style.setProperty('--pb-scroll-progress', getProgress().toFixed(4));
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    function focusMainAfterScroll() {
      var target = document.getElementById('main') || document.querySelector('main') || document.body;
      var hadTabindex = target.hasAttribute('tabindex');
      if (!hadTabindex) target.setAttribute('tabindex', '-1');
      try {
        target.focus({ preventScroll: true });
      } catch (err) {
        target.focus();
      }
      if (!hadTabindex) target.removeAttribute('tabindex');
    }

    button.addEventListener('click', function(e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.setTimeout(focusMainAfterScroll, 350);
    });

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    update();
  }

  if (document.querySelector('.pb-go-top-progress') || document.readyState !== 'loading') {
    pbInitGoTopRing();
  } else {
    document.addEventListener('DOMContentLoaded', pbInitGoTopRing, { once: true });
  }
  window.pbInitGoTopRing = pbInitGoTopRing;
})();


(function() {
  'use strict';

  try {
    if (window.localStorage && window.localStorage.getItem('cs-haptics') === 'off') return;
  } catch (err) {
    // Ignore storage failures.
  }

  var HAPTIC_SELECTOR = 'a[href], button, .cs-button-solid, .cs-button-stroke, .cs-button-transparent, .cs-li-link, .hamburger-menu, .theme-toggle, #dark-mode-toggle, #go-top, #pb-go-top, [data-press]';
  var lastHapticAt = 0;
  var hiddenCheckbox = null;

  function isTextInput(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest('input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]');
  }

  function isStandaloneIOS() {
    var ua = navigator.userAgent || '';
    var iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return iOS && standalone;
  }

  function fallbackIOSPWAHaptic() {
    if (!isStandaloneIOS()) return false;
    if (!hiddenCheckbox) {
      hiddenCheckbox = document.createElement('input');
      hiddenCheckbox.type = 'checkbox';
      hiddenCheckbox.setAttribute('aria-hidden', 'true');
      hiddenCheckbox.tabIndex = -1;
      hiddenCheckbox.style.cssText = 'position:fixed;left:-9999px;top:auto;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(hiddenCheckbox);
    }
    hiddenCheckbox.checked = !hiddenCheckbox.checked;
    hiddenCheckbox.click();
    return true;
  }

  window.triggerHaptic = function triggerHaptic() {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(15);
        return true;
      } catch (err) {
        return fallbackIOSPWAHaptic();
      }
    }
    return fallbackIOSPWAHaptic();
  };

  document.addEventListener('click', function(e) {
    if (isTextInput(e.target)) return;
    if (!e.target || typeof e.target.closest !== 'function') return;
    var el = e.target.closest(HAPTIC_SELECTOR);
    if (!el || el.matches('[data-no-haptic]') || el.closest('[data-no-haptic]')) return;
    var now = Date.now();
    if (now - lastHapticAt < 120) return;
    lastHapticAt = now;
    window.triggerHaptic();
  }, true);
})();
