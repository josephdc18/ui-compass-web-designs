---
pageName: white-space-is-not-empty-space
blogTitle: White Space Is Not Empty Space
titleTag: White Space Is Not Empty Space
blogDescription: Most "ugly" small business websites do not have a color problem. They have a spacing problem. The four kinds of white space that decide whether a page reads as professional or as cramped, and the math behind every number.
author: "Joseph C."
date: 2026-04-30T16:00:00.000Z
draft: true
tags:
  - post
  - design
category: "Design"
readMins: 6
topper: "Design"
image: /assets/images/white-space-is-not-empty-space-card.png
imageAlt: A clean editorial layout with generous margins and a hand pointing to white space between paragraphs
tldrTitle: Key Takeaways
tldr:
  - 'Most sites that read as **dated** or **cluttered** have a spacing problem, not a color problem. The fix is rarely a redesign. It is a margin, padding, and line-height pass.'
  - 'Four spaces matter: **section padding** (50px mobile / 75–100px desktop), **line-height** (1.4–1.5 for body), **paragraph spacing** (1em between blocks), and **button padding** (vertical 0.75em, horizontal 1.5em).'
  - 'Page builders ship **tight defaults** to fit more on a screenshot. Tight defaults read as professional in screenshots and as overwhelming on a phone.'
  - 'White space is doing **structural work** — separating sections, signaling hierarchy, and giving the eye a place to land. Treat it as content, not as wasted space.'
faq:
  - q: 'How do I know if my section padding is too tight?'
    a: 'Open your homepage on the phone you carry. Scroll slowly. If you cannot tell where one section ends and the next begins without reading the headline, the padding is too tight. If your hero collides with your services grid visually, you need at least 50px more vertical space at that seam.'
  - q: 'Are these spacing rules different for mobile vs desktop?'
    a: 'Yes. Mobile gets less padding because the screen is smaller — roughly 50px section padding instead of 75–100. Body line-height and paragraph spacing stay the same on both. The pattern fits the <a href="/blog/designed-on-a-monitor-used-on-a-phone/">mobile-first layout architecture</a> that we ship on every build.'
  - q: 'Can I just copy the spacing rules from a site I like?'
    a: 'Partially. The numbers usually translate (line-height 1.5 reads well at most font sizes), but section padding scales with the section''s purpose. A hero needs more padding than a footer. A pricing card needs less than a service description. Copy the ratios, not the absolute numbers.'
  - q: 'My designer said the site needs to look "premium." Is more white space the answer?'
    a: 'Usually yes, with a caveat. Generous padding and line-height read as premium. Tight, jammed layouts read as discount. But "premium" is also about photography quality, type pairing, and color discipline — white space alone does not save a site that has all three of those wrong.'
  - q: 'Does white space slow down my page?'
    a: 'No. Whitespace is rendered by the browser as nothing — there is no asset to download. The only spacing-related performance hit is when web fonts shift things as they load, which is the <a href="/blog/the-1-second-tax/">CLS metric in Core Web Vitals</a>. Pre-loading the font fixes that.'
  - q: 'My homepage is already crowded. Where do I cut to make room for more white space?'
    a: 'Three places, in order. (1) Below-the-fold copy that nobody reads. (2) Repetitive testimonials — three strong ones beat eight weak ones. (3) Service descriptions on the homepage — those belong on the service pages, not the home. The space you free up is what every other section needs to breathe.'
  - q: 'How does this connect to the seven-section homepage pattern?'
    a: 'White space is what makes the seven-section pattern actually work. Without enough padding between sections, the visitor cannot tell they are separate jobs. Without enough line-height inside each section, the reader bounces. The <a href="/blog/the-seven-homepage-sections/">section pattern is the structure</a>; spacing is what makes the structure legible.'
related:
  - url: /blog/the-seven-homepage-sections/
    title: 'The Seven Sections Every Small Business Homepage Needs, In Order'
  - url: /blog/designed-on-a-monitor-used-on-a-phone/
    title: 'Designed on a 27-inch Monitor. Used on a 6-inch Phone.'
  - url: /blog/redesign-or-optimize-warning-signs/
    title: 'Redesign or Optimize? The 7 Warning Signs That Decide'
---

Most "ugly" small business websites do not have a color problem. They have a spacing problem.

Set a cluttered site next to a clean one and ask which is more professional. People answer in half a second. Then ask them which colors are doing the work. They cannot tell you, because color is rarely what they were judging. They were judging margins, padding, line-height, and the breathing room between sections. They just did not know the names for it.

This post is the names. And the numbers.

## What white space actually is

<span class="tooltip-term" data-tooltip="The blank area surrounding text and elements on a page. Also called negative space. It is doing structural work — separating sections, signaling hierarchy, guiding the eye.">White space</span> is not empty space. It is the breathing room between elements that lets the eye scan without fatigue. It is not decoration. It is not "where the design didn't reach." It is content, doing the same job that punctuation does in a sentence.

A page with no white space reads like a paragraph with no commas. Technically correct. Painful to use.

The four kinds that matter most on a small business site are below. Each one has a number to start from. Each number is conservative — most builder defaults are tighter than this, and the visitor feels it.

## Four spaces that decide how a page reads

### 1. Section padding

The vertical space between two sections of the page (e.g. between the hero and the proof strip).

- **Mobile**: roughly 50 pixels top and bottom of each section.
- **Desktop**: roughly 75 to 100 pixels top and bottom.

If sections collide visually — if you cannot tell where one job ends and the next begins — the padding is too tight. If you wonder whether you have reached the bottom of the page, the padding is too generous. Most small business sites are too tight, not too generous.

