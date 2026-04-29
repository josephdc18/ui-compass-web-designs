/**
 * GitHub OAuth Proxy for Decap CMS
 *
 * This Cloudflare Pages Function handles GitHub OAuth authentication for Decap CMS.
 * It replaces the need for Netlify Identity or external OAuth providers.
 *
 * Required Environment Variables (set in Cloudflare Pages dashboard):
 * - GITHUB_CLIENT_ID: Your GitHub OAuth App Client ID
 * - GITHUB_CLIENT_SECRET: Your GitHub OAuth App Client Secret
 * - CMS_ALLOWED_USERS: Comma-separated list of allowed GitHub usernames (optional)
 *
 * Setup:
 * 1. Create GitHub OAuth App at https://github.com/settings/developers
 * 2. Set Homepage URL to your domain (https://yourdomain.com)
 * 3. Set Authorization callback URL to https://yourdomain.com/api/auth
 * 4. Add environment variables in Cloudflare Pages settings
 */

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

/**
 * Main request handler
 */
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: getCorsHeaders(request),
        });
    }

    // Check for required environment variables
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        return new Response(
            renderErrorPage(
                'Missing Configuration',
                'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.'
            ),
            { status: 500, headers: { 'Content-Type': 'text/html' } }
        );
    }

    // Get authorization code from GitHub callback
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Handle OAuth errors from GitHub
    if (error) {
        return new Response(renderErrorPage('Authorization Failed', errorDescription || error), {
            status: 400,
            headers: { 'Content-Type': 'text/html' },
        });
    }

    // If no code, initiate OAuth flow
    if (!code) {
        return initiateOAuthFlow(env, url);
    }

    // Exchange code for access token
    try {
        const tokenResponse = await exchangeCodeForToken(code, env);

        if (tokenResponse.error) {
            return new Response(
                renderErrorPage(
                    'Token Exchange Failed',
                    tokenResponse.error_description || tokenResponse.error
                ),
                { status: 400, headers: { 'Content-Type': 'text/html' } }
            );
        }

        const accessToken = tokenResponse.access_token;

        // Verify user is allowed (if allowlist is configured)
        if (env.CMS_ALLOWED_USERS) {
            const isAllowed = await verifyUserAllowed(accessToken, env);
            if (!isAllowed) {
                return new Response(
                    renderErrorPage(
                        'Access Denied',
                        'Your GitHub account is not authorized to access the CMS. Please contact the site administrator.'
                    ),
                    { status: 403, headers: { 'Content-Type': 'text/html' } }
                );
            }
        }

        // Return success page that sends token to Decap CMS via postMessage
        return new Response(renderSuccessPage(accessToken), {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
        });
    } catch (err) {
        console.error('OAuth error:', err);
        return new Response(renderErrorPage('Authentication Error', err.message), {
            status: 500,
            headers: { 'Content-Type': 'text/html' },
        });
    }
}

/**
 * Redirect user to GitHub OAuth authorization page
 */
function initiateOAuthFlow(env, url) {
    const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${url.origin}/api/auth`,
        scope: 'repo,user',
        state: generateState(),
    });

    return Response.redirect(`${GITHUB_OAUTH_URL}?${params.toString()}`, 302);
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code, env) {
    const response = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Decap-CMS-OAuth-Proxy',
        },
        body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code: code,
        }),
    });

    return response.json();
}

/**
 * Verify user is in the allowed users list
 */
async function verifyUserAllowed(accessToken, env) {
    const response = await fetch(GITHUB_USER_URL, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Decap-CMS-OAuth-Proxy',
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user info from GitHub');
    }

    const user = await response.json();
    const allowedUsers = env.CMS_ALLOWED_USERS.split(',').map((u) => u.trim().toLowerCase());

    return allowedUsers.includes(user.login.toLowerCase());
}

/**
 * Generate random state for CSRF protection
 */
function generateState() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get CORS headers
 */
function getCorsHeaders(request) {
    const origin = request.headers.get('Origin') || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
}

/**
 * Render success page that sends token to Decap CMS
 */
function renderSuccessPage(token) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Authentication Successful</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 2rem 3rem;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
        }
        .success-icon {
            width: 60px;
            height: 60px;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1rem;
        }
        .success-icon svg {
            width: 30px;
            height: 30px;
            stroke: white;
            stroke-width: 3;
            fill: none;
        }
        h1 { color: #1f2937; margin: 0 0 0.5rem; font-size: 1.5rem; }
        p { color: #6b7280; margin: 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h1>Success!</h1>
        <p>Authenticating with CMS...</p>
    </div>
    <script>
        (function() {
            // Send authentication data to Decap CMS via postMessage
            const token = ${JSON.stringify(token)};
            const provider = 'github';

            // Message format expected by Decap CMS
            const message = 'authorization:' + provider + ':success:' + JSON.stringify({ token, provider });

            // Send to opener (the CMS window)
            if (window.opener) {
                window.opener.postMessage(message, '*');
                setTimeout(function() { window.close(); }, 1000);
            } else {
                // Fallback for popup blockers
                document.querySelector('p').textContent = 'Please close this window and return to the CMS.';
            }
        })();
    </script>
</body>
</html>`;
}

/**
 * Render error page
 */
function renderErrorPage(title, message) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 2rem 3rem;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
        }
        .error-icon {
            width: 60px;
            height: 60px;
            background: #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1rem;
        }
        .error-icon svg {
            width: 30px;
            height: 30px;
            stroke: white;
            stroke-width: 3;
            fill: none;
        }
        h1 { color: #1f2937; margin: 0 0 0.5rem; font-size: 1.5rem; }
        p { color: #6b7280; margin: 0; }
        .back-link {
            display: inline-block;
            margin-top: 1.5rem;
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        .back-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="/admin/" class="back-link">&#x2190; Back to CMS</a>
    </div>
</body>
</html>`;
}
