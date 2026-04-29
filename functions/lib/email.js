/**
 * Email — Resend API wrapper for transactional emails.
 */

/**
 * Send an email via Resend API.
 * @param {object} env — Worker env (needs RESEND_API_KEY, SITE_URL)
 * @param {{ to: string, subject: string, html: string, text?: string }} options
 * @returns {{ success: boolean, error?: string }}
 */
export async function sendEmail(env, { to, subject, html, text }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Email] RESEND_API_KEY not configured');
    return { success: false, error: 'Email not configured' };
  }

  const domain = (env.SITE_URL || 'https://example.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const from = env.EMAIL_FROM || 'noreply@' + domain;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text: text || '' }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[Email] Resend error:', res.status, body);
      return { success: false, error: 'Resend API ' + res.status };
    }

    return { success: true };
  } catch (error) {
    console.error('[Email] Send failed:', error);
    return { success: false, error: error.message };
  }
}
