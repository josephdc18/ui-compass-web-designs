/**
 * Cron Expression Parser
 *
 * Supports standard 5-field cron syntax:
 *   minute hour day-of-month month day-of-week
 *
 * Field values:
 *   - *        = all values
 *   - n        = specific value
 *   - n-m      = range (inclusive)
 *   - n,m,o    = list of values
 *   - *​/n      = step values (every n)
 *   - n-m/s    = range with step
 */

function parseField(field, min, max) {
    const values = new Set();
    const parts = field.split(',');

    for (const part of parts) {
        if (part.includes('/')) {
            const [range, step] = part.split('/');
            const stepNum = parseInt(step, 10);
            let start = min;
            let end = max;

            if (range !== '*') {
                if (range.includes('-')) {
                    [start, end] = range.split('-').map(n => parseInt(n, 10));
                } else {
                    start = parseInt(range, 10);
                }
            }

            for (let i = start; i <= end; i += stepNum) {
                values.add(i);
            }
        } else if (part.includes('-')) {
            const [start, end] = part.split('-').map(n => parseInt(n, 10));
            for (let i = start; i <= end; i++) {
                values.add(i);
            }
        } else if (part === '*') {
            for (let i = min; i <= max; i++) {
                values.add(i);
            }
        } else {
            values.add(parseInt(part, 10));
        }
    }

    return values;
}

export function parseCron(expression) {
    const parts = expression.trim().split(/\s+/);

    if (parts.length !== 5) {
        throw new Error(`Invalid cron expression: "${expression}" (expected 5 fields, got ${parts.length})`);
    }

    return {
        minutes: parseField(parts[0], 0, 59),
        hours: parseField(parts[1], 0, 23),
        daysOfMonth: parseField(parts[2], 1, 31),
        months: parseField(parts[3], 1, 12),
        daysOfWeek: parseField(parts[4], 0, 6)
    };
}

export function cronMatches(expression, date) {
    const cron = parseCron(expression);

    const minute = date.getUTCMinutes();
    const hour = date.getUTCHours();
    const dayOfMonth = date.getUTCDate();
    const month = date.getUTCMonth() + 1;
    const dayOfWeek = date.getUTCDay();

    return (
        cron.minutes.has(minute) &&
        cron.hours.has(hour) &&
        cron.daysOfMonth.has(dayOfMonth) &&
        cron.months.has(month) &&
        cron.daysOfWeek.has(dayOfWeek)
    );
}

export function getNextRun(expression, fromDate = new Date()) {
    parseCron(expression);

    const next = new Date(fromDate);
    next.setUTCSeconds(0, 0);
    next.setUTCMinutes(next.getUTCMinutes() + 1);

    const maxIterations = 366 * 24 * 60;

    for (let i = 0; i < maxIterations; i++) {
        if (cronMatches(expression, next)) {
            return next;
        }
        next.setUTCMinutes(next.getUTCMinutes() + 1);
    }

    return null;
}

export function isJobDue(cronExpression, lastRunAt, now = new Date(), windowMinutes = 5) {
    if (!lastRunAt) {
        return cronMatches(cronExpression, now);
    }

    const lastRun = new Date(lastRunAt);
    const nextRun = getNextRun(cronExpression, lastRun);

    if (!nextRun) return false;

    const windowMs = windowMinutes * 60 * 1000;
    return nextRun <= new Date(now.getTime() + windowMs);
}

export function describeCron(expression) {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return 'Invalid cron expression';

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (expression === '* * * * *') return 'Every minute';
    if (minute.startsWith('*/')) return `Every ${minute.slice(2)} minutes`;
    if (hour.startsWith('*/') && minute === '0') return `Every ${hour.slice(2)} hours`;
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        if (hour === '*') return `Every hour at minute ${minute}`;
        return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')} UTC`;
    }
    if (dayOfWeek === '0' && dayOfMonth === '*') return `Weekly on Sunday at ${hour}:${minute.padStart(2, '0')} UTC`;
    if (dayOfWeek === '1-5') return `Weekdays at ${hour}:${minute.padStart(2, '0')} UTC`;
    if (dayOfMonth === '1' && month === '*') return `Monthly on the 1st at ${hour}:${minute.padStart(2, '0')} UTC`;

    return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
}

export function validateCron(expression) {
    try {
        parseCron(expression);
        getNextRun(expression);
        return { valid: true };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}