### 2. Line-height (body text)

The vertical space between lines of running text.

- **Body copy**: <span class="tooltip-term" data-tooltip="The vertical space between lines of text, expressed as a multiple of the font size. 1.5 means each line is 1.5x the font height. The single most-impactful number for body-text readability.">line-height</span> of 1.4 to 1.5.
- **Headings**: line-height of 1.1 to 1.2 (tighter, because headings should feel like one unit, not a stack of lines).

The 1.5 number is doing more work than any other rule on this page. Body text at line-height 1.2 (the default in many builder templates) reads as cramped and tiring on the second paragraph. The same text at 1.5 reads as comfortable and editorial. Same words. Same font. The only change is the breathing room between lines.

### 3. Paragraph spacing

The vertical space between two paragraphs.

- **Default**: roughly 1em (the same vertical distance as one line of text).
- **Long-form posts**: increase to 1.25em on the body text.

Builders that try to "save space" by reducing paragraph margins make every page read as a single wall of text. The visitor does not see the structure. They see a paragraph. They scroll past.

### 4. Button padding

The space between the text inside a button and the button's edge.

- **Vertical** (top/bottom): roughly 0.75em.
- **Horizontal** (left/right): roughly 1.5em.

Tight buttons read as ugly and untrusty. They also fail mobile usability — a button shorter than 44 pixels in either dimension is hard to tap with a thumb. Most builder defaults are at the lower edge of the comfort zone. Hand-coded sites can ship buttons that feel right because the developer set the padding deliberately, not by trial and error inside an editor.

## Why builders ship tight defaults

The temptation in a page builder is to fit as much as possible into the screenshot. The screenshot is what wins the demo, and the demo is what closes the sale. So defaults shrink to optimize for "I can see all six features above the fold." That is a bad goal for a small business site, where the visitor has come to read one thing well, not six things at once.

The cost of tight defaults shows up later. The site reads as overwhelming on a phone. Bounce rate climbs in the data nobody is watching. The owner says, "we need a redesign," when what they actually need is a margin pass. You can read the diagnostic for that exact mistake in [our redesign-or-optimize scoreboard](/blog/redesign-or-optimize-warning-signs/) — most "redesign" calls turn out to be spacing punch lists.

## The math behind 1.5em

A common question on calls: "Why 1.5 specifically?"

The short answer: it is the ratio at which the eye stops working harder to move between lines.

The longer answer: type designers have been measuring this for a hundred years. Text at line-height 1.0 (lines touching) is unreadable. At 1.2, it is workable but cramped. At 1.5, the eye tracks comfortably. Above 2.0, lines feel disconnected and the reader has to "find" the next line. The 1.4-to-1.5 band is the sweet spot for body copy in a sans-serif font like Inter or Roboto, which is what most small business sites are using.

The same measurement holds for paragraph spacing. A 1em gap between paragraphs (the same vertical distance as one line) signals "new paragraph." Less than that and the paragraph break disappears. More than 1.5em and paragraphs feel like separate sections.

These are not aesthetic preferences. They are how the eye scans without fatigue.

## Visual hierarchy and the spacing that creates it

White space is also how you build <span class="tooltip-term" data-tooltip="The visual order in which elements on a page are read. Created by relative size, color contrast, position, and the white space around each element.">visual hierarchy</span>. A headline that is bigger than the body text but jammed against the next paragraph reads as part of the paragraph. The same headline with 1.5em of space below it reads as a header.

Hierarchy is the choreography of the page. It tells the visitor what to read first, what to read second, and what is decoration. Spacing is what choreographs it. Color is barely involved.

## A five-minute spacing audit

Open your homepage. Scroll slowly from top to bottom. Ask the four questions below.

### Question 1: Can I tell where each section ends?

If two sections collide, that seam needs more padding. If you cannot find the boundary between the hero and the next section in three seconds, you are looking at the bug.

### Question 2: Does my body text feel comfortable to read for three paragraphs?

Read three paragraphs in a row. If your eyes feel like they are working, the line-height is too tight. The fix is one CSS rule per page — `line-height: 1.5` on the body element — that takes about 45 seconds to ship and pays back permanently.

### Question 3: Are my paragraphs visually separated?

Look at a section with multiple paragraphs. If the paragraph breaks disappear, paragraph spacing is too tight. The visitor will read the section as one block of text and skip half of it.

### Question 4: Are my buttons tappable on a phone?

Open the site on the phone you actually carry. Try to tap the primary CTA without zooming. If you have to aim, the button is too small. The fix is button padding, not button color.

If you flagged any of the four, the fix is a punch list, not a redesign. We cover that work under [unlimited edits and support](/unlimited-edits-and-support/) — most spacing audits take an afternoon.

## Where we land

We hand-code every site we build, and the spacing rules above ship as defaults on every project. Section padding, line-height, paragraph margins, button padding — they all sit in a base CSS file we have refined across more than a hundred sites. Every page on every site we ship inherits the same spacing rhythm. That consistency is what makes a site feel intentional instead of assembled.

If your current site reads as cluttered and you cannot put a finger on why, the fix is most likely in this post. Same on [our pricing page](/pricing/), [the homepage](/), and every blog post you are scrolling past right now — same spacing rules, every time.

## Look at your own page

Open your homepage. Find the section that feels the most cramped. Take a screenshot. Compare it to a site you genuinely admire.

If you want a second pair of eyes on the spacing audit, [send us your URL](/contact/). We will tell you which of the four numbers needs to move.

What does your tightest section look like?
