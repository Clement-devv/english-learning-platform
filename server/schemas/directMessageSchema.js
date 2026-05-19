import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId:    { type: mongoose.Schema.Types.ObjectId, required: true },
  senderModel: { type: String, required: true, enum: ['Admin', 'Teacher', 'Student', 'SubAdmin'] },
  senderName:  String,
  senderRole:  { type: String, enum: ['admin', 'teacher', 'student', 'sub-admin'] },
  message:     { type: String, required: true },
  isRead:      { type: Boolean, default: false },
  readBy:      [{ userId: mongoose.Schema.Types.ObjectId, readAt: Date }],
  createdAt:   { type: Date, default: Date.now },
});

export const directMessageSchema = new mongoose.Schema({
  type: { type: String, enum: ['teacher-admin', 'student-admin', 'sub-admin-admin', 'sub-admin-teacher'], required: true },
  teacherId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  subAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubAdmin' },
  chatName:   String,
  messages:   [messageSchema],
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
  lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true });

// teacher-admin: one DM per teacher (scoped to type so sub-admin-teacher docs don't conflict).
// Old single-field teacherId_1 index must be dropped — migrateSubAdminIndex() handles this.
directMessageSchema.index({ teacherId: 1, type: 1 }, { unique: true, sparse: true });
directMessageSchema.index({ studentId: 1 }, { unique: true, sparse: true });
// Compound index covers sub-admin-admin (teacherId=null) and sub-admin-teacher (teacherId=X).
// Old single-field subAdminId_1 index must be dropped — migrateSubAdminIndex() handles this.
directMessageSchema.index({ subAdminId: 1, teacherId: 1 }, { unique: true, sparse: true });
directMessageSchema.index({ lastActivityAt: -1 });
