/**
 * Table of Contents
 * - Auto-builds a hierarchical TOC from h2 + h3 headings inside .article-content
 *   (and any [data-toc-section] blocks like FAQ / Related Guides). Each h2 is a
 *   top-level <li>; the h3s that follow it nest into that <li>'s <ol>.
 * - Active-state detection uses the same scroll-position model as the service
 *   page TOC (initServiceToc): the LAST heading whose top crosses the offset
 *   line is "current". This makes the border-left + color + padding transition
 *   in CSS animate smoothly as you scroll past each heading, including h3s.
 * - initServiceToc uses the hand-authored service-page sidebar for desktop and
 *   generates the same mobile chip rail pattern used by blog posts. Both code
 *   paths now share the same DOM contract:
 *   <nav class="toc"> > <ol> > <li> > <a href="#id">…</a> [+ nested <ol>].
 */
(function () {
  'use strict';

  var HEADER_OFFSET = 140;

  // -------------------------------------------------------------------
  // Shared scroll-spy: powers both the blog and the service-page TOC.
  // Active link is the LAST heading whose top crosses the offset line.
  // -------------------------------------------------------------------

  function bindScrollSpy(roots, options) {
    var headerOffset = (options && options.headerOffset) || HEADER_OFFSET;
    var onActiveChange = (options && options.onActiveChange) || function () {};
    var onActiveUpdate = (options && options.onActiveUpdate) || function () {};

    // Accept either a single nav element or an array (e.g. [desktopNav, mobileChipRail]).
    // Both navs share active-state since they point at the same heading IDs.
    var rootList = Array.isArray(roots) ? roots : [roots];
    var links = [];
    rootList.forEach(function (r) {
      if (!r) return;
      Array.prototype.push.apply(links, Array.from(r.querySelectorAll('a[href^="#"]')));
    });
    if (!links.length) return null;

    function getLinkTargetId(link) {
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) !== '#' || href.length < 2) return '';
      return href.slice(1);
    }

    // Dedupe by heading id. When the blog passes BOTH the desktop nav and the
    // mobile chip rail, the same heading shows up via two links (mobile only
    // has h2 chips, but those h2s also appear in the desktop nav). Without
    // dedup the loop in updateActiveLink hits each duplicate and the LAST
    // match wins — and because mobile chips are h2-only and iterate after the
    // desktop's h3 entries, the active state always snapped back up to an h2,
    // skipping the h3 highlight as you scroll past subsections. setActiveLink
    // already toggles every link with the matching href, so one items entry
    // per heading is enough.
    var seenIds = {};
    var items = [];
    links.forEach(function (link) {
      var id = getLinkTargetId(link);
      if (!id || seenIds[id]) return;
      var target = document.getElementById(id);
      // Must resolve to an actual heading. The blog's mobile chip rail has an
      // Overview link to #top, which resolves to a hidden <a class="anchor"
      // id="top"> sitting near the top of the article — including it in items
      // would dominate the LAST-match-wins logic and stick activeItem on
      // #top forever (since it sits above every real heading). Overview
      // pinning is handled separately via onActiveChange(null).
      if (!target || !/^H[1-6]$/.test(target.tagName)) return;
      seenIds[id] = true;
      items.push({ id: id, link: link, heading: target });
    });

    if (!items.length) return null;

    var lastActiveId;

    function setActiveLink(id) {
      links.forEach(function (link) {
        var isActive = id !== null && getLinkTargetId(link) === id;
        link.classList.toggle('active', isActive);
        link.classList.toggle('cs-toc-current', isActive);
        if (isActive) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
      onActiveUpdate(id);
      if (id !== lastActiveId) {
        lastActiveId = id;
        onActiveChange(id);
      }
    }

    var ticking = false;

    function updateActiveLink() {
      var scrollPosition = window.scrollY + headerOffset;
      // null = above all headings. Blog and service pages use this to pin the
      // "Overview" chip because #top is intentionally not tracked as a heading.
      var activeItem = null;
      items.forEach(function (item) {
        var headingTop = item.heading.getBoundingClientRect().top + window.scrollY;
        if (headingTop <= scrollPosition) activeItem = item;
      });
      setActiveLink(activeItem ? activeItem.id : null);
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

    // Smooth-scroll to anchor on click + immediate active-state update.
    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = getLinkTargetId(link);
        if (!id) return;
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        var offsetPosition = target.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        setActiveLink(id);
      });
    });

    return { items: items, links: links };
  }

  // -------------------------------------------------------------------
  // Blog TOC: walks h2 + h3 in .article-content and builds hierarchical OLs.
  // -------------------------------------------------------------------

  function initReaderBlogToc() {
    var panel = document.querySelector('.toc-sidebar.reader-panel');
    var nav = panel && panel.querySelector('.toc');
    var article = document.getElementById('blog-content');
    if (!panel || !nav || !article) return;

    var headings = Array.from(article.querySelectorAll('h2, h3'))
      .concat(Array.from(document.querySelectorAll('[data-toc-section] h2')));
    var trigger = document.querySelector('[data-panel-toggle="contents"]');
    if (!headings.length) {
      panel.hidden = true;
      if (trigger) trigger.hidden = true;
      return;
    }

    var used = new Set(Array.from(document.querySelectorAll('[id]')).map(function (el) { return el.id; }));
    function runtimeSlug(value) {
      var base = String(value || '').toLocaleLowerCase().normalize('NFKC')
        .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';
      var slug = base;
      var suffix = 2;
      while (used.has(slug)) slug = base + '-' + suffix++;
      used.add(slug);
      return slug;
    }
    headings.forEach(function (heading) {
      if (!heading.id) heading.id = runtimeSlug(heading.textContent);
    });

    var list = document.createElement('ol');
    var sublist = null;
    headings.forEach(function (heading) {
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = heading.textContent.replace(/\s+/g, ' ').trim();
      item.appendChild(link);
      if (heading.tagName === 'H3' && list.lastElementChild) {
        if (!sublist) {
          sublist = document.createElement('ol');
          list.lastElementChild.appendChild(sublist);
        }
        sublist.appendChild(item);
      } else {
        list.appendChild(item);
        sublist = null;
      }
    });
    nav.replaceChildren(list);

    var sectionCount = document.querySelector('[data-section-count]');
    if (sectionCount) {
      var count = headings.filter(function (heading) { return heading.tagName === 'H2'; }).length;
      sectionCount.textContent = (sectionCount.dataset.template || '· {n} sections').replace('{n}', String(count));
    }

    var navRow = document.querySelector('#cs-navigation .cs-container');
    var readerBar = document.querySelector('.reader-bar');
    var navOffset = 0;
    function measureOffset() {
      navOffset = navRow ? navRow.getBoundingClientRect().height : 0;
      document.documentElement.style.setProperty('--reader-sticky-offset', navOffset + 'px');
      requestUpdate();
    }
    function jumpOffset() {
      var barHeight = 0;
      if (readerBar) {
        var rect = readerBar.getBoundingClientRect();
        if (rect.height && rect.top < window.innerHeight / 2) barHeight = rect.height;
      }
      return navOffset + barHeight + 12;
    }
    function bounds() {
      var sections = Array.from(document.querySelectorAll('[data-toc-section]'));
      var end = sections.length ? sections[sections.length - 1] : article;
      return {
        top: article.getBoundingClientRect().top + window.scrollY,
        bottom: end.getBoundingClientRect().bottom + window.scrollY
      };
    }

    var links = Array.from(nav.querySelectorAll('a[href^="#"]'));
    var order = headings.map(function (heading) { return heading.id; });
    var readMinutes = window.uicArticle ? window.uicArticle.getReadMinutes() : null;
    var left = document.querySelector('[data-read-left]');
    var pct = document.querySelector('[data-read-pct]');
    var meters = Array.from(document.querySelectorAll('[data-progress]'));
    var ticking = false;

    // The only writer of scroll-derived reader state.
    function update() {
      ticking = false;
      var range = bounds();
      var offset = jumpOffset();
      var span = range.bottom - range.top - window.innerHeight + offset;
      var fraction = span > 0 ? (window.scrollY + offset - range.top) / span : (window.scrollY + offset >= range.top ? 1 : 0);
      fraction = Math.max(0, Math.min(1, fraction));
      meters.forEach(function (meter) { meter.style.width = (fraction * 100).toFixed(2) + '%'; });
      if (pct) pct.textContent = Math.round(fraction * 100) + '%';
      if (left && readMinutes !== null) left.textContent = fraction >= 1 ? '0' : String(Math.max(1, Math.ceil(readMinutes * (1 - fraction))));

      var line = window.scrollY + offset;
      var active = -1;
      headings.forEach(function (heading, index) {
        if (heading.getBoundingClientRect().top + window.scrollY <= line) active = index;
      });
      links.forEach(function (link) {
        var id = link.getAttribute('href').slice(1);
        var index = order.indexOf(id);
        var isActive = active !== -1 && index === active;
        link.classList.toggle('active', isActive);
        link.classList.toggle('cs-toc-current', isActive);
        link.classList.toggle('is-read', active !== -1 && index !== -1 && index < active);
        if (isActive) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }
    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    measureOffset();
    if (window.ResizeObserver) {
      var geometry = new ResizeObserver(requestUpdate);
      geometry.observe(article);
      var tocSections = Array.from(document.querySelectorAll('[data-toc-section]'));
      if (tocSections.length) geometry.observe(tocSections[tocSections.length - 1]);
      if (readerBar) geometry.observe(readerBar);
      if (navRow) new ResizeObserver(measureOffset).observe(navRow);
    }
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    window.addEventListener('load', requestUpdate);
    document.addEventListener('uic:reader-prefs-changed', requestUpdate);
    document.querySelectorAll('details').forEach(function (details) { details.addEventListener('toggle', requestUpdate); });
    document.querySelectorAll('#blog-content img').forEach(function (image) {
      if (!image.complete) image.addEventListener('load', requestUpdate, { once: true });
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestUpdate);

    function reducedMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var id = link.getAttribute('href').slice(1);
        var target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        // Close the sheet BEFORE measuring or scrolling. While a sheet is open
        // reader-bar.js pins the body with position:fixed, which makes
        // window.scrollTo a no-op AND makes `rect.top + scrollY` meaningless
        // (scrollY reads 0 against a fixed body). Closing first unlocks to the
        // position the reader was already looking at — no visible movement —
        // and leaves a normal document to scroll. restoreFocus:false because
        // focus belongs on the heading we are jumping to, not back on the
        // Contents button.
        document.dispatchEvent(new CustomEvent('uic:reader-close-panels', { detail: { restoreFocus: false } }));
        window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - jumpOffset()), behavior: reducedMotion() ? 'auto' : 'smooth' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        history.replaceState(null, '', '#' + encodeURIComponent(id));
        requestUpdate();
      });
    });

    var initialHash = window.location.hash;
    var mayCorrect = !!initialHash;
    function cancelCorrection() { mayCorrect = false; }
    ['wheel', 'touchstart', 'pointerdown'].forEach(function (type) { window.addEventListener(type, cancelCorrection, { once: true, passive: true }); });
    window.addEventListener('keydown', cancelCorrection, { once: true });
    function alignHash() {
      if (!mayCorrect || window.location.hash !== initialHash) return;
      var id;
      try { id = decodeURIComponent(initialHash.slice(1)); } catch (e) { return; }
      var target = document.getElementById(id);
      if (!target) return;
      window.scrollTo(0, Math.max(0, target.getBoundingClientRect().top + window.scrollY - jumpOffset()));
      requestUpdate();
    }
    function queueHashAlignment() { requestAnimationFrame(function () { requestAnimationFrame(alignHash); }); }
    queueHashAlignment();
    window.addEventListener('load', queueHashAlignment, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueHashAlignment);

    function refreshSavedCount() {
      var count = document.querySelector('[data-saved-count]');
      if (count && window.uicBookmarks) count.textContent = String(window.uicBookmarks.urls().length);
    }
    refreshSavedCount();
    document.addEventListener('uic:bookmarks-changed', refreshSavedCount);
    update();
  }

  function initBlogToc() {
    if (document.body.classList.contains('blog-post-page')) return initReaderBlogToc();
    var sidebar = document.querySelector('.toc-sidebar');
    if (!sidebar) return;
    var nav = sidebar.querySelector('.toc');
    if (!nav) return;

    var mobileRail = document.querySelector('.toc-mobile');

    var articleContent = document.querySelector('.article-content');
    if (!articleContent) {
      sidebar.remove();
      if (mobileRail) mobileRail.remove();
      return;
    }

    // Headings: h2/h3 in the body, plus h2s in [data-toc-section] blocks
    // (FAQ + Related Guides). Section h2s land at the top level alongside body h2s.
    var bodyHeadings = Array.from(articleContent.querySelectorAll('h2, h3'));
    var sectionHeadings = Array.from(document.querySelectorAll('[data-toc-section] h2'));
    var headings = bodyHeadings.concat(sectionHeadings);

    if (!headings.length) {
      sidebar.remove();
      if (mobileRail) mobileRail.remove();
      return;
    }

    // Make sure every heading has an id we can anchor to.
    headings.forEach(function (h, i) {
      if (!h.id) h.id = 'section-' + (i + 1);
    });

    // ---- Desktop: nested <ol> (h3s tuck into the most recent h2's child <ol>) ----
    var rootOl = document.createElement('ol');
    var currentH2Sublist = null;

    headings.forEach(function (h) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/\s+/g, ' ').trim();
      li.appendChild(a);

      if (h.tagName === 'H3' && rootOl.lastElementChild) {
        if (!currentH2Sublist) {
          currentH2Sublist = document.createElement('ol');
          rootOl.lastElementChild.appendChild(currentH2Sublist);
        }
        currentH2Sublist.appendChild(li);
      } else {
        // h2 (or stray h3 before any h2)
        rootOl.appendChild(li);
        currentH2Sublist = null;
      }
    });

    nav.innerHTML = '';
    nav.appendChild(rootOl);

    // ---- Mobile: flat horizontal chip rail (h2s only — h3s are too noisy) ----
    if (mobileRail) {
      mobileRail.innerHTML = '';
      var overviewChip = document.createElement('a');
      overviewChip.href = '#top';
      overviewChip.className = 'toc-chip';
      overviewChip.textContent = 'Overview';
      mobileRail.appendChild(overviewChip);

      headings.forEach(function (h) {
        if (h.tagName !== 'H2') return;
        var chip = document.createElement('a');
        chip.href = '#' + h.id;
        chip.className = 'toc-chip';
        chip.textContent = h.textContent.replace(/\s+/g, ' ').trim();
        mobileRail.appendChild(chip);
      });

      // Top-anchor click handler (separate from bindScrollSpy because '#top'
      // doesn't correspond to a heading element it tracks).
      overviewChip.addEventListener('click', function (e) {
        e.preventDefault();
        setMobileChipActive(nav, mobileRail, null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Wire scroll-spy across BOTH navs (desktop + mobile rail). Active class
    // toggles on every link with the matching #hash, so the rail's chip and
    // the sidebar's link light up in sync. id === null means the user is
    // above all headings (or the page just loaded at scrollY 0); we pin the
    // mobile rail's Overview chip in that case since #top isn't tracked.
    bindScrollSpy([nav, mobileRail], {
      headerOffset: HEADER_OFFSET,
      onActiveUpdate: function (id) {
        if (mobileRail) {
          setMobileChipActive(nav, mobileRail, id);
        }
      },
      onActiveChange: function () {
        // Auto-scroll desktop sidebar (vertical) to keep active link visible
        var activeLink = nav.querySelector('a.active');
        if (activeLink) {
          var sb = sidebar.getBoundingClientRect();
          var lk = activeLink.getBoundingClientRect();
          var linkTop = lk.top - sb.top + sidebar.scrollTop;
          if (linkTop < sidebar.scrollTop || linkTop + lk.height > sidebar.scrollTop + sb.height) {
            sidebar.scrollTo({
              top: Math.max(0, linkTop - sb.height / 2 + lk.height / 2),
              behavior: 'smooth'
            });
          }
        }

        // Auto-scroll mobile chip rail (horizontal) to keep active chip in view
        if (mobileRail) {
          var activeChip = mobileRail.querySelector('.toc-chip.active');
          if (activeChip) {
            var cr = mobileRail.getBoundingClientRect();
            var ch = activeChip.getBoundingClientRect();
            var left = mobileRail.scrollLeft + (ch.left - cr.left) - cr.width / 2 + ch.width / 2;
            mobileRail.scrollTo({ left: left, behavior: 'smooth' });
          }
        }
      }
    });

    if (mobileRail) initTocMobileStuckDetection();
  }

  // Toggle .is-stuck on .toc-mobile while it's pinned by position:sticky, so
  // CSS can give the chip rail extra top padding and not crowd the fixed nav.
  // A 1px sentinel placed just above the rail; when the sentinel scrolls above
  // the sticky offset, the rail is stuck.
  var tocStuckObserver = null;
  function initTocMobileStuckDetection() {
    if (tocStuckObserver) { tocStuckObserver.disconnect(); tocStuckObserver = null; }
    var mobileRail = document.querySelector('.toc-mobile');
    if (!mobileRail || !('IntersectionObserver' in window)) return;

    var sentinel = mobileRail.previousElementSibling;
    if (!sentinel || !sentinel.classList.contains('toc-mobile-sentinel')) {
      sentinel = document.createElement('div');
      sentinel.className = 'toc-mobile-sentinel';
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'height:1px;margin:0;padding:0;pointer-events:none;';
      mobileRail.parentNode.insertBefore(sentinel, mobileRail);
    }

    tocStuckObserver = new IntersectionObserver(function (entries) {
      mobileRail.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { rootMargin: '-61px 0px 0px 0px', threshold: [0, 1] });
    tocStuckObserver.observe(sentinel);
  }

  // -------------------------------------------------------------------
  // Service-page TOC: desktop markup is hand-authored, while the mobile
  // chip rail is generated from the same h2 links so it mirrors blog posts.
  // -------------------------------------------------------------------

  function getHashId(link) {
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) !== '#' || href.length < 2) return '';
    return href.slice(1);
  }

  function findMobileChipById(mobileRail, id) {
    if (!mobileRail) return null;
    var chips = Array.from(mobileRail.querySelectorAll('.toc-chip[href^="#"]'));
    for (var i = 0; i < chips.length; i++) {
      if (getHashId(chips[i]) === id) return chips[i];
    }
    return null;
  }

  function getDirectTocLink(listItem) {
    if (!listItem) return null;
    var child = listItem.firstElementChild;
    while (child) {
      if (child.tagName === 'A' && child.getAttribute('href')) return child;
      child = child.nextElementSibling;
    }
    return null;
  }

  function resolveMobileChipId(nav, mobileRail, activeId) {
    if (!mobileRail || activeId === null || activeId === 'top') return null;
    if (findMobileChipById(mobileRail, activeId)) return activeId;

    var navLinks = nav ? Array.from(nav.querySelectorAll('a[href^="#"]')) : [];
    var activeLink = null;
    navLinks.some(function (link) {
      if (getHashId(link) !== activeId) return false;
      activeLink = link;
      return true;
    });

    var listItem = activeLink ? activeLink.closest('li') : null;
    while (listItem) {
      var parentList = listItem.parentElement;
      var parentItem = parentList ? parentList.closest('li') : null;
      if (!parentItem) break;

      var parentLink = getDirectTocLink(parentItem);
      var parentId = parentLink ? getHashId(parentLink) : '';
      if (parentId && findMobileChipById(mobileRail, parentId)) return parentId;

      listItem = parentItem;
    }

    var activeHeading = document.getElementById(activeId);
    if (!activeHeading || !/^H[1-6]$/.test(activeHeading.tagName)) return null;

    var activeTop = activeHeading.getBoundingClientRect().top + window.scrollY;
    var fallbackId = null;
    Array.from(mobileRail.querySelectorAll('.toc-chip[href^="#"]')).forEach(function (chip) {
      var chipId = getHashId(chip);
      if (chipId === 'top') return;
      var chipHeading = document.getElementById(chipId);
      if (!chipHeading) return;
      var chipTop = chipHeading.getBoundingClientRect().top + window.scrollY;
      if (chipTop <= activeTop) fallbackId = chipId;
    });

    return fallbackId;
  }

  function setMobileChipActive(nav, mobileRail, activeId) {
    if (!mobileRail) return;
    var chipId = resolveMobileChipId(nav, mobileRail, activeId);
    Array.from(mobileRail.querySelectorAll('.toc-chip[href^="#"]')).forEach(function (chip) {
      var id = getHashId(chip);
      var isActive = chipId === null ? id === 'top' : id === chipId;
      chip.classList.toggle('active', isActive);
      if (isActive) chip.setAttribute('aria-current', 'true');
      else chip.removeAttribute('aria-current');
    });
  }

  function ensureServiceMobileRail(serviceSidebar) {
    var existing = document.querySelector('.toc-mobile');
    if (existing) return existing;

    var mobileRail = document.createElement('nav');
    mobileRail.className = 'toc-mobile';
    mobileRail.setAttribute('aria-label', 'Table of contents (mobile)');

    var serviceShell = serviceSidebar.parentElement;
    if (serviceShell && serviceShell.parentNode) {
      serviceShell.parentNode.insertBefore(mobileRail, serviceShell);
    } else if (serviceSidebar.parentNode) {
      serviceSidebar.parentNode.insertBefore(mobileRail, serviceSidebar);
    }

    return mobileRail;
  }

  function buildServiceMobileRail(serviceToc, mobileRail) {
    var tocLinks = Array.from(serviceToc.querySelectorAll('a[href^="#"]'));
    if (!tocLinks.length) return;

    var sectionLinks = tocLinks.filter(function (link) {
      var target = document.getElementById(getHashId(link));
      return target && target.tagName === 'H2';
    });

    if (!sectionLinks.length) sectionLinks = tocLinks;

    mobileRail.innerHTML = '';

    var overviewChip = document.createElement('a');
    overviewChip.href = '#top';
    overviewChip.className = 'toc-chip';
    overviewChip.textContent = 'Overview';
    mobileRail.appendChild(overviewChip);

    sectionLinks.forEach(function (sourceLink) {
      var chip = document.createElement('a');
      chip.href = sourceLink.getAttribute('href');
      chip.className = 'toc-chip';
      chip.textContent = sourceLink.textContent.replace(/\s+/g, ' ').trim();
      mobileRail.appendChild(chip);
    });

    overviewChip.addEventListener('click', function (e) {
      e.preventDefault();
      setMobileChipActive(serviceToc, mobileRail, null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initServiceToc() {
    var serviceSidebar = document.querySelector('#service-sidebar');
    if (!serviceSidebar) return;
    var serviceToc = serviceSidebar.querySelector('.toc');
    if (!serviceToc) return;

    var mobileRail = ensureServiceMobileRail(serviceSidebar);
    buildServiceMobileRail(serviceToc, mobileRail);

    bindScrollSpy([serviceToc, mobileRail], {
      headerOffset: HEADER_OFFSET,
      onActiveUpdate: function (id) {
        if (mobileRail) {
          setMobileChipActive(serviceToc, mobileRail, id);
        }
      },
      onActiveChange: function () {
        if (mobileRail) {

          var activeChip = mobileRail.querySelector('.toc-chip.active');
          if (activeChip) {
            var cr = mobileRail.getBoundingClientRect();
            var ch = activeChip.getBoundingClientRect();
            var left = mobileRail.scrollLeft + (ch.left - cr.left) - cr.width / 2 + ch.width / 2;
            mobileRail.scrollTo({ left: left, behavior: 'smooth' });
          }
        }

        var activeLink = serviceToc.querySelector('a.active');
        if (activeLink) {
          var sb = serviceSidebar.getBoundingClientRect();
          var lk = activeLink.getBoundingClientRect();
          var linkTop = lk.top - sb.top + serviceSidebar.scrollTop;
          if (linkTop < serviceSidebar.scrollTop || linkTop + lk.height > serviceSidebar.scrollTop + sb.height) {
            serviceSidebar.scrollTo({
              top: Math.max(0, linkTop - sb.height / 2 + lk.height / 2),
              behavior: 'smooth'
            });
          }
        }
      }
    });

    initTocMobileStuckDetection();
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
