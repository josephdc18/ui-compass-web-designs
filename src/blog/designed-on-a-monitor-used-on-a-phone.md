---
pageName: designed-on-a-monitor-used-on-a-phone
blogTitle: Designed on a 27-inch Monitor. Used on a 6-inch Phone.
titleTag: Designed on a Monitor, Used on a Phone
blogDescription: Sixty percent of your visitors are on a phone, but most small business sites are still designed desktop-first. The case for starting at 320 pixels, the five breakpoints we ship on every build, and what page builders get wrong about responsive.
author: "Joseph C."
date: 2026-04-17T16:00:00.000Z
tags:
  - post
  - performance
category: "Performance"
readMins: 5
topper: "Performance"
image: /assets/images/designed-on-a-monitor-used-on-a-phone-card.png
imageAlt: A 27-inch monitor next to a small smartphone showing the same website rendered at very different sizes
tldrTitle: Key Takeaways
tldr:
  - 'Roughly **60% of small business traffic is on mobile**, but most builder sites are still designed at 27-inch monitor size and "shrunk" for phones.'
  - '**Mobile-first** means writing the 320-pixel layout first and adding desktop on top. The opposite (desktop-first with `max-width` queries) is what most builders ship and what most mobile bugs come from.'
  - 'Five breakpoints cover every device worth designing for: **400, 568, 768, 1024, 1300 pixels**. Anything more is micro-tuning for devices that do not exist.'
  - 'Most layout problems on a small business site are **container problems** — content stretching edge to edge or jamming together. One CSS rule per section fixes it.'
faq:
  - q: 'What is wrong with designing desktop-first?'
    a: 'Each desktop-first breakpoint is a decision about what to take away. Three columns at 1280 need to become two at 1024, one at 768, and a different one at 400. Every removal is a chance to introduce a bug. Mobile-first goes the other direction — decisions get added rather than removed, so the mobile layout is never broken because you never broke it.'
  - q: 'Do I really need to design at 320 pixels? Nobody uses an iPhone 5SE anymore.'
    a: 'Older customers, overseas visitors, and accessibility users running 200% browser zoom all collapse to roughly 320-pixel viewports. The same layout that works at 320 also works on a tablet rotated to portrait with a sidebar open, which is more common than people think. Designing for 320 is the discipline. The actual visitors at 320 are a smaller bonus.'
  - q: 'How do I test on actual phones (not just browser dev tools)?'
    a: 'Three options. <strong>Free</strong>: borrow phones from family or coworkers and load the site over their cellular data, not your office Wi-Fi. <strong>Cheap</strong>: <a href="https://www.browserstack.com/">BrowserStack</a> or <a href="https://www.lambdatest.com/">LambdaTest</a> give you 100+ real devices on demand for $20–40/month. <strong>What we use on every build</strong>: a small device library (3 phones, 1 tablet) plus BrowserStack for edge cases. The <a href="/blog/the-1-second-tax/">PageSpeed scores</a> Google grades you on are run on a simulated mid-range Android, so testing on a flagship iPhone alone is misleading.'
  - q: 'Are five breakpoints enough for every site?'
    a: 'For a small business site, yes. We have shipped well over a hundred sites on the same five breakpoints. The cases that need more are rare: complex web apps with dense data tables, e-commerce sites with very tight product grid requirements, or sites that need to support specific tablet form factors (kiosks, in-vehicle displays). For a homepage, services pages, blog, and contact form, five is plenty.'
  - q: 'What if my customers are mostly desktop users? Do I still need mobile-first?'
    a: 'Yes, for two reasons. First, "mostly desktop" usually means 70/30, not 95/5 — the 30% is still real money. Second, Google indexes your site mobile-first regardless of who visits. A site that fails on mobile fails in <a href="/search-engine-optimisation/">SEO</a> too, even if no actual customer ever loads it on a phone. The mobile experience is doing both jobs whether you notice or not.'
  - q: 'Can I fix mobile-first on my existing builder site?'
    a: 'Partially. You can usually customize the mobile layout, override default breakpoints, and resize images for phones. What you cannot do is change the underlying CSS architecture — the builder generates desktop-first stylesheets, and your overrides fight that on every page. If your mobile experience has more than two of the warning signs in <a href="/blog/redesign-or-optimize-warning-signs/">our redesign scoreboard</a>, the right answer is usually a rebuild.'
  - q: 'Why does my mobile layout break specifically between phone and tablet (around 600–768 pixels)?'
    a: 'That range is where most "responsive" templates collapse. Mobile rules apply, desktop rules apply, but neither was written for the in-between. Page builders often jam an "iPad portrait" view in there as an afterthought. Hand-coded sites with the five breakpoints we use treat 568 and 768 as named transition points, so the layout is intentional at every width.'
