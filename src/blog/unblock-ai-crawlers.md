---
pageName: unblock-ai-crawlers
blogTitle: Your robots.txt Is Blocking the AI Crawlers
titleTag: Your robots.txt Is Blocking the AI Crawlers
blogDescription: Three lines in robots.txt decide whether ChatGPT, Perplexity, and Google AI Overviews can read your site at all. Most builder defaults block them. The 5-minute fix that puts you back in the AI citation pool.
author: "Joseph C."
date: 2025-11-08T16:00:00.000Z
tags:
  - post
  - seo
category: "SEO"
readMins: 6
topper: "SEO"
image: /assets/images/unblock-ai-crawlers-card.png
imageAlt: A laptop screen showing a robots.txt configuration file with AI crawler user-agents
tldrTitle: Key Takeaways
tldr:
  - 'Roughly **90% of pages cited in ChatGPT do not appear in Google''s top 20**. AI search picks from a different pool, and most builder sites are not in either.'
  - 'Three to four lines in your **robots.txt** decide whether ChatGPT, Perplexity, and Google AI Overviews can read your site at all. The fix is 5 minutes.'
  - 'A robots.txt fix only matters if the bot can read the page. Most AI crawlers cannot run JavaScript, so **JS-rendered builder sites ship as empty shells**.'
  - '**AI-referred traffic converts 3–5x higher** than traditional organic. Fewer visitors, more leads. The cheapest channel of 2026 is the one most owners have not heard of yet.'
faq:
  - q: 'Will updating my robots.txt hurt my Google rankings?'
    a: 'No. Allowing OAI-SearchBot, PerplexityBot, and GoogleOther does not affect Googlebot or any blue-link ranking. The rules are crawler-specific. You are adding permission for new crawlers, not changing what the existing ones can see.'
  - q: 'How do I update robots.txt on Wix, Squarespace, or WordPress?'
    a: 'On <strong>Wix</strong>: SEO Tools → Robots.txt Editor. On <strong>Squarespace</strong>: Settings → Advanced → robots.txt (limited override; contact support for bot-specific rules). On <strong>WordPress</strong>: <a href="https://yoast.com/">Yoast</a> or <a href="https://rankmath.com/">Rank Math</a> both expose a robots.txt editor under their tools section. After saving, refresh <code>yoursite.com/robots.txt</code> in a private window to confirm the change is live.'
  - q: 'How do I check what bots are visiting my site?'
    a: 'Look at your server access logs (Cloudflare, Netlify, or your host''s analytics). Filter by user-agent for "GPTBot", "OAI-SearchBot", "PerplexityBot", "ClaudeBot", "Google-Extended", "GoogleOther". If you see hits from those names after the fix, the bots are reaching you. If you see them being denied, your hosting layer is overriding robots.txt — separate fix needed.'
  - q: 'Is GEO replacing SEO, or is this on top of it?'
    a: 'On top of it. Traditional SEO still drives the majority of organic traffic. <a href="/blog/faq-schema-3x-screen-space/">FAQ schema</a>, <a href="/blog/the-1-second-tax/">page speed</a>, and clean HTML do double duty for both. GEO is a layer of optimization specific to how language models retrieve and cite, not a replacement.'
  - q: 'How long until I see AI-referred traffic after the fix?'
    a: 'Indexing windows vary. Bing typically picks up content within 1–2 weeks (which feeds ChatGPT). Perplexity is faster, often days. Google AI Overviews follow regular Googlebot crawling, so usually 2–4 weeks for new pages. Existing pages with the new robots.txt rules show up sooner.'
  - q: 'Does Bing actually matter again?'
    a: 'For AI search, yes. ChatGPT''s search feature runs on Bing''s index. About 87% of ChatGPT''s citations match results in Bing''s top 10. If you are not indexed in Bing, you are not in the pool ChatGPT pulls from. <a href="https://www.bing.com/webmasters">Bing Webmaster Tools</a> is a 5-minute setup most owners skip.'
  - q: 'My site is on a builder and JavaScript-heavy. Is the robots.txt fix worth it?'
    a: 'Partially. The fix gets the bot to your site. Whether it can read your content is a separate question. If your homepage is blank with JavaScript disabled, the AI sees the same blank page. The bigger conversation there is whether to <a href="/blog/redesign-or-optimize-warning-signs/">rebuild on a hand-coded foundation</a>.'
related:
  - url: /blog/faq-schema-3x-screen-space/
    title: 'FAQ Schema Turns One Blue Link Into 3x Screen Space'
  - url: /blog/the-1-second-tax/
    title: 'The 7% Conversion Tax of a 1-Second Delay'
  - url: /blog/the-bilingual-maturity-ladder/
    title: 'The Bilingual Maturity Ladder, A Playbook for English/Spanish Sites'
---

Ninety percent of the pages ChatGPT cites do not appear in Google's top twenty results. The AI is picking from a different pool than the one you have been optimizing for.

That is not the headline, though. The headline is that your site might not be in either pool. Three lines in your <span class="tooltip-term" data-tooltip="A plain-text file at the root of your site that tells search engines and other automated crawlers which pages they are allowed to fetch.">robots.txt</span> file decide whether ChatGPT can read your site at all. Most builder defaults leave those three lines out.

This post is the five-minute fix.

## What the AI bots actually want

ChatGPT, Perplexity, and Google's AI Overviews each ship with their own crawler. Each crawler has a name (a <span class="tooltip-term" data-tooltip="The string a bot uses to identify itself in HTTP requests. e.g., 'OAI-SearchBot' for ChatGPT search, 'PerplexityBot' for Perplexity.">user-agent</span>) that your robots.txt either greenlights or blocks.

