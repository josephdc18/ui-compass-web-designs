/**
 * Sitemap Refresh Job
 *
 * Regenerates sitemap.xml and pings search engines.
 * Default schedule: Daily at 4 AM UTC — Cron: "0 4 * * *"
 */

async function getPages(env) {
    const siteUrl = env.SITE_URL || 'https://example.com';
    const pages = [];

    const staticPages = [
        { url: '/', priority: 1.0, changefreq: 'weekly' },
        { url: '/about/', priority: 0.8, changefreq: 'monthly' },
        { url: '/contact/', priority: 0.7, changefreq: 'monthly' },
        { url: '/services/', priority: 0.8, changefreq: 'monthly' },
    ];

    for (const page of staticPages) {
        pages.push({
            loc: `${siteUrl}${page.url}`,
            priority: page.priority,
            changefreq: page.changefreq,
            lastmod: new Date().toISOString().split('T')[0],
        });
    }

    return pages;
}

function generateSitemapXml(pages) {
    const urlEntries = pages
        .map(
            (page) => `
  <url>
    <loc>${page.loc}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
        )
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

async function pingSearchEngines(sitemapUrl) {
    const engines = [
        `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
        `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    ];

    const results = [];

    for (const pingUrl of engines) {
        try {
            const response = await fetch(pingUrl, { method: 'GET' });
            results.push({
                engine: pingUrl.includes('google') ? 'Google' : 'Bing',
                success: response.ok,
                status: response.status,
            });
        } catch (error) {
            results.push({
                engine: pingUrl.includes('google') ? 'Google' : 'Bing',
                success: false,
                error: error.message,
            });
        }
    }

    return results;
}

export const SitemapRefresh = {
    async run(env, ctx) {
        const siteUrl = env.SITE_URL || 'https://example.com';
        const sitemapUrl = `${siteUrl}/sitemap.xml`;

        console.log(`[Sitemap] Refreshing sitemap for ${siteUrl}`);

        const pages = await getPages(env);
        console.log(`[Sitemap] Found ${pages.length} pages`);

        const sitemapXml = generateSitemapXml(pages);

        if (env.CACHE) {
            await env.CACHE.put('sitemap.xml', sitemapXml, {
                metadata: { contentType: 'application/xml' },
            });
            console.log('[Sitemap] Stored in KV');
        }

        if (env.BUCKET) {
            await env.BUCKET.put('sitemap.xml', sitemapXml, {
                httpMetadata: { contentType: 'application/xml' },
            });
            console.log('[Sitemap] Stored in R2');
        }

        const pingResults = await pingSearchEngines(sitemapUrl);
        const successfulPings = pingResults.filter((r) => r.success).length;

        console.log(`[Sitemap] Pinged ${successfulPings}/${pingResults.length} search engines`);

        return {
            pages: pages.length,
            sitemapSize: sitemapXml.length,
            pingResults,
            issues: pingResults.filter((r) => !r.success).length,
            timestamp: new Date().toISOString(),
        };
    },
};
