/**
 * Web Push Notification Library
 *
 * Full VAPID + RFC 8291 encrypted payload implementation for Cloudflare Workers.
 * Supports iOS PWA, Android, and desktop browsers.
 *
 * SETUP:
 *   1. Generate VAPID keys: npx web-push generate-vapid-keys
 *   2. Set secrets:
 *      wrangler secret put VAPID_PUBLIC_KEY
 *      wrangler secret put VAPID_PRIVATE_KEY
 *      wrangler secret put VAPID_SUBJECT  # mailto:your@email.com
 */

import { importJWK, SignJWT } from 'jose';

// ============================================================================
// Base64 URL Helpers
// ============================================================================

function b64urlToBytes(b64url) {
    let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
}

function bytesToB64url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...arrays) {
    const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

// ============================================================================
// VAPID JWT Generation
// ============================================================================

function deriveJwkFromVapid(pubB64, privB64) {
    const pub = b64urlToBytes(pubB64);
    if (pub.length !== 65 || pub[0] !== 0x04) {
        throw new Error('Invalid VAPID public key format');
    }
    const x = pub.slice(1, 33);
    const y = pub.slice(33, 65);
    const jwk = {
        kty: 'EC',
        crv: 'P-256',
        x: bytesToB64url(x),
        y: bytesToB64url(y),
    };
    if (privB64) {
        const d = b64urlToBytes(privB64);
        if (d.length !== 32) throw new Error('Invalid VAPID private key');
        jwk.d = bytesToB64url(d);
    }
    return jwk;
}

async function mintVapidJWT(env, audience) {
    const sub = env.VAPID_SUBJECT || 'mailto:webmaster@example.com';

    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
        throw new Error('VAPID keys not configured. Run: wrangler secret put VAPID_PUBLIC_KEY');
    }

    const jwk = deriveJwkFromVapid(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    const key = await importJWK(jwk, 'ES256');
    const now = Math.floor(Date.now() / 1000);

    return new SignJWT({
        aud: audience,
        sub,
        exp: now + 12 * 60 * 60,
    })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
        .sign(key);
}

// ============================================================================
// RFC 8291 Payload Encryption
// ============================================================================

async function encryptPayload(payload, subscription) {
    const userPublicKey = b64urlToBytes(subscription.p256dh);
    const userAuth = b64urlToBytes(subscription.auth);
    const plaintext = new TextEncoder().encode(
        typeof payload === 'string' ? payload : JSON.stringify(payload)
    );

    const serverKeys = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );

    const serverPublicKey = new Uint8Array(
        await crypto.subtle.exportKey('raw', serverKeys.publicKey)
    );

    const userKey = await crypto.subtle.importKey(
        'raw',
        userPublicKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    );

    const sharedSecret = new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: 'ECDH', public: userKey },
            serverKeys.privateKey,
            256
        )
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();
    const authInfo = concat(encoder.encode('WebPush: info\0'), userPublicKey, serverPublicKey);

    const authHmacKey = await crypto.subtle.importKey(
        'raw',
        userAuth,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const ikm = new Uint8Array(await crypto.subtle.sign('HMAC', authHmacKey, sharedSecret));

    async function hkdfExpand(ikm, info, length) {
        const key = await crypto.subtle.importKey(
            'raw',
            ikm,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const input = concat(info, new Uint8Array([1]));
        const output = new Uint8Array(await crypto.subtle.sign('HMAC', key, input));
        return output.slice(0, length);
    }

    const derivedIkm = await hkdfExpand(ikm, authInfo, 32);

    const saltKey = await crypto.subtle.importKey(
        'raw',
        salt,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const prk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, derivedIkm));

    const cek = await hkdfExpand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdfExpand(prk, encoder.encode('Content-Encoding: nonce\0'), 12);

    const paddedPlaintext = concat(plaintext, new Uint8Array([2]));

    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, [
        'encrypt',
    ]);

    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedPlaintext)
    );

    const recordSize = new Uint8Array(4);
    new DataView(recordSize.buffer).setUint32(0, 4096, false);

    return concat(
        salt,
        recordSize,
        new Uint8Array([65]),
        serverPublicKey,
        ciphertext
    );
}

// ============================================================================
// Send Encrypted Push
// ============================================================================

