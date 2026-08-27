// Byline avatars, keyed by the `author` string in a post's frontmatter.
//
// This is the fallback, not an override: a post's own `authorImage` (the
// optional "Author Avatar" field in Decap) still wins. It exists so a new post
// gets the right face by writing an author name — which every post already
// does — instead of by remembering to attach an image. Before this, exactly one
// of thirty-eight posts set `authorImage`, so the byline avatar was missing
// almost everywhere.
//
// An author who is not listed here gets NO avatar rather than someone else's.
// The map is resolved into a computed `avatar` value in src/blog/blog.11tydata.js
// and its Korean mirror; the layout reads that, never this file directly.
//
// UI Compass uses the square favicon mark, not /assets/logo.svg: the wordmark is
// 509x174, and `object-fit: cover` inside a 44px circle would crop it to the
// middle two letters.
module.exports = {
  avatars: {
    'Joseph C.': '/assets/images/uploads/joseph-face.png',
    'UI Compass': '/assets/favicons/favicon-192x192.png',
  },
};
