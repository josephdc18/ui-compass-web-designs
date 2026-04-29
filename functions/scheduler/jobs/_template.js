//
// Job Template
//
// Copy this file to create a new scheduled job.
//
// SETUP:
//   1. Copy this file: cp _template.js your-job-name.js
//   2. Update the export name and implement run()
//   3. Import in ../index.js and add to JOB_HANDLERS + DEFAULT_JOBS
//   4. Deploy: wrangler deploy
//
// CRON EXPRESSION REFERENCE:
//   minute hour day-of-month month day-of-week
//
//   Examples:
//     "0 6 * * *"      Daily at 6:00 AM UTC
//     "0 */4 * * *"    Every 4 hours
//     "0 9 * * 1-5"    Weekdays at 9:00 AM UTC
//     "0 0 1 * *"      Monthly on the 1st at midnight
//     "0 3 * * 0"      Weekly on Sunday at 3:00 AM UTC
//     "*/15 * * * *"   Every 15 minutes
//

export const YourJobName = {
    async run(env, ctx) {
        console.log('[YourJobName] Starting job');

        const db = env.DB;
        let processed = 0;
        let issues = 0;

        try {
            // Your job logic here
        } catch (error) {
            console.error('[YourJobName] Error:', error);
            issues++;
        }

        console.log(`[YourJobName] Completed - processed ${processed}, issues ${issues}`);

        return {
            processed,
            issues,
            timestamp: new Date().toISOString()
        };
    }
};
