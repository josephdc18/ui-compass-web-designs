---
blogTitle: Find out who actually owns your domain before you need to know
pageName: who-actually-owns-your-domain
titleTag: Who Owns Your Domain Name and Why It Matters
blogDescription: >-
  A surprising number of businesses do not control the domain their entire
  online presence depends on. How to check in ten minutes, what registrar lock
  and the expiry grace periods actually do, and the five settings to fix today
  so a lapsed credit card never takes you offline.
author: Joseph C.
date: 2026-02-15T17:23:00.000Z
topper: Strategy
image: /assets/images/who-actually-owns-your-domain-photo.jpg
imageAlt: A network patch panel with rows of coloured cables plugged into ports
draft: false
tags:
  - post
  - strategy
  - domain
  - dns
  - hosting
  - ownership
  - risk
tldrTitle: Key Takeaways
tldr:
  - >-
    Check the registrant contact on your domain today. If it is not you or your
    company, that is the single largest risk on your website.
  - >-
    Auto-renew plus a card that does not expire is the cheapest insurance you
    will ever buy.
  - >-
    Registrar lock stops unauthorised transfers and takes one click.
  - >-
    Domain, DNS, email and hosting are four separate things that can live in
    four separate places. Know where each one is.
faq:
  - q: How do I find out who my registrar is if I have no idea?
    a: >-
      Run a WHOIS or RDAP lookup on your domain — ICANN hosts a public lookup,
      and every registrar has one too. Registrant contact details are often
      redacted for privacy, but the <em>registrar</em> name is always public.
      Once you know the registrar, their password reset flow on the email
      address in your records is usually enough to get back in. If the email on
      file is one you no longer control, contact the registrar's support with
      proof of your business identity.
  - q: My web designer registered the domain. Is that a problem?
    a: >-
      It is common and it is usually fine right up until the moment it is not.
      The relationship ends, the designer becomes unreachable, the business
      changes hands, or an invoice gets disputed — and the domain your entire
      customer base uses to find you is in someone else's account. Ask now,
      while everyone is friendly, to be made the registrant with your own
      account and your own billing. A professional will do it the same day.
  - q: What does registrar lock actually prevent?
    a: >-
      It sets a status on the domain that blocks transfers to another registrar
      until you deliberately unlock it. It does not stop you from making DNS
      changes, updating contacts, or renewing — it only blocks the domain
      leaving. Nearly every registrar offers it free, most enable it by
      default, and it is worth confirming rather than assuming.
  - q: What happens if my domain expires by accident?
    a: >-
      There is a sequence of grace periods, not a cliff. Immediately after
      expiry the domain typically stops resolving and enters a renewal grace
      period where you can renew at the normal price. After that comes a
      redemption period, where recovery is possible but carries a substantial
      redemption fee. After that the domain is deleted and can be registered by
      anyone. The exact lengths vary by registrar and by TLD. The whole
      structure exists because accidental expiry is common — but every stage
      after the first costs money and downtime.
  - q: Are domain and hosting the same purchase?
    a: >-
      No, though many companies sell them together, which is where the
      confusion comes from. The domain is the name. <a
      href="/hosting-and-domains/">Hosting</a> is the machine serving the site.
      DNS is the directory connecting them. Email is a fourth thing. All four
      can live with four different providers, and keeping the domain separate
      from the host is often the safer arrangement — it means changing hosts
      never puts your name at risk.
  - q: Should I buy the .net, .org and misspellings too?
    a: >-
      Usually not, for a local business. Defensive registrations are a recurring
      cost for a threat that rarely materialises at small scale. Two exceptions
      are worth the money: a common misspelling that people genuinely make when
      told your name over the phone, and the exact-match variant your industry
      defaults to in your area. Point any you buy at your real site with a
      redirect rather than letting them sit empty.
sources:
  - label: ICANN — Registrar Transfer Policy
    url: https://www.icann.org/resources/pages/transfer-policy-2016-06-01-en
  - label: ICANN — EPP Status Codes — What Do They Mean?
    url: https://www.icann.org/resources/pages/epp-status-codes-2014-06-16-en
  - label: ICANN — Life Cycle of a Typical gTLD Domain Name
    url: https://www.icann.org/resources/pages/gtld-lifecycle-2012-02-25-en
  - label: ICANN Lookup
    url: https://lookup.icann.org/
related:
  - your-gmail-address-is-costing-you-work
  - hosting-decides-your-performance-ceiling
  - managing-a-website
readMins: 7
category: Strategy
---

## The ten-minute check

Go to ICANN's public lookup, type in your domain, and read the result.

You are looking for three things: which registrar holds it, when it expires, and — if it is not redacted for privacy — who the registrant is. Then log into the registrar account itself and confirm the account is in your name, on an email address you control, with a payment card that has not expired.

