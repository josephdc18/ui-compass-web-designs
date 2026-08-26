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

  // Reading time matches src/assets/js/article-actions.js (200 wpm, ceil,
  // singular/plural). Mirroring the production formula so the preview
  // header matches the published header.
  function readingTime(text) {
    if (!text) return null;
    var words = String(text).trim().split(/\s+/).filter(Boolean).length;
    if (words === 0) return null;
    var minutes = Math.max(1, Math.ceil(words / 200));
    return minutes === 1 ? '1 min read' : minutes + ' min read';
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

  // Block-level markdown preview, mirroring the production `mdBlock` filter
  // (.eleventy.js). Powers the FAQ answer preview now that the field is a
  // markdown widget. Legacy FAQ answers were authored as raw HTML (`<p>…</p>`,
  // `<a href="…">`) — those start with a block-level tag, so detect and
  // pass them through unchanged to avoid double-wrapping in <p>.
  function renderBlockMd(value) {
    if (value == null) return '';
    var s = String(value).trim();
    if (!s) return '';
    if (/^<(p|div|ul|ol|blockquote|h[1-6]|pre|table|section|article)\b/i.test(s)) {
      return s;
    }
    return s.split(/\n\s*\n/).map(function (para) {
      return '<p>' + renderInlineMd(para.replace(/\n/g, ' ')) + '</p>';
    }).join('');
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
      var sources = data.get('sources');
      // Source raw markdown for the reading-time count. widgetFor('body')
      // returns the rendered React tree (no .textContent available at
      // render time); data.get('body') gives the markdown source, which
      // is what the published-page reading-time script also winds up
      // counting after HTML parse strips tags.
      var bodyText = data.get('body') || '';
      var readMins = readingTime(bodyText);

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
              h('img', {
                src: avatarSrc,
                alt: author,
                width: 44,
                height: 44,
                onError: function (event) { useDraftUploadFallback(event.currentTarget || event.target); }
              })
            ),
            h('div', { className: 'post-meta-info' },
              h('div', { className: 'post-meta-line' },
                authorNode,
                h('span', { className: 'post-meta-dot', 'aria-hidden': true }),
                h('span', { className: 'post-meta-date' },
                  updated ? ('Updated on ' + formatPostDate(updated)) : formatPostDate(date)
                ),
                readMins && h('span', { className: 'post-meta-dot', 'aria-hidden': true, key: 'rd-dot' }),
                readMins && h('span', { className: 'post-meta-read-time', key: 'rd' }, readMins)
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
            h('img', {
              src: imageSrc,
              alt: imageAlt,
              onError: function (event) { useDraftUploadFallback(event.currentTarget || event.target); }
            }))
        : null;

      // ---- FAQ ----
      // `text` widget per config.yml — value is plain text or HTML. Match
      // production's `{{ item.a | safe }}` by injecting via dangerouslySet.
      var faqSection = null;
      if (faq && typeof faq.size !== 'undefined' && faq.size > 0) {
        faqSection = h('section', { className: 'faq-section', 'data-toc-section': true },
          h('h2', { id: 'faq-heading' }, 'Frequently asked questions'),
          h('div', { className: 'faq-accordion' },
            faq.map(function (item, i) {
              var q = (item && typeof item.get === 'function') ? item.get('q') : '';
              var a = (item && typeof item.get === 'function') ? item.get('a') : '';
              return h('details', { className: 'faq-item', open: true, key: i },
                h('summary', {}, q || ''),
                h('div', {
                  className: 'faq-answer',
                  dangerouslySetInnerHTML: { __html: renderBlockMd(a) }
                })
              );
            }).toArray()
          )
        );
      }

      var sourcesSection = null;
      if (sources && typeof sources.size !== 'undefined' && sources.size > 0) {
        var sourceRows = sources.map(function (item, i) {
          var label = item && typeof item.get === 'function' ? item.get('label') : '';
          var url = item && typeof item.get === 'function' ? item.get('url') : '';
          var rel = item && typeof item.get === 'function' ? item.get('rel') : '';
          if (!label || !/^https:\/\//i.test(url || '')) return null;
          return h('li', { key: i }, h('a', { href: url, target: '_blank', rel: 'noopener' + (rel ? ' ' + rel : '') }, label));
        }).filter(Boolean).toArray();
        if (sourceRows.length) {
          sourcesSection = h('section', { className: 'post-endcap post-sources' },
            h('h2', { id: 'sources-heading' }, 'Sources'), h('ul', {}, sourceRows));
        }
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
            faqSection,
            sourcesSection
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
  // 6a. TopperCombobox custom widget.
  //     Loaded from /admin/toppers.json (generated by the eleventy.after
  //     hook in .eleventy.js). Lets authors pick an existing topper from
  //     autocomplete OR type a new one. The saved YAML is identical to a
  //     plain `string` widget — Decap stores whatever string `onChange`
  //     emits — so there is no frontmatter migration.
  //
  //     Decap passes these props to control components: value, field,
  //     forID, classNameWrapper, onChange. React onChange is the contract
  //     (NOT onInput). Dropdown items use onMouseDown so the pick fires
  //     before the input's onBlur closes the dropdown.
  // -------------------------------------------------------------------
  var toppersCache = null;
  function loadToppers() {
    if (toppersCache) return toppersCache;
    toppersCache = fetch('/admin/toppers.json')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { return Array.isArray(data) ? data : []; })
      .catch(function () { return []; });
    return toppersCache;
  }

  var TopperCombobox = createClass({
    getInitialState: function () {
      return { options: [], open: false, query: this.props.value || '' };
    },
    componentDidMount: function () {
      var self = this;
      loadToppers().then(function (opts) {
        if (self.mountedFlag !== false) self.setState({ options: opts });
      });
      self.mountedFlag = true;
    },
    componentWillUnmount: function () { this.mountedFlag = false; },
    componentWillReceiveProps: function (next) {
      // Sync local query state when Decap rehydrates the field (e.g. after
      // loading an existing entry). Don't clobber an in-progress edit.
      if (next.value !== this.props.value && !this.state.open) {
        this.setState({ query: next.value || '' });
      }
    },
    handleChange: function (e) {
      var v = e.target.value;
      this.setState({ query: v, open: true });
      this.props.onChange(v);
    },
    handlePick: function (value) {
      this.setState({ query: value, open: false });
      this.props.onChange(value);
    },
    render: function () {
      var self = this;
      var q = (self.state.query || '').toLowerCase();
      var filtered = self.state.options.filter(function (o) {
        return !q || o.toLowerCase().indexOf(q) >= 0;
      });
      var listStyle = {
        position: 'absolute', zIndex: 1000, top: '100%', left: 0, right: 0,
        background: '#fff', border: '1px solid #cbd0d6', borderRadius: '4px',
        marginTop: '2px', maxHeight: '200px', overflowY: 'auto',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)', listStyle: 'none', padding: '4px 0'
      };
      var itemStyle = { padding: '6px 12px', cursor: 'pointer', fontSize: '14px' };
      return h('div', { className: self.props.classNameWrapper, style: { position: 'relative' } },
        h('input', {
          id: self.props.forID,
          type: 'text',
          value: self.state.query,
          onChange: self.handleChange,
          onFocus: function () { self.setState({ open: true }); },
          onBlur: function () { setTimeout(function () { self.setState({ open: false }); }, 150); },
        }),
        self.state.open && filtered.length > 0 && h('ul', { style: listStyle },
          filtered.map(function (o, i) {
            return h('li', {
              key: i,
              style: itemStyle,
              onMouseDown: function () { self.handlePick(o); }
            }, o);
          })
        )
      );
    },
  });

  CMS.registerWidget('topper', TopperCombobox);

  // -------------------------------------------------------------------
  // 6b. TagMultiSelect custom widget.
  //     Loaded from /admin/tags.json. Renders selected tags as removable
  //     chips with a typeahead below. Pressing Enter on a non-matching
  //     value adds it as a new tag. The four category tags (strategy /
  //     seo / design / performance) get a small badge — they drive the
  //     per-category collections in .eleventy.js.
  //
  //     Value normalization is defensive: Decap delivers tags as a plain
  //     JS array, an Immutable List, or (in edge cases) a single string.
  //     Always emit a plain JS array via onChange — Decap accepts that
  //     and rewraps internally.
  // -------------------------------------------------------------------
  var CATEGORY_TAGS = { strategy: 1, seo: 1, design: 1, performance: 1 };

  function normalizeTagValue(v) {
    if (!v) return [];
    if (typeof v === 'string') return [v];
    if (Array.isArray(v)) return v.slice();
    if (typeof v.toJS === 'function') return v.toJS();
    if (typeof v.toArray === 'function') return v.toArray();
    return [];
  }

  var tagsCache = null;
  function loadTags() {
    if (tagsCache) return tagsCache;
    tagsCache = fetch('/admin/tags.json')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { return Array.isArray(data) ? data : []; })
      .catch(function () { return []; });
    return tagsCache;
  }

  var TagMultiSelect = createClass({
    getInitialState: function () {
      return { options: [], query: '', open: false };
    },
    componentDidMount: function () {
      var self = this;
      loadTags().then(function (opts) {
        if (self.mountedFlag !== false) self.setState({ options: opts });
      });
      self.mountedFlag = true;
    },
    componentWillUnmount: function () { this.mountedFlag = false; },
    currentTags: function () { return normalizeTagValue(this.props.value); },
    emit: function (next) { this.props.onChange(next.slice()); },
    addTag: function (tag) {
      var clean = String(tag || '').trim().toLowerCase();
      if (!clean) return;
      var cur = this.currentTags();
      if (cur.indexOf(clean) >= 0) { this.setState({ query: '' }); return; }
      var isNew = this.state.options.indexOf(clean) < 0;
      var newTags = Object.assign({}, this.state.newTags || {});
      if (isNew) newTags[clean] = true;
      cur.push(clean);
      this.emit(cur);
      this.setState({ query: '', newTags: newTags });
    },
    removeTag: function (tag) {
      var newTags = Object.assign({}, this.state.newTags || {});
      delete newTags[tag];
      this.emit(this.currentTags().filter(function (t) { return t !== tag; }));
      this.setState({ newTags: newTags });
    },
    handleKeyDown: function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.addTag(this.state.query);
      } else if (e.key === 'Backspace' && !this.state.query) {
        var cur = this.currentTags();
        if (cur.length > 0) this.emit(cur.slice(0, -1));
      }
    },
    render: function () {
      var self = this;
      var selected = self.currentTags();
      var q = (self.state.query || '').toLowerCase();
      var filtered = self.state.options.filter(function (o) {
        return selected.indexOf(o) < 0 && (!q || o.toLowerCase().indexOf(q) >= 0);
      });
      var chipsRow = {
        display: 'flex', flexWrap: 'wrap', gap: '6px',
        padding: '6px', border: '1px solid #cbd0d6', borderRadius: '4px',
        background: '#fff', minHeight: '36px', alignItems: 'center'
      };
      var chipBase = {
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        background: '#eef1f5', borderRadius: '12px',
        padding: '2px 8px', fontSize: '13px'
      };
      var catChip = Object.assign({}, chipBase, { background: '#e7f0ff', color: '#1a4d8f' });
      var badge = { fontSize: '10px', padding: '0 4px', borderRadius: '6px', background: '#1a4d8f', color: '#fff', marginLeft: '2px' };
      var newBadge = { fontSize: '10px', padding: '0 4px', borderRadius: '6px', background: '#2f7d46', color: '#fff', marginLeft: '2px' };
      var removeBtn = { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', lineHeight: '1', padding: '0 2px' };
      var inputStyle = { flex: '1', minWidth: '120px', border: 'none', outline: 'none', fontSize: '14px', background: 'transparent' };
      var listStyle = {
        position: 'absolute', zIndex: 1000, top: '100%', left: 0, right: 0,
        background: '#fff', border: '1px solid #cbd0d6', borderRadius: '4px',
        marginTop: '2px', maxHeight: '200px', overflowY: 'auto',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)', listStyle: 'none', padding: '4px 0'
      };
      var itemStyle = { padding: '6px 12px', cursor: 'pointer', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };

      return h('div', { className: self.props.classNameWrapper, style: { position: 'relative' } },
        h('div', { style: chipsRow },
          selected.map(function (t, i) {
            var isCat = CATEGORY_TAGS[t];
            var isNew = self.state.newTags && self.state.newTags[t];
            return h('span', { key: t + i, style: isCat ? catChip : chipBase },
              t,
              isCat ? h('span', { style: badge }, 'category') : null,
              isNew ? h('span', { style: newBadge }, 'new') : null,
              h('button', {
                type: 'button',
                style: removeBtn,
                onClick: function () { self.removeTag(t); },
                'aria-label': 'Remove ' + t
              }, '×')
            );
          }),
          h('input', {
            id: self.props.forID,
            type: 'text',
            value: self.state.query,
            placeholder: selected.length === 0 ? 'Type a tag and press Enter' : 'Add another…',
            onChange: function (e) { self.setState({ query: e.target.value, open: true }); },
            onFocus: function () { self.setState({ open: true }); },
            onBlur: function () { setTimeout(function () { self.setState({ open: false }); }, 150); },
            onKeyDown: self.handleKeyDown,
            style: inputStyle
          })
        ),
        self.state.open && filtered.length > 0 && h('ul', { style: listStyle },
          filtered.map(function (o, i) {
            return h('li', {
              key: i,
              style: itemStyle,
              onMouseDown: function () { self.addTag(o); }
            },
              h('span', null, o),
              CATEGORY_TAGS[o] ? h('span', { style: badge }, 'category') : null
            );
          })
        )
      );
    },
  });

  CMS.registerWidget('tagPicker', TagMultiSelect);

  // -------------------------------------------------------------------
  // 6c. prePublish gate: hero image alt text is mandatory when image is set.
  //
  // `prePublish` (not `preSave`) so save-as-draft is never blocked — the
  // gate only fires on the final publish action. Authors keep their
  // mid-edit safety net.
  //
  // Throwing from the handler surfaces the message in a Decap toast at
  // the top of the editor and stops the publish.
  // -------------------------------------------------------------------
  CMS.registerEventListener({
    name: 'prePublish',
    handler: function (args) {
      if (!args || !args.entry) return;
      if (args.entry.get('collection') !== 'blog') return;
      var data = args.entry.get('data');
      if (!data) return;
      var image = data.get('image');
      var alt = data.get('imageAlt');
      if (image && (!alt || !String(alt).trim())) {
        throw new Error(
          'Hero Image is set but Hero Image Description (alt text) is empty. ' +
          'Please add alt text describing what is in the image — this is required ' +
          'for screen-reader users and for Google.'
        );
      }
    }
  });

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
      var t = (el.getAttribute('type') || '').toLowerCase();
      var isTextish = !(t === 'datetime-local' || t === 'date' || t === 'time' || t === 'file' || t === 'checkbox' || t === 'radio');

      // Spell-check: enable on every text input + textarea. Decap defaults
      // it off on some widgets. Idempotent because setAttribute is a no-op
      // when the value already matches.
      if (isTextish && el.getAttribute('spellcheck') !== 'true') {
        el.setAttribute('spellcheck', 'true');
      }

      if (el.dataset.placeholderApplied) continue;
      // Skip Slate markdown editor, file/image widgets, date pickers
      if (el.closest && el.closest('[data-slate-editor], [data-slate-node], .nc-fileControl-imageUpload, .nc-fileControl-fileUpload')) continue;
      if (!isTextish) continue;
      var name = fieldNameFor(el);
      if (!name) continue;
      var ph = PLACEHOLDERS[name];
      if (!ph) continue;
      el.placeholder = ph;
      el.dataset.placeholderApplied = '1';
    }

    // The body markdown widget is a contenteditable Slate editor, not an
    // <input>/<textarea>. Set spellcheck on the Slate root so the browser
    // red-underlines misspellings in the article body too.
    var slateRoots = root.querySelectorAll('[data-slate-editor]');
    for (var j = 0; j < slateRoots.length; j++) {
      if (slateRoots[j].getAttribute('spellcheck') !== 'true') {
        slateRoots[j].setAttribute('spellcheck', 'true');
      }
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

  // -------------------------------------------------------------------
  // 8. Draft media thumbnail fallback.
  //
  // With editorial_workflow, newly uploaded media lives on the unpublished
  // entry branch until publish. The saved field value is still the final
  // public URL, e.g. /assets/images/uploads/joseph-face.png, so Decap's
  // image control can show a broken thumbnail when the production site does
  // not have that file yet. If the current editor is on a blog draft, retry
  // failed upload thumbnails against the matching GitHub draft branch.
  // -------------------------------------------------------------------
  var REPO_FULL_NAME = 'josephdc18/ui-compass-web-designs';
  var PUBLIC_UPLOAD_PREFIX = '/assets/images/uploads/';
  var SOURCE_UPLOAD_PREFIX = 'src/assets/images/uploads/';

  function encodePathPart(value) {
    return String(value).split('/').map(encodeURIComponent).join('/');
  }

  function currentBlogSlug() {
    var hash = decodeURIComponent(window.location.hash || '');
    var patterns = [
      /\/collections\/blog\/entries\/([^/?#]+)/,
      /\/workflow\/(?:[^/]+\/)?blog\/([^/?#]+)/,
      /\/workflow\/entry\/blog\/([^/?#]+)/
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match = hash.match(patterns[i]);
      if (match && match[1]) return match[1];
    }

    var inputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea');
    for (var j = 0; j < inputs.length; j++) {
      if (fieldNameFor(inputs[j]) === 'pageName' && inputs[j].value) {
        return inputs[j].value;
      }
    }

    return null;
  }

  function uploadPathFromSrc(src) {
    if (!src) return null;
    var url;
    try {
      url = new URL(src, window.location.origin);
    } catch (e) {
      return null;
    }

    if (url.origin !== window.location.origin) return null;
    if (url.pathname.indexOf(PUBLIC_UPLOAD_PREFIX) !== 0) return null;
    return decodeURIComponent(url.pathname.slice(PUBLIC_UPLOAD_PREFIX.length));
  }

  function draftUploadUrl(src) {
    var filename = uploadPathFromSrc(src);
    var slug = currentBlogSlug();
    if (!filename || !slug) return null;

    return [
      'https://raw.githubusercontent.com',
      REPO_FULL_NAME,
      'cms/blog/' + encodePathPart(slug),
      SOURCE_UPLOAD_PREFIX + encodePathPart(filename)
    ].join('/');
  }

  function useDraftUploadFallback(img) {
    if (!img || img.tagName !== 'IMG') return;
    if (img.dataset.draftUploadFallbackTried) return;

    var fallback = draftUploadUrl(img.getAttribute('src') || img.currentSrc || img.src);
    if (!fallback) return;

    img.dataset.draftUploadFallbackTried = '1';
    img.src = fallback;
  }

  function scanBrokenUploadImages(root) {
    var images = root.querySelectorAll ? root.querySelectorAll('img') : [];
    for (var i = 0; i < images.length; i++) {
      if (images[i].complete && images[i].naturalWidth === 0) {
        useDraftUploadFallback(images[i]);
      }
    }
  }

  function initDraftMediaFallback() {
    document.addEventListener('error', function (event) {
      useDraftUploadFallback(event.target);
    }, true);

    var observer = new MutationObserver(function () {
      scanBrokenUploadImages(document);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    scanBrokenUploadImages(document);
  }

  // -------------------------------------------------------------------
  // 9. Slug auto-fill: type a title, get a clean Page Address for free.
  //
  // Behavior:
  //   - On Title input, write slugify(title) into Page Address, but only
  //     while Page Address is still in its auto-written state.
  //   - Once the author types into Page Address themselves (value diverges
  //     from the last auto-written slug), stop overwriting — they've taken
  //     control of the field.
  //   - When editing an already-published post, lock Page Address read-only:
  //     changing the slug breaks every existing inbound link.
  //
  // Detection of "published vs new" uses the Decap URL hash:
  //   #/collections/blog/entries/<slug>  → published, lock the slug field
  //   #/collections/blog/new/blog        → new entry, leave editable
  //   #/workflow/…                       → draft branch entry, leave editable
  // -------------------------------------------------------------------
  function slugify(value) {
    if (!value) return '';
    return String(value)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function isPublishedEntry() {
    var hash = decodeURIComponent(window.location.hash || '');
    return /\/collections\/blog\/entries\//.test(hash);
  }

  function reactSetValue(el, value) {
    // Decap uses controlled React inputs. A bare el.value = ... won't
    // trigger React's onChange. Set via the prototype descriptor + dispatch
    // a synthetic input event so React picks up the change.
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (setter && setter.set) setter.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function ensureSlugLockWarning(pageEl) {
    if (!pageEl || pageEl.dataset.slugLockWarningApplied) return;
    var note = document.createElement('div');
    note.className = 'cms-slug-lock-warning';
    note.textContent = 'Locked after publish — changing this breaks existing links.';
    note.style.marginTop = '4px';
    note.style.fontSize = '0.75rem';
    note.style.lineHeight = '1.35';
    note.style.color = '#8a4b00';
    note.style.fontWeight = '600';
    note.setAttribute('role', 'note');
    if (pageEl.parentNode) pageEl.parentNode.insertBefore(note, pageEl.nextSibling);
    pageEl.dataset.slugLockWarningApplied = '1';
  }

  function applySlugAutofill(root) {
    var titleEl = null;
    var pageEl = null;
    var inputs = root.querySelectorAll('input[type="text"], input:not([type])');
    for (var i = 0; i < inputs.length; i++) {
      var name = fieldNameFor(inputs[i]);
      if (name === 'blogTitle' && !titleEl) titleEl = inputs[i];
      if (name === 'pageName' && !pageEl) pageEl = inputs[i];
      if (titleEl && pageEl) break;
    }
    if (!pageEl) return;

    // Published-entry lock — runs whether or not we found the title input.
    if (isPublishedEntry() && !pageEl.dataset.publishLockApplied) {
      pageEl.readOnly = true;
      pageEl.dataset.publishLockApplied = '1';
      pageEl.title = 'Locked after publish — changing the page address breaks existing links to this post.';
      pageEl.style.opacity = '0.6';
      pageEl.style.cursor = 'not-allowed';
    }
    if (isPublishedEntry()) ensureSlugLockWarning(pageEl);

    if (!titleEl || titleEl.dataset.slugAutofillApplied) return;
    titleEl.dataset.slugAutofillApplied = '1';

    // If pageEl already has a value at the moment we enhance, assume it was
    // manually entered (or loaded from an existing entry) — never overwrite.
    if (pageEl.value && pageEl.value !== pageEl.dataset.autoSlug) {
      pageEl.dataset.autoSlugLocked = '1';
    }

    titleEl.addEventListener('input', function () {
      if (pageEl.dataset.autoSlugLocked) return;
      if (pageEl.readOnly) return;
      var next = slugify(titleEl.value);
      if (next === pageEl.value) return;
      pageEl.dataset.autoSlug = next;
      reactSetValue(pageEl, next);
    });

    pageEl.addEventListener('input', function () {
      // The author typed into Page Address. If their value diverges from
      // the last auto-written slug, lock — they've taken over the field.
      if (pageEl.value !== (pageEl.dataset.autoSlug || '')) {
        pageEl.dataset.autoSlugLocked = '1';
      }
    });
  }

  function initSlugAutofill() {
    var observer = new MutationObserver(function () {
      var root = document.querySelector('[id^="nc-root"]') || document.body;
      if (!root) return;
      try { applySlugAutofill(root); } catch (e) { /* swallow */ }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    try { applySlugAutofill(document.querySelector('[id^="nc-root"]') || document.body); } catch (e) { /* swallow */ }
  }

  // -------------------------------------------------------------------
  // 10. Live character counters under SEO-sensitive fields.
  //
  // Google truncates titles around 60 chars and meta descriptions around
  // 155. Authors don't see this until the post is already shipped. A small
  // "42 / 60" hint under each input keeps lengths in the goldilocks zone.
  //
  // Counters are cosmetic — they never block save. Color escalates from
  // muted gray → amber at 80% of limit → red over limit. The over-limit
  // state has aria-live="polite" so screen readers announce when the
  // author crosses the threshold.
  // -------------------------------------------------------------------
  var CHAR_LIMITS = {
    blogTitle: 60,
    titleTag: 60,
    blogDescription: 155
  };

  function ensureCharCounterStyles() {
    if (document.getElementById('cms-char-counter-styles')) return;
    var s = document.createElement('style');
    s.id = 'cms-char-counter-styles';
    s.textContent = [
      '.cms-char-counter {',
      '  display: block; margin-top: 4px; font-size: 0.75rem;',
      '  font-variant-numeric: tabular-nums; color: #7a7889;',
      '  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;',
      '}',
      '.cms-char-counter[data-state="warn"] { color: #b87333; }',
      '.cms-char-counter[data-state="over"] { color: #c0392b; font-weight: 600; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  // -------------------------------------------------------------------
  // 11. Editor-side CSS: compact expanded list items (FAQ, TLDR, etc.).
  //
  // Decap renders list-widget items with generous padding and full-width
  // textareas — two expanded items push everything off-screen. The
  // selectors below target Decap's auto-generated emotion-css classes
  // (e.g. ListItem-*, ObjectControl-*). If Decap restructures these
  // class names in a future release, the CSS becomes a no-op rather than
  // a breakage. The version pin in index.html mitigates surprise drift.
  // -------------------------------------------------------------------
  function ensureCompactListStyles() {
    if (document.getElementById('cms-compact-list-styles')) return;
    var s = document.createElement('style');
    s.id = 'cms-compact-list-styles';
    s.textContent = [
      '[class*="ListItem"] [class*="ObjectControl"] { padding: 0.5rem 0.75rem !important; }',
      '[class*="ListItem"] textarea { min-height: 60px !important; }',
      '[class*="ListItem"] [class*="TopBar"] { padding: 0.25rem 0.5rem !important; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  function updateCounter(counterEl, len, limit) {
    counterEl.textContent = len + ' / ' + limit;
    var state = 'ok';
    if (len > limit) state = 'over';
    else if (len >= Math.floor(limit * 0.8)) state = 'warn';
    if (counterEl.dataset.state !== state) counterEl.dataset.state = state;
  }

  function applyCharCounters(root) {
    var inputs = root.querySelectorAll('input[type="text"], input:not([type]), textarea');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (el.dataset.charCounterApplied) continue;
      var name = fieldNameFor(el);
      if (!name || !CHAR_LIMITS.hasOwnProperty(name)) continue;
      var limit = CHAR_LIMITS[name];
      ensureCharCounterStyles();
      var counter = document.createElement('span');
      counter.className = 'cms-char-counter';
      counter.setAttribute('aria-live', 'polite');
      // Insert immediately after the field so the counter visually anchors
      // to its input (Decap wraps fields in flex containers; appending to
      // parent is reliable across widget types).
      if (el.parentNode) el.parentNode.insertBefore(counter, el.nextSibling);
      el.dataset.charCounterApplied = '1';
      updateCounter(counter, (el.value || '').length, limit);
      (function (input, c, lim) {
        input.addEventListener('input', function () {
          updateCounter(c, (input.value || '').length, lim);
        });
      })(el, counter, limit);
    }
  }

  function initCharCounters() {
    var observer = new MutationObserver(function () {
      var root = document.querySelector('[id^="nc-root"]') || document.body;
      if (!root) return;
      try { applyCharCounters(root); } catch (e) { /* swallow */ }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    try { applyCharCounters(document.querySelector('[id^="nc-root"]') || document.body); } catch (e) { /* swallow */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initPlaceholders();
      initDraftMediaFallback();
      initSlugAutofill();
      initCharCounters();
      ensureCompactListStyles();
    });
  } else {
    initPlaceholders();
    initDraftMediaFallback();
    initSlugAutofill();
    initCharCounters();
    ensureCompactListStyles();
  }

  // -------------------------------------------------------------------
  // Final step — initialize Decap *after* every custom widget above is
  // registered. Paired with `window.CMS_MANUAL_INIT = true` in
  // src/admin/index.html. Without manual init Decap auto-boots on
  // bundle eval, which sometimes wins the race against this script and
  // surfaces "No control for widget 'topper' / 'tagPicker'" in the
  // editor pane.
  // -------------------------------------------------------------------
  if (typeof CMS.init === 'function') {
    CMS.init();
  }
})();
