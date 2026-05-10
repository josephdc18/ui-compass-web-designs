/**
 * readme-builder.js
 *
 * Generates two markdown documents from the week's run:
 *
 *   1. The README.md placed at the root of the zip — meant for the user to
 *      read alongside the assets. Includes per-post summaries, source refs,
 *      and instructions for claiming entries in BACKLOG.md.
 *
 *   2. The email body (text + HTML) — short summary of what's in the zip,
 *      plus the R2 archive link for re-download.
 */

const PLATFORMS = ['instagram', 'facebook', 'linkedin'];

function lastLine(str) {
    if (!str) return '';
    const lines = String(str).trim().split('\n');
    return lines[lines.length - 1] || '';
}

/**
 * Build the README.md that lives inside the zip.
 *
 * @param {object} args
 * @param {string} args.weekId           - e.g. "2026-W19"
 * @param {string} args.runDate          - e.g. "May 12, 2026"
 * @param {Array}  args.posts            - array of post objects (see zip.js)
 * @param {Array}  args.warnings         - array of { template, message }
 * @param {string} args.archiveUrl       - optional R2 presigned URL
 */
export function buildReadme({ weekId, runDate, posts, warnings = [], archiveUrl = null }) {
    const lines = [];

    lines.push(`# UI Compass content kit, ${weekId}`);
    lines.push('');
    lines.push(`Generated ${runDate}.`);
    lines.push('');
    lines.push(`This zip contains ${posts.length} post packages. Each folder holds a populated graphic (PNG + source HTML) plus three copy variants for Instagram, Facebook, and LinkedIn.`);
    lines.push('');

    if (archiveUrl) {
        lines.push(`Re-download: ${archiveUrl}`);
        lines.push('');
    }

    lines.push('## What to do with this');
    lines.push('');
    lines.push('1. Open each `graphic.png` and decide if you want to ship it or rework. The matching `graphic.html` is included for tweaks.');
    lines.push('2. Pick a platform variant per post. The copy is written to BRAND.md voice rules: short declarative sentences, second person, no hedging.');
    lines.push('3. When you publish a post, mark its backlog entry `[claimed]` (or remove it) in `content-kit/BACKLOG.md`, and add an entry to `content-kit/POSTED.md` so we don\'t cycle the same angle again.');
    lines.push('');

    if (warnings.length > 0) {
        lines.push('## Templates with no eligible entry this week');
        lines.push('');
        for (const w of warnings) {
            lines.push(`- **${w.template}**: ${w.message}`);
        }
        lines.push('');
        lines.push('Add backlog entries tagged with the missing template names so next week\'s run picks them up.');
        lines.push('');
    }

    lines.push('## Posts in this kit');
    lines.push('');

    for (const post of posts) {
        const idx = String(post.index || 0).padStart(2, '0');
        lines.push(`### ${idx}. ${post.template}`);
        lines.push('');
        lines.push(`**Topic:** ${post.topic}`);
        if (post.section) lines.push(`**Section:** ${post.section}`);
        if (post.sources && post.sources.length > 0) {
            lines.push(`**Sources:** ${post.sources.map((s) => `\`${s}\``).join(', ')}`);
        }
        lines.push('');

        if (post.error) {
            lines.push(`**Status:** screenshot failed. Reason: \`${post.error}\``);
            lines.push('');
            lines.push('The populated HTML is in this folder. Open it in a browser at 1080×1350 and capture manually if you want to ship it.');
            lines.push('');
        } else {
            lines.push(`**Status:** ready to ship.`);
            lines.push('');
        }

        // Hashtags row — pull from the last line of each platform copy as a quick reference.
        const hashtagsByPlatform = {};
        for (const p of PLATFORMS) {
            const tags = lastLine(post[p]);
            if (tags && tags.includes('#')) hashtagsByPlatform[p] = tags;
        }
        if (Object.keys(hashtagsByPlatform).length > 0) {
            lines.push('**Hashtags:**');
            for (const [p, t] of Object.entries(hashtagsByPlatform)) {
                lines.push(`- \`${p}\`: ${t}`);
            }
            lines.push('');
        }

        lines.push('---');
        lines.push('');
    }

    lines.push('## Generation notes');
    lines.push('');
    lines.push('- Backlog entries used here will be locked from re-pick for 12 weeks.');
    lines.push('- Numbers in the copy come from the source `.md` files in `content-kit/sources/`. The LLM is instructed not to fabricate stats.');
    lines.push('- Voice linter checked each variant for emojis, em-dashes, banned phrases, AI tells, and word counts.');
    lines.push('- If something reads off, edit the markdown directly. The kit is a draft, not auto-publish.');
    lines.push('');

    return lines.join('\n');
}

