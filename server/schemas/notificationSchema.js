import mongoose from 'mongoose';

export const notificationSchema = new mongoose.Schema({
  type:         { type: String, required: true },
  message:      { type: String, required: true },
  subAdminId:   { type: mongoose.Schema.Types.ObjectId, ref: 'SubAdmin', required: true },
  subAdminName: { type: String, required: true },
  metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
  read:         { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
});

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ read: 1, createdAt: -1 });
