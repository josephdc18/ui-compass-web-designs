---
blogTitle: The four Search Console reports worth your time
pageName: search-console-first-90-days
titleTag: Google Search Console — The First 90 Days
blogDescription: >-
  Search Console has more than a dozen reports and most small business owners
  open it twice and never come back. Four of them tell you almost everything
  that matters: what you already rank for, what Google refused to index, which
  pages fail Core Web Vitals, and whether your sitemap is being read at all.
author: Joseph C.
date: 2026-08-07T18:16:00.000Z
topper: SEO
image: /assets/images/search-console-first-90-days-photo.jpg
imageAlt: >-
  A person working at a desktop computer with a dashboard open on the
  monitor
draft: false
tags:
  - post
  - seo
  - google
  - search-console
  - analytics
  - indexing
  - measurement
tldrTitle: Key Takeaways
tldr:
  - >-
    Verify the domain property, not the URL prefix — it covers every subdomain
    and both protocols in one place.
  - >-
    The Performance report's query table is the only free, first-party record of
    what you actually rank for. Everything else is an estimate.
  - >-
    "Crawled – currently not indexed" is a quality signal, not a bug. Google
    found the page and chose to skip it.
  - >-
    Check it monthly, not daily. Search Console data lags by two to three days
    and daily readings are mostly noise.
faq:
  - q: Do I need Google Analytics too, or is Search Console enough?
    a: >-
      They answer different questions. Search Console tells you what happens
      <em>before</em> the click — which queries showed your page, where you
      ranked, how often people clicked. Analytics tells you what happens after —
      which pages they read, whether they filled the form. If you only run one,
      run Search Console: the pre-click data has no substitute, while post-click
      behaviour on a five-page business site is usually obvious from your inbox.
      See <a href="/blog/analytics-you-will-actually-read/">the analytics setup
      we recommend</a> for the other half.
  - q: What is the difference between a domain property and a URL-prefix property?
    a: >-
      A URL-prefix property covers exactly one protocol and subdomain —
      <code>https://www.example.com/</code> and
      <code>https://example.com/</code> are two separate properties, and data
      splits between them. A domain property covers every subdomain and both
      protocols at once. Domain properties require DNS verification (a TXT
      record at your registrar), which is why people skip them, but it is the
      right choice for almost every business site. If you do not control DNS,
      see <a href="/blog/who-actually-owns-your-domain/">who actually holds your
      domain</a> before anything else.
  - q: My page says "Crawled – currently not indexed." How do I fix it?
    a: >-
      Google documents this status as a page it fetched but chose not to index,
      and its guidance is explicitly that requesting indexing again will not
      change the outcome. Treat it as feedback about the page. The usual causes
      are thin content, near-duplication with another page on your own site, or
      no internal links pointing at it. Rewrite the page so it answers something
      no other page of yours answers, link to it from a page that <em>is</em>
      indexed, and leave it alone for a few weeks.
  - q: How long before a brand-new site shows data?
    a: >-
      Impressions appear once Google has both indexed a page and shown it to
      someone, so a new site with no external links can sit at zero for weeks
      while indexing catches up. Submitting a sitemap and getting one or two
      real links from a directory or a supplier page shortens it. Search Console
      also reports on a two-to-three-day delay, so "yesterday" is never visible.
  - q: The Performance report shows impressions but almost no clicks. Is that bad?
    a: >-
      Not necessarily — it usually means you are ranking on page two or three,
      where impressions accrue and clicks do not. Sort the query table by
      impressions, filter to positions 8–20, and read the queries. Those are
      searches Google already associates with you but does not rank you well
      enough to win. They are the cheapest ranking work available, because the
      relevance is established and only the depth is missing.
  - q: Should I use the URL Inspection tool's "Request Indexing" button?
    a: >-
      For a genuinely new or genuinely changed page, once. It is a queue, not a
      command, and repeat submissions of the same URL do nothing. If you are
      publishing on a schedule, a valid sitemap plus internal links from pages
      Google already crawls does the same job automatically and does not need a
      person clicking a button.
sources:
  - label: Google Search Central — Search Console documentation
    url: https://support.google.com/webmasters/answer/9128668
  - label: Google Search Central — Build and submit a sitemap
    url: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
  - label: Google Search Central — Page Indexing report
    url: https://support.google.com/webmasters/answer/7440203
  - label: Google Search Central — Core Web Vitals report
    url: https://support.google.com/webmasters/answer/9205520
related:
  - a-page-per-suburb-for-trades
  - analytics-you-will-actually-read
  - the-content-refresh-cadence
readMins: 7
category: SEO
---

## Most of Search Console is not for you

Google Search Console ships with something like fifteen reports. A handful of them exist for enterprise sites with millions of URLs, a handful exist for developers debugging structured data, and a couple exist for problems your five-page business site will never have.

Four of them are worth a calendar reminder. Everything else you can open when something specific breaks.

The reason it matters is that Search Console is the only free source of first-party search data you will ever have. Every rank tracker, every SEO tool, every agency dashboard is estimating from a sample. Search Console is Google telling you what Google actually did.

## Set it up as a domain property

Before any report is useful, verify the right kind of property.

