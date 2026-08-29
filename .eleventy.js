// imports for the various eleventy plugins (navigation & image)
const eleventyNavigationPlugin = require('@11ty/eleventy-navigation');
const { DateTime } = require('luxon');
const Image = require('@11ty/eleventy-img');
const MarkdownIt = require('markdown-it');
const path = require('path');

const fs = require('fs');

function resolveSrc(src) {
  return typeof src === 'string' && src.startsWith('/') && !src.startsWith('//')
    ? `./src${src}`
    : src;
}

function headingSlug(value) {
  return String(value || '')
    .toLocaleLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function bodyMarkdownLibrary() {
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false });
  md.core.ruler.after('inline', 'stable-heading-ids', (state) => {
    const used = new Set();

    // Raw HTML headings keep their author-provided IDs. Reserve those IDs so
    // a later Markdown heading cannot accidentally receive the same fragment.
    state.tokens.forEach((token) => {
      if (token.type !== 'html_block' && token.type !== 'html_inline') return;
      const re = /<h[1-6]\b[^>]*\bid\s*=\s*(["'])(.*?)\1/gi;
      let match;
      while ((match = re.exec(token.content))) used.add(match[2]);
    });

    state.tokens.forEach((token, index) => {
      if (token.type !== 'heading_open') return;
      const explicit = token.attrGet('id');
      if (explicit) {
        used.add(explicit);
        return;
      }
      const inline = state.tokens[index + 1];
      const base = headingSlug(inline && inline.type === 'inline' ? inline.content : 'section');
      let slug = base;
      let suffix = 2;
      while (used.has(slug)) slug = `${base}-${suffix++}`;
      used.add(slug);
      token.attrSet('id', slug);
    });
  });
  return md;
}

// eleventy-img output cache. CF Pages wipes ./public between deploys but
// preserves node_modules/.cache when the project's "Build cache" toggle is on,
// so stashing processed images here lets eleventy-img's exists-check skip
// regenerating anything that hasn't changed.
const IMAGE_OUTPUT_DIR = './public/images';
const IMAGE_CACHE_DIR = './node_modules/.cache/eleventy-img-output';

function syncDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of fs.readdirSync(srcDir)) {
    const from = path.join(srcDir, f);
    const to = path.join(destDir, f);
    if (fs.existsSync(to)) continue;
    fs.copyFileSync(from, to);
  }
}

// Prime ./public/images from the cache before any build runs. eleventy-img
// then sees the files already exist and short-circuits processing.
syncDir(IMAGE_CACHE_DIR, IMAGE_OUTPUT_DIR);

// Inline markdown renderer — used for short strings in YAML frontmatter
// (e.g. TLDR points) where we want **bold** / *italic* / `code` to render
// as HTML without wrapping in a <p>.
const mdInline = new MarkdownIt({ html: true, linkify: false, typographer: false });

// i18n configuration
const i18nConfig = require('./src/_data/i18n.js');

// Load locale files
const locales = {};
const localesDir = './src/_data/locales';
if (fs.existsSync(localesDir)) {
    fs.readdirSync(localesDir).forEach((file) => {
        if (file.endsWith('.json')) {
            const locale = file.replace('.json', '');
            locales[locale] = require(`${localesDir}/${file}`);
        }
    });
}

// One options object for every eleventy-img call, so the preload shortcode
// below resolves the exact same derivative URLs the <picture> will reference.
// Two different option sets would produce two different hashes and the preload
// would fetch a second copy of the image instead of priming the one in use.
const IMAGE_OPTIONS = {
  widths: [400, 850, 1920],
  formats: ['webp', 'jpeg'],
  urlPath: '/images/',
  outputDir: IMAGE_OUTPUT_DIR,
  useCache: true,
  cacheOptions: {
    duration: '*',
    directory: './node_modules/.cache/eleventy-img-fetch',
  },
  filenameFormat: function (id, src, width, format) {
    const extension = path.extname(src);
    const name = path.basename(src, extension);
    return `${name}-${width}w-${id}.${format}`;
  },
};

