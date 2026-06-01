---
pageName: ai-built-websites
blogTitle: AI-Built Websites Get You 60% of the Way There. The Other 40% Gets You Sued.
titleTag: AI-Built Websites
blogDescription: >-
  Yes, ChatGPT can build you a website. No, it cannot keep you out of court.
  Where AI tools genuinely help, where they silently fail, and how to use them
  without inheriting the failures.
author: Joseph C.
date: 2026-06-03T16:00:00.000Z
draft: true
tags:
  - post
  - strategy
category: Strategy
readMins: 6
topper: Strategy
image: /assets/images/ai-built-websites-card.png
imageAlt: >-
  A robot icon on the left, a human icon on the right, with a website layout
  between them
tldrTitle: Key Takeaways
tldr:
  - >-
    AI tools are excellent at the **first 60 percent**: layout, copy drafts,
    image generation, basic responsive design. Use them.
  - >-
    The other 40 percent is **accessibility, local SEO, real-world speed,
    security, and lead capture**. AI does not see these failures because the
    site looks fine in the preview.
  - >-
    The biggest specific risk is **ADA compliance**. <a
    href="/blog/wcag-2-2-aa-in-five-minutes/">96 percent of the top million
    sites fail basic accessibility checks</a>. AI-built sites fail it by
    default.
  - >-
    The right use is **hybrid**. Let AI draft the layout and copy. Let a human
    ship the production version.
faq:
  - q: Which AI website builders are worth trying?
    a: >-
      For drafting: Wix AI, Squarespace AI, Bolt, Lovable, v0.dev. All of them
      produce a passable layout in 15 minutes. For ChatGPT-style assistance
      during a hand-coded build: Claude and ChatGPT both work. None of them
      produce a production-ready site you can ship without review.
  - q: 'Specifically, what does AI get wrong?'
    a: >-
      Six common failures. Image alt text (defaults to "image" or skips it,
      fails accessibility). Color contrast (picks pretty palettes that fail
      4.5:1 minimum). Form labels (visual labels without programmatic
      association). Page load (ships every dependency the framework knows about,
      not the ones you need). Mobile tap targets (buttons smaller than 44px).
      Local SEO (no schema, no NAP consistency, no service-area mapping). Each
      one is small. Together they are the difference between a site that ranks
      and one that does not.
  - q: Will the AI tools fix these things in the next year?
    a: >-
      Some yes, some no. Accessibility is fixable and the tools are improving.
      Local SEO is a strategy problem more than a code problem and AI is bad at
      strategy specific to your business. Speed is a hosting problem and most AI
      builders default to slow shared hosting. Security is a discipline problem
      (patching, monitoring) that AI does not address. Plan for those four to
      stay human problems for a while.
  - q: 'If I am going to use AI anyway, what is the smart workflow?'
    a: >-
      Three steps. First, use AI to produce a draft layout and the first pass of
      every page of copy. Second, have a human review for accessibility, mobile
      tap targets, image optimization, and form structure. Third, host on
      infrastructure built for speed, not on the AI tool itself. The AI is the
      first draft. The human is the editor. The hosting is the foundation.
  - q: Can I just have ChatGPT review my AI-built site?
    a: >-
      For some things yes. ChatGPT can spot missing alt text, suggest meta
      descriptions, flag low-contrast color pairs, and write better headlines.
      It cannot, however, run the site through a real-world load test, audit it
      on a real device, or simulate what your customers actually see. Two tools
      are not better than one if they have the same blind spots.
  - q: What is the cost difference between AI-only and AI-plus-human?
    a: >-
      AI-only: $0 to $30 a month for the platform, plus your time.
      AI-plus-human: about $1,800 a year for a managed hand-coded site that uses
      AI in the workflow but ships production-quality output. The math: <a
      href="/blog/one-client-pays-for-the-year/">one client recovers the year on
      the hybrid path</a>. AI-only is cheaper on paper, expensive in lost leads.
related:
  - drag-and-drop-vs-hiring
  - wcag-2-2-aa-in-five-minutes
  - what-makes-a-website-work
---

Yes, ChatGPT can build you a website.

No, it cannot keep you out of court.

In the last eighteen months, AI website builders have gotten genuinely good at the first part of the job. Layouts that would have taken a designer a week now appear in fifteen minutes. Copy drafts that read passably arrive in seconds. Image generation has cleared the uncanny valley for most stock-photo use cases. If you are starting from a blank page, AI gets you to a presentable draft faster than any tool in history.

That is the first 60 percent. It is real. Use it.

The other 40 percent is where the trouble lives. The 40 percent is what separates a draft from a production website. It is also the part you do not see fail until something else exposes it: a customer who could not navigate it, a Google ranking that never arrives, a lawyer's demand letter that does.

