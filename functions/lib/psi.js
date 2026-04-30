/**
 * PageSpeed Insights helpers — distillation, validation, escaping, email templates.
 *
 * Split from /api/psi-audit.js so the POST handler stays focused on flow control
 * and so unit tests (when added) can target the pure functions directly.
 */

// ----------------------------------------------------------------------------
// Industry whitelist
// ----------------------------------------------------------------------------

export const INDUSTRY_WHITELIST = [
  'ecommerce',
  'professional-services',
  'restaurant',
  'medical',
  'construction',
  'real-estate',
  'nonprofit',
  'saas',
  'creative',
  'education',
  'automotive',
  'other',
];

const INDUSTRY_LABELS = {
  'ecommerce': 'E-commerce',
  'professional-services': 'Professional Services',
  'restaurant': 'Restaurant / Hospitality',
  'medical': 'Medical / Healthcare',
  'construction': 'Construction / Trades',
  'real-estate': 'Real Estate',
  'nonprofit': 'Nonprofit',
  'saas': 'SaaS / Software',
  'creative': 'Creative / Agency',
  'education': 'Education',
  'automotive': 'Automotive',
  'other': 'Other',
};

export function industryLabel(value) {
  return INDUSTRY_LABELS[value] || 'Other';
}

// ----------------------------------------------------------------------------
// URL validation — rejects loopback / private RFC1918 / TLD-less hosts
// ----------------------------------------------------------------------------

export function validateUrl(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return { valid: false, error: 'URL is required' };
  }
  let parsed;
  try {
    parsed = new URL(input.trim());
  } catch {
    return { valid: false, error: 'That doesn\'t look like a valid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'URL must start with http:// or https://' };
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) return { valid: false, error: 'URL is missing a hostname' };
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    return { valid: false, error: 'Public URLs only — localhost can\'t be audited' };
  }
  if (/^10\./.test(host)) return { valid: false, error: 'Public URLs only' };
  if (/^192\.168\./.test(host)) return { valid: false, error: 'Public URLs only' };
  if (/^169\.254\./.test(host)) return { valid: false, error: 'Public URLs only' };
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return { valid: false, error: 'Public URLs only' };
  if (!host.includes('.')) return { valid: false, error: 'URL needs a domain (like example.com)' };
  return { valid: true, normalized: parsed.toString(), host };
}

// ----------------------------------------------------------------------------
// PSI URL builder — categories MUST be appended individually
// ----------------------------------------------------------------------------

export function buildPsiUrl(targetUrl, apiKey) {
  const u = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  u.searchParams.set('url', targetUrl);
  u.searchParams.set('key', apiKey);
  u.searchParams.set('strategy', 'mobile');
  u.searchParams.append('category', 'PERFORMANCE');
  u.searchParams.append('category', 'ACCESSIBILITY');
  u.searchParams.append('category', 'BEST_PRACTICES');
  u.searchParams.append('category', 'SEO');
  return u.toString();
}

// ----------------------------------------------------------------------------
// Lighthouse threshold labels (mobile)
// ----------------------------------------------------------------------------

function vitalLabel(metric, value) {
  if (value == null || Number.isNaN(value)) return null;
  switch (metric) {
    case 'lcp':  return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'fcp':  return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    case 'ttfb': return value <= 800  ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
    case 'cls':  return value <= 0.1  ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'inp':  return value <= 200  ? 'good' : value <= 500  ? 'needs-improvement' : 'poor';
    default: return null;
  }
}

// ----------------------------------------------------------------------------
// Distillation — collapses 1MB+ PSI JSON into ~30KB UI-ready summary
// ----------------------------------------------------------------------------

