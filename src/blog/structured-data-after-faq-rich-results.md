---
blogTitle: Structured data still matters — just not the kind you were sold
pageName: structured-data-after-faq-rich-results
titleTag: Structured Data for Small Business Sites
blogDescription: >-
  Google retired FAQ rich results in 2026 and a lot of small business sites lost
  the only structured data they had. The markup that still earns something —
  LocalBusiness, Breadcrumb, Product, Review — plus the honest version of what
  schema does and does not do for ranking.
author: Joseph C.
date: 2026-02-05T16:00:00.000Z
topper: SEO
image: /assets/images/structured-data-after-faq-rich-results-card.png
imageAlt: >-
  A search result listing with a breadcrumb trail, star rating, and business
  hours pulled out as labelled blocks
draft: false
tags:
  - post
  - seo
  - schema
  - structured-data
  - google
  - local
  - markup
tldrTitle: Key Takeaways
tldr:
  - >-
    FAQ rich results are gone from Google Search. FAQPage markup is still valid
    schema — it just no longer buys you a visual result.
  - >-
    LocalBusiness and Breadcrumb are the two types nearly every small business
    site should have and most do not.
  - >-
    Structured data is not a ranking factor. It changes how a result is
    displayed, which changes click-through, which is a different thing.
  - >-
    Markup that contradicts the visible page is a policy violation, not a
    shortcut.
faq:
  - q: Should I delete my FAQPage markup now that the rich result is gone?
    a: >-
      No — but stop expecting anything from it in Google Search. FAQPage is
      still valid schema.org vocabulary, and it is still read by things that are
      not Google Search: assistants, aggregators, and increasingly the systems
      behind AI answers. Leaving it in costs you a few hundred bytes. What you
      should delete is the <em>expectation</em>, and any page structure that was
      contorted to farm the old result. See <a
      href="/blog/faq-schema-3x-screen-space/">our earlier post on FAQ
      markup</a>, which was written when the rich result still existed.
  - q: Does structured data improve my rankings?
    a: >-
      Not directly, and anyone who tells you otherwise is selling something.
      Google's own documentation frames structured data as a way to make a page
      eligible for particular <em>appearance</em> features in search results.
      The indirect effect is real but secondary: a result with a breadcrumb
      trail, a star rating, or opening hours takes more vertical space and
      communicates more before the click, so it tends to earn a higher
      click-through rate at the same position.
  - q: JSON-LD, Microdata, or RDFa?
    a: >-
      JSON-LD, in a script tag in the head or body. Google recommends it, it
      lives in one block instead of being threaded through your HTML attributes,
      and it can be edited without touching the markup a designer is working on.
      Microdata is not wrong, it is just harder to maintain — a change to the
      layout can silently break the entity nesting.
  - q: Can I mark up a review score I collected myself?
    a: >-
      Only under fairly narrow conditions, and this is where sites get manual
      actions. Google's review snippet policy requires that the rating be
      visible on the page, that it be about the specific item the page is about,
      and — critically — that a business not mark up reviews of <em>itself</em>
      as self-serving aggregate ratings. Third-party review platforms and
      product pages are the safe cases. Your homepage announcing "4.9 stars" in
      schema, with no visible reviews, is the unsafe one.
  - q: What is the minimum useful set for a five-page local business site?
    a: >-
      Three things. One <code>LocalBusiness</code> (or a more specific subtype
      like <code>Plumber</code> or <code>HairSalon</code>) block on the homepage
      with your name, address, phone, URL, and hours. <code>BreadcrumbList</code>
      on every page below the homepage. <code>Organization</code> with your logo
      so Google has a canonical mark to pull. That is maybe 40 lines of JSON-LD
      total and it covers the cases that actually render.
  - q: How do I check my markup is working?
    a: >-
      Two tools, and they answer different questions. The Rich Results Test
      tells you whether Google can parse the markup and which appearance
      features the page is eligible for. The Schema Markup Validator at
      validator.schema.org tells you whether the markup is valid schema.org
      vocabulary regardless of what Google supports. Use the first for "will
      this show up," the second for "is this correct." Then confirm it in the
      wild through <a href="/blog/search-console-first-90-days/">Search
      Console</a>, which reports what Google actually saw on your live pages.
sources:
  - label: Google Search Central — Intro to how structured data works
    url: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
  - label: Google Search Central — Local business structured data
    url: https://developers.google.com/search/docs/appearance/structured-data/local-business
  - label: Google Search Central — Breadcrumb structured data
    url: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
  - label: Google Search Central — Review snippet structured data
    url: https://developers.google.com/search/docs/appearance/structured-data/review-snippet
  - label: Schema.org — LocalBusiness
    url: https://schema.org/LocalBusiness
related:
  - faq-schema-3x-screen-space
  - search-console-first-90-days
  - nine-gbp-secondary-categories
readMins: 8
category: SEO
---

## The thing a lot of sites were doing stopped working

For several years, the single most common piece of structured data on small business websites was FAQPage markup. It was easy to add, most CMSs had a plugin for it, and it produced a visible reward: an expandable list of questions under your search result, taking up two or three times the vertical space of the listing next to it.

In 2026 Google retired the FAQ rich result from Search, and later removed the documentation for it. A lot of sites woke up with markup that validates perfectly and does nothing.

The reasonable reaction is not "schema was a scam." It is to understand what structured data was ever actually doing, and to put the effort where it still pays.

## What structured data actually is

Structured data is a machine-readable description of what a page is about, written alongside the human-readable page. It does not change what a visitor sees. It tells a parser: this string is a phone number, this one is a price, this block is an address, these things are the same entity.

