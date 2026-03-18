// server/utils/webPushService.js
// Wraps the web-push library. Call sendPush() anywhere on the server.

import webpush from "web-push";

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_EMAIL || "mailto:admin@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log("✅ Web Push (VAPID) configured");
} else {
  console.warn("⚠️  VAPID keys missing — web push notifications disabled");
}

export const VAPID_PUB = VAPID_PUBLIC_KEY || null;

/**
 * Send a push notification to one subscription object.
 * subscription = { endpoint, keys: { p256dh, auth } }
 * payload      = { title, body, icon?, badge?, data? }
 */
export async function sendPush(subscription, payload) {
  if (!VAPID_PUBLIC_KEY || !subscription?.endpoint) return;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err) {
    // 410 = subscription expired/unsubscribed — caller should remove it
    if (err.statusCode === 410 || err.statusCode === 404) {
      throw Object.assign(err, { stale: true });
    }
    console.error("Web push send error:", err.message);
  }
}

/**
 * Send to multiple subscriptions (array), silently drops stale ones via callback.
 */
export async function sendPushToMany(subscriptions, payload, onStale) {
  await Promise.allSettled(
    subscriptions.map(async sub => {
      try {
        await sendPush(sub, payload);
      } catch (err) {
        if (err.stale && onStale) onStale(sub);
      }
    })
  );
}
