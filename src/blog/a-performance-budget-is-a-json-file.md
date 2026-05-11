---
pageName: a-performance-budget-is-a-json-file
blogTitle: A Performance Budget Is a JSON File Your Build Fails On
titleTag: A Performance Budget Is a JSON File
blogDescription: A site at 95 PageSpeed today is a site at 70 PageSpeed in six months. Plugins update. Images get uploaded oversized. Scripts get added. A performance budget is the small JSON file that fails the deploy when any of those things happen, so the regression never reaches production.
author: "Joseph C."
date: 2025-10-03T16:00:00.000Z
tags:
  - post
  - performance
category: "Performance"
readMins: 6
topper: "Performance"
image: /assets/images/a-performance-budget-is-a-json-file-card.png
imageAlt: A terminal window showing a build process failing with a performance budget violation, alongside a JSON config file
tldrTitle: What you need to know
tldr:
  - 'Most sites that ship at **95 PageSpeed** drift back to **70 within six months**. Plugins update, images get uploaded oversized, third-party scripts get added. The site rots quietly.'
  - 'A **performance budget** is a small JSON file your build process reads. If any deploy exceeds the thresholds (image weight, script size, LCP, CLS), **the build fails before reaching production**.'
  - 'Five thresholds worth budgeting: **total page weight** (under 1MB), **JavaScript bundle** (under 200KB), **CSS** (under 80KB), **largest image** (under 200KB), **LCP** (under 2.5s).'
  - 'Setup is roughly **30 minutes** once. After that, performance is enforced automatically. The team that uploads the 4MB hero photo gets a red error in CI instead of a silent score drop on production.'
faq:
  - q: 'What is a performance budget exactly?'
    a: 'A small configuration file (typically JSON) that lists threshold values for performance metrics: maximum page weight, maximum JavaScript size, maximum LCP time, etc. The values are enforced by a build tool that runs as part of your deploy pipeline. When a change violates one or more thresholds, the build fails and the change does not reach production. The pattern is borrowed from financial budgeting — you decide the limits in advance, and the spending gets caught at the line item, not at year-end.'
  - q: 'Which tool actually enforces the budget?'
    a: 'Several options. <strong><a href="https://github.com/GoogleChrome/lighthouse-ci">Lighthouse CI</a></strong> is the most popular and runs the same Lighthouse audit as <a href="/blog/the-1-second-tax/">PageSpeed Insights</a> against your built site. <strong>bundlesize</strong> is a smaller tool that just checks JavaScript and CSS file sizes. <strong>SpeedCurve</strong> and <strong>Calibre</strong> are paid commercial options with more sophisticated dashboards. For most small business sites, Lighthouse CI in the open-source version (free) is enough.'
  - q: 'Will this work on WordPress?'
    a: 'Yes, but with caveats. Lighthouse CI runs against a deployed URL, so the workflow is "deploy to staging, run audit, if it passes, promote to production." That works on managed hosting (WP Engine, Kinsta) that have a staging environment. Shared hosting without a staging URL is harder. Plugin updates that drop your score still get caught — they just get caught after they reach staging instead of before.'
  - q: 'What thresholds should a small business site actually set?'
    a: 'Conservative defaults that we recommend: total page weight under 1MB, JavaScript under 200KB, CSS under 80KB, single largest image under 200KB, <a href="/blog/the-1-second-tax/">LCP under 2.5 seconds</a>, CLS under 0.1, INP under 200ms. Start there. If the site is heavier than these (most builder-template sites are 2-4MB), set the initial budget at "current weight" and tighten it month by month as you ship optimizations.'
  - q: 'What happens when a deploy violates the budget?'
    a: 'The build process fails. Lighthouse CI (or whichever tool you use) returns a non-zero exit code, the CI/CD pipeline sees the failure, and the deploy is blocked. The developer or content editor sees the error message immediately: "Page weight exceeds budget (1.4MB > 1.0MB)." They fix the issue (usually by resizing the image they just uploaded) and retry. Production never sees the regression.'
  - q: 'Is this overkill for a small business site?'
    a: 'No, but it does require a build process to begin with. Hand-coded static sites (Eleventy, Astro, Hugo) have one by default. WordPress sites with managed hosting often have one or can have one added. Wix and Squarespace generally do not. If your site is on a builder without a build step, the performance budget conversation is actually a <a href="/blog/the-10x-load-time-gap/">platform conversation</a> — the budget is the symptom, the platform is the cause.'
  - q: 'How does this connect to the four-dependencies-to-delete and font-subsetting posts?'
    a: 'A performance budget is the structural enforcement layer for everything those posts describe. <a href="/blog/four-dependencies-to-delete/">Remove the 4 dependencies</a>, <a href="/blog/a-36kb-png-becomes-a-2kb-svg/">cut image weight</a>, <a href="/blog/font-subsetting-180kb-to-18kb/">subset your fonts</a> — then the budget locks the gains in place so they cannot quietly come back. Without the budget, every cleanup pass has a 6-month half-life.'
  - q: 'What is the most common budget violation in practice?'
    a: 'An image uploaded straight from a phone camera or stock library, at the original resolution (3000–5000 pixels wide, 2–6MB). The image looks fine in the editor and on the staging preview. The performance budget catches it on the next build because the page weight crossed the threshold. Without the budget, the 4MB image ships to production and the mobile PageSpeed score drops 15 points overnight with nobody knowing why.'
