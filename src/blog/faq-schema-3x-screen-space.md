---
pageName: faq-schema-3x-screen-space
blogTitle: FAQ Schema Turns One Blue Link Into 3x Screen Space
titleTag: FAQ Schema Turns One Blue Link Into 3x Screen Space
blogDescription: Schema does not move you up the rankings. It changes how your listing looks once you are there. The FAQ block that takes a single blue link and stretches it into roughly three times the vertical space, plus the five mistakes that get the whole thing thrown out.
author: "Joseph C."
date: 2026-01-08T16:00:00.000Z
draft: true
tags:
  - post
  - seo
category: "SEO"
readMins: 5
topper: "SEO"
image: /assets/images/faq-schema-3x-screen-space-card.png
imageAlt: A search results page showing an expanded FAQ schema result taking three times the vertical space of the result above it
tldrTitle: Key Takeaways
tldr:
  - 'Schema does not change **where** you rank. It changes **how your listing looks** once you are there. The win is click-through rate, not ranking.'
  - '**FAQ schema** turns one blue link into a stacked, click-to-expand result that occupies roughly **3x the vertical space** of a standard result. Same position, more screen.'
  - 'Six schemas worth bothering with: **LocalBusiness, FAQPage, Service, Review/AggregateRating, Article, BreadcrumbList**. Skip the rest.'
  - 'Five mistakes get your schema silently dropped: **contradicting the visible page, generic types, stale info, mismatched names, missing @id links**.'
faq:
  - q: 'Will adding schema slow my page down?'
    a: 'No. JSON-LD schema is a small block of text inside a script tag. Even on a verbose schema-heavy page, the total weight is under 5KB. The <a href="/blog/the-1-second-tax/">PageSpeed numbers we hit</a> include schema on every page.'
  - q: 'Should I put the same FAQ on every service page?'
    a: 'No. Each service page should have its own FAQ — questions specific to that service. Duplicate FAQ blocks across the site signal "boilerplate" to Google and reduce the chance of any of them being picked up as a rich result. Three to five questions per page, written for that page''s reader.'
  - q: 'How often should I update my schema?'
    a: 'Whenever the visible page changes. Hours, prices, addresses, phone numbers, service descriptions. Stale schema is one of the five mistakes that get a rich result silently dropped. Add "audit schema" to your <a href="/unlimited-edits-and-support/">monthly maintenance</a> checklist.'
  - q: 'What is the difference between FAQ schema and just having FAQ content?'
    a: 'FAQ content (a Q&A section visible on the page) helps your readers and serves as long-tail SEO. FAQ schema is the structured-data version of the same content that tells Google "this block is a question, this block is its answer." Without the schema, the FAQ helps the human visitor. With the schema, it also gets you the rich result.'
  - q: 'Does Google still show FAQ rich results in 2026?'
    a: 'Selectively. In late 2023 Google narrowed FAQ rich results to government and well-known authoritative sites for most queries. Brand-name and product-specific queries still trigger them. The rich result is no longer guaranteed, but the schema is still worth shipping because it feeds <a href="/blog/unblock-ai-crawlers/">AI search engines</a> and Bing, which still reward FAQ markup heavily.'
  - q: 'How do I test my schema before publishing?'
    a: 'Google''s <a href="https://search.google.com/test/rich-results">Rich Results Test</a> at <code>search.google.com/test/rich-results</code>. Paste your URL, wait 30 seconds. The validator catches every mistake in this post and tells you the line number to fix. Re-test after every change.'
  - q: 'Can I use a plugin instead of writing JSON-LD by hand?'
    a: 'On WordPress, Yoast and Rank Math both generate the basic schema types automatically. They are good for LocalBusiness, Article, and BreadcrumbList. They tend to mis-pick the business type (defaulting to the parent "LocalBusiness" instead of "WebDesignAgency" or "Plumber") and they do not handle FAQ schema unless you mark up the questions yourself. Hand-written or plugin-with-overrides is the right answer for most small business sites.'
related:
  - url: /blog/unblock-ai-crawlers/
    title: 'Your robots.txt Is Blocking the AI Crawlers'
  - url: /blog/the-bilingual-maturity-ladder/
    title: 'The Bilingual Maturity Ladder, A Playbook for English/Spanish Sites'
  - url: /blog/the-seven-homepage-sections/
    title: 'The Seven Sections Every Small Business Homepage Needs, In Order'
---

Two listings on the same Google results page. Same rank. One takes ten lines of vertical space. The other takes three.

The difference is one block of <span class="tooltip-term" data-tooltip="Code that labels the meaning of content on a page so search engines do not have to guess. Usually written as JSON-LD inside a script tag.">structured data</span> the second site forgot to add. <span class="tooltip-term" data-tooltip="A schema type that marks up question-and-answer content. Google can render it as a stacked, click-to-expand result occupying roughly 3x the vertical space of a standard listing.">FAQ schema</span>, in plain English: a small piece of code that tells Google your page contains a list of questions and answers, and Google rewards that with a stacked, click-to-expand result that occupies roughly three times the screen real estate of a standard blue link.

Same position. Three times the surface area. Better <span class="tooltip-term" data-tooltip="Click-through rate. The percentage of search-result viewers who actually click your listing. Schema raises CTR without changing rank.">click-through rate</span>, every time.

## What schema actually does

Schema markup does not change where you rank. It changes what your result looks like once you are there.

That distinction matters because most owners hear "structured data" and think "ranking signal." It is not. Google has been very clear about this for the better part of a decade. Schema is a translation layer. It tells the search engine, "these characters in the HTML are a price, these are a question, these are a star rating, these are business hours." Google then uses that knowledge to decorate the result with the rich-result format that fits the data.

