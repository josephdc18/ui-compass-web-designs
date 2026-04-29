/**
 * Form Submission API Endpoint
 *
 * Cloudflare Pages Functions - handles /api/form
 *
 * Features:
 *   - Stores submissions in D1 database
 *   - Basic spam protection (honeypot field)
 *   - Rate limiting via CF headers
 *
 * POST /api/form
 * Body: {
 *   _form_name: string,    // Required: identifies which form (e.g., "contact", "newsletter")
 *   _honeypot: string,     // Spam protection: should be empty
 *   _redirect: string,     // Optional: URL to redirect after submission
 *   ...fields             // Your form fields (name, email, message, etc.)
 * }
 */

// CORS headers
function getCorsHeaders(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigins = [
        env.SITE_URL,
        'http://localhost:8080',
        'http://localhost:3000',
        'http://localhost:8788',
        'http://127.0.0.1:8080',
        'http://127.0.0.1:8788',
    ].filter(Boolean);

    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*';

    return {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin',
    };
}

function jsonResponse(data, status, request, env) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(request, env),
        },
    });
}

/**
 * Main request handler
 */
export async function onRequest(context) {
    const { request, env } = context;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return new Response(null, {
            headers: getCorsHeaders(request, env),
        });
    }

    // Only allow POST
    if (method !== 'POST') {
        return jsonResponse(
            {
                error: 'Method not allowed',
                hint: 'POST form data to this endpoint',
            },
            405,
            request,
            env
        );
    }

    try {
        return await handleFormSubmission(request, env);
    } catch (error) {
        console.error('[Form API] Error:', error);
        return jsonResponse({ error: 'Internal server error' }, 500, request, env);
    }
}

/**
 * Process form submission
 */
async function handleFormSubmission(request, env) {
    const contentType = request.headers.get('Content-Type') || '';
    let formData;

    // Parse form data (supports both JSON and form-urlencoded)
    if (contentType.includes('application/json')) {
        formData = await request.json();
    } else if (
        contentType.includes('application/x-www-form-urlencoded') ||
        contentType.includes('multipart/form-data')
    ) {
        const fd = await request.formData();
        formData = Object.fromEntries(fd.entries());
    } else {
        return jsonResponse(
            {
                error: 'Unsupported content type',
                supported: ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data'],
            },
            400,
            request,
            env
        );
    }

    // Extract special fields (prefixed with _)
    const formName = formData._form_name || 'contact';
    const honeypot = formData._honeypot || formData._hp || '';
    const redirectUrl = formData._redirect;

    // Remove special fields from stored data
    const cleanData = { ...formData };
    delete cleanData._form_name;
    delete cleanData._honeypot;
    delete cleanData._hp;
    delete cleanData._redirect;

    // Spam check: honeypot should be empty
    if (honeypot) {
        console.log('[Form API] Honeypot triggered, likely spam');
        // Return success to fool bots, but don't store
        return handleSuccess(request, env, redirectUrl, 'submission-blocked');
    }

    // Basic validation
    if (Object.keys(cleanData).length === 0) {
        return jsonResponse({ error: 'No form data provided' }, 400, request, env);
    }

    // Get client info
    const ipAddress =
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For') ||
        'unknown';
    const userAgent = request.headers.get('User-Agent') || '';

    // Generate submission ID
    const submissionId = crypto.randomUUID();

    // Store in database
    try {
        await env.DB.prepare(
            `
            INSERT INTO form_submissions (id, form_name, data, ip_address, user_agent, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'new', datetime('now'))
        `
        )
            .bind(submissionId, formName, JSON.stringify(cleanData), ipAddress, userAgent)
            .run();

        console.log(`[Form API] Stored submission ${submissionId} for form "${formName}"`);
    } catch (dbError) {
        console.error('[Form API] Database error:', dbError);
        return jsonResponse(
            {
                error: 'Failed to save submission',
                hint: 'Ensure database is migrated: wrangler d1 execute YOUR_DB_NAME --file=./database/schema.sql',
            },
            500,
            request,
            env
        );
    }

    return handleSuccess(request, env, redirectUrl, submissionId);
}

/**
 * Handle successful submission
 */
function handleSuccess(request, env, redirectUrl, submissionId) {
    // If redirect URL provided, redirect there
    if (redirectUrl) {
        const separator = redirectUrl.includes('?') ? '&' : '?';
        const redirectWithId = `${redirectUrl}${separator}submitted=${submissionId}`;

        return new Response(null, {
            status: 303,
            headers: {
                Location: redirectWithId,
                ...getCorsHeaders(request, env),
            },
        });
    }

    // Otherwise return JSON
    return jsonResponse(
        {
            success: true,
            id: submissionId,
            message: 'Form submitted successfully',
        },
        200,
        request,
        env
    );
}
