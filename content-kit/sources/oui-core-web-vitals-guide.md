---
url: https://oui.digital/insights/improve-website-speed-core-web-vitals-guide/
domain: oui.digital
title: Core Web Vitals Guide
type: external blog post
status: source material — paraphrase, do not copy verbatim
note: |
  Mostly saturated. Article still references FID instead of INP (which
  replaced FID in March 2024 and is already in the backlog). Two mildly
  fresh technical hooks worth a single entry each: CSS contain property
  for CLS, performance budget JSON for ongoing enforcement. Skipping the
  rest.
---

# Core Web Vitals Guide

## Key themes (paraphrased)
- Standard thresholds: LCP <2.5s, FID <100ms (article is dated, INP replaced FID), CLS <0.1.
- CSS contain property (`contain: layout style paint`) isolates widget rendering and prevents layout shifts. Underused.
- Intersection Observer for selective lazy loading, not the blanket loading="lazy" attribute.
- Font-display: swap to avoid invisible text during font load.
- Performance budget JSON enforces ongoing thresholds (e.g., FCP <2000ms, scripts <500KB).
- Expected lift from full Core Web Vitals fix: 2-5x faster load, 15-30% conversion gain.

## Quotable claims / stats (verify before reuse)
- LCP <2.5s, CLS <0.1.
- 15-30% conversion lift after Core Web Vitals fix.

## Possible UI Compass angles
- The CSS contain property fixes layout shift on widget-heavy pages. Three lines of CSS, zero JavaScript, instant CLS improvement. → BACKLOG section: Speed and Performance, template: reasons-list
- A performance budget is a JSON file your build fails on. The one-time setup that stops your site from rotting back to a 60 PageSpeed score after the next plugin install. → BACKLOG section: Speed and Performance, template: reasons-list
