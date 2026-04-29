//
// Cache Purge Job
//
// Purges CDN cache for updated content via Cloudflare API.
// Default schedule: Every 6 hours (disabled by default)
// Cron: "0 */6 * * *"
//
// SETUP: Set CF_ZONE_ID and CF_API_TOKEN secrets.
//

async function purgeUrls(zoneId, apiToken, urls) {
    if (!zoneId || !apiToken) {
        console.warn('[CachePurge] CF_ZONE_ID or CF_API_TOKEN not configured');
        return { success: false, error: 'Not configured' };
    }

    try {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ files: urls })
            }
        );

        const result = await response.json();

        if (!result.success) {
            return {
                success: false,
                error: result.errors?.[0]?.message || 'Unknown error'
            };
        }

        return { success: true, purged: urls.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function purgeEverything(zoneId, apiToken) {
    if (!zoneId || !apiToken) {
        return { success: false, error: 'Not configured' };
    }

    try {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ purge_everything: true })
            }
        );

        const result = await response.json();

        if (!result.success) {
            return {
                success: false,
                error: result.errors?.[0]?.message || 'Unknown error'
            };
        }

        return { success: true, purged: 'everything' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function purgeTags(zoneId, apiToken, tags) {
    if (!zoneId || !apiToken) {
        return { success: false, error: 'Not configured' };
    }

    try {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tags })
            }
        );

        const result = await response.json();

        if (!result.success) {
            return {
                success: false,
                error: result.errors?.[0]?.message || 'Unknown error'
            };
        }

        return { success: true, purged: tags.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getUrlsToPurge(env) {
    const siteUrl = env.SITE_URL || 'https://example.com';
    const urls = [];

    const criticalPages = ['/', '/sitemap.xml', '/robots.txt'];

    for (const page of criticalPages) {
        urls.push(`${siteUrl}${page}`);
    }

    return urls;
}

export const CachePurge = {
    async run(env, ctx) {
        const zoneId = env.CF_ZONE_ID;
        const apiToken = env.CF_API_TOKEN;

        if (!zoneId || !apiToken) {
            console.log('[CachePurge] Skipping - not configured');
            return {
                success: false,
                error: 'CF_ZONE_ID and CF_API_TOKEN required',
                timestamp: new Date().toISOString()
            };
        }

        console.log('[CachePurge] Starting cache purge');

        const urls = await getUrlsToPurge(env);

        if (urls.length === 0) {
            return {
                success: true,
                purged: 0,
                timestamp: new Date().toISOString()
            };
        }

        const batches = [];
        for (let i = 0; i < urls.length; i += 30) {
            batches.push(urls.slice(i, i + 30));
        }

        let totalPurged = 0;
        let errors = [];

        for (const batch of batches) {
            const result = await purgeUrls(zoneId, apiToken, batch);
            if (result.success) {
                totalPurged += batch.length;
            } else {
                errors.push(result.error);
            }
        }

        console.log(`[CachePurge] Purged ${totalPurged} URLs`);

        return {
            success: errors.length === 0,
            purged: totalPurged,
            errors: errors.length > 0 ? errors : undefined,
            issues: errors.length,
            timestamp: new Date().toISOString()
        };
    }
};

export { purgeUrls, purgeEverything, purgeTags };
