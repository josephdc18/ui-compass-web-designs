---
pageName: font-subsetting-180kb-to-18kb
blogTitle: Font Subsetting Cuts a 180KB Typeface to 18KB
titleTag: Font Subsetting — 180KB to 18KB
blogDescription: Your fonts are probably 5 to 10x heavier than they need to be. Subsetting (loading only the characters you use), pruning unused weights, and serving WOFF2 turns a typical 180KB font family into roughly 18KB. The 4-step diet that closes a top-3 performance gap on most small business sites.
author: "Joseph C."
date: 2025-11-19T16:00:00.000Z
tags:
  - post
  - performance
category: "Performance"
readMins: 6
topper: "Performance"
image: /assets/images/font-subsetting-180kb-to-18kb-card.png
imageAlt: A side-by-side weight comparison showing a full 180KB font family on one side and an 18KB subset on the other
tldrTitle: What you need to know
tldr:
  - 'A typical small business site ships **180KB of font data** when it actually uses **18KB worth of characters**. Subsetting and pruning unused weights closes the gap.'
  - 'Four steps cut fonts to size: **switch to WOFF2** (40% smaller than WOFF), **subset to Latin-only** (drops Cyrillic, Greek, Vietnamese ranges most US sites do not use), **limit to 3 to 4 weights** (regular, bold, italic, one optional), and **self-host** instead of pulling from the Google Fonts CDN.'
  - 'Fonts cause **layout shift** when they load late and the fallback re-flows. The fix is `font-display: swap` plus a matched fallback metric — keeps the page rendering immediately while the web font catches up cleanly.'
  - 'Preload **one critical font weight** (the one in your hero headline). Lazy-load the rest. Pages typically gain **5 to 8 PageSpeed points** from this single change.'
faq:
  - q: 'What is font subsetting?'
    a: 'A subset is a smaller version of a font file containing only the characters you actually need. A full font family includes Latin, Cyrillic, Greek, Vietnamese, sometimes math symbols and arrows — most US small business sites use only the basic Latin range. Subsetting to Latin-only drops the file size by 50–80% with no visible difference on the page.'
  - q: 'What is the difference between WOFF and WOFF2?'
    a: 'Both are web font formats. WOFF (Web Open Font Format) shipped in 2009 and is supported everywhere. WOFF2 shipped in 2014 with better compression — roughly 40% smaller for the same font, with the same browser support today (every browser back to IE11 supported it or has been retired). Ship WOFF2 only and skip the WOFF fallback. The bytes you save are real.'
  - q: 'How many font weights do I actually need?'
    a: 'Three to four. Regular (400) for body text, Bold (700) for headlines and emphasis, an Italic style for inline emphasis or pull quotes, and one optional extra (often a Black/900 weight for the hero headline or a Light/300 for editorial design). Five or more weights is almost always over-design. Most builder templates ship 7 to 9 weights you never use, and each one is a separate 25–50KB file.'
  - q: 'What does `font-display: swap` actually do?'
    a: 'It tells the browser to render text immediately in the fallback font, then swap to the web font when it arrives. The opposite is the default (`font-display: auto`, which often means "block rendering for up to 3 seconds, then swap"). Without `swap`, your visitor sees a blank page until the font downloads. With `swap`, they see content immediately and the font upgrades in place.'
  - q: 'What is the "FOUT" or "FOIT" problem?'
    a: 'FOIT = Flash of Invisible Text. The browser hides the text while waiting for the web font. Bad. FOUT = Flash of Unstyled Text. The browser shows the fallback font first, then swaps. Better. The remaining issue with FOUT is layout shift when the fonts have different metrics. The fix is matching the fallback font''s metrics to the web font using <code>size-adjust</code> and <code>ascent-override</code> in your <code>@font-face</code> declaration — invisible swap, no CLS.'
  - q: 'Should I use Google Fonts or self-host?'
    a: '<a href="/blog/four-dependencies-to-delete/">Self-host</a>. The Google Fonts CDN was the fastest option in 2015. Today it costs you two DNS lookups, a TLS handshake, and a render-blocking CSS request, all to fetch fonts you could serve from your own domain in the same response as your HTML. Tools like <a href="https://gwfh.mranftl.com/fonts">google-webfonts-helper</a> let you download the subsetted WOFF2 files with one click, plus the matching <code>@font-face</code> CSS to paste into your stylesheet.'
  - q: 'How does this connect to the other performance posts?'
    a: 'Font weight is the third-largest performance lever on a typical small business site, after image weight and JavaScript bundles. The same audit pass that catches <a href="/blog/four-dependencies-to-delete/">the four dependencies to delete</a> and <a href="/blog/a-36kb-png-becomes-a-2kb-svg/">over-sized images</a> usually catches a font diet opportunity too. Fix all three in one afternoon and a site at 70 PageSpeed often lands at 92–95.'
  - q: 'Will my designer notice the difference between full font and subset?'
    a: 'No. Subsetting removes character ranges your site does not use (Cyrillic, Greek, etc.) — the Latin characters you actually display look identical. The only way to see the difference is to attempt to type a Cyrillic character on the page; with the subset, the fallback font renders it. For a US small business site, that is fine. For a multilingual site (including a <a href="/blog/the-bilingual-maturity-ladder/">bilingual English/Spanish site</a>), check that your character set covers Spanish accents — usually the Latin-1 subset is enough.'
