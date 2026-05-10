/**
 * Master Scheduler Worker
 *
 * Single cron worker that manages all scheduled jobs.
 * Runs every 5 minutes via Cloudflare cron trigger.
 *
 * Jobs are registered in JOB_HANDLERS and configured in the database
 * with standard cron expressions.
 *
 * SETUP:
 *   1. Create database: wrangler d1 create your-project-db
 *   2. Run migrations: wrangler d1 execute your-project-db --file=./schema.sql
 *   3. Deploy: wrangler deploy
 *
 * ADDING NEW JOBS:
 *   1. Create job file in ./jobs/your-job.js
 *   2. Import and add to JOB_HANDLERS below
 *   3. Add default config to DEFAULT_JOBS
 *   4. Deploy and job will auto-register
 */

import { isJobDue, getNextRun, describeCron, validateCron } from './lib/cron-parser.js';
import { processJobQueue, cleanupOldJobs, getQueueStats } from './lib/job-queue.js';

import { SitemapRefresh } from './jobs/sitemap-refresh.js';
import { CachePurge } from './jobs/cache-purge.js';
import { DataCleanup } from './jobs/data-cleanup.js';
import { ContentKitWeekly } from './jobs/content-kit-weekly.js';

const JOB_HANDLERS = {
    'sitemap-refresh': SitemapRefresh,
    'cache-purge': CachePurge,
    'data-cleanup': DataCleanup,
    'content-kit-weekly': ContentKitWeekly,
};

const DEFAULT_JOBS = [
    {
        id: 'sitemap-refresh',
        name: 'Sitemap Refresh',
        description: 'Regenerate sitemap.xml and ping search engines',
        cron_expression: '0 4 * * *',
        enabled: true,
    },
    {
        id: 'cache-purge',
        name: 'Cache Purge',
        description: 'Purge CDN cache for updated content',
        cron_expression: '0 */6 * * *',
        enabled: false,
    },
    {
        id: 'data-cleanup',
        name: 'Data Cleanup',
        description: 'Clean up old job runs, logs, and temporary data',
        cron_expression: '0 3 * * 0',
        enabled: true,
    },
    {
        id: 'content-kit-weekly',
        name: 'Content Kit Weekly',
        description: 'Generate 7 social-media post packages and email zip to josephclutts@gmail.com',
        // Sundays 06:00 Central = 12:00 UTC
        cron_expression: '0 12 * * 0',
        // Start disabled — flip on after a successful manual test run
        enabled: false,
    },
];

const QUEUE_HANDLERS = {
    send_push: async (env, payload, job) => {
        const { sendPushToUser, broadcastPush } = await import('./lib/push.js');
        if (payload.userId) {
            await sendPushToUser(env, payload.userId, payload.notification);
        } else if (payload.broadcast) {
            await broadcastPush(env, payload.notification);
        }
    },
    send_email: async (env, payload, job) => {
        const { sendEmail } = await import('./lib/email.js');
        const result = await sendEmail(env, payload);
        if (!result.success) {
            throw new Error(result.error || 'Email send failed');
        }
        console.log(`[Queue] Email sent to ${payload.to}: ${result.id}`);
    },
    form_notification: async (env, payload, job) => {
        const { sendEmail, formatFormSubmissionEmail } = await import('./lib/email.js');

        const { text, html } = formatFormSubmissionEmail(
            payload.formName,
            payload.data,
            payload.submissionId,
            payload.siteUrl
        );

        const senderEmail = payload.data.email || payload.data.Email || null;

        const result = await sendEmail(env, {
            to: payload.to,
            subject: `New ${payload.formName} submission`,
            text,
            html,
            replyTo: senderEmail,
        });

        if (!result.success) {
            throw new Error(result.error || 'Form notification email failed');
        }

        console.log(`[Queue] Form notification sent for ${payload.submissionId}: ${result.id}`);
    },
    webhook: async (env, payload, job) => {
        const response = await fetch(payload.url, {
            method: payload.method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...payload.headers,
            },
            body: JSON.stringify(payload.body),
        });
        if (!response.ok) {
            throw new Error(`Webhook failed: ${response.status}`);
        }
    },
};

async function ensureJobsExist(db) {
    for (const job of DEFAULT_JOBS) {
        const existing = await db
            .prepare('SELECT id FROM scheduled_jobs WHERE id = ?')
            .bind(job.id)
            .first();

        if (!existing) {
            await db
                .prepare(`
                INSERT INTO scheduled_jobs (id, name, description, cron_expression, enabled, created_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `)
                .bind(job.id, job.name, job.description, job.cron_expression, job.enabled ? 1 : 0)
                .run();

            console.log(`[Scheduler] Created job: ${job.id}`);
        }
    }
}

