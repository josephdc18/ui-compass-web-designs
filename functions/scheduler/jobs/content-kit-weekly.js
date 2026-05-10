/**
 * Content Kit Weekly Job
 *
 * Generates 7 social-media post packages (one per template) and emails the
 * resulting zip to josephclutts@gmail.com.
 *
 * Default schedule: Sundays 06:00 Central = 12:00 UTC — Cron: "0 12 * * 0"
 *
 * Per-tick pipeline:
 *   1. Pick 7 backlog topics (one per template) from BACKLOG.md, respecting
 *      the 12-week dedup window stored in D1 content_kit_usage.
 *   2. For each pick, generate a populated `graphic` payload + IG/FB/LI copy
 *      via Anthropic Sonnet 4.6 (prompt-cached BRAND.md across the 7 calls).
 *   3. Populate the matching template HTML via HTMLRewriter.
 *   4. Screenshot at 1080×1350 via Browserless.
 *   5. Bundle into a zip with fflate.
 *   6. Optionally archive in R2.
 *   7. Email the zip as an attachment via Resend.
 *   8. Record successful picks in content_kit_usage.
 *
 * Per-post failures are isolated — one bad screenshot or LLM hiccup degrades
 * that post (HTML stub in zip, README error note) but the other six still ship.
 */

import { selectWeeklyTopics, recordPicks } from '../lib/content-kit/topic-selector.js';
import { generatePostCopy } from '../lib/content-kit/llm.js';
import { populateTemplate, getRequiredFields } from '../lib/content-kit/template.js';
import { screenshot } from '../lib/content-kit/browserless.js';
import { buildZip, bytesToBase64Chunked } from '../lib/content-kit/zip.js';
import { buildReadme, buildEmail } from '../lib/content-kit/readme-builder.js';
import { sendEmail } from '../lib/email.js';

const PARALLEL_BATCH_SIZE = 3;
const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024; // 30 MB safety cap (Resend allows 40)

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

/**
 * Build a single post — LLM call + template population + screenshot.
 * Catches all errors so per-post failures don't break the batch.
 */
async function buildPost(env, pick, runDate) {
    const result = {
        template: pick.template,
        topic: pick.text,
        section: pick.section,
        sources: pick.sources,
        hash: pick.hash,
        html: null,
        png: null,
        instagram: null,
        facebook: null,
        linkedin: null,
        error: null,
    };

    try {
        const requiredFields = getRequiredFields(pick.template);
        if (!requiredFields) {
            throw new Error(`Unknown template: ${pick.template}`);
        }

        const llm = await generatePostCopy(env, {
            topic: pick.text,
            template: pick.template,
            sources: pick.sources,
            requiredFields,
            date: runDate,
        });

        // Ensure date is set on graphic (LLM may omit; injection here is authoritative)
        const graphic = { ...llm.graphic, date: runDate };

        result.html = await populateTemplate(pick.template, graphic);
        result.instagram = llm.instagram;
        result.facebook = llm.facebook;
        result.linkedin = llm.linkedin;

        try {
            result.png = await screenshot(env, result.html);
        } catch (err) {
            // Screenshot failed but the HTML and copy are still valid — record
            // the error, keep the rest. README will flag, zip will include
            // graphic.html and a graphic-FAILED.txt stub.
            result.error = err.message;
            console.warn(`[content-kit] screenshot failed for ${pick.template}:`, err.message);
        }
    } catch (err) {
        // LLM or template failure — entire post lost.
        result.error = `Generation failed: ${err.message}`;
        console.error(`[content-kit] post failed for ${pick.template}:`, err);
    }

    return result;
}

async function buildAllPosts(env, picks, runDate) {
    const built = [];
    for (let i = 0; i < picks.length; i += PARALLEL_BATCH_SIZE) {
        const batch = picks.slice(i, i + PARALLEL_BATCH_SIZE);
        const settled = await Promise.allSettled(batch.map((p) => buildPost(env, p, runDate)));
        for (let j = 0; j < settled.length; j++) {
            const s = settled[j];
            if (s.status === 'fulfilled') {
                built.push({ ...s.value, index: built.length + 1 });
            } else {
                // Defensive — buildPost catches its own errors, but cover the case anyway.
                built.push({
                    index: built.length + 1,
                    template: batch[j].template,
                    topic: batch[j].text,
                    section: batch[j].section,
                    sources: batch[j].sources,
                    hash: batch[j].hash,
                    html: null,
                    png: null,
                    instagram: null,
                    facebook: null,
                    linkedin: null,
                    error: `Pipeline crashed: ${s.reason?.message || s.reason}`,
                });
            }
        }
    }
    return built;
}

