// imports for the various eleventy plugins (navigation & image)
const eleventyNavigationPlugin = require('@11ty/eleventy-navigation');
const { DateTime } = require('luxon');
const Image = require('@11ty/eleventy-img');
const path = require('path');

const fs = require('fs');

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

  // create the metadata for an optimised image
  let metadata = await Image(`${src}`, {
    widths: [200, 400, 850, 1920, 2500],
    formats: ['webp', 'jpeg'],
    urlPath: '/images/',
    outputDir: './public/images',
    filenameFormat: function (id, src, width, format, options) {
      const extension = path.extname(src);
      const name = path.basename(src, extension);
      return `${name}-${width}w.${format}`;
    },
  });

  // get the smallest and biggest image for picture/image attributes
  let lowsrc = metadata.jpeg[0];
  let highsrc = metadata.jpeg[metadata.jpeg.length - 1];

  // when {% image ... %} is used, this is what's returned
  return `<picture class="${className}">
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

module.exports = function (eleventyConfig) {
  // adds the navigation plugin for easy navs
  eleventyConfig.addPlugin(eleventyNavigationPlugin);

  // allows css, assets and config files to be passed into /public
  eleventyConfig.addPassthroughCopy('./src/css/**/*.css');
  eleventyConfig.addPassthroughCopy('./src/assets');
  eleventyConfig.addPassthroughCopy('./src/_redirects');
  eleventyConfig.addPassthroughCopy('./src/_headers');
  eleventyConfig.addPassthroughCopy('./src/admin');
  eleventyConfig.addPassthroughCopy({ './src/offline.html': 'offline.html' });

  // open on npm start and watch CSS files for changes - doesn't trigger 11ty rebuild
  eleventyConfig.setBrowserSyncConfig({
    open: true,
    files: './public/css/**/*.css',
  });

  // allows the {% image %} shortcode to be used for optimised images (in webp if possible)
  eleventyConfig.addNunjucksAsyncShortcode('image', imageShortcode);

  // date filter for blog posts
  eleventyConfig.addFilter('postDate', (dateObj) => {
    return DateTime.fromJSDate(dateObj).toLocaleString(DateTime.DATE_MED);
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

  /** Localized URL: {{ page.url | localizedUrl("es") }} */
  eleventyConfig.addFilter('localizedUrl', function (url, targetLocale) {
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

  /** Check translation exists: {% if page.url | hasTranslation("es") %} */
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
