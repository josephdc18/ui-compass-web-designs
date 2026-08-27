---
pageName: wcag-2-2-aa-in-five-minutes
blogTitle: WCAG 2.2 AA in 5 Minutes. The 3 Tests Anyone Can Run.
titleTag: WCAG 2.2 AA in 5 Minutes
blogDescription: >-
  Roughly 96% of the top million websites fail basic accessibility checks, and
  small businesses are the easiest targets for ADA web lawsuits. The three free
  tests every owner can run on their own site in 5 minutes, plus the four fixes
  most sites need.
author: Joseph C.
date: 2026-07-17T16:37:00.000Z
draft: true
tags:
  - post
  - design
category: Design
readMins: 6
topper: Design
image: /assets/images/wcag-2-2-aa-in-five-minutes-card.webp
imageAlt: >-
  A laptop screen showing a website accessibility audit report with three test
  categories highlighted
tldrTitle: Key Takeaways
tldr:
  - >-
    Roughly **96% of the top one million websites** fail basic accessibility
    checks ([WebAIM Million](https://webaim.org/projects/million/)). Your Wix or
    Squarespace site is statistically in that pile.
  - >-
    Three free tests catch most of the gap in **5 minutes**: **color contrast**
    on body text, **keyboard-only navigation** through the page, and a quick
    **alt-text audit** on every image.
  - >-
    WCAG 2.2 **AA** is the courtroom benchmark, not A or AAA. Most plaintiffs
    cite AA. Pass AA and you have done what reasonably required.
  - >-
    Accessibility work doubles as SEO. Both reward **semantic HTML**, real
    heading hierarchy, **alt text** that describes the image, and descriptive
    link text.
faq:
  - q: What is WCAG and what does "AA" mean?
    a: >-
      <strong>WCAG</strong> is the Web Content Accessibility Guidelines,
      maintained by the W3C. Three conformance levels: <strong>A</strong>
      (must-have basics), <strong>AA</strong> (the practical bar everyone is
      expected to meet), <strong>AAA</strong> (ideal but often impractical for
      content-heavy sites). When a lawsuit references WCAG, it almost always
      means 2.1 AA or 2.2 AA. AA is the bar to aim for and the bar courts use.
  - q: What is the easiest contrast test I can run right now?
    a: >-
      Install the free WAVE browser extension (wave.webaim.org). Open your
      homepage. Click the extension icon. WAVE marks every accessibility issue
      inline on the page, including contrast failures. Total time: 60 seconds.
      Contrast failures are usually the most common and the easiest to fix —
      change a hex code or two and a dozen warnings disappear.
  - q: How do I test keyboard-only navigation?
    a: >-
      Put your mouse down. Open your homepage. Press <code>Tab</code>
      repeatedly. Watch the page. Can you reach every link, every button, and
      every form field? When you reach an element, can you see which one is
      focused (visible outline)? If you press <code>Enter</code> on a link, does
      it activate? If any of those fails, that is a real keyboard-accessibility
      bug — and screen-reader users navigate the same way.
  - q: What does "alt text" actually need to say?
    a: >-
      Describe the image in the context of the page. A photo of a plumber
      working on a faucet should be alt="A plumber repairing a kitchen sink
      faucet" — not alt="image" and not alt="plumber.jpg". Decorative images
      that add nothing to the content should have <code>alt=""</code> (empty,
      but present) so screen readers skip them cleanly. Logo images: alt="UI
      Compass logo" — the company name plus "logo."
  - q: Will accessibility hurt my design?
    a: >-
      Almost never. The constraints — readable contrast, visible focus
      indicators, sufficient text size, tap targets at least 44 pixels — overlap
      with what makes a site feel professional. Designs that "look great" but
      fail accessibility usually look great only on the designer's 5K monitor in
      perfect lighting. Accessibility-passing designs read well for every
      visitor on every device. The same logic governs <a
      href="/blog/white-space-is-not-empty-space/">our spacing rules</a>.
  - q: How does this connect to SEO?
    a: >-
      Tightly. Semantic HTML (one H1, proper heading order, real list elements)
      helps both screen readers and search engines parse your page. Alt text
      gets indexed and surfaces in image search. Descriptive link text ("Read
      our pricing" beats "click here") gives both screen readers and Google more
      signal. We rarely improve accessibility on a client site without
      simultaneously lifting <a href="/blog/the-1-second-tax/">their PageSpeed
      and SEO scores</a> too.
  - q: What about overlay widgets like AccessiBe or UserWay?
    a: >-
      Skip them. They do not satisfy the law (the National Federation of the
      Blind has been on record against them since 2021), they introduce their
      own accessibility problems, and they have not stopped lawsuits — multiple
      businesses with overlay widgets installed have still been sued. The full
      breakdown is in <a
      href="/blog/why-accessibility-overlay-widgets-get-sued/">our
      overlay-widget post</a>. Fix the underlying site instead.
  - q: How does this connect to the redesign-or-optimize scoreboard?
    a: >-
      A site failing WCAG AA is rarely failing only WCAG AA. It is usually also
      failing the <a href="/blog/the-1-second-tax/">PageSpeed score</a>, the <a
      href="/blog/designed-on-a-monitor-used-on-a-phone/">mobile experience</a>,
      and one or two of the seven signs in <a
      href="/blog/redesign-or-optimize-warning-signs/">our scoreboard</a>. The
      same root cause — a builder template optimized for screenshots, not
      visitors — produces all of them.
sources:
  - label: WebAIM — The 2026 WebAIM Million
    url: https://webaim.org/projects/million/
  - label: W3C — WCAG 2.2 Contrast (Minimum)
    url: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
  - label: W3C — WCAG 2.2 Keyboard
    url: https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html
  - label: W3C — WCAG 2.2 Non-text Content
    url: https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html
related:
  - trust-signals-that-move-the-needle
  - the-seven-homepage-sections
  - redesign-or-optimize-warning-signs
---

Roughly 96 percent of the top one million websites fail basic accessibility checks.

The number comes from [WebAIM's annual scan](https://webaim.org/projects/million/) of the million most-visited sites on the internet. Pages that fail at the most automated level. Color contrast errors, missing alt text, broken form labels, headings out of order. Statistically, your site is in that pile, and most owners do not realize until a demand letter arrives or a customer calls to complain that they cannot navigate the page.

The good news: most of the gap closes with three tests you can run yourself, in five minutes, with no developer help. This post is the three tests and the four fixes that close most of the gap they reveal.

## Why this matters

<span class="tooltip-term" data-tooltip="Web Content Accessibility Guidelines. The W3C standard that defines what an accessible website looks like. Three conformance levels: A, AA, AAA. AA is the practical bar.">WCAG</span> is not a checklist for compliance theater. It is the standard courts use when a small business gets sued for an inaccessible website, and it is the same standard that determines whether a quarter of US adults — the share with a disability — can actually use your site.

Two things are happening at once:

- ADA web lawsuits have climbed every year since 2019. Small businesses are the easy target because they settle instead of fighting in court.
- The boomer cohort with the most discretionary spending is also the one most likely to be turned away by tight text, low contrast, and tap targets sized for younger thumbs.

Accessibility is the legal floor and the commercial ceiling at the same time. The three tests below catch most of the gap that exposes you to either.

## Test 1: Color contrast on body text (30 seconds)

The single most common accessibility failure on a small business site. Light gray body text on a white background. White text on a soft pastel hero. Both look elegant on a designer's calibrated monitor and fail to render readably for older eyes, on cheaper screens, or in direct sunlight.

### What WCAG 2.2 AA requires

- **Body text (under 18 point)**: a <span class="tooltip-term" data-tooltip="The ratio of the lightest color to the darkest color in a foreground/background pair. WCAG 2.2 AA requires 4.5:1 for body text and 3:1 for large text.">contrast ratio</span> of at least **4.5 to 1**.
- **Large text (18 point or larger, or 14 point bold)**: a ratio of at least **3 to 1**.
- **Icons and UI components**: a ratio of at least **3 to 1** against their background.

### How to test it in 30 seconds

Install the free <span class="tooltip-term" data-tooltip="A free accessibility evaluation tool from WebAIM. Browser extension that marks accessibility issues inline on any web page. wave.webaim.org">WAVE</span> ([wave.webaim.org](https://wave.webaim.org/)) browser extension. Open your homepage. Click the WAVE icon. The extension marks every contrast failure on the page with a red "contrast" badge.

If you see more than zero contrast badges, you have body text that is failing the legal bar. The fix is usually a hex code change in your stylesheet — body color from `#999` to `#4e4b66`, headline color from `#aaa` to `#262421`. Five minutes per page, permanent fix.

## Test 2: Keyboard-only navigation (2 minutes)

Take your hand off the mouse. Press the `Tab` key. Keep pressing it.

You should see a visible <span class="tooltip-term" data-tooltip="The visible outline that appears around the currently-focused element. Required by WCAG. Pressing Tab moves focus to the next interactive element; the outline shows where focus is.">focus indicator</span> move through every interactive element on the page: the logo link, every nav item, every button, every form field. When you press `Enter` on a focused link or button, it should activate.

### What to watch for

- **Invisible focus indicator.** The default browser focus ring is sometimes hidden by CSS that prioritizes aesthetics. If you cannot see what is focused, screen-reader users cannot either.
- **Tab order that jumps around.** Tab should move through elements in roughly the order they appear on the page. If it jumps from the header to the footer to the middle, the underlying HTML is out of order.
- **Elements that cannot be reached.** Custom dropdowns, modal dialogs, and slick image carousels frequently trap or skip keyboard users. If you cannot reach a piece of content by `Tab`, neither can someone using a screen reader.

### Why this matters beyond compliance

Roughly one in five visitors with a disability navigates by keyboard rather than mouse. The same test catches mobile bugs too — keyboard navigation is essentially how a screen reader on a phone interacts with your page.

## Test 3: Alt text audit (2 minutes)

Every image on your site has an `alt` attribute. The question is whether the attribute is doing its job or just exists to satisfy a plugin.

### Three ways alt text fails

- **Missing entirely.** Some images have no alt attribute at all. Screen readers either skip them silently or announce the filename ("hero-image-final-v3-revised.jpg").
- **Decorative without empty alt.** Background patterns, decorative dividers, and stock-photo "vibes" do not need to be described — but they need `alt=""` (an empty alt) so the screen reader skips them. No alt attribute is different from an empty one.
- **Generic or wrong alt.** "image", "photo", "picture", or the literal filename are useless. So is "alt text" (yes, we have seen it).

### How to test it in 2 minutes

In WAVE (the same extension from Test 1), missing-alt-text issues are flagged with a red icon next to the image. Click each one. WAVE shows you what the current alt says and lets you compare it against what the image actually shows.

The rule for writing alt text: describe the image **in context**. A team photo on the About page is `alt="The UI Compass team at the Arlington office"`, not `alt="team photo"`. A photo of a sample work on a portfolio page is `alt="Homepage screenshot of Davis Plumbing showing a hero with a phone number and service area map"`, not `alt="screenshot"`.

## The four fixes that close most of the gap

After running the three tests, most small business sites need the same handful of fixes.

### Fix 1: Bump contrast on body text

Most "modern, minimal" design templates ship with body text at `#999` or `#aaa` on white. Both fail AA. Move to `#4e4b66` (or your own brand body color at sufficient contrast) and the body text moves to compliant.

### Fix 2: Make focus indicators visible

Add a real focus ring to every interactive element. The simplest CSS pattern:

```css
a:focus-visible,
button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

Three lines, applies everywhere, satisfies AA.

### Fix 3: Real alt text on every image

Walk through your top 5 pages. Open each image's alt attribute. Replace generic or missing alt with a real description. For decorative-only images, set `alt=""` explicitly. Most small business sites have 20 to 40 total images; the pass takes about an hour.

### Fix 4: Use real semantic HTML

Headings in order (H1 → H2 → H3, not H1 → H4 because the designer liked the size). Lists as `<ul>` or `<ol>`, not styled divs. Buttons as `<button>`, links as `<a href>`. The fix is in your template, usually a one-time change in the developer's hands.

These four fixes resolve roughly 80 percent of the issues a WAVE scan flags on a typical small business site. The remaining 20 percent are usually edge cases that need page-specific work.

## What about overlay widgets?

The accessibility overlay industry sells widgets — AccessiBe, UserWay, accessiBe, EqualWeb — that claim to fix your site instantly with one line of JavaScript. They do not. The [National Federation of the Blind](https://www.nfb.org/) issued a formal statement against them in 2021, and businesses that install them have still been sued.

The full breakdown is in [our overlay-widget post](/blog/why-accessibility-overlay-widgets-get-sued/). The short version: do the real work in the underlying HTML and CSS. There is no shortcut that holds up in court or in user testing.

## Where we land

Every site we hand-code passes WCAG 2.2 AA at launch and as part of our quarterly maintenance reviews. The four fixes above are baked into our base templates — proper contrast, visible focus, real alt text patterns, semantic HTML. That is not heroic engineering. It is just doing the default-correct thing instead of the default-pretty thing.

If your current site is on a builder and failing the three tests above, the fix is usually a punch list — see [our redesign-or-optimize scoreboard](/blog/redesign-or-optimize-warning-signs/) for the diagnostic. We fold accessibility audits into [unlimited edits and support](/unlimited-edits-and-support/) for clients we host long-term.

## Run the tests now

Install WAVE. Open your homepage. Count the red icons.

If you see more than five, the underlying site needs structural work. If you see zero, you are in the top five percent of sites we audit.

[Send us your URL](/contact/) if you want a second pair of eyes on the WAVE report.

How many issues did your scan come back with?
