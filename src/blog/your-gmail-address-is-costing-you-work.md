---
blogTitle: Your Gmail address is quietly costing you work
pageName: your-gmail-address-is-costing-you-work
titleTag: Why Your Business Needs Email On Your Own Domain
blogDescription: >-
  A quote from yourbusiness@gmail.com and a quote from hello@yourbusiness.com
  are read differently, and the second one is also far more likely to land in
  the inbox at all. What domain email actually costs, what SPF, DKIM and DMARC
  are for, and the migration order that avoids losing mail.
author: Joseph C.
date: 2026-03-02T16:00:00.000Z
topper: Strategy
image: /assets/images/your-gmail-address-is-costing-you-work-card.png
imageAlt: >-
  Two email signatures side by side, one from a free webmail address and one
  from a business domain
draft: false
tags:
  - post
  - strategy
  - email
  - domain
  - deliverability
  - trust
  - small-business
tldrTitle: Key Takeaways
tldr:
  - >-
    Domain email is roughly the price of a couple of coffees a month per mailbox
    — it has not been a real cost decision for a decade.
  - >-
    Sending business mail from a free webmail address means you cannot
    authenticate it, which increasingly means it does not arrive.
  - >-
    SPF, DKIM and DMARC are three DNS records. You set them once.
  - >-
    Migrate in the order: add domain → authenticate → forward old address →
    change it everywhere → stop using the old one. Never delete first.
faq:
  - q: Is a free webmail address really that damaging?
    a: >-
      It is two separate problems wearing one coat. The first is perception — a
      quote from a Gmail address reads as a side job, fairly or not, and that
      impression costs you nothing to remove. The second is mechanical and
      worse: bulk and transactional mail sent on your behalf cannot be
      authenticated against a domain you do not control, so more of it gets
      filtered. The perception problem is arguable. The deliverability one is
      not.
  - q: What do SPF, DKIM and DMARC actually do?
    a: >-
      SPF is a DNS record listing which servers are allowed to send mail using
      your domain. DKIM attaches a cryptographic signature to each message that
      a receiver can verify against a public key in your DNS. DMARC ties the two
      together — it tells receiving servers what to do when a message fails
      those checks, and where to send reports. Major mailbox providers have
      moved from treating these as optional to treating them as a requirement
      for bulk senders.
  - q: I already have a domain for my website. Do I need a second one for email?
    a: >-
      No. Email and web hosting are separate services that both point at the
      same domain through different DNS records — MX records route mail, A and
      CNAME records route web traffic. Your site can sit with one provider and
      your mail with another, on the same domain, with no conflict. See <a
      href="/blog/who-actually-owns-your-domain/">who actually owns your
      domain</a> for why knowing where those records live matters.
  - q: Can I just forward my domain address to my existing Gmail?
    a: >-
      For receiving, yes, and it is a fine first step. For sending, it is a trap
      — replies go out from the Gmail address, so customers keep the wrong one
      in their address book and the perception problem never goes away.
      Forwarding also breaks SPF alignment on the forwarded hop, which can hurt
      deliverability. Use forwarding as a safety net during migration, not as
      the destination.
  - q: What happens to years of old email if I switch?
    a: >-
      Nothing, if you do it in the right order. Both Google Workspace and
      Microsoft 365 have import tools that copy mail, contacts, and calendar
      from an existing account into the new mailbox. The rule that protects you
      is simple: never close or delete the old account until the new one has
      been receiving successfully for at least a full billing cycle.
  - q: How many mailboxes does a small business actually need?
    a: >-
      Usually fewer than people buy. One paid mailbox per human who sends mail,
      plus free aliases for the role addresses — <code>info@</code>,
      <code>billing@</code>, <code>careers@</code> — routed to a real person.
      Aliases do not cost anything on either major platform. A three-person
      company generally needs three mailboxes and five aliases, not eight
      mailboxes.
sources:
  - label: Google Workspace Admin Help — Help prevent spoofing and spam with SPF
    url: https://support.google.com/a/answer/33786
  - label: RFC 6376 — DomainKeys Identified Mail (DKIM) Signatures
    url: https://www.rfc-editor.org/rfc/rfc6376
  - label: RFC 7489 — Domain-based Message Authentication, Reporting, and Conformance (DMARC)
    url: https://www.rfc-editor.org/rfc/rfc7489
  - label: Gmail Help — Email sender guidelines
    url: https://support.google.com/mail/answer/81126
related:
  - who-actually-owns-your-domain
  - the-contact-form-audit
  - trust-signals-that-move-the-needle
readMins: 7
category: Strategy
---

## Two quotes, same price

A homeowner gets two bids for the same job on the same afternoon.

One arrives from `daveshvac1987@gmail.com`. The other from `dave@daveshvac.com`. Same numbers, same scope, same person.

Nobody makes a conscious judgement about this. It is not a decision anyone would defend out loud. But the second one reads as a company and the first one reads as a guy, and the difference costs about six dollars a month to erase permanently.

That is the soft half of the argument, and it is the half people already know. The hard half is the one that has changed recently, and it is the reason this stopped being a preference and became infrastructure.

## The part that actually breaks

Email providers have spent the last several years tightening what they accept. The direction of travel is unambiguous: mail that cannot be authenticated against the domain it claims to come from gets filtered, and the thresholds keep moving toward "required."

