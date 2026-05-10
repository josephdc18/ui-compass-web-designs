---
pageName: four-dependencies-to-delete
blogTitle: The 4 Dependencies to Delete From Your Small Business Site
titleTag: 4 Dependencies to Delete From Your Site
blogDescription: Four files most small business sites ship by default that they almost never need. jQuery, Font Awesome, the Google Fonts CDN link, and blocking JavaScript. Together they add roughly 200KB to every page load and buy you almost nothing.
author: "Joseph C."
date: 2026-05-10T04:00:00.000Z
tags:
  - post
  - performance
category: "Performance"
readMins: 6
topper: "Performance"
image: /assets/images/2990879accb1.jpg
imageAlt: A browser network panel showing four large dependency files dimmed and crossed out
tldrTitle: What you need to know
tldr:
  - 'Most small business sites ship roughly **200KB of dependencies they almost never use**: jQuery, Font Awesome, a Google Fonts link tag, and at least one blocking JavaScript file.'
  - 'Each one has a **lighter replacement**: vanilla JavaScript for jQuery, individual SVG icons for Font Awesome, self-hosted fonts for Google Fonts, and `defer`/`async` for blocking JS.'
  - 'Removing all four typically moves a **mobile PageSpeed score up by 15 to 25 points** without touching the design or content.'
  - 'These are punch-list items, not redesigns. Most builds can land all four fixes in a **single afternoon**.'
faq:
  - q: 'Why is jQuery still on so many sites if it is unnecessary?'
    a: 'Two reasons. First, jQuery was the right answer in 2010, and a lot of templates and plugins from that era still depend on it. Second, page builders include it by default because their internal scripts assume it is available. The fix on a builder is usually a setting or a plugin to dequeue jQuery on the front end. The fix on a hand-coded site is to never include it in the first place.'
  - q: 'Will my site break if I remove jQuery?'
    a: 'It can. Anything on the page that calls a jQuery function (e.g. <code>$(...).slideDown()</code>) will throw an error after jQuery is removed. The replacement is vanilla JavaScript (<code>element.classList.add(...)</code>, <code>element.addEventListener(...)</code>). Modern browsers do everything jQuery used to do, with no library required. The migration is usually 15 to 30 minutes per page worth of jQuery code.'
  - q: 'Why not just use the Font Awesome CDN — is it not free and fast?'
    a: 'It is free, but it is not free in load time. The default Font Awesome bundle is roughly 75KB (or larger if you include all icon styles). Most sites use 4 to 8 icons. Loading 1,500 icons to use 6 is a 99% waste. Individual SVGs are 1 to 2KB each, total weight under 12KB for the same 6 icons.'
  - q: 'How do I self-host fonts properly without breaking my CMS?'
    a: 'Three steps. (1) Download the font files (<code>.woff2</code> format) from Google Fonts. (2) Upload them to your assets folder. (3) Define <code>@font-face</code> rules in your stylesheet pointing to the local files, then remove the Google Fonts <code>&lt;link&gt;</code> tag from your <code>&lt;head&gt;</code>. The CSS is identical for the rest of your styles. Roughly an hour on most builder sites.'
  - q: 'What is the difference between <code>async</code> and <code>defer</code>?'
    a: 'Both prevent the browser from blocking on the script. <code>async</code> runs the script as soon as it downloads, in any order. <code>defer</code> runs the script after the HTML is fully parsed, in order. For analytics and third-party scripts, <code>async</code> is fine. For your own scripts that depend on the DOM existing, <code>defer</code> is the right choice. Almost no script on a small business site needs to be blocking.'
  - q: 'How do I find out which dependencies my site is shipping?'
    a: 'Open your site in Chrome. Right-click anywhere and pick "Inspect." Click the Network tab. Reload the page. Sort the rows by Size, descending. Anything over 30KB that you did not knowingly add is a dependency you should evaluate. The same view shows you which files are render-blocking (red bars in the timeline at the top of the panel).'
  - q: 'Will removing these dependencies actually move my PageSpeed score?'
    a: 'Yes, and the bigger your score gap, the bigger the move. A site at 60 mobile typically jumps to 78–85 after this single pass. A site already at 90+ might gain 3–5 points. Either way, the dependency cleanup is one of the highest-leverage hours of work you can do on a small business site, and it pays back forever. The full math on what each second of speed buys you is in <a href="/blog/the-1-second-tax/">our 1-second-tax post</a>.'