related:
  - url: /blog/the-1-second-tax/
    title: 'The 7% Conversion Tax of a 1-Second Delay'
  - url: /blog/the-seven-homepage-sections/
    title: 'The Seven Sections Every Small Business Homepage Needs, In Order'
  - url: /blog/redesign-or-optimize-warning-signs/
    title: 'Redesign or Optimize? The 7 Warning Signs That Decide'
---

Sixty percent of the people visiting your website right now are doing it from a phone. Most small business sites are still designed on a 27-inch monitor.

That gap is not a styling problem. It is a structural one. A site designed at desktop size and then "made responsive" is a different product from a site designed at phone size and then expanded up. The first one usually breaks somewhere between 400 pixels and 768 pixels. The second one almost never does.

This post is the case for the second one.

## What mobile-first actually means

Mobile-first does not mean the mobile version comes out first. It means the mobile layout is what the developer writes first. The desktop layout is built on top of it, not the other way around.

In CSS terms, the difference is whether your <span class="tooltip-term" data-tooltip="A CSS rule that applies styles only when the browser viewport meets a condition (e.g., min-width: 768px). The mechanism behind every responsive layout.">media queries</span> use `min-width` or `max-width`. A mobile-first stylesheet starts with the bare layout for a phone and uses `min-width` queries to add the layouts for tablet, laptop, and desktop. A desktop-first stylesheet does the opposite. It writes a desktop layout and uses `max-width` queries to strip it down for smaller screens.

### Why both technically work but only one scales

Both can technically work. One of them produces sites that always look right on the device the visitor is actually holding. The other produces sites that work on the device the designer was looking at. The same logic is why <span class="tooltip-term" data-tooltip="Code written by hand in HTML, CSS, and JavaScript with no page builder or CMS abstraction layer in the way.">hand-coded</span> sites tend to feel right on phones in a way builder sites usually do not — the architecture is built bottom-up.

## Why mobile-first is actually easier

The pitch most developers hate to admit out loud: writing the mobile layout first is just easier.

### One-column layouts are mostly already designed

A 320-pixel screen has almost no decisions in it. There is one column. Headlines are big. Buttons are wide. Images stretch to the edge. You write the content in the order it should appear and let it stack.

Then, as the screen gets wider, you decide where to add the second column, where to use a horizontal layout, where to make the headline larger. Each <span class="tooltip-term" data-tooltip="A specific viewport width where your layout changes. Usually defined as `min-width` values that add new layout rules as the screen gets wider.">breakpoint</span> adds a single decision on top of the last one. The mobile layout is never broken because you never broke it.

### Desktop-first removes things at every breakpoint

The desktop-first version goes the opposite direction. Three columns at 1280 pixels need to become two at 1024, one at 768, and a different one at 400. Every breakpoint is a decision about what to take away. And every decision is a chance to introduce a bug that did not exist on the device the designer tested.

The math favors mobile-first. Decisions get added rather than removed. New content slots into existing rules instead of breaking them.

## The starting point

The smallest realistic screen we still design for is 320 pixels wide. That number is the iPhone 5SE, which is still in active use by enough people to matter, particularly older customers and overseas visitors. If your site renders correctly at 320 pixels, it renders correctly on every phone shipping in 2026.

