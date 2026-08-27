---
pageName: a-36kb-png-becomes-a-2kb-svg
blogTitle: A 36KB PNG Becomes a 2KB SVG (Now Multiply That)
titleTag: 36KB PNG Becomes a 2KB SVG
blogDescription: >-
  Most small business sites are leaking weight on every icon and every image.
  The four-step image pipeline that turns a 2.3MB hero into a 37KB one and turns
  a 36KB PNG icon into a 2KB SVG. Same pixels. 90% less weight.
author: Joseph C.
date: 2026-08-19T14:00:00.000Z
draft: true
tags:
  - post
  - performance
category: Performance
readMins: 6
topper: Performance
image: /assets/images/a-36kb-png-becomes-a-2kb-svg-card.webp
imageAlt: >-
  A side-by-side comparison of a heavy PNG icon and a light SVG version of the
  same shape, with file sizes labeled
tldrTitle: Key Takeaways
tldr:
  - >-
    A typical small business homepage carries **5 to 15 images and 4 to 12
    icons**, and most of them are at least 50% heavier than they need to be. The
    savings is rarely visible to the eye and almost always visible to the load
    time.
  - >-
    PNG icons should be **SVG icons**. A 36KB PNG often becomes a 2KB SVG
    carrying the same shape — a 94% reduction per icon, multiplied by every icon
    on the page.
  - >-
    A 4-step pipeline gets every photo right: **crop**, **compress**,
    **convert** (to WebP or AVIF), **serve** at the dimensions actually
    rendered. A 2.3MB phone-camera hero shrinks to roughly **37KB** without
    visible quality loss.
  - >-
    Right-sizing images alone moves a typical mobile PageSpeed score **20–30
    points** without any other change.
faq:
  - q: How can I tell which images on my site are too big?
    a: >-
      Open the page in Chrome, right-click, "Inspect," click the Network tab,
      then reload. Sort by Size. Anything over 200KB on a small business
      homepage deserves a look. Hero images over 500KB are almost always
      over-sized for the screen they render on.
  - q: What is the difference between WebP and AVIF — should I use both?
    a: >-
      WebP is supported in every browser since 2020. AVIF is newer (2022) and
      roughly 20% smaller for the same visible quality, but support is slightly
      behind. The right answer is to ship both, fall back to JPEG, and let the
      browser pick. The HTML <code>&lt;picture&gt;</code> element handles the
      negotiation automatically.
  - q: Can I just turn on a "lazy loading" plugin and call it done?
    a: >-
      Lazy loading helps below-the-fold images, but it is not the fix you think
      it is. Marking your hero image lazy actually hurts you — the browser
      delays the most important image on the page, which is the <a
      href="/blog/the-1-second-tax/">LCP element on your PageSpeed score</a>.
      The fix is right-sizing first, lazy loading second, and only on images
      below the fold.
  - q: My designer sent me 4MB hero photos. What should I tell them?
    a: >-
      The conversation is "the file you sent me will not be the file the visitor
      downloads." A photo studio works at print resolution because that is what
      their other clients need. For web, the photo gets resized to the
      dimensions it will actually render at, then compressed. A 4MB original is
      fine as the source. The 4MB original on a homepage is the bug.
  - q: Why are my icons rendering blurry on retina displays?
    a: >-
      Because they are <span class="tooltip-term" data-tooltip="Image format
      that stores pixels. PNG, JPEG, WebP, AVIF are all raster. Resolution is
      fixed at the dimensions of the file.">raster</span> formats (PNG, JPEG)
      being scaled up by the browser. <span class="tooltip-term"
      data-tooltip="Image format that stores shapes as math instead of pixels.
      Scales infinitely without quality loss.">SVG</span> icons render crisp at
      any size because the browser draws the shape from math, not from pixels.
      Switching every icon to SVG fixes the blur and shrinks the file at the
      same time.
  - q: Can I use SVG for photos?
    a: >-
      No. SVG is for shapes (icons, logos, illustrations with flat color).
      Photos with millions of color values per pixel cannot be expressed
      efficiently as math. Use SVG for icons and logos, JPEG/WebP/AVIF for
      photos.
  - q: How does this connect to the dependencies-to-delete list?
    a: >-
      Directly. Font Awesome ships 1,500 icons as a single 75KB+ webfont.
      Replacing it with the 6 SVG icons your site actually uses is the same
      conversation as this post — same icon shapes, 90% less weight. The full
      list is in <a href="/blog/four-dependencies-to-delete/">our
      four-dependencies-to-delete post</a>.
