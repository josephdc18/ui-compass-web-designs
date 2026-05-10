/**
 * Table of Contents
 * - Auto-builds from h2 headings inside .article-content (and any [data-toc-section] blocks).
 * - Scroll-spy via IntersectionObserver. rootMargin -80px / -70% means the active item flips
 *   when the heading reaches the top third of the viewport, which feels natural.
 * - Auto-scrolls the desktop sidebar list and the mobile chip rail to keep the active item in view.
 * - Persists last-seen heading per pathname to localStorage; if a returning visitor lands without
 *   a hash and their stored heading is past the first one, shows a "Resume reading" toast.
 * - initServiceToc handles the existing service-page sidebar pattern (kept verbatim).
 */
(function () {
  'use strict';

  var tocObserver = null;
  var tocPositionWriteTimer = null;
  var tocResumeShownThisLoad = false;

  var TOC_POSITION_KEY = 'uic_toc_position';
  var TOC_POSITION_MAX_ENTRIES = 50;
  var TOC_POSITION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  var HEADER_OFFSET = 120;

  function loadTocPositions() {
    try {
      var raw = localStorage.getItem(TOC_POSITION_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { return {}; }
  }

  function saveTocPositions(map) {
    try {
      var entries = Object.entries(map);
      if (entries.length > TOC_POSITION_MAX_ENTRIES) {
        entries.sort(function (a, b) { return (b[1].ts || 0) - (a[1].ts || 0); });
        var trimmed = {};
        for (var i = 0; i < TOC_POSITION_MAX_ENTRIES; i++) trimmed[entries[i][0]] = entries[i][1];
        map = trimmed;
      }
      localStorage.setItem(TOC_POSITION_KEY, JSON.stringify(map));
    } catch (e) { /* private mode, quota, etc. */ }
  }

  function recordTocPosition(id) {
    if (!id || id === 'top') return;
    if (tocPositionWriteTimer) clearTimeout(tocPositionWriteTimer);
    tocPositionWriteTimer = setTimeout(function () {
      var map = loadTocPositions();
      map[window.location.pathname] = { id: id, ts: Date.now() };
      saveTocPositions(map);
    }, 250);
  }

  function showTocResumeToast(headingEl) {
    if (tocResumeShownThisLoad) return;
    tocResumeShownThisLoad = true;
    var text = (headingEl.textContent || '').replace(/<[^>]*>/g, '').trim();
    var display = text.length > 40 ? text.slice(0, 40) + '...' : text;

    var toast = document.createElement('button');
    toast.type = 'button';
    toast.className = 'copy-toast toc-resume-toast';
    toast.setAttribute('aria-label', 'Resume reading at ' + text);
    toast.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>' +
      ' Resume reading: <strong></strong>';
    toast.querySelector('strong').textContent = display;
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('show'); });

    var dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      toast.classList.remove('show');
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 350);
      window.removeEventListener('scroll', onScrollDismiss, { passive: true });
    }
    function onScrollDismiss() { dismiss(); }

    toast.addEventListener('click', function () {
      var elementPosition = headingEl.getBoundingClientRect().top;
      var offsetPosition = elementPosition + window.pageYOffset - HEADER_OFFSET;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      dismiss();
    });
    setTimeout(dismiss, 6000);
    setTimeout(function () {
      window.addEventListener('scroll', onScrollDismiss, { passive: true, once: true });
    }, 500);
  }

  function initBlogToc() {
    if (tocObserver) { tocObserver.disconnect(); tocObserver = null; }
    tocResumeShownThisLoad = false;
    if (tocPositionWriteTimer) { clearTimeout(tocPositionWriteTimer); tocPositionWriteTimer = null; }

    var articleContent = document.querySelector('.article-content');
    if (!articleContent) return;

    var tocList = document.querySelector('.toc-list');
    var tocMobile = document.querySelector('.toc-mobile');
    if (tocList) tocList.innerHTML = '';
    if (tocMobile) tocMobile.querySelectorAll('.toc-chip').forEach(function (c) { c.remove(); });

    var mainHeaders = articleContent.querySelectorAll('h2');
    var sectionHeaders = document.querySelectorAll('[data-toc-section] h2');
    var headers = [].concat(Array.from(mainHeaders), Array.from(sectionHeaders));

    if (headers.length < 1) {
      var sb = document.querySelector('.toc-sidebar');
      var mb = document.querySelector('.toc-mobile');
      if (sb) sb.remove();
      if (mb) mb.remove();
      return;
    }

    var tocItems = [];
    headers.forEach(function (header, i) {
      var text = header.textContent.replace(/<[^>]*>/g, '').trim();
      var id = 'section-' + (i + 1);
      header.id = id;
      var displayText = text.length > 35 ? text.slice(0, 35) + '...' : text;
      tocItems.push({ id: id, text: displayText });
    });

    if (tocList) {
      var overviewLi = document.createElement('li');
      var overviewA = document.createElement('a');
      overviewA.href = '#top';
      overviewA.textContent = 'Overview';
      overviewLi.appendChild(overviewA);
      tocList.appendChild(overviewLi);
      tocItems.forEach(function (item) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + item.id;
        a.textContent = item.text;
        li.appendChild(a);
        tocList.appendChild(li);
      });
    }
    if (tocMobile) {
      var overviewChip = document.createElement('a');
      overviewChip.href = '#top';
      overviewChip.className = 'toc-chip';
      overviewChip.textContent = 'Overview';
      tocMobile.appendChild(overviewChip);
      tocItems.forEach(function (item) {
        var a = document.createElement('a');
        a.href = '#' + item.id;
        a.className = 'toc-chip';
        a.textContent = item.text;
        tocMobile.appendChild(a);
      });
    }

    var observerOptions = { root: null, rootMargin: '-80px 0px -70% 0px', threshold: 0 };
    tocObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        recordTocPosition(id);

        document.querySelectorAll('.toc-list a, .toc-chip').forEach(function (a) {
          var href = a.getAttribute('href');
          if (href !== '#top') a.classList.toggle('active', href === '#' + id);
          else a.classList.remove('active');
        });

        var tocSidebar = document.querySelector('.toc-sidebar');
        if (tocSidebar) {
          var activeLink = tocSidebar.querySelector('.toc-list a.active');
          if (activeLink) {
            var sb = tocSidebar.getBoundingClientRect();
            var lk = activeLink.getBoundingClientRect();
            var linkTop = lk.top - sb.top + tocSidebar.scrollTop;
            var linkBottom = linkTop + lk.height;
            if (linkTop < tocSidebar.scrollTop || linkBottom > tocSidebar.scrollTop + sb.height) {
              tocSidebar.scrollTo({ top: Math.max(0, linkTop - sb.height / 2 + lk.height / 2), behavior: 'smooth' });
            }
          }
        }
        var m = document.querySelector('.toc-mobile');
        if (m) {
          var chip = m.querySelector('.active');
          if (chip) {
            var cr = m.getBoundingClientRect();
            var ch = chip.getBoundingClientRect();
            var left = m.scrollLeft + (ch.left - cr.left) - cr.width / 2 + ch.width / 2;
            m.scrollTo({ left: left, behavior: 'smooth' });
          }
        }
      });
    }, observerOptions);
    headers.forEach(function (h) { tocObserver.observe(h); });

    document.querySelectorAll('.toc-list a[href="#top"], .toc-chip[href="#top"]').forEach(function (a) {
      a.classList.add('active');
    });

    initTocMobileStuckDetection();

    document.querySelectorAll('.toc-list a, .toc-chip').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var targetId = this.getAttribute('href').slice(1);
        if (targetId === 'top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        var target = document.getElementById(targetId);
        if (target) {
          var offsetPosition = target.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      });
    });

    if (!tocResumeShownThisLoad && !window.location.hash) {
      var positions = loadTocPositions();
      var stored = positions[window.location.pathname];
      if (stored && stored.id && stored.ts && (Date.now() - stored.ts) < TOC_POSITION_MAX_AGE_MS) {
        var heading = document.getElementById(stored.id);
        var firstHeading = headers[0];
        if (heading && firstHeading && heading !== firstHeading) {
          setTimeout(function () { showTocResumeToast(heading); }, 600);
        }
      }
    }
  }

  // Keep "Overview" pinned active when the user is above the first section.
  window.addEventListener('scroll', function () {
    var firstHeader = document.querySelector('.article-content h2, [data-toc-section] h2');
    var aboveFirstSection = !firstHeader || firstHeader.getBoundingClientRect().top > (window.innerHeight * 0.3);
    if (aboveFirstSection) {
      document.querySelectorAll('.toc-list a, .toc-chip').forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#top');
      });
      if (window.scrollY < 50) {
        var tocMobile = document.querySelector('.toc-mobile');
        if (tocMobile) tocMobile.scrollTo({ left: 0, behavior: 'smooth' });
      }
    }
  }, { passive: true });

  // Toggle .is-stuck on .toc-mobile while it is pinned by position:sticky, so
  // CSS can give the chip rail extra top padding and not crowd the fixed nav.
  // Uses a 1px sentinel placed just above the rail; when the sentinel scrolls
  // above the sticky offset, the rail is stuck.
  var tocStuckObserver = null;
  function initTocMobileStuckDetection() {
    if (tocStuckObserver) { tocStuckObserver.disconnect(); tocStuckObserver = null; }
    var tocMobile = document.querySelector('.toc-mobile');
    if (!tocMobile || !('IntersectionObserver' in window)) return;

    var sentinel = tocMobile.previousElementSibling;
    if (!sentinel || !sentinel.classList.contains('toc-mobile-sentinel')) {
      sentinel = document.createElement('div');
      sentinel.className = 'toc-mobile-sentinel';
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'height:1px;margin:0;padding:0;pointer-events:none;';
      tocMobile.parentNode.insertBefore(sentinel, tocMobile);
    }

    tocStuckObserver = new IntersectionObserver(function (entries) {
      tocMobile.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { rootMargin: '-61px 0px 0px 0px', threshold: [0, 1] });
    tocStuckObserver.observe(sentinel);
  }

  function initServiceToc() {
    var serviceToc = document.querySelector('#service-sidebar .toc');
    if (!serviceToc) return;

    var links = Array.from(serviceToc.querySelectorAll('a[href^="#"]'));
    if (!links.length) return;

    function getLinkTargetId(link) {
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) !== '#' || href.length < 2) return '';
      return href.slice(1);
    }

    var items = links.map(function (link) {
      var id = getLinkTargetId(link);
      var heading = id ? document.getElementById(id) : null;
      return heading ? { id: id, link: link, heading: heading } : null;
    }).filter(Boolean);

    if (!items.length) return;

    function setActiveLink(id) {
      links.forEach(function (link) {
        var isActive = getLinkTargetId(link) === id;
        link.classList.toggle('active', isActive);
        link.classList.toggle('cs-toc-current', isActive);
        if (isActive) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }

    var headerOffset = 140;
    var ticking = false;

    function updateActiveLink() {
      var scrollPosition = window.scrollY + headerOffset;
      var activeItem = items[0];
      items.forEach(function (item) {
        var headingTop = item.heading.getBoundingClientRect().top + window.scrollY;
        if (headingTop <= scrollPosition) activeItem = item;
      });
      setActiveLink(activeItem.id);
      ticking = false;
    }

    function requestActiveUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActiveLink);
    }

    updateActiveLink();
    window.addEventListener('scroll', requestActiveUpdate, { passive: true });
    window.addEventListener('resize', requestActiveUpdate);

    links.forEach(function (link) {
      link.addEventListener('click', function () {
        var id = getLinkTargetId(this);
        if (id) setActiveLink(id);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initBlogToc();
      initServiceToc();
    });
  } else {
    initBlogToc();
    initServiceToc();
  }
})();