export const ContentKitWeekly = {
    async run(env, ctx) {
        const now = new Date();
        const runDate = formatDate(now);

        console.log('[content-kit] starting run for', runDate);

        // 1. Select topics
        const { picks, warnings, weekId } = await selectWeeklyTopics(env, { now });
        console.log(`[content-kit] week ${weekId}: ${picks.length} picks, ${warnings.length} warnings`);

        if (picks.length === 0) {
            throw new Error(
                `No eligible backlog entries for any template this week. Add entries with (template-name) hints to content-kit/BACKLOG.md.`
            );
        }

        // 2. Generate posts in parallel batches
        const built = await buildAllPosts(env, picks, runDate);
        const successful = built.filter((p) => !p.error).length;
        const partial = built.filter((p) => p.html && p.error).length;
        const failed = built.filter((p) => !p.html).length;
        console.log(`[content-kit] built ${built.length} posts: ${successful} OK, ${partial} screenshot-failed, ${failed} fully-failed`);

        // 3. Build zip
        let archiveUrl = null;
        const readmeMd = buildReadme({ weekId, runDate, posts: built, warnings, archiveUrl });
        const zipBytes = buildZip(built, readmeMd);
        console.log(`[content-kit] zip size: ${(zipBytes.length / 1024).toFixed(1)} KB`);

        // 4. R2 archive (best-effort)
        if (env.MEDIA_BUCKET) {
            try {
                const r2Key = `content-kit/${weekId}.zip`;
                await env.MEDIA_BUCKET.put(r2Key, zipBytes, {
                    httpMetadata: { contentType: 'application/zip' },
                    customMetadata: {
                        weekId,
                        runDate,
                        postCount: String(built.length),
                    },
                });
                console.log(`[content-kit] archived to R2: ${r2Key}`);
                if (env.SITE_URL) {
                    archiveUrl = `${env.SITE_URL.replace(/\/$/, '')}/api/content-kit-archive/${weekId}.zip`;
                }
            } catch (err) {
                console.warn('[content-kit] R2 upload failed:', err.message);
            }
        }

        // Rebuild README + email body now that we know the archive URL.
        const finalReadme = buildReadme({ weekId, runDate, posts: built, warnings, archiveUrl });
        // Re-build the zip with the updated README so the user sees the archive link inside too.
        const finalZip = buildZip(built, finalReadme);

        // 5. Email
        const recipient = env.CONTENT_KIT_RECIPIENT || 'josephclutts@gmail.com';
        const filename = `content-kit-${weekId}.zip`;
        const subject = `UI Compass content kit, week of ${runDate}`;
        const { text, html } = buildEmail({ weekId, runDate, posts: built, warnings, archiveUrl });

        let emailId = null;
        if (finalZip.length > MAX_ATTACHMENT_BYTES) {
            // Too big to attach — send link-only email.
            console.warn(`[content-kit] zip ${finalZip.length} bytes exceeds ${MAX_ATTACHMENT_BYTES}; sending link-only`);
            const linkText = archiveUrl
                ? `${text}\n\nNOTE: zip is too large to attach (${(finalZip.length / 1024 / 1024).toFixed(1)} MB). Download it from the archive URL above.`
                : `${text}\n\nNOTE: zip is too large to attach (${(finalZip.length / 1024 / 1024).toFixed(1)} MB) and R2 archival also failed. Run the job again or check the worker logs.`;
            const sendResult = await sendEmail(env, { to: recipient, subject, text: linkText, html });
            if (!sendResult.success) {
                throw new Error(`Email send failed: ${sendResult.error}`);
            }
            emailId = sendResult.id;
        } else {
            const zipBase64 = bytesToBase64Chunked(finalZip);
            const sendResult = await sendEmail(env, {
                to: recipient,
                subject,
                text,
                html,
                attachments: [{ filename, content: zipBase64 }],
            });
            if (!sendResult.success) {
                throw new Error(`Email send failed: ${sendResult.error}`);
            }
            emailId = sendResult.id;
        }
        console.log(`[content-kit] emailed ${recipient}: ${emailId}`);

        // 6. Record picks (only those that produced usable HTML — let fully-failed ones come back next week)
        const recordable = built
            .filter((p) => p.html)
            .map((p) => ({
                hash: p.hash,
                template: p.template,
                section: p.section,
                sources: p.sources,
            }));
        if (recordable.length > 0) {
            await recordPicks(env, recordable, weekId, now);
        }

        return {
            weekId,
            runDate,
            posts: built.length,
            successful,
            screenshotFailed: partial,
            generationFailed: failed,
            warnings: warnings.length,
            sizeBytes: finalZip.length,
            emailId,
            recipient,
            archiveUrl,
            issues: failed + partial,
            timestamp: now.toISOString(),
        };
    },
};
