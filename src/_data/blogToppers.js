// Collects unique `topper` / `category` values from all blog post
// frontmatter at build time. Consumed two ways:
//
//   1. Templates (via Eleventy data cascade): `{{ blogToppers }}` returns
//      a sorted JS array of strings.
//   2. The Decap CMS topper combobox: `.eleventy.js` writes the same array
//      to public/admin/toppers.json from an eleventy.after hook so the
//      browser-side custom widget can fetch and offer them as autocomplete.
//
// `category` is matched alongside `topper` because src/_layouts/blog-post.html
// renders `category or topper` interchangeably — both keys feed the same UI
// slot, so the option list should include values from either key.

const fs = require('fs');
const path = require('path');

const BLOG_DIRS = ['./src/blog', './src/ko/blog'];

module.exports = function () {
  const seen = new Set();
  for (const dir of BLOG_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.md')) continue;
      const head = fs
        .readFileSync(path.join(dir, name), 'utf8')
        .split(/\n---\s*\n/, 1)[0];
      const matches = head.matchAll(/^(?:topper|category):\s*"?([^"\n]+)"?\s*$/gm);
      for (const m of matches) {
        const value = m[1].trim();
        if (value) seen.add(value);
      }
    }
  }
  return Array.from(seen).sort();
};