### The four crawlers that matter right now

- **OAI-SearchBot** for ChatGPT search.
- **PerplexityBot** for Perplexity.
- **GoogleOther** for Google's AI Overviews.
- **Google-Extended** for Gemini training and answer pulls.

If your robots.txt does not name these explicitly, you are at the mercy of the wildcard rules. And on a Wix, Squarespace, or default WordPress install, the wildcard rules are written for Google's classic crawler. They were not written for what showed up in late 2024.

## How to check yours in 30 seconds

Type your domain into your browser, then add `/robots.txt` to the end. Press enter.

You will see a plain-text file. Look for two things.

### Is the AI block present at all?

Look for the lines `User-agent: OAI-SearchBot` and `User-agent: PerplexityBot`. If they are not present at all, your site is operating on the default rules, which most large language models read as ambiguous. Some respect ambiguity. Some do not.

### Is anything explicitly disallowed?

Look for `Disallow: /` under any user-agent block. That single character disallows the entire site for that crawler. It is a common builder default for staging environments that gets shipped to production by accident.

## The fix

You want robots.txt to explicitly allow the AI bots and explicitly point them at your sitemap. Three or four lines, depending on how granular you want to be.

```
User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: GoogleOther
Allow: /

Sitemap: https://yoursite.com/sitemap.xml
```

That is the whole change. If you are on a hand-coded site, you edit the file directly. If you are on Wix, Squarespace, or Webflow, you go into the SEO settings and either paste this into the robots.txt override field or contact support to add it. WordPress users typically have a Yoast or Rank Math interface that exposes the same field.

After you save it, refresh the public `/robots.txt` URL and confirm the new lines are live. If they are not, the override did not take.

## The deeper problem nobody mentions

A robots.txt fix only matters if the bot can actually read your page. Many of them cannot.

### Why JavaScript-rendered sites are invisible

OAI-SearchBot and PerplexityBot do not reliably execute JavaScript. If your site ships as an empty HTML shell that gets rendered into content by client-side JavaScript (which is how most page builders deliver Wix sites, Squarespace sites, and React-heavy WordPress themes), the bot sees the shell. It does not see your content.

There is no robots.txt fix for that. The fix is <span class="tooltip-term" data-tooltip="HTML that arrives from the server already containing the visible content, instead of being assembled in the browser by JavaScript after the page loads.">server-rendered HTML</span>. Your homepage, your service pages, and your blog posts need to ship with the actual text inside the response. Hand-coded sites do this by default. Static-generated sites (Astro, Eleventy, Hugo) do this by default. Most builder platforms do not. The same issue is what tanks your [PageSpeed score](/blog/the-1-second-tax/), so the fix pays off twice.

### The 30-second test

Turn off JavaScript in your browser and reload your homepage. If you see a blank page or a "this site requires JavaScript" message, the AI is seeing the same thing.

If your site fails this test, the conversation is no longer about robots.txt. It is about whether your platform is the right foundation, which is the question we cover in [Redesign or Optimize? The 7 Warning Signs](/blog/redesign-or-optimize-warning-signs/).

## The format that AI cites

Once the bot can read your page, format starts to matter. About a third of AI citations across the major engines come from listicles, comparisons, and tables. Q&A and how-to formats round out most of the rest.

A small business site should plan for two structural moves on the pages that need to win in AI search.

### Write each section as a self-contained answer

Two hundred to three hundred words, under a question-shaped header, that could be lifted out of context and still make sense. The model wants quotable chunks, not flowing essays. This is the same structural advice that helps human readers, which is why <span class="tooltip-term" data-tooltip="Content broken into self-contained 200–300 word blocks, each under a question-shaped header. The format AI search engines prefer for citation.">semantic chunking</span> is the format we use across all of our blog posts.

### Use FAQ schema on every service page

The same FAQ block you would put on a service page for traditional SEO does double duty for AI search. The structured data tells the model exactly which question each block is answering. The full pattern is in [FAQ Schema Turns One Blue Link Into 3x Screen Space](/blog/faq-schema-3x-screen-space/).

If your site already publishes blog posts but has no FAQ pages and no question-style headers in the body, that is the second-biggest gap after robots.txt.

## Why this matters now

AI-referred traffic converts three to five times higher than traditional organic traffic. Fewer visitors. More leads. A small fraction of search traffic is moving to AI engines every month, and the people moving early are the ones who landed on the rubric while it was still being written.

You do not need a strategy. You need a robots.txt fix and a content format that the model can quote. Five minutes for the first. Six months of disciplined publishing for the second.

## What we do here

We hand-code every site we ship, which means the robots.txt is editable, the HTML is server-rendered, and the schema is hand-written instead of plugin-generated. That is not a marketing pitch. It is a description of what is required to be readable by an AI crawler in the first place.

If you are on a builder platform and your robots.txt fix does not stick, that is the underlying issue. We can help you decide whether the gap is worth a rebuild or whether a smaller intervention will hold. The same conversation lives under [our SEO services](/search-engine-optimisation/) and [web development](/web-development/).

## Run the check

Open `yoursite.com/robots.txt` right now. Look for OAI-SearchBot and PerplexityBot. If they are not there, you have a five-minute project.

If you find a `Disallow: /` line you did not put there, [send us the URL](/contact/). We will help you figure out who did.

What did your robots.txt say?