related:
  - url: /blog/four-dependencies-to-delete/
    title: 'The 4 Dependencies to Delete From Your Small Business Site'
  - url: /blog/a-36kb-png-becomes-a-2kb-svg/
    title: 'A 36KB PNG Becomes a 2KB SVG (Now Multiply That)'
  - url: /blog/the-1-second-tax/
    title: 'The 7% Conversion Tax of a 1-Second Delay'
---

A typical small business site ships around 180 kilobytes of font data and uses about 18 kilobytes' worth of characters.

The other 90% is a Cyrillic alphabet nobody on the page is reading, four font weights nobody on the design uses, and two file format versions for browsers that retired five years ago. Cutting all three to size is one of the quietest, highest-leverage PageSpeed gains on most small business websites.

This post is the four-step font diet, the math behind each step, and the one CSS line that fixes the layout shift fonts cause on their way in.

## Why fonts are a top-3 performance lever

Image weight is the largest performance lever on a typical site. JavaScript bundles are the second. Fonts are the third — and the one most owners do not realize is broken.

A typical font load on a builder-template site:

- 2 to 5 weights of the body font (~30KB each)
- 1 to 3 weights of the heading font (~30KB each)
- One or two language ranges per weight (Latin + Cyrillic + Greek + Vietnamese)
- Two format versions per file (WOFF and WOFF2, served as a pair "for compatibility")

Add it up and the small business homepage is fetching 150 to 250KB of font data before the headline can render. The same page after a disciplined font diet ships 15 to 25KB. Same fonts, same design, an order of magnitude less weight.

## The four-step font diet

### Step 1: Switch to WOFF2 only

<span class="tooltip-term" data-tooltip="Web Open Font Format 2. The most efficient web font compression format. About 40% smaller than WOFF for the same font. Supported in every browser back to 2014.">WOFF2</span> is roughly 40% smaller than WOFF. Every browser that matters supports WOFF2 — Chrome, Firefox, Safari, Edge, even old versions of Samsung Internet and UC Browser. The "WOFF fallback for older browsers" pattern was important in 2017. In 2026 it is dead weight.

The fix is two-line: in your `@font-face` declaration, list only `format('woff2')` and skip the `format('woff')` fallback entirely. Or, if you have both, delete the WOFF files from your assets folder and remove the `@font-face` lines that reference them.

Roughly half the font weight on a typical small business site disappears on this single change.

### Step 2: Subset to the character ranges you actually use

A full <span class="tooltip-term" data-tooltip="A complete typeface family from a foundry, including all weights, styles, and language ranges. Often 150KB to 500KB total. Most small business sites use 10–20% of what they download.">font family</span> from Google Fonts or Adobe Fonts includes Latin, Latin-Extended, Cyrillic, Greek, sometimes Vietnamese, sometimes Math. A US small business site uses Latin. A bilingual English/Spanish site usually uses Latin and Latin-Extended (for accented characters). Anything beyond that is dead weight.

<span class="tooltip-term" data-tooltip="The process of removing unused character ranges from a font file. A Latin-only subset of a typical 60KB weight drops to ~20KB.">Subsetting</span> tools let you specify which Unicode ranges to include and discard the rest. Tools like google-webfonts-helper (a free web tool) generate the subsetted WOFF2 files and the matching CSS in one click.

A subset of a single weight typically drops from 60KB to 18-22KB. Apply across all your weights and another half of the font weight disappears.

### Step 3: Limit to 3 to 4 weights

Most templates ship 5 to 9 weights of every font. The page actually uses 2 to 4. The other 5 are downloaded, parsed, and held in memory anyway because the browser cannot know they will not be needed until after the page is fully laid out.

The minimum useful set:

- **Regular (400)** for body text.
- **Bold (700)** for headlines and emphasis.
- **Italic (400 italic)** for inline emphasis and pull quotes.
- **Optional extra weight** — usually a Black (900) for the hero headline, or a Light (300) for editorial display.

Anything past that is over-design. We have audited sites shipping Thin, ExtraLight, Light, Regular, Medium, SemiBold, Bold, ExtraBold, Black — nine weights, of which the design used three. The other six were a 180KB tax for nothing.

### Step 4: Self-host instead of using the Google Fonts CDN

The Google Fonts CDN link tag was the right answer in 2015 — the CDN was faster than most hosting, and caching across sites was a real benefit. Both stopped being true around 2020. Today, the CDN is a third-party request that costs you a DNS lookup, a TLS handshake, and a render-blocking CSS file before the font itself begins downloading.