Google's documentation is consistent and unglamorous about the payoff. Structured data makes a page **eligible** for specific appearance features in search results. It is not described as a ranking signal, and treating it as one leads to the kind of markup-stuffing that earns manual actions rather than traffic.

The indirect benefit is real, though, and it is worth naming precisely: a result that renders with a breadcrumb trail, a star rating, an image, or opening hours occupies more of the screen and answers more before the click. At the same rank, that result gets clicked more. You have not moved up. You have gotten bigger.

## The four types that still earn something

### LocalBusiness

If you have one piece of structured data, make it this one. It is a machine-readable statement of your name, address, phone, hours, and service area — the same entity data that Google is also reading from your Google Business Profile, your citations, and the footer of every page on your site.

The value is corroboration. Google is trying to decide whether the business in your GBP listing, the business in a directory citation, and the business on your website are the same business. Every consistent, unambiguous signal makes that easier. This is the same argument as [keeping your NAP identical everywhere](/blog/nap-consistency-four-phone-formats/), just expressed in JSON instead of in your footer.

Use the most specific subtype schema.org offers. `Plumber`, `HairSalon`, `Electrician`, `HVACBusiness`, `RoofingContractor`, `Dentist` and dozens of others exist as subtypes of `LocalBusiness`. A specific type is a stronger statement than a generic one.

```json
{
  "@context": "https://schema.org",
  "@type": "Plumber",
  "name": "Example Plumbing",
  "url": "https://example.com/",
  "telephone": "+1-214-555-0142",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "1200 Main St Suite 4",
    "addressLocality": "Plano",
    "addressRegion": "TX",
    "postalCode": "75074",
    "addressCountry": "US"
  },
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
    "opens": "07:30",
    "closes": "17:00"
  }],
  "areaServed": ["Plano","Frisco","Allen","McKinney"]
}
```

One rule governs all of it: **the markup has to agree with the page.** If the JSON says you open at 7:30 and the footer says 8:00, you have not gained a signal, you have introduced a contradiction. Google's structured data guidelines treat markup that misrepresents the visible content as a policy violation.

### BreadcrumbList

The most under-used markup on small business sites, and the cheapest to add.

Breadcrumb markup replaces the raw URL line in a search result with a readable path — `Example Plumbing › Services › Water Heaters` instead of `example.com/services/water-heaters/`. It renders reliably, it costs nothing, and it is trivially generated from the page's own position in your site structure.

It matters most on exactly the sites that need it least intuitively: [businesses running a page per service and per location](/blog/a-page-per-suburb-for-trades/), where you may have forty URLs that all look similar in a results page. A breadcrumb makes each one legible at a glance.

### Product and Offer

For anyone selling something with a price. Product markup drives price, availability, and rating in results, and it is one of the few places where the rich result is still both supported and visually dominant.

The condition is honesty: the price in the markup must be the price on the page, and availability must be current. Stale `InStock` markup on a sold-out product is the kind of thing that gets flagged.

### Organization

One block, on the homepage, declaring your organisation name, logo, and official social profiles. It is what allows Google to associate a canonical logo and name with your site rather than guessing from your favicon and title tag.

If you have ever seen a competitor's search result with a small round logo beside it and wondered where it came from, this is usually where.

## What to do about FAQPage

Leave it. Stop counting on it.

FAQPage remains valid schema.org vocabulary. Google Search no longer renders a result from it, but Google Search is not the only consumer of structured data — assistants, aggregators, and the retrieval layers behind AI answers all parse the same markup, and a clean question-and-answer structure is genuinely easier for them to lift than the same content buried in prose. That is also the case for [making your pages readable to AI crawlers generally](/blog/unblock-ai-crawlers/).

What should change is the page design. If you added an FAQ section purely to farm the rich result, and it reads like it, that section is now pure cost — words your visitors scroll past. If you added an FAQ because customers actually ask those six questions before booking, nothing has changed and you should keep it.

The tell is easy: read your FAQ out loud. If it sounds like someone answering a customer, keep it. If it sounds like someone talking to a crawler, cut it.

## Where markup gets sites in trouble

Three failure modes, in rough order of how often we find them:

**Self-serving aggregate ratings.** A business marks up its own average review score on its own homepage, with no visible reviews on that page. This is explicitly against Google's review snippet guidelines and is one of the most common causes of a structured-data manual action for small sites.

**Markup that does not match the page.** Prices, hours, and availability drift. The visible page gets updated; the JSON-LD block, which nobody remembers is there, does not.

**Duplicate or conflicting entities.** A plugin injects a `LocalBusiness` block, a theme injects another, and a third comes from the page builder. Three entities with three different phone number formats is worse than none.

All three come from the same root cause: markup that was installed rather than authored. If nobody on the project can point at where the JSON-LD is generated, it is going to drift.

## The realistic scope

For a typical small business site, the whole structured data project is:

1. One `Organization` and one `LocalBusiness` block on the homepage.
2. `BreadcrumbList` generated from the page hierarchy, on every page below the root.
3. `Product`/`Offer` on anything with a price.
4. Whatever FAQPage you already have, left in place and no longer optimised for.

That is an afternoon of work on a hand-built site, and it is a permanent asset — it does not need re-doing every quarter. Validate it once with the Rich Results Test, confirm it in [Search Console](/blog/search-console-first-90-days/) a couple of weeks later, and then leave it alone until your hours or address change.

The version of this work that never ends is the version where someone is chasing rich-result formats. Formats get retired — FAQ is the proof. Entity data about who and where you are does not.
