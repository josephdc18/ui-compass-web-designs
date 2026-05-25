/* =====================================================================
   Decap CMS — Live Preview Templates

   Mirrors src/_layouts/blog-post.html so the editor sees the post the way
   it'll render in production. Loaded by src/admin/index.html AFTER the
   decap-cms UMD bundle, which exposes:
     - window.CMS         (Decap's API)
     - window.h           (React.createElement)
     - window.createClass (React.createClass shim)

   Class names below match production exactly so the registered CSS
   (root.css / critical.css / interior.css / blog.css / blog-extras.css)
   applies without translation.
   ===================================================================== */
(function () {
  'use strict';

  if (!window.CMS) {
    console.error('[preview-templates] window.CMS not found — was decap-cms.js loaded first?');
    return;
  }

  var h = window.h;
  var createClass = window.createClass;

  // -------------------------------------------------------------------
  // 1. Register production CSS so the preview iframe matches the live site
  // -------------------------------------------------------------------
  CMS.registerPreviewStyle('/css/root.css');
  CMS.registerPreviewStyle('/css/critical.css');
  CMS.registerPreviewStyle('/css/interior.css');
  CMS.registerPreviewStyle('/css/blog.css');
  CMS.registerPreviewStyle('/css/blog-extras.css');

  // -------------------------------------------------------------------
  // 2. Preview-only overrides
  //    Two production rules use `body:has(.blog-with-toc)` selectors that
  //    won't match in Decap's preview iframe (its body isn't ours). We
  //    re-declare the tokens at :root. We also hide JS-driven chrome that's
  //    inert in preview, force a single-column flow, and stub the build-
  //    time Featured Posts sidebar.
  // -------------------------------------------------------------------
  CMS.registerPreviewStyle(
    [
      ':root {',
      '  --blog-side-gutter: 1rem;',
      '}',
      'body { background: #fff; padding: 0; margin: 0; }',
      // Inert in preview — these are JS-driven on the live site.
      // .toc-sidebar / .toc-mobile are populated by toc.js from rendered
      // headings at runtime; in preview they'd just be empty containers.
      // .post-share, .post-quick-actions, .focus-exit-btn need JS to do
      // anything meaningful, so they'd just dangle here.
      '.article-actions, .toc-sidebar, .toc-mobile,',
      '.banner-print-btn, .pb-go-top-progress, .audit-fab,',
      '.post-share, .post-quick-actions, .focus-exit-btn,',
      '.blog-sidebar { display: none !important; }',
      // Single-column flow regardless of viewport
      '.blog-container.blog-with-toc { display: block !important; }',
      '.main-content, .blog-article { width: 100% !important; max-width: none !important; }',
      // Featured-posts stub
      '.preview-featured-stub {',
      '  border: 1px dashed #cbd0d6; border-radius: 8px;',
      '  padding: 1rem; margin: 1.5rem 0;',
      '  color: #7a7889; font-size: 0.85rem; text-align: center;',
      '}'
    ].join('\n'),
    { raw: true }
  );

  // -------------------------------------------------------------------
  // 3. Date helpers (no luxon in the iframe — use Intl)
  // -------------------------------------------------------------------
  function toDate(value) {
    if (!value) return null;
    var d = (value instanceof Date) ? value : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // Matches the `postDate` filter in .eleventy.js (luxon DATE_MED): "Jan 15, 2024"
  function formatPostDate(value) {
    var d = toDate(value);
    if (!d) return '';
    try {
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
    } catch (e) { return d.toDateString(); }
  }

  // Matches the `monthYear` filter: "January 2024"
  function formatMonthYear(value) {
    var d = toDate(value);
    if (!d) return '';
    try {
      return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(d);
    } catch (e) { return d.toDateString(); }
  }

  // -------------------------------------------------------------------
  // 4. Inline markdown renderer for short frontmatter strings (TL;DR
  //    bullets). Mirrors the production `mdInline` filter for the
  //    patterns we actually author: **bold**, *italic*, `code`,
  //    [text](url), and pass-through HTML (mdInline runs with html:true).
  // -------------------------------------------------------------------
  function renderInlineMd(value) {
    if (value == null) return '';
    var s = String(value);
    // code spans first so their contents aren't re-processed
    s = s.replace(/`([^`]+)`/g, function (_, c) { return '<code>' + c + '</code>'; });
    // links
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
      return '<a href="' + u + '">' + t + '</a>';
    });
    // bold (greedy across spaces, non-greedy across **)
    s = s.replace(/\*\*([^*]+(?:\*(?!\*)[^*]+)*)\*\*/g, '<strong>$1</strong>');
    // italic — single * not adjacent to another *
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    return s;
  }

  // -------------------------------------------------------------------
  // 5. BlogPostPreview — mirrors blog-post.html
  // -------------------------------------------------------------------
  var BlogPostPreview = createClass({
    render: function () {
      var entry = this.props.entry;
      var data = entry.getIn(['data']);
      if (!data) return h('div', { style: { padding: '2rem' } }, 'Loading…');

      var getAsset = this.props.getAsset;
      var widgetFor = this.props.widgetFor;

      // ---- Pull frontmatter ----
      var blogTitle = data.get('blogTitle') || 'Untitled post';
      var author = data.get('author') || 'UI Compass';
      var authorImage = data.get('authorImage');
      var authorUrl = data.get('authorUrl');
      var date = data.get('date');
      var updated = data.get('updated');
      var image = data.get('image');
      var imageAlt = data.get('imageAlt') || '';
      var topper = data.get('topper');
      var summary = data.get('summary');
      var tldrTitle = data.get('tldrTitle') || 'Key Takeaways';
      var tldr = data.get('tldr');
      var faq = data.get('faq');

      // Resolve uploaded-asset paths so unsaved images render live in preview
      var imageSrc = image ? getAsset(image).toString() : null;
      var avatarSrc = authorImage ? getAsset(authorImage).toString() : null;

      // ---- Breadcrumbs (matches .post-crumbs in blog-post.html) ----
      var crumbs = h('nav', { className: 'post-crumbs', 'aria-label': 'Breadcrumb' },
        h('a', { href: '/' }, 'Home'),
        h('span', { className: 'post-crumbs-sep', 'aria-hidden': true }, '/'),
        h('a', { href: '/blog/' }, 'Blog')
      );

      // ---- Header (topper + title + post-meta) ----
      var authorNode = authorUrl
        ? h('a', { className: 'post-meta-author', href: authorUrl }, author)
        : h('span', { className: 'post-meta-author post-meta-author--plain' }, author);

      var avatarHref = authorUrl || '/about/';
      var postHeader = h('header', { className: 'post-header' },
        topper && h('span', { className: 'post-topper', key: 'topper' }, topper),
        h('h1', { className: 'post-title' }, blogTitle),
        h('div', { className: 'post-meta' },
          h('div', { className: 'post-meta-left' },
            avatarSrc && h('a', { className: 'post-meta-avatar', href: avatarHref, key: 'avatar' },
              h('img', { src: avatarSrc, alt: author, width: 44, height: 44 })
            ),
            h('div', { className: 'post-meta-info' },
              h('div', { className: 'post-meta-line' },
                authorNode,
                h('span', { className: 'post-meta-dot', 'aria-hidden': true }),
                h('span', { className: 'post-meta-date' },
                  updated ? ('Updated on ' + formatPostDate(updated)) : formatPostDate(date)
                )
              ),
              updated && h('div', { className: 'post-meta-original', key: 'original' },
                'Originally published in ' + formatMonthYear(date) + '.')
            )
          )
        )
      );

      // ---- Optional summary paragraph (matches {{ summary | mdInline | safe }}) ----
      var summaryNode = summary
        ? h('p', { className: 'post-summary', dangerouslySetInnerHTML: { __html: renderInlineMd(summary) } })
        : null;

      // ---- TL;DR box ----
      // Mirrors blog-post.html: a single .tldr-title heading (CSS uppercases
      // it) and disc-marker <li><span>…</span></li> rows. Each bullet is
      // rendered through renderInlineMd so **bold** etc. match production's
      // `point | mdInline | safe`. List items come back as Immutable Maps
      // shaped like { point: "..." } — pull `.get('point')`.
      var tldrBox = null;
      if (tldr && typeof tldr.size !== 'undefined' && tldr.size > 0) {
        tldrBox = h('aside', { className: 'tldr-box' },
          h('h2', { className: 'tldr-title' }, tldrTitle),
          h('ul', { className: 'tldr-points' },
            tldr.map(function (item, i) {
              var text = (item && typeof item.get === 'function') ? item.get('point') : item;
              return h('li', { key: i },
                h('span', { dangerouslySetInnerHTML: { __html: renderInlineMd(text) } })
              );
            }).toArray()
          )
        );
      }

      // ---- Hero image inside article ----
      var heroImg = imageSrc
        ? h('picture', { className: 'blog-mainImage' },
            h('img', { src: imageSrc, alt: imageAlt }))
        : null;

      // ---- FAQ ----
      // `text` widget per config.yml — value is plain text or HTML. Match
      // production's `{{ item.a | safe }}` by injecting via dangerouslySet.
      var faqSection = null;
      if (faq && typeof faq.size !== 'undefined' && faq.size > 0) {
        faqSection = h('section', { className: 'faq-section' },
          h('header', { className: 'faq-section-header' },
            h('h2', {}, 'Frequently asked questions')
          ),
          h('div', { className: 'faq-section-body' },
            h('div', { className: 'faq-accordion' },
              faq.map(function (item, i) {
                var q = (item && typeof item.get === 'function') ? item.get('q') : '';
                var a = (item && typeof item.get === 'function') ? item.get('a') : '';
                return h('details', { className: 'faq-item', open: true, key: i },
                  h('summary', {}, q || ''),
                  h('div', {
                    className: 'faq-answer',
                    dangerouslySetInnerHTML: { __html: a || '' }
                  })
                );
              }).toArray()
            )
          )
        );
      }

      // Related posts now render in the sidebar (Featured Posts column),
      // resolved from collections.post at build time. The sidebar isn't
      // rendered in preview, so there's nothing to mirror here. The `related`
      // frontmatter is still editable via the Decap form fields above.

      // ---- Compose full preview ----
      return h('div', { className: 'blog-container main-content-wrapper blog-with-toc' },
        h('div', { className: 'main-content' },
          h('article', { className: 'blog-article' },
            crumbs,
            heroImg,
            postHeader,
            summaryNode,
            tldrBox,
            h('section', { className: 'article-content', id: 'blog-content' },
              widgetFor('body')
            ),
            faqSection
          )
        ),
        h('div', { className: 'preview-featured-stub' },
          'Featured Posts + Related Posts sidebar is rendered from collections at build time — not shown in preview.'
        )
      );
    }
  });

  // -------------------------------------------------------------------
  // 6. Register the template for the 'blog' collection.
  //    `name` here MUST match the collection `name:` in src/admin/config.yml.
  // -------------------------------------------------------------------
  CMS.registerPreviewTemplate('blog', BlogPostPreview);

  // -------------------------------------------------------------------
  // No `preSave` hook here on purpose. The previous project's hook
  // injected `lastUpdated` into every collection on save, which polluted
  // blog frontmatter with a field the layout doesn't read. The `updated`
  // field is editor-controlled in our schema — automatic timestamping
  // would just confuse the byline.
  //
  // If we add one later, scope it explicitly:
  //   if (entry.get('collection') === 'some-collection') { ... }
  // -------------------------------------------------------------------

  // -------------------------------------------------------------------
  // 7. Ghost-text placeholders for plain text inputs.
  //    Decap has no native `placeholder:` schema key, so we DOM-inject
  //    them after the editor mounts. This is cosmetic only — placeholders
  //    vanish on focus and never reach saved YAML. Scope: <input type=
  //    "text">, untyped <input>, and <textarea>. Explicitly skips the
  //    Slate-based markdown body, date pickers, file/image widgets.
  //
  //    Failure mode: if Decap's DOM changes in a future release and we
  //    can't find the editor root, we disconnect and log once at debug.
  //    No author-visible breakage.
  // -------------------------------------------------------------------
  var PLACEHOLDERS = {
    blogTitle: '5 Signs You Are Ready for a Website',
    pageName: '5-signs-ready-for-a-website',
    titleTag: 'Ready for a Website?',
    blogDescription: 'Five signals that mean the time is now and two that mean wait.',
    author: 'Joseph C.',
    authorUrl: '/about/',
    topper: 'Strategy',
    imageAlt: 'A checklist with five items checked off in green on a desk next to a phone',
    summary: 'A short paragraph teasing what this post answers.',
    tldrTitle: 'Five signs you are ready',
    point: 'Your competitor has one. **Even a mediocre site beats no site at all**.',
    q: 'How small is too small for a website?',
    a: 'Answer in 2–4 sentences. Use <p>…</p> for paragraph breaks.',
    title: 'Your Instagram Handle Is Not Yours. A Website Is.',
    url: '/blog/social-media-vs-website/'
  };

  function normalizeLabel(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function fieldNameFromAttributes(el) {
    var haystack = [
      el.id,
      el.name,
      el.getAttribute('name'),
      el.getAttribute('aria-label'),
      el.getAttribute('aria-labelledby')
    ].join(' ').toLowerCase();

    var names = Object.keys(PLACEHOLDERS).sort(function (a, b) {
      return b.length - a.length;
    });

    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var pattern = new RegExp('(^|[^a-z0-9])' + escapeRegExp(name.toLowerCase()) + '($|[^a-z0-9])');
      if (pattern.test(haystack)) return name;
    }

    return null;
  }

  function labelTextFor(el) {
    if (el.id && document.querySelector) {
      var safeId = window.CSS && CSS.escape ? CSS.escape(el.id) : el.id.replace(/["\\]/g, '\\$&');
      var directLabel = document.querySelector('label[for="' + safeId + '"]');
      if (directLabel && directLabel.textContent) return normalizeLabel(directLabel.textContent);
    }

    var node = el;
    for (var i = 0; i < 6 && node; i++) {
      if (node.querySelectorAll) {
        var labels = node.querySelectorAll('label');
        if (labels.length === 1 && labels[0].textContent) return normalizeLabel(labels[0].textContent);
      }
      node = node.parentElement;
    }

    return '';
  }

  function hasNearbyLabel(el, expectedText) {
    var expected = normalizeLabel(expectedText);
    var node = el.parentElement;
    for (var i = 0; i < 5 && node; i++) {
      if (node.querySelectorAll) {
        var labels = node.querySelectorAll('label');
        for (var j = 0; j < labels.length; j++) {
          if (normalizeLabel(labels[j].textContent) === expected) return true;
        }
      }
      node = node.parentElement;
    }
    return false;
  }

  function fieldNameFor(el) {
    var attrName = fieldNameFromAttributes(el);
    if (attrName) return attrName;

    // Fallback: find the nearest <label> sibling/ancestor and match its
    // text to a known label. "Title" appears both as the post title and
    // inside Related Guides, so use nearby list-item labels to disambiguate.
    var text = labelTextFor(el);
    if (text === 'title') return hasNearbyLabel(el, 'URL') ? 'title' : 'blogTitle';
    if (text.indexOf('page address') === 0) return 'pageName';
    if (text.indexOf('browser tab') === 0) return 'titleTag';
    if (text.indexOf('google search summary') === 0) return 'blogDescription';
    if (text === 'author name') return 'author';
    if (text === 'author link') return 'authorUrl';
    if (text === 'topper label') return 'topper';
    if (text.indexOf('hero image description') === 0) return 'imageAlt';
    if (text === 'summary') return 'summary';
    if (text.indexOf('key takeaways — heading') === 0) return 'tldrTitle';
    if (text === 'bullet') return 'point';
    if (text === 'question') return 'q';
    if (text === 'answer') return 'a';
    if (text === 'url') return 'url';

    return null;
  }

  function applyPlaceholders(root) {
    var inputs = root.querySelectorAll('input[type="text"], input:not([type]), textarea');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (el.dataset.placeholderApplied) continue;
      // Skip Slate markdown editor, file/image widgets, date pickers
      if (el.closest && el.closest('[data-slate-editor], [data-slate-node], .nc-fileControl-imageUpload, .nc-fileControl-fileUpload')) continue;
      var t = (el.getAttribute('type') || '').toLowerCase();
      if (t === 'datetime-local' || t === 'date' || t === 'time' || t === 'file' || t === 'checkbox' || t === 'radio') continue;
      var name = fieldNameFor(el);
      if (!name) continue;
      var ph = PLACEHOLDERS[name];
      if (!ph) continue;
      el.placeholder = ph;
      el.dataset.placeholderApplied = '1';
    }
  }

  function initPlaceholders() {
    var observer = new MutationObserver(function () {
      var root = document.querySelector('[id^="nc-root"]') || document.body;
      if (!root) return;
      try { applyPlaceholders(root); } catch (e) { /* swallow */ }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    try { applyPlaceholders(document.querySelector('[id^="nc-root"]') || document.body); } catch (e) { /* swallow */ }

    // Bail if Decap never mounts (5s grace period). No spam, no errors.
    setTimeout(function () {
      if (!document.querySelector('[id^="nc-root"]')) {
        observer.disconnect();
        if (window.console && console.debug) {
          console.debug('[preview-templates] No Decap editor root found in 5s — placeholder injection disabled.');
        }
      }
    }, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlaceholders);
  } else {
    initPlaceholders();
  }
})();
