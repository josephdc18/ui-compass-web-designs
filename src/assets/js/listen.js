/**
 * Listen / TTS
 * Loaded ON DEMAND from article-actions.js the first time the user clicks Listen.
 *
 * - Walks the article body, splits into utterance chunks (~200 chars at sentence boundaries).
 * - Picks a high-quality voice (preferring Neural / Natural / Premium English voices).
 * - Highlights the current word as it speaks (best-effort using boundary events).
 * - Floating mini-player pill: Pause/Resume, Stop, status text.
 *
 * Exposes window.uicListen; article-actions.js owns every article button.
 *
 * Note: SpeechSynthesis is best-effort across browsers. We catch all errors and degrade
 * silently (Listen button reverts to inactive).
 */
(function () {
  'use strict';

  if (window.uicListen) return;

  if (!('speechSynthesis' in window)) {
    return;
  }

  var synth = window.speechSynthesis;
  var utterances = [];
  var currentIndex = 0;
  var state = 'idle'; // idle | playing | paused
  var allowedRates = [0.9, 1, 1.25, 1.5];
  var storedPrefs = window.uicReaderPrefs ? window.uicReaderPrefs.get() : {};
  var playbackRate = allowedRates.indexOf(Number(storedPrefs.speed)) !== -1 ? Number(storedPrefs.speed) : 1;
  var player = null;
  var statusEl = null;
  var playBtn = null;
  var stopBtn = null;
  var listenBtn = null;
  var articleEl = null;
  var sessionChunks = [];
  var activeWordEl = null;
  var userScrollPauseUntil = 0;
  var lastProgrammaticScroll = 0;
  var AUTO_FOLLOW_PAUSE_MS = 12000;
  // Built once per Listen session: a flat list of every word's exact DOM position
  // ({ node, start, end }) plus the global word index where each utterance chunk
  // begins. This lets us highlight the correct occurrence of repeated words like
  // "the" by mapping boundary events directly to a word index instead of
  // text-searching the DOM.
  var articleWords = [];
  var chunkStartWord = [];

  function setState(next) {
    state = next;
    document.dispatchEvent(new CustomEvent('uic:listen-state', { detail: { state: state } }));
  }

  function pickVoice() {
    var voices = synth.getVoices() || [];
    if (!voices.length) return null;
    var lang = (document.documentElement.lang || 'en').toLowerCase();
    var en = voices.filter(function (v) { return (v.lang || '').toLowerCase().indexOf(lang.split('-')[0]) === 0; });
    if (!en.length) en = voices;
    var preferred = ['Neural', 'Natural', 'Premium', 'Online', 'Studio', 'Wavenet', 'Google US English'];
    for (var i = 0; i < preferred.length; i++) {
      var match = en.find(function (v) { return (v.name || '').indexOf(preferred[i]) !== -1; });
      if (match) return match;
    }
    return en[0];
  }

  function chunkText(text) {
    // Split at sentence boundaries; group into ~250-char chunks for smooth boundary events.
    var sentences = text.match(/[^.!?]+[.!?]+|\S+$/g) || [text];
    var chunks = [];
    var buf = '';
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i].trim();
      if (!s) continue;
      if ((buf + ' ' + s).length > 250 && buf) {
        chunks.push(buf.trim());
        buf = s;
      } else {
        buf = buf ? buf + ' ' + s : s;
      }
    }
    if (buf) chunks.push(buf.trim());
    return chunks;
  }

  function buildPlayer() {
    if (player) return;
    listenBtn = document.getElementById('listenBtn');
    player = document.createElement('div');
    player.className = 'tts-mini-player';
    player.setAttribute('role', 'toolbar');
    player.setAttribute('aria-label', 'Listen controls');
    player.innerHTML =
      '<button type="button" class="tts-mini-btn" data-listen-toggle aria-label="Pause">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>' +
      '</button>' +
      '<span class="tts-mini-status">Loading voice…</span>' +
      '<button type="button" class="tts-mini-btn" data-listen-stop aria-label="Stop">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14"/></svg>' +
      '</button>';
    document.body.appendChild(player);
    statusEl = player.querySelector('.tts-mini-status');
    playBtn = player.querySelector('[data-listen-toggle]');
    stopBtn = player.querySelector('[data-listen-stop]');
    playBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      togglePause();
    });
    stopBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      stop();
    });
    requestAnimationFrame(function () { player.classList.add('show'); });
  }

  function setPlayIcon(isPaused) {
    if (!playBtn) return;
    playBtn.setAttribute('aria-label', isPaused ? 'Resume' : 'Pause');
    playBtn.innerHTML = isPaused
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
  }

  function setStatus(s) { if (statusEl) statusEl.textContent = s; }

  function setBtnLabel(text) {
    if (!listenBtn) listenBtn = document.getElementById('listenBtn');
    if (!listenBtn) return;
    var label = listenBtn.querySelector('[data-listen-label]') || listenBtn.querySelector('.action-label');
    if (label) label.textContent = text;
    listenBtn.classList.toggle('active', state !== 'idle');
  }

  function unwrapActiveSpan(span) {
    var parent = span && span.parentNode;
    if (!parent) return false;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
    // Merge adjacent text nodes so future word offsets still map to real text nodes.
    try { parent.normalize(); } catch (e) {}
    return true;
  }

  // Unwrap any tts-active spans back to text so we don't litter the DOM as we read.
  function clearActiveWord() {
    var changed = false;
    if (activeWordEl) {
      changed = unwrapActiveSpan(activeWordEl) || changed;
      activeWordEl = null;
    }
    var root = articleEl || document;
    var stragglers = root.querySelectorAll ? root.querySelectorAll('.tts-active') : [];
    for (var s = 0; s < stragglers.length; s++) {
      changed = unwrapActiveSpan(stragglers[s]) || changed;
    }
    if (changed && state !== 'idle' && articleEl && sessionChunks.length) {
      buildWordIndex(articleEl, sessionChunks);
    }
  }

  // Smooth-scroll the active word into view if it has drifted outside the comfortable middle band.
  function scrollIntoBand(el, force) {
    if (!el) return;
    if (!force && Date.now() < userScrollPauseUntil) return;
    var rect = el.getBoundingClientRect();
    var winH = window.innerHeight || document.documentElement.clientHeight;
    var topBand = Math.min(120, winH * 0.20);
    var bottomBand = winH - Math.min(160, winH * 0.30);
    if (rect.top >= topBand && rect.bottom <= bottomBand) return;
    var target = window.scrollY + rect.top - (winH * 0.30);
    lastProgrammaticScroll = Date.now();
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }

  function pauseAutoFollowForUser() {
    if (state !== 'playing') return;
    if (Date.now() - lastProgrammaticScroll < 500) return;
    userScrollPauseUntil = Date.now() + AUTO_FOLLOW_PAUSE_MS;
  }

  // Build the flat word index used by highlightAt(). Walks the article DOM once
  // and records every word's text node + offset so we can highlight a specific
  // occurrence by ordinal position rather than by text search.
  function buildWordIndex(article, chunks) {
    articleWords = [];
    chunkStartWord = [];
    if (!article) return;
    try { article.normalize(); } catch (e) {}
    var walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      var re = /\S+/g, m;
      while ((m = re.exec(node.nodeValue)) !== null) {
        articleWords.push({ node: node, start: m.index, end: m.index + m[0].length });
      }
    }
    var w = 0;
    for (var i = 0; i < chunks.length; i++) {
      chunkStartWord.push(w);
      w += (chunks[i].match(/\S+/g) || []).length;
    }
  }

  // Convert an utterance-relative charIndex (start of the spoken word) into the
  // 0-based word offset within that chunk.
  function wordOffsetInChunk(text, charIndex) {
    var sub = text.slice(0, Math.min(charIndex + 1, text.length));
    var matches = sub.match(/\S+/g);
    return matches ? matches.length - 1 : 0;
  }

  function highlightAt(globalIdx, forceFollow) {
    // Defensive: clear any prior span before placing a new one.
    clearActiveWord();
    var w = articleWords[globalIdx];
    if (!w || !w.node || !w.node.parentNode) return;
    if (w.end > (w.node.nodeValue || '').length) return;
    try {
      var range = document.createRange();
      range.setStart(w.node, w.start);
      range.setEnd(w.node, w.end);
      var span = document.createElement('span');
      span.className = 'tts-active';
      range.surroundContents(span);
      activeWordEl = span;
      scrollIntoBand(span, forceFollow);
    } catch (e) { /* range failed; skip */ }
  }

  function speakAt(idx) {
    if (idx >= utterances.length) { stop(); return; }
    currentIndex = idx;
    var u = utterances[idx];
    setStatus('Reading ' + (idx + 1) + ' / ' + utterances.length);
    highlightAt(chunkStartWord[idx] || 0, idx === 0);
    synth.speak(u);
  }

  function start() {
    if (state !== 'idle') return;
    var article = document.querySelector('.article-content') || document.querySelector('.blog-article');
    if (!article) return;
    articleEl = article;
    synth.cancel();
    var raw = (article.textContent || '').replace(/\s+/g, ' ').trim();
    if (!raw) return;
    var chunks = chunkText(raw);
    if (!chunks.length) return;
    sessionChunks = chunks;
    buildWordIndex(article, chunks);
    var voice = pickVoice();
    utterances = chunks.map(function (chunk, i) {
      var u = new SpeechSynthesisUtterance(chunk);
      if (voice) u.voice = voice;
      u.rate = playbackRate; u.pitch = 1; u.volume = 1;
      u.onboundary = function (ev) {
        if (ev.name !== 'word') return;
        var idx = (chunkStartWord[i] || 0) + wordOffsetInChunk(chunk, ev.charIndex);
        highlightAt(idx);
      };
      u.onend = function () {
        clearActiveWord();
        if (state === 'playing') speakAt(i + 1);
      };
      u.onerror = function () { stop(); setState('error'); };
      return u;
    });
    setState('playing');
    userScrollPauseUntil = 0;
    setPlayIcon(false);
    setBtnLabel('Stop');
    speakAt(0);
  }

  function togglePause() {
    if (state === 'playing') {
      synth.pause();
      setState('paused');
      setPlayIcon(true);
      setStatus('Paused');
    } else if (state === 'paused') {
      synth.resume();
      setState('playing');
      userScrollPauseUntil = 0;
      setPlayIcon(false);
      setStatus('Reading ' + (currentIndex + 1) + ' / ' + utterances.length);
    }
  }

  function stop() {
    // Set state BEFORE cancel(): cancel() fires the current utterance's onend synchronously,
    // and onend checks `state === 'playing'` to decide whether to queue the next chunk.
    setState('idle');
    // Drop any pending utterance handlers so a late event can't restart playback.
    utterances.forEach(function (u) { u.onend = null; u.onboundary = null; u.onerror = null; });
    try {
      if (synth.paused) synth.resume();
      synth.cancel();
    } catch (e) {}
    utterances = [];
    currentIndex = 0;
    articleEl = null;
    sessionChunks = [];
    articleWords = [];
    chunkStartWord = [];
    userScrollPauseUntil = 0;
    clearActiveWord();
    if (player) {
      player.classList.remove('show');
      var p = player;
      player = null;
      setTimeout(function () { if (p && p.parentNode) p.parentNode.removeChild(p); }, 300);
    }
    setBtnLabel('Listen');
  }

  // The main Listen button's active label is "Stop"; pause/resume lives in the mini-player.
  function onListenButton() {
    if (state === 'idle' || state === 'error') {
      if (state === 'error') state = 'idle';
      buildPlayer();
      start();
    } else {
      stop();
    }
  }

  function setRate(value) {
    value = Number(value);
    playbackRate = allowedRates.indexOf(value) !== -1 ? value : 1;
    utterances.forEach(function (utterance) { utterance.rate = playbackRate; });
    return playbackRate;
  }

  window.uicListen = {
    toggle: onListenButton,
    start: start,
    stop: stop,
    togglePause: togglePause,
    getState: function () { return state; },
    setRate: setRate
  };

  // Stop on navigation away.
  window.addEventListener('pagehide', stop);
  window.addEventListener('beforeunload', stop);
  window.addEventListener('wheel', pauseAutoFollowForUser, { passive: true });
  window.addEventListener('touchmove', pauseAutoFollowForUser, { passive: true });
  document.addEventListener('keydown', function (e) {
    var navKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
    if (state !== 'idle' && navKeys.indexOf(e.key) !== -1) pauseAutoFollowForUser();
    if (state !== 'idle' && e.key === 'Escape') stop();
  });
})();
