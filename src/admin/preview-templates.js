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
      // Inert in preview — these are JS-driven on the live site
      '.article-actions, .toc-mobile, .toc-sidebar,',
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
  // 4. Inline SVG icons matching the production layout
  // -------------------------------------------------------------------
  function checkIconSvg() {
    return h('svg', {
      viewBox: '0 0 24 24', 'aria-hidden': true, focusable: 'false',
      fill: 'none', stroke: 'currentColor', strokeWidth: 3,
      strokeLinecap: 'round', strokeLinejoin: 'round'
    }, h('polyline', { points: '4 12 10 18 20 6' }));
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
      var tldrTitle = data.get('tldrTitle') || 'What you need to know';
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
      // List items come back as Immutable Maps shaped like { point: "..." }.
      // The previous project's preview rendered them as `[object Object]`
      // because it tried to use the Map directly. Pull `.get('point')`.
      var tldrBox = null;
      if (tldr && typeof tldr.size !== 'undefined' && tldr.size > 0) {
        tldrBox = h('aside', { className: 'tldr-box' },
          h('div', { className: 'tldr-header' },
            h('span', { className: 'tldr-badge' }, 'TL;DR'),
            h('span', { className: 'tldr-title' }, tldrTitle)
          ),
          h('ul', { className: 'tldr-points' },
            tldr.map(function (item, i) {
              var text = (item && typeof item.get === 'function') ? item.get('point') : item;
              return h('li', { key: i }, checkIconSvg(), h('span', {}, text || ''));
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

      // ---- Related guides ----
      var relatedSection = null;
      if (related && typeof related.size !== 'undefined' && related.size > 0) {
        relatedSection = h('section', { className: 'related-guides' },
          h('header', { className: 'related-guides-header' },
            h('h2', {}, 'Related guides')
          ),
          h('div', { className: 'related-guides-body' },
            related.map(function (link, i) {
              var url = (link && typeof link.get === 'function') ? link.get('url') : '#';
              var title = (link && typeof link.get === 'function') ? link.get('title') : '';
              return h('a', { className: 'related-link', href: url || '#', key: i },
                h('span', {}, title || url || '')
              );
            }).toArray()
          )
        );
      }

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
            faqSection,
            relatedSection
          )
        ),
        h('div', { className: 'preview-featured-stub' },
          'Featured Posts sidebar is rendered from collections at build time — not shown in preview.'
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
})();
