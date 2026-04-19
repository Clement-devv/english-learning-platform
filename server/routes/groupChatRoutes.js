// server/routes/groupChatRoutes.js
import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { groupChatSchema }  from "../schemas/groupChatSchema.js";
import { teacherSchema }    from "../schemas/teacherSchema.js";
import { studentSchema }    from "../schemas/studentSchema.js";
import { adminSchema }      from "../schemas/adminSchema.js";
import { subAdminSchema }   from "../schemas/subAdminSchema.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getGroupChat = (db) => db.models.GroupChat || db.model("GroupChat", groupChatSchema);
const getTeacher   = (db) => db.models.Teacher   || db.model("Teacher",   teacherSchema);
const getStudent   = (db) => db.models.Student   || db.model("Student",   studentSchema);
const getAdmin     = (db) => db.models.Admin     || db.model("Admin",     adminSchema);
const getSubAdmin  = (db) => db.models.SubAdmin  || db.model("SubAdmin",  subAdminSchema);

// GET /api/group-chats — list chats for logged-in user
router.get("/", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    let filter = {};

    if (role === "admin") {
      filter = {};
    } else if (role === "teacher") {
      filter.teacherId = userId;
    } else if (role === "student") {
      filter.studentId = userId;
    } else if (role === "sub-admin") {
      const scope = req.user.teacherScope || [];
      filter.teacherId = { $in: scope };
    } else {
      return forbidden(res, "Invalid user role");
    }

    const chats = await getGroupChat(req.db).find(filter)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email")
      .sort({ lastActivityAt: -1 })
      .lean();

    res.json({ success: true, chats });
  } catch (error) {
    logger.error("Error fetching chats:", { error: error?.message });
    res.status(500).json({ success: false, message: "Failed to fetch chats", error: error.message });
  }
});

// GET /api/group-chats/:chatId — get a specific chat
router.get("/:chatId", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { id: userId, role } = req.user;

    const chat = await getGroupChat(req.db).findById(chatId)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email");

    if (!chat) return notFound(res, "Chat not found");

    const teacherIdStr = chat.teacherId?._id?.toString() || chat.teacherId?.toString();
    const studentIdStr = chat.studentId?._id?.toString() || chat.studentId?.toString();
    const scope = req.user.teacherScope?.map(String) || [];

    if (role !== "admin" &&
        teacherIdStr !== userId &&
        studentIdStr !== userId &&
        !(role === "sub-admin" && scope.includes(teacherIdStr))) {
      return forbidden(res, "Access denied");
    }

    res.json({ success: true, chat });
  } catch (error) {
    logger.error("Error fetching chat:", { error: error?.message });
    res.status(500).json({ success: false, message: "Failed to fetch chat", error: error.message });
  }
});

// GET /api/group-chats/:chatId/messages
router.get("/:chatId/messages", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { id: userId, role } = req.user;

    const chat = await getGroupChat(req.db).findById(chatId)
      .select("chatName teacherId studentId assignmentId messages")
      .lean();

    if (!chat) return notFound(res, "Chat not found");

    const scope = req.user.teacherScope?.map(String) || [];
    if (role !== "admin" &&
        chat.teacherId.toString() !== userId &&
        chat.studentId.toString() !== userId &&
        !(role === "sub-admin" && scope.includes(chat.teacherId.toString()))) {
      return forbidden(res, "Access denied");
    }

    res.json({ success: true, messages: chat.messages || [] });
  } catch (error) {
    logger.error("Error fetching messages:", { error: error?.message });
    res.status(500).json({ success: false, message: "Failed to fetch messages", error: error.message });
  }
});

