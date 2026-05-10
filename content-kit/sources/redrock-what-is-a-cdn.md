---
url: https://redrockwebdesign.com/blog/what-is-a-cdn/
domain: redrockwebdesign.com
title: What is a CDN?
type: external blog post
status: source material — paraphrase, do not copy verbatim
note: |
  Totally absent from backlog. Fresh foundational topic. Strongest angles:
  the geography-as-physics framing, the "you probably already have one"
  insight (Netlify/Vercel/Cloudflare Pages bundle it), the Amazon 100ms = 1%
  sales stat, and the local-business "you probably do not need one" call.
---

# What is a CDN?

## Key themes (paraphrased)
- A CDN is copies of your site stored on servers around the world. Visitors get served from the closest one. The latency win is physics, not magic.
- Smart caching can cut load times 40-60% for repeat visitors.
- Amazon famously found every 100ms of latency cost 1% in sales. The cost-of-slow ratio is brutal at scale.
- Security side benefit: DDoS absorption, bot filtering, automatic SSL/TLS handling.
- Counter-intuitive: most local DFW service businesses do not need a standalone CDN. Their entire customer base is within a 30-mile radius of Dallas anyway.
- If you are already on Netlify, Vercel, Cloudflare Pages, or AWS Amplify, the CDN is built in. You are not buying anything you do not have.

## Quotable claims / stats (verify before reuse)
- 53% of mobile visitors abandon sites that take >3 seconds to load.
- Amazon: every 100ms of latency = 1% lost sales.
- CDN repeat-visitor speedup: 40-60% via caching.
- Cost: free (Cloudflare basic) up to ~$20+/mo for small business plans.

## Possible UI Compass angles
- A CDN in plain English: copies of your site stored on servers around the world so the visitor in Plano never waits on a server in Virginia. → BACKLOG section: Industry/Insider, template: reasons-list
- Amazon found every 100ms of latency cost 1% in sales. The Texas-sized version of why your homepage cannot afford a 1.2-second wait. → BACKLOG section: Speed and Performance, template: stat-hero
- Most DFW service businesses do not need a CDN. Your entire customer base is inside a 30-mile circle. The performance dollar belongs elsewhere. → BACKLOG section: Industry/Insider, template: reasons-list
- If your site is on Netlify, Vercel, or Cloudflare Pages, the CDN is already in the price. The line item your last vendor probably double-billed you for. → BACKLOG section: Industry/Insider, template: stat-hero