The fix is self-hosting. Download the subsetted WOFF2 files, paste the `@font-face` CSS into your own stylesheet, and remove the `<link>` to fonts.googleapis.com from your `<head>`. Same fonts, no third-party request, no CDN dependency. The full case is in [our four-dependencies-to-delete post](/blog/four-dependencies-to-delete/).

## The layout-shift problem fonts cause

Even after the diet, fonts can hurt your <span class="tooltip-term" data-tooltip="Cumulative Layout Shift. A Core Web Vitals metric measuring how much the page jumps around as content loads. Late-arriving web fonts with different metrics from the fallback are a common cause.">CLS</span> score if you let them.

### The problem in plain English

The browser starts rendering your page with the fallback font (usually Arial, Helvetica, or the system default). When the web font arrives, the browser swaps it in. The new font often has different metrics — slightly different character width, slightly different line height — and the page re-flows. Every line of text shifts. Your CLS score takes the hit.

### The fix in three lines of CSS

The fix is twofold. First, use `font-display: swap` so the page renders immediately in the fallback (avoiding the "Flash of Invisible Text" problem). Second, match the fallback metrics to the web font using `size-adjust` and `ascent-override` overrides:

```css
@font-face {
  font-family: 'Roboto Fallback';
  src: local('Arial');
  size-adjust: 100.06%;
  ascent-override: 92.77%;
  descent-override: 24.41%;
  line-gap-override: 0%;
}
```

The numbers come from the web font's actual metrics, calculated once with a tool like Font Style Matcher or generated automatically by the latest Next.js / Astro / Eleventy font plugins. With the fallback matched, the swap from fallback to web font is invisible. No layout shift, no CLS hit.

## Preload the one font that matters

The hero headline is usually the <span class="tooltip-term" data-tooltip="Largest Contentful Paint. A Core Web Vitals metric measuring how long until the biggest visible element on the page renders. Often the hero headline or hero image.">LCP element</span> on a small business homepage. The font that headline uses needs to be ready before the headline tries to render, or LCP slips by 200–400 milliseconds while the browser waits.

The fix is a preload hint:

```html
<link rel="preload" as="font" type="font/woff2"
      href="/assets/fonts/inter-700.woff2" crossorigin>
```

That tells the browser to fetch the file early, before it even parses the stylesheet that references it. Use this only for the one font weight that matters for the first paint — preloading three or four fonts wastes the budget on weights the page does not need immediately.

## A 10-minute font audit

### Step 1: Inventory current fonts (3 minutes)

Open your homepage. Right-click. Inspect. Click the Network tab. Reload. Filter by "Font." Note every font file the page downloads, the format, and the size.

A typical builder-template site lists 6 to 12 font files at 25–60KB each. A well-tuned site lists 2 to 4 at 15–22KB each.

### Step 2: Count actual weights used (3 minutes)

Open the homepage in a regular browser tab. Right-click any text. Inspect. Look at the `font-weight` value in the Computed panel. Click through your hero, your headlines, your body, your nav, your CTAs.

Most small business homepages actually use 2 to 4 distinct weights. Anything beyond that in your downloaded files is over-shipping.

### Step 3: Decide the diet (4 minutes)

Open google-webfonts-helper in another tab. Search for your font family. Pick only the weights you actually use. Pick Latin-only (or Latin + Latin-Extended for bilingual). Download the WOFF2 files. Copy the generated `@font-face` CSS.

Upload the files to your assets folder. Paste the CSS into your stylesheet. Delete the Google Fonts CDN link from your `<head>`. Test the page. Compare the Network panel before-and-after.

A typical small business site moves from 180KB of font weight to 18-22KB on this single pass.

## What the score change looks like

The PageSpeed score impact is usually 5 to 8 points on a site already in the 70s, more on sites in the 50s. The bigger win is the LCP move — preloading the headline font often drops LCP by 200-400ms, which is enough to move the site under the 2.5-second threshold Google grades you against.

The full math on what each second of speed costs you is in [our 1-second-tax post](/blog/the-1-second-tax/). The font diet by itself is rarely a redesign trigger, but it is one of the three or four single highest-leverage hours on a typical site — alongside the [image pipeline](/blog/a-36kb-png-becomes-a-2kb-svg/) and the [four dependencies to delete](/blog/four-dependencies-to-delete/).

## Where we land

We hand-code every site we ship, and the font diet is part of the launch checklist. WOFF2 only, Latin-only subset (or Latin+Latin-Ext for bilingual), three to four weights, self-hosted, with the hero font preloaded and the fallback metric-matched.

That is not exotic engineering. It is just "do not ship weight you do not use." The same logic applies across every site we build under [our pricing](/pricing/), and the quarterly font-weight audit is part of [unlimited edits and support](/unlimited-edits-and-support/) for clients we host long-term.

## Run the audit

Open your homepage. Open the Network panel. Filter by Font. Note the total weight your fonts are pulling.

Anything above 60KB of font data on a small business site is usually fixable in an afternoon.

What did your fonts weigh?