// POST /api/group-chats/:chatId/messages — send a message
router.post("/:chatId/messages", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;
    const { id: senderId, role } = req.user;

    let senderName, senderModel;

    if (role === "teacher") {
      const teacher = await getTeacher(req.db).findById(senderId);
      if (!teacher) return notFound(res, "Teacher not found");
      senderName  = `${teacher.firstName} ${teacher.lastName}`;
      senderModel = "Teacher";
    } else if (role === "student") {
      const student = await getStudent(req.db).findById(senderId);
      if (!student) return notFound(res, "Student not found");
      senderName  = `${student.firstName} ${student.lastName}`;
      senderModel = "Student";
    } else if (role === "admin") {
      const admin = await getAdmin(req.db).findById(senderId);
      if (!admin) return notFound(res, "Admin not found");
      senderName  = `${admin.firstName} ${admin.lastName}`;
      senderModel = "Admin";
    } else if (role === "sub-admin") {
      const subAdmin = await getSubAdmin(req.db).findById(senderId);
      if (!subAdmin) return notFound(res, "Sub-admin not found");
      senderName  = `${subAdmin.firstName} ${subAdmin.lastName}`;
      senderModel = "SubAdmin";
    } else {
      return forbidden(res, "Invalid user role");
    }

    if (!message || !message.trim())
      return badRequest(res, "Message cannot be empty");

    const chat = await getGroupChat(req.db).findById(chatId);
    if (!chat) return notFound(res, "Chat not found");

    const sendScope = req.user.teacherScope?.map(String) || [];
    if (role !== "admin" &&
        chat.teacherId.toString() !== senderId &&
        chat.studentId.toString() !== senderId &&
        !(role === "sub-admin" && sendScope.includes(chat.teacherId.toString()))) {
      return forbidden(res, "Access denied");
    }

    chat.messages.push({
      senderId, senderModel, senderName, senderRole: role,
      message: message.trim(), messageType: "text", isRead: false, readBy: [],
    });
    chat.lastMessage    = { text: message.trim(), senderId, senderName, timestamp: new Date() };
    chat.lastActivityAt = new Date();

    if (role === "teacher") {
      chat.unreadCount.student  += 1;
      chat.unreadCount.admin    += 1;
      chat.unreadCount.subAdmin += 1;
    } else if (role === "student") {
      chat.unreadCount.teacher  += 1;
      chat.unreadCount.admin    += 1;
      chat.unreadCount.subAdmin += 1;
    } else if (role === "admin") {
      chat.unreadCount.teacher  += 1;
      chat.unreadCount.student  += 1;
      chat.unreadCount.subAdmin += 1;
    } else if (role === "sub-admin") {
      chat.unreadCount.teacher += 1;
      chat.unreadCount.student += 1;
      chat.unreadCount.admin   += 1;
    }

    await chat.save();
    const savedMessage = chat.messages[chat.messages.length - 1];

    res.json({ success: true, message: "Message sent successfully", data: savedMessage });
  } catch (error) {
    logger.error("Error sending message:", { error: error?.message });
    res.status(500).json({ success: false, message: "Failed to send message", error: error.message });
  }
});

// PATCH /api/group-chats/:chatId/mark-read
router.patch("/:chatId/mark-read", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { id: userId, role } = req.user;

    const chat = await getGroupChat(req.db).findById(chatId);
    if (!chat) return notFound(res, "Chat not found");

    const mrScope = req.user.teacherScope?.map(String) || [];
    if (role !== "admin" &&
        chat.teacherId.toString() !== userId &&
        chat.studentId.toString() !== userId &&
        !(role === "sub-admin" && mrScope.includes(chat.teacherId.toString()))) {
      return forbidden(res, "Access denied");
    }

    chat.messages.forEach((msg) => {
      if (!msg.readBy.some(r => r.userId.toString() === userId)) {
        msg.readBy.push({ userId, readAt: new Date() });
      }
    });

    if (role === "admin")          chat.unreadCount.admin    = 0;
    else if (role === "teacher")   chat.unreadCount.teacher  = 0;
    else if (role === "student")   chat.unreadCount.student  = 0;
    else if (role === "sub-admin") chat.unreadCount.subAdmin = 0;

    await chat.save();
    res.json({ success: true, message: "Messages marked as read" });
  } catch (error) {
    logger.error("Error marking messages as read:", { error: error?.message });
    res.status(500).json({ success: false, message: "Failed to mark messages as read", error: error.message });
  }
});

// DELETE /api/group-chats/:chatId — admin only
router.delete("/:chatId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return forbidden(res, "Only admins can delete chats");

    const chat = await getGroupChat(req.db).findByIdAndDelete(req.params.chatId);
    if (!chat) return notFound(res, "Chat not found");

    res.json({ success: true, message: "Chat deleted successfully" });
  } catch (error) {
    logger.error("Error deleting chat:", { error: error?.message });
    res.status(500).json({ success: false, message: "Failed to delete chat", error: error.message });
  }
});

export default router;
