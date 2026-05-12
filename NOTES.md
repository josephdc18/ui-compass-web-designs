# Page-Builder Export — Post-Export Fixes & Additions

Running list of everything that had to be repaired or added after the page-builder export. Feed this back to the exporter so future exports avoid the same issues.

---

## Decap CMS

### OAuth handoff fix
`functions/api/auth.js` — the export's OAuth proxy looked complete but the popup never finished Decap's two-way handshake, so login looked successful then bounced back to the login screen. The proxy now:

- Uses `SITE_URL` for the GitHub `redirect_uri`, matching the `https://uicompass.com/api/auth` callback
- Includes that same `redirect_uri` during token exchange
- Errors clearly if GitHub returns no token
- Sends Decap the exact `authorization:github:success:{ token }` message repeatedly before closing the popup, fixing the "success, close popup, still stuck on login" behavior
- Adds `site_domain: uicompass.com` in `src/admin/config.yml` (Decap recommends this for non-Netlify OAuth setups)

Verified with `npm run build`, `node --check functions/api/auth.js`, and mocked auth flows.

### Admin config wiring
Export shipped `admin/config.yml` with placeholder repo and domain values. Now points at `josephdc18/ui-compass-web-designs`, the production domain, and the live OAuth proxy endpoint.

### Editorial workflow + draft posts
Enabled `publish_mode: editorial_workflow` so "Save" commits in-progress edits to a draft branch — half-finished posts survive closing the tab. Added `src/blog/blog.11tydata.js` so posts with `draft: true` in frontmatter are excluded from production builds (gated on `CF_PAGES=1` so drafts still render in local dev for preview).

### Live preview templates
Custom `registerPreviewTemplate` rendering posts using the real blog-post layout so authors see live styling in the preview pane instead of Decap's default unstyled markup.

---

## Localization (ES persistence)

### `localizedUrl` path-rewrite filter
Export shipped a language switcher that always reset to the EN root. New filter rewrites internal links so clicking anywhere inside `/es/` keeps the visitor in `/es/`. Documented in `src/es/blog/blog.11tydata.js`. EN/ES post slugs must match for the rewrite to resolve.

---

## Blog System Overhaul

### Filter UI + hero card on `/blog/`
Replaced the export's static stacked listing with a hero card on top and a filterable grid below (`src/js/blog-filter.js`).

### Unified card shell + dark-mode variants
26 cards unified to a single shell (paper bg, grain, italic issue mark, hairline footer). 9 card template variants (`hero`, `illustrated`, `ladder`, `audit-checklist`, `metrics-trio`, `vs`, `anatomy`, `comparison`, `editorial`, `manifesto`, `metrics`, `precision`, `process`, `stat`). Dark-mode siblings auto-generated via `scripts/make-dark-cards.mjs`. Export had no card system at all.

### Editorial includes
TOC, article-actions, bookmarks, checklist, hover-prefetch, listen, print-extras, tooltips. TOC gated on `serviceToc: true` flag so it doesn't render where it doesn't belong.

### Per-category collections
`strategy`, `seo`, `design`, `performance` collections built by tag; `hero` collection driven by `hero: true` frontmatter (editorial choice, not a side effect of tagging).

### First-paint + LCP fixes
- Dropped resume-reading toast (CLS killer)
- Lazy-loaded `.blog-mainImage` (banner already shows it)
- Moved FOUC-prone selectors from async `blog-extras.css` into render-blocking `blog.css`
- Added `fetchpriority="high"` to LCP images
- Removed eager `fetchVapidKey()` from `push.js`
- `aspect-ratio: 1` on link/social/drop icons to fix Lighthouse unsized-image warnings

### Filter + frontmatter conveniences
- `mdInline` Eleventy filter renders inline markdown (no surrounding `<p>`) so YAML frontmatter strings can use `**bold**` / `*italic*` / `` `code` ``. Used by the TLDR loop.
- Added Markdown GFM table styling — export's CSS had no table styles, breaking any post with tables.