### Why the CTR math beats the ranking math

Your competitor at position three with FAQ schema will out-earn you at position three without it, because their listing is bigger, more useful at a glance, and easier to click. The mechanism is click-through, not ranking. We see this play out in audit after audit: two sites at the same position, one of them earning twice the clicks because the listing took up twice the screen.

This is also part of why we recommend [FAQ schema as one of the first things to fix on a service page](/blog/the-seven-homepage-sections/) — it is a CTR upgrade you can ship in an afternoon.

## The six schemas worth bothering with

A small business site does not need every schema type Google supports. It needs six.

### LocalBusiness

Tells Google what kind of business you are, where, and when you are open. The most important schema for any business with a physical address or service area. Powers the right-rail "knowledge panel" that shows under your branded searches.

### FAQPage

The screen-space win we are talking about today. Use it on service pages, pricing pages, and individual blog posts. The bilingual maturity ladder post is one example — see [the FAQ at the bottom of that post](/blog/the-bilingual-maturity-ladder/).

### Service

For each of your service pages, with a name, description, and area served. Pairs with LocalBusiness through `@id` linking (more on that below).

### Review or AggregateRating

So review stars can show under your listing. Important: the reviews must be visible on the page. You cannot mark up reviews you only collected on Google Business Profile.

### Article

On every blog post, so the post date and author render correctly in the result. Most blog plugins generate this automatically.

### BreadcrumbList

So your "yoursite.com > services > web design" path becomes a clickable trail under the title. Cheap to add, real CTR uplift on long URLs.

Skip the rest. Schema for events, recipes, jobs, and software products only matters if you are running that kind of business. Adding them to a small business site is overhead with no return.

## What FAQ schema actually looks like

A page with FAQ schema looks identical to a normal page in your visitor's browser. The schema is invisible <span class="tooltip-term" data-tooltip="JSON-LD: JavaScript Object Notation for Linked Data. The schema format Google prefers, written inline as a script tag.">JSON-LD</span> tucked into a `<script>` tag in the document. The block is straightforward.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How fast can you build my website?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Most projects are delivered in 1 to 2 weeks."
      }
    }
  ]
}
</script>
```

Add an entry per question. The questions and answers must already exist on the visible page. That is the rule that catches most sites out, and it is the next section.

## Five mistakes that get your schema ignored

Google's parser is strict. It will throw out the entire schema block if any of these is true.

### Mistake 1: The schema contradicts the visible page

Reviews in your schema that are not visible on the page. A LocalBusiness type that does not match the body copy. A price in the schema that disagrees with the price beside the buy button. Google catches the mismatch and silently drops the rich result.

### Mistake 2: Generic business types

"LocalBusiness" is a parent class. The specific subtype ("HVACBusiness", "Plumber", "Dentist", "WebDesignAgency") is what the engine wants. Defaults from a plugin almost always pick the parent. The fix is in the plugin's "schema type" override field, or in the JSON-LD if you are hand-rolling it.

### Mistake 3: Stale information

Hours, phone numbers, addresses, and prices that have changed in real life but not in the JSON. Schema is not a "set it and forget it" line item. We fold a quarterly schema review into [our unlimited edits and support plan](/unlimited-edits-and-support/) for exactly this reason.

### Mistake 4: Mismatched names

Your business is "UI Compass" on the homepage, "UI Compass Web Designs" in the schema, and "UICompass.com" in the footer. Google reads three businesses. Pick one canonical name and use it everywhere — homepage, schema, GBP, social profiles, all of it.

### Mistake 5: No @id links

Each piece of schema (LocalBusiness, Service, FAQPage) gets an `@id` URL, and related schemas reference each other through those IDs. Without the links, Google sees disconnected blobs of metadata instead of one coherent business profile. The same `@id` on your LocalBusiness should appear in the `provider` field of every Service block.

If you are using [Yoast](https://yoast.com/) or [Rank Math](https://rankmath.com/) on WordPress, most of these are handled automatically (with the exception of the FAQ schema, which still requires you to mark up the questions yourself). If you are <span class="tooltip-term" data-tooltip="Code written by hand in HTML, CSS, and JavaScript with no page builder or CMS abstraction layer in the way.">hand-coded</span>, the JSON is yours to write.

## How long it takes

A first pass on a small business site (homepage, three service pages, contact page, two blog posts) is about two to three hours of writing JSON-LD if you have not done it before, and about thirty minutes if you have. Validate every page through Google's Rich Results Test before you call it done. The validator catches every error this post just listed and tells you which line to fix.

If you are also working through [our redesign-vs-optimize scoreboard](/blog/redesign-or-optimize-warning-signs/), schema gets layered into the redesign rather than added as a separate project — better hygiene, fewer regressions.

## Where this lands

We hand-write the schema on every site we ship. Not because plugins are bad, but because we usually find the plugin's defaults are wrong for the actual business by the time the audit is over. A web design agency does not want the "LocalBusiness" parent type. A specialty trades site needs a `serviceType` array, not a single string. The plugin does not know that. The hand-written block does.

The same approach is what we apply across [our web development](/web-development/) and [SEO](/search-engine-optimisation/) work — schema is part of the build, not a plugin to install after.

## The five-minute version

Open one of your service pages. Look for an FAQ section. If it is there, your homework is to mark it up with FAQPage schema and check it in the Rich Results Test.

If the page does not have an FAQ section yet, your homework starts one step earlier. Add a four-question FAQ to that page based on what your customers actually ask you on the phone. Then mark it up.

If you want a hand on the schema audit, [send us your URL](/contact/) and we will pull the rich-results test for you.

What FAQ would you put on your busiest page first?
