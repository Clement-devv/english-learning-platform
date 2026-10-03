import mongoose from 'mongoose';

export const notificationSchema = new mongoose.Schema({
  type:         { type: String, required: true },
  message:      { type: String, required: true },
  // Who did it. Sub-admin activity sets subAdminId/subAdminName; other people
  // (e.g. a teacher accepting a class the admin booked) set actorName/actorRole.
  subAdminId:   { type: mongoose.Schema.Types.ObjectId, ref: 'SubAdmin' },
  subAdminName: { type: String },
  actorName:    { type: String },
  actorRole:    { type: String },
  metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
  read:         { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
});

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ read: 1, createdAt: -1 });
// Fetch unread notifications for a specific sub-admin
notificationSchema.index({ subAdminId: 1, read: 1, createdAt: -1 });
// TTL: auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
