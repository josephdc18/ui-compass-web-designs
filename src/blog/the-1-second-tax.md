---
pageName: the-1-second-tax
blogTitle: The 7% Conversion Tax of a 1-Second Delay
titleTag: The 1-Second Tax
blogDescription: A one-second delay in load time costs you about 7% of your conversions. Multiply that by your monthly leads and you are looking at the real cost of a slow site. Where the delay actually comes from, and how to read your PageSpeed score without panicking.
author: "Joseph C."
date: 2026-02-27T16:00:00.000Z
tags:
  - post
  - performance
category: "Performance"
readMins: 5
topper: "Performance"
image: /assets/images/the-1-second-tax-card.png
imageAlt: A speedometer overlaid on a laptop displaying a website with a slow loading indicator
tldrTitle: What you need to know
tldr:
  - 'A one-second delay in load time costs roughly **7% of your conversions**. On a site that gets 30 leads a month, that is about **2 leads lost per second of delay**, every month.'
  - 'PageSpeed score buckets: **0–49 fails, 50–89 fixable, 90–100 acceptable**. Most builder sites land in the 50s on mobile, where most of your traffic actually is.'
  - 'Three Core Web Vitals do most of the work: **LCP under 2.5s, CLS under 0.1, INP under 200ms**. INP replaced FID in March 2024.'
  - 'Hosting decides your **ceiling**. Site code decides your **floor**. You need both right to break 90.'
faq:
  - q: 'Is a 90 score good enough?'
    a: 'For most small business sites, yes. Above 90, Google does not penalize you in rankings, and the user-experience curve flattens out. Going from 90 to 100 is real polish but rarely a revenue win. Going from 60 to 90 usually is. Spend your time on the bigger gap first.'
  - q: 'Why does my desktop score look fine but mobile fails?'
    a: 'Mobile is the harder test because the network is slower (4G/5G with packet loss vs. office fiber) and the device is weaker (smartphone CPU vs. laptop). The same JavaScript bundle that finishes parsing in 200ms on desktop takes 800ms on a mid-range phone. Mobile is also where roughly half your traffic is, so it is the score that matters for revenue.'
  - q: 'Can I just buy faster hosting and call it done?'
    a: 'Faster hosting raises your ceiling but does not lower the work the page is doing. A 5MB WordPress page on premium hosting still has to ship 5MB. Hosting changes Time to First Byte. Site code changes everything after that. <a href="/blog/redesign-or-optimize-warning-signs/">The redesign-or-optimize scoreboard</a> helps decide whether to fix the code or rebuild on a better foundation.'
  - q: 'What is the easiest single fix that moves the score most?'
    a: 'Image optimization. A typical builder site has uncompressed photos delivered at desktop dimensions to phones. Resizing the hero image to actual phone resolution and compressing it (WebP or AVIF format) often moves a 60 score to a 78. The second-easiest is removing unused JavaScript. Both are punch-list work, not redesigns.'
  - q: 'How often should I re-test my PageSpeed score?'
    a: 'Monthly is enough for most small business sites. After any significant change (new images, new plugins, theme updates, content swaps), re-test the affected pages within a week. Plugin updates on WordPress are the most common silent regressor — a plugin you installed two years ago can ship a new bundle that drops your score 15 points overnight.'
  - q: 'What is the fastest way to drop my score by 20 points without realizing it?'
    a: 'Three: install a chat widget that loads on every page, embed a third-party video player above the fold, or upload a 4MB hero image straight from a phone camera. Any of those alone can move you from 90 to 70 on mobile. We see all three regularly during audits.'
  - q: 'My site scores 95 but is not getting leads. What gives?'
    a: 'Speed is necessary, not sufficient. A fast page that confuses the visitor still bounces. The pattern we audit for next is the homepage architecture — see <a href="/blog/the-seven-homepage-sections/">the seven sections every small business homepage needs</a> for what should actually be on the page once it is fast.'
related:
  - url: /blog/designed-on-a-monitor-used-on-a-phone/
    title: 'Designed on a 27-inch Monitor. Used on a 6-inch Phone.'
  - url: /blog/redesign-or-optimize-warning-signs/
    title: 'Redesign or Optimize? The 7 Warning Signs That Decide'
  - url: /blog/the-seven-homepage-sections/
    title: 'The Seven Sections Every Small Business Homepage Needs, In Order'
---

A one-second delay in your homepage load time costs you about 7% of your conversions.

Most small business owners do not believe that number on the first read. So do the math out loud. If you get thirty contact-form submissions a month and your site loads at four seconds instead of three, you are leaving roughly two leads a month on the table. At a year, that is two dozen. At your average lead value, that is the design budget for your next site, paid in lost revenue every twelve months.

The 7% number is the average across the last decade of ecommerce and lead-gen studies. The exact figure for your business will be higher or lower. The direction is not in dispute.

## Where the second goes

A typical small business homepage on a builder platform spends its first second doing things that do not deliver any visible content.

### The first 200 milliseconds: connection setup

<span class="tooltip-term" data-tooltip="The cryptographic negotiation that happens before an HTTPS connection can transmit data. Adds ~100ms on average.">TLS handshake</span> and <span class="tooltip-term" data-tooltip="The address-book lookup that translates a domain name into an IP address before any HTTP request can be made.">DNS lookup</span> take roughly 200ms before a single byte of your page is requested. There is not much you can do about this — it is the price of using HTTPS, which is non-negotiable in 2026. The fix is to make sure nothing else gets added to it.

### The next 400 milliseconds: bundle download

A 200KB JavaScript bundle that bootstraps the page. On a fast laptop, that downloads and parses in 100ms. On a mid-range phone over a 4G connection, it can take 400ms. This is where most of the speed gap shows up between desktop and mobile scores.

