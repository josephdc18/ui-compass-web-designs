/** Shared state/actions for every article control surface. */
(function () {
  'use strict';

  var focusState = false;
  var listenState = 'idle';
  var listenPromise = null;

  function transport() { return document.querySelector('[data-reader-messages]'); }
  function copy(name, fallback) {
    var el = transport();
    return el && el.dataset[name] || fallback;
  }

  function getReadMinutes() {
    var el = document.querySelector('[data-read-mins]');
    var value = el ? parseInt(el.getAttribute('data-read-mins'), 10) : NaN;
    return isNaN(value) ? null : value;
  }

  function renderFocus() {
    document.querySelectorAll('[data-focus-toggle]').forEach(function (button) {
      button.classList.toggle('active', focusState);
      button.setAttribute('aria-pressed', String(focusState));
      var onIcon = button.querySelector('.focus-icon-on');
      var offIcon = button.querySelector('.focus-icon-off');
      if (onIcon) onIcon.style.display = focusState ? 'none' : '';
      if (offIcon) offIcon.style.display = focusState ? '' : 'none';
      var label = button.querySelector('[data-focus-label], .action-label');
      if (label) label.textContent = focusState ? copy('focusOn', 'Focused') : copy('focusOff', 'Focus');
    });
  }

  function setFocus(on, shouldPersist) {
    var next = !!on;
    if (next === focusState && shouldPersist !== false) return focusState;
    focusState = next;
    document.body.classList.toggle('focus-mode', focusState);
    document.documentElement.setAttribute('data-reader-focus', String(focusState));
    if (shouldPersist !== false && window.uicReaderPrefs) window.uicReaderPrefs.set({ focus: focusState });
    renderFocus();
    if (shouldPersist !== false) {
      document.dispatchEvent(new CustomEvent('uic:focus-changed', { detail: { on: focusState } }));
    }
    return focusState;
  }

  function showToast(message) {
    var toast = document.querySelector('.copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'copy-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(function () { toast.classList.remove('show'); }, 2500);
  }
  window.uicShowToast = showToast;

  function shareData() {
    var description = document.querySelector('meta[name="description"]');
    return { title: document.title, text: description ? description.content : '', url: window.location.href };
  }

  function fallbackCopy(value) {
    var area = document.createElement('textarea');
    area.value = value;
    area.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    try { document.execCommand('copy'); showToast(copy('toastCopied', 'Link copied')); }
    catch (e) { showToast(copy('toastCopyFailed', 'Could not copy')); }
    area.remove();
  }

  function openWindow(url, width, height) {
    window.open(url, '_blank', 'width=' + (width || 600) + ',height=' + (height || 400) + ',menubar=no,toolbar=no,noopener,noreferrer');
  }

  function share(action) {
    var data = shareData();
    var url = encodeURIComponent(data.url);
    var title = encodeURIComponent(data.title);
    switch (action) {
      case 'native':
        if (navigator.share) navigator.share(data).catch(function () {});
        break;
      case 'copy':
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(data.url).then(function () {
            showToast(copy('toastCopied', 'Link copied'));
          }).catch(function () { fallbackCopy(data.url); });
        } else fallbackCopy(data.url);
        break;
      case 'email':
        window.location.href = 'mailto:?subject=' + title + '&body=' + encodeURIComponent(data.text + '\n\nRead more: ' + data.url);
        break;
      case 'print': window.print(); break;
      case 'twitter': openWindow('https://twitter.com/intent/tweet?text=' + title + '&url=' + url); break;
      case 'facebook': openWindow('https://www.facebook.com/sharer/sharer.php?u=' + url); break;
      case 'linkedin': openWindow('https://www.linkedin.com/sharing/share-offsite/?url=' + url); break;
      case 'reddit': openWindow('https://www.reddit.com/submit?url=' + url + '&title=' + title, 600, 600); break;
    }
  }

  function emitListen(state) {
    listenState = state;
    document.dispatchEvent(new CustomEvent('uic:listen-state', { detail: { state: state } }));
    renderListen();
  }

  function renderListen() {
    document.querySelectorAll('[data-listen-toggle]').forEach(function (button) {
      button.hidden = listenState === 'unavailable';
      button.classList.toggle('active', listenState === 'playing' || listenState === 'paused' || listenState === 'loading');
      button.setAttribute('aria-pressed', String(listenState === 'playing' || listenState === 'paused'));
      button.setAttribute('aria-busy', String(listenState === 'loading'));
      var label = button.querySelector('[data-listen-label], .action-label');
      if (label) label.textContent = listenState === 'loading'
        ? copy('listenLoading', 'Loading…')
        : (listenState === 'playing' || listenState === 'paused')
          ? copy('listenStop', 'Stop')
          : copy('listenLabel', 'Listen');
    });
  }

  function listenSource() {
    var el = transport();
    return el && el.dataset.listenSrc || '/assets/js/listen.js';
  }

  function loadListen() {
    if (window.uicListen) return Promise.resolve(window.uicListen);
    if (listenPromise) return listenPromise;
    listenPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = listenSource();
      script.onload = function () {
        if (window.uicListen) resolve(window.uicListen);
        else reject(new Error('Listen API did not initialize'));
      };
      script.onerror = function () { reject(new Error('Listen script failed to load')); };
      document.head.appendChild(script);
    }).catch(function (error) {
      listenPromise = null;
      throw error;
    });
    return listenPromise;
  }

  function toggleListen() {
    if (listenState === 'unavailable' || listenState === 'loading') return Promise.resolve(listenState);
    if (window.uicListen) {
      window.uicListen.toggle();
      return Promise.resolve(listenState);
    }
    emitListen('loading');
    return loadListen().then(function (api) {
      api.toggle();
      return api.getState();
    }).catch(function () {
      emitListen('error');
      showToast(copy('toastListenError', 'Listen could not load. Try again.'));
      return 'error';
    });
  }

  function setListenRate(rate) {
    var value = Number(rate);
    if ([0.9, 1, 1.25, 1.5].indexOf(value) === -1) value = 1;
    if (window.uicReaderPrefs) window.uicReaderPrefs.set({ speed: value });
    if (window.uicListen && typeof window.uicListen.setRate === 'function') window.uicListen.setRate(value);
    return value;
  }

  window.uicArticle = {
    getReadMinutes: getReadMinutes,
    getFocusState: function () { return focusState; },
    setFocus: function (on) { return setFocus(on, true); },
    toggleFocus: function () { return setFocus(!focusState, true); },
    share: share,
    toggleListen: toggleListen,
    getListenState: function () { return listenState; },
    setListenRate: setListenRate
  };

  function closeShareMenus() {
    document.querySelectorAll('.share-dropdown.open').forEach(function (menu) { menu.classList.remove('open'); });
    document.querySelectorAll('[data-share-toggle][aria-expanded="true"], #shareBtn[aria-expanded="true"]').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
  }

  document.addEventListener('click', function (event) {
    var focus = event.target.closest('[data-focus-toggle]');
    if (focus) { event.preventDefault(); window.uicArticle.toggleFocus(); return; }
    var exit = event.target.closest('[data-focus-exit]');
    if (exit) { event.preventDefault(); window.uicArticle.setFocus(false); return; }
    var listen = event.target.closest('[data-listen-toggle]');
    if (listen) { event.preventDefault(); window.uicArticle.toggleListen(); return; }
    var toggle = event.target.closest('[data-share-toggle], #shareBtn');
    if (toggle) {
      event.stopPropagation();
      var wrapper = toggle.closest('.share-wrapper');
      var menu = wrapper && wrapper.querySelector('.share-dropdown');
      if (menu) {
        var opening = !menu.classList.contains('open');
        closeShareMenus();
        menu.classList.toggle('open', opening);
        toggle.setAttribute('aria-expanded', String(opening));
        var nativeOption = menu.querySelector('[data-share="native"]');
        if (nativeOption) nativeOption.hidden = !navigator.share;
      }
      return;
    }
    var shareTrigger = event.target.closest('[data-share]');
    if (shareTrigger) {
      event.preventDefault();
      share(shareTrigger.dataset.share);
      closeShareMenus();
      return;
    }
    if (!event.target.closest('.share-wrapper')) closeShareMenus();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    closeShareMenus();
    if (focusState) setFocus(false, true);
  });

  document.addEventListener('uic:listen-state', function (event) {
    if (!event.detail || !event.detail.state) return;
    listenState = event.detail.state;
    renderListen();
  });
  document.addEventListener('uic:reader-prefs-changed', function (event) {
    if (!event.detail) return;
    if (event.detail.focus !== focusState) {
      focusState = !!event.detail.focus;
      document.body.classList.toggle('focus-mode', focusState);
      renderFocus();
    }
  });

  function init() {
    var prefs = window.uicReaderPrefs ? window.uicReaderPrefs.get() : { focus: false };
    focusState = !!prefs.focus;
    document.body.classList.toggle('focus-mode', focusState);
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) listenState = 'unavailable';
    var readMinutes = getReadMinutes();
    renderFocus();
    renderListen();
    document.dispatchEvent(new CustomEvent('uic:read-minutes', { detail: { minutes: readMinutes } }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
