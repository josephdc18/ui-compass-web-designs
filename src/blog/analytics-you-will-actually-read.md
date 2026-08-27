---
blogTitle: Six numbers beat forty dashboards
pageName: analytics-you-will-actually-read
titleTag: Simple Website Analytics for Small Businesses
blogDescription: >-
  Most small business analytics setups measure everything, weigh a hundred
  kilobytes, and get opened twice a year. The six numbers that actually change
  decisions, the events worth tracking, and how to measure without slowing the
  site you just made fast.
author: Joseph C.
date: 2026-01-26T16:36:00.000Z
topper: Performance
image: /assets/images/analytics-you-will-actually-read-card.webp
imageAlt: >-
  A cluttered analytics dashboard beside a single index card with six figures
  written on it
draft: false
tags:
  - post
  - performance
  - analytics
  - measurement
  - conversion
  - privacy
  - strategy
tldrTitle: Key Takeaways
tldr:
  - >-
    Track outcomes, not pageviews. Calls, form submissions, and direction
    requests are the only numbers tied to money.
  - >-
    Analytics scripts are the third-party weight most likely to undo your
    performance work. Measure the cost before installing.
  - >-
    Six numbers, reviewed monthly, will change more decisions than forty
    reviewed never.
  - >-
    Search Console and your analytics tool answer different questions. You want
    both, and you want them for different reasons.
faq:
  - q: Do I need Google Analytics, or is there a lighter option?
    a: >-
      It depends on whether anyone will use the depth. GA4 is free, powerful,
      and genuinely heavy — both in page weight and in the amount of interface
      between you and an answer. Privacy-focused alternatives are typically a
      fraction of the script size, need no cookie banner in many
      configurations, and present about six numbers on one screen. For a
      five-page business site where the owner is the analyst, the lighter option
      usually gets read and the heavier one usually does not.
  - q: Will an analytics script hurt my PageSpeed score?
    a: >-
      It can, and the amount varies enormously between tools. Load it with
      <code>defer</code> or <code>async</code> so it never blocks rendering,
      then measure the page with and without it. If a measurement tool costs you
      real load time on every visit, that is a trade you should make knowingly
      rather than by default — the same discipline as <a
      href="/blog/a-performance-budget-is-a-json-file/">a performance
      budget</a>.
  - q: Do I need a cookie banner?
    a: >-
      It depends on what your tool stores and where your visitors are. Tools
      that set identifying cookies generally require consent for EU and UK
      visitors; several analytics tools are designed specifically to avoid
      cookies and personal identifiers so that no banner is needed. This is a
      legal question with jurisdictional answers, so treat the above as
      background and get advice for your situation rather than copying whatever
      a competitor did.
  - q: What is a good conversion rate for a small business site?
    a: >-
      There is no honest single answer, and anyone quoting one is averaging
      across industries that have nothing in common. An emergency plumber and a
      commercial architecture firm should not have similar rates and it would be
      worrying if they did. The useful benchmark is your own site last quarter.
      Measure the change, not the absolute.
  - q: How do I track phone calls from the website?
    a: >-
      The cheap version is an event on every <code>tel:</code> link tap, which
      tells you intent to call but not whether the call connected. The thorough
      version is call tracking with a dedicated number, which tells you what
      actually happened but introduces a second phone number — and a phone
      number that differs from the one in your listings is exactly the <a
      href="/blog/nap-consistency-four-phone-formats/">NAP consistency
      problem</a> you spent time avoiding. Start with the link event.
  - q: Should I look at bounce rate?
    a: >-
      Rarely, and never on its own. A visitor who lands on your contact page,
      reads your hours, and taps to call is recorded by many setups as a bounce
      and is in fact your best outcome of the day. If you are going to watch one
      engagement figure, watch whether people reach the pages that lead to
      contact.
sources:
  - label: Google Analytics — GA4 developer documentation
    url: https://developers.google.com/analytics/devguides/collection/ga4
  - label: web.dev — Web Vitals
    url: https://web.dev/articles/vitals
  - label: MDN — Performance API
    url: https://developer.mozilla.org/en-US/docs/Web/API/Performance_API
related:
  - search-console-first-90-days
  - a-performance-budget-is-a-json-file
  - the-contact-form-audit
readMins: 7
category: Performance
---

## The dashboard nobody opens

Almost every small business site we take over has analytics installed. Almost none of them have analytics that anyone reads.

The pattern is consistent. Someone set it up at launch. It collects everything. It has twenty-four reports, four of which are about audience demographics that are largely inferred, and none of which answer the question the owner actually has, which is: *is this website getting me work?*

So it gets opened when a marketing company asks about it, and otherwise never.

That is not a discipline failure. It is a design failure. A tool that requires forty minutes and a mental model of event parameters to answer a one-sentence question will not get used by someone whose actual job is running a business.

## Two tools, two questions

Before the numbers, the split that clears up most confusion:

