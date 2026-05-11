---
pageName: a-page-per-suburb-for-trades
blogTitle: Why Every DFW Trades Site Needs a Page Per Suburb
titleTag: A Page Per Suburb for Trades
blogDescription: A trades site with 6 pages does not rank for "plumber in Plano." A trades site with 60 pages does. The service-by-location matrix that turns one business into dozens of indexable answers, the 100K-population threshold, and how to keep the pages substantial instead of thin.
author: "Joseph C."
date: 2026-04-24T16:00:00.000Z
tags:
  - post
  - seo
category: "SEO"
readMins: 7
topper: "SEO"
image: /assets/images/a-page-per-suburb-for-trades-card.png
imageAlt: A spreadsheet matrix with service categories down the left and DFW suburbs across the top, with check marks in cells that have demand
tldrTitle: What you need to know
tldr:
  - 'A trades site with **6 pages** does not rank for "plumber in Plano." A site with **60 pages** does — one page per service, per suburb, per real customer query.'
  - 'Build a **service-by-location matrix**: services down the rows, suburbs across the columns. Every cell with real demand becomes its own URL with its own H1.'
  - 'The **100,000-population threshold** decides cadence: suburbs above 100K get their own page; suburbs below 100K get grouped into a regional page so the URL has enough query volume to rank.'
  - 'Each location page needs to be **substantial** (350+ words, unique opening, local detail, local proof) or Google treats it as a doorway page and demotes it. Boilerplate templates with the suburb name swapped in fail.'
faq:
  - q: 'Is this "doorway page" SEO that Google penalizes?'
    a: 'It is doorway-adjacent if you do it lazily. The penalty trigger is thin, near-duplicate pages with the suburb name swapped in. Google''s guideline says doorway pages are "sites or pages created to rank highly for specific queries that lead users to less useful intermediate pages." The fix is making each page genuinely useful: unique opening, real local detail (a landmark, a known issue in that suburb, a recent project), local proof (a testimonial from a customer in that area). Pages that pass that bar rank because they deserve to.'
  - q: 'How do I know which suburbs have enough demand to justify a page?'
    a: 'Three signals. (1) Population — above 100,000 generally has enough native search volume to support a dedicated page. (2) Google Trends — query volume for "your-service + suburb-name" gives you a relative read. (3) Your own job log — if you have done jobs in a suburb in the last 12 months, the demand is real, regardless of what Trends shows. Use the job log as the truth; use population and Trends as the planning aid.'
  - q: 'What does a "regional" page look like for grouped smaller suburbs?'
    a: 'A single page titled around the broader region (e.g., "Plumbing in North Tarrant County") that names the smaller suburbs as service areas inside the body. Each named suburb gets a paragraph or a card with a real photo, real customer name, or real local detail. Internal links from this regional page to your service hub. The regional page is one URL doing the work of 5–8 small suburb pages without the thin-content risk.'
  - q: 'How fast can I build out 30–60 location pages without it taking 3 months?'
    a: 'Two principles. (1) Ship the highest-demand cells first. Your top 3 services × your top 5 suburbs is 15 pages — start there and the matrix delivers most of the revenue lift before half the work is done. (2) Use templates for layout but write unique copy. The hero section, the trust block, and the closing CTA pattern from <a href="/blog/the-seven-homepage-sections/">our seven-section homepage</a> can be reused; the middle 300 words have to be genuinely about the cell.'
  - q: 'Does this kind of site-wide expansion hurt PageSpeed?'
    a: 'Not if the pages share a build pipeline. <a href="/blog/the-10x-load-time-gap/">Static hand-coded sites</a> generate each page at build time, ship as pre-built HTML, and cost almost nothing in performance per added page. WordPress sites with 60 location pages can run into <a href="/blog/the-1-second-tax/">database-assembly slowdowns</a>, especially under the same plugin-heavy setup that gives them the 60-second build time in the first place. Plan the structure before scaling the count.'
  - q: 'How does this connect to Google Business Profile?'
    a: 'They reinforce each other. Your GBP listing covers the primary location. Your location pages cover the surrounding suburbs your physical address does not. Google reads both signals — the GBP entity, plus the suburb-specific URLs with consistent NAP — and broadens the area you can rank for. Pair with the <a href="/blog/nine-gbp-secondary-categories/">9 GBP secondary categories</a> and the <a href="/blog/nap-consistency-four-phone-formats/">clean NAP rules</a> for the full local-SEO stack.'
  - q: 'What about customers who Google "trade-name near me" instead of naming a specific suburb?'
    a: '"Near me" searches resolve to the searcher''s geo-coordinates, which Google maps to a specific suburb or neighborhood. A "plumber near me" search from a phone in Plano is functionally the same as a "plumber in Plano" search. The page-per-suburb model captures both because the suburb-specific URL is the one Google has the highest confidence ranking for that geographic intent.'
  - q: 'How long until the new pages start ranking?'
    a: 'Same realistic 4-to-8-week window as other local-SEO foundation work. Google crawls and indexes the new URLs first, then begins assigning rank as it confirms <a href="/blog/nap-consistency-four-phone-formats/">NAP signals</a> and accumulates engagement data. Pages that match all three foundations (clean NAP, sufficient depth, real local proof) usually start ranking around week 6. Pages that fail one of the three can take 3–6 months to settle, or never make it to page 1.'
