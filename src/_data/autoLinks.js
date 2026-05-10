/**
 * Auto-linking dictionary for blog posts.
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
 */
module.exports = {
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
  'pricing': '/pricing/'
};