**[Search Console](/blog/search-console-first-90-days/) tells you what happens before the click.** Which queries showed your pages, where you ranked, how often people clicked through. Google's own record of Google's own behaviour. There is no substitute for it and it is free.

**Analytics tells you what happens after the click.** Which pages they read, how they moved, whether they did the thing you wanted.

People install the second and skip the first, which is backwards for most small businesses — the pre-click data is scarcer and harder to reconstruct. Install both. Read them for different reasons.

## The six numbers

Here is the set we put on a one-page monthly review for clients. It is not exhaustive, and it is deliberately not exhaustive.

### 1. Contact events

Form submissions, `tel:` link taps, and direction requests, added together.

This is the number. Everything else on this list exists to explain movements in this one. If it goes up and nothing else does, the site is working. If it goes down while traffic goes up, something in the path to contact broke.

Count intent, not just completion — a `tel:` tap is a person choosing to call you, even if you cannot see whether the call connected.

### 2. Contact rate

Contact events divided by sessions, as a percentage.

Rate matters more than raw count because it separates two different problems. Falling traffic with a stable rate is a visibility problem — an [SEO](/search-engine-optimisation/) or listings problem. Stable traffic with a falling rate is a site problem — something about the page stopped persuading people, or stopped working. Those get fixed in completely different places.

Do not compare your rate to an industry benchmark. Compare it to your own last quarter.

### 3. Sessions, split by channel

One number with four rough buckets: organic search, direct, referral, social.

You do not need per-source detail. You need to know whether the growth came from search (durable, compounding), from a one-off referral (nice, temporary), or from a post that did well (nice, extremely temporary). That distinction should change what you do next, and it usually does not get made because the report is too granular to read.

### 4. Top five landing pages

Not top pages — top **landing** pages. The page people arrived on.

This is consistently the most surprising number for owners. A great many small business sites get most of their search entries on a page nobody thought of as important: one service page, one location page, one blog post from three years ago. If a page is bringing people in, it deserves [a proper headline](/blog/the-twelve-word-headline-test/), a clear next step, and a place in your refresh rotation.

### 5. Mobile share

The percentage of sessions on a phone.

You need this figure because it decides where your attention goes. It is not the same for every business — a B2B supplier serving office workers and a taco shop have very different splits — and using someone else's number as a proxy for your own is how sites end up [designed on a monitor for an audience on a phone](/blog/designed-on-a-monitor-used-on-a-phone/).

### 6. Core Web Vitals from real users

LCP, INP and CLS as experienced by actual visitors, not a lab simulation.

Search Console reports this if you have enough traffic. If you do not, you can collect it yourself with a small script using the browser's own Performance API, or you can fall back to lab tools. Field data is the version that counts, because it includes the visitor on a five-year-old Android on a weak connection — the visitor a lab test on a simulated device never quite represents.

## The events worth defining

Most analytics tools track pageviews automatically and everything else on request. For a small business site, four custom events cover it:

- **`contact_submit`** — a successful form submission. Fire it on the confirmation, not on the button click, or you will count failures as successes.
- **`call_click`** — a tap on any `tel:` link. Include which page it happened on.
- **`directions_click`** — a tap on a map or address link.
- **`quote_start`** — if you have a multi-step form or a booking flow, an event when someone begins it. Paired with `contact_submit`, this gives you an abandonment rate, which is the only reliable way to find out whether [your form is asking for too much](/blog/booking-friction-form-calendar-phone/).

That is four events. Not forty. Every event you define is something you have to maintain, and unmaintained events go quietly wrong — a class name changes in a redesign, the listener stops firing, and six months of data are missing before anyone notices.

## Measure the measurement

An analytics script is a third-party resource on every page. It has a size, an execution cost, and, usually, a DNS lookup and a TLS handshake to a domain that is not yours.

Two habits keep it honest:

**Load it deferred.** `defer` or `async`, always, so it cannot block rendering. There is no version of analytics that is important enough to delay your content.

**Test the page with and without it.** Run your homepage through a lab tool twice — once as shipped, once with the analytics script removed. The difference is what measurement costs you, on every visit, forever. Some tools cost almost nothing. Some cost a surprising amount, particularly the ones bundled with tag managers that then load four more things.

Knowing the number does not mean you must remove it. It means you are making the trade deliberately, which is the whole point of [treating page weight as a budget](/blog/a-performance-budget-is-a-json-file/) rather than an accident.

## A review that takes fifteen minutes

Once a month:

1. Open the six numbers. Write them down next to last month's.
2. Ask one question of each direction of change: what would explain that?
3. Open Search Console's query table, sorted by impressions, and read the first twenty rows.
4. Pick one thing to change. One.

That last step is the part that makes the rest worth doing. Analytics that never leads to a change in the site is a hobby. The value is not in the measuring, it is in the fact that next month you will find out whether the change worked — which requires that you only changed one thing.
