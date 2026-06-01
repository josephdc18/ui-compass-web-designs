// Collects unique tag values from all blog post frontmatter at build time.
// Consumed by the Decap CMS tags multi-select widget (loaded from
// /admin/tags.json — written by the eleventy.after hook in .eleventy.js).
//
// Tags appear in YAML two ways:
//   tags: [post, strategy]
//   tags:
//     - post
//     - strategy
// Both forms are handled by the regex below.

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

      // Inline form: `tags: [post, strategy]`
      const inline = head.match(/^tags:\s*\[([^\]]*)\]\s*$/m);
      if (inline) {
        for (const raw of inline[1].split(',')) {
          const t = raw.trim().replace(/^["']|["']$/g, '');
          if (t) seen.add(t);
        }
        continue;
      }

      // Block form: `tags:` followed by `  - foo` lines
      const blockMatch = head.match(/^tags:\s*\n((?:\s+-\s+[^\n]+\n?)+)/m);
      if (blockMatch) {
        const lines = blockMatch[1].split('\n');
        for (const line of lines) {
          const m = line.match(/^\s+-\s+["']?([^"'\n]+?)["']?\s*$/);
          if (m && m[1]) seen.add(m[1].trim());
        }
      }
    }
  }
  return Array.from(seen).sort();
};
