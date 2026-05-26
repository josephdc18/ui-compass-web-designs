// Directory data for Korean-language blog posts.
// Mirrors src/blog/blog.json but routes posts to /ko/blog/<pageName>/ so the
// language-switcher's path-rewrite localizedUrl filter maps EN <-> KO correctly.
// Post slugs MUST match their English counterparts for the switcher to work.
// Draft handling: see src/blog/blog.11tydata.js — drafts are excluded in prod
// via `eleventyConfig.ignores` in .eleventy.js, not here.
module.exports = {
  layout: 'blog-post.html',
  blog: true,
  locale: 'ko',
  tags: 'post-ko',
  eleventyComputed: {
    permalink: (data) => `/ko/blog/${data.pageName}/index.html`,
  },
};