export function distillPsi(psi, fetchedUrl) {
  const lh = psi.lighthouseResult || {};
  const cats = lh.categories || {};
  const audits = lh.audits || {};

  const scoreOf = (cat) => {
    const s = cats[cat]?.score;
    return typeof s === 'number' ? Math.round(s * 100) : null;
  };

  const numAudit = (id) => {
    const a = audits[id];
    return a ? { ms: typeof a.numericValue === 'number' ? Math.round(a.numericValue) : null, score: typeof a.score === 'number' ? a.score : null } : { ms: null, score: null };
  };

  const lcpRaw = numAudit('largest-contentful-paint');
  const fcpRaw = numAudit('first-contentful-paint');
  const ttfbRaw = numAudit('server-response-time');
  const clsAudit = audits['cumulative-layout-shift'];
  const clsValue = clsAudit && typeof clsAudit.numericValue === 'number' ? Math.round(clsAudit.numericValue * 1000) / 1000 : null;
  const clsScore = clsAudit && typeof clsAudit.score === 'number' ? clsAudit.score : null;

  // INP only from field data (CrUX); lab Lighthouse runs do not include it.
  const inpField = psi.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT_MS;
  const inpMs = typeof inpField?.percentile === 'number' ? inpField.percentile : null;

  const vitals = {
    lcp:  { ms: lcpRaw.ms,  score: lcpRaw.score,  label: vitalLabel('lcp',  lcpRaw.ms) },
    cls:  { value: clsValue, score: clsScore,     label: vitalLabel('cls',  clsValue) },
    inp:  { ms: inpMs, score: null, label: vitalLabel('inp', inpMs), source: inpMs == null ? null : 'field' },
    fcp:  { ms: fcpRaw.ms,  score: fcpRaw.score,  label: vitalLabel('fcp',  fcpRaw.ms) },
    ttfb: { ms: ttfbRaw.ms, score: ttfbRaw.score, label: vitalLabel('ttfb', ttfbRaw.ms) },
  };

  // Top opportunities (savings audits with score < 0.9 and a real saving)
  const opps = Object.entries(audits)
    .filter(([, a]) => a?.details?.type === 'opportunity' && typeof a.score === 'number' && a.score < 0.9 && typeof a.numericValue === 'number' && a.numericValue > 0)
    .map(([id, a]) => ({
      id,
      title: a.title || '',
      description: a.description || '',
      savingsMs: Math.round(a.numericValue || 0),
      savingsBytes: a.details?.overallSavingsBytes || 0,
      displayValue: a.displayValue || '',
    }))
    .sort((a, b) => b.savingsMs - a.savingsMs)
    .slice(0, 5);

  const totalBytes = audits['total-byte-weight']?.numericValue;
  const requestCount = audits['network-requests']?.details?.items?.length;

  return {
    scores: {
      performance: scoreOf('performance'),
      accessibility: scoreOf('accessibility'),
      bestPractices: scoreOf('best-practices'),
      seo: scoreOf('seo'),
    },
    vitals,
    topOpportunities: opps,
    diagnostics: {
      pageWeightKb: typeof totalBytes === 'number' ? Math.round(totalBytes / 1024) : null,
      requestCount: typeof requestCount === 'number' ? requestCount : null,
    },
    fetchedUrl,
    finalUrl: lh.finalDisplayedUrl || lh.requestedUrl || fetchedUrl,
    auditAt: lh.fetchTime || new Date().toISOString(),
  };
}

// ----------------------------------------------------------------------------
// Screenshot extraction — PSI returns base64 JPEG in a data URI
// ----------------------------------------------------------------------------

export function extractScreenshotBytes(psi) {
  const dataUri = psi?.lighthouseResult?.audits?.['final-screenshot']?.details?.data;
  if (typeof dataUri !== 'string') return null;
  const comma = dataUri.indexOf(',');
  if (comma < 0) return null;
  const b64 = dataUri.slice(comma + 1);
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Escape helpers — every PSI-derived or user-supplied string MUST pass through
// these before insertion into HTML email or DOM.
// ----------------------------------------------------------------------------

export function htmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripMarkdownLinks(s) {
  return String(s ?? '').replace(/\[([^\]]+)\]\(([^)]*)\)/g, '$1');
}

export function safeText(s) {
  return htmlEscape(stripMarkdownLinks(s));
}