Search Console offers two: **URL prefix** and **domain**. A URL-prefix property covers exactly one protocol on one subdomain. That means `https://www.yourbusiness.com/` and `https://yourbusiness.com/` are, as far as Search Console is concerned, two unrelated websites with two separate sets of data. If your site redirects one to the other — and it should — you can end up staring at a property that shows almost nothing while the real traffic sits in a property you never created.

A domain property covers every subdomain and both protocols in one place. It is verified with a DNS TXT record rather than an HTML file, which is the only reason anyone chooses the other option.

If you do not know where your DNS lives, that is a bigger problem than Search Console and worth fixing first.

## Report one: Performance

This is the report you would build yourself if you could. It has four toggles across the top — clicks, impressions, average CTR, average position — and a table beneath it that can be pivoted by query, page, country, and device.

The **query table** is the whole point. It is the list of things people typed into Google that caused Google to show one of your pages. Not what you hoped to rank for. What you rank for.

Two habits get almost all the value out of it:

**Read the queries you did not plan for.** Nearly every small business site ranks for something nobody sat down and targeted — a brand name spelled wrong, a product question, a neighbourhood you mentioned once in an About page. Those are free signals about the language your customers actually use, and they cost nothing to act on. This is the same vocabulary gap that makes ["drain unclogging" outrank "residential drainage services"](/blog/a-page-per-suburb-for-trades/).

**Filter to positions 8 through 20.** Set the position filter, sort by impressions, and read the top twenty rows. Those queries are ones Google already associates with your site but does not rank you well enough to win the click. Moving a query from position 11 to position 6 is a much shorter piece of work than creating relevance from nothing, because the relevance already exists.

One caution: the Performance report is a 16-month rolling window, and it reports on a two-to-three-day lag. Reading it daily produces noise. Reading it monthly produces trend.

## Report two: Page Indexing

The Page Indexing report splits your URLs into indexed and not-indexed, and gives a reason for each exclusion. Most of the reasons are benign — redirects, canonicalised duplicates, pages you deliberately blocked. Two are worth attention.

**"Discovered – currently not indexed"** means Google knows the URL exists but has not fetched it yet. On a small site this is usually a crawl-budget non-issue that resolves itself; if it persists across dozens of URLs, the common cause is that nothing on your site links to them, so Google has no reason to prioritise the fetch.

**"Crawled – currently not indexed"** is the one people misread. Google fetched the page, looked at it, and decided not to index it. Google's own documentation is direct about this: requesting indexing again will not change the outcome. It is not a bug report. It is a quality verdict.

When we see it, the cause is almost always one of three things:

1. The page is thin — a location page with 80 words and a phone number, a service page that is a paragraph and a stock photo.
2. The page is a near-duplicate of another page on the same site, which is exactly the failure mode that [scaled location pages fall into when they are done lazily](/blog/a-page-per-suburb-for-trades/).
3. Nothing links to it internally, so it reads as an orphan.

The fix is editorial, not technical.

## Report three: Core Web Vitals

The Core Web Vitals report groups your URLs into Good, Needs Improvement, and Poor, based on field data from real Chrome users rather than a lab test.

That distinction matters more than most people realise. [PageSpeed Insights](/web-development/) runs a simulated load on a simulated device. The Core Web Vitals report in Search Console reports what happened to actual visitors on actual phones on actual connections. When the two disagree, the field data is the one Google uses.

The catch is volume: the report needs enough real traffic to form a sample. A site with a few hundred visits a month will show "not enough data" indefinitely. That is not a failure — it just means you fall back to lab tools and [a performance budget you enforce at build time](/blog/a-performance-budget-is-a-json-file/).

If you do have data and it is red, the largest single lever on most small business sites is the hero image. [Getting the LCP image right](/blog/the-lcp-image-is-the-whole-game/) usually moves the whole report.

## Report four: Sitemaps

The smallest report and the one most likely to be quietly broken.

Submit your sitemap URL once. Then check two things: that the status reads Success, and that the discovered-URL count roughly matches the number of pages you think you have.

The failure we see most often is a sitemap that was generated correctly at launch, then never regenerated — so it lists twelve pages while the site now has forty. Google is not blocked from finding the other twenty-eight, but you have removed the one signal that would have told it where to look first. The second most common failure is a sitemap listing URLs that redirect or 404, which Google will report as errors and which usually indicates a slug change that nobody propagated.

A sitemap is not a ranking factor. It is a hint about crawl priority, and on a site that publishes regularly it is a useful one.

## A realistic cadence

Here is the routine we recommend to clients, offered as an operating habit rather than an industry rule:

- **Monthly, 15 minutes.** Open Performance, set the range to the last three months, sort the query table by impressions, and read it. Note anything in positions 8–20 that you could reasonably win. Check the Page Indexing total for a sudden drop.
- **After any structural change.** New pages, changed URLs, a redesign, a platform migration — check Page Indexing and Sitemaps within two weeks. This is where a botched migration announces itself.
- **Quarterly.** Core Web Vitals, if you have enough traffic for it to report.

That is it. Search Console rewards patience and punishes daily checking, because the underlying data is both delayed and noisy at small volumes. The month-over-month shape of the query table is the signal. Tuesday versus Wednesday is not.
