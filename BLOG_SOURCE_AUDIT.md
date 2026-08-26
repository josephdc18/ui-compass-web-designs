# Blog source audit

Audited 2026-08-26. A Sources block was added only when the linked primary
material directly supports at least one claim in the post. Opinion, UI Compass
pricing, worked examples, and clearly identified house heuristics do not need an
external citation. The items below should be sourced, softened, identified as
UI Compass observations, or removed before the corresponding draft is
published.

| Post | Primary sources attached | Claims still needing editorial work |
| --- | --- | --- |
| `5-signs-ready-for-a-website` | — | “Your competitor appears” for any service-and-city query is too absolute; qualify it as an example or support it with Search Console data. |
| `a-36kb-png-becomes-a-2kb-svg` | — | 50–94% savings, 1–3 MB/page, 2–4 seconds, WebP/AVIF percentage comparisons, Font Awesome weight, and conversion-loss estimates need a reproducible benchmark and dated browser/codec sources. |
| `a-page-per-suburb-for-trades` | Google doorway-page guidance and spam policies | The 100,000-population cutoff, 400-word/300-word targets, week-six ranking expectation, 4–8 week window, and 3–6 month fallback are house heuristics, not claims in the Google sources. Label them accordingly. |
| `a-performance-budget-is-a-json-file` | web.dev Web Vitals; Lighthouse CI | LCP 2.5 s is supported. The 400 KB/80 KB/40 KB/2 MB budgets and “15 PageSpeed points overnight” are recommendations or examples and should be labeled that way. |
| `ada-lawsuits-and-form-8826` | IRS Form 8826 and its IRS landing page | The 5,000+ lawsuit count, $5K–$25K settlement range, 80%+ settlement probability, median, demand-letter process, and remediation hours/prices need legal datasets. The IRS form supports the credit formula and business-size test, but does not expressly say ordinary website remediation qualifies; obtain tax/legal review before making that claim. The $4,000 example also ignores the form’s $250 floor. |
| `ai-built-websites` | — | 60%/40%, 5,000 lawsuits, settlement range, 96%, mobile load-time example, and 7% conversion loss are not established in this post. The NAP statement that Google treats format differences as different businesses is also too categorical. |
| `comparing-local-dfw-web-design-companies` | — | Vendor pricing, ratings, review counts, staffing, guarantees, and delivery times are time-sensitive. Re-check each vendor’s own site/profile immediately before publication and date the comparison. |
| `designed-on-a-monitor-used-on-a-phone` | Google mobile-first indexing guidance | The 60% traffic share, “first one breaks”/“second almost never does,” iPhone 5SE usage, device-cloud inventory/pricing, and “every phone shipping in 2026” need data or softer wording. Google supports mobile-first indexing, not the traffic percentage. |
| `drag-and-drop-vs-hiring` | — | Builder pricing, 25–40 launch hours, 30 maintenance hours, PageSpeed 50–70, 3–6 second gap, 4–6 month break-even, $5K–$25K settlements, and 70-hour conclusion need dated evidence or an explicit “our observed range” label. |
| `faq-schema-3x-screen-space` | — | This draft is now materially outdated: Google removed FAQ rich results from Search in May 2026 and removed the documentation in June 2026. The “3× screen space,” ranking/CTR implications, and claim that product queries still trigger the result should not publish as written. FAQPage markup can remain for semantics/other consumers, but not with a Google rich-result promise. |
| `five-reviews-a-month-beats-thirty-in-a-week` | — | The cadence-vs-burst ranking model, “Google sees manipulation,” freshness weighting, and any recommended monthly review number need Google guidance or first-party GBP data. |
| `font-subsetting-180kb-to-18kb` | — | File-size savings, render delay, request counts, and performance-score changes should cite a checked font build and repeatable test; otherwise present them as the post’s worked example. |
| `four-dependencies-to-delete` | — | Library weights, icon counts, request totals, and PageSpeed gains vary by version and build. Record package versions and a reproducible bundle report. |
| `getting-a-website-when-bigger` | — | Mostly a decision framework. Any revenue/team thresholds should be labeled UI Compass heuristics rather than industry rules. |
| `hosting-decides-your-performance-ceiling` | — | Latency by distance, shared-host TTFB, uptime, platform prices, and claimed performance ceilings need dated provider terms and measured tests. |
| `managing-a-website` | — | Maintenance hours, update cadence, failure probabilities, and site-lifespan estimates should be labeled UI Compass operating assumptions or backed by service records. |
| `nap-consistency-four-phone-formats` | USPS Publication 28 | USPS supports standardized postal address forms. It does not support the claims that Google reads four phone/address formats as four businesses, that punctuation changes entity identity, or that matching schema is a rich-result requirement. Those need Google Business Profile/Search sources or softer wording. |
| `nine-gbp-secondary-categories` | — | The exact category allowance, ranking effect, and nine-category prescription are time-sensitive. Verify against current Google Business Profile help before publication. |
| `one-client-pays-for-the-year` | — | UI Compass pricing and worked arithmetic are first-party claims. Any lead value, conversion rate, or payback timing presented as typical needs client data and a stated sample. |
| `redesign-or-optimize-warning-signs` | — | The seven-sign scorecard is an editorial framework. Performance or conversion thresholds inside it need Web Vitals/analytics sources or an explicit house-rule label. |
| `site-by-service-matrix` | — | The 100,000-population threshold, 8–15/30–60 page ranges, word-count minimums, ranking windows, and revenue-lift expectations remain unsupported. Google’s spam policy can support the warning against thin scaled pages, but not these numbers. This is a live production post and is the highest-priority content follow-up. |
| `small-business-website-cost` | — | Market price bands, hourly rates, maintenance totals, platform prices, and useful-life claims need a dated survey/provider citations or “our quoted range” language. |
| `social-media-vs-website` | — | “Every first-page result is a website,” one-week indexing, Instagram reach/ownership claims, and platform-longevity comparisons are too absolute or time-sensitive. |
| `tap-to-call-phone-numbers` | — | `tel:` behavior can be sourced to the HTML standard, and target-size advice to WCAG. Any phone-traffic, call-conversion, or tap-rate figures need analytics evidence. |
| `the-1-second-tax` | — | The headline 7% conversion loss per second, 11% page-view loss, 53% mobile abandonment, and all extrapolated revenue figures need the original studies with dates and populations. Do not cite a secondary marketing roundup. |
| `the-10x-load-time-gap` | — | Static/WordPress timing ranges, the 60% abandonment claim, PageSpeed/TTFB cutoffs, hosting/build price ranges, and 3–5 year redesign cycle need reproducible tests or dated primary data. |
| `the-about-page-rewrite` | — | “15–25% of homepage traffic every time” needs the underlying UI Compass analytics sample. Writing/scroll-time estimates can remain labeled as workflow guidance. |
| `the-bilingual-maturity-ladder` | Google localized-page/hreflang guidance | Google supports separate localized URLs and hreflang. Claims about subdomains “splitting authority,” mandatory self-canonicals, market behavior, and cross-border privacy obligations need narrower wording and legal/SEO sources. The Korean version carries the same caveats. |
| `the-contact-form-audit` | — | Delivery-time expectations, failure prevalence, spam-loss rates, and “catches almost every failure mode” need service telemetry or softer wording. |
| `the-seven-homepage-sections` | — | This is a design framework. The 80% revenue rule, 30/90-second traversal claims, and exact spacing ranges should be identified as house recommendations. |
| `trust-signals-that-move-the-needle` | — | Review/photo/badge conversion effects, asset weights, and any ordered effectiveness claims need experiment data or an explicit UI Compass observation label. |
| `unblock-ai-crawlers` | OpenAI crawler docs; Google crawler docs; Google JavaScript SEO basics | The post needs a substantive rewrite. OpenAI distinguishes OAI-SearchBot (search) from GPTBot (training). Google AI Overviews use normal Search crawling; `GoogleOther` is not the AI Overview crawler, and Google-Extended is a control token rather than a crawler. Explicit `Allow` blocks are not required when wildcard rules already permit access. Google can render JavaScript, so “the AI sees the same blank page” is too broad. The 90%, 87%, 1–2/2–4 week timing, builder-default, and six-month publishing claims remain untraced. |
| `wcag-2-2-aa-in-five-minutes` | 2026 WebAIM Million; W3C contrast, keyboard, and non-text criteria | The 95.9% WebAIM result supports “roughly 96%.” Legal claims that AA is the courtroom benchmark, lawsuit trends, “small businesses are the easy target,” one-quarter disability share, “one in five” keyboard navigation, and overlay/lawsuit assertions need DOJ/CDC/court or advocacy sources. WCAG 2.2 AA Target Size (Minimum) is 24×24 CSS px with exceptions; a blanket 44 px AA requirement is inaccurate. Automated tests alone do not establish WCAG conformance. |
| `website-is-an-asset` | IRS Form 8826 and its IRS landing page | Tax treatment is high risk. The claim that the full $1,800 is always deductible, a $2,500 capitalization threshold, 36–60 month amortization, website eligibility for Form 8826, “dramatically underclaimed,” email acquisition values, and 20–30% sale-multiple difference need accountant/legal authority or must be removed. The Form 8826 arithmetic must include its $250 floor. |
| `what-makes-a-website-work` | — | The 0.05-second judgment claim, 53% abandonment, sub-one-second prescription, 1,000-impression threshold, and conversion benchmarks need original studies or house-rule labels. |
| `white-space-is-not-empty-space` | — | Spacing and line-height values are design recommendations. “Under 44 px is hard to tap” should be presented as platform usability guidance, not WCAG AA; WCAG 2.2 AA Target Size (Minimum) uses 24×24 CSS px with exceptions. |
| `why-accessibility-overlay-widgets-get-sued` | — | The generic NFB homepage does not substantiate a 2021 overlay statement. Lawsuit examples, “evidence of knowledge,” 50–200 KB, 100–400 ms, 5–15 PageSpeed points, vendor prices, and 4–12 remediation hours need exact legal/technical sources or UI Compass measurements. Avoid promising that manual remediation prevents litigation. |

## Source blocks added

Validated `sources:` data was added to these English posts:

- `a-page-per-suburb-for-trades`
- `a-performance-budget-is-a-json-file`
- `ada-lawsuits-and-form-8826`
- `designed-on-a-monitor-used-on-a-phone`
- `nap-consistency-four-phone-formats`
- `the-bilingual-maturity-ladder`
- `unblock-ai-crawlers`
- `wcag-2-2-aa-in-five-minutes`
- `website-is-an-asset`

The Korean bilingual-maturity post carries the matching localized-page source.
All 16 unique URLs pass `npm run check:sources` after redirects.