related:
  - url: /blog/nine-gbp-secondary-categories/
    title: '9 GBP Secondary Categories. Most Owners Use One.'
  - url: /blog/nap-consistency-four-phone-formats/
    title: 'Your Phone Number Is Four Different Businesses to Google'
  - url: /blog/five-reviews-a-month-beats-thirty-in-a-week/
    title: '5 Google Reviews a Month Beats 30 in One Week'
---

A trades site with six pages does not rank for "plumber in Plano." A trades site with sixty pages does.

The math is structural. Google ranks pages, not businesses. A page titled "Services" with a list of every service in every city you cover is one page asking to rank for hundreds of queries. A page titled "Drain Cleaning in Plano" with 400 words of substance specific to that service in that suburb is one page asking to rank for one query — and winning it.

This post is the <span class="tooltip-term" data-tooltip="A grid with your services down one axis and your service areas across the other. Each cell becomes a potential URL on your site if real demand exists for that service in that location.">service-by-location matrix</span>, the population threshold that decides cadence, and how to keep each page substantial enough that Google does not flag the expansion as thin content.

## Why six pages is not enough

A typical small business site has six to twelve pages: home, about, services overview, contact, plus a few service-detail pages and maybe a portfolio. That structure is fine for an agency or a consultancy whose customers Google generic terms. It fails for a trades business whose customers Google highly specific terms.

A homeowner with a leaking water heater does not type "plumbing services." They type:

- "water heater repair Plano"
- "tankless water heater install Frisco"
- "emergency plumber McKinney"

Each of those is a different intent. Each ranks better for a page specifically about that intent. The six-page site has one services page trying to satisfy all three, plus none of the dozens of other variations the same suburbs are typing every day. Six pages cover six queries. Sixty pages cover sixty queries.

## The service-by-location matrix

The planning tool is a spreadsheet.

### Step 1: List your services down the rows

Every distinct service you offer. For a plumber, that might be:

- Drain cleaning
- Water heater repair
- Water heater installation
- Tankless water heater installation
- Slab leak detection
- Slab leak repair
- Toilet repair
- Toilet replacement
- Sewer line inspection
- Sewer line repair
- Emergency plumbing
- New construction plumbing

Twelve rows. A typical trades business has 8 to 15 distinct services worth a dedicated page.

### Step 2: List your service areas across the columns

Every suburb you service or want to service. For a DFW plumber based in Arlington, the relevant set might be:

- Arlington (home base)
- Plano
- Frisco
- McKinney
- Mansfield
- Grand Prairie
- Irving
- Fort Worth
- Allen
- Dallas
- Carrollton
- Richardson

Twelve columns. The total grid is 144 potential URLs (12 × 12), but not all of them have real demand.

### Step 3: Check the cells with real demand

Three sources of signal.

- **Your job log.** Every cell where you have actually completed a job in the last 12 months has real demand by definition. The customer existed.
- **Google Trends and Google Keyword Planner.** Search volume for "service + suburb" tells you whether queries are happening.
- **Local competitor coverage.** Look at the businesses currently ranking for the queries you care about. If they have dedicated pages for the cell, the demand is real.

Mark the cells that have demand. Most matrices end up with 30 to 60 viable cells, not all 144.

### Step 4: Each viable cell is a URL

Build a page for each viable cell with the URL pattern `/service/suburb/`. For example: `/water-heater-repair/plano/` or `/drain-cleaning/frisco/`. The URL is a contract — the page should be about exactly the service in exactly the suburb, and nothing else.

## The 100,000-population threshold

Not every suburb gets its own page. The cleanest rule for cadence:

### Above 100,000 people: dedicated page

Suburbs with population above ~100K (Plano, Frisco, Irving, Garland, Arlington, Dallas, Fort Worth, McKinney) have enough native search volume to support dedicated service pages. The query "drain cleaning Plano" gets typed often enough that a well-built page ranking for it captures real revenue.

### Below 100,000 people: regional grouping

Smaller suburbs (Mansfield, Cedar Hill, Coppell, Colleyville) often do not have enough query volume to support a dedicated page per service. Group three to five neighboring small suburbs into a regional page like "Drain Cleaning in North Tarrant County" or "Plumbing Services in the Mid-Cities." The regional page names each suburb inside, gets enough cumulative query volume to rank, and avoids the thin-content trap.

