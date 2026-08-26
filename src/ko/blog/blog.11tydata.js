const fs = require('fs');

function computedReadMinutes(data) {
  const declared = Number(data.readMins);
  if (Number.isFinite(declared) && declared > 0) return Math.ceil(declared);
  const inputPath = data.page && data.page.inputPath;
  if (!inputPath || !fs.existsSync(inputPath)) return 1;
  const source = fs.readFileSync(inputPath, 'utf8').replace(/^---[\s\S]*?---\s*/, '');
  const words = source.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

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
    readMins: computedReadMinutes,
  },
};
