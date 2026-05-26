// imports for the various eleventy plugins (navigation & image)
const eleventyNavigationPlugin = require('@11ty/eleventy-navigation');
const { DateTime } = require('luxon');
const Image = require('@11ty/eleventy-img');
const MarkdownIt = require('markdown-it');
const path = require('path');

const fs = require('fs');

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

// allows the use of {% image... %} to create responsive, optimised images
// CHANGE DEFAULT MEDIA QUERIES AND WIDTHS
async function imageShortcode(src, alt, className, loading, sizes = '(max-width: 600px) 400px, 850px') {
  // don't pass an alt? chuck it out. passing an empty string is okay though
  if (alt === undefined) {
    throw new Error(`Missing \`alt\` on responsiveimage from: ${src}`);
  }

  // Resolve site-absolute paths (e.g. "/assets/images/foo.png" from frontmatter)
  // to the source file under ./src so eleventy-img can read them.
  function resolveSrc(s) {
    return typeof s === 'string' && s.startsWith('/') && !s.startsWith('//')
      ? `./src${s}`
      : s;
  }

  async function renderOne(srcPath, extraClass) {
    const metadata = await Image(resolveSrc(srcPath), {
      widths: [200, 400, 850, 1920, 2500],
      formats: ['avif', 'webp', 'jpeg'],
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
    });
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

  // Skip gracefully when the source PNG hasn't been generated yet (lets new
  // posts ship without crashing the whole build before card screenshots run).
  if (typeof src === 'string' && !fs.existsSync(resolveSrc(src))) {
    console.warn(`[image] source missing, skipping: ${src}`);
    return '';
  }

  // If a dark sibling exists at <slug>-dark-card.<ext>, render both pictures
  // and let CSS toggle them via body.dark-mode. Otherwise render single image.
  // Source filenames are <slug>-card.png / <slug>-dark-card.png.
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

  // Exclude draft blog posts from prod builds (no URL, no feed, no listing).
  for (const draftPath of collectDraftBlogPaths()) {
    eleventyConfig.ignores.add(draftPath);
  }

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
    fs.rmSync('./public/assets/images/_sources.json', { force: true });
  });

  // open on npm start and watch CSS files for changes - doesn't trigger 11ty rebuild
  eleventyConfig.setBrowserSyncConfig({
    open: true,
    files: './public/css/**/*.css',
  });

  // allows the {% image %} shortcode to be used for optimised images (in webp if possible)
  eleventyConfig.addNunjucksAsyncShortcode('image', imageShortcode);
  eleventyConfig.addLiquidShortcode('image', imageShortcode);

  // Per-category blog collections — populated by adding the matching tag
  // (lowercased) to a post's `tags` array, alongside `post`/`featured`.
  ['strategy', 'seo', 'design', 'performance'].forEach((tag) => {
    eleventyConfig.addCollection(tag, (api) =>
      api.getFilteredByTag(tag).reverse(),
    );
  });

  // Blog index hero — picks posts with `hero: true` in frontmatter, sorted
  // newest first. The blog.html template uses `collections.hero | first` so
  // the hero is an explicit editorial choice, not a side effect of tagging.
  eleventyConfig.addCollection('hero', (api) =>
    api.getAll().filter((p) => p.data.hero).sort((a, b) => b.date - a.date),
  );

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

  function applyAutoLinks(html) {
    const keys = Object.keys(autoLinks);
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
        const url = autoLinks[key];
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
    // Only rewrite within the article-content section so we never touch nav/footer.
    const re = /(<section id="blog-content"[^>]*>)([\s\S]*?)(<\/section>)/;
    return content.replace(re, (m, open, body, close) => open + applyAutoLinks(body) + close);
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

  /** Localized URL: {{ page.url | localizedUrl("ko") }} */
  eleventyConfig.addFilter('localizedUrl', function (url, targetLocale) {
    // Draft posts resolve permalink to `false`, which propagates to page.url.
    // The page still renders its layout chain (which calls this filter) before
    // being skipped at write time, so guard against non-string inputs.
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
  });

  /** Check translation exists: {% if page.url | hasTranslation("ko") %} */
  eleventyConfig.addFilter('hasTranslation', function (url, targetLocale) {
    return true;
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
