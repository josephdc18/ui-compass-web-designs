/**
 * Push Notification API Endpoints
 *
 * Cloudflare Pages Functions - handles all /api/push/* routes
 *
 * Endpoints:
 *   GET  /api/push/vapid-public-key  - Get VAPID public key for subscription
 *   POST /api/push/subscribe         - Subscribe to push notifications
 *   POST /api/push/unsubscribe       - Unsubscribe from push notifications
 *   POST /api/push/test              - Send a test notification
 *   GET  /api/push/status            - Check subscription status
 */

import {
    saveSubscription,
    removeSubscription,
    sendPushToSubscription,
} from '../../scheduler/lib/push.js';

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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin',
    };
}

function jsonResponse(data, status = 200, request, env) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(request, env),
        },
    });
}

export async function onRequest(context) {
    const { request, env, params } = context;
    const path = params.path?.join('/') || '';
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return new Response(null, {
            headers: getCorsHeaders(request, env),
        });
    }

    try {
        switch (path) {
            case 'vapid-public-key':
                return handleGetVapidKey(request, env);

            case 'subscribe':
                if (method !== 'POST') {
                    return jsonResponse({ error: 'Method not allowed' }, 405, request, env);
                }
                return handleSubscribe(request, env);

            case 'unsubscribe':
                if (method !== 'POST') {
                    return jsonResponse({ error: 'Method not allowed' }, 405, request, env);
                }
                return handleUnsubscribe(request, env);

            case 'test':
                if (method !== 'POST') {
                    return jsonResponse({ error: 'Method not allowed' }, 405, request, env);
                }
                return handleTest(request, env);

            case 'status':
                return handleStatus(request, env);

            default:
                return jsonResponse(
                    {
                        error: 'Not found',
                        endpoints: [
                            'GET /api/push/vapid-public-key',
                            'POST /api/push/subscribe',
                            'POST /api/push/unsubscribe',
                            'POST /api/push/test',
                            'GET /api/push/status',
                        ],
                    },
                    404,
                    request,
                    env
                );
        }
    } catch (error) {
        console.error('[Push API] Error:', error);
        return jsonResponse({ error: error.message }, 500, request, env);
    }
}

async function handleGetVapidKey(request, env) {
    if (!env.VAPID_PUBLIC_KEY) {
        return jsonResponse(
            {
                error: 'Push notifications not configured',
                setup: 'Run: npx web-push generate-vapid-keys && wrangler secret put VAPID_PUBLIC_KEY',
            },
            503,
            request,
            env
        );
    }

    return jsonResponse({ key: env.VAPID_PUBLIC_KEY }, 200, request, env);
}

async function handleSubscribe(request, env) {
    const body = await request.json();

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
        return jsonResponse(
            {
                error: 'Invalid subscription format',
                required: ['endpoint', 'keys.p256dh', 'keys.auth'],
            },
            400,
            request,
            env
        );
    }

    const userAgent = request.headers.get('User-Agent');
    const userId = body.userId || null;

    const result = await saveSubscription(env.DB, body, userId, userAgent);

    return jsonResponse(
        {
            success: true,
            id: result.id,
            created: result.created,
            updated: result.updated,
        },
        result.created ? 201 : 200,
        request,
        env
    );
}

async function handleUnsubscribe(request, env) {
    const body = await request.json();

    if (!body.endpoint) {
        return jsonResponse({ error: 'Endpoint required' }, 400, request, env);
    }

    const removed = await removeSubscription(env.DB, body.endpoint);

    return jsonResponse({ success: true, removed }, 200, request, env);
}

async function handleTest(request, env) {
    // Require PUSH_ADMIN_KEY secret to prevent abuse
    const authHeader = request.headers.get('Authorization');
    if (!env.PUSH_ADMIN_KEY || authHeader !== 'Bearer ' + env.PUSH_ADMIN_KEY) {
        return jsonResponse(
            { error: 'Unauthorized', setup: 'Set PUSH_ADMIN_KEY secret via wrangler secret put PUSH_ADMIN_KEY' },
            401,
            request,
            env
        );
    }

    const body = await request.json();

    const testPayload = {
        title: 'Test Notification',
        body: 'Push notifications are working! ' + new Date().toLocaleTimeString(),
        icon: '/assets/favicons/android-chrome-192x192.png',
        badge: '/assets/favicons/favicon-32x32.png',
        tag: 'test-' + Date.now(),
        url: '/',
        data: { type: 'test' },
    };

    // Send to specific subscription by endpoint
    if (body.endpoint) {
        const sub = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?')
            .bind(body.endpoint)
            .first();

        if (!sub) {
            return jsonResponse({ error: 'Subscription not found' }, 404, request, env);
        }

        const result = await sendPushToSubscription(env, sub, testPayload);

        return jsonResponse(
            { success: result.ok, status: result.status, error: result.error },
            result.ok ? 200 : 500,
            request,
            env
        );
    }

    // Default: send to most recent subscription only
    const firstSub = await env.DB.prepare(
        'SELECT * FROM push_subscriptions ORDER BY created_at DESC LIMIT 1'
    ).first();

    if (!firstSub) {
        return jsonResponse(
            { error: 'No subscriptions found', hint: 'Subscribe first by clicking the notification button' },
            404,
            request,
            env
        );
    }

    const result = await sendPushToSubscription(env, firstSub, testPayload);

    return jsonResponse(
        {
            success: result.ok,
            status: result.status,
            sentTo: firstSub.endpoint.substring(0, 50) + '...',
            error: result.error,
        },
        result.ok ? 200 : 500,
        request,
        env
    );
}

async function handleStatus(request, env) {
    const configured = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

    let subscriptionCount = 0;
    try {
        const result = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM push_subscriptions'
        ).first();
        subscriptionCount = result?.count || 0;
    } catch (e) {
        // Table might not exist yet
    }

    return jsonResponse(
        {
            configured,
            hasVapidPublic: !!env.VAPID_PUBLIC_KEY,
            hasVapidPrivate: !!env.VAPID_PRIVATE_KEY,
            hasVapidSubject: !!env.VAPID_SUBJECT,
            subscriptionCount,
            setup: configured
                ? null
                : {
                      step1: 'npx web-push generate-vapid-keys',
                      step2: 'wrangler secret put VAPID_PUBLIC_KEY',
                      step3: 'wrangler secret put VAPID_PRIVATE_KEY',
                      step4: 'wrangler secret put VAPID_SUBJECT  # mailto:your@email.com',
                  },
        },
        200,
        request,
        env
    );
}
