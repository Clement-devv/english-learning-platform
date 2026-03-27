// server/routes/notificationRoutes.js
import express from "express";
import Notification from "../models/Notification.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/notifications — admin: list all, newest first
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { limit = 100, unreadOnly } = req.query;
    const filter = unreadOnly === "true" ? { read: false } : {};
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    const unreadCount = await Notification.countDocuments({ read: false });

    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    console.error("Notifications fetch error:", err);
    res.status(500).json({ success: false, message: "Failed to load notifications" });
  }
});

// GET /api/notifications/unread-count — lightweight badge count
router.get("/unread-count", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ read: false });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch count" });
  }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch("/read-all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Notification.updateMany({ read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark notifications as read" });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch("/:id/read", verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark notification as read" });
  }
});

export default router;
