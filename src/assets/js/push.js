/**
 * Push Notification Client Module
 *
 * Handles browser push subscription, service worker registration,
 * and iOS PWA detection.
 *
 * Usage:
 *   import { initPush, subscribeToPush, unsubscribeFromPush } from './push.js';
 *
 *   // Initialize on page load
 *   await initPush();
 *
 *   // Subscribe when user clicks notification button
 *   const result = await subscribeToPush();
 */

// ============================================================================
// State
// ============================================================================

let swRegistration = null;
let isSubscribed = false;
let vapidPublicKey = null;

// ============================================================================
// iOS / PWA Detection
// ============================================================================

export function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export function isStandalonePWA() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
}

export function isPushSupported() {
    return 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
}

// ============================================================================
// Initialization
// ============================================================================

export async function initPush() {
    if (!isPushSupported()) {
        console.log('[Push] Push notifications not supported');
        return { supported: false };
    }

    try {
        swRegistration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('[Push] Service worker registered');

        await navigator.serviceWorker.ready;

        const subscription = await swRegistration.pushManager.getSubscription();
        isSubscribed = !!subscription;

        await fetchVapidKey();
        clearBadge();

        navigator.serviceWorker.addEventListener('message', handleSWMessage);

        return {
            supported: true,
            subscribed: isSubscribed,
            registration: swRegistration
        };
    } catch (error) {
        console.error('[Push] Init error:', error);
        return { supported: false, error: error.message };
    }
}

async function fetchVapidKey() {
    try {
        const response = await fetch('/api/push/vapid-public-key');
        const data = await response.json();

        if (data.key) {
            vapidPublicKey = data.key;
            return data.key;
        }
        if (data.configured === false) return null;
    } catch (error) {
        console.error('[Push] Failed to fetch VAPID key:', error);
    }
    return null;
}

// ============================================================================
// Subscription Management
// ============================================================================

export async function subscribeToPush(options = {}) {
    if (isIOS() && !isStandalonePWA()) {
        return {
            success: false,
            error: 'ios_not_pwa',
            message: 'On iOS, add this app to your Home Screen first to enable notifications.'
        };
    }

    if (!isPushSupported()) {
        return {
            success: false,
            error: 'not_supported',
            message: 'Push notifications are not supported in this browser.'
        };
    }

    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
        return {
            success: false,
            error: 'permission_denied',
            message: 'Notification permission was denied.'
        };
    }

    if (!vapidPublicKey) {
        await fetchVapidKey();
    }

    if (!vapidPublicKey) {
        return {
            success: false,
            error: 'no_vapid_key',
            message: 'Push notifications are not configured on the server.'
        };
    }

    try {
        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        const response = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...subscription.toJSON(),
                userId: options.userId
            })
        });

        const result = await response.json();

        if (result.success) {
            isSubscribed = true;
            console.log('[Push] Subscribed successfully');

            return {
                success: true,
                subscription: subscription.toJSON(),
                id: result.id
            };
        }

        return {
            success: false,
            error: 'server_error',
            message: result.error || 'Failed to save subscription'
        };
    } catch (error) {
        console.error('[Push] Subscription error:', error);
        return {
            success: false,
            error: 'subscription_failed',
            message: error.message
        };
    }
}

export async function unsubscribeFromPush() {
    try {
        const subscription = await swRegistration?.pushManager?.getSubscription();

        if (!subscription) {
            isSubscribed = false;
            return { success: true, wasSubscribed: false };
        }

        await subscription.unsubscribe();

        await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint })
        });

        isSubscribed = false;
        console.log('[Push] Unsubscribed successfully');

        return { success: true, wasSubscribed: true };
    } catch (error) {
        console.error('[Push] Unsubscribe error:', error);
        return { success: false, error: error.message };
    }
}

export async function checkSubscription() {
    if (!swRegistration) {
        return { subscribed: false, reason: 'not_initialized' };
    }

    try {
        const subscription = await swRegistration.pushManager.getSubscription();
        isSubscribed = !!subscription;
        return {
            subscribed: isSubscribed,
            subscription: subscription?.toJSON()
        };
    } catch (error) {
        return { subscribed: false, error: error.message };
    }
}

// ============================================================================
// Test & Debug
// ============================================================================

