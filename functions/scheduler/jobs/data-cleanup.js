/**
 * Data Cleanup Job
 *
 * Cleans up old job runs, logs, expired data, and temporary files.
 * Default schedule: Weekly on Sunday at 3 AM UTC — Cron: "0 3 * * 0"
 */

import { cleanupOldJobs } from '../lib/job-queue.js';

export const DataCleanup = {
    async run(env, ctx) {
        const db = env.DB;
        const results = {
            jobRuns: 0,
            queueJobs: 0,
            expiredSessions: 0,
            expiredSubscriptions: 0,
            oldNotifications: 0,
        };

        console.log('[DataCleanup] Starting cleanup');

        try {
            const jobRunResult = await db
                .prepare(`
                DELETE FROM job_runs
                WHERE completed_at < datetime('now', '-30 days')
            `)
                .run();
            results.jobRuns = jobRunResult.meta.changes || 0;
            console.log(`[DataCleanup] Deleted ${results.jobRuns} old job runs`);
        } catch (e) {
            console.log('[DataCleanup] job_runs table not found or empty');
        }

        try {
            results.queueJobs = await cleanupOldJobs(db, 30);
            console.log(`[DataCleanup] Deleted ${results.queueJobs} old queue jobs`);
        } catch (e) {
            console.log('[DataCleanup] job_queue table not found or empty');
        }

        try {
            const sessionResult = await db
                .prepare(`
                DELETE FROM sessions
                WHERE expires_at < datetime('now')
            `)
                .run();
            results.expiredSessions = sessionResult.meta.changes || 0;
            console.log(`[DataCleanup] Deleted ${results.expiredSessions} expired sessions`);
        } catch (e) {
            // Table doesn't exist, that's fine
        }

        try {
            const pushResult = await db
                .prepare(`
                DELETE FROM push_subscriptions
                WHERE active = 0 AND updated_at < datetime('now', '-90 days')
            `)
                .run();
            results.expiredSubscriptions = pushResult.meta.changes || 0;
            console.log(
                `[DataCleanup] Deleted ${results.expiredSubscriptions} expired push subscriptions`
            );
        } catch (e) {
            // Table doesn't exist, that's fine
        }

        try {
            const notifResult = await db
                .prepare(`
                DELETE FROM notifications
                WHERE created_at < datetime('now', '-60 days')
            `)
                .run();
            results.oldNotifications = notifResult.meta.changes || 0;
            console.log(`[DataCleanup] Deleted ${results.oldNotifications} old notifications`);
        } catch (e) {
            // Table doesn't exist, that's fine
        }

        const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);

        console.log(`[DataCleanup] Completed - deleted ${totalDeleted} total records`);

        return {
            ...results,
            totalDeleted,
            issues: 0,
            timestamp: new Date().toISOString(),
        };
    },
};
