// server/routes/notificationRoutes.js
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { notificationSchema } from "../schemas/notificationSchema.js";

const router = express.Router();
router.use(tenantMiddleware);

const getNotification = (db) => db.models.Notification || db.model("Notification", notificationSchema);

// GET /api/notifications — admin: list all, newest first
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { limit = 100, unreadOnly } = req.query;
    const filter = unreadOnly === "true" ? { read: false } : {};
    const Notification = getNotification(req.db);
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
    const count = await getNotification(req.db).countDocuments({ read: false });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch count" });
  }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch("/read-all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    await getNotification(req.db).updateMany({ read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark notifications as read" });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch("/:id/read", verifyToken, verifyAdmin, async (req, res) => {
  try {
    await getNotification(req.db).findByIdAndUpdate(req.params.id, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark notification as read" });
  }
});

export default router;