related:
  - four-dependencies-to-delete
  - the-1-second-tax
  - designed-on-a-monitor-used-on-a-phone
---

A 36KB PNG icon on your homepage is usually a 2KB SVG that has not been swapped out yet.

That is one icon. Multiply by the eight icons your homepage probably has. Now do the same math on your hero image, your three service-card photos, and your team photo. The total weight drop is often 80% of what your visitor's browser is currently downloading — for the same pixels they would see either way.

This post is the four-step pipeline that gets every image and every icon to the right weight, and the math behind why each step matters.

## Why this is the highest-leverage hour you can spend

Image weight is the largest performance lever on a typical small business site. Bigger than fonts, bigger than analytics, bigger than the 200KB of dependencies covered in [our four-dependencies-to-delete post](/blog/four-dependencies-to-delete/).

A typical homepage we audit:

- 5 to 15 photographic images
- 4 to 12 icons
- 1 to 3 background patterns or textures

Each one is usually at least 50% heavier than it needs to be. Combined, the bloat is often 1 to 3 megabytes per page. On a phone over a typical mobile connection, that is two to four extra seconds of load time, which costs you roughly [14 to 28 percent of your conversions](/blog/the-1-second-tax/) before the visitor reads a word.

The fix is rarely a redesign. It is a pipeline.

## The 4-step image pipeline

Every photograph on your site should go through these four steps in order, before it ever ships.

### Step 1: Crop

Remove the parts of the photo the layout will not show. A wide-angle shot used as a 16:9 hero should be cropped to 16:9 in your image editor, not in CSS. The cropped pixels are the only ones that need to be downloaded.

This is the fastest step and the most-skipped one. Builder sites often "crop" with CSS by hiding the edges of an oversized image — which means the visitor still downloads the hidden pixels. That is the bug.

### Step 2: Compress

Run the cropped image through an image optimizer. <span class="tooltip-term" data-tooltip="Compression that reduces file size by removing data that the human eye cannot perceive. JPEG, WebP, and AVIF use lossy compression. PNG uses lossless.">Lossy compression</span> for photos can shave 60 to 80% off the file size with no visible quality loss to a human eye.

The free tools that work well: TinyPNG, Squoosh, ImageOptim. Drag the image in, drag the optimized version out. No skill required.

### Step 3: Convert

Convert from JPEG/PNG to a modern format: <span class="tooltip-term" data-tooltip="A modern image format developed by Google in 2010. Supported in every major browser since 2020. Roughly 30% smaller than JPEG for the same visible quality.">WebP</span> or <span class="tooltip-term" data-tooltip="An image format released in 2019 based on the AV1 video codec. Roughly 20% smaller than WebP for the same visible quality. Support is now broad across modern browsers.">AVIF</span>.

WebP is supported in every modern browser and is roughly 30% smaller than JPEG for the same visible quality. AVIF is newer and roughly 20% smaller than WebP. The right answer is to ship both and let the browser pick — the HTML `<picture>` element handles the negotiation automatically.

### Step 4: Serve at the right size

Use the HTML `<picture>` element with `srcset` to serve a different file size to a phone than to a desktop. A 1920px-wide hero image sent to a 320px phone is wasting 90% of the bytes the visitor downloads. The fix is shipping the 320px version to phones and the 1920px version only to large screens.

The serve-step is what closes the loop on the [mobile-first layout](/blog/designed-on-a-monitor-used-on-a-phone/) — the layout adapts to the device, and the images should too.

## What the pipeline costs your largest image

The numbers below are real and consistent across audits.

- **Original**: A 2.3MB photograph straight from the camera or stock library.
- **After cropping** to the actual rendered aspect ratio: ~1.4MB.
- **After compression** at 75% quality: ~600KB.
- **After conversion** to WebP: ~120KB.
- **After right-sizing** to mobile dimensions: ~37KB.

