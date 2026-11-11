import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true, maxlength: 120 },
  key: { type: String, required: true, unique: true },
  ownerId: mongoose.Schema.Types.ObjectId,
  status: { type: String, enum: ['invited', 'activating', 'active', 'suspended'], default: 'invited' },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  inviteHash: { type: String, select: false }, inviteExpires: Date,
  resetHash: { type: String, select: false }, resetExpires: Date,
  timezone: { type: String, default: 'UTC' },
  dailyReportLastDate: String,
  scheduleLock: String, scheduleLockUntil: Date,
  resourceBytes: { type: Number, default: 0 },
  aiCredits: { balance: { type: Number, default: 0 }, log: [{ amount: Number, note: String, by: String, createdAt: Date }] },
}, { timestamps: true });
schema.index({ inviteHash: 1 }, { sparse: true });
schema.index({ resetHash: 1 }, { sparse: true });
export default mongoose.models.TeacherWorkspace || mongoose.model('TeacherWorkspace', schema);