// ----------------------------------------------------------------------------
// Score / vital styling helpers (used by emails)
// ----------------------------------------------------------------------------

function scoreBucket(score) {
  if (score == null) return { label: '—', color: '#9ca3af' };
  if (score >= 90) return { label: 'Good', color: '#00bd74' };
  if (score >= 50) return { label: 'Needs work', color: '#f59e0b' };
  return { label: 'Poor', color: '#ef4444' };
}

function vitalColor(label) {
  if (label === 'good') return '#00bd74';
  if (label === 'needs-improvement') return '#f59e0b';
  if (label === 'poor') return '#ef4444';
  return '#9ca3af';
}

function formatMs(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

// ----------------------------------------------------------------------------
// Email — user copy
// ----------------------------------------------------------------------------

export function buildUserEmail({ summary, screenshotUrl, siteUrl, host }) {
  const s = summary.scores;
  const v = summary.vitals;
  const safeHost = htmlEscape(host);
  const safeFinal = htmlEscape(summary.finalUrl);
  const totalSavingsSec = summary.topOpportunities.reduce((acc, o) => acc + (o.savingsMs || 0), 0) / 1000;

  const scoreCell = (label, value) => {
    const b = scoreBucket(value);
    return `
      <td align="center" valign="middle" style="padding:14px 8px;border:1px solid #eef0ee;border-radius:12px;background:#ffffff;">
        <div style="font:800 36px/1 'Helvetica Neue',Arial,sans-serif;color:${b.color};letter-spacing:-0.02em;">${value == null ? '—' : value}</div>
        <div style="margin-top:6px;font:700 11px/1 Arial,sans-serif;color:#262421;text-transform:uppercase;letter-spacing:0.08em;">${label}</div>
        <div style="margin-top:4px;font:400 11px/1 Arial,sans-serif;color:${b.color};">${b.label}</div>
      </td>`;
  };

  const vitalCell = (label, value, vlabel) => {
    const c = vitalColor(vlabel);
    return `
      <td align="center" valign="middle" style="padding:10px;border-radius:999px;background:${c}1f;">
        <span style="font:700 12px/1 Arial,sans-serif;color:${c};text-transform:uppercase;letter-spacing:0.06em;">${label}</span>
        <span style="font:700 12px/1 Arial,sans-serif;color:#262421;margin-left:6px;">${value}</span>
      </td>`;
  };

  const oppRow = (o) => {
    const t = safeText(o.title);
    const savings = o.savingsMs > 0 ? ` &mdash; <strong style="color:#006940;">Save ${formatMs(o.savingsMs)}</strong>` : '';
    return `<li style="margin:0 0 8px 0;font:400 14px/1.5 Arial,sans-serif;color:#262421;">${t}${savings}</li>`;
  };

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Your PageSpeed Audit</title></head>
<body style="margin:0;padding:0;background:#faf7f4;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#faf7f4;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(17,24,39,0.08);">
        <tr><td style="background:#0d1411;padding:22px 28px;">
          <div style="font:800 18px/1 'Helvetica Neue',Arial,sans-serif;color:#ffffff;letter-spacing:-0.01em;">UI Compass</div>
          <div style="font:400 12px/1 Arial,sans-serif;color:#00bd74;margin-top:6px;text-transform:uppercase;letter-spacing:0.16em;">PageSpeed Audit</div>
        </td></tr>

        <tr><td style="padding:28px 28px 12px 28px;">
          <h1 style="margin:0 0 6px 0;font:800 22px/1.2 'Helvetica Neue',Arial,sans-serif;color:#262421;">Your audit for ${safeHost}</h1>
          <p style="margin:0;font:400 14px/1.5 Arial,sans-serif;color:#4e4b66;">Mobile audit complete. Here's what Google's own tooling found.</p>
        </td></tr>

        ${screenshotUrl ? `<tr><td style="padding:14px 28px;">
          <img src="${htmlEscape(screenshotUrl)}" alt="Screenshot of ${safeHost}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border-radius:12px;border:1px solid #eef0ee;">
        </td></tr>` : ''}

        <tr><td style="padding:18px 28px 6px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="6" border="0" width="100%">
            <tr>
              ${scoreCell('Performance', s.performance)}
              ${scoreCell('Accessibility', s.accessibility)}
            </tr>
            <tr>
              ${scoreCell('Best Practices', s.bestPractices)}
              ${scoreCell('SEO', s.seo)}
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:8px 28px 18px 28px;">
          <p style="margin:0 0 10px 0;font:700 12px/1 Arial,sans-serif;color:#262421;text-transform:uppercase;letter-spacing:0.08em;">Core Web Vitals</p>
          <table role="presentation" cellpadding="0" cellspacing="6" border="0">
            <tr>
              ${vitalCell('LCP', formatMs(v.lcp.ms), v.lcp.label)}
              ${vitalCell('CLS', v.cls.value == null ? '—' : v.cls.value.toFixed(3), v.cls.label)}
              ${vitalCell('INP', v.inp.ms == null ? '—' : formatMs(v.inp.ms), v.inp.label)}
              ${vitalCell('FCP', formatMs(v.fcp.ms), v.fcp.label)}
              ${vitalCell('TTFB', formatMs(v.ttfb.ms), v.ttfb.label)}
            </tr>
          </table>
          ${v.inp.ms == null ? '<p style="margin:8px 0 0 0;font:400 11px/1.4 Arial,sans-serif;color:#9ca3af;">INP is field data only — your page hasn\'t collected enough real-user data yet.</p>' : ''}
        </td></tr>

        ${summary.topOpportunities.length ? `
        <tr><td style="padding:6px 28px 18px 28px;">
          <p style="margin:0 0 8px 0;font:700 12px/1 Arial,sans-serif;color:#262421;text-transform:uppercase;letter-spacing:0.08em;">Biggest opportunities</p>
          <ul style="margin:0;padding:0 0 0 20px;">
            ${summary.topOpportunities.slice(0, 3).map(oppRow).join('')}
          </ul>
          ${totalSavingsSec >= 0.5 ? `<p style="margin:10px 0 0 0;font:400 13px/1.5 Arial,sans-serif;color:#262421;">Total potential savings: <strong style="color:#006940;">${totalSavingsSec.toFixed(1)} seconds</strong> on mobile load.</p>` : ''}
        </td></tr>` : ''}

        <tr><td align="center" style="padding:6px 28px 28px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#006940" style="border-radius:10px;">
              <a href="${htmlEscape(siteUrl)}/pricing/" style="display:inline-block;padding:14px 28px;font:800 14px/1 Arial,sans-serif;color:#ffffff;text-decoration:none;letter-spacing:0.04em;text-transform:uppercase;">Get this fixed &rarr;</a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:14px 28px 22px 28px;border-top:1px solid #eef0ee;">
          <p style="margin:0;font:400 12px/1.5 Arial,sans-serif;color:#9ca3af;">Audited URL: ${safeFinal}<br>UI Compass &middot; Hand-coded sites for small businesses.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Your PageSpeed Audit for ${host}`,
    '',
    `Performance: ${s.performance ?? '—'}/100`,
    `Accessibility: ${s.accessibility ?? '—'}/100`,
    `Best Practices: ${s.bestPractices ?? '—'}/100`,
    `SEO: ${s.seo ?? '—'}/100`,
    '',
    `LCP: ${formatMs(v.lcp.ms)} (${v.lcp.label || '—'})`,
    `CLS: ${v.cls.value == null ? '—' : v.cls.value.toFixed(3)} (${v.cls.label || '—'})`,
    `INP: ${v.inp.ms == null ? '— (field data only)' : `${formatMs(v.inp.ms)} (${v.inp.label})`}`,
    `FCP: ${formatMs(v.fcp.ms)} (${v.fcp.label || '—'})`,
    `TTFB: ${formatMs(v.ttfb.ms)} (${v.ttfb.label || '—'})`,
    '',
    summary.topOpportunities.length ? 'Biggest opportunities:' : '',
    ...summary.topOpportunities.slice(0, 3).map(o => `  - ${stripMarkdownLinks(o.title)}${o.savingsMs > 0 ? ` (save ${formatMs(o.savingsMs)})` : ''}`),
    '',
    `Get this fixed: ${siteUrl}/pricing/`,
    `Audited URL: ${summary.finalUrl}`,
  ].filter(Boolean).join('\n');

  return { html, text };
}

// ----------------------------------------------------------------------------
// Email — owner notification
// ----------------------------------------------------------------------------

export function buildOwnerEmail({ summary, lead, host, siteUrl, jobId }) {
  const s = summary.scores;
  const safeHost = htmlEscape(host);
  const safeFinal = htmlEscape(summary.finalUrl);
  const safeEmail = htmlEscape(lead.email);
  const safeIndustry = htmlEscape(industryLabel(lead.industry));
  const safeIp = htmlEscape(lead.ip || 'unknown');
  const safeUa = htmlEscape((lead.userAgent || '').slice(0, 200));

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>New audit lead</title></head>
<body style="margin:0;padding:0;background:#faf7f4;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:14px;padding:24px;">
    <div style="font:700 12px/1 Arial,sans-serif;color:#00bd74;text-transform:uppercase;letter-spacing:0.16em;">New audit lead</div>
    <h1 style="margin:6px 0 18px 0;font:800 20px/1.2 Arial,sans-serif;color:#262421;">${safeEmail}</h1>

    <table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;font:400 14px/1.4 Arial,sans-serif;color:#262421;">
      <tr><td style="color:#9ca3af;width:120px;">Industry</td><td>${safeIndustry}</td></tr>
      <tr><td style="color:#9ca3af;">URL</td><td>${safeFinal}</td></tr>
      <tr><td style="color:#9ca3af;">IP</td><td>${safeIp}</td></tr>
      <tr><td style="color:#9ca3af;">User agent</td><td style="color:#4e4b66;font-size:12px;">${safeUa}</td></tr>
      <tr><td style="color:#9ca3af;">Job ID</td><td style="font-family:monospace;font-size:12px;color:#4e4b66;">${htmlEscape(jobId)}</td></tr>
    </table>

    <div style="margin-top:18px;padding:14px;border-radius:10px;background:#f7f7f7;font:700 14px/1.4 Arial,sans-serif;color:#262421;">
      Perf <span style="color:${scoreBucket(s.performance).color};">${s.performance ?? '—'}</span> &nbsp;/&nbsp;
      A11y <span style="color:${scoreBucket(s.accessibility).color};">${s.accessibility ?? '—'}</span> &nbsp;/&nbsp;
      BP <span style="color:${scoreBucket(s.bestPractices).color};">${s.bestPractices ?? '—'}</span> &nbsp;/&nbsp;
      SEO <span style="color:${scoreBucket(s.seo).color};">${s.seo ?? '—'}</span>
    </div>

    <p style="margin:16px 0 0 0;font:400 13px/1.5 Arial,sans-serif;color:#4e4b66;">
      <a href="${htmlEscape(siteUrl)}/api/audit-screenshot/${htmlEscape(jobId)}" style="color:#006940;">View screenshot &rarr;</a>
    </p>
  </div>
</body></html>`;

  const text = [
    `New audit lead: ${lead.email}`,
    `Industry: ${industryLabel(lead.industry)}`,
    `URL: ${summary.finalUrl}`,
    `IP: ${lead.ip || 'unknown'}`,
    `Job ID: ${jobId}`,
    '',
    `Perf ${s.performance ?? '—'} / A11y ${s.accessibility ?? '—'} / BP ${s.bestPractices ?? '—'} / SEO ${s.seo ?? '—'}`,
    '',
    `Screenshot: ${siteUrl}/api/audit-screenshot/${jobId}`,
  ].join('\n');

  return { html, text };
}
