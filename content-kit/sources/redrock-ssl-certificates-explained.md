---
url: https://redrockwebdesign.com/blog/ssl-certificates-explained/
domain: redrockwebdesign.com
title: SSL Certificates Explained
type: external blog post
status: source material — paraphrase, do not copy verbatim
note: |
  Cert types and renewal mechanics. HTTPS migration steps are already in the
  backlog. The fresh angles here are: paid certs do not encrypt better than
  free, the 398-to-200-day lifespan compression in 2026, the upcoming
  47-day window in 2029, and the "expired cert = full red browser warning"
  failure mode.
---

# SSL Certificates Explained

## Key themes (paraphrased)
- Three flavors: DV/free (Let's Encrypt), OV ($50 to $200/yr), EV ($100 to $1,500/yr). All three encrypt identically. The only difference is how thoroughly the issuer verified your business identity.
- Free Let's Encrypt is the right answer for almost every brochure, blog, portfolio, and local-services site.
- Browser address-bar company-name display for EV certs was killed years ago, removing most of the "premium" justification.
- Cert lifespans are getting shorter on a published schedule: 398 days dropped to 200 days as of 2026, with 47 days planned for 2029.
- Auto-renewal handled by host = invisible. Manual renewal on a paid cert = an item on your calendar that, missed, takes the site fully offline.
- An expired cert serves a full-red "Your connection is not private" interstitial. Most visitors never click past it. Functionally it is downtime.
- TLS 1.3 adds about one round trip on the initial handshake, measurable in milliseconds. The performance objection is dead.

## Quotable claims / stats (verify before reuse)
- DV/free encryption matches paid encryption (256-bit, TLS 1.3) byte-for-byte.
- OV: $50 to $200/yr.
- EV: $100 to $1,500/yr.
- Cert lifespan: 398 days as of recent past, 200 days as of 2026, planned 47 days in 2029 (verify CA/Browser Forum schedule before posting).
- TLS 1.3 handshake adds ~1 round trip (a few ms).

## Possible UI Compass angles
- A paid SSL does not encrypt better than a free one. The only thing you are buying is a deeper background check on your own business. → BACKLOG section: Industry/Insider, template: stat-hero
- SSL cert lifespans dropped from 398 days to 200 in 2026, and the industry is heading to 47 by 2029. Manual renewal is no longer a sustainable plan. → BACKLOG section: Industry/Insider, template: stat-hero
- An expired SSL serves a full-red browser warning. Most of your visitors never click past it. That is downtime by another name. → BACKLOG section: Conversion/UX, template: stat-hero
- The three SSL types in plain English: DV (free, fine), OV (verified business), EV (heavy validation, almost no one needs it). → BACKLOG section: Industry/Insider, template: reasons-list
