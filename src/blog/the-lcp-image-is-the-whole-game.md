---
blogTitle: On most small business sites, the hero image is the whole score
pageName: the-lcp-image-is-the-whole-game
titleTag: Fixing the Hero Image That Wrecks Your Load Time
blogDescription: >-
  Largest Contentful Paint is usually one element — the photo at the top of your
  homepage. Six things to do to it, in the order that matters, plus the two
  well-meant optimisations that make it slower.
author: Joseph C.
date: 2026-05-28T17:44:00.000Z
topper: Performance
image: /assets/images/the-lcp-image-is-the-whole-game-card.webp
imageAlt: >-
  A waterfall chart with one very long image request highlighted against a row
  of short ones
draft: false
tags:
  - post
  - performance
  - images
  - core-web-vitals
  - lcp
  - optimization
  - speed
tldrTitle: Key Takeaways
tldr:
  - >-
    On a typical small business homepage the LCP element is the hero image, so
    fixing that one file fixes the metric.
  - >-
    Never lazy-load the hero. It is the one image on the page that must load
    immediately.
  - >-
    Serve the right dimensions per screen with srcset — a 3000px photo on a
    phone is wasted bytes at full price.
  - >-
    Always set width and height so the layout does not jump when the image
    arrives.
faq:
  - q: How do I find out what my LCP element actually is?
    a: >-
      Chrome DevTools shows it directly: open the Performance panel, record a
      page load, and the LCP marker in the timings track names the element.
      PageSpeed Insights also reports it under the LCP audit. Do this before
      optimising anything — on image-led sites it is nearly always the hero, but
      on text-led pages it is sometimes a heading or a large block of body copy,
      and the fix for those is completely different.
  - q: Should I lazy-load images or not?
    a: >-
      Lazy-load everything below the first screen; never lazy-load anything
      inside it. <code>loading="lazy"</code> on a hero image is one of the most
      common self-inflicted performance problems we find, because it tells the
      browser to deprioritise the exact element the metric is measuring. The
      rule is positional, not global.
  - q: WebP or AVIF?
    a: >-
      Serve both, with a JPEG fallback, using a <code>&lt;picture&gt;</code>
      element — the browser picks the first format it supports. AVIF generally
      compresses smaller than WebP at comparable quality, WebP encodes faster
      and has been supported for longer. You do not have to choose, and a build
      pipeline that generates all three from one source file means nobody has to
      think about it again.
  - q: My image is already compressed. Why is it still slow?
    a: >-
      Compression is only one of three levers, and usually not the biggest.
      The other two are <em>dimensions</em> — a 3000-pixel-wide photo scaled
      down by CSS to fill a 390-pixel phone screen downloads every one of those
      pixels — and <em>discovery time</em>, which is how long the browser takes
      to even find out the image exists. An image referenced from a CSS
      background, or injected by JavaScript, is discovered late no matter how
      small it is.
  - q: Does a CDN fix this?
    a: >-
      It helps with one part — the distance the bytes travel — and does nothing
      about the other parts. A 2 MB hero is a 2 MB hero from an edge node fifty
      miles away. Serve it from a CDN <em>and</em> fix the file, and note that
      where the origin sits still <a
      href="/blog/hosting-decides-your-performance-ceiling/">sets a ceiling on
      what any of this can achieve</a>.
  - q: What about the big background video some sites use?
    a: >-
      Treat it as an expense and decide whether it earns its cost. If you keep
      it, give the video a poster image that is itself optimised, so the visible
      first paint is a lightweight image rather than an empty box; do not
      autoplay it on mobile connections; and never let it be the thing standing
      between a visitor and <a
      href="/blog/the-twelve-word-headline-test/">your headline</a>.
sources:
  - label: web.dev — Largest Contentful Paint (LCP)
    url: https://web.dev/articles/lcp
  - label: web.dev — Optimize Largest Contentful Paint
    url: https://web.dev/articles/optimize-lcp
  - label: web.dev — Optimize resource loading with the Fetch Priority API
    url: https://web.dev/articles/fetch-priority
  - label: MDN — Responsive images
    url: >-
      https://developer.mozilla.org/en-US/docs/Web/HTML/Responsive_images
related:
  - a-performance-budget-is-a-json-file
  - the-1-second-tax
  - a-36kb-png-becomes-a-2kb-svg
readMins: 8
category: Performance
---

## One element, one score

Largest Contentful Paint measures how long it takes for the largest visible thing in the viewport to render. Not the whole page — the biggest single element a visitor can see without scrolling.

On a small business homepage, that is almost always the photograph at the top. The team shot, the storefront, the truck in the driveway, the empty modern kitchen from a stock library.

Which means the LCP number that shows up red in [Search Console](/blog/search-console-first-90-days/) is usually not a verdict on your whole website. It is a verdict on one file.

That is good news. It makes the work finite.

## Find it before you fix it

Do not assume. Open Chrome DevTools, go to the Performance panel, record a page load, and look at the LCP marker in the timings track — it names the element. PageSpeed Insights reports the same thing in the LCP audit.

On image-led pages it will be the hero. On a text-led page — a blog post, a long service page — it is sometimes an `<h1>` or a large paragraph block, and the fix is entirely different: for text, LCP is dominated by how fast your fonts load, which is [a font subsetting problem](/blog/font-subsetting-180kb-to-18kb/), not an image problem.

