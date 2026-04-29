#!/usr/bin/env node
/**
 * Automated project setup — handles steps 1-9 of the deploy guide.
 * Run: npm run init   (or: node setup.js)
 * Generated at export time with baked-in project config.
 */

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

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
const R = '\x1b[0m', G = '\x1b[32m', Y = '\x1b[33m', RD = '\x1b[31m', C = '\x1b[36m', B = '\x1b[1m', D = '\x1b[2m';

function log(i, m) { console.log(i + ' ' + m); }
function logStep(n, t, m) { console.log(C + '[' + n + '/' + t + ']' + R + ' ' + m); }
function ok(m) { console.log('  ' + G + '\u2713' + R + ' ' + m); }
function warn(m) { console.log('  ' + Y + '\u26A0' + R + ' ' + m); }
function err(m) { console.log('  ' + RD + '\u2717' + R + ' ' + m); }
function info(m) { console.log('  ' + D + '\u2192 ' + m + R); }

function exec(cmd, args, opts) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}
function execSafe(cmd, args, opts) { try { return exec(cmd, args, opts); } catch { return null; } }
function hasCmd(n) { try { execFileSync(isWin ? 'where' : 'which', [n], { stdio: 'pipe' }); return true; } catch { return false; } }
function npx(args, opts) { return exec(isWin ? 'npx.cmd' : 'npx', args, opts); }
function npxSafe(args, opts) { try { return npx(args, opts); } catch { return null; } }
function npxI(args) {
  const r = spawnSync(isWin ? 'npx.cmd' : 'npx', args, { stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('Command failed with exit code ' + r.status);
}
function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(q, a => { rl.close(); r(a.trim()); }));
}

const results = [];
let gitFailed = false;

function rec(step, success, skipped, msg) { results.push({ step, success, skipped, message: msg }); }

async function s1() {
  logStep(1, 9, 'Installing dependencies...');
  if (fs.existsSync('node_modules') && fs.existsSync('package-lock.json')) {
    ok('Already installed'); rec('Install', true, true, 'Already installed'); return;
  }
  try {
    const r = spawnSync(isWin ? 'npm.cmd' : 'npm', ['install'], { stdio: 'inherit' });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error('npm install exited with code ' + r.status);
    ok('Dependencies installed'); rec('Install', true, false, 'Done');
  } catch (e) { err('npm install failed: ' + e.message); rec('Install', false, false, e.message); }
}

async function s2() {
  logStep(2, 9, 'Initializing Git repository...');
  if (fs.existsSync('.git')) { ok('Already initialized'); rec('Git', true, true, 'Exists'); return; }
  try { exec('git', ['init']); ok('Repo initialized'); exec('git', ['add', '.']); ok('Files staged'); } catch (e) {
    err('Git init failed: ' + e.message); rec('Git', false, false, e.message); gitFailed = true; return;
  }
  try { exec('git', ['commit', '-m', 'Initial commit']); ok('Initial commit created'); rec('Git', true, false, 'Done'); } catch (e) {
    const m = (e.stderr || e.message || '');
    if (m.includes('user.email') || m.includes('tell me who')) {
      warn('Git identity not configured:');
      info('git config user.email "you@example.com"');
      info('git config user.name "Your Name"');
      info('Then: git commit -m "Initial commit"');
    } else { err('Commit failed: ' + m); }
    gitFailed = true; rec('Git', false, false, 'Identity not configured');
  }
}

async function s3() {
  logStep(3, 9, 'Creating GitHub repository...');
  if (gitFailed) { warn('Skipped: Git commit failed'); rec('GitHub', false, true, 'Git failed'); return; }
  if (!hasCmd('gh')) { warn('gh CLI not found'); info('Install: https://cli.github.com'); info('Then: gh repo create ' + CONFIG.slug + ' --public --source=. --push'); rec('GitHub', false, true, 'gh not found'); return; }
  if (execSafe('gh', ['repo', 'view', CONFIG.slug, '--json', 'name'])) { ok('Repo already exists'); rec('GitHub', true, true, 'Exists'); return; }
  try { exec('gh', ['repo', 'create', CONFIG.slug, '--public', '--source=.', '--push']); ok('Repo created & pushed'); rec('GitHub', true, false, 'Created'); }
  catch (e) { err('Failed: ' + e.message); info('Run: gh repo create ' + CONFIG.slug + ' --public --source=. --push'); rec('GitHub', false, false, e.message); return; }
  // Request delete_repo scope now so teardown can delete the repo later
  try { spawnSync('gh', ['auth', 'refresh', '-h', 'github.com', '-s', 'delete_repo'], { stdio: 'inherit' }); ok('delete_repo scope granted'); }
  catch {}
}