related:
  - url: /blog/the-1-second-tax/
    title: 'The 7% Conversion Tax of a 1-Second Delay'
  - url: /blog/designed-on-a-monitor-used-on-a-phone/
    title: 'Designed on a 27-inch Monitor. Used on a 6-inch Phone.'
  - url: /blog/redesign-or-optimize-warning-signs/
    title: 'Redesign or Optimize? The 7 Warning Signs That Decide'
---

Most small business websites ship roughly two hundred kilobytes of code they do not use.

The pattern is consistent. <span class="tooltip-term" data-tooltip="A JavaScript library that simplified DOM manipulation and AJAX in the late 2000s. Modern browsers have native equivalents that are faster and require no library.">jQuery</span> for an animation that the modern browser handles natively. <span class="tooltip-term" data-tooltip="An icon font library shipped as a single ~75KB bundle, even when the page only uses 4 icons.">Font Awesome</span> with 1,500 icons loaded so the site can use four of them. The Google Fonts CDN link tag adding a third-party request and a DNS hop on every load. A blocking JavaScript file from a chat widget or analytics tag stalling the entire page render until it finishes downloading.

Together, these four dependencies cost a typical small business site around two hundred kilobytes and noticeable load time. They are also among the easiest fixes on the entire performance checklist. Most sites can land all four in a single afternoon.

This post is the four, the costs, and the replacements.

## Why these four show up everywhere

The four dependencies below are the ones we see on almost every small business site we audit. Two of them (jQuery and Font Awesome) made sense in 2010 and have outlived their reasons. One of them (Google Fonts CDN) was once the fastest option and is no longer. The fourth (blocking JavaScript) is rarely intentional — usually a leftover from a plugin or a copy-paste install of a third-party tag.

The pattern is not laziness. It is inheritance. Page builders include them by default. Templates assume them. Tutorials from a decade ago still reference them. The defaults are old, and the defaults are what most sites ship.

## The four dependencies

### 1. jQuery

**What it is**: A JavaScript library that made DOM manipulation easy in 2010, when browsers were inconsistent. Modern browsers (Chrome, Firefox, Safari, Edge) have native equivalents for everything jQuery does, and the natives are faster.

**What it costs**: Around 85KB minified. On a 4G mobile connection, that is roughly 200ms of download time, plus 50–100ms of parse and execute. The cost is paid on every page load, before the visible content appears.

**What to use instead**: <span class="tooltip-term" data-tooltip="JavaScript written without a library. The browser's native APIs (querySelector, addEventListener, classList, fetch) cover everything jQuery used to do.">Vanilla JavaScript</span>. The native methods (`document.querySelector`, `element.classList.add`, `element.addEventListener`) cover every common jQuery pattern. Migration is usually 15 to 30 minutes of find-and-replace per page.

If your site is on a builder, the fix is a setting or a plugin to dequeue jQuery from the front end. If it is hand-coded, the fix is to never include it in the first place.

### 2. Font Awesome

**What it is**: An icon library that ships every icon as a webfont. The visitor downloads all 1,500 icons whether the page uses four or 400.

**What it costs**: Around 75KB for the base bundle, larger if you include the "all styles" version. The download blocks rendering of any element that uses an icon, so the page either flashes content as the font arrives or shows blank space until it does.

**What to use instead**: Individual SVG icons. Drop only the icons your site actually uses into the markup as inline SVG or as separate `.svg` files. Six icons total weight is under 12KB. The full breakdown of why one icon swap pays off is in [our 36KB PNG to 2KB SVG post](/blog/a-36kb-png-becomes-a-2kb-svg/).

The deeper benefit: SVG icons inherit `currentColor`, so they re-tint cleanly on hover and adapt to dark mode without extra work.

### 3. The Google Fonts CDN link

**What it is**: A `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` tag in the document head that fetches the font CSS and font files from Google's servers.

