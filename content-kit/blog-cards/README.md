# Blog cards

Landscape 1200×630 social/OG cards for blog posts. All cards share the **unified shell**:

- Paper-tone background: `#f7f2ea → #efe7d8` with green + cream corner blooms
- SVG turbulence grain overlay (18% opacity, `mix-blend-mode: multiply`)
- Top strip: a single hairline rule + italic Playfair "Issue Nº NN · Month YYYY" pushed right (no section pill, no journal subtitle)
- Bottom strip: matching hairline + logo + italic "UI Compass." + small-caps "Web Designs" left, "Section · X min read" right with a green dot separator
- `min-width: 0; min-height: 0` set globally so flex/grid children never overflow the 630px frame
- Brand colors: `--primary: #006940`, `--header: #1f1c19`, italic Playfair em accents in green, used sparingly

Each card type fills the **body** between the strips with different content. The shell never changes.

## Templates

| File | When to use |
| --- | --- |
| `templates/blog-card-stat.html`             | One huge number anchors the card. Caption ends with one italic-green em phrase. Orbit decoration bottom-right by default — swap for a thematic SVG (stopwatch, etc.) when the post has one. |
| `templates/blog-card-anatomy.html`          | UI teardown / "Anatomy of X" posts. Hero on the left, annotated phone diagram on the right with 4 numbered Playfair-italic callouts at the corners and curved green connectors from hotspots. Customize the phone-screen SVG per post. |
| `templates/blog-card-comparison.html`       | Two side-by-side columns split by an italic "vs." Left column = muted/wrong, right column = green tint with a `✓`. Replace `.big` text with inline SVG for device illustrations / charts. |
| `templates/blog-card-manifesto.html`        | Opinion / position pieces. One Playfair italic statement centered vertically. No decoration. |
| `templates/blog-card-audit-checklist.html`  | "Three tests anyone can run", "Four metrics the build fails on" — anything that's a discrete list of pass/fail items. Hero left, stylized audit pad right with green checkboxes + a footer total. |
| `templates/blog-card-ladder.html`           | Maturity model / progression. Hero left, 5 ascending bar-chart steps right with the top stage filled green. |
| `templates/blog-card-illustrated.html`      | Illustration on the left (default: a checklist; swap per post — browser mockup, code editor, etc.) + big Roboto-Black stat or headline on the right. |
| `templates/blog-card-hero.html`             | Single dominant Roboto-Black headline with one word underlined in green. Orbit decoration in the corner. For punchy single-sentence teasers. |
| `templates/blog-card-vs.html`               | Head-to-head teaser: two huge stacked lines split by a thick green rule, small-caps axes underneath. Use for the teaser card; `blog-card-comparison.html` is the teardown. |
| `templates/blog-card-metrics-trio.html`     | Three large concentric ring stats across the top (third filled green by default) + a Roboto-Black headline below. Use for Core-Web-Vitals-style "three numbers that matter" posts. |

## Workflow

1. Tell Claude **"make a blog card for `<post-slug>` using `<template>`"** (or just the slug — I'll pick a template that fits). I copy the template, fill the tokens, and write `<slug>.html` here.
2. Screenshot via Browserless:
   ```bash
   npm run blog-card -- <slug>   # one card
   npm run blog-card -- --all    # every card missing an image
   ```
   Reads `BROWSERLESS_API_KEY` from `.dev.vars`. Output → `src/assets/images/<slug>-card.png` at 2× retina.
3. Generate the dark variant for every card:
   ```bash
   node scripts/make-dark-cards.mjs   # writes <slug>-dark.html for each
   npm run blog-card -- --all         # screenshots the new dark files
   ```
   The eleventy `{% image %}` shortcode auto-detects `<slug>-dark-card.png` and renders both `<picture>`s wrapped in `.theme-light` / `.theme-dark`; CSS in `src/css/blog.css` toggles them based on `body.dark-mode`.
4. Update the post's frontmatter `image:` to `/assets/images/<slug>-card.png`. (Already done for all current posts; new posts will need this.)

## Headline rules

- Playfair italic display headlines wrap one accented word in `<em>…</em>`. Used sparingly — one em per headline, occasionally a second in the subhead.
- Subhead / caption / pull-quote bodies are Roboto. Italic-Playfair-green em used as a single accent inside, never the whole sentence.
- Type sizes range from comparison-card's 13px `.desc` to anatomy's 76px `.headline`. In-image text (button labels, inch markers, etc.) can sit outside that range.

## Logo

All templates use `<img ... data-inline-logo>`. The screenshot script base64-inlines `content-kit/assets/logo.svg` before posting to Browserless, so the relative path also works for local file:// previews. In dark variants the script swaps the brand mark to `filter: brightness(0) invert(1)` to invert it to white.