async function getDueJobs(db) {
    const { results } = await db
        .prepare(`
        SELECT id, name, description, cron_expression, last_run_at, enabled
        FROM scheduled_jobs
        WHERE enabled = 1
    `)
        .all();

    const now = new Date();
    const dueJobs = [];

    for (const job of results || []) {
        if (isJobDue(job.cron_expression, job.last_run_at, now)) {
            dueJobs.push(job);
        }
    }

    return dueJobs;
}

async function logJobStart(db, jobId) {
    const runId = crypto.randomUUID();

    await db
        .prepare(`
        INSERT INTO job_runs (id, job_id, status, started_at)
        VALUES (?, ?, 'running', datetime('now'))
    `)
        .bind(runId, jobId)
        .run();

    await db
        .prepare(`
        UPDATE scheduled_jobs SET last_run_at = datetime('now') WHERE id = ?
    `)
        .bind(jobId)
        .run();

    return runId;
}

async function logJobComplete(db, runId, jobId, status, summary, error = null) {
    await db
        .prepare(`
        UPDATE job_runs
        SET completed_at = datetime('now'), status = ?, result_summary = ?, error_message = ?
        WHERE id = ?
    `)
        .bind(status, JSON.stringify(summary), error, runId)
        .run();

    const job = await db
        .prepare('SELECT cron_expression FROM scheduled_jobs WHERE id = ?')
        .bind(jobId)
        .first();

    if (job) {
        const nextRun = getNextRun(job.cron_expression);
        if (nextRun) {
            await db
                .prepare(`
                UPDATE scheduled_jobs SET next_run_at = ? WHERE id = ?
            `)
                .bind(nextRun.toISOString(), jobId)
                .run();
        }
    }
}

async function runJob(env, ctx, job) {
    const db = env.DB;
    const handler = JOB_HANDLERS[job.id];

    if (!handler) {
        console.error(`[Scheduler] No handler found for job: ${job.id}`);
        return { success: false, error: 'No handler' };
    }

    console.log(`[Scheduler] Starting job: ${job.name} (${job.id})`);
    const runId = await logJobStart(db, job.id);

    try {
        const result = await handler.run(env, ctx);
        await logJobComplete(db, runId, job.id, 'completed', result);

        console.log(`[Scheduler] Job ${job.id} completed:`, result);

        if (result.issues && result.issues > 0) {
            try {
                const { sendSchedulerNotification } = await import('./lib/push.js');
                ctx.waitUntil(
                    sendSchedulerNotification(env, {
                        title: `${job.name} found issues`,
                        body: `Found ${result.issues} issue(s) that may need attention.`,
                        type: 'warning',
                    })
                );
            } catch (e) {
                // Push not available, that's fine
            }
        }

        return { success: true, result };
    } catch (error) {
        console.error(`[Scheduler] Job ${job.id} failed:`, error);
        await logJobComplete(db, runId, job.id, 'failed', null, error.message);

        try {
            const { sendSchedulerNotification } = await import('./lib/push.js');
            ctx.waitUntil(
                sendSchedulerNotification(env, {
                    title: `${job.name} failed`,
                    body: error.message.slice(0, 100),
                    type: 'error',
                })
            );
        } catch (e) {
            // Push not available, that's fine
        }

        return { success: false, error: error.message };
    }
}

async function handleScheduled(event, env, ctx) {
    const db = env.DB;
    const now = new Date(event.scheduledTime);

    console.log(`[Scheduler] Tick at ${now.toISOString()}`);

    try {
        await ensureJobsExist(db);
        ctx.waitUntil(processJobQueue(env, QUEUE_HANDLERS));

        const dueJobs = await getDueJobs(db);

        if (dueJobs.length === 0) {
            console.log('[Scheduler] No jobs due to run');
            return;
        }

        console.log(`[Scheduler] Found ${dueJobs.length} job(s) due to run`);

        for (const job of dueJobs) {
            ctx.waitUntil(runJob(env, ctx, job));
        }
    } catch (error) {
        console.error('[Scheduler] Error:', error);
    }
}

