// server/utils/webPushService.js
// Wraps the web-push library. Call sendPush() anywhere on the server.

import webpush from "web-push";
import logger from "./logger.js";
import { getUserModelForRole } from "./roleModels.js";

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_EMAIL || "mailto:speak2clem@gmail.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  logger.info("✅ Web Push (VAPID) configured");
} else {
  logger.warn("⚠️  VAPID keys missing — web push notifications disabled");
}

export const VAPID_PUB = VAPID_PUBLIC_KEY || null;

// ── Push service allow-list ──────────────────────────────────────────────────
// The browser hands us the endpoint URL and the server then POSTs to it, so an
// unchecked endpoint lets anyone make the server send requests to any HTTPS
// host — including internal ones (blind SSRF). Only real browser push services
// are accepted: Chrome/Edge/Opera/Samsung (FCM), Firefox (Mozilla autopush),
// Safari/iOS (Apple), legacy Edge (WNS).
const PUSH_HOSTS_EXACT  = new Set(["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
const PUSH_HOST_SUFFIXES = [".push.services.mozilla.com", ".push.apple.com", ".notify.windows.com"];

/** true only for an https URL on a known browser push service (default port, no credentials). */
export function isPushServiceEndpoint(endpoint) {
  let url;
  try { url = new URL(String(endpoint)); } catch { return false; }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS_EXACT.has(host) || PUSH_HOST_SUFFIXES.some(sfx => host.endsWith(sfx));
}

/**
 * Send a push notification to one subscription object.
 * subscription = { endpoint, keys: { p256dh, auth } }
 * payload      = { title, body, icon?, badge?, data? }
 */
export async function sendPush(subscription, payload) {
  if (!VAPID_PUBLIC_KEY || !subscription?.endpoint) return;
  // Also re-checked here: subscriptions saved before the allow-list existed
  // are never contacted, and the caller drops them as stale.
  if (!isPushServiceEndpoint(subscription.endpoint)) {
    logger.warn("Web push skipped — endpoint is not a known push service", { host: (() => { try { return new URL(subscription.endpoint).hostname; } catch { return "invalid"; } })() });
    throw Object.assign(new Error("Untrusted push endpoint"), { stale: true });
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err) {
    // 410 = subscription expired/unsubscribed — caller should remove it
    if (err.statusCode === 410 || err.statusCode === 404) {
      throw Object.assign(err, { stale: true });
    }
    logger.error("Web push send error:", { error: err?.message });
  }
}

// ── Per-device delivery ───────────────────────────────────────────────────────
// Notifications go to each SIGNED-IN device that opted in (session.pushSubscription),
// never to a device that has logged out — a shared computer stops receiving a
// user's notifications the moment they sign out there.

async function pushToDoc(Model, doc, payload) {
  if (!doc?.sessions?.length) return;
  const seen = new Set();
  const targets = doc.sessions.filter(s => {
    const ep = s.isActive && s.pushSubscription?.endpoint;
    if (!ep || seen.has(ep)) return false;
    seen.add(ep);
    return true;
  });
  await Promise.allSettled(targets.map(async (s) => {
    try {
      await sendPush(s.pushSubscription, payload);
    } catch (err) {
      if (!err.stale) return;
      // Browser revoked the subscription — forget it for that device
      await Model.updateOne(
        { _id: doc._id },
        { $set: { "sessions.$[s].pushSubscription": null } },
        { arrayFilters: [{ "s._id": s._id }] },
      ).catch(() => {});
    }
  }));
}

/**
 * Notify one user on every signed-in device that allowed notifications.
 * Never throws — notifications are best-effort.
 */
export async function pushToUser(db, role, userId, payload) {
  if (!VAPID_PUBLIC_KEY || !userId) return;
  try {
    const Model = getUserModelForRole(db, role);
    if (!Model) return;
    const doc = await Model.findById(userId).select("sessions._id sessions.isActive sessions.pushSubscription").lean();
    await pushToDoc(Model, doc, payload);
  } catch (err) {
    logger.warn("pushToUser error:", { error: err?.message });
  }
}

/** Notify every admin of the center (each on their opted-in devices). */
export async function pushToAllAdmins(db, payload) {
  if (!VAPID_PUBLIC_KEY) return;
  try {
    const Model = getUserModelForRole(db, "admin");
    const admins = await Model.find({ "sessions.pushSubscription.endpoint": { $exists: true } })
      .select("sessions._id sessions.isActive sessions.pushSubscription").lean();
    await Promise.allSettled(admins.map(a => pushToDoc(Model, a, payload)));
  } catch (err) {
    logger.warn("pushToAllAdmins error:", { error: err?.message });
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
