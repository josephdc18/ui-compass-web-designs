// Directory data for Spanish-language blog posts.
// Mirrors src/blog/blog.json but routes posts to /es/blog/<pageName>/ so the
// language-switcher's path-rewrite localizedUrl filter maps EN <-> ES correctly.
// Post slugs MUST match their English counterparts for the switcher to work.
module.exports = {
  layout: 'blog-post.html',
  blog: true,
  locale: 'es',
  tags: 'post-es',
  eleventyComputed: {
    permalink: (data) => `/es/blog/${data.pageName}/index.html`,
  },
};