async function s4() {
  logStep(4, 9, 'Authenticating with Cloudflare...');
  if (npxSafe(['wrangler', 'whoami'])) { ok('Already authenticated'); rec('Auth', true, true, 'Done'); return; }
  try { info('Opening browser...'); npxI(['wrangler', 'login']); ok('Authenticated'); rec('Auth', true, false, 'Done'); }
  catch (e) { err('Login failed'); info('Run: npx wrangler login'); rec('Auth', false, false, e.message); }
}

async function s5() {
  logStep(5, 9, 'Creating Pages project...');
  const out = npxSafe(['wrangler', 'pages', 'project', 'list', '--json']);
  if (out) { try { var jsonStr = out.slice(out.indexOf('[')); if (JSON.parse(jsonStr).some(p => p.name === CONFIG.slug || p.name.startsWith(CONFIG.slug + '-'))) { ok('Already exists'); rec('Pages', true, true, 'Exists'); return; } } catch {} }
  try { npx(['wrangler', 'pages', 'project', 'create', CONFIG.slug, '--production-branch=main']); ok('Created: ' + CONFIG.slug); rec('Pages', true, false, 'Created'); }
  catch (e) { err('Failed: ' + e.message); rec('Pages', false, false, e.message); }
}

async function s6() {
  logStep(6, 9, 'Setting up D1 database...');
  if (!CONFIG.d1Required) { ok('Not needed'); rec('D1', true, true, 'No D1 features'); return; }
  const db = CONFIG.slug + '-db';
  let id = null;

  // Check existing
  const listOut = npxSafe(['wrangler', 'd1', 'list', '--json']);
  let exists = false;
  if (listOut) { try { const dbs = JSON.parse(listOut.slice(listOut.indexOf('['))); const m = dbs.find(d => d.name === db); if (m) { exists = true; id = m.uuid || m.id; } } catch {} }

  if (!exists) {
    try {
      const createOut = npxSafe(['wrangler', 'd1', 'create', db, '--json']);
      if (createOut) { try { const p = JSON.parse(createOut); id = p.uuid || p.id || p.database_id; } catch {} }
      if (!id) { const t = createOut || npx(['wrangler', 'd1', 'create', db]); const u = t.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i); if (u) id = u[1]; }
      ok('Database created' + (id ? ' (id: ' + id.slice(0, 8) + '...)' : ''));
    } catch (e) { err('D1 creation failed: ' + e.message); rec('D1', false, false, e.message); return; }
  } else { ok('Database exists: ' + db); }

  // Patch wrangler.toml
  try {
    let toml = fs.readFileSync('wrangler.toml', 'utf8');
    if (id && toml.includes('[CHANGE]')) {
      toml = toml.replace('[CHANGE] paste-your-database-id-here', id);
      fs.writeFileSync('wrangler.toml', toml);
      ok('wrangler.toml patched');
    } else if (!toml.includes('[CHANGE]')) { ok('wrangler.toml already patched'); }
    else { warn('Could not determine database ID \u2014 patch wrangler.toml manually'); }
  } catch (e) { warn('wrangler.toml: ' + e.message); }

  // Migrations
  if (fs.existsSync('database/schema.sql')) {
    try { npx(['wrangler', 'd1', 'execute', db, '--local', '--file=database/schema.sql']); ok('Schema applied (local)'); } catch (e) { warn('Local migration: ' + e.message); }
    try { npx(['wrangler', 'd1', 'execute', db, '--remote', '--file=database/schema.sql', '--yes']); ok('Schema applied (remote)'); }
    catch { try { npx(['wrangler', 'd1', 'execute', db, '--remote', '--file=database/schema.sql'], { input: 'y\n' }); ok('Schema applied (remote)'); }
    catch (e) { warn('Remote migration: ' + e.message); info('Run: npx wrangler d1 execute ' + db + ' --remote --file=database/schema.sql'); } }
  }
  rec('D1', true, false, 'Done');
}

