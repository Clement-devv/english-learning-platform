// server/routes/directMessageRoutes.js
import express from "express";
import DirectMessage from "../models/DirectMessage.js";
import Teacher       from "../models/Teacher.js";
import Student       from "../models/Student.js";
import Admin         from "../models/Admin.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Helpers ────────────────────────────────────────────────────────────────
async function getSenderInfo(id, role) {
  if (role === "teacher") {
    const t = await Teacher.findById(id);
    if (!t) return null;
    return { name: `${t.firstName} ${t.lastName}`, model: "Teacher" };
  }
  if (role === "student") {
    const s = await Student.findById(id);
    if (!s) return null;
    return { name: `${s.firstName} ${s.surname}`, model: "Student" };
  }
  if (role === "admin") {
    const a = await Admin.findById(id);
    if (!a) return null;
    return { name: a.firstName ? `${a.firstName} ${a.lastName || ""}`.trim() : "Admin", model: "Admin" };
  }
  return null;
}

function canAccess(dm, userId, role) {
  if (role === "admin") return true;
  if (role === "teacher") return dm.teacherId?.toString() === userId;
  if (role === "student") return dm.studentId?.toString() === userId;
  return false;
}

// ── GET /api/direct-messages  —  list DMs for current user ─────────────────
router.get("/", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    let filter = {};

    if (role === "teacher")      filter.teacherId = userId;
    else if (role === "student") filter.studentId = userId;
    // admin sees all

    const dms = await DirectMessage.find(filter)
      .select("-messages")
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .sort({ lastActivityAt: -1 });

    res.json({ success: true, dms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/direct-messages/start  —  create or retrieve DM with admin ──
// Called by teacher or student to open their admin DM
router.post("/start", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role !== "teacher" && role !== "student") {
      return res.status(403).json({ message: "Only teachers and students can start an admin DM" });
    }

    const sender = await getSenderInfo(userId, role);
    if (!sender) return res.status(404).json({ message: "User not found" });

    const type   = role === "teacher" ? "teacher-admin" : "student-admin";
    const filter = role === "teacher" ? { teacherId: userId } : { studentId: userId };

    let dm = await DirectMessage.findOne(filter);
    if (!dm) {
      dm = await DirectMessage.create({
        type,
        ...(role === "teacher" ? { teacherId: userId } : { studentId: userId }),
        chatName: `${sender.name} ↔ Admin`,
      });
    }

    res.json({ success: true, dm });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/direct-messages/:id/messages ─────────────────────────────────
router.get("/:id/messages", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const dm = await DirectMessage.findById(req.params.id).lean();

    if (!dm) return res.status(404).json({ message: "DM not found" });
    if (!canAccess(dm, userId, role)) return res.status(403).json({ message: "Access denied" });

    res.json({ success: true, messages: dm.messages || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/direct-messages/:id/messages ────────────────────────────────
router.post("/:id/messages", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const { message } = req.body;

    if (!message?.trim()) return res.status(400).json({ message: "Message cannot be empty" });

    const dm = await DirectMessage.findById(req.params.id);
    if (!dm) return res.status(404).json({ message: "DM not found" });
    if (!canAccess(dm, userId, role)) return res.status(403).json({ message: "Access denied" });

    const sender = await getSenderInfo(userId, role);
    if (!sender) return res.status(404).json({ message: "Sender not found" });

    const newMsg = {
      senderId:    userId,
      senderModel: sender.model,
      senderName:  sender.name,
      senderRole:  role,
      message:     message.trim(),
    };

    dm.messages.push(newMsg);
    dm.lastMessage   = { text: message.trim(), senderId: userId, senderName: sender.name, timestamp: new Date() };
    dm.lastActivityAt = new Date();

    // Increment unread for the other party
    if (role === "admin") {
      if (dm.type === "teacher-admin") dm.unreadCount.teacher += 1;
      else dm.unreadCount.student += 1;
    } else {
      dm.unreadCount.admin += 1;
    }

    await dm.save();
    const saved = dm.messages[dm.messages.length - 1];
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/direct-messages/:id/mark-read ─────────────────────────────
router.patch("/:id/mark-read", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const dm = await DirectMessage.findById(req.params.id);

    if (!dm) return res.status(404).json({ message: "DM not found" });
    if (!canAccess(dm, userId, role)) return res.status(403).json({ message: "Access denied" });

    if (role === "admin")        dm.unreadCount.admin   = 0;
    else if (role === "teacher") dm.unreadCount.teacher = 0;
    else if (role === "student") dm.unreadCount.student = 0;

    await dm.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
