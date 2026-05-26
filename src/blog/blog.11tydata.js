// Directory data for English-language blog posts.
// Mirrors src/ko/blog/blog.11tydata.js for the Korean set.
//
// Drafts (`draft: true` in frontmatter) render locally so authors can preview
// them, but are excluded from production builds — no rendered URL, no listing
// in collections/feed/RSS. Prod exclusion is enforced in .eleventy.js by
// adding draft files to `eleventyConfig.ignores` at build time, since
// returning `permalink: false` from computed data leaves `page.url === false`
// and crashes layouts that treat it as a string.
module.exports = {
  layout: 'blog-post.html',
  tags: 'post',
  eleventyComputed: {
    permalink: (data) => `/blog/${data.pageName}/index.html`,
  },
};
