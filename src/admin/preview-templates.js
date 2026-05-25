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
  //    Two production rules use `body:has(.blog-with-toc)` selectors which
  //    won't match in Decap's preview iframe (its body isn't ours). We
  //    re-declare the tokens at :root and target the banner directly. We
  //    also hide JS-driven chrome that's inert in preview, force a single-
  //    column flow, and stub the build-time Featured Posts sidebar.
  // -------------------------------------------------------------------
  CMS.registerPreviewStyle(
    [
      ':root {',
      '  --blog-side-gutter: 1rem;',
      '  --blog-banner-pt: 2rem;',
      '}',
      'body { background: #fff; padding: 0; margin: 0; }',
      // Inert in preview — these are JS-driven on the live site.
      // .toc-sidebar / .toc-mobile are populated by toc.js from rendered
      // headings at runtime; in preview they'd just be empty containers.
      '.article-actions, .toc-sidebar, .toc-mobile,',
      '.banner-print-btn, .pb-go-top-progress, .audit-fab,',
      '.blog-sidebar { display: none !important; }',
      // Banner: collapse padding so it fits the small preview pane
      '#banner-1106-14 {',
      '  padding: var(--blog-banner-pt) var(--blog-side-gutter) 1.5rem !important;',
      '  overflow: visible !important;',
      '}',
      '#banner-1106-14 .cs-container { width: 100% !important; max-width: none !important; }',
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
      var tldrTitle = data.get('tldrTitle') || 'Key Takeaways';
      var tldr = data.get('tldr');
      var faq = data.get('faq');
      var related = data.get('related');

      // Resolve uploaded-asset paths so unsaved images render live in preview
      var imageSrc = image ? getAsset(image).toString() : null;
      var avatarSrc = authorImage ? getAsset(authorImage).toString() : null;

      // ---- Banner (matches #banner-1106-14 in blog-post.html) ----
      var banner = h('div', { id: 'banner-1106-14' },
        h('div', { className: 'cs-container' },
          h('h1', { className: 'cs-int-title' }, blogTitle),
          h('div', { className: 'cs-breadcrumbs' },
            h('span', { className: 'cs-link' }, 'Home'),
            h('span', { className: 'cs-link' }, 'Blog'),
            h('span', { className: 'cs-link cs-active' }, blogTitle)
          )
        ),
        imageSrc && h('picture', { className: 'cs-background', key: 'banner-bg' },
          h('img', { src: imageSrc, alt: imageAlt, 'aria-hidden': true })
        )
      );

      // ---- Author / dates strip ----
      var authorNode = authorUrl
        ? h('a', { className: 'post-meta-author', href: authorUrl }, author)
        : h('span', { className: 'post-meta-author post-meta-author--plain' }, author);

      var byline = h('div', { className: 'post-meta' },
        avatarSrc && h('span', { className: 'post-meta-avatar', key: 'avatar' },
          h('img', { src: avatarSrc, alt: author })
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
      );

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
      return h('div', { className: 'blog-container blog-with-toc main-content-wrapper' },
        banner,
        h('div', { className: 'main-content' },
          h('article', { className: 'blog-article' },
            heroImg,
            h('div', { className: 'article-group' }, byline),
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

  function fieldNameFor(el) {
    // Decap renders <label for="..."> and the matching input has that id.
    // The id pattern is implementation-detail-y, so look for the nearest
    // ancestor with a data-field or aria-labelledby, then map back via
    // the visible <label> text or the input's `id` parts. We can't trust
    // a single selector — try a few in order of stability.
    var id = el.id || '';
    // Pattern: nc-root_..._<fieldName> or similar. Pull trailing token.
    var m = id.match(/[_-]([a-zA-Z]+)$/);
    if (m && PLACEHOLDERS[m[1]]) return m[1];

    // Fallback: find the nearest <label> sibling/ancestor and match its
    // text to a known label. Use the label rename from config.yml here.
    var node = el;
    for (var i = 0; i < 6 && node; i++) {
      var label = node.querySelector && node.querySelector('label');
      if (label && label.textContent) {
        var text = label.textContent.trim().toLowerCase();
        if (text.indexOf('title') === 0 && !text.indexOf('browser')) return 'blogTitle';
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
        if (text === 'title') return 'title';
        if (text === 'url') return 'url';
      }
      node = node.parentElement;
    }
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
    var started = Date.now();
    var observer = new MutationObserver(function () {
      var root = document.querySelector('[id^="nc-root"]') || document.body;
      if (!root) return;
      try { applyPlaceholders(root); } catch (e) { /* swallow */ }
    });
    observer.observe(document.body, { childList: true, subtree: true });

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
