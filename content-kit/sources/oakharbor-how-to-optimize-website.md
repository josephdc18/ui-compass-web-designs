---
url: https://oakharborwebdesigns.com/blog/how-to-optimize-a-website/
domain: oakharborwebdesigns.com
title: How to Optimize a Website (Core Web Vitals and Page Speed)
type: external blog post
status: source material — paraphrase, do not copy verbatim
---

# How to Optimize a Website

## Key themes (paraphrased)
- Right-size images to their actual rendered dimensions instead of resizing huge files in CSS.
- Background images on mobile are a common silent weight bomb.
- Native lazy loading is fine, but keep it off above-the-fold images or you cause layout shift.
- Drop jQuery and Font Awesome. Replace with vanilla JS and individual SVGs.
- Self-host fonts via @font-face in a shared CSS file. Skip the Google Fonts CDN link.
- Defer JavaScript so it loads after HTML and CSS render.
- Audit with Lighthouse, aim for 96+ across categories.

## Quotable claims / stats (verify before reuse)
- Image compression can shave up to 80% off file size.
- A 2300px background image resized down to 500px for mobile drops from 2.3MB to about 37KB.
- A 36KB PNG icon often becomes a 2KB SVG.

## Possible UI Compass angles
- Background image weight on mobile (2.3MB to 37KB story) → BACKLOG section: Speed/Performance, template: stat-hero
- The four dependencies to delete from a small business site (jQuery, Font Awesome, Google Fonts CDN, blocking JS) → BACKLOG section: Speed/Performance, template: reasons-list
- Lazy loading the wrong way: why marking your hero image lazy actually hurts you → BACKLOG section: Speed/Performance, template: reasons-list
- SVG vs PNG icons: a 36KB to 2KB swap on a single icon → BACKLOG section: Speed/Performance, template: stat-hero
