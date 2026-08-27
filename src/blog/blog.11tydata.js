const fs = require('fs');
const authors = require('../_data/authors.js');

// Computed into `avatar`, not back into `authorImage`: a computed value that
// reads its own key is a circular dependency Eleventy refuses to resolve. The
// layout reads `avatar`, so the CMS's optional `authorImage` still overrides.
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
    readMins: computedReadMinutes,
    avatar: computedAvatar,
  },
};
