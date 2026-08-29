const fs = require('fs');
const authors = require('../../_data/authors.js');

// See src/blog/blog.11tydata.js for why this computes `avatar` rather than
// writing back into `authorImage`.
function computedAvatar(data) {
  return data.authorImage || authors.avatars[data.author] || null;
}

function computedReadMinutes(data) {
  const declared = Number(data.readMins);
  if (Number.isFinite(declared) && declared > 0) return Math.ceil(declared);
  const inputPath = data.page && data.page.inputPath;
  if (!inputPath || !fs.existsSync(inputPath)) return 1;
  const source = fs.readFileSync(inputPath, 'utf8').replace(/^---[\s\S]*?---\s*/, '');
  const words = source.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

// Directory data for Spanish-language blog posts.
// Mirrors src/blog/blog.11tydata.js but routes posts to /es/blog/<pageName>/ so
// the language-switcher's path-rewrite localizedUrl filter maps EN <-> ES
// correctly. Post slugs MUST match their English counterparts for the switcher
// to work — the slug stays English even though the article is in Spanish.
// Draft handling: see src/blog/blog.11tydata.js — drafts are excluded in prod
// via `eleventyConfig.ignores` in .eleventy.js, not here.
module.exports = {
  layout: 'blog-post.html',
  blog: true,
  locale: 'es',
  tags: 'post-es',
  eleventyComputed: {
    permalink: (data) => `/es/blog/${data.pageName}/index.html`,
    readMins: computedReadMinutes,
    avatar: computedAvatar,
  },
};