related:
  - url: /blog/the-1-second-tax/
    title: 'The 7% Conversion Tax of a 1-Second Delay'
  - url: /blog/four-dependencies-to-delete/
    title: 'The 4 Dependencies to Delete From Your Small Business Site'
  - url: /blog/hosting-decides-your-performance-ceiling/
    title: 'Your Hosting Decides Your Performance Ceiling'
---

A site that ships at 95 PageSpeed today is, statistically, a site at 70 PageSpeed in six months.

This is not pessimism. It is what happens by default. Plugins update and ship a new bundle. A team member uploads a 4-megabyte hero photo straight from a phone. A marketing manager pastes in a third-party tracking script. Each individual change feels small to the person making it, and nobody is running a Lighthouse audit on a Tuesday morning to catch it. The score drops 3 to 5 points per silent regression. Six months later, the site is back where it started.

A <span class="tooltip-term" data-tooltip="A small JSON file that lists threshold values for performance metrics (page weight, script size, LCP, etc.). The build process reads it and fails the deploy when any threshold is exceeded.">performance budget</span> is the structural fix for this drift. This post is what it is, what to put in it, and the 30-minute setup that locks every optimization gain in place permanently.

## Why optimization passes have a 6-month half-life

Optimization is a one-time act. Drift is continuous. The mismatch is structural.

Most small business sites we audit have been optimized at some point. A previous developer ran [the four-dependencies-to-delete pass](/blog/four-dependencies-to-delete/) or [the image pipeline](/blog/a-36kb-png-becomes-a-2kb-svg/). The score moved into the 90s. The work was real and the win was real.

Then time passed. Marketing added an embed. A theme update shipped a new bundle. A new client testimonial got uploaded at original phone-camera resolution. Each event was invisible at the time. The cumulative effect was a slow score regression nobody noticed until someone ran PageSpeed Insights "for fun" and saw a 72.

The fix is not to run the optimization pass again. The fix is to make the regressions visible at the moment they happen, before they reach production.

## What a performance budget actually is

A small text file. Usually JSON. Stored alongside the rest of your site's code.

```json
{
  "budget": [
    {
      "path": "/*",
      "timings": [
        { "metric": "interactive", "budget": 3000 },
        { "metric": "first-contentful-paint", "budget": 1500 }
      ],
      "resourceSizes": [
        { "resourceType": "script", "budget": 200 },
        { "resourceType": "stylesheet", "budget": 80 },
        { "resourceType": "image", "budget": 400 },
        { "resourceType": "font", "budget": 60 },
        { "resourceType": "total", "budget": 1000 }
      ]
    }
  ]
}
```

The numbers in the file are the thresholds. The build process reads the file. When you deploy a change, an audit runs against the built site and compares the actual values to the budget. If any value exceeds its budget, the build returns an error. The change does not reach production.

That is the entire concept. Set the limits once. Catch every regression automatically.

## The five thresholds worth budgeting

You can budget dozens of metrics. For a small business site, five do almost all the work.

### 1. Total page weight (under 1MB)

The sum of HTML, CSS, JS, images, fonts, and everything else the page downloads. Most builder-template sites land at 2 to 4MB. Most well-built hand-coded sites land at 600KB to 1MB. The budget at 1MB catches the 4MB hero-photo regression on the first deploy.

### 2. JavaScript bundle (under 200KB)

Total JavaScript shipped to the browser. The number that controls how much work the browser does before the page becomes interactive. 200KB is generous for a small business site — most marketing pages need under 100KB. The budget at 200KB catches the new chat-widget install before it ships.

### 3. CSS (under 80KB)

Total stylesheet weight. Tighter than people expect, easy to hit on a hand-coded site, hard to hit on a Bootstrap-based or theme-based WordPress site. The budget at 80KB catches the next theme update that ships an extra 50KB of unused styles.

### 4. Single largest image (under 200KB)

A separate threshold from total page weight. Catches the specific case of one heavy image dragging down LCP. Most homepages should have no image over 100KB on mobile — the budget at 200KB is the upper bound, not the target. See [our image pipeline post](/blog/a-36kb-png-becomes-a-2kb-svg/) for what individual images should actually weigh.

### 5. LCP under 2.5 seconds

The Core Web Vital that Google grades you on. The budget at 2.5 seconds is the Google "Good" threshold. If LCP drifts above 2.5, the budget fails the build. This is the highest-leverage single threshold — it indirectly catches font issues, image issues, hosting issues, and render-blocking script issues all at once.

## How a build actually enforces the budget

The flow looks like this on a typical hand-coded or static-site setup.

### Step 1: Developer or content editor pushes a change