Here is what the gap actually looks like.

## What AI does well

**Layout.** Tools like Wix AI, Squarespace AI, Bolt, and Lovable can take a description of your business and produce a reasonable site structure: hero, services, about, contact, footer. The structure is usually fine.

**Copy drafts.** ChatGPT or Claude will give you a working draft of every page in under twenty minutes. The writing is not great but it is workable. A human editor turns the draft into real copy in another hour. Faster than writing from scratch.

**Stock-grade images.** Mid-journey, DALL-E, and the integrated image tools in most AI builders produce photos good enough for hero sections and section breakers. Not as good as a real photoshoot of you and your team, but better than the alternative for businesses that do not have real photos yet.

**Basic responsive.** Modern AI tools default to mobile-responsive layouts. The navigation collapses to a hamburger. The columns stack. The images fluid-resize. This is table stakes and AI gets it right.

For a draft that you intend to iterate on, AI is the fastest start there has ever been.

## What AI silently fails at

Six specific things, all invisible until they bite.

**Accessibility.** This is the biggest one and the most expensive. The Americans with Disabilities Act applies to websites. AI builders default to image alt text like "image" or "icon" or nothing at all. They pick beautiful color palettes that fail the 4.5:1 contrast minimum. They put form labels visually on the screen but do not connect them programmatically to the input, so screen readers cannot tell what each field is for.

Each individual fail is small. Together they form a credible ADA lawsuit. <a href="/blog/ada-lawsuits-and-form-8826/">Over 5,000 of those were filed in 2025</a>, with settlements landing $5K to $25K each. AI-built sites are easy targets because the failures are predictable.

**Local SEO.** AI does not know that "plumber in Plano" is the search term you actually need to rank for. It writes generic copy about plumbing. It does not add the schema markup that tells Google about your service area. It does not check that your business name, address, and phone number are consistent across the page footers (Google reads inconsistency as four different businesses). The site looks fine. It just does not get found.

**Real-world speed.** AI builders run their previews on fast laptops with fiber connections. Your actual customers are on a four-year-old phone on cellular data. The site that loaded in 1.2 seconds in the preview loads in 7 seconds for them. <a href="/blog/the-1-second-tax/">A one-second delay drops conversions by 7 percent.</a> A seven-second delay drops most of them entirely.

**Image optimization.** AI builders accept whatever image you upload. They do not size it down for mobile. They do not convert it to WebP. They do not serve different sizes to different screens. The 4MB photo from your phone camera stays 4MB and ships to every mobile visitor.

**Form structure.** Contact forms are the failure mode that costs the most leads. AI defaults to forms that look right and break silently. They miss the SPF/DKIM email authentication that keeps form submissions out of spam. They do not include honeypot fields, so bots fill them with junk. They do not send confirmation replies, so users wonder if their message went through. <a href="/blog/the-contact-form-audit/">One in four contact forms silently fails to deliver.</a>

**Security and patching.** AI builders ship the site. They do not maintain it. Six months later there is a vulnerability in one of the framework dependencies, a brute-force attempt against the admin login, or a plugin update that breaks the form. AI is not there to catch any of it.

## The hybrid model

The right way to use AI for a small business website is not to replace the human. It is to compress the human's time.

The workflow looks like this:

**Step 1, AI drafts.** Get the layout, the copy, the image placeholders, the basic structure in fifteen minutes. Spend an hour iterating on the headlines until they describe what you actually sell.

**Step 2, human reviews.** A real developer or strategist runs the site through an accessibility audit, a real-device speed test, a local SEO check, and a form-delivery test. Each one takes a few minutes with the right tools. The output is a punch list of fixes.

**Step 3, ship to production.** Move the site off the AI builder and onto a hand-coded infrastructure built for speed. Premium hosting. WebP images. Schema markup. Working forms. Tests passing.

The total time is two to three weeks for a full small business site. The cost on our managed plan is the same $150 a month we charge for any build, with the AI shortcuts baked into the workflow rather than charged extra.

## What you should not do

Do not ship the AI-only draft as your real website.

The temptation is enormous because the preview looks fine. The site renders, the buttons work, the form sends. Friends say "looks great" the way they always do. You go live, the site goes silent, and you do not understand why.

The reason is the 40 percent that AI did not handle. It is not visible in the preview. It is visible in your Google ranking, your form-submission count, and, occasionally, your mailbox six months later.

AI is a tool. It is the best drafting tool a small business has ever had. It is not the build.

Reply with the AI builder you are considering and the kind of business you run. We will tell you which of the six gaps will hurt you most and how to close them without rebuilding from scratch.
