/**
 * Public Signing Endpoints — catch-all route handler
 * Auth via signing session tokens (not admin/portal JWT). Rate-limited.
 *
 * GET  /api/portal/sign/verify       — Verify signing link, send OTP
 * POST /api/portal/sign/verify-otp   — Verify OTP, return contract HTML
 * POST /api/portal/sign/resend-otp   — Resend OTP code
 * POST /api/portal/sign/submit       — Submit signature
 */

import { sha256, checkRateLimit } from '../../../lib/security.js';
import { generateOTP, verifyOTP, hashContractHTML, maskEmail } from '../../../lib/esign-crypto.js';
import { recordEvent } from '../../../lib/esign-events.js';
import { createNotification } from '../../../lib/notifications.js';
import { sendEmail } from '../../../lib/email.js';
import { isContractSignableStatus } from '../../../lib/contract-lifecycle.js';
import { injectSignatureIntoHTML } from '../../../lib/contract-template.js';
import { preflight } from '../../../lib/preflight.js';
import { ensureMigrations } from '../../../lib/migrate.js';

const ESIGN_SIGN_MIGRATIONS = { pack: 'esign', migrations: [] };
let signMigrated = false;

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } });
}
function errorResponse(message, status = 400, extraHeaders = {}) { return jsonResponse({ error: message }, status, extraHeaders); }
function escapeHtml(v) { if (v == null) return ''; return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map(s => s.trim()) : [env.SITE_URL || ''].map(s => s.replace(/\/+$/, ''));
  const isDev = !env.SITE_URL || String(env.SITE_URL).startsWith('http://localhost');
  const isAllowed = isDev ? origin.startsWith('http://localhost') : allowed.includes(origin);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
  };
  if (isAllowed && origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const corsHeaders = getCorsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  const addCors = (res) => { for (const [k,v] of Object.entries(corsHeaders)) res.headers.set(k,v); return res; };

  const pf = preflight(env, ['JWT_SECRET', 'RESEND_API_KEY']);
  if (!pf.ok) return addCors(errorResponse(pf.error, 500));

  const db = env.DB;
  const path = (params.path || []).join('/');
  const method = request.method;
  const url = new URL(request.url);
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || null;

  try {
    if (!signMigrated) {
      try { await ensureMigrations(db, ESIGN_SIGN_MIGRATIONS); signMigrated = true; }
      catch (e) { console.error('[Sign] Migration failed:', e); return addCors(errorResponse('Database migration failed. Contact administrator.', 503)); }
    }
    if ((method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
        !(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
      return addCors(errorResponse('Content-Type must be application/json', 415));
    }

    // GET verify — verify signing link, send OTP
    if (method === 'GET' && path === 'verify') {
      const token = url.searchParams.get('token');
      if (!token) return addCors(errorResponse('Missing token', 400));

      const rl = await checkRateLimit(db, `sign:${clientIP}`, 10, 5);
      if (!rl.allowed) return addCors(errorResponse('Too many requests. Please try again later.', 429, { 'Retry-After': '60' }));

      const tokenHash = await sha256(token);
      const session = await db.prepare(
        `SELECT ss.*, ci.status as contract_status, ci.signer_email, ci.contract_type,
                c.name as client_name, c.email as client_email
         FROM signing_sessions ss
         JOIN contract_instances ci ON ci.id = ss.contract_id
         JOIN clients c ON c.id = ss.client_id
         WHERE ss.token_hash = ? AND ss.token_used_at IS NULL AND ss.expires_at > datetime('now')`
      ).bind(tokenHash).first();

      if (!session) return addCors(errorResponse('Invalid or expired signing link', 401));
      if (!isContractSignableStatus(session.contract_status)) return addCors(errorResponse('This contract is no longer available for signing', 400));

      // Atomically claim this link
      const claim = await db.prepare(
        `UPDATE signing_sessions SET token_used_at = datetime('now'), ip_address = ?, user_agent = ? WHERE id = ? AND token_used_at IS NULL`
      ).bind(clientIP, userAgent, session.id).run();
      if (!claim?.meta?.changes) return addCors(errorResponse('Invalid or expired signing link', 401));

      // Generate and send OTP
      const { plain: otpPlain, hash: otpHash } = await generateOTP();
      await db.prepare(
        `UPDATE signing_sessions SET otp_hash = ?, otp_sent_at = datetime('now'), otp_attempts = 0 WHERE id = ?`
      ).bind(otpHash, session.id).run();

      const signerEmail = session.signer_email || session.client_email;
      const businessName = env.BUSINESS_NAME || 'your service provider';

      const emailResult = await sendEmail(env, {
        to: signerEmail,
        subject: `${businessName} — Your Verification Code: ${otpPlain}`,
        html: `<p>Hi ${escapeHtml(session.client_name || 'there')},</p><p>Enter this code to verify your identity and access your contract:</p><div style="text-align:center;padding:20px;background:#f8f8f8;border:1px solid #eee;margin:16px 0;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;">${otpPlain}</span></div><p style="font-size:12px;color:#999;">This code is valid for your signing session. Do not share it.</p>`,
        text: `Your verification code is: ${otpPlain}\nDo not share this code.`,
      });

      if (!emailResult?.success) {
        try {
          await db.prepare(
            `UPDATE signing_sessions SET token_used_at = NULL, ip_address = NULL, user_agent = NULL, otp_hash = NULL, otp_sent_at = NULL WHERE id = ?`
          ).bind(session.id).run();
        } catch {}
        return addCors(errorResponse('Failed to send verification email. Please try again.', 502));
      }

      // Update contract to viewed
      await db.prepare(
        `UPDATE contract_instances SET viewed_at = COALESCE(viewed_at, datetime('now')), status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END, updated_at = datetime('now') WHERE id = ?`
      ).bind(session.contract_id).run();

      await recordEvent(db, { contractId: session.contract_id, eventType: 'link_accessed', data: { ip: clientIP, user_agent: userAgent }, actor: 'client', ip: clientIP, userAgent });
      await recordEvent(db, { contractId: session.contract_id, eventType: 'otp_sent', data: { session_id: session.id, email_hint: maskEmail(signerEmail) }, actor: 'system', ip: clientIP, userAgent });

      return addCors(jsonResponse({ session_id: session.id, email_hint: maskEmail(signerEmail), contract_type: session.contract_type }));
    }

    // POST verify-otp
    if (method === 'POST' && path === 'verify-otp') {
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { session_id, otp } = body || {};
      if (!session_id || !otp) return addCors(errorResponse('session_id and otp are required', 400));

      const session = await db.prepare(
        `SELECT ss.*, ci.contract_html, ci.signer_email, ci.status as contract_status,
                c.name as client_name, c.email as client_email
         FROM signing_sessions ss
         JOIN contract_instances ci ON ci.id = ss.contract_id
         JOIN clients c ON c.id = ss.client_id
         WHERE ss.id = ? AND ss.expires_at > datetime('now') AND ss.otp_verified = 0`
      ).bind(session_id).first();
      if (!session) return addCors(errorResponse('Invalid or expired session', 401));
      if (!isContractSignableStatus(session.contract_status)) return addCors(errorResponse('Contract is no longer available for signing.', 400));

      // Check if session is permanently locked (5+ failed attempts)
      if (session.otp_attempts >= 5) {
        return addCors(errorResponse('This signing session is permanently locked due to too many failed attempts. A new signing link must be sent.', 403));
      }

      // Increment attempts FIRST
      await db.prepare('UPDATE signing_sessions SET otp_attempts = otp_attempts + 1 WHERE id = ?').bind(session_id).run();
      const currentAttempts = session.otp_attempts + 1;

      const isValid = await verifyOTP(otp, session.otp_hash);
      if (!isValid) {
        await recordEvent(db, { contractId: session.contract_id, eventType: 'otp_failed', data: { attempts: currentAttempts, locked: currentAttempts >= 5 }, actor: 'client', ip: clientIP, userAgent });
        if (currentAttempts >= 5) {
          return addCors(errorResponse('This signing session is permanently locked due to too many failed attempts. A new signing link must be sent.', 403));
        }
        const remaining = 5 - currentAttempts;
        return addCors(errorResponse('Invalid code. ' + remaining + ' attempt' + (remaining !== 1 ? 's' : '') + ' remaining.', 401));
      }

      await db.prepare('UPDATE signing_sessions SET otp_verified = 1 WHERE id = ?').bind(session_id).run();
      await recordEvent(db, { contractId: session.contract_id, eventType: 'otp_verified', data: {}, actor: 'client', ip: clientIP, userAgent });
      await recordEvent(db, { contractId: session.contract_id, eventType: 'contract_viewed', data: {}, actor: 'client', ip: clientIP, userAgent });

      try {
        await createNotification(db, {
          recipientType: 'admin', type: 'contract_viewed', title: 'Contract Viewed',
          message: `${(session.client_name || '').trim() || 'A client'} viewed their agreement`,
        });
      } catch {}

      return addCors(jsonResponse({
        verified: true,
        contract_html: session.contract_html,
        signer_name: session.client_name,
        signer_email: session.signer_email || session.client_email,
        business_name: env.BUSINESS_NAME || 'the service provider',
        business_email: env.BUSINESS_EMAIL || '',
      }));
    }

    // POST resend-otp
    if (method === 'POST' && path === 'resend-otp') {
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { session_id } = body || {};
      if (!session_id) return addCors(errorResponse('session_id is required', 400));

      const rl = await checkRateLimit(db, `resend:${session_id}`, 3, 60);
      if (!rl.allowed) return addCors(errorResponse('Maximum resends reached. Please request a new signing link.', 429, { 'Retry-After': '60' }));

      const session = await db.prepare(
        `SELECT ss.*, c.name as client_name, c.email as client_email, ci.signer_email, ci.status as contract_status
         FROM signing_sessions ss JOIN clients c ON c.id = ss.client_id JOIN contract_instances ci ON ci.id = ss.contract_id
         WHERE ss.id = ? AND ss.expires_at > datetime('now') AND ss.otp_verified = 0`
      ).bind(session_id).first();
      if (!session) return addCors(errorResponse('Invalid or expired session', 401));

      const { plain: otpPlain, hash: otpHash } = await generateOTP();
      await db.prepare(
        'UPDATE signing_sessions SET otp_hash = ?, otp_sent_at = datetime(\'now\'), otp_attempts = 0 WHERE id = ?'
      ).bind(otpHash, session_id).run();

      const signerEmail = session.signer_email || session.client_email;
      const businessName = env.BUSINESS_NAME || 'your service provider';
      await sendEmail(env, {
        to: signerEmail,
        subject: `${businessName} — Your New Verification Code: ${otpPlain}`,
        html: `<p>Hi ${escapeHtml(session.client_name || 'there')},</p><p>Here is your new verification code:</p><div style="text-align:center;padding:20px;background:#f8f8f8;border:1px solid #eee;margin:16px 0;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;">${otpPlain}</span></div><p style="font-size:12px;color:#999;">Any previous codes are no longer valid.</p>`,
        text: `Your new verification code is: ${otpPlain}`,
      });

      await recordEvent(db, { contractId: session.contract_id, eventType: 'otp_sent', data: { session_id: session.id, resend: true, email_hint: maskEmail(signerEmail) }, actor: 'system', ip: clientIP, userAgent });
      return addCors(jsonResponse({ success: true, email_hint: maskEmail(signerEmail) }));
    }

    // POST submit — submit signature
    if (method === 'POST' && path === 'submit') {
      let body; try { body = await request.json(); } catch { return addCors(errorResponse('Invalid JSON', 400)); }
      const { session_id, signature_data, signature_type, signer_name, consent_accepted } = body || {};
      if (!session_id || !signature_data || !signature_type || !signer_name) return addCors(errorResponse('session_id, signature_data, signature_type, and signer_name are required', 400));
      if (!consent_accepted) return addCors(errorResponse('ESIGN consent is required', 400));

      const session = await db.prepare(
        `SELECT ss.*, ci.contract_html, ci.contract_hash, ci.status as contract_status,
                ci.signer_email, c.name as client_name, c.email as client_email
         FROM signing_sessions ss
         JOIN contract_instances ci ON ci.id = ss.contract_id
         JOIN clients c ON c.id = ss.client_id
         WHERE ss.id = ? AND ss.otp_verified = 1 AND ss.is_used = 0 AND ss.expires_at > datetime('now')`
      ).bind(session_id).first();
      if (!session) return addCors(errorResponse('Invalid or expired signing session', 401));
      if (session.contract_status !== 'viewed') return addCors(errorResponse('Contract cannot be signed in current status', 400));

      // Document integrity check
      const currentHash = await hashContractHTML(session.contract_html);
      const hashMatch = currentHash === session.contract_hash;
      await recordEvent(db, { contractId: session.contract_id, eventType: 'document_integrity_verified', data: { original_hash: session.contract_hash, current_hash: currentHash, match: hashMatch }, actor: 'system', ip: clientIP, userAgent });
      if (!hashMatch) return addCors(errorResponse('Document integrity check failed. The contract may have been modified.', 409));

      // ESIGN consent
      const businessName = env.BUSINESS_NAME || 'your service provider';
      const businessEmail = env.BUSINESS_EMAIL || '';
      const consentText = `I agree to use electronic signatures and records for this transaction. I understand that I may withdraw this consent at any time by contacting ${businessName}${businessEmail ? ' at ' + businessEmail : ''}.`;
      const consentTextHash = await sha256(consentText);
      await recordEvent(db, { contractId: session.contract_id, eventType: 'consent_given', data: { consent_text_hash: consentTextHash }, actor: 'client', ip: clientIP, userAgent });
      await recordEvent(db, { contractId: session.contract_id, eventType: 'signature_captured', data: { signature_type }, actor: 'client', ip: clientIP, userAgent });

      const signedAt = new Date().toISOString();
      const signerEmail = session.signer_email || session.client_email;

      await db.prepare(
        `UPDATE contract_instances SET
           signer_name = ?, signer_email = ?, signer_ip = ?, signer_user_agent = ?,
           signature_data = ?, signature_type = ?,
           consent_accepted = 1, consent_accepted_at = datetime('now'), consent_text_hash = ?,
           signed_at = datetime('now'), status = 'signed', updated_at = datetime('now')
         WHERE id = ?`
      ).bind(signer_name, signerEmail, clientIP, userAgent, signature_data, signature_type, consentTextHash, session.contract_id).run();

      await db.prepare('UPDATE signing_sessions SET is_used = 1 WHERE id = ?').bind(session_id).run();
      await recordEvent(db, { contractId: session.contract_id, eventType: 'contract_signed', data: { signer_name, signer_ip: clientIP, contract_hash: session.contract_hash, signature_type, signed_at: signedAt }, actor: 'client', ip: clientIP, userAgent });

      try {
        await createNotification(db, {
          recipientType: 'admin', type: 'contract_signed', title: 'Contract Signed',
          message: `${(signer_name || session.client_name || '').trim() || 'A client'} signed their agreement`,
        });
      } catch {}

      return addCors(jsonResponse({ success: true, signed_at: signedAt }));
    }

    return addCors(errorResponse('Not found', 404));
  } catch (error) {
    console.error('[Sign] Error:', error);
    return addCors(errorResponse('Internal server error', 500));
  }
}
