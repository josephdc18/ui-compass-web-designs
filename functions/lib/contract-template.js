/**
 * Generic contract template engine.
 * Generates service agreement HTML from structured data.
 * Replaces TC Visuals-specific template with industry-generic version.
 */

function escapeHtml(v) {
  if (v == null) return '';
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function sanitizeSectionBody(html) {
  if (typeof html !== 'string') return '<p></p>';
  let clean = html;
  clean = clean.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\/\1>/gi, '');
  clean = clean.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, '');
  clean = clean.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  clean = clean.replace(/\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  clean = clean.replace(/\s+(?!class\b)[a-zA-Z:-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/g, '');
  clean = clean.replace(/<(?!\/?(p|br|strong|em|ul|ol|li|h[1-6]|table|tr|td|th)\b)[^>]*>/gi, '');
  clean = clean.replace(/javascript:/gi, '');
  clean = clean.trim();
  return clean || '<p></p>';
}

/**
 * Generate contract HTML from structured params.
 * @param {{ businessName, businessEmail, businessAddress, clientName, clientEmail, title, sections: [{heading, body}], effectiveDate }} params
 * @returns {string} Complete HTML document
 */
export function generateContractHTML(params) {
  const {
    businessName = 'Service Provider',
    businessEmail = '',
    businessAddress = '',
    clientName = 'Client',
    clientEmail = '',
    title = 'Service Agreement',
    sections = [],
    effectiveDate,
  } = params;

  const date = formatDate(effectiveDate || new Date().toISOString());
  const defaultSections = sections.length > 0 ? sections : [
    { heading: 'Scope of Work', body: '<p>The Provider agrees to perform the services described in the attached scope document or as mutually agreed upon in writing.</p>' },
    { heading: 'Payment Terms', body: '<p>Payment is due upon completion of services unless otherwise agreed. Late payments may incur a fee of 1.5% per month.</p>' },
    { heading: 'Cancellation Policy', body: '<p>Either party may cancel this agreement with 48 hours written notice. Cancellations within 48 hours may be subject to a cancellation fee.</p>' },
    { heading: 'Limitation of Liability', body: '<p>Provider\'s total liability shall not exceed the total amount paid under this agreement.</p>' },
    { heading: 'Acceptance', body: '<p>By signing below, both parties agree to the terms and conditions outlined in this agreement.</p>' },
  ];

  const sectionsHTML = defaultSections.map((s, i) =>
    `<div style="margin-bottom:24px;">
      <h3 style="margin:0 0 8px;font-size:16px;font-weight:600;color:#333;">${i+1}. ${escapeHtml(s.heading)}</h3>
      <div style="font-size:14px;color:#555;line-height:1.6;">${sanitizeSectionBody(s.body || '')}</div>
    </div>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#333; }
  .contract { max-width:700px; margin:0 auto; }
  .header { text-align:center; margin-bottom:40px; padding-bottom:20px; border-bottom:2px solid #000; }
  .header h1 { margin:0 0 8px; font-size:24px; font-weight:700; }
  .header p { margin:4px 0; font-size:14px; color:#666; }
  .parties { display:flex; gap:40px; margin-bottom:32px; }
  .party { flex:1; }
  .party h4 { margin:0 0 8px; font-size:13px; text-transform:uppercase; letter-spacing:1px; color:#888; }
  .party p { margin:4px 0; font-size:14px; }
  .signature-area { margin-top:48px; padding-top:24px; border-top:1px solid #ddd; }
  .sig-line { border-bottom:1px solid #333; height:60px; margin:16px 0 4px; position:relative; }
  .sig-label { font-size:12px; color:#888; }
  .sig-placeholder { position:absolute; bottom:8px; left:0; font-size:14px; color:#ccc; }
</style>
</head>
<body>
<div class="contract">
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(businessName)}</p>
    <p>Effective Date: ${escapeHtml(date)}</p>
  </div>
  <div class="parties">
    <div class="party">
      <h4>Provider</h4>
      <p style="font-weight:600;">${escapeHtml(businessName)}</p>
      ${businessAddress ? '<p>' + escapeHtml(businessAddress) + '</p>' : ''}
      ${businessEmail ? '<p>' + escapeHtml(businessEmail) + '</p>' : ''}
    </div>
    <div class="party">
      <h4>Client</h4>
      <p style="font-weight:600;">${escapeHtml(clientName)}</p>
      ${clientEmail ? '<p>' + escapeHtml(clientEmail) + '</p>' : ''}
    </div>
  </div>
  ${sectionsHTML}
  <div class="signature-area">
    <p style="font-size:12px;color:#888;margin-bottom:24px;">
      By signing below, the parties acknowledge and agree to the terms above.
    </p>
    <div style="display:flex;gap:40px;">
      <div style="flex:1;">
        <div class="sig-line"><span class="sig-placeholder"><!-- CLIENT_SIGNATURE --></span></div>
        <p class="sig-label">${escapeHtml(clientName)} — Client</p>
        <p class="sig-label">Date: <!-- CLIENT_SIGN_DATE --></p>
      </div>
      <div style="flex:1;">
        <div class="sig-line"><span class="sig-placeholder"><!-- PROVIDER_SIGNATURE --></span></div>
        <p class="sig-label">${escapeHtml(businessName)} — Provider</p>
        <p class="sig-label">Date: <!-- PROVIDER_SIGN_DATE --></p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Inject a signature image into contract HTML.
 */
export function injectSignatureIntoHTML(html, signatureData, signerName, signedAt) {
  if (!signatureData || !html) return html;
  const sigRe = /data:image\/(png|jpeg|jpg|gif|svg\+xml);base64,[A-Za-z0-9+/=]+/;
  if (!sigRe.test(signatureData)) return html;

  const dateStr = signedAt ? new Date(signedAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : '';
  let result = html.replace(
    '<!-- CLIENT_SIGNATURE -->',
    `<img src="${signatureData}" alt="Signature" style="max-height:50px;max-width:200px;" />`
  );
  result = result.replace('<!-- CLIENT_SIGN_DATE -->', escapeHtml(dateStr));
  return result;
}

/**
 * Sanitize contract HTML — strip dangerous elements/attributes.
 * Allowlisted: p, br, strong, em, ul, ol, li, h1-h6, table, tr, td, th, div, span, img, a.
 * No attributes except class, style (inline layout only), href, src, alt.
 * Strips: script, iframe, object, embed, link, meta, on* handlers, javascript: URIs.
 */
export function sanitizeContractHTML(html) {
  if (!html || typeof html !== 'string') return '';
  // Strip script/iframe/object/embed/link/meta tags and their content
  let clean = html.replace(/<(script|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\/\1>/gi, '');
  clean = clean.replace(/<(script|iframe|object|embed|link|meta)[^>]*\/?\ *>/gi, '');
  // Strip on* event handlers
  clean = clean.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  // Strip javascript: URIs
  clean = clean.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');
  clean = clean.replace(/src\s*=\s*["']\s*javascript:[^"']*["']/gi, 'src=""');
  return clean;
}