async function sendEncryptedPush(env, subscription, payloadObj) {
    const url = new URL(subscription.endpoint);
    const jwt = await mintVapidJWT(env, url.origin);
    const encryptedBody = await encryptPayload(payloadObj, subscription);

    const headers = new Headers();
    headers.set('Authorization', 'WebPush ' + jwt);
    headers.set('Crypto-Key', 'p256ecdsa=' + env.VAPID_PUBLIC_KEY);
    headers.set('Content-Encoding', 'aes128gcm');
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('TTL', String(payloadObj.ttl || 3600));
    headers.set('Urgency', 'normal');

    console.log('[Push] Sending to:', subscription.endpoint.substring(0, 60) + '...');

    const res = await fetch(subscription.endpoint, {
        method: 'POST',
        headers,
        body: encryptedBody,
    });

    console.log('[Push] Response status:', res.status);

    if (res.status === 200 || res.status === 201 || res.status === 202) {
        return { ok: true, status: res.status };
    }

    if (res.status === 404 || res.status === 410) {
        console.log('[Push] Subscription expired, marking for removal');
        return { ok: false, prune: true, status: res.status };
    }

    if (res.status === 400 || res.status === 403) {
        const txt = await res.text().catch(() => '');
        console.log('[Push] Error response:', res.status, txt.substring(0, 200));
        if (/expired|invalid/i.test(txt)) {
            return { ok: false, prune: true, status: res.status, error: txt };
        }
        throw new Error('Push failed: ' + res.status + ' - ' + txt.substring(0, 100));
    }

    const errorText = await res.text().catch(() => '');
    console.error('[Push] Unexpected status:', res.status, errorText.substring(0, 200));
    throw new Error('Push failed: ' + res.status + ' - ' + errorText.substring(0, 100));
}

// ============================================================================
// Public API Functions
// ============================================================================

export async function sendPushToSubscription(env, subscription, payloadObj) {
    if (!subscription?.endpoint || !subscription?.p256dh || !subscription?.auth) {
        return { ok: false, error: 'invalid_subscription' };
    }

    try {
        const result = await sendEncryptedPush(env, subscription, payloadObj);

        if (result.ok) {
            await env.DB.prepare(
                "UPDATE push_subscriptions SET last_used_at = datetime('now') WHERE endpoint = ?"
            )
                .bind(subscription.endpoint)
                .run();
        }

        if (result.prune) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
                .bind(subscription.endpoint)
                .run();
            console.log('[Push] Pruned expired subscription');
        }

        return result;
    } catch (error) {
        console.error('[Push] Send error:', error.message);
        return { ok: false, error: error.message };
    }
}

export async function sendPushToUser(env, userId, payloadObj) {
    const subs = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
        .bind(userId)
        .all();

    if (!subs.results?.length) {
        return { skipped: true, reason: 'no_subscriptions' };
    }

    let sent = 0, pruned = 0, failed = 0;

    for (const sub of subs.results) {
        try {
            const result = await sendPushToSubscription(env, sub, payloadObj);
            if (result.ok) sent++;
            else if (result.prune) pruned++;
            else failed++;
        } catch (e) {
            console.error('[Push] Send failed:', e.message);
            failed++;
        }
    }

    return { sent, pruned, failed };
}

export async function broadcastPush(env, payloadObj, limit = 500) {
    const subs = await env.DB.prepare('SELECT * FROM push_subscriptions LIMIT ?').bind(limit).all();

    if (!subs.results?.length) {
        return { sent: 0, pruned: 0, failed: 0, reason: 'no_subscriptions' };
    }

    let sent = 0, pruned = 0, failed = 0;

    for (const sub of subs.results) {
        try {
            const result = await sendPushToSubscription(env, sub, payloadObj);
            if (result.ok) sent++;
            else if (result.prune) pruned++;
            else failed++;
        } catch (e) {
            failed++;
        }
    }

    console.log('[Push] Broadcast complete: sent=' + sent + ', pruned=' + pruned + ', failed=' + failed);
    return { sent, pruned, failed };
}

export async function sendSchedulerNotification(env, options) {
    const { title, body, type = 'info', url = '/' } = options;

    return broadcastPush(env, {
        title,
        body,
        icon: '/assets/favicons/android-chrome-192x192.png',
        badge: '/assets/favicons/favicon-32x32.png',
        tag: 'scheduler-' + type + '-' + Date.now(),
        url,
        data: { type: 'scheduler', alertType: type },
    });
}

export async function saveSubscription(db, subscription, userId = null, userAgent = null) {
    const id = crypto.randomUUID();

    const existing = await db
        .prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?')
        .bind(subscription.endpoint)
        .first();

    if (existing) {
        await db
            .prepare(
                'UPDATE push_subscriptions SET p256dh = ?, auth = ?, user_id = COALESCE(?, user_id), user_agent = COALESCE(?, user_agent), updated_at = datetime(\'now\') WHERE endpoint = ?'
            )
            .bind(
                subscription.keys?.p256dh || subscription.p256dh,
                subscription.keys?.auth || subscription.auth,
                userId,
                userAgent,
                subscription.endpoint
            )
            .run();

        return { id: existing.id, updated: true };
    }

    await db
        .prepare(
            'INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, user_id, user_agent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))'
        )
        .bind(
            id,
            subscription.endpoint,
            subscription.keys?.p256dh || subscription.p256dh,
            subscription.keys?.auth || subscription.auth,
            userId,
            userAgent
        )
        .run();

    return { id, created: true };
}

export async function removeSubscription(db, endpoint) {
    const result = await db
        .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
        .bind(endpoint)
        .run();

    return result.meta.changes > 0;
}