async function s6b() {
  logStep('6b', 10, 'Setting up R2 storage...');
  if (!CONFIG.r2Required) { ok('Not needed'); rec('R2', true, true, 'No R2 features'); return; }
  const bucket = CONFIG.slug + '-media';

  // Check existing (exact-name match to avoid substring false positives)
  let bucketExists = false;
  const listJson = npxSafe(['wrangler', 'r2', 'bucket', 'list', '--json']);
  if (listJson) {
    try {
      const parsed = JSON.parse(listJson);
      if (Array.isArray(parsed)) {
        bucketExists = parsed.some(function(entry) {
          return entry && entry.name === bucket;
        });
      }
    } catch {}
  }
  if (!bucketExists) {
    const listOut = npxSafe(['wrangler', 'r2', 'bucket', 'list']) || '';
    bucketExists = listOut.split('\n').some(function(line) {
      const t = line.trim();
      if (!t || /^name\b/i.test(t) || /^-+\s*$/.test(t)) return false;
      const m = t.match(/^([A-Za-z0-9._-]+)/);
      return m ? m[1] === bucket : false;
    });
  }
  if (bucketExists) {
    ok('Bucket exists: ' + bucket); rec('R2', true, true, 'Exists'); return;
  }

  try {
    npx(['wrangler', 'r2', 'bucket', 'create', bucket]);
    ok('Bucket created: ' + bucket);
  } catch (e) { err('R2 bucket creation failed: ' + e.message); rec('R2', false, false, e.message); return; }
  rec('R2', true, false, 'Done');
}

async function s7() {
  logStep(7, 10, 'Building site...');
  try { npxI(['eleventy']); ok('Built to public/'); rec('Build', true, false, 'Done'); }
  catch (e) { err('Build failed'); rec('Build', false, false, e.message); }
}

async function s8() {
  logStep(8, 10, 'Deploying...');
  try {
    const out = npx(['wrangler', 'pages', 'deploy', 'public/', '--project-name=' + CONFIG.slug]);
    const u = out.match(/https:\/\/[^\s]+\.pages\.dev[^\s]*/);
    ok('Deployed: ' + (u ? u[0] : 'https://' + CONFIG.slug + '.pages.dev'));
    rec('Deploy', true, false, u ? u[0] : 'https://' + CONFIG.slug + '.pages.dev');
  } catch (e) { err('Deploy failed'); info('Run: npx wrangler pages deploy public/ --project-name=' + CONFIG.slug); rec('Deploy', false, false, e.message); }
}

