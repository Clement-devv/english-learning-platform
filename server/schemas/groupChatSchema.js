import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId:   { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'messages.senderModel' },
  senderModel:{ type: String, required: true, enum: ['Admin', 'Teacher', 'Student'] },
  senderName: String,
  senderRole: { type: String, enum: ['admin', 'teacher', 'student'] },
  message:    { type: String, required: true },
  messageType:{ type: String, enum: ['text', 'file', 'image', 'system'], default: 'text' },
  fileUrl:    String,
  fileName:   String,
  isRead:     { type: Boolean, default: false },
  readBy: [{ userId: mongoose.Schema.Types.ObjectId, userModel: String, readAt: Date }],
  createdAt:  { type: Date, default: Date.now },
});

export const groupChatSchema = new mongoose.Schema({
  assignmentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  teacherId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  studentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  chatName:       String,
  messages:       [messageSchema],
  lastMessage: {
    text: String, senderId: mongoose.Schema.Types.ObjectId,
    senderName: String, timestamp: Date,
  },
  unreadCount: {
    admin:    { type: Number, default: 0 },
    teacher:  { type: Number, default: 0 },
    student:  { type: Number, default: 0 },
    subAdmin: { type: Number, default: 0 },
  },
  isActive:       { type: Boolean, default: true },
  lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true });

groupChatSchema.index({ teacherId: 1, studentId: 1 });
groupChatSchema.index({ assignmentId: 1 }, { unique: true });
groupChatSchema.index({ lastActivityAt: -1 });
groupChatSchema.index({ 'lastMessage.timestamp': -1 });

groupChatSchema.methods.addMessage = function (messageData) {
  this.messages.push(messageData);
  this.lastMessage = { text: messageData.message, senderId: messageData.senderId, senderName: messageData.senderName, timestamp: new Date() };
  if (messageData.senderRole !== 'admin')   this.unreadCount.admin   += 1;
  if (messageData.senderRole !== 'teacher') this.unreadCount.teacher += 1;
  if (messageData.senderRole !== 'student') this.unreadCount.student += 1;
  this.lastActivityAt = new Date();
  return this.save();
};

groupChatSchema.methods.markAsRead = function (userId, userRole) {
  if (userRole === 'admin')        this.unreadCount.admin   = 0;
  else if (userRole === 'teacher') this.unreadCount.teacher = 0;
  else if (userRole === 'student') this.unreadCount.student = 0;
  this.messages.forEach(msg => {
    if (!msg.isRead && msg.senderId.toString() !== userId.toString()) {
      msg.isRead = true;
      msg.readBy.push({ userId, userModel: userRole === 'admin' ? 'Admin' : userRole === 'teacher' ? 'Teacher' : 'Student', readAt: new Date() });
    }
  });
  return this.save();
};