Most people who do this find everything in order and are mildly annoyed at having spent ten minutes on it. A meaningful minority find something that would have become a genuine emergency later.

The reason this is worth a calendar reminder rather than a vague intention is that domain problems are invisible until they are total. Nothing degrades. One day the site and every email address on it simply stop.

## The four things people think are one thing

Most of the confusion in this area comes from a single conflation. There are four separate services here, they are frequently bought from one company, and they do not have to be:

**The domain.** The name itself, leased from a registrar, renewed annually. This is the asset.

**DNS.** The directory that answers "what server is `yourbusiness.com`?" Usually operated by the registrar, but it can be moved anywhere — plenty of businesses run DNS at their CDN while the domain stays at the registrar.

**Hosting.** The machine that actually serves your website. Connected to the domain by an A or CNAME record in DNS. Where your site sits [sets a ceiling on how fast it can ever be](/blog/hosting-decides-your-performance-ceiling/), which is a separate decision from where the name lives.

**Email.** Connected to the domain by MX records in DNS, and completely independent of where the website is hosted. This is why [moving your email to your own domain](/blog/your-gmail-address-is-costing-you-work/) does not require touching your website at all.

Knowing which of these lives where turns a panicked afternoon into a five-minute change. Write it down somewhere that is not only in your head — provider, account email, and what it controls, for each of the four.

## The registrant question

Of everything on this page, one item matters far more than the rest: **whose name is on the registration.**

The registrant is, in practice, the party with authority over the domain. If your web designer, your cousin, your former marketing agency, or a staff member who left in 2019 is listed there — or if the domain sits inside an account tied to an email address you cannot access — then you do not control the address every customer, every invoice, every business card, and every Google listing points at.

This is not a hypothetical. It is one of the more common serious problems we encounter when taking over an existing site, and it is nearly always the result of a friendly arrangement made years earlier that nobody revisited.

The fix while relations are good is trivial: ask to be made the registrant, in your own registrar account, with your own billing. Any competent professional will do it without being asked twice. The fix after relations sour involves the registrar's dispute process, proof of business identity, and time you do not have.

If you take one thing from this article, take that one.

## Five settings to fix today

**1. Auto-renew, on.** The most common cause of a domain expiring is not a decision. It is a card that expired.

**2. A payment method that will not lapse.** Check the expiry date on the card in the account. If it expires before the domain renews, auto-renew will fail silently — the renewal attempt bounces and the notice goes to an email nobody reads.

**3. A monitored contact email — that is not on this domain.** This one is subtle and it catches people. If your registrar's notification address is `you@yourbusiness.com`, and the domain lapses, DNS stops resolving, and your email stops working — the warning emails about the lapsed domain now go to an inbox that no longer exists. Put a secondary address on a different domain in the registrar contacts.

**4. Registrar lock, on.** It blocks transfers away from your registrar until you deliberately unlock. Free, one click, and it does not interfere with anything you do day to day.

**5. Two-factor authentication on the registrar account.** The domain is the master key to everything else — it controls where your website points and where your email is delivered. Treat that account with the same seriousness as your bank login.

Optional but sensible: WHOIS privacy, which replaces your personal contact details in public records with proxy details. Most registrars include it. Its main practical benefit is a large reduction in the volume of fraudulent "your domain is expiring" mail you receive.

## When it goes wrong

**Expiry.** There is a defined sequence rather than a cliff. Immediately after expiry the domain generally stops resolving and enters a renewal grace period at normal price. Then a redemption period, where recovery is still possible but carries a significant redemption fee. Then deletion, after which anyone can register it. Exact durations vary by registrar and by top-level domain, so check yours rather than trusting a number from an article. The important part is that the first stage is cheap and every stage after it is not.

**The transfer scam.** Official-looking mail arrives about a "domain listing service" or an expiring registration, sometimes as a physical invoice. Paying it either buys a worthless directory listing or initiates a transfer to a registrar you did not choose. Renewals only ever happen inside your registrar account, never by responding to a letter. This is also, incidentally, the best argument for WHOIS privacy.

**Nobody knows the password.** Standard reset on the registrant email if you have it. If you do not, the registrar's identity verification process, with company registration documents. It works, and it takes days rather than minutes — which is days of downtime for a business whose site and email are both down.

## Once a year

Put it in the same slot as your insurance renewal:

- Confirm the registrant is still you.
- Confirm auto-renew is on and the card is valid.
- Confirm registrar lock is on.
- Confirm the notification email still works and is still not on the domain itself.
- Re-read your four-line note about where domain, DNS, hosting and email each live, and update it if anything moved.

Ten minutes a year to protect the one asset your entire online presence is built on. There is no other item on a website [maintenance list](/blog/managing-a-website/) with a better ratio than that.
