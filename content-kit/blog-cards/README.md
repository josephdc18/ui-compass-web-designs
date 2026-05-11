# Blog cards

Landscape 1200×630 social/OG cards for blog posts. Brand-aligned (cream `#faf7f4`,
green `#006940`, dark `#262421`, Roboto, UI Compass logo + wordmark).

## Templates (pick one per post — variety beats sameness)

| File | When to use |
| --- | --- |
| `templates/blog-card.html`         | **Headline-only.** Default. Big hook, accent underline, orbit. Light bg. |
| `templates/blog-card-dark.html`    | **Headline-only, dark bg.** Same energy, inverted. Use to break up a streak of light cards. |
| `templates/blog-card-process.html` | **Numbered steps.** 4 short labels (e.g. CRAWL → RENDER → INDEX → RANK) above the headline. |
| `templates/blog-card-stat.html`    | **One huge number.** A single stat (`$120`, `8.5s`, `$8K`) anchors the card; bold caption underneath. |
| `templates/blog-card-metrics.html` | **Three metrics.** Three labeled rings (e.g. LCP / INP / CLS) above a headline. Dark bg. |
| `templates/blog-card-editorial.html` | **Magazine spread.** Playfair italic display, ghost numeral, hand-drawn underline, hairline frame. For flagship / opinion posts. |
| `templates/blog-card-anatomy.html`   | **Annotated phone diagram.** Hero on left, phone with 4 numbered hotspots + curved connectors on right. For "anatomy of X" / teardown posts. The phone screen is editable SVG — rewrite it per post to match the thing being dissected. |

All five share: cream date-pill or eyebrow at top, big bold headline, footer
meta + brand mark in the bottom row, green accent underline on the key word.

## Workflow

1. Tell Claude **"make a blog card for `<post-slug>` using `<template>`"** (or just
   the slug — I'll pick a template that fits the post). I copy the template,
   fill the tokens, and write `<slug>.html` here.
2. Screenshot via Browserless:
   ```bash
   npm run blog-card -- <slug>          # one card
   npm run blog-card -- --all           # every card missing an image
   ```
   Reads `BROWSERLESS_API_KEY` from `.dev.vars`. Output → `src/assets/images/<slug>-card.png` at 2× retina.
3. Update the post's frontmatter `image:` to the new file.

## Headline rules

- 3–7 words. Declarative. End with a period like the references.
- Wrap the **last word or short phrase** in `<span class="accent">…</span>` for the green underline.
- If a headline is too tall, add `size-m` / `size-s` / `size-xs` to the `.headline` element.

## Logo

All templates use `<img ... data-inline-logo>`. The screenshot script base64-inlines
`content-kit/assets/logo.svg` before posting to Browserless, so the relative path
also works for local file:// previews.
