import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tokenHash: { type: String, unique: true, required: true },
  tokenEnc: { type: String, select: false },
  enabled: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
export default mongoose.models.TeacherFamilyGrant || mongoose.model('TeacherFamilyGrant', schema);
