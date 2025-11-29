// server/models/GroupChat.js
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'messages.senderModel'
  },
  senderModel: {
    type: String,
    required: true,
    enum: ['Admin', 'Teacher', 'Student']
  },
  senderName: String, // Store name for quick display
  senderRole: {
    type: String,
    enum: ['admin', 'teacher', 'student']
  },
  message: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    enum: ['text', 'file', 'image', 'system'],
    default: 'text'
  },
  fileUrl: String,
  fileName: String,
  isRead: {
    type: Boolean,
    default: false
  },
  readBy: [{
    userId: mongoose.Schema.Types.ObjectId,
    userModel: String,
    readAt: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const groupChatSchema = new mongoose.Schema({
  // Assignment reference - links to specific teacher-student pair
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
    // unique: true is defined in schema.index() below to avoid duplicate index warning
  },
  
  // Participants
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  
  // Chat name for display
  chatName: String, // e.g., "John Smith - Jane Doe"
  
  // Messages array
  messages: [messageSchema],
  
  // Last message info for chat list display
  lastMessage: {
    text: String,
    senderId: mongoose.Schema.Types.ObjectId,
    senderName: String,
    timestamp: Date
  },
  
  // Unread counts per user
  unreadCount: {
    admin: { type: Number, default: 0 },
    teacher: { type: Number, default: 0 },
    student: { type: Number, default: 0 }
  },
  
  // Activity tracking
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  }
  
}, {
  timestamps: true
});

// Indexes for faster queries
groupChatSchema.index({ teacherId: 1, studentId: 1 });
groupChatSchema.index({ assignmentId: 1 }, { unique: true }); // One chat per assignment
groupChatSchema.index({ lastActivityAt: -1 });
groupChatSchema.index({ 'lastMessage.timestamp': -1 });

// Method to add a message
groupChatSchema.methods.addMessage = function(messageData) {
  this.messages.push(messageData);
  
  // Update last message
  this.lastMessage = {
    text: messageData.message,
    senderId: messageData.senderId,
    senderName: messageData.senderName,
    timestamp: new Date()
  };
  
  // Update unread counts
  if (messageData.senderRole !== 'admin') {
    this.unreadCount.admin += 1;
  }
  if (messageData.senderRole !== 'teacher') {
    this.unreadCount.teacher += 1;
  }
  if (messageData.senderRole !== 'student') {
    this.unreadCount.student += 1;
  }
  
  this.lastActivityAt = new Date();
  
  return this.save();
};

// Method to mark messages as read
groupChatSchema.methods.markAsRead = function(userId, userRole) {
  // Reset unread count for this user
  if (userRole === 'admin') {
    this.unreadCount.admin = 0;
  } else if (userRole === 'teacher') {
    this.unreadCount.teacher = 0;
  } else if (userRole === 'student') {
    this.unreadCount.student = 0;
  }
  
  // Mark unread messages as read
  this.messages.forEach(msg => {
    if (!msg.isRead && msg.senderId.toString() !== userId.toString()) {
      msg.isRead = true;
      msg.readBy.push({
        userId,
        userModel: userRole === 'admin' ? 'Admin' : userRole === 'teacher' ? 'Teacher' : 'Student',
        readAt: new Date()
      });
    }
  });
  
  return this.save();
};

export default mongoose.model("GroupChat", groupChatSchema);