Two minutes of checking saves you from optimising the wrong thing.

## Six things, in order

### 1. Take `loading="lazy"` off the hero

This is the first thing to check and the most common single mistake we find.

Lazy loading defers an image until it is near the viewport. That is excellent for the eight photos further down your page. Applied to the hero, it tells the browser to hold off on the exact element the metric is waiting for — and because the browser now has to run layout before it decides the image is needed, you have added a delay that did not previously exist.

Plenty of platforms apply `loading="lazy"` to every image on the page automatically. If yours does, the hero needs an explicit exception. The rule is positional: **lazy-load everything below the fold, never anything above it.**

### 2. Serve the right dimensions

A modern camera or a stock library will hand you a 3000-pixel-wide JPEG. A phone displays it in a slot roughly 390 CSS pixels wide, or about 1170 device pixels on a 3× screen.

Without responsive markup, that phone downloads all 3000 pixels and throws most of them away. The visitor pays for every one of them in time and in data.

`srcset` and `sizes` fix this by giving the browser a menu — several versions at different widths, plus a description of how big the slot is at each breakpoint — and letting it choose before it downloads anything:

```html
<img
  src="hero-1200.jpg"
  srcset="hero-600.jpg 600w, hero-1200.jpg 1200w, hero-2000.jpg 2000w"
  sizes="(max-width: 700px) 100vw, 1200px"
  width="2000" height="1050"
  alt="Our crew replacing a tile roof in Frisco"
  fetchpriority="high">
```

Generating those variants by hand is tedious, which is why it does not get done. Generating them at build time is a solved problem — most static site pipelines do it from one source file, and the person writing the page never thinks about it.

### 3. Use a modern format, with a fallback

AVIF and WebP both compress meaningfully better than JPEG at comparable perceived quality. AVIF is generally the smaller of the two; WebP has broader legacy support and encodes faster.

You do not have to choose. `<picture>` lets you list them in order and let the browser take the first one it understands:

```html
<picture>
  <source type="image/avif" srcset="hero.avif">
  <source type="image/webp" srcset="hero.webp">
  <img src="hero.jpg" width="2000" height="1050" alt="…" fetchpriority="high">
</picture>
```

We are deliberately not quoting a percentage saving here — it depends entirely on the image, the encoder, and the quality setting. Encode your own hero three ways and compare the actual file sizes. That takes ten minutes and gives you a real number instead of someone else's.

### 4. Set `width` and `height`

Always. On every image, not just the hero.

Without intrinsic dimensions, the browser does not know how much space to reserve, so it lays out the page without the image and then reflows when it arrives. Everything below jumps. That is Cumulative Layout Shift, the second Core Web Vital, and it is the one that makes visitors tap the wrong thing.

Setting `width` and `height` attributes lets the browser compute the aspect ratio and reserve the box immediately. It costs two attributes and it is the cheapest Core Web Vitals fix that exists.

### 5. Make it discoverable early

The browser's preload scanner reads the raw HTML ahead of the main parser, looking for resources to start fetching. It can only find things that are in the HTML.

Which means:

- An `<img>` in the markup is found immediately. Good.
- A CSS `background-image` is not found until the stylesheet has been downloaded and parsed. Later.
- An image injected by JavaScript — a slider, a carousel, a lazy-loading library — is not found until the script has downloaded, parsed, and executed. Much later.

If your hero is a CSS background or lives inside a carousel, that is very likely your LCP problem, and no amount of compression will fix it. Put the hero in the HTML as an `<img>`.

`fetchpriority="high"` on the hero tells the browser to prioritise it above other images it finds at the same time. It is one attribute and it is worth adding.

### 6. Kill the carousel

We are going to be blunt about this one because it is the single most expensive pattern on small business homepages.

A rotating hero slider means you have shipped three to five full-size hero images, plus a JavaScript library to rotate them, plus the layout cost, so that a visitor can see one of them. The other four are pure waste — downloaded, decoded, and never looked at, because [almost nobody waits for slide two](/blog/the-seven-homepage-sections/).

Take the best photo. Show it. Delete the rest.

## Two optimisations that backfire

**Base64-inlining the hero into the HTML.** The reasoning sounds right — one fewer request. In practice, base64 inflates the data by roughly a third, the bytes are no longer cacheable separately, and they block the HTML from finishing. Inlining is a good technique for a 400-byte icon and a bad one for a 200 KB photograph.

**Preloading everything.** `<link rel="preload">` on the hero is genuinely useful. Preloading eight things is not — preload works by reordering priorities, and if everything is high priority, nothing is. One preload, for the LCP image, if it is not already discoverable as plain markup.

## What good looks like

For a typical small business hero, aim for:

- One image, in the HTML, not lazy-loaded, with `fetchpriority="high"`.
- Three or four width variants offered via `srcset`, with an honest `sizes`.
- AVIF and WebP offered, JPEG fallback.
- `width` and `height` set.
- The largest variant comfortably under a couple of hundred kilobytes.

That last figure is a budget we set, not a standard — the useful thing about it is that it is checkable. Writing it into [a performance budget your build enforces](/blog/a-performance-budget-is-a-json-file/) is what stops the 2 MB hero from coming back six months later when somebody uploads a photo straight off a camera.

Because it will. The image work is not the hard part. Keeping it done is.
