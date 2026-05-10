/**
 * Listen / TTS
 * Loaded ON DEMAND from article-actions.js the first time the user clicks Listen.
 *
 * - Walks the article body, splits into utterance chunks (~200 chars at sentence boundaries).
 * - Picks a high-quality voice (preferring Neural / Natural / Premium English voices).
 * - Highlights the current word as it speaks (best-effort using boundary events).
 * - Floating mini-player pill: Pause/Resume, Stop, status text.
 *
 * Bound entry point: window.uicListenStart() — invoked by article-actions.js after the
 * first click. Subsequent clicks on #listenBtn toggle pause/resume.
 *
 * Note: SpeechSynthesis is best-effort across browsers. We catch all errors and degrade
 * silently (Listen button reverts to inactive).
 */
(function () {
  'use strict';

  if (window.uicListenStart) return; // already loaded

  if (!('speechSynthesis' in window)) {
    window.uicListenStart = function () {
      console.warn('SpeechSynthesis not available in this browser');
    };
    return;
  }

  var synth = window.speechSynthesis;
  var utterances = [];
  var currentIndex = 0;
  var state = 'idle'; // idle | playing | paused
  var player = null;
  var statusEl = null;
  var playBtn = null;
  var stopBtn = null;
  var listenBtn = null;
  var activeWordEl = null;
  // Built once per Listen session: a flat list of every word's exact DOM position
  // ({ node, start, end }) plus the global word index where each utterance chunk
  // begins. This lets us highlight the correct occurrence of repeated words like
  // "the" by mapping boundary events directly to a word index instead of
  // text-searching the DOM.
  var articleWords = [];
  var chunkStartWord = [];

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

  function expandAcronyms(text) {
    // Force letter-by-letter pronunciation of plain ALL-CAPS acronyms (3-5 letters, surrounded by word boundaries).
    return text.replace(/\b([A-Z]{2,5})\b/g, function (m, ac) {
      // Skip likely common words: NASA-style names get expanded; "USA" → "U.S.A." reads more naturally.
      return ac.split('').join('.') + '.';
    });
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
    playBtn.addEventListener('click', togglePause);
    stopBtn.addEventListener('click', stop);
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

  // Unwrap any tts-active span back to text so we don't litter the DOM as we read.
  function clearActiveWord() {
    if (!activeWordEl) return;
    var parent = activeWordEl.parentNode;
    if (parent) {
      while (activeWordEl.firstChild) parent.insertBefore(activeWordEl.firstChild, activeWordEl);
      parent.removeChild(activeWordEl);
      // Merge adjacent text nodes so future searches still find words across the seam.
      try { parent.normalize(); } catch (e) {}
    }
    activeWordEl = null;
  }

  // Smooth-scroll the active word into view if it has drifted outside the comfortable middle band.
  function scrollIntoBand(el) {
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var winH = window.innerHeight || document.documentElement.clientHeight;
    var topBand = Math.min(120, winH * 0.20);
    var bottomBand = winH - Math.min(160, winH * 0.30);
    if (rect.top >= topBand && rect.bottom <= bottomBand) return;
    var target = window.scrollY + rect.top - (winH * 0.30);
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
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

  function highlightAt(globalIdx) {
    // Defensive: clear any prior span before placing a new one. Also sweep up
    // orphaned tts-active spans so a missed cleanup can't double-highlight.
    clearActiveWord();
    var stragglers = document.querySelectorAll('.tts-active');
    for (var s = 0; s < stragglers.length; s++) {
      var sp = stragglers[s], par = sp.parentNode;
      if (!par) continue;
      while (sp.firstChild) par.insertBefore(sp.firstChild, sp);
      par.removeChild(sp);
      try { par.normalize(); } catch (e) {}
    }
    var w = articleWords[globalIdx];
    if (!w || !w.node || !w.node.parentNode) return;
    if (w.end > (w.node.nodeValue || '').length) return;
    if (w.end - w.start < 3) return; // skip 1-2 char words to avoid flicker
    try {
      var range = document.createRange();
      range.setStart(w.node, w.start);
      range.setEnd(w.node, w.end);
      var span = document.createElement('span');
      span.className = 'tts-active';
      range.surroundContents(span);
      activeWordEl = span;
      scrollIntoBand(span);
    } catch (e) { /* range failed; skip */ }
  }

  function speakAt(idx) {
    if (idx >= utterances.length) { stop(); return; }
    currentIndex = idx;
    var u = utterances[idx];
    setStatus('Reading ' + (idx + 1) + ' / ' + utterances.length);
    synth.speak(u);
  }

  function start() {
    var article = document.querySelector('.article-content') || document.querySelector('.blog-article');
    if (!article) return;
    synth.cancel();
    var raw = (article.textContent || '').replace(/\s+/g, ' ').trim();
    if (!raw) return;
    var chunks = chunkText(expandAcronyms(raw));
    if (!chunks.length) return;
    buildWordIndex(article, chunks);
    var voice = pickVoice();
    utterances = chunks.map(function (chunk, i) {
      var u = new SpeechSynthesisUtterance(chunk);
      if (voice) u.voice = voice;
      u.rate = 1; u.pitch = 1; u.volume = 1;
      u.onboundary = function (ev) {
        if (ev.name !== 'word') return;
        var idx = (chunkStartWord[i] || 0) + wordOffsetInChunk(chunk, ev.charIndex);
        highlightAt(idx);
      };
      u.onend = function () {
        clearActiveWord();
        if (state === 'playing') speakAt(i + 1);
      };
      u.onerror = function () { stop(); };
      return u;
    });
    state = 'playing';
    setPlayIcon(false);
    setBtnLabel('Stop');
    speakAt(0);
  }

  function togglePause() {
    if (state === 'playing') {
      synth.pause();
      state = 'paused';
      setPlayIcon(true);
      setStatus('Paused');
    } else if (state === 'paused') {
      synth.resume();
      state = 'playing';
      setPlayIcon(false);
      setStatus('Reading ' + (currentIndex + 1) + ' / ' + utterances.length);
    }
  }

  function stop() {
    // Set state BEFORE cancel(): cancel() fires the current utterance's onend synchronously,
    // and onend checks `state === 'playing'` to decide whether to queue the next chunk.
    state = 'idle';
    try { synth.cancel(); } catch (e) {}
    // Drop any pending utterance handlers so a late event can't restart playback.
    utterances.forEach(function (u) { u.onend = null; u.onboundary = null; u.onerror = null; });
    utterances = [];
    currentIndex = 0;
    articleWords = [];
    chunkStartWord = [];
    clearActiveWord();
    if (player) {
      player.classList.remove('show');
      var p = player;
      player = null;
      setTimeout(function () { if (p && p.parentNode) p.parentNode.removeChild(p); }, 300);
    }
    setBtnLabel('Listen');
  }

  // The button click while running should pause/resume rather than re-start from the top.
  function onListenButton() {
    if (state === 'idle') {
      buildPlayer();
      // Voices may load async on first use.
      if ((synth.getVoices() || []).length === 0) {
        synth.addEventListener('voiceschanged', start, { once: true });
        setTimeout(start, 400); // belt + suspenders
      } else {
        start();
      }
    } else {
      togglePause();
    }
  }

  // Wire the listen button (replacing the lazy-load shim).
  function bind() {
    listenBtn = document.getElementById('listenBtn');
    if (!listenBtn) return;
    // article-actions.js installed a one-shot listener that already fired. Bind the persistent one.
    listenBtn.addEventListener('click', onListenButton);
  }

  bind();

  // Public entry point invoked by the lazy loader after script load.
  window.uicListenStart = onListenButton;
  window.uicListenStop = stop;

  // Stop on navigation away.
  window.addEventListener('pagehide', stop);
  window.addEventListener('beforeunload', stop);
})();