The mobile design at 320 is the discipline. Anything that does not fit at 320 should not be there. Long marketing headlines. Two-line nav menus. Buttons that need precise tapping. They are all the same problem, and they all have the same fix at the same starting point.

## The five breakpoints we use on every build

We do not add breakpoints because the design "needs one." We use the same five on every site we ship. They cover the range of devices that exist and resist the temptation to micro-tune for an iPad in landscape mode that nobody is actually visiting your site on.

### 400 pixels

The phone-to-phablet transition. Body text gets a touch more generous, hero images can breathe slightly.

### 568 pixels

Larger phones in landscape mode and small tablets in portrait.

### 768 pixels

The first real two-column layout. Tablets and the smallest laptops.

### 1024 pixels

Standard tablet landscape and entry-level laptops. The point where the navigation can spread out and most pages can fit a third column if they want one.

### 1300 pixels

Standard desktop. The hero gets its full real estate and content gets a max-width cap so it does not stretch into unreadable line lengths on a 32-inch monitor.

Five breakpoints, hand-picked. Page builder sites we audit routinely have eight or twelve, most of them set automatically by the platform and overlapping each other in ways that nobody can explain.

## What containers actually do

Most layout problems on a small business site are container problems.

### The three-rule pattern

A <span class="tooltip-term" data-tooltip="A wrapper element that controls the maximum width and centering of a section's content. Usually full width with a max-width cap and `margin: 0 auto`.">container</span> is a wrapper around your content with three rules: full width, a <span class="tooltip-term" data-tooltip="A CSS property that prevents an element from getting wider than a specified value, no matter how much space is available.">max-width</span> cap, and `margin: 0 auto` to center it. That is the entire pattern. Apply it to every section and the page will look right on every screen.

Without it, content stretches edge to edge on big monitors and feels uncomfortable to read. With it, the same content reads well at 320 pixels and at 1900. The fix takes one CSS rule per page section.

### What it looks like in practice

This is not theoretical. Open any builder template and look for a section where the body text on desktop runs past 90 characters per line. That is the missing container. Fixing it is a one-day improvement on most sites we audit.

The same container rule is part of why our [seven-section homepage layout](/blog/the-seven-homepage-sections/) reads well at every width — every section is wrapped in the same pattern.

## Where the builders get this wrong

Most page builders default to a desktop-first layout because the designer is editing on a desktop. The mobile view is then "automatically generated," which is a polite way of saying "shrunken until it fits."

The result is a mobile experience that has all the same elements as the desktop version, but in the wrong sizes, the wrong order, and with the wrong amount of breathing room. Three CTAs above the fold on desktop become three tiny CTAs stacked on a phone, none of them tappable without zooming.

You can fix this on a builder. It just takes more work than starting from a mobile-first hand-coded base, because every fix is fighting the platform's defaults instead of building on them. The same logic applies to [PageSpeed scores](/blog/the-1-second-tax/) — builder defaults work against you on both mobile layout and load time.

## Where we land

We hand-code every site mobile-first. The 320-pixel layout is the first thing in the stylesheet. Every desktop layout is a layer on top of it. That is not a marketing position. It is the structural reason our sites do not break between phone and desktop.

If your current site looks great on the proposal screenshot but feels off on the phone you are reading this on, that gap is what we just described. It is fixable. Sometimes by a focused redesign of the mobile layout. Sometimes by a full rebuild on a base that is not fighting you. The decision tree for that call is in [our redesign-or-optimize scoreboard](/blog/redesign-or-optimize-warning-signs/).

We deliver this as part of every [web design](/web-design/) and [web development](/web-development/) build, and our [pricing](/pricing/) folds the ongoing mobile-layout maintenance into the same monthly fee as everything else.

## Look at your own site right now

Open your site on the phone you are holding. Tap the top button. Try to fill out the contact form. Read a paragraph of body copy without zooming.

If any of that felt off, the gap between the desktop your site was designed on and the phone your visitors are using is showing.

If you want a fix without a rebuild, [send us your URL](/contact/) and we will tell you whether the mobile layout is salvageable.

What broke first?
