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
import { sendPush } from '../utils/webPushService.js';
import logger from '../utils/logger.js';

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

    // ── Real-time notification to recipient ──────────────────────────────────
    const payload = {
      dmId:       dm._id.toString(),
      message:    message.trim().slice(0, 120),
      senderName: sender.name,
      senderRole: role,
    };
    try {
      const io = req.app.get('io');
      const slug = req.center?.slug;
      if (io && slug) {
        if (role === 'admin') {
          // Admin → teacher / student / sub-admin
          if (dm.type === 'teacher-admin' && dm.teacherId) {
            io.to(`teacher-room:${slug}:${dm.teacherId}`).emit('new-direct-message', payload);
            // Push notification
            getTeacher(req.db).findById(dm.teacherId).select('pushSubscription').then(t => {
              if (t?.pushSubscription?.endpoint)
                sendPush(t.pushSubscription, { title: `💬 Message from Admin`, body: message.trim().slice(0, 100), icon: '/icons/icon.svg', data: { url: '/teacher/dashboard?tab=messages' } }).catch(() => {});
            }).catch(() => {});
          } else if (dm.type === 'student-admin' && dm.studentId) {
            io.to(`student-room:${slug}:${dm.studentId}`).emit('new-direct-message', payload);
            getStudent(req.db).findById(dm.studentId).select('pushSubscription').then(s => {
              if (s?.pushSubscription?.endpoint)
                sendPush(s.pushSubscription, { title: `💬 Message from Admin`, body: message.trim().slice(0, 100), icon: '/icons/icon.svg', data: { url: '/student/dashboard?tab=messages' } }).catch(() => {});
            }).catch(() => {});
          } else if (dm.type === 'sub-admin-admin' && dm.subAdminId) {
            io.to(`admin-room:${slug}:${dm.subAdminId}`).emit('new-direct-message', payload);
          }
        } else {
          // Teacher / student / sub-admin → admin broadcast
          io.to(`admin-broadcast:${slug}`).emit('new-direct-message', payload);
          // Push to all admins with a subscription
          getAdmin(req.db).find({ pushSubscription: { $exists: true, $ne: null } }).select('pushSubscription').lean().then(admins => {
            admins.forEach(a => {
              if (a.pushSubscription?.endpoint)
                sendPush(a.pushSubscription, { title: `💬 Message from ${sender.name}`, body: message.trim().slice(0, 100), icon: '/icons/icon.svg', data: { url: '/admin/dashboard?tab=messages' } }).catch(() => {});
            });
          }).catch(() => {});
        }
      }
    } catch (err) {
      logger.warn('DM real-time notify error:', { error: err?.message });
    }

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
