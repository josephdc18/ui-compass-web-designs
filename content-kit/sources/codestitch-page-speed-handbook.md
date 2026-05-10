---
url: https://codestitch.app/page-speed-handbook
domain: codestitch.app
title: CodeStitch Page Speed Handbook
type: external blog post / handbook
status: source material — paraphrase, do not copy verbatim
---

# CodeStitch Page Speed Handbook

## Key themes (paraphrased)
- The picture element with separate mobile and desktop sources is the single biggest image win.
- Crop, then compress, then convert to WebP. Order matters.
- Self-host fonts via Google Fonts Helper. Subset character ranges.
- Preload your one critical font weight. Match the fallback to prevent CLS.
- Defer non-critical CSS with a noscript fallback.
- Drop jQuery. Drop Font Awesome. Use SVG.
- The plateau between 98 and 100 is a critical CSS problem.

## Quotable claims / stats (verify before reuse)
- A 1MB hero image becomes 26KB at mobile size after the full pipeline (about 97% smaller).
- WebP is around 30% smaller than JPG and 26% smaller than PNG.
- Subsetting fonts can cut a 180KB family down to about 18KB.
- Target mobile image size: 20 to 40KB.
- Background images should never exceed 100KB.
- Limit font weights to 3 to 4 styles (regular, 700, italic).

## Possible UI Compass angles
- A 1MB hero compressed to 26KB: the four-step image pipeline that makes it work → BACKLOG section: Speed/Performance, template: process-steps
- 180KB to 18KB: what font subsetting actually does to your load time → BACKLOG section: Speed/Performance, template: stat-hero
- Why your PageSpeed score is stuck at 98 (it is your CSS, not your images) → BACKLOG section: Speed/Performance, template: reasons-list
- The picture element: serving a different image to phone vs desktop, in plain English → BACKLOG section: Speed/Performance, template: process-steps
- Layout shift fixes: matching your fallback font so text does not jump → BACKLOG section: Speed/Performance, template: reasons-list
- The four font weights you actually need (and why every extra one slows you down) → BACKLOG section: Speed/Performance, template: reasons-list
