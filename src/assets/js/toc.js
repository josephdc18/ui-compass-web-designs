/**
 * Table of Contents
 * - Auto-builds a hierarchical TOC from h2 + h3 headings inside .article-content
 *   (and any [data-toc-section] blocks like FAQ / Related Guides). Each h2 is a
 *   top-level <li>; the h3s that follow it nest into that <li>'s <ol>.
 * - Active-state detection uses the same scroll-position model as the service
 *   page TOC (initServiceToc): the LAST heading whose top crosses the offset
 *   line is "current". This makes the border-left + color + padding transition
 *   in CSS animate smoothly as you scroll past each heading, including h3s.
 * - initServiceToc handles the existing service-page sidebar pattern (kept
 *   verbatim). Both code paths now share the same DOM contract:
 *   <nav class="toc"> > <ol> > <li> > <a href="#id">…</a> [+ nested <ol>].
 */
(function () {
  'use strict';

  var HEADER_OFFSET = 140;

  // -------------------------------------------------------------------
  // Shared scroll-spy: powers both the blog and the service-page TOC.
  // Active link is the LAST heading whose top crosses the offset line.
  // -------------------------------------------------------------------

  function bindScrollSpy(rootNav, options) {
    var headerOffset = (options && options.headerOffset) || HEADER_OFFSET;
    var onActiveChange = (options && options.onActiveChange) || function () {};

    var links = Array.from(rootNav.querySelectorAll('a[href^="#"]'));
    if (!links.length) return null;

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

    if (!items.length) return null;

    var lastActiveId = null;

    function setActiveLink(id) {
      links.forEach(function (link) {
        var isActive = getLinkTargetId(link) === id;
        link.classList.toggle('active', isActive);
        link.classList.toggle('cs-toc-current', isActive);
        if (isActive) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
      if (id !== lastActiveId) {
        lastActiveId = id;
        onActiveChange(id);
      }
    }

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

    var articleContent = document.querySelector('.article-content');
    if (!articleContent) {
      sidebar.remove();
      return;
    }

    // Headings: h2/h3 in the body, plus h2s in [data-toc-section] blocks
    // (FAQ + Related Guides). Section h2s land at the top level alongside body h2s.
    var bodyHeadings = Array.from(articleContent.querySelectorAll('h2, h3'));
    var sectionHeadings = Array.from(document.querySelectorAll('[data-toc-section] h2'));
    var headings = bodyHeadings.concat(sectionHeadings);

    if (!headings.length) {
      sidebar.remove();
      return;
    }

    // Make sure every heading has an id we can anchor to.
    headings.forEach(function (h, i) {
      if (!h.id) h.id = 'section-' + (i + 1);
    });

    // Build nested <ol>. h3s tuck into the most recent h2's child <ol>.
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

    // Wire scroll-spy. On active change, also keep the active link visible
    // in the sidebar's scroll viewport (long TOCs scroll independently).
    bindScrollSpy(nav, {
      headerOffset: HEADER_OFFSET,
      onActiveChange: function () {
        var activeLink = nav.querySelector('a.active');
        if (!activeLink) return;
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
    });
  }

  // -------------------------------------------------------------------
  // Service-page TOC: markup is hand-authored (already nested OLs),
  // we just wire the scroll-spy.
  // -------------------------------------------------------------------

  function initServiceToc() {
    var serviceToc = document.querySelector('#service-sidebar .toc');
    if (!serviceToc) return;
    bindScrollSpy(serviceToc, { headerOffset: HEADER_OFFSET });
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