async function s9() {
  logStep(9, 10, 'Configuring secrets...');
  if (!CONFIG.secrets || CONFIG.secrets.length === 0) { ok('None needed'); rec('Secrets', true, true, 'None'); return; }
  const skipped = [], set = [], setValues = {};

  // Pre-load defaults from existing .dev.vars (so re-runs don't re-prompt)
  const preloaded = {};
  try {
    const dv = fs.readFileSync('.dev.vars', 'utf8');
    for (const line of dv.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const eq = line.indexOf('=');
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (k && v) preloaded[k] = v;
    }
  } catch {}

  // Auto-generation for secrets that support it
  let vapid = null;
  if (CONFIG.secrets.some(s => s.autoGenerate && s.name.startsWith('VAPID_'))) {
    try { vapid = JSON.parse(npx(['web-push', 'generate-vapid-keys', '--json'])); ok('VAPID keys generated'); }
    catch { warn('VAPID auto-gen failed. Install: npm i -g web-push'); }
  }

  for (const s of CONFIG.secrets) {
    let val = null;
    // CRM admin token — auto-generate random 64-char hex
    if (s.autoGenerate && s.name === 'CRM_ADMIN_TOKEN' && !preloaded[s.name]) {
      val = require('crypto').randomBytes(32).toString('hex');
    }
    if (s.autoGenerate && vapid && !val) {
      if (s.name === 'VAPID_PUBLIC_KEY') val = vapid.publicKey;
      else if (s.name === 'VAPID_PRIVATE_KEY') val = vapid.privateKey;
    }
    if (s.name === 'SITE_URL' && !val) {
      const sug = preloaded[s.name] || 'https://' + CONFIG.slug + '.pages.dev';
      const a = await ask('  ' + s.name + ' [' + sug + ']: ');
      val = a || sug;
    }
    if (!val && preloaded[s.name]) {
      const masked = preloaded[s.name].length > 8
        ? preloaded[s.name].slice(0, 4) + '...' + preloaded[s.name].slice(-4)
        : '****';
      const a = await ask('  ' + s.name + ' [' + masked + ']: ');
      val = a || preloaded[s.name];
    }
    if (!val) {
      const lbl = s.required ? ' (required)' : ' (optional, Enter to skip)';
      const a = await ask('  ' + s.name + lbl + ': ');
      if (!a) { if (s.required) skipped.push(s.name); continue; }
      val = a;
    }
    try {
      execFileSync(isWin ? 'npx.cmd' : 'npx',
        ['wrangler', 'pages', 'secret', 'put', s.name, '--project-name', CONFIG.slug],
        { input: val, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' });
      ok(s.name + ' set'); set.push(s.name); setValues[s.name] = val;
    } catch (e) { warn('Failed: ' + s.name); skipped.push(s.name); }
  }
  const requiredSkipped = skipped.filter(name => CONFIG.secrets.find(s => s.name === name && s.required));
  if (requiredSkipped.length) { err('Required secrets not set: ' + requiredSkipped.join(', ')); info('Set later: npx wrangler pages secret put NAME --project-name ' + CONFIG.slug); }
  else if (skipped.length) { warn('Skipped optional: ' + skipped.join(', ')); info('Set later: npx wrangler pages secret put NAME --project-name ' + CONFIG.slug); }

  // Write .dev.vars for local dev parity (actual values for local testing)
  const devVarsLines = ['# Local development secrets \u2014 DO NOT commit'];
  for (const s of CONFIG.secrets) {
    devVarsLines.push(s.name + '=' + (setValues[s.name] || ''));
  }
  try {
    fs.writeFileSync('.dev.vars', devVarsLines.join('\n') + '\n');
    ok('.dev.vars written (local dev secrets)');
  } catch (e) { warn('.dev.vars: ' + e.message); }

  rec('Secrets', requiredSkipped.length === 0, false, set.length + ' set, ' + skipped.length + ' skipped');
}

async function main() {
  console.log('');
  console.log(B + '  Project Setup: ' + CONFIG.slug + R);
  const feat = Object.entries(CONFIG.features).filter(([,v]) => v).map(([k]) => k);
  console.log(D + '  Features: ' + feat.join(', ') + R);
  console.log('');

  if (parseInt(process.versions.node, 10) < 16) { err('Node.js 16+ required'); process.exit(1); }
  if (!hasCmd('git')) { err('Git required: https://git-scm.com'); process.exit(1); }

  await s1(); await s2(); await s3(); await s4(); await s5(); await s6(); await s6b(); await s7(); await s8(); await s9();

  console.log('');
  const allOk = results.every(r => r.success || r.skipped);
  console.log(allOk ? G + B + '  \u2705 Setup Complete!' + R : Y + B + '  \u26A0  Partially Complete' + R);

  const dep = results.find(r => r.step === 'Deploy');
  if (dep && dep.success && !dep.skipped) console.log('  Site: ' + dep.message);

  const failed = results.filter(r => !r.success && !r.skipped);
  if (failed.length) { console.log(''); console.log(RD + '  Failed:' + R); failed.forEach(r => console.log('    ' + RD + '\u2717' + R + ' ' + r.step + ': ' + r.message)); }

  const manual = [];
  if (CONFIG.features.cms) manual.push('Create GitHub OAuth App (see SETUP.html Phase 5)');
  if (CONFIG.features.shop || CONFIG.features.invoicing) manual.push('Add Stripe API keys (see SETUP.html)');
  manual.push('Set up custom domain (Cloudflare Pages dashboard)');
  console.log(''); console.log(D + '  Still needed:' + R); manual.forEach(m => console.log('    ' + D + '\u2022 ' + m + R));
  console.log('');
  process.exit(allOk ? 0 : 1);
}

main().catch(e => { err('Error: ' + e.message); process.exit(1); });
