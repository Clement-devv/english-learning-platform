// server/routes/pushRoutes.js
// Endpoints for per-DEVICE web push: each signed-in device (session) opts in
// or out on its own, and only active sessions receive notifications — so a
// device that logs out, or is signed out remotely, stops getting them.

import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { VAPID_PUB, sendPush, isPushServiceEndpoint } from "../utils/webPushService.js";
import { getUserModelForRole, SESSION_ROLES } from "../utils/roleModels.js";
import { badRequest, notFound, serverError } from '../utils/apiResponse.js';
import logger from "../utils/logger.js";

const router = express.Router();
router.use(tenantMiddleware);

const MAX_ENDPOINT = 2048;

function cleanSubscription(sub) {
  const endpoint = String(sub?.endpoint || "");
  // Only real browser push services — the server POSTs to this URL (see webPushService)
  if (endpoint.length > MAX_ENDPOINT || !isPushServiceEndpoint(endpoint)) return null;
  const p256dh = String(sub?.keys?.p256dh || "");
  const auth   = String(sub?.keys?.auth || "");
  if (!p256dh || !auth || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint, expirationTime: sub.expirationTime ?? null, keys: { p256dh, auth } };
}

/** The user doc + the session this request's token belongs to */
async function loadCurrentSession(req) {
  const Model = getUserModelForRole(req.db, req.user.role);
  if (!Model) return {};
  const user = await Model.findById(req.user.id);
  if (!user) return {};
  const token   = req.headers.authorization?.split(" ")[1];
  const session =
    (req.user.sid && user.sessions?.find(s => String(s._id) === String(req.user.sid))) ||
    user.sessions?.find(s => s.jwtToken === token) ||
    null;
  return { Model, user, session };
}

// ── GET /api/push/vapid-key  —  public, used by frontend to subscribe ─────────
router.get("/vapid-key", (_req, res) => {
  if (!VAPID_PUB) return res.status(503).json({ error: "Push notifications not configured" });
  res.json({ key: VAPID_PUB });
});

// ── POST /api/push/subscribe  —  turn notifications ON for this device ────────
router.post("/subscribe", verifyToken, async (req, res) => {
  try {
    const subscription = cleanSubscription(req.body?.subscription);
    if (!subscription) return badRequest(res, "Invalid subscription");

    const { user, session } = await loadCurrentSession(req);
    if (!session?.isActive) return notFound(res, "This device's session was not found. Please log in again.");

    // A browser has one push endpoint, whoever is signed in. Detach it from
    // every other session (this user's older logins and other people who used
    // this browser before) so nobody else's notifications land here.
    await Promise.allSettled(SESSION_ROLES.map(role =>
      getUserModelForRole(req.db, role).updateMany(
        { "sessions.pushSubscription.endpoint": subscription.endpoint },
        { $set: { "sessions.$[s].pushSubscription": null } },
        { arrayFilters: [{ "s.pushSubscription.endpoint": subscription.endpoint }] },
      )));

    // Re-load after the detach so we save onto fresh data
    const fresh = await loadCurrentSession(req);
    if (!fresh.session) return notFound(res, "This device's session was not found. Please log in again.");
    fresh.session.pushSubscription = subscription;
    if (fresh.user.pushSubscription !== undefined) fresh.user.pushSubscription = null; // retire old account-wide field
    await fresh.user.save();

    sendPush(subscription, {
      title: "🔔 Notifications are on for this device",
      body:  "You'll get class reminders, messages and calls here.",
      icon:  "/icons/icon.svg",
    }).catch(() => {});

    res.json({ success: true, subscribed: true });
  } catch (err) {
    logger.error("push subscribe error:", { error: err?.message });
    serverError(res, err.message);
  }
});

// ── DELETE /api/push/subscribe  —  turn notifications OFF for this device ─────
router.delete("/subscribe", verifyToken, async (req, res) => {
  try {
    const { user, session } = await loadCurrentSession(req);
    if (session) {
      session.pushSubscription = null;
      await user.save();
    }
    res.json({ success: true, subscribed: false });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── GET /api/push/status  —  does THIS device receive notifications? ─────────
router.get("/status", verifyToken, async (req, res) => {
  try {
    const { session } = await loadCurrentSession(req);
    res.json({ success: true, subscribed: !!session?.pushSubscription?.endpoint });
  } catch (err) {
    serverError(res, err.message);
  }
});

export default router;