**What it costs**: Two DNS lookups (one for `fonts.googleapis.com`, one for `fonts.gstatic.com`), a TLS handshake, plus 30–50KB of font files. The CDN tag itself is render-blocking — the browser pauses page rendering until the font CSS arrives.

**What to use instead**: <span class="tooltip-term" data-tooltip="Hosting your font files on your own domain instead of pulling them from a third-party CDN. Eliminates DNS lookups and improves load time.">Self-hosted fonts</span> via `@font-face` rules pointing to local `.woff2` files in your own assets folder. Same fonts, no third-party request, no DNS hop, no extra TLS handshake. Self-hosting also avoids one of the silent CLS triggers — the font swap that happens when the third-party file arrives late and shifts every line of text on the page.

The migration is roughly an hour on most builder sites: download the `.woff2` files from Google Fonts, upload to your server, write the `@font-face` rules, remove the `<link>` tag from `<head>`.

### 4. Blocking JavaScript

**What it is**: Any `<script src="...">` tag in the document head without an `async` or `defer` attribute. The browser pauses HTML parsing until the script downloads and executes.

**What it costs**: Variable, but always painful. A 50KB analytics script in the head can cost 300ms before the page starts rendering. A chat widget can cost 800ms. Multiply by the number of blocking scripts and you can lose a full second to script tags before the visitor sees anything.

**What to use instead**: Add <span class="tooltip-term" data-tooltip="An attribute that lets the browser download a script in parallel with parsing the HTML, then execute it as soon as it is ready (`async`) or after parsing completes (`defer`).">`async` or `defer`</span> to every script tag that is not absolutely required for the first paint. For analytics and third-party scripts, `async` is fine. For your own scripts that depend on the DOM existing, `defer` is the safer choice — it executes in order after HTML parsing finishes.

Almost nothing on a small business site needs to be blocking. Most pages can ship with zero render-blocking scripts and lose nothing.

## The cumulative cost

Add the four together on a typical builder site:

- jQuery: ~85KB
- Font Awesome: ~75KB
- Google Fonts CDN setup: 1–2 extra round trips, plus 30–50KB of fonts that could have been local
- Blocking JS: 50–800ms of pure delay

The numbers compound. A site shipping all four loses roughly 200KB of weight and one to two seconds of perceived load time, before any of its own content begins downloading. The same site after this pass usually moves from a 60 PageSpeed score to a 78–85 — without any redesign work, without any content changes, just a dependency cleanup. The conversion math on that gap is in [our 1-second-tax post](/blog/the-1-second-tax/).

## How to find them on your own site

The audit takes ten minutes.

### Step 1: Open the Network panel

Right-click anywhere on your homepage. Pick "Inspect." Click the "Network" tab. Reload the page (Cmd-R or Ctrl-R).

### Step 2: Sort by size

Click the "Size" column header to sort largest first. Anything over 30KB is worth a look.

- Look for a file containing `jquery` in the URL. That is dependency #1.
- Look for `fontawesome` or `fa-` in the URL. That is dependency #2.
- Look for any request to `fonts.googleapis.com` or `fonts.gstatic.com`. That is dependency #3.
- Look for any script that loads near the top of the timeline (red bars in the waterfall). That is dependency #4.

### Step 3: Catalog the easy wins

Most sites have at least two of the four. Sites running on builders often have all four. Note which ones you see — that is the punch list.

## What we ship instead

We hand-code every site we build, and the default stack on every project is the lighter version: vanilla JavaScript, individual SVG icons, self-hosted `.woff2` fonts, and `defer` on every script that is not the page's primary code. That is not a marketing position. It is the structural reason our sites consistently score 95+ on mobile PageSpeed without a separate optimization pass.

If your current site is shipping the four dependencies above, the conversation is usually shorter than you expect — see [the redesign-or-optimize scoreboard](/blog/redesign-or-optimize-warning-signs/) for whether the cleanup is a punch list or part of a bigger rebuild. Either way, [our pricing](/pricing/) folds this kind of ongoing performance work into the same flat monthly fee.

## Run the audit

Open your homepage. Open the Network panel. Sort by size. Find the four dependencies above.

If you find more than two, [send us your URL](/contact/). We will give you the cleanup list with file names and replacement weights.

How many of the four are on your site?