Authentication is a statement about a **domain**. It works by publishing DNS records under a domain you control, saying which servers may send on its behalf and how to verify a message's signature. You cannot publish DNS records under `gmail.com`. Google can. You cannot.

This matters in three concrete places on a small business site:

**Your contact form.** Most contact forms send a notification to you and an auto-reply to the customer. If those messages claim to come from your domain but are sent by your form provider's servers, they need SPF and DKIM records under your domain to be trusted. No domain, no records, more of those confirmations land in spam. This is one of the failure modes worth checking in [a contact form audit](/blog/the-contact-form-audit/).

**Your invoices and booking confirmations.** Same mechanism, higher stakes. An invoice that silently lands in a junk folder is an unpaid invoice and a follow-up conversation that starts with an apology.

**Any list you ever email.** A newsletter, a seasonal reminder, a "we have moved" notice. Bulk sending without authentication is the single fastest way to get filtered.

None of that is fixed by writing better subject lines. It is fixed by owning the domain the mail claims to come from.

## What it costs

Two mainstream options, both in the same range:

- **Google Workspace** — the Gmail interface you already know, on your own domain, per user per month.
- **Microsoft 365** — Outlook plus the Office apps, per user per month.

Both include the mailbox, calendar, storage, and, importantly, generate the DNS records you need. Both let you create unlimited aliases at no extra cost, which is how you get `info@`, `billing@`, and `careers@` without paying for three mailboxes.

Cheaper options exist — most registrars sell a basic mailbox, and some [hosting](/hosting-and-domains/) plans include one. They work. They are usually worse at spam filtering and at mobile sync, and the support experience when mail stops flowing is not comparable. For a business where email *is* the sales channel, the mainstream option is worth the difference.

Prices change, so we are not quoting current figures here. The relevant point is that this has not been a meaningful cost decision for at least a decade. It is a decision people postpone, not one they can't afford.

## The three DNS records

You will set these once, at your registrar or wherever your DNS is hosted, and then never think about them again. Your provider generates the exact values; this is what they are for.

**SPF** — a `TXT` record listing which servers are permitted to send mail using your domain. One record, one line. The single most common mistake is having two SPF records, which is invalid; if you add a second sender later, you merge it into the existing record rather than publishing another.

**DKIM** — a `TXT` record containing a public key. Your provider signs every outgoing message with the matching private key, and receiving servers verify the signature. This is what proves a message was not altered and genuinely came from an authorised sender.

**DMARC** — a `TXT` record at `_dmarc.yourdomain.com` that does two jobs: it tells receiving servers what to do with mail that fails SPF and DKIM, and it gives you an address to receive reports at.

Start DMARC at `p=none`. That means "check, report, but do not reject." Read the reports for a few weeks to find every system that legitimately sends as you — your form provider, your invoicing tool, your booking system — and get them all authenticated. Only then tighten to `p=quarantine` and eventually `p=reject`.

Going straight to `p=reject` before you have inventoried your senders is how businesses discover that their invoicing platform was never authenticated, by having a month of invoices bounce.

## The migration order that does not lose mail

The order matters more than the tooling. Do it in this sequence:

1. **Add the domain to your new provider and verify it.** Nothing changes for anyone yet; you are just proving ownership.
2. **Create the mailboxes and aliases.** Decide the naming convention now — `firstname@` for people, role aliases for functions. Changing it later means reprinting things.
3. **Publish SPF, DKIM and DMARC.** DNS propagation is usually minutes, occasionally hours. Verify with your provider's own checker before proceeding.
4. **Switch the MX records.** This is the moment new mail starts arriving at the new mailbox. Everything before this step was reversible without anyone noticing.
5. **Import the old mail.** Both platforms have an import tool. Run it after the switch so you are not importing a moving target.
6. **Set the old address to forward** to the new one, and leave it forwarding for months. This is your safety net for every supplier, portal, and customer who still has the old address on file.
7. **Update the address everywhere it appears** — website, Google Business Profile, invoices, quote templates, vehicle wraps, business cards, directory listings, social profiles. Treat this exactly like a phone number change: [inconsistent contact details across listings are their own problem](/blog/nap-consistency-four-phone-formats/).
8. **Stop sending from the old address.** Not deleting it — just stop using it as a From address, so customers stop learning it.

The account you never close is the one that saves you. We have seen a business lose two years of supplier correspondence by deleting a webmail account the same week they migrated, because the import had silently failed on a folder nobody checked.

## The bit people skip

Set up a proper signature on every mailbox, including on phones.

A signature with your name, role, business name, phone as a [tappable link](/blog/tap-to-call-phone-numbers/), and website URL does two useful things. It makes every reply a small piece of branding, and it gives the recipient a one-tap route to call you from the message they are already reading. The default "Sent from my iPhone" is a wasted line on every message you will ever send.

While you are there, check what your name renders as. `dave@daveshvac.com` displaying as "dave" in someone's inbox is a smaller version of the same problem you just paid to fix.

## Is this worth a whole afternoon?

Working through it honestly: the perception change is real but unmeasurable, and we would not ask anyone to migrate for that alone.

The deliverability change is measurable and it is getting stricter, not looser. If your quotes, invoices, and form confirmations are being sent on your behalf by third-party systems — and on almost every modern site they are — then the domain you cannot authenticate is a structural weakness in the part of your business that turns interest into money.

It is one afternoon, once. Do it before the next thing that depends on email working.