### What "thin content" means and why it bites

<span class="tooltip-term" data-tooltip="A page with little unique substance, often a template with just the city name swapped in. Google explicitly demotes thin and doorway-style pages.">Thin content</span> is what Google calls pages with little unique substance. A boilerplate page with the suburb name swapped in is the classic example — same hero, same paragraph, same testimonials, only the city changes. Google demotes these aggressively, and at scale they can drag down the rest of your site too.

The cure is depth per page. Each location page needs at least:

- **A unique opening paragraph** that names a real local detail (a landmark, a recent job, a known plumbing quirk of that suburb's housing stock).
- **A service-specific section** that goes beyond "we do drain cleaning" — explain what causes drain issues in homes built in that suburb's typical age range, what the local water hardness is, what permits the suburb requires.
- **At least one local proof point.** A photo from a real job in that suburb, a named testimonial from a customer there, or a recent review with the address visible.
- **A clear CTA** pointing at your contact form or [tap-to-call phone number](/blog/tap-to-call-phone-numbers/).

Aim for 350 to 600 words per page. Less than that risks the thin-content flag. More than that becomes hard to maintain across 30–60 pages.

## Why customers search the way they search

The vocabulary mismatch between how businesses describe themselves and how customers describe their problems is the unsung reason most small business sites under-rank.

A homeowner with a clogged drain types "drain unclogging," not "residential drainage services." A homeowner with a busted water heater types "water heater not working," not "domestic hot water system service." The H1 on each location page should match how customers talk, not how the business describes its offerings internally.

The page-per-suburb model fits this perfectly. Each page is a single customer query made into a URL, with the H1 written in customer vocabulary. The matrix is functionally a vocabulary list — every customer phrase that gets typed at meaningful volume becomes its own URL.

## Internal linking the matrix

Sixty new pages live or die by their internal-linking structure. The pattern that holds:

### Service hubs

For each service, build a top-level service hub at `/water-heater-repair/`. The hub introduces the service in general terms and links to every suburb page covering that service.

### Suburb hubs

For each suburb, build a top-level suburb hub at `/plano/` (or `/service-areas/plano/`). The hub introduces the suburb in your-business terms and links to every service page covering that suburb.

### The 60-page matrix in the middle

Every individual page at `/water-heater-repair/plano/` links back to both its service hub (`/water-heater-repair/`) and its suburb hub (`/plano/`). The two-axis cross-linking is what helps Google understand the matrix structure as a unified site rather than a pile of disconnected pages.

The same internal-linking pattern is what our [seven-section homepage layout](/blog/the-seven-homepage-sections/) feeds into — the services section on the homepage points at the service hubs, which then fan out into the suburb-specific pages.

## What this looks like in production

The build sequence we recommend for clients shipping the matrix from scratch:

### Week 1: Build the matrix (4 hours)

Spreadsheet planning. List services, list suburbs, check cells with demand. Identify which suburbs hit the 100K threshold and which need to be grouped regionally.

### Week 2–3: Build hubs (8 hours total)

Service hubs and suburb hubs first. These are the anchors. Each hub is roughly 600–900 words plus the cross-links to the matrix pages that will be built next.

### Week 4–12: Ship matrix pages, 5–10 per week

Each page is 1.5–3 hours of focused work: customer-vocabulary H1, unique opening, service-specific section, local proof, CTA. At 5 per week, the full 30-cell matrix takes 6 weeks; at 10 per week, 3 weeks.

### Ongoing: Watch the rankings

The same 4-to-8-week ranking window we describe in [our NAP-consistency post](/blog/nap-consistency-four-phone-formats/) applies to new location pages too. The first cell that crosses page 1 is usually around week 6 after launch.

## What we ship

For trades-business clients who need the matrix, we build it as part of the [web design](/web-design/) and [web development](/web-development/) engagement. The matrix lives in the build pipeline — adding a new suburb later means adding a row to the data file and shipping, not hand-writing HTML.

The pages are hand-coded so [PageSpeed scores hold](/blog/the-1-second-tax/) across the 30–60-page count without the database-assembly drag that hits WordPress sites scaling the same model. Ongoing edits, copy updates, and seasonal additions fold into [unlimited edits and support](/unlimited-edits-and-support/).

## Run your own matrix today

Open a spreadsheet. List your services. List your suburbs. Check the cells where you have done real jobs in the last 12 months.

How many viable cells did you count?

If it is more than your current site's page count by a factor of 3 or more, the gap is the page-per-suburb opportunity. [Send us your spreadsheet](/contact/) and we will quote the build.

What did your matrix look like?