function escapeAttr(value) {
  return String(value == null ? '' : value).replace(/"/g, '&quot;');
}

// allows the use of {% image... %} to create responsive, optimised images
// CHANGE DEFAULT MEDIA QUERIES AND WIDTHS
async function imageShortcode(src, alt, className, loading, sizes = '(max-width: 600px) 400px, 850px') {
  // don't pass an alt? chuck it out. passing an empty string is okay though
  if (alt === undefined) {
    throw new Error(`Missing \`alt\` on responsiveimage from: ${src}`);
  }

  // Resolve site-absolute paths (e.g. "/assets/images/foo.png" from frontmatter)
  // to the source file under ./src so eleventy-img can read them.
  async function renderOne(srcPath, extraClass) {
    const metadata = await Image(resolveSrc(srcPath), IMAGE_OPTIONS);
    const lowsrc = metadata.jpeg[0];
    const highsrc = metadata.jpeg[metadata.jpeg.length - 1];
    const cls = [className, extraClass].filter(Boolean).join(' ');
    return `<picture class="${cls}">
    ${Object.values(metadata)
      .map((imageFormat) => {
        return `  <source type="${imageFormat[0].sourceType}" srcset="${imageFormat
          .map((entry) => entry.srcset)
          .join(', ')}" sizes="${sizes}">`;
      })
      .join('\n')}
      <img
        src="${lowsrc.url}"
        width="${highsrc.width}"
        height="${highsrc.height}"
        alt="${alt}"
        loading="${loading}"
        decoding="async">
    </picture>`;
  }

  // Skip gracefully when the card hasn't been rendered yet (lets new posts ship
  // without crashing the whole build before card screenshots run).
  if (typeof src === 'string' && !fs.existsSync(resolveSrc(src))) {
    console.warn(`[image] source missing, skipping: ${src}`);
    return '';
  }

  // If a dark sibling exists at <slug>-dark-card.<ext>, render both pictures
  // and let CSS toggle them via body.dark-mode. Otherwise render single image.
  // Source filenames are <slug>-card.webp / <slug>-dark-card.webp.
  const darkSrc = typeof src === 'string'
    ? src.replace(/-card(\.[a-zA-Z0-9]+)$/, '-dark-card$1')
    : src;
  const hasDark = darkSrc !== src && fs.existsSync(resolveSrc(darkSrc));

  if (!hasDark) {
    return renderOne(src, null);
  }
  const [lightHtml, darkHtml] = await Promise.all([
    renderOne(src, 'theme-light'),
    renderOne(darkSrc, 'theme-dark'),
  ]);
  return lightHtml + '\n' + darkHtml;
}

// Preload the derivative the <picture> will actually use, never the source.
//
// `preloadImg` used to emit `href="{{ image }}"`, which pointed at the original
// in src/assets/images — a 2400x1260 card the page never displays, fetched at
// fetchpriority=high against the real LCP image. imagesrcset/imagesizes mirror
// the webp <source> exactly, so the browser primes that request rather than
// starting a second one. Only webp is preloaded: a preload can name one type,
// every target browser for these pages takes the webp branch, and anything that
// does not simply falls through to the jpeg <source> unprimed.
async function imagePreloadShortcode(src, sizes = '(max-width: 600px) 400px, 850px') {
  if (typeof src !== 'string' || !src || !fs.existsSync(resolveSrc(src))) return '';
  const metadata = await Image(resolveSrc(src), IMAGE_OPTIONS);
  const webp = metadata.webp;
  if (!webp || !webp.length) return '';
  const srcset = webp.map((entry) => entry.srcset).join(', ');
  return `<link rel="preload" as="image" type="image/webp" imagesrcset="${escapeAttr(srcset)}" imagesizes="${escapeAttr(sizes)}" fetchpriority="high" />`;
}

// Absolute URL of the largest jpeg derivative, for JSON-LD and og:image.
// Structured-data consumers want a plain, widely-decodable URL rather than the
// multi-megabyte source, and jpeg rather than webp for the widest reach.
async function imageMetaUrl(src) {
  if (typeof src !== 'string' || !src || !fs.existsSync(resolveSrc(src))) return '';
  const metadata = await Image(resolveSrc(src), IMAGE_OPTIONS);
  const jpeg = metadata.jpeg;
  if (!jpeg || !jpeg.length) return '';
  return jpeg[jpeg.length - 1].url;
}

// In prod, exclude blog posts whose frontmatter has `draft: true` from the
// build entirely. We do this by reading frontmatter at config-load time and
// calling `eleventyConfig.ignores.add()` below. Doing the exclusion in
// directory data via `permalink: false` would still render the layout chain
// with `page.url === false`, which crashes templates (header.html, etc.)
// that treat page.url as a string.
const IS_PROD = process.env.CF_PAGES === '1' || process.env.NODE_ENV === 'production';
function collectDraftBlogPaths() {
  if (!IS_PROD) return [];
  const drafts = [];
  for (const dir of ['./src/blog', './src/ko/blog']) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.md')) continue;
      const full = path.join(dir, name);
      const head = fs.readFileSync(full, 'utf8').split(/\n---\s*\n/, 1)[0];
      if (/^draft:\s*true\s*$/m.test(head)) drafts.push(full);
    }
  }
  return drafts;
}

module.exports = function (eleventyConfig) {
  // adds the navigation plugin for easy navs
  eleventyConfig.addPlugin(eleventyNavigationPlugin);
  eleventyConfig.setLibrary('md', bodyMarkdownLibrary());

  let eleventyOutputDir = './public';
  eleventyConfig.on('eleventy.directories', (dirs) => {
    if (dirs && dirs.output) eleventyOutputDir = dirs.output;
  });

  // Exclude draft blog posts from prod builds (no URL, no feed, no listing).
  for (const draftPath of collectDraftBlogPaths()) {
    eleventyConfig.ignores.add(draftPath);
  }

  // After each build, copy any newly-generated eleventy-img outputs back into
  // the cache dir so the next build can short-circuit re-encoding. CF Pages
  // wipes ./public between deploys but preserves node_modules/.cache when
  // "Build cache" is on, so this is what makes warm rebuilds fast.
  eleventyConfig.on('eleventy.after', () => {
    if (!fs.existsSync(IMAGE_OUTPUT_DIR)) return;
    fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
    for (const f of fs.readdirSync(IMAGE_OUTPUT_DIR)) {
      const from = path.join(IMAGE_OUTPUT_DIR, f);
      const to = path.join(IMAGE_CACHE_DIR, f);
      if (fs.existsSync(to)) continue;
      try { fs.copyFileSync(from, to); } catch {}
    }
  });

  // allows css, assets and config files to be passed into /public
  eleventyConfig.addPassthroughCopy('./src/css/**/*.css');
  eleventyConfig.addPassthroughCopy('./src/assets');
  eleventyConfig.addPassthroughCopy('./src/_redirects');
  eleventyConfig.addPassthroughCopy('./src/_headers');
  eleventyConfig.addPassthroughCopy('./src/admin');
  eleventyConfig.addPassthroughCopy({ './src/offline.html': 'offline.html' });

  eleventyConfig.on('eleventy.after', () => {
    // Persist any newly-generated image variants back to the cache so the next
    // CF Pages build can prime ./public/images from it.
    syncDir(IMAGE_OUTPUT_DIR, IMAGE_CACHE_DIR);
    fs.rmSync(path.join(eleventyOutputDir, 'assets/images/_sources.json'), { force: true });

    // Expose blog-frontmatter-derived option lists to the Decap CMS custom
    // widgets (topper combobox, tags multi-select). mkdirSync is required
    // because the output admin dir doesn't exist on a clean checkout before the
    // first build that triggers the passthrough-copy of src/admin/.
    const adminOutputDir = path.join(eleventyOutputDir, 'admin');
    fs.mkdirSync(adminOutputDir, { recursive: true });
    try {
      const toppers = require('./src/_data/blogToppers.js')();
      fs.writeFileSync(path.join(adminOutputDir, 'toppers.json'), JSON.stringify(toppers));
    } catch (e) {
      console.warn('[blogToppers] write failed:', e.message);
    }
    try {
      const tags = require('./src/_data/blogTags.js')();
      fs.writeFileSync(path.join(adminOutputDir, 'tags.json'), JSON.stringify(tags));
    } catch (e) {
      console.warn('[blogTags] write failed:', e.message);
    }
  });

  // open on npm start and watch CSS files for changes - doesn't trigger 11ty rebuild
  eleventyConfig.setBrowserSyncConfig({
    open: true,
    files: './public/css/**/*.css',
  });

  // allows the {% image %} shortcode to be used for optimised images (in webp if possible)
  eleventyConfig.addNunjucksAsyncShortcode('image', imageShortcode);
  eleventyConfig.addLiquidShortcode('image', imageShortcode);

  eleventyConfig.addNunjucksAsyncShortcode('imagePreload', imagePreloadShortcode);
  eleventyConfig.addLiquidShortcode('imagePreload', imagePreloadShortcode);
  eleventyConfig.addNunjucksAsyncFilter('imageMetaUrl', (src, cb) => {
    imageMetaUrl(src).then((url) => cb(null, url), (err) => cb(err));
  });
  eleventyConfig.addLiquidFilter('imageMetaUrl', imageMetaUrl);

  eleventyConfig.addFilter('assetExists', (src) =>
    typeof src === 'string' && fs.existsSync(resolveSrc(src)),
  );

  function categoryCollection(api, tag) {
    const counts = new Map();
    api.getFilteredByTag(tag).forEach((post) => {
      const label = String(post.data.category || '').trim();
      if (!label) return;
      const slug = headingSlug(label);
      const current = counts.get(slug) || { label, slug, count: 0 };
      current.count += 1;
      counts.set(slug, current);
    });
    return Array.from(counts.values()).sort((a, b) =>
      b.count - a.count || a.label.localeCompare(b.label),
    );
  }

  eleventyConfig.addCollection('blogCategories', (api) => categoryCollection(api, 'post'));
  eleventyConfig.addCollection('blogCategoriesKo', (api) => categoryCollection(api, 'post-ko'));
  eleventyConfig.addCollection('blogCategoriesEs', (api) => categoryCollection(api, 'post-es'));

  // date filter for blog posts
  eleventyConfig.addFilter('postDate', (dateObj) => {
    return DateTime.fromJSDate(dateObj).toLocaleString(DateTime.DATE_MED);
  });

  // ISO 8601 date for JSON-LD schema output
  eleventyConfig.addFilter('dateIso', (dateObj) => {
    if (!dateObj) return '';
    if (typeof dateObj === 'string') {
      const parsed = DateTime.fromISO(dateObj);
      return parsed.isValid ? parsed.toISO() : dateObj;
    }
    return DateTime.fromJSDate(dateObj).toISO();
  });

  // "July 2025" — for "Originally published in <Month Year>" lines on posts
  eleventyConfig.addFilter('monthYear', (dateObj) => {
    if (!dateObj) return '';
    if (typeof dateObj === 'string') {
      const parsed = DateTime.fromISO(dateObj);
      return parsed.isValid ? parsed.toFormat('LLLL yyyy') : dateObj;
    }
    return DateTime.fromJSDate(dateObj).toFormat('LLLL yyyy');
  });

  // Renders inline markdown (no surrounding <p>) so frontmatter strings can
  // use **bold**, *italic*, and `code`. Inline HTML in the source passes
  // through unchanged (e.g. <code>/ko/</code> in TLDR points). Used by the
  // blog post TLDR loop in blog-post.html.
  eleventyConfig.addFilter('mdInline', (str) => {
    if (str === undefined || str === null) return '';
    return mdInline.renderInline(String(str));
  });

  // Block-level markdown renderer, sibling to mdInline above. Reuses the
  // same MarkdownIt instance (html:true so legacy HTML-tagged FAQ answers
  // like `<p>…</p>` pass through unchanged) but calls .render() so block
  // elements (paragraphs, lists) are emitted. Powers the FAQ markdown
  // widget in the Decap CMS.
  eleventyConfig.addFilter('mdBlock', (str) => {
    if (str === undefined || str === null) return '';
    return mdInline.render(String(str));
  });

  eleventyConfig.addFilter('resolveRelatedPosts', (related, posts) => {
    if (!Array.isArray(related) || !Array.isArray(posts)) return [];
    const byPageName = new Map();
    for (const post of posts) {
      const pageName = post && post.data && post.data.pageName;
      if (pageName) byPageName.set(pageName, post);
    }
    return related.map((slug) => byPageName.get(slug)).filter(Boolean);
  });

  eleventyConfig.addFilter('validSources', (sources, inputPath) => {
    if (!Array.isArray(sources)) return [];
    const allowedRels = new Set(['nofollow', 'ugc', 'sponsored']);
    return sources.reduce((valid, source, index) => {
      const label = source && typeof source.label === 'string' ? source.label.trim() : '';
      const url = source && typeof source.url === 'string' ? source.url.trim() : '';
      let isHttps = false;
      try { isHttps = new URL(url).protocol === 'https:'; } catch (e) {}
      if (!label || !url || !isHttps) {
        console.warn(`[sources] skipped invalid entry ${index + 1}${inputPath ? ` in ${inputPath}` : ''}`);
        return valid;
      }
      const rel = source.rel && allowedRels.has(source.rel) ? source.rel : '';
      valid.push({ label, url, rel });
      return valid;
    }, []);
  });

  // =========================================================================
  // Inline auto-linking transform for blog posts.
  // First occurrence of each keyword in the article body becomes an internal
  // link. Skips matches inside <a>, <code>, <pre>, headings, scripts, styles.
  // Maintain the dictionary in src/_data/autoLinks.js for easy edits without
  // touching the config.
  // =========================================================================
  let autoLinks = {};
  try {
    autoLinks = require('./src/_data/autoLinks.js');
  } catch (e) {
    autoLinks = {};
  }

  // The dictionary is keyed by locale. Legacy flat dictionaries (a bare map of
  // keyword -> URL) are read as the default locale's set so an older
  // autoLinks.js keeps working unchanged.
  function autoLinksFor(locale) {
    const isNested = Object.values(autoLinks).every(
      (v) => v && typeof v === 'object' && !Array.isArray(v),
    );
    if (!isNested) return locale === i18nConfig.defaultLocale ? autoLinks : {};
    return autoLinks[locale] || {};
  }

  function applyAutoLinks(html, locale) {
    const dictionary = autoLinksFor(locale);
    const keys = Object.keys(dictionary);
    if (!keys.length) return html;
    const used = new Set();
    const sorted = keys.slice().sort((a, b) => b.length - a.length); // longest first
    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Walk HTML by splitting on tags. State tracks whether we are inside a protected tag.
    const parts = html.split(/(<[^>]+>)/g);
    let depth = { a: 0, code: 0, pre: 0, h: 0, script: 0, style: 0 };

    function adjust(tag) {
      const m = tag.match(/^<\s*\/?\s*([a-z0-9]+)/i);
      if (!m) return;
      const name = m[1].toLowerCase();
      const closing = /^<\s*\//.test(tag);
      const selfClose = /\/\s*>$/.test(tag);
      const inc = closing ? -1 : 1;
      if (selfClose && !closing) return;
      if (name === 'a') depth.a += inc;
      else if (name === 'code') depth.code += inc;
      else if (name === 'pre') depth.pre += inc;
      else if (/^h[1-6]$/.test(name)) depth.h += inc;
      else if (name === 'script') depth.script += inc;
      else if (name === 'style') depth.style += inc;
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      if (part.charAt(0) === '<') {
        adjust(part);
        continue;
      }
      if (depth.a || depth.code || depth.pre || depth.h || depth.script || depth.style) continue;

      let chunk = part;
      for (const key of sorted) {
        if (used.has(key)) continue;
        const re = new RegExp('(?<![\\w-])(' + escapeRe(key) + ')(?![\\w-])', 'i');
        if (!re.test(chunk)) continue;
        const url = dictionary[key];
        chunk = chunk.replace(re, '<a href="' + url + '" class="auto-link">$1</a>');
        used.add(key);
      }
      parts[i] = chunk;
    }
    return parts.join('');
  }

  eleventyConfig.addTransform('autoLinkBlog', function (content, outputPath) {
    const op = outputPath || (this.page && this.page.outputPath) || this.outputPath;
    if (!op) return content;
    if (!/\.html$/.test(op)) return content;
    if (op.indexOf('/blog/') === -1) return content;
    if (/\/blog\/index\.html$/.test(op)) return content;
    // Dictionaries are per-locale: the keys are English words that also occur
    // verbatim in Spanish and Korean copy ("SEO", "hosting", "WordPress"), so
    // an unscoped pass would link translated articles out to English pages.
    const locale = op.match(
      new RegExp('(?:^|/)(' + i18nConfig.localeList.join('|') + ')/blog/'),
    );
    // Only rewrite within the article-content section so we never touch nav/footer.
    const re = /(<section id="blog-content"[^>]*>)([\s\S]*?)(<\/section>)/;
    const pageLocale = locale ? locale[1] : i18nConfig.defaultLocale;
    return content.replace(
      re,
      (m, open, body, close) => open + applyAutoLinks(body, pageLocale) + close,
    );
  });

  // date filter for sitemap and other templates
  eleventyConfig.addFilter('date', (dateObj, format) => {
    if (!dateObj) return '';
    const dt = DateTime.fromJSDate(dateObj);
    if (format === 'YYYY-MM-DD') {
      return dt.toISODate();
    }
    return dt.toFormat(format || 'yyyy-MM-dd');
  });

  // =========================================================================
  // i18n (Internationalization) Filters & Helpers
  // =========================================================================

  /** Translation lookup: {{ "nav.home" | t(locale) }} */
  eleventyConfig.addFilter('t', function (key, locale) {
    const pageLocale = locale || this.ctx?.locale || i18nConfig.defaultLocale;
    const translations = locales[pageLocale] || locales[i18nConfig.defaultLocale] || {};
    const keys = key.split('.');
    let value = translations;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
    return value !== undefined ? value : key;
  });

  /** Locale info: {{ locale | localeInfo }} */
  eleventyConfig.addFilter('localeInfo', (localeCode) => {
    return i18nConfig.getLocale(localeCode || i18nConfig.defaultLocale);
  });

  // Draft posts resolve permalink to `false`, which propagates to page.url.
  // The page still renders its layout chain (which calls this) before being
  // skipped at write time, so guard against non-string inputs.
  function localizedUrlFor(url, targetLocale) {
    if (typeof url !== 'string') return '';
    const defaultLocale = i18nConfig.defaultLocale;
    let cleanUrl = url;
    for (const loc of i18nConfig.localeList) {
      if (url.startsWith('/' + loc + '/')) {
        cleanUrl = url.replace('/' + loc + '/', '/');
        break;
      }
    }
    if (targetLocale === defaultLocale) return cleanUrl;
    return '/' + targetLocale + cleanUrl;
  }

  /** Localized URL: {{ page.url | localizedUrl("ko") }} */
  eleventyConfig.addFilter('localizedUrl', localizedUrlFor);

  /**
   * Every URL this build will write, as a Set. Keyed off the collections.all
   * array so the Set is built once per build rather than once per page — the
   * language switcher and hreflang block both consult it on every page.
   * Draft posts resolve `url` to false and are filtered out, which is what
   * makes them invisible to the switcher as well as to the listing.
   */
  const urlSetCache = new WeakMap();
  function urlSetFor(all) {
    if (!Array.isArray(all)) return null;
    let set = urlSetCache.get(all);
    if (!set) {
      set = new Set(
        all.map((item) => item && item.url).filter((u) => typeof u === 'string'),
      );
      urlSetCache.set(all, set);
    }
    return set;
  }

  /** Split '/pricing/#faq' into ['/pricing/', '#faq']. */
  function splitHash(url) {
    const i = url.indexOf('#');
    return i === -1 ? [url, ''] : [url.slice(0, i), url.slice(i)];
  }

  /**
   * Check a translation actually exists before linking to it:
   *   {% if page.url | hasTranslation('es', collections.all) %}
   * Without the collections argument there is nothing to check against, so it
   * answers true — callers that cannot reach collections keep the old
   * link-everything behaviour rather than silently dropping every alternate.
   */
  eleventyConfig.addFilter('hasTranslation', function (url, targetLocale, all) {
    if (typeof url !== 'string') return false;
    const set = urlSetFor(all);
    if (!set) return true;
    const [path] = splitHash(localizedUrlFor(url, targetLocale));
    return set.has(path);
  });

  /**
   * A nav href in the current locale, falling back to the English page when
   * this locale does not have its own:
   *   {{ '/ecommerce/' | localeHref(locale, collections.all) }}
   * Keeps locale-specific menus from linking to pages that were never built.
   */
  eleventyConfig.addFilter('localeHref', (url, localeCode, all) => {
    if (typeof url !== 'string') return url;
    if (!localeCode || localeCode === i18nConfig.defaultLocale) return url;
    const [path, hash] = splitHash(url);
    const candidate = '/' + localeCode + path;
    const set = urlSetFor(all);
    if (set && set.has(candidate)) return candidate + hash;
    return url;
  });

  /** Text direction: {{ locale | localeDir }} */
  eleventyConfig.addFilter('localeDir', (localeCode) => {
    const info = i18nConfig.getLocale(localeCode);
    return info?.dir || 'ltr';
  });

  /** Locale-aware date: {{ date | localizedDate(locale) }} */
  eleventyConfig.addFilter('localizedDate', (dateObj, localeCode) => {
    if (!dateObj) return '';
    const locale = localeCode || i18nConfig.defaultLocale;
    const luxonLocale = locale === 'en' ? 'en-US' : locale;
    return DateTime.fromJSDate(dateObj).setLocale(luxonLocale).toLocaleString(DateTime.DATE_FULL);
  });

  /** All available locales: {% for loc in "" | availableLocales %} */
  eleventyConfig.addFilter('availableLocales', () => {
    return i18nConfig.localeList.map((code) => ({
      code,
      ...i18nConfig.locales[code],
    }));
  });

  /** Extract locale from URL: {{ page.url | urlLocale }} */
  eleventyConfig.addFilter('urlLocale', (url) => {
    for (const locale of i18nConfig.localeList) {
      if (url.startsWith('/' + locale + '/')) return locale;
    }
    return i18nConfig.defaultLocale;
  });

  // Make i18n config available globally
  eleventyConfig.addGlobalData('i18nConfig', i18nConfig);
  eleventyConfig.addGlobalData('locales', locales);

  /**
   * Inline a CSS file's contents at build time so it can be dropped into a
   * <style> block in the template, removing one render-blocking round-trip.
   * Usage: <style>{{ "/css/root.css" | cssInline | safe }}</style>
   * Path is resolved against ./src so the leading slash maps to the site root.
   */
  const cssInlineCache = {};
  eleventyConfig.addFilter('cssInline', (cssPath) => {
    if (cssInlineCache[cssPath]) return cssInlineCache[cssPath];
    const rel = cssPath.replace(/^\//, '');
    const full = path.join(__dirname, 'src', rel);
    const content = fs.readFileSync(full, 'utf8');
    cssInlineCache[cssPath] = content;
    return content;
  });

  return {
    dir: {
      input: 'src',
      includes: '_includes',
      layouts: "_layouts",
      output: 'public',
    },
    // allows .html files to contain nunjucks templating language
    htmlTemplateEngine: 'njk',
  };
};
