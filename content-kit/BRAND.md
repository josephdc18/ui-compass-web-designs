# UI Compass Web Designs: Content Brand Guide

This file is the source of truth for every social post. Read it before writing anything.

## Who we are

- **Business**: UI Compass Web Designs
- **Location**: Dallas-Fort Worth metroplex (mention when relevant; don't force it)
- **Positioning**: Veteran-owned, hand-coded websites for small businesses
- **Pricing hook**: $150 per month, unlimited edits
- **Differentiators we earn the right to repeat**:
  - Hand-coded, no page builders, no WordPress
  - Sub-1-second load times on all devices
  - Consistently 100 PageSpeed score
  - Free redesign every 3 years
  - One developer, managed for life
- **Audience**: Small business owners (not developers). They care about leads, calls, and being found.

## Voice rules

These are non-negotiable. They define the brand more than any color does.

1. **No emojis.** Anywhere. Including hashtag blocks.
2. **No em-dashes.** Use periods, commas, parentheses, or two short sentences instead.
3. **Short declarative sentences.** One idea per sentence. One line per paragraph when you can.
4. **Second person.** "Your site." "Your visitors." Not "businesses" or "people."
5. **Stat-first hooks.** Lead with a number, a year, a percentage, or a contrarian claim. Not with "In today's world..."
6. **No hedging.** Avoid "might," "could potentially," "in some cases." Make the claim or cut the sentence.
7. **Soft credibility, not braggy.** Drop the differentiators (100 PageSpeed, hand-coded, sub-1s) inside the argument, not as a separate "look at us" paragraph.
8. **End with a CTA and a question.** The CTA gives the easy next step. The question drives replies.
9. **No corporate-speak.** No "leverage," "synergy," "robust," "best-in-class," "industry-leading." Plain English only.
10. **No AI tells.** Avoid "delve," "in the realm of," "it's worth noting," "in essence."

## Post structure (every post)

```
1. Hook         (1-2 short sentences with a stat or claim)
2. Restate      (plain-language version of why it matters)
3. Stakes       (what happens if they ignore it)
4. The list     (3-4 numbered or bulleted items, one line each)
5. Credibility  (one short paragraph mentioning what UI Compass does)
6. CTA          (free audit, comment, DM, link)
7. Question     (one line, drives replies)
```

LinkedIn: 200 to 400 words. Instagram: 100 to 180 words plus hashtags. Facebook: 150 to 250 words.

## Color palette

| Token            | Hex       | Use                                                |
| ---------------- | --------- | -------------------------------------------------- |
| `bg-deep`        | `#1d1b25` | Primary graphic background                         |
| `bg-medium`      | `#30333b` | Card backgrounds, secondary panels                 |
| `accent-primary` | `#41925b` | Numbers, dots, pills, key emphasis                 |
| `accent-soft`    | `#5fb37b` | Hover state, secondary emphasis (12% lighter)      |
| `text-primary`   | `#ffffff` | Headlines on dark                                  |
| `text-body`      | `#cfd2d8` | Body text on dark (88% white)                      |
| `text-muted`     | `#8a8d96` | Caption, disclaimer text                           |
| `divider`        | `#3a3d46` | Hairlines, card borders                            |

Do not introduce other colors. Photos are fine if used at low saturation. Logo on dark always.

## Typography

Use Inter (Google Fonts) for everything. It renders consistently in screenshots and matches the existing site feel.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

| Role             | Family | Weight | Size (px on 1080x1350) |
| ---------------- | ------ | ------ | ----------------------- |
| Eyebrow / pill   | Inter  | 600    | 22                      |
| Headline (H1)    | Inter  | 800    | 96                      |
| Subheadline      | Inter  | 500    | 36                      |
| Card title       | Inter  | 700    | 44                      |
| Card body        | Inter  | 400    | 28                      |
| Footer / logo    | Inter  | 500    | 22                      |

Letter-spacing: `-0.02em` on headlines, `0.18em` uppercase on eyebrow / pill text.

## Graphic dimensions

All standalone HTML graphics render at **1080 x 1350 (4:5 portrait)**. Screenshot at exactly that size. This works on LinkedIn, Instagram feed, and Facebook. For Instagram square, crop top and bottom evenly.

Set the body to `width: 1080px; height: 1350px;` and the screenshot tool to that viewport. Browsers render `display: flex` based layouts at this fixed canvas correctly.

## Design system (locked in)

Every template shares the same visual chassis. Don't deviate without a reason.

- **Background**: warm cream paper (`#faf7f4` → `#f3ede5`) with two faint emerald radial glows top-right and bottom-left.
- **Decoration**: three faint emerald circle arcs (top-right outer/inner + bottom-left), plus one signature dot pair in the top-left and bottom-left corners (`accent` + 32% accent stacked).
- **Type**: Inter for UI/body (400-800), Playfair Display for the headline + italic accents (italic 400-600). Mix is editorial-magazine.
- **Hero formula**: small all-caps emerald pill ("eyebrow") → 2-line Playfair headline with one italicized emerald word → 1-line italic-accented subhead → 3-segment color stripe (deep emerald / cream-deep / bright emerald).
- **Footer formula**: brand lockup (logo + UI Compass. + WEB DESIGNS) on the left, URL + italic Playfair date on the right.
- **Color use**: only the tokens from the palette table above. Headline italic accent always `--primary`; subhead italic accent always `--primary`; body text always `--text-body`.

## Layout templates

Each template is a self-contained HTML file in `content-kit/templates/`. Copy the file to a post folder, rename to `graphic.html`, fix the logo path (templates use `../assets/logo.svg`; posts use `../../assets/logo.svg`), and edit the content. Do not edit the template in place.

Available templates:

- `process-steps.html`: zigzag pill flow, 3 rows alternating left/right, big italic Playfair number orbs attached to color pills (deep emerald / cream / bright emerald), curved arrow connectors. **Use for sequential content** — workflows, day-by-day breakdowns, before-→during-→after.
- `reasons-list.html`: stacked editorial cards on white paper, giant italic Playfair watermark numerals (240px) bleeding off the right edge, hairline emerald top accent. **Use for independent items** — "X reasons", "Y mistakes", "Z things to check" where order doesn't matter.
- `stat-hero.html`: pull-quote layout — massive italic Playfair stat (~280px) on the left, italic Playfair caption on the right, hairline rule, 3 supporting bullets, source line. **Use when one number tells the whole story** — audit averages, bounce-rate stats, ROI claims.
- `scorecard.html`: 2×2 grid of SVG progress-ring score circles, italic Playfair numerals in centers, all-caps tracked labels. Drop a score class (`.s-100`, `.s-98`, etc.) and the arc fills proportionally. **Use for proof posts** — PageSpeed scores, Lighthouse audits, accessibility receipts.
- `comparison.html`: head-to-head versus layout. Massive italic Playfair "vs" mark anchors the center while two columns of stats sit on either side — losing side muted, winning side larger and emerald to signal the winner at a glance. **Use for versus posts** — WordPress vs hand-coded, page builder vs custom, hosting vs maintenance, DIY vs pro, mobile-first vs desktop-first.
- `anatomy.html`: annotated diagram. Stylized phone mockup centered with hotspot dots on the screen, four curved SVG connector lines arcing out to corner callouts (giant italic Playfair numeral + label + 1-line description). Soft emerald spotlight glow behind the device. **Use for anatomy posts** — "anatomy of X", "the parts of Y", "X things every Z needs in plain sight", "5 things that silently break on…".

When a topic doesn't fit any of the six cleanly, ask the question "what is the post arguing?" — sequence (steps), enumeration (reasons), magnitude (stat), evidence (scorecard), contrast (comparison), or composition (anatomy) — and pick the template that matches. If nothing fits, that's a sign to add a new template, not to bend an existing one.

## Hashtags

Pick 4 to 6 per post. Mix one or two location tags with topic tags. Examples:

- Location: `#DallasWebDesign`, `#FortWorthBusiness`, `#DFWSmallBusiness`
- Industry: `#WebDesign`, `#WebDevelopment`, `#SmallBusinessWebsite`
- Topic-specific: `#PageSpeed`, `#CoreWebVitals`, `#WCAG`, `#Accessibility`, `#SEO`
- Brand: `#UICompass`

Order: most specific to most general. No emojis in hashtags.

## CTAs we rotate

Pick one per post. Don't run the same CTA two weeks in a row.

- "Comment 'audit' for a free PageSpeed read on your homepage."
- "Send a DM with your URL. We'll send back the three things slowing it down."
- "Link to a free audit in the comments."
- "Reply with your URL and we'll run the numbers."
- "DM us. We'll find one fix you can ship this week."

## Things to never write

- "Game-changing"
- "Revolutionary"
- "In today's digital landscape"
- "Did you know that..." (just state the thing)
- "We're excited to announce..." (just announce it)
- Any sentence that starts with "So,"
- Any sentence that ends with "!" (exclamation marks read amateur in this voice)