export async function sendTestNotification() {
    try {
        const response = await fetch('/api/push/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        return await response.json();
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function getPushStatus() {
    const supported = isPushSupported();
    const ios = isIOS();
    const standalone = isStandalonePWA();
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';

    let serverStatus = null;
    try {
        const response = await fetch('/api/push/status');
        serverStatus = await response.json();
    } catch (e) {
        serverStatus = { error: e.message };
    }

    return {
        supported,
        isIOS: ios,
        isStandalonePWA: standalone,
        canSubscribe: supported && (!ios || standalone),
        permission,
        subscribed: isSubscribed,
        server: serverStatus
    };
}

// ============================================================================
// Badge Management
// ============================================================================

export function clearBadge() {
    if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {});
    } else if ('setAppBadge' in navigator) {
        navigator.setAppBadge(0).catch(() => {});
    }

    if (swRegistration?.active) {
        swRegistration.active.postMessage({ type: 'CLEAR_BADGE' });
    }
}

export function setBadge(count) {
    if ('setAppBadge' in navigator) {
        if (count > 0) {
            navigator.setAppBadge(count).catch(() => {});
        } else {
            clearBadge();
        }
    }
}

// ============================================================================
// Service Worker Communication
// ============================================================================

function handleSWMessage(event) {
    const { type, data } = event.data || {};

    switch (type) {
        case 'SW_UPDATED':
            console.log('[Push] Service worker updated to:', data?.version);
            dispatchEvent(new CustomEvent('sw-updated', { detail: data }));
            break;

        case 'NOTIFICATION_CLICK':
            console.log('[Push] Notification clicked, navigating to:', data?.url);
            dispatchEvent(new CustomEvent('notification-click', { detail: data }));
            break;
    }
}

export async function checkForUpdates() {
    if (swRegistration) {
        await swRegistration.update();
        return true;
    }
    return false;
}

// ============================================================================
// Helpers
// ============================================================================

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

// ============================================================================
// UI Helper - Notification Button Component
// ============================================================================

export function createNotificationButton(container, options = {}) {
    const button = document.createElement('button');
    button.className = options.className || 'notification-btn';
    button.setAttribute('aria-label', 'Toggle notifications');

    const updateButton = (subscribed) => {
        button.innerHTML = subscribed
            ? (options.subscribedIcon || '\u{1F514}')
            : (options.unsubscribedIcon || '\u{1F515}');
        button.title = subscribed
            ? 'Notifications enabled - click to disable'
            : 'Click to enable notifications';
        button.setAttribute('data-subscribed', subscribed);
    };

    button.addEventListener('click', async () => {
        button.disabled = true;

        if (isSubscribed) {
            const result = await unsubscribeFromPush();
            if (result.success) {
                updateButton(false);
                options.onUnsubscribe?.();
            } else {
                options.onError?.(result.error);
            }
        } else {
            const result = await subscribeToPush({ userId: options.userId });
            if (result.success) {
                updateButton(true);
                options.onSubscribe?.();
            } else {
                options.onError?.(result);
            }
        }

        button.disabled = false;
    });

    checkSubscription().then(status => {
        updateButton(status.subscribed);
    });

    container.appendChild(button);

    return {
        button,
        updateButton,
        getSubscribed: () => isSubscribed
    };
}

// ============================================================================
// PWA-only footer notification toggle
// ============================================================================

/**
 * Bind the footer notification button (rendered by _includes/footer.html as
 * `[data-pwa-notify-toggle]`). The button is hidden by CSS unless body has
 * `is-pwa`, which we add here once we confirm the page is running as a
 * standalone PWA. Click toggles subscription via the existing push API.
 */
function applyPwaToggleState(button, state) {
    button.dataset.state = state;
    const label = button.querySelector('[data-pwa-notify-label]');
    const text =
        state === 'on' ? 'Notifications On' :
        state === 'off' ? 'Enable Notifications' :
        state === 'denied' ? 'Notifications Blocked' :
        state === 'unsupported' ? 'Notifications Unsupported' :
        'Loading…';
    if (label) label.textContent = text;
    button.setAttribute('aria-label', text);
    button.disabled = state === 'loading' || state === 'denied' || state === 'unsupported';
}

function bindPwaNotifyToggle() {
    const button = document.querySelector('[data-pwa-notify-toggle]');
    if (!button) return;

    if (!isStandalonePWA()) return; // CSS keeps it hidden; nothing to do.
    document.body.classList.add('is-pwa');

    if (!isPushSupported()) {
        applyPwaToggleState(button, 'unsupported');
        return;
    }

    if (Notification.permission === 'denied') {
        applyPwaToggleState(button, 'denied');
        return;
    }

    checkSubscription().then(({ subscribed }) => {
        applyPwaToggleState(button, subscribed ? 'on' : 'off');
    });

    button.addEventListener('click', async () => {
        if (button.disabled) return;
        const goingOn = button.dataset.state !== 'on';
        applyPwaToggleState(button, 'loading');
        const result = goingOn ? await subscribeToPush() : await unsubscribeFromPush();
        if (goingOn && !result.success && result.error === 'permission_denied') {
            applyPwaToggleState(button, 'denied');
            return;
        }
        if (!result.success) {
            applyPwaToggleState(button, button.dataset.state === 'loading' ? 'off' : button.dataset.state);
            return;
        }
        applyPwaToggleState(button, goingOn ? 'on' : 'off');
    });
}

// ============================================================================
// Auto-initialize when DOM is ready
// ============================================================================

if (typeof window !== 'undefined') {
    const boot = () => {
        initPush().then(() => bindPwaNotifyToggle());
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
}
