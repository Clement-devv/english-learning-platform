// server/routes/pushRoutes.js
// Endpoints for subscribing/unsubscribing to web push and fetching the VAPID public key.

import express  from "express";
import Student  from "../models/Student.js";
import Teacher  from "../models/Teacher.js";
import { verifyToken, verifyStudent, verifyTeacher } from "../middleware/authMiddleware.js";
import { VAPID_PUB, sendPush } from "../utils/webPushService.js";

const router = express.Router();

// ── GET /api/push/vapid-key  —  public, used by frontend to subscribe ─────────
router.get("/vapid-key", (_req, res) => {
  if (!VAPID_PUB) return res.status(503).json({ error: "Push notifications not configured" });
  res.json({ key: VAPID_PUB });
});

// ── POST /api/push/subscribe  —  student or teacher saves their subscription ──
router.post("/subscribe", verifyToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ error: "Invalid subscription" });

    const role = req.user.role; // "student" | "teacher"
    const Model = role === "student" ? Student : Teacher;
    await Model.findByIdAndUpdate(req.user._id, { pushSubscription: subscription });

    // Send a welcome test push
    sendPush(subscription, {
      title: "🔔 Notifications enabled!",
      body:  "You'll get a reminder 30 minutes before each class.",
      icon:  "/favicon.ico",
    }).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/push/subscribe  —  unsubscribe ────────────────────────────────
router.delete("/subscribe", verifyToken, async (req, res) => {
  try {
    const Model = req.user.role === "student" ? Student : Teacher;
    await Model.findByIdAndUpdate(req.user._id, { pushSubscription: null });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/push/status  —  check if this user has an active subscription ────
router.get("/status", verifyToken, async (req, res) => {
  try {
    const Model = req.user.role === "student" ? Student : Teacher;
    const user  = await Model.findById(req.user._id).select("pushSubscription");
    res.json({ subscribed: !!user?.pushSubscription?.endpoint });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