A commit lands in the repository. Code change, content edit, image upload — any kind of change that affects what the deployed site contains.

### Step 2: CI/CD pipeline builds the site

A continuous-integration service (GitHub Actions, GitLab CI, Netlify, Vercel, Cloudflare Pages) compiles the site into static HTML/CSS/JS files.

### Step 3: Lighthouse runs against the built site

<span class="tooltip-term" data-tooltip="An open-source tool from Google that audits a deployed site for performance, accessibility, SEO, and best practices. Lighthouse CI is the build-step version that runs in your pipeline.">Lighthouse CI</span> spins up a headless Chrome, loads the page, and measures everything in the budget. Page weight, bundle size, LCP, CLS, the works.

### Step 4: Compare against the budget JSON

Lighthouse CI reads `lighthouse-budget.json` (or whatever you named it). For every metric in the budget, it checks whether the audited value is within the threshold.

### Step 5: Pass or fail the build

If every metric is within budget, the build succeeds and the site deploys. If any metric exceeds, the build fails with an explicit error: "Page weight exceeds budget (1.4MB > 1.0MB). See /resources/hero-image.jpg (1.2MB)."

The developer sees the error, fixes it (usually by resizing or compressing the offending asset), and pushes again. The bad version never reaches production.

## A 30-minute setup

Assuming you have a build pipeline (Eleventy, Astro, Hugo, Next.js, Gatsby, or any modern stack), the setup is fast.

### Step 1: Install Lighthouse CI (5 minutes)

```bash
npm install --save-dev @lhci/cli
```

That installs the command-line tool. No service to sign up for, no account to create.

### Step 2: Create the budget file (10 minutes)

Save a JSON file at the root of your repo, named `lighthouse-budget.json`. Use the template from earlier in this post as a starting point. Adjust the numbers to your current site's actual values — if your current page weight is 1.2MB, start the budget at 1.3MB and tighten over time.

### Step 3: Wire it into CI (10 minutes)

Add a step to your existing CI config (GitHub Actions example):

```yaml
- name: Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun --collect.url=https://staging.yoursite.com \
                 --assert.budgetsFile=lighthouse-budget.json
```

The exact syntax varies by CI provider, but every modern CI tool has the equivalent. Cloudflare Pages and Netlify both have built-in Lighthouse integrations that can be enabled with a checkbox.

### Step 4: Run it once and adjust (5 minutes)

The first time the budget runs, it will fail or pass against your current site. Adjust the thresholds to match where you actually are, then tighten progressively over the next quarter. The goal is to lock in gains as you ship them, not to fail the build on day one for no actionable reason.

## The plugin-update problem

The most common silent regression on small business sites is a plugin update. The owner clicks "update" on a WordPress dashboard because the badge said there was a security patch. The update ships a new bundle that is 80KB larger than the old one. The PageSpeed score drops 6 points overnight. Nobody notices for three months until a customer complains the site feels slow.

A performance budget catches this on the next deploy. The update gets applied on staging first, the Lighthouse audit runs, the script-size budget fails because the bundle now exceeds 200KB, and the deploy is blocked. The owner sees the error and either rolls back the plugin update or removes a different script to make room.

On managed WordPress hosting (WP Engine, Kinsta) with a staging environment, this workflow works out of the box. On shared hosting without staging, the safety net is harder to wire up — which is part of why we recommend [edge-served or managed hosting](/blog/hosting-decides-your-performance-ceiling/) over shared hosting for any client serious about performance.

## What the budget cannot catch

Two things that fall outside what an automated budget can enforce.

### Quality regressions in alt text or content

Lighthouse can flag missing alt text, but it cannot tell you whether the alt text is meaningful. The [accessibility audit](/blog/wcag-2-2-aa-in-five-minutes/) still needs a quarterly human pass.

### Conversion regressions

A faster site can still convert less if the homepage gets a bad headline rewrite or the form gets broken in a way that does not show up in automated tests. [The contact form audit](/blog/the-contact-form-audit/) catches the form-delivery silent failures. A budget does not.

The budget enforces performance. Other forms of testing have to cover quality, conversion, and accessibility separately.

## Where we land

Every site we ship has a performance budget in place at launch. The thresholds are set conservatively (well below the failing band), and tightening happens as we ship optimization passes that lower the actual values. Clients hosting with us never see a quiet PageSpeed regression — the budget catches the change before it reaches production.

For clients on existing builders or non-budget-enforced setups, we usually fold a budget into the next round of [unlimited edits and support](/unlimited-edits-and-support/) work. Adding the budget is one of the highest-leverage one-time investments on the performance-maintenance side of a site.

If your current site has no budget and the score has drifted, [send us your URL](/contact/). We will run a Lighthouse audit, document where the score is today, and quote the budget setup as a one-time engagement.

## Check your current state

Open [pagespeed.web.dev](https://pagespeed.web.dev/) and run your homepage. Compare the mobile score to what you remember from the last time you checked.

If it has drifted, you have a budget problem.

Where is your score today versus six months ago?
