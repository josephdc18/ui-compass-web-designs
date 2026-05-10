---
url: https://redrockwebdesign.com/blog/what-is-dns-explained/
domain: redrockwebdesign.com
title: What Is DNS, Explained
type: external blog post
status: source material — paraphrase, do not copy verbatim
note: |
  DNS basics. Totally absent from current backlog. The "phone book" analogy
  is a cliche worth replacing with the "switching carriers, keeping your
  number" framing. MX-record-killed-our-email is the most relatable horror
  story for a small business owner.
---

# What Is DNS, Explained

## Key themes (paraphrased)
- DNS is the address-translation layer between human-readable domains and the IP addresses computers actually route to.
- A useful frame for owners: switching hosts while keeping your domain is like keeping your phone number when you change carriers.
- Five record types matter for a small business: A (domain to IP), CNAME (alias), MX (email routing), TXT (SPF/DKIM/DMARC and verification), NS (which nameservers are authoritative).
- Propagation can take up to 48 hours globally. During that window different visitors see different versions.
- The four common ways DNS bites a small business: propagation lag after a migration, expired domain registration, wrong nameservers when switching hosts, registrar account hijacked.
- whatsmydns.net is the named free propagation checker.

## Quotable claims / stats (verify before reuse)
- Up to 48 hours for full global DNS propagation.
- whatsmydns.net for propagation status across geographies.

## Possible UI Compass angles
- DNS in plain English: it is the layer that turns yourbusiness.com into the actual address your visitor's browser dials. → BACKLOG section: Industry/Insider, template: reasons-list
- The five DNS records every small business owner should recognize on sight: A, CNAME, MX, TXT, NS. What each one does and what breaks when it is wrong. → BACKLOG section: Industry/Insider, template: reasons-list
- Your email went down the day you switched web hosts. The MX-record story every small business owner should hear once. → BACKLOG section: Industry/Insider, template: stat-hero
- DNS propagation can take up to 48 hours. Why your new site shows up for your phone but not your spouse's. → BACKLOG section: Industry/Insider, template: stat-hero
- Four DNS failures that take a small business offline: expired domain, wrong nameservers, hijacked registrar account, mid-migration propagation lag. → BACKLOG section: Industry/Insider, template: reasons-list
