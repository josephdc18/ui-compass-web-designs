/**
 * Email Sending Utility
 *
 * Supports: Resend (recommended), Mailgun, and generic webhook.
 *
 * Configuration (set via wrangler secret):
 *   EMAIL_PROVIDER: "resend" | "mailgun" | "webhook"
 *   EMAIL_API_KEY: Your provider's API key
 *   EMAIL_FROM: Default sender address
 *   NOTIFICATION_EMAIL: Where to send form notifications
 */

export async function sendEmail(env, options) {
    const provider = env.EMAIL_PROVIDER || 'resend';
    const from = options.from || env.EMAIL_FROM || 'noreply@example.com';

    const emailData = {
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        reply_to: options.replyTo,
        // Optional: array of { filename, content } where content is base64.
        // Currently only Resend supports this; other providers throw if present.
        attachments: options.attachments,
    };

    try {
        switch (provider) {
            case 'resend':
                return await sendViaResend(env, emailData);
            case 'mailgun':
                return await sendViaMailgun(env, emailData);
            case 'webhook':
                return await sendViaWebhook(env, emailData);
            default:
                console.log('[Email] Would send email:', emailData);
                return { success: true, id: 'dev-' + Date.now() };
        }
    } catch (error) {
        console.error('[Email] Failed to send:', error);
        return { success: false, error: error.message };
    }
}

async function sendViaResend(env, emailData) {
    if (!env.EMAIL_API_KEY) {
        throw new Error('EMAIL_API_KEY not configured for Resend');
    }

    const payload = {
        from: emailData.from,
        to: [emailData.to],
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        reply_to: emailData.reply_to,
    };

    // Resend accepts attachments as [{ filename, content (base64) }], up to 40MB total.
    if (emailData.attachments && emailData.attachments.length > 0) {
        payload.attachments = emailData.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
        }));
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${env.EMAIL_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `Resend API error: ${response.status}`);
    }

    return { success: true, id: data.id };
}

async function sendViaMailgun(env, emailData) {
    if (!env.EMAIL_API_KEY || !env.MAILGUN_DOMAIN) {
        throw new Error('EMAIL_API_KEY and MAILGUN_DOMAIN required for Mailgun');
    }

    const formData = new FormData();
    formData.append('from', emailData.from);
    formData.append('to', emailData.to);
    formData.append('subject', emailData.subject);
    formData.append('text', emailData.text);
    if (emailData.html) formData.append('html', emailData.html);
    if (emailData.reply_to) formData.append('h:Reply-To', emailData.reply_to);

    const response = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + btoa(`api:${env.EMAIL_API_KEY}`),
        },
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `Mailgun API error: ${response.status}`);
    }

    return { success: true, id: data.id };
}

async function sendViaWebhook(env, emailData) {
    if (!env.EMAIL_WEBHOOK_URL) {
        throw new Error('EMAIL_WEBHOOK_URL not configured');
    }

    const response = await fetch(env.EMAIL_WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: env.EMAIL_WEBHOOK_SECRET ? `Bearer ${env.EMAIL_WEBHOOK_SECRET}` : '',
        },
        body: JSON.stringify(emailData),
    });

    if (!response.ok) {
        throw new Error(`Webhook error: ${response.status}`);
    }

    return { success: true, id: 'webhook-' + Date.now() };
}

export function formatFormSubmissionEmail(formName, data, submissionId, siteUrl) {
    const fields = Object.entries(data)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

    const text = `
New form submission from ${formName}

${fields}

---
Submission ID: ${submissionId}
Site: ${siteUrl || 'Not configured'}
Time: ${new Date().toISOString()}
`.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #2563eb; font-size: 24px; margin-bottom: 20px; }
        .field { margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 6px; }
        .field-label { font-weight: 600; color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
        .field-value { color: #1e293b; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>New ${formName} submission</h1>
        ${Object.entries(data)
            .map(
                ([key, value]) => `
            <div class="field">
                <div class="field-label">${escapeHtml(key)}</div>
                <div class="field-value">${escapeHtml(String(value)).replace(/\n/g, '<br>')}</div>
            </div>
        `
            )
            .join('')}
        <div class="footer">
            <p>Submission ID: ${submissionId}</p>
            <p>Received: ${new Date().toLocaleString()}</p>
            ${siteUrl ? `<p>Site: ${siteUrl}</p>` : ''}
        </div>
    </div>
</body>
</html>
`.trim();

    return { text, html };
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
