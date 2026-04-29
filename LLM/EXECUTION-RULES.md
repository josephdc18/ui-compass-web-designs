# EXECUTION-RULES.md

Discipline rules for editing this exported 11ty site. Apply to every session, whether you are Claude, a human, or another LLM.

## Never invent — always verify

- ❌ Never invent class names, data-attributes, CSS variables, D1 column names, env var names, or file paths.
- ✅ Always grep the codebase before referring to a symbol. `data-pb-section`, `[data-pb-section="hero-2470"]`, CSS var names like `--primary`, and table names in `database/schema.sql` are the source of truth.
- ✅ If the task mentions a section, open `_reference/section-sources/<category>/` first and read the original CodeStitch dump before re-writing its markup.

## Read before writing

- ❌ Never edit a file you haven't read in this session.
- ✅ Read `src/_layouts/base.html` before changing head tags, CSP, or global scripts.
- ✅ Read `src/css/local.css` to see how sections are scoped before adding new per-section CSS.
- ✅ Read `database/schema.sql` before writing any SQL — columns that aren't in the schema don't exist.

## Preserve the scoping contract

Page Builder scopes every section's CSS and JS with a `[data-pb-section="<id>"]` attribute.

- ❌ Never remove or rename a `data-pb-section` attribute on a `<section>` tag.
- ❌ Never hoist a selector out of its `[data-pb-section]` wrapper — you will leak styles globally.
- ✅ Always write new per-section CSS **inside** the `[data-pb-section="<id>"]` selector block already in `src/css/local.css`.

## Error handling is mandatory

- ✅ Always wrap D1 queries and `fetch()` in try/catch. Return meaningful HTTP status codes from Functions (401 on auth fail, 400 on bad input, 500 on internal error).
- ✅ Always validate user input before using it. Never interpolate user input into SQL — use `db.prepare(...).bind(value)`.
- ✅ Never log secrets (env vars, session tokens) to console.

## Ask when unsure

- ❌ Never guess at column names, env var names, or route shapes you can't find by grep.
- ✅ Ask the user for the authoritative value, or read the binding declaration in `wrangler.toml`.

## Stay within the diff the user asked for

- ❌ Never refactor unrelated code while fixing a narrow bug.
- ❌ Never re-format files, re-order imports, or re-indent code that wasn't part of the requested change.
- ✅ If you see a separate issue, mention it in your summary — don't silently fix it.

## Don't re-architect the export

This is output from a generator. It is NOT the generator.

- ❌ Never try to "clean up" the `[data-pb-section]` system, the `src/css/local.css` scoping, or the pack-specific CSS namespaces (`.inv-*`, `.msg-*`, etc.). They exist for a reason.
- ❌ Never convert HTML-in-`src/pages/` to components, partials, or layouts without explicit approval — the page structure is intentional.
- ✅ If a pattern feels wrong, explain why and let the user decide.

## When you change markup

- ✅ Re-test in `npm start` (dev server) before claiming a change works. CSS selector fragility is the #1 regression source here.
- ✅ If you change a section's markup, verify the matching selectors in `src/css/local.css` still apply.
- ✅ If you change `src/_includes/header.html`, verify nav scripts in `src/assets/js/nav.js` still work (mobile toggle, dropdowns).

## When you change D1 (`database/schema.sql`)

- ❌ Never silently add a column. `schema.sql` is for fresh DBs. Deployed DBs need an explicit migration.
- ✅ For a new column, create `migrations/NNN-description.sql` with just the ALTER, and document the migration command in your summary.
- ✅ Always use parameterized queries; never interpolate user input.

## When you change `functions/api/`

- ✅ Test locally with `wrangler pages dev public/` — Functions don't run under plain `eleventy`.
- ✅ Keep `env.DB` as the D1 binding name — it is assumed everywhere.
- ✅ Preserve existing auth patterns. If a route currently checks a token, don't remove that check.

## Reference material — how to use `_reference/`

This folder is read-only context, not part of the build.

- `_reference/original-template/` — the starting template scrape Page Builder derived this site from. Use it for visual diff and "please make it look like the original" tasks.
- `_reference/section-sources/<category>/<file>.html` — the raw CodeStitch HTML for every section placed in this site. Use it before restructuring a section's markup.

Never import from `_reference/` at build time. It is not on the 11ty include path.

## Summary checklist before declaring a task done

- [ ] Site still builds clean (`npm run build`).
- [ ] Dev server loads all pages without console errors (`npm start`).
- [ ] No broken selectors in `src/css/local.css` (sections still scoped).
- [ ] No un-parameterized SQL, no logged secrets.
- [ ] Changes match the diff the user asked for — no collateral cleanup.