Same image. Same visible quality. 1.6% of the original weight.

## Why icons are a separate conversation

Icons follow different rules from photos. A photograph has millions of color values per pixel and cannot be reduced beyond a certain floor without losing quality. An icon has a small number of distinct shapes, and the right format expresses those shapes as math instead of pixels.

### PNG icons are heavy

A typical PNG icon at 64×64 pixels weighs 4 to 12KB. Render it at 128×128 for a retina display and the file size doubles or triples. Render it at multiple sizes for multiple devices and the storage cost compounds.

The 36KB PNG icon in the title of this post is a real number. We have audited sites where one decorative icon used in three places carried roughly that much weight — once for the original, once for the 2x retina version, once for the @3x version.

### SVG icons are light and infinite

The same icon as <span class="tooltip-term" data-tooltip="Scalable Vector Graphics. An XML-based image format that describes shapes as paths instead of pixels. Renders sharp at any size and is usually 1–3KB per icon.">SVG</span> is 1 to 3KB. It renders sharp at every size automatically. It can be re-tinted with `currentColor` so it inherits the parent's text color on hover, in dark mode, anywhere. It does not need separate retina or @3x versions.

The conversion is one-time. Find an SVG version of each icon you use (most icon libraries publish SVG sources directly). Replace the `<img>` tag with the SVG markup or with an `<img>` pointing at the `.svg` file. Done.

For a typical homepage with eight icons, the total weight goes from roughly 80KB of PNG to roughly 12KB of SVG — a 68KB drop on a single page, multiplied by every page that uses the same icon set.

## The lazy-loading trap

Most "performance plugins" advertise lazy loading as the fix. It is not the fix.

### What lazy loading is

<span class="tooltip-term" data-tooltip="A browser feature that delays loading an image until the visitor scrolls near it. Helps performance for below-the-fold content. Hurts performance when applied to above-the-fold images.">Lazy loading</span> tells the browser to wait on an image until the visitor scrolls near it. For images below the fold, this is helpful — they are not blocking anything visible, and the visitor may never scroll to them anyway.

### Why it backfires on hero images

For images above the fold (the hero, the proof strip, the first service icon), lazy loading is the opposite of helpful. The browser delays loading the most important image on the page. The visitor sees the layout shift as the hero appears late. The PageSpeed score takes a hit on both LCP (the hero is now slower) and CLS (the layout shifts when it arrives).

The rule: lazy load below the fold, eager load above. The HTML attribute is `loading="lazy"` for below, no attribute (or `loading="eager"`) for above.

## The 5-minute image audit

Open your homepage. Open the Network panel (right-click, Inspect, Network tab). Reload. Sort by Size, descending.

### Look for the offenders

Anything over 200KB on a small business homepage deserves a second look. Anything over 500KB is almost always over-sized for the screen it renders on. Anything over 1MB is the headline of your performance audit.

### Note the format

In the column "Type," check whether your photos are JPEG/PNG (old) or WebP/AVIF (modern). If they are still JPEG, the convert step has not happened yet.

### Check the icons

Filter the list by file type. Any `.png` files under 50KB are probably icons that should be SVG. Any `fontawesome` request is the same pattern from a different angle — see [the four dependencies to delete](/blog/four-dependencies-to-delete/) for that fix.

## What we ship

Every site we hand-code goes through the full pipeline before launch. Crop, compress, convert, serve at multiple sizes via the `<picture>` element. Icons ship as SVG. Hero images load eager; below-the-fold images lazy. PageSpeed scores hold at 95+ on mobile because the image weight is paid for once, properly, before the page ever ships.

If your site is showing the symptoms (slow on mobile, blurry icons on retina, hero takes forever), the fix is usually a half-day of pipeline work, not a redesign — see [the redesign-or-optimize scoreboard](/blog/redesign-or-optimize-warning-signs/) for the diagnostic. The work folds into [our unlimited edits and support plan](/unlimited-edits-and-support/) if you want it on retainer.

## Run the audit

Open your homepage. Open the Network panel. Sort by size. Find the three biggest offenders.

If you want a punch list with file names and target sizes, [send us your URL](/contact/). We will walk through the four steps with the actual numbers from your site.

What does your biggest image weigh today?