---

## Content Kit (branding & social automation)

### Content-kit directory + weekly scheduler
`content-kit/` with sources, BACKLOG/POSTED/BRAND folders, and templates. Scheduler job at `functions/scheduler/jobs/content-kit-weekly.js` plus full lib suite (browserless, LLM, readme-builder, template, topic-selector, zip, bundled assets). Wired into `functions/scheduler/index.js`.

### Blog-card screenshot pipeline
`scripts/screenshot-blog-card.mjs` (Puppeteer + Browserless) mints social-share + blog-thumbnail PNGs from HTML templates.

### Bundled content-kit assets at build time
`prebuild` script writes `functions/scheduler/lib/content-kit/_bundled.js` so the Cloudflare Worker doesn't need filesystem access at runtime.

---

## Animations & Transitions

### Theme view-transition wipe (the "wave")
Original toggle felt jumpy. Reworked to:
- 300ms duration matching the body bg transition
- Explicit z-index on old/new pseudos
- Origin set to the toggle button's rect center
- Fallback `clip-path` values for browsers without view transitions
- `animation: none` defense on named `pb-main` / `header` / `footer` regions to prevent collisions
- JS re-entrancy busy flag so rapid clicks don't stack transitions

### Page smooth transition
Smooth-scroll behavior wired up for hero CTAs and in-page anchors with `prefers-reduced-motion` respected. Export had no motion handling.

---

## Build Pipeline & Performance

### eleventy-img cross-deploy cache
Output now mirrored to `node_modules/.cache/eleventy-img-output` so CF Pages preserves it between deploys; ~57s Eleventy step drops to ~15–20s on warm builds. Requires CF Pages "Build cache" toggle on. Export ignored CF Pages' build cache entirely.

### Inlined `root.css` + gated shop bundle
New `cssInline` Nunjucks filter inlines small render-blocking CSS at build time. Shop CSS/JS gated behind `shop: true` frontmatter (export loaded it on every page).

### Sitewide nav styles
Moved nav state styles (active, hover, animated underline) from homepage-only `local.css` into `critical.css` so they apply on every page.

### `{% image %}` shortcode
Resolves site-absolute `/assets/...` paths under `./src` and auto-detects a `<slug>-dark-card.<ext>` sibling for theme switching. Replaced naïve `<img>` references that broke local builds.

---

## PWA & Notifications

### Push notifications + PWA splash
Updated `push.js`, push API handler, webmanifest, and footer markup. Export shipped stub code that didn't work.

---

## Cloudflare Functions Added Beyond Original Export

- `/api/auth` — Decap OAuth proxy
- `/api/psi-audit` + polling — PageSpeed audit pipeline (D1 jobs, R2 screenshots, Resend emails)
- `/api/audit-screenshot` — Browserless screenshot capture
- `/api/push/*` — VAPID subscription endpoints
- `/api/form` — Form submissions via Resend
- `/api/checkout`, `/api/order-status`, `/api/webhooks/*`, `/api/products` — Commerce stack
- `functions/scheduler/*` — Cron-driven jobs (content-kit weekly, PSI cleanup)

---

## Patterns to Flag for the Exporter

1. **Every CMS-related thing needed manual repair** — OAuth handshake incomplete, repo placeholders, draft filter not wired, editorial workflow off, live preview using defaults.
2. **No CF Pages build-cache awareness** — every redeploy reprocesses every image.
3. **Localization was decorative, not functional** — switcher reset to `/`, no path-rewrite filter.
4. **Render-blocking CSS strategy was uniform** — needed per-page bundle gating (`shop: true`, `serviceToc: true`, `hero: true`) and critical-CSS inlining.
5. **Dark mode shipped non-functional** with a jumpy view-transition wipe.
6. **Sitewide nav styles lived in homepage-only CSS.**
7. **Image pipeline assumed assets were already optimized** — no responsive variant generation, no dark sibling resolution.
8. **PWA + push code was stubbed** rather than functional.
