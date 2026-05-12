// Directory data for English-language blog posts.
// Mirrors src/ko/blog/blog.11tydata.js for the Korean set.
//
// Drafts (`draft: true` in frontmatter) render locally so authors can preview
// them, but are excluded from production builds — no rendered URL, no listing
// in collections/feed/RSS. The CMS's editorial workflow handles the
// save-but-don't-publish-yet case separately (drafts there live in a branch).
const IS_PROD = process.env.CF_PAGES === '1' || process.env.NODE_ENV === 'production';

module.exports = {
  layout: 'blog-post.html',
  tags: 'post',
  eleventyComputed: {
    eleventyExcludeFromCollections: (data) => Boolean(IS_PROD && data.draft),
    permalink: (data) => {
      if (IS_PROD && data.draft) return false;
      return `/blog/${data.pageName}/index.html`;
    },
  },
};