async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);
    const db = env.DB;

    const allowedOrigins = [env.SITE_URL, 'http://localhost:8080', 'http://localhost:3000', 'http://localhost:8788', 'http://127.0.0.1:8788'].filter(
        Boolean
    );

    const origin = request.headers.get('Origin');
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*';

    const corsHeaders = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

    try {
        if (url.pathname === '/health' || url.pathname === '/') {
            return new Response(
                JSON.stringify({
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                }),
                { headers: jsonHeaders }
            );
        }

        if (url.pathname === '/jobs') {
            await ensureJobsExist(db);

            const { results } = await db
                .prepare(`
                SELECT id, name, description, cron_expression, enabled, last_run_at, next_run_at
                FROM scheduled_jobs
                ORDER BY name
            `)
                .all();

            const jobs = (results || []).map((job) => ({
                ...job,
                enabled: Boolean(job.enabled),
                schedule_description: describeCron(job.cron_expression),
            }));

            return new Response(JSON.stringify(jobs), { headers: jsonHeaders });
        }

        if (url.pathname === '/history') {
            const jobId = url.searchParams.get('job');
            const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

            let query = `
                SELECT jr.*, sj.name as job_name
                FROM job_runs jr
                LEFT JOIN scheduled_jobs sj ON jr.job_id = sj.id
            `;

            const params = [];
            if (jobId) {
                query += ` WHERE jr.job_id = ?`;
                params.push(jobId);
            }

            query += ` ORDER BY jr.started_at DESC LIMIT ?`;
            params.push(limit);

            const { results } = await db
                .prepare(query)
                .bind(...params)
                .all();
            return new Response(JSON.stringify(results || []), { headers: jsonHeaders });
        }

        if (url.pathname === '/queue/stats') {
            const stats = await getQueueStats(db);
            return new Response(JSON.stringify(stats), { headers: jsonHeaders });
        }

        if (url.pathname.startsWith('/run/') && request.method === 'POST') {
            const jobId = url.pathname.replace('/run/', '');

            const job = await db
                .prepare('SELECT * FROM scheduled_jobs WHERE id = ?')
                .bind(jobId)
                .first();

            if (!job) {
                return new Response(JSON.stringify({ error: 'Job not found' }), {
                    status: 404,
                    headers: jsonHeaders,
                });
            }

            ctx.waitUntil(runJob(env, ctx, job));

            return new Response(
                JSON.stringify({
                    message: `Job "${job.name}" started`,
                    jobId: jobId,
                }),
                { headers: jsonHeaders }
            );
        }

        if (url.pathname.startsWith('/toggle/') && request.method === 'POST') {
            const jobId = url.pathname.replace('/toggle/', '');

            const job = await db
                .prepare('SELECT * FROM scheduled_jobs WHERE id = ?')
                .bind(jobId)
                .first();

            if (!job) {
                return new Response(JSON.stringify({ error: 'Job not found' }), {
                    status: 404,
                    headers: jsonHeaders,
                });
            }

            const newEnabled = job.enabled ? 0 : 1;
            await db
                .prepare('UPDATE scheduled_jobs SET enabled = ? WHERE id = ?')
                .bind(newEnabled, jobId)
                .run();

            return new Response(
                JSON.stringify({
                    message: `Job "${job.name}" ${newEnabled ? 'enabled' : 'disabled'}`,
                    enabled: Boolean(newEnabled),
                }),
                { headers: jsonHeaders }
            );
        }

        if (url.pathname.startsWith('/schedule/') && request.method === 'POST') {
            const jobId = url.pathname.replace('/schedule/', '');
            const body = await request.json();

            if (!body.cron) {
                return new Response(JSON.stringify({ error: 'Missing cron expression' }), {
                    status: 400,
                    headers: jsonHeaders,
                });
            }

            const validation = validateCron(body.cron);
            if (!validation.valid) {
                return new Response(JSON.stringify({ error: validation.error }), {
                    status: 400,
                    headers: jsonHeaders,
                });
            }

            await db
                .prepare('UPDATE scheduled_jobs SET cron_expression = ? WHERE id = ?')
                .bind(body.cron, jobId)
                .run();

            const nextRun = getNextRun(body.cron);

            return new Response(
                JSON.stringify({
                    message: 'Schedule updated',
                    cron: body.cron,
                    description: describeCron(body.cron),
                    nextRun: nextRun?.toISOString(),
                }),
                { headers: jsonHeaders }
            );
        }

        return new Response(
            `Scheduler API

Endpoints:
  GET  /health           Health check
  GET  /jobs             List all scheduled jobs
  GET  /history          Job execution history (?job=id&limit=50)
  GET  /queue/stats      Job queue statistics
  POST /run/{job-id}     Manually trigger a job
  POST /toggle/{job-id}  Enable/disable a job
  POST /schedule/{job-id} Update schedule (body: {"cron": "0 6 * * *"})
`,
            {
                headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
            }
        );
    } catch (error) {
        console.error('[Scheduler API] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: jsonHeaders,
        });
    }
}

export default {
    async scheduled(event, env, ctx) {
        await handleScheduled(event, env, ctx);
    },

    async fetch(request, env, ctx) {
        return handleRequest(request, env, ctx);
    },
};
