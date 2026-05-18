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

  function initBlogToc() {
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
