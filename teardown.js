#!/usr/bin/env node
/**
 * Project teardown — removes cloud resources created by setup.js.
 * Run: npm run teardown            (dry-run, shows what would be deleted)
 *      npm run teardown -- --confirm   (actually deletes resources)
 *      npm run teardown -- --confirm --delete-git  (also removes .git)
 * Generated at export time with baked-in project config.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');

const CONFIG = {
  "slug": "ui-compass-web-designs",
  "features": {
    "cms": true,
    "forms": true,
    "pwa": true,
    "sitemap": true,
    "i18n": true,
    "pushNotifications": true,
    "blog": true,
    "cron": true,
    "shop": true,
    "portal": true,
    "messaging": true,
    "esign": true,
    "invoicing": true,
    "media": true,
    "pageViewTransitions": true,
    "hapticFeedback": true
  },
  "d1Required": true,
  "r2Required": true,
  "secrets": [
    {
      "name": "SITE_URL",
      "feature": null,
      "featureLabel": "General",
      "required": true,
      "autoGenerate": false,
      "desc": "Your deployed site URL (e.g. https://my-site.pages.dev)"
    },
    {
      "name": "GITHUB_CLIENT_ID",
      "feature": "cms",
      "featureLabel": "CMS",
      "required": true,
      "autoGenerate": false,
      "desc": "GitHub OAuth App Client ID"
    },
    {
      "name": "GITHUB_CLIENT_SECRET",
      "feature": "cms",
      "featureLabel": "CMS",
      "required": true,
      "autoGenerate": false,
      "desc": "GitHub OAuth App Client Secret"
    },
    {
      "name": "CMS_ALLOWED_USERS",
      "feature": "cms",
      "featureLabel": "CMS",
      "required": false,
      "autoGenerate": false,
      "desc": "Comma-separated GitHub usernames allowed to access CMS"
    },
    {
      "name": "VAPID_PUBLIC_KEY",
      "feature": "pushNotifications",
      "featureLabel": "Push",
      "required": true,
      "autoGenerate": true,
      "desc": "Web Push VAPID public key"
    },
    {
      "name": "VAPID_PRIVATE_KEY",
      "feature": "pushNotifications",
      "featureLabel": "Push",
      "required": true,
      "autoGenerate": true,
      "desc": "Web Push VAPID private key"
    },
    {
      "name": "VAPID_SUBJECT",
      "feature": "pushNotifications",
      "featureLabel": "Push",
      "required": true,
      "autoGenerate": false,
      "desc": "mailto:you@example.com or your site URL"
    },
    {
      "name": "EMAIL_PROVIDER",
      "feature": "cron",
      "featureLabel": "Cron (email)",
      "required": false,
      "autoGenerate": false,
      "desc": "Email provider (e.g. resend, sendgrid)"
    },
    {
      "name": "EMAIL_API_KEY",
      "feature": "cron",
      "featureLabel": "Cron (email)",
      "required": false,
      "autoGenerate": false,
      "desc": "Email provider API key"
    },
    {
      "name": "EMAIL_FROM",
      "feature": "cron",
      "featureLabel": "Cron (email)",
      "required": false,
      "autoGenerate": false,
      "desc": "Sender email address"
    },
    {
      "name": "NOTIFICATION_EMAIL",
      "feature": "cron",
      "featureLabel": "Cron (email)",
      "required": false,
      "autoGenerate": false,
      "desc": "Notification recipient email"
    },
    {
      "name": "CF_ZONE_ID",
      "feature": "cron",
      "featureLabel": "Cron (cache)",
      "required": false,
      "autoGenerate": false,
      "desc": "Cloudflare Zone ID for cache purge"
    },
    {
      "name": "CF_API_TOKEN",
      "feature": "cron",
      "featureLabel": "Cron (cache)",
      "required": false,
      "autoGenerate": false,
      "desc": "Cloudflare API token for cache purge"
    },
    {
      "name": "STRIPE_SECRET_KEY",
      "feature": "shop",
      "featureLabel": "Shop",
      "required": true,
      "autoGenerate": false,
      "desc": "Stripe secret key (sk_live_... or sk_test_...)"
    },
    {
      "name": "STRIPE_PUBLISHABLE_KEY",
      "feature": "shop",
      "featureLabel": "Shop",
      "required": true,
      "autoGenerate": false,
      "desc": "Stripe publishable key (pk_live_... or pk_test_...)"
    },
    {
      "name": "STRIPE_WEBHOOK_SECRET",
      "feature": "shop",
      "featureLabel": "Shop",
      "required": true,
      "autoGenerate": false,
      "desc": "Stripe webhook signing secret (whsec_...)"
    },
    {
      "name": "CRM_ADMIN_TOKEN",
      "feature": "shop",
      "featureLabel": "Admin CRM",
      "required": true,
      "autoGenerate": true,
      "desc": "Admin bearer token for CRM panel (auto-generated)"
    },
    {
      "name": "JWT_SECRET",
      "feature": "portal",
      "featureLabel": "Portal",
      "required": true,
      "autoGenerate": false,
      "desc": "HMAC key for portal client JWTs (generate with: openssl rand -hex 64)"
    },
    {
      "name": "RESEND_API_KEY",
      "feature": "portal",
      "featureLabel": "Portal (email)",
      "required": true,
      "autoGenerate": false,
      "desc": "Resend API key for transactional emails (magic links, OTP)"
    },
    {
      "name": "GIPHY_API_KEY",
      "feature": "messaging",
      "featureLabel": "Messaging",
      "required": false,
      "autoGenerate": false,
      "desc": "Giphy API key for GIF search (optional — picker hidden if absent)"
    },
    {
      "name": "BROWSERLESS_API_KEY",
      "feature": "esign",
      "featureLabel": "E-Sign",
      "required": false,
      "autoGenerate": false,
      "desc": "Browserless API key for PDF generation of signed contracts (optional)"
    }
  ]
};

const isWin = process.platform === 'win32';
const R = '\x1b[0m', G = '\x1b[32m', Y = '\x1b[33m', RD = '\x1b[31m', B = '\x1b[1m', D = '\x1b[2m';
function ok(m) { console.log('  ' + G + '\u2713' + R + ' ' + m); }
function warn(m) { console.log('  ' + Y + '\u26A0' + R + ' ' + m); }
function err(m) { console.log('  ' + RD + '\u2717' + R + ' ' + m); }
function info(m) { console.log('  ' + D + '\u2192 ' + m + R); }

function hasCmd(n) { try { execFileSync(isWin ? 'where' : 'which', [n], { stdio: 'pipe' }); return true; } catch { return false; } }
function execSafe(cmd, args) { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe' }).trim(); } catch { return null; } }

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const deleteGit = args.includes('--delete-git');

console.log('');
console.log(B + '  Project Teardown: ' + CONFIG.slug + R);
console.log(confirm ? RD + '  Mode: LIVE — resources will be deleted' + R : Y + '  Mode: DRY RUN — nothing will be deleted' + R);
console.log('');

// 1. GitHub repo
if (hasCmd('gh')) {
  const repoInfo = execSafe('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
  if (repoInfo) {
    console.log('  GitHub repo: ' + repoInfo);
    if (confirm) {
      try {
        execFileSync('gh', ['repo', 'delete', repoInfo, '--yes'], { stdio: 'pipe' });
        ok('Deleted GitHub repo');
      } catch (e) {
        err('Failed to delete repo: ' + (e.stderr || e.message));
        info('If permission denied, run: gh auth refresh -h github.com -s delete_repo');
      }
    } else { info('Would delete: gh repo delete ' + repoInfo + ' --yes'); }
  } else { warn('No GitHub repo found (not linked or already deleted)'); }
} else { warn('gh CLI not installed — skipping GitHub repo deletion'); }

// 2. Cloudflare Pages project
if (hasCmd(isWin ? 'npx.cmd' : 'npx')) {
  const listOut = execSafe(isWin ? 'npx.cmd' : 'npx', ['wrangler', 'pages', 'project', 'list', '--json']);
  var pagesName = null;
  if (listOut) { try { var jsonStr = listOut.slice(listOut.indexOf('[')); var match = JSON.parse(jsonStr).find(function(p) { return p.name === CONFIG.slug || p.name.startsWith(CONFIG.slug + '-'); }); if (match) pagesName = match.name; } catch {} }

  if (pagesName) {
    console.log('  CF Pages project: ' + pagesName);
    if (confirm) {
      try {
        execFileSync(isWin ? 'npx.cmd' : 'npx', ['wrangler', 'pages', 'project', 'delete', pagesName, '--yes'], { stdio: 'pipe' });
        ok('Deleted Pages project');
      } catch (e) { err('Failed to delete Pages project: ' + (e.stderr || e.message)); }
    } else { info('Would delete: npx wrangler pages project delete ' + pagesName + ' --yes'); }
  } else { warn('CF Pages project not found'); }

  // 3. D1 database
  if (CONFIG.d1Required) {
    const db = CONFIG.slug + '-db';
    const d1List = execSafe(isWin ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'list', '--json']);
    let dbId = null;
    if (d1List) { try { var d1Json = d1List.slice(d1List.indexOf('[')); const m = JSON.parse(d1Json).find(function(d) { return d.name === db; }); if (m) dbId = m.uuid || m.id; } catch {} }

    if (dbId) {
      console.log('  D1 database: ' + db + ' (' + dbId.slice(0, 8) + '...)');
      if (confirm) {
        try {
          execFileSync(isWin ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'delete', db, '-y'], { stdio: 'pipe' });
          ok('Deleted D1 database');
        } catch (e) { err('Failed to delete D1: ' + (e.stderr || e.message)); }
      } else { info('Would delete: npx wrangler d1 delete ' + db + ' -y'); }
    } else { warn('D1 database not found: ' + db); }
  }
} else { warn('npx/wrangler not installed — skipping Cloudflare resource deletion'); }

// 4. Local .git directory (only with --confirm --delete-git)
if (fs.existsSync('.git')) {
  if (confirm && deleteGit) {
    try { fs.rmSync('.git', { recursive: true, force: true }); ok('Deleted .git directory'); }
    catch (e) { err('Failed to delete .git: ' + e.message); }
  } else if (confirm) {
    info('.git preserved (use --delete-git to remove)');
  } else {
    info('Would preserve .git (use --confirm --delete-git to remove)');
  }
}

console.log('');
if (!confirm) {
  console.log(Y + '  This was a dry run. To actually delete, run:' + R);
  console.log('    npm run teardown -- --confirm');
  console.log('');
}
