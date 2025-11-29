// server/routes/groupChatRoutes.js - ✅ FIXED VERSION WITH ADMIN SUPPORT
import express from "express";
import GroupChat from "../models/GroupChat.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import Admin from "../models/Admin.js"; // ✅ ADDED: Admin model import
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/group-chats
 * Get all group chats for the logged-in user (filtered by role)
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    let filter = {};
    
    // Role-based filtering
    if (role === "admin") {
      // Admin sees ALL chats
      filter = {};
    } else if (role === "teacher") {
      // Teacher sees only their assigned students
      filter.teacherId = userId;
    } else if (role === "student") {
      // Student sees only their teacher
      filter.studentId = userId;
    } else {
      return res.status(403).json({ 
        success: false, 
        message: "Invalid user role" 
      });
    }

    const chats = await GroupChat.find(filter)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .sort({ lastActivityAt: -1 });

    res.json({
      success: true,
      chats
    });

  } catch (error) {
    console.error("❌ Error fetching chats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chats",
      error: error.message
    });
  }
});

/**
 * GET /api/group-chats/:chatId
 * Get a specific chat by ID
 */
router.get("/:chatId", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { id: userId, role } = req.user;

    const chat = await GroupChat.findById(chatId)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");

    if (!chat) {
      return res.status(404).json({ 
        success: false, 
        message: "Chat not found" 
      });
    }

    // Access control: Only admin, assigned teacher, or assigned student can view
    if (role !== "admin" && 
        chat.teacherId._id.toString() !== userId && 
        chat.studentId._id.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    res.json({
      success: true,
      chat
    });

  } catch (error) {
    console.error("❌ Error fetching chat:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chat",
      error: error.message
    });
  }
});

/**
 * GET /api/group-chats/:chatId/messages
 * Get all messages for a specific chat
 */
router.get("/:chatId/messages", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { id: userId, role } = req.user;

    const chat = await GroupChat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ 
        success: false, 
        message: "Chat not found" 
      });
    }

    // Access control
    if (role !== "admin" && 
        chat.teacherId.toString() !== userId && 
        chat.studentId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    res.json({
      success: true,
      messages: chat.messages
    });

  } catch (error) {
    console.error("❌ Error fetching messages:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
      error: error.message
    });
  }
});

/**
 * POST /api/group-chats/:chatId/messages
 * Send a message in a chat
 * ✅ FIXED: Now supports Admin users
 */
router.post("/:chatId/messages", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;
    const { id: senderId, role } = req.user;

    // ✅ FIXED: Get sender details (including Admin)
    let senderName, senderModel;
    
    if (role === "teacher") {
      const teacher = await Teacher.findById(senderId);
      if (!teacher) {
        return res.status(404).json({ 
          success: false, 
          message: "Teacher not found" 
        });
      }
      senderName = `${teacher.firstName} ${teacher.lastName}`;
      senderModel = "Teacher";
      
    } else if (role === "student") {
      const student = await Student.findById(senderId);
      if (!student) {
        return res.status(404).json({ 
          success: false, 
          message: "Student not found" 
        });
      }
      senderName = `${student.firstName} ${student.surname}`;
      senderModel = "Student";
      
    } else if (role === "admin") {
      // ✅ NEW: Handle admin users
      const admin = await Admin.findById(senderId);
      if (!admin) {
        return res.status(404).json({ 
          success: false, 
          message: "Admin not found" 
        });
      }
      senderName = `${admin.firstName} ${admin.lastName}`;
      senderModel = "Admin";
      
    } else {
      return res.status(403).json({ 
        success: false, 
        message: "Invalid user role" 
      });
    }

    // Validation
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: "Message cannot be empty" 
      });
    }

    // Find chat
    const chat = await GroupChat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        success: false, 
        message: "Chat not found" 
      });
    }

    // Access control: Admin can send to any chat
    if (role !== "admin" && 
        chat.teacherId.toString() !== senderId && 
        chat.studentId.toString() !== senderId) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    // Create new message
    const newMessage = {
      senderId,
      senderModel,
      senderName,
      senderRole: role,
      message: message.trim(),
      messageType: "text",
      isRead: false,
      readBy: []
    };

    // Add message to chat
    chat.messages.push(newMessage);
    chat.lastMessage = {
      text: message.trim(),
      senderId,
      senderName,
      timestamp: new Date()
    };
    chat.lastActivityAt = new Date();

    // Update unread counts for other participants
    if (role === "teacher") {
      chat.unreadCount.student += 1;
      chat.unreadCount.admin += 1;
    } else if (role === "student") {
      chat.unreadCount.teacher += 1;
      chat.unreadCount.admin += 1;
    } else if (role === "admin") {
      chat.unreadCount.teacher += 1;
      chat.unreadCount.student += 1;
    }

    await chat.save();

    // Return the newly created message
    const savedMessage = chat.messages[chat.messages.length - 1];

    res.json({
      success: true,
      message: "Message sent successfully",
      data: savedMessage
    });

  } catch (error) {
    console.error("❌ Error sending message:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: error.message
    });
  }
});

/**
 * PATCH /api/group-chats/:chatId/mark-read
 * Mark all messages as read for the current user
 */
router.patch("/:chatId/mark-read", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { id: userId, role } = req.user;

    const chat = await GroupChat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ 
        success: false, 
        message: "Chat not found" 
      });
    }

    // Access control
    if (role !== "admin" && 
        chat.teacherId.toString() !== userId && 
        chat.studentId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    // Mark all messages as read by this user
    chat.messages.forEach((msg) => {
      if (!msg.readBy.some(r => r.userId.toString() === userId)) {
        msg.readBy.push({ userId, readAt: new Date() });
      }
    });

    // Reset unread count for this role
    if (role === "admin") {
      chat.unreadCount.admin = 0;
    } else if (role === "teacher") {
      chat.unreadCount.teacher = 0;
    } else if (role === "student") {
      chat.unreadCount.student = 0;
    }

    await chat.save();

    res.json({
      success: true,
      message: "Messages marked as read"
    });

  } catch (error) {
    console.error("❌ Error marking messages as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark messages as read",
      error: error.message
    });
  }
});

/**
 * DELETE /api/group-chats/:chatId
 * Delete a chat (Admin only)
 */
router.delete("/:chatId", verifyToken, async (req, res) => {
  try {
    const { role } = req.user;

    if (role !== "admin") {
      return res.status(403).json({ 
        success: false, 
        message: "Only admins can delete chats" 
      });
    }

    const { chatId } = req.params;
    const chat = await GroupChat.findByIdAndDelete(chatId);

    if (!chat) {
      return res.status(404).json({ 
        success: false, 
        message: "Chat not found" 
      });
    }

    res.json({
      success: true,
      message: "Chat deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error deleting chat:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete chat",
      error: error.message
    });
  }
});

export default router;