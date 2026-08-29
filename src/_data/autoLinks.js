/**
 * Auto-linking dictionary for blog posts, keyed by locale.
 *
 * The first occurrence of each key in a blog post body becomes an internal
 * link to the matching URL at build time (see autoLinkBlog transform in
 * .eleventy.js). Add new entries here to grow the internal-linking graph.
 *
 * Rules:
 *   - Keys are matched with word boundaries, case-insensitive.
 *   - Longer keys are tried first, so "PageSpeed Insights" wins over "PageSpeed".
 *   - Only the first match per page is linked, to avoid stuffing.
 *   - Skipped inside <a>, <code>, <pre>, headings, scripts, styles.
 *   - A post is only linked with its OWN locale's dictionary. Several keys
 *     ("SEO", "hosting", "WordPress", "PageSpeed") appear verbatim in Spanish
 *     and Korean copy, so a shared dictionary would link translated articles
 *     out to English service pages. A locale with no entry here simply gets no
 *     auto-linking.
 */
module.exports = {
  en: {
    'PageSpeed': '/web-development/',
    'PageSpeed Insights': '/web-development/',
    'hand-coded': '/web-development/',
    'page builder': '/web-development/',
    'WordPress': '/web-development/',
    'unlimited edits': '/unlimited-edits-and-support/',
    'hosting': '/hosting-and-domains/',
    'web design': '/web-design/',
    'web designer': '/web-design/',
    'SEO': '/search-engine-optimisation/',
    'pricing': '/pricing/',
  },

  es: {
    'PageSpeed': '/es/web-development/',
    'PageSpeed Insights': '/es/web-development/',
    'programado a mano': '/es/web-development/',
    'desarrollo web': '/es/web-development/',
    'WordPress': '/es/web-development/',
    'cambios ilimitados': '/es/unlimited-edits-and-support/',
    'hosting': '/es/hosting-and-domains/',
    'dominio': '/es/hosting-and-domains/',
    'diseño web': '/es/web-design/',
    'SEO': '/es/search-engine-optimisation/',
    'precios': '/es/pricing/',
  },

  // Korean posts get no auto-linking until a Korean dictionary exists — the
  // English keys would otherwise fire on the Latin-script terms that appear
  // inside Korean copy and link out of the /ko/ tree.
  ko: {},
};