/**
 * Build a short email summary of what's in the kit.
 * Returns { text, html }.
 */
export function buildEmail({ weekId, runDate, posts, warnings = [], archiveUrl = null }) {
    const successCount = posts.filter((p) => !p.error).length;
    const failCount = posts.length - successCount;

    const textLines = [];
    textLines.push(`UI Compass content kit, ${weekId}`);
    textLines.push('');
    textLines.push(`${posts.length} posts in the attached zip (${successCount} screenshots, ${failCount} HTML-only fallback${failCount === 1 ? '' : 's'}).`);
    textLines.push('');
    textLines.push('Posts:');
    for (const post of posts) {
        const idx = String(post.index || 0).padStart(2, '0');
        const status = post.error ? ' (HTML only, screenshot failed)' : '';
        textLines.push(`  ${idx}. [${post.template}] ${post.topic}${status}`);
    }
    if (warnings.length > 0) {
        textLines.push('');
        textLines.push(`No backlog entry available for: ${warnings.map((w) => w.template).join(', ')}`);
    }
    if (archiveUrl) {
        textLines.push('');
        textLines.push(`Archive copy: ${archiveUrl}`);
    }
    textLines.push('');
    textLines.push('Each folder in the zip has a populated graphic plus IG, FB, and LinkedIn copy variants. README.md inside the zip has per-post details and next steps.');
    textLines.push('');
    textLines.push(`Generated ${runDate}.`);

    const text = textLines.join('\n');

    const htmlPosts = posts
        .map((post) => {
            const idx = String(post.index || 0).padStart(2, '0');
            const errorTag = post.error
                ? ` <span style="color:#a00;font-size:13px">(HTML only, screenshot failed)</span>`
                : '';
            return `<li style="margin-bottom:8px"><strong>${idx}. ${escapeHtml(post.template)}</strong>${errorTag}<br><span style="color:#4e4b66">${escapeHtml(post.topic)}</span></li>`;
        })
        .join('');

    const html = `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#262421;line-height:1.5;max-width:640px;margin:0 auto;padding:24px">
  <h1 style="font-size:22px;margin:0 0 16px">UI Compass content kit, ${escapeHtml(weekId)}</h1>
  <p style="margin:0 0 16px"><strong>${posts.length}</strong> posts in the attached zip (${successCount} screenshots, ${failCount} HTML fallback${failCount === 1 ? '' : 's'}).</p>
  <ol style="padding-left:20px;margin:0 0 20px">${htmlPosts}</ol>
  ${warnings.length > 0 ? `<p style="margin:0 0 16px;color:#7a7889;font-size:14px">No backlog entry for: <code>${warnings.map((w) => escapeHtml(w.template)).join(', ')}</code></p>` : ''}
  ${archiveUrl ? `<p style="margin:0 0 16px"><a href="${escapeHtml(archiveUrl)}" style="color:#006940">Archive copy</a></p>` : ''}
  <p style="margin:0;color:#7a7889;font-size:13px">README.md inside the zip has per-post details. Generated ${escapeHtml(runDate)}.</p>
</body></html>
`.trim();

    return { text, html };
}

function escapeHtml(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
