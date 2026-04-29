/**
 * Job Queue System
 *
 * Async job scheduling and processing with retry logic.
 * Jobs are stored in the job_queue table and processed every scheduler tick.
 */

export async function enqueueJob(db, options) {
    const {
        type,
        payload,
        runAt = new Date().toISOString(),
        priority = 0,
        maxAttempts = 3,
        entityType = null,
        entityId = null,
    } = options;

    const id = crypto.randomUUID();

    await db
        .prepare(`
        INSERT INTO job_queue (
            id, job_type, payload, run_at, priority, max_attempts,
            entity_type, entity_id, status, attempts, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, datetime('now'))
    `)
        .bind(id, type, JSON.stringify(payload), runAt, priority, maxAttempts, entityType, entityId)
        .run();

    return id;
}

export async function enqueueDelayed(db, type, payload, delayMinutes, options = {}) {
    const runAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    return enqueueJob(db, { type, payload, runAt, ...options });
}

export async function processJobQueue(env, jobHandlers, batchSize = 25) {
    const db = env.DB;
    const now = new Date().toISOString();

    const result = await db
        .prepare(`
        SELECT * FROM job_queue
        WHERE status = 'pending' AND run_at <= ?
        ORDER BY priority DESC, run_at ASC
        LIMIT ?
    `)
        .bind(now, batchSize)
        .all();

    const jobs = result.results || [];

    if (jobs.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0 };
    }

    let processed = 0,
        succeeded = 0,
        failed = 0;

    for (const job of jobs) {
        const handler = jobHandlers[job.job_type];

        if (!handler) {
            console.warn(`[JobQueue] Unknown job type: ${job.job_type}`);
            await markJobFailed(db, job.id, `Unknown job type: ${job.job_type}`);
            failed++;
            processed++;
            continue;
        }

        try {
            await db
                .prepare(`
                UPDATE job_queue
                SET status = 'processing', started_at = datetime('now'), attempts = attempts + 1
                WHERE id = ?
            `)
                .bind(job.id)
                .run();

            const payload = JSON.parse(job.payload || '{}');
            await handler(env, payload, job);

            await db
                .prepare(`
                UPDATE job_queue
                SET status = 'completed', completed_at = datetime('now')
                WHERE id = ?
            `)
                .bind(job.id)
                .run();

            succeeded++;
        } catch (error) {
            console.error(`[JobQueue] Job ${job.id} (${job.job_type}) failed:`, error.message);

            const attempts = (job.attempts || 0) + 1;
            const maxAttempts = job.max_attempts || 3;

            if (attempts < maxAttempts) {
                const backoffMinutes = Math.pow(3, attempts) * 5;
                const retryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

                await db
                    .prepare(`
                    UPDATE job_queue
                    SET status = 'pending', run_at = ?, last_error = ?
                    WHERE id = ?
                `)
                    .bind(retryAt, error.message, job.id)
                    .run();

                console.log(
                    `[JobQueue] Job ${job.id} will retry at ${retryAt} (attempt ${attempts}/${maxAttempts})`
                );
            } else {
                await markJobFailed(db, job.id, error.message);
            }

            failed++;
        }

        processed++;
    }

    if (processed > 0) {
        console.log(
            `[JobQueue] Processed ${processed} jobs: ${succeeded} succeeded, ${failed} failed`
        );
    }

    return { processed, succeeded, failed };
}

async function markJobFailed(db, jobId, errorMessage) {
    await db
        .prepare(`
        UPDATE job_queue
        SET status = 'failed', completed_at = datetime('now'), last_error = ?
        WHERE id = ?
    `)
        .bind(errorMessage, jobId)
        .run();
}

export async function cancelJob(db, jobId) {
    const result = await db
        .prepare(`
        UPDATE job_queue
        SET status = 'cancelled', completed_at = datetime('now')
        WHERE id = ? AND status = 'pending'
    `)
        .bind(jobId)
        .run();

    return result.meta.changes > 0;
}

export async function cancelJobsForEntity(db, entityType, entityId, jobType = null) {
    let query = `
        UPDATE job_queue
        SET status = 'cancelled', completed_at = datetime('now')
        WHERE entity_type = ? AND entity_id = ? AND status = 'pending'
    `;

    if (jobType) {
        query += ` AND job_type = ?`;
        const result = await db.prepare(query).bind(entityType, entityId, jobType).run();
        return result.meta.changes;
    }

    const result = await db.prepare(query).bind(entityType, entityId).run();
    return result.meta.changes;
}

export async function getJobStatus(db, jobId) {
    return db
        .prepare(`
        SELECT id, job_type, status, attempts, max_attempts, run_at, started_at, completed_at, last_error
        FROM job_queue WHERE id = ?
    `)
        .bind(jobId)
        .first();
}

export async function cleanupOldJobs(db, daysOld = 30) {
    const result = await db
        .prepare(`
        DELETE FROM job_queue
        WHERE status IN ('completed', 'failed', 'cancelled')
        AND completed_at < datetime('now', '-' || ? || ' days')
    `)
        .bind(daysOld)
        .run();

    return result.meta.changes;
}

export async function getQueueStats(db) {
    const result = await db
        .prepare(`
        SELECT
            status,
            COUNT(*) as count,
            MIN(run_at) as earliest,
            MAX(run_at) as latest
        FROM job_queue
        GROUP BY status
    `)
        .all();

    const stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        total: 0,
    };

    for (const row of result.results || []) {
        stats[row.status] = row.count;
        stats.total += row.count;
    }

    return stats;
}
