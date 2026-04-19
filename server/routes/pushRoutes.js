// server/routes/pushRoutes.js
// Endpoints for subscribing/unsubscribing to web push and fetching the VAPID public key.

import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { VAPID_PUB, sendPush } from "../utils/webPushService.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);
const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);

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

    const role  = req.user.role;
    const Model = role === "student" ? getStudent(req.db) : getTeacher(req.db);
    await Model.findByIdAndUpdate(req.user._id, { pushSubscription: subscription });

    sendPush(subscription, {
      title: "🔔 Notifications enabled!",
      body:  "You'll get a reminder 30 minutes before each class.",
      icon:  "/favicon.ico",
    }).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── DELETE /api/push/subscribe  —  unsubscribe ────────────────────────────────
router.delete("/subscribe", verifyToken, async (req, res) => {
  try {
    const Model = req.user.role === "student" ? getStudent(req.db) : getTeacher(req.db);
    await Model.findByIdAndUpdate(req.user._id, { pushSubscription: null });
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── GET /api/push/status  —  check if this user has an active subscription ────
router.get("/status", verifyToken, async (req, res) => {
  try {
    const Model = req.user.role === "student" ? getStudent(req.db) : getTeacher(req.db);
    const user  = await Model.findById(req.user._id).select("pushSubscription");
    res.json({ subscribed: !!user?.pushSubscription?.endpoint });
  } catch (err) {
    serverError(res, err.message);
  }
});

export default router;
