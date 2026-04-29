/**
 * Notifications — D1 insert with optional throttle.
 * Push dispatch is delegated to pushNotifications pack if enabled.
 */

export async function createNotification(db, {
  recipientType,
  recipientId = null,
  type,
  title,
  message,
  actionUrl = null,
}) {
  if (!recipientType || !type || !title || !message) {
    console.error('[Notifications] Missing required fields:', { recipientType, type, title });
    return null;
  }
  try {
    const result = await db.prepare(
      `INSERT INTO portal_notifications (recipient_type, recipient_id, type, title, message, action_url)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(recipientType, recipientId, type, title, message, actionUrl).run();
    return result?.meta?.last_row_id || true;
  } catch (error) {
    console.error('[Notifications] Insert error:', error);
    return null;
  }
}

export async function createNotificationThrottled(db, options, { windowMinutes = 60 } = {}) {
  try {
    const existing = await db.prepare(
      `SELECT 1 FROM portal_notifications
       WHERE recipient_type = ? AND recipient_id IS ? AND type = ?
         AND created_at > datetime('now', '-' || ? || ' minutes')
       LIMIT 1`
    ).bind(
      options.recipientType, options.recipientId || null,
      options.type, windowMinutes
    ).first();
    if (existing) return null;
    return createNotification(db, options);
  } catch (error) {
    console.error('[Notifications] Throttle check error:', error);
    return null;
  }
}