### The last 200 milliseconds: assembly

The bundle assembles the layout from your CMS data. Another 200ms.

You are now a second in. Your visitor has seen the favicon and a flash of the page background. They have not seen your headline yet.

### Compare that to a hand-coded page

A hand-coded page with the HTML pre-baked at build time uses the same first second to load the headline, the hero image, the call-to-action, and the first service card. The browser is not waiting on JavaScript to render content. It is just rendering content.

That is most of the load-speed gap. Not magic. Not premium hosting. Just less work for the browser to do. The same advantage is why [we recommend hand-coded over page builders](/blog/comparing-local-dfw-web-design-companies/) for small business sites.

## How to read your PageSpeed score without panicking

Run your homepage through Google's [PageSpeed Insights](https://pagespeed.web.dev/) and you get a score between 0 and 100, mobile and desktop scored separately. The score is a weighted combination of <span class="tooltip-term" data-tooltip="Three user-experience metrics Google uses to score real-world page performance: LCP, CLS, and INP.">Core Web Vitals</span> plus a handful of best-practice checks.

### The four buckets to know

- **0 to 49: failing.** Google counts this as a poor experience and weighs it against you in search rankings. Most builder sites land here on mobile.
- **50 to 89: fixable.** Real problems but not catastrophic. A focused optimization pass usually moves a site in this range up twenty to thirty points in a day.
- **90 to 100: acceptable.** You are not penalized. Above 95, you are competitive on speed against any site in your market.
- **Mobile vs desktop.** Mobile scores almost always trail desktop scores. Mobile is the harder test because the network is slower and the device is weaker. Mobile is also where [roughly half your traffic actually is](/blog/designed-on-a-monitor-used-on-a-phone/), so it is the score that matters for revenue.

## The three numbers Google grades you on

Underneath the score, three Core Web Vitals do most of the work.

### LCP: Largest Contentful Paint

<span class="tooltip-term" data-tooltip="Largest Contentful Paint. The time from page request to when the biggest visible thing on the page renders. Hero images are usually the LCP element.">LCP</span> measures how long until the biggest visible thing on the page renders. Target: under 2.5 seconds. The biggest LCP wins are usually image right-sizing and removing render-blocking JavaScript.

### CLS: Cumulative Layout Shift

<span class="tooltip-term" data-tooltip="Cumulative Layout Shift. How much the page jumps around as it loads. Caused by images without dimensions, web fonts swapping, or late-loading ads.">CLS</span> measures how much the page jumps around as it loads. Target: under 0.1. The biggest CLS wins are setting explicit width/height on every image, reserving space for embeds, and pre-loading the web font your headline uses.

### INP: Interaction to Next Paint

<span class="tooltip-term" data-tooltip="Interaction to Next Paint. How long the page takes to respond to a tap or click. Replaced FID in March 2024 — measures every interaction, not just the first.">INP</span> measures how long the page takes to respond to a tap or click. Target: under 200 milliseconds.

INP replaced First Input Delay (FID) in March 2024. If you are reading older guides that mention FID, ignore them. INP is the metric Google now uses, and it grades the responsiveness of every interaction on the page, not just the first one.

The fastest way to fix all three at once is to ship less JavaScript. The second-fastest way is to right-size your images. Most small business sites can move from a 60 to a 95 score by addressing those two things alone.

## What hosting actually decides

Builder sites blame their hosting for the score. Sometimes that is even true.

### Shared vs edge-served, in numbers

A shared host serving a 5MB WordPress page from a single data center to a phone in another state can take 1.2 seconds just to start the response. An <span class="tooltip-term" data-tooltip="Hosting that serves your site from a network of nodes geographically close to each visitor (a CDN), instead of from a single origin server.">edge-served</span> static site delivers the first byte in 30 milliseconds, from a node geographically close to the visitor. That delta alone is the difference between a 60 and a 95 score on most sites.

This is where the [hosting and domains](/hosting-and-domains/) conversation starts. Hosting decides your ceiling. The site code decides your floor. You need both to be right to break 90.

## What the score does not measure

Two things the score will not catch.

### Form delivery

A site can score 100 and still fail to deliver contact-form submissions to your inbox. The PageSpeed Insights tool does not test that. We have audited sites at 95 that were silently dropping leads to spam folders for six months. Run a [test submission to your own form](/contact/) every quarter — it is the cheapest insurance you have.

### Reading and conversion

A page can score 100 and still confuse the visitor. Speed is necessary, not sufficient. The order in which sections appear, the clarity of the call-to-action, the trust signals on the homepage, all of those decide whether the fast page also converts. The pattern we audit for is in [the seven sections every small business homepage needs](/blog/the-seven-homepage-sections/).

A 95 score on a confusing page is a fast trip to a bounce.

## Where we land

We hand-code every site we ship and run PageSpeed Insights as part of every build. The score we hold against ourselves is 98 to 100 on mobile, on every page, every time. That number is not for marketing. It is what the site has to be to give you the floor on the conversion math at the top of this post.

If your current site is scoring under 80 and you are running ads to it, you are paying twice. Once to get the click, again in the bounce. The same case is in our pricing logic — see [our $150/month plan](/pricing/) for what continuous performance work looks like budgeted into a small business operating cost.

## Run your number

Open [pagespeed.web.dev](https://pagespeed.web.dev/) and paste your homepage URL. Wait the thirty seconds. Look at the mobile score and the LCP number underneath it.

If your score is under 80, you are likely sitting on [more than one warning sign from the redesign scoreboard](/blog/redesign-or-optimize-warning-signs/) too.

If you want a second pair of eyes on the numbers and a punch list of what to fix, [send us the URL](/contact/).

What did your mobile score come back as?
