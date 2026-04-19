// server/routes/directMessageRoutes.js
import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware }       from "../middleware/tenantMiddleware.js";
import { directMessageSchema }    from "../schemas/directMessageSchema.js";
import { teacherSchema }          from "../schemas/teacherSchema.js";
import { studentSchema }          from "../schemas/studentSchema.js";
import { adminSchema }            from "../schemas/adminSchema.js";
import { subAdminSchema }         from "../schemas/subAdminSchema.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getDirectMessage = (db) => db.models.DirectMessage || db.model("DirectMessage", directMessageSchema);
const getTeacher       = (db) => db.models.Teacher       || db.model("Teacher",       teacherSchema);
const getStudent       = (db) => db.models.Student       || db.model("Student",       studentSchema);
const getAdmin         = (db) => db.models.Admin         || db.model("Admin",         adminSchema);
const getSubAdmin      = (db) => db.models.SubAdmin      || db.model("SubAdmin",      subAdminSchema);

// ── Helpers ────────────────────────────────────────────────────────────────
async function getSenderInfo(id, role, db) {
  if (role === "teacher") {
    const t = await getTeacher(db).findById(id);
    if (!t) return null;
    return { name: `${t.firstName} ${t.lastName}`, model: "Teacher" };
  }
  if (role === "student") {
    const s = await getStudent(db).findById(id);
    if (!s) return null;
    return { name: `${s.firstName} ${s.lastName}`, model: "Student" };
  }
  if (role === "admin") {
    const a = await getAdmin(db).findById(id);
    if (!a) return null;
    return { name: a.firstName ? `${a.firstName} ${a.lastName || ""}`.trim() : "Admin", model: "Admin" };
  }
  if (role === "sub-admin") {
    const sa = await getSubAdmin(db).findById(id);
    if (!sa) return null;
    return { name: `${sa.firstName} ${sa.lastName}`, model: "SubAdmin" };
  }
  return null;
}

function canAccess(dm, userId, role) {
  if (role === "admin")     return true;
  if (role === "teacher")   return dm.teacherId?.toString()  === userId;
  if (role === "student")   return dm.studentId?.toString()  === userId;
  if (role === "sub-admin") return dm.subAdminId?.toString() === userId;
  return false;
}

// ── GET /api/direct-messages — list DMs for current user ─────────────────
router.get("/", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    let filter = {};

    if (role === "teacher")        filter.teacherId  = userId;
    else if (role === "student")   filter.studentId  = userId;
    else if (role === "sub-admin") filter.subAdminId = userId;
    // admin sees all

    const dms = await getDirectMessage(req.db).find(filter)
      .select("-messages")
      .populate("teacherId",  "firstName lastName email")
      .populate("studentId",  "firstName lastName email")
      .populate("subAdminId", "firstName lastName email")
      .sort({ lastActivityAt: -1 });

    res.json({ success: true, dms });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── POST /api/direct-messages/start — create or retrieve DM with admin ──
router.post("/start", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (!["teacher", "student", "sub-admin"].includes(role))
      return forbidden(res, "Only teachers, students and sub-admins can start an admin DM");

    const sender = await getSenderInfo(userId, role, req.db);
    if (!sender) return notFound(res, "User not found");

    let type, filter, create;
    if (role === "teacher") {
      type = "teacher-admin"; filter = { teacherId: userId }; create = { teacherId: userId };
    } else if (role === "student") {
      type = "student-admin"; filter = { studentId: userId }; create = { studentId: userId };
    } else {
      type = "sub-admin-admin"; filter = { subAdminId: userId }; create = { subAdminId: userId };
    }

    const DirectMessage = getDirectMessage(req.db);
    let dm = await DirectMessage.findOne(filter);
    if (!dm) {
      dm = await DirectMessage.create({ type, ...create, chatName: `${sender.name} ↔ Admin` });
    }

    res.json({ success: true, dm });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── GET /api/direct-messages/:id/messages ─────────────────────────────────
router.get("/:id/messages", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const dm = await getDirectMessage(req.db).findById(req.params.id).lean();

    if (!dm) return notFound(res, "DM not found");
    if (!canAccess(dm, userId, role)) return forbidden(res, "Access denied");

    res.json({ success: true, messages: dm.messages || [] });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── POST /api/direct-messages/:id/messages ────────────────────────────────
router.post("/:id/messages", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const { message } = req.body;

    if (!message?.trim()) return badRequest(res, "Message cannot be empty");
    if (message.trim().length > 5000) return badRequest(res, "Message too long (max 5000 characters)");

    const dm = await getDirectMessage(req.db).findById(req.params.id);
    if (!dm) return notFound(res, "DM not found");
    if (!canAccess(dm, userId, role)) return forbidden(res, "Access denied");

    const sender = await getSenderInfo(userId, role, req.db);
    if (!sender) return notFound(res, "Sender not found");

    dm.messages.push({
      senderId:    userId,
      senderModel: sender.model,
      senderName:  sender.name,
      senderRole:  role,
      message:     message.trim(),
    });
    dm.lastMessage    = { text: message.trim(), senderId: userId, senderName: sender.name, timestamp: new Date() };
    dm.lastActivityAt = new Date();

    if (role === "admin") {
      if (dm.type === "teacher-admin")      dm.unreadCount.teacher  += 1;
      else if (dm.type === "student-admin") dm.unreadCount.student  += 1;
      else                                  dm.unreadCount.subAdmin += 1;
    } else {
      dm.unreadCount.admin += 1;
    }

    await dm.save();
    const saved = dm.messages[dm.messages.length - 1];
    res.json({ success: true, data: saved });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── PATCH /api/direct-messages/:id/mark-read ─────────────────────────────
router.patch("/:id/mark-read", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const dm = await getDirectMessage(req.db).findById(req.params.id);

    if (!dm) return notFound(res, "DM not found");
    if (!canAccess(dm, userId, role)) return forbidden(res, "Access denied");

    if (role === "admin")           dm.unreadCount.admin    = 0;
    else if (role === "teacher")    dm.unreadCount.teacher  = 0;
    else if (role === "student")    dm.unreadCount.student  = 0;
    else if (role === "sub-admin")  dm.unreadCount.subAdmin = 0;

    await dm.save();
    res.json({ success: true });
  } catch (err) {
    serverError(res, err.message);
  }
});

export default router;
