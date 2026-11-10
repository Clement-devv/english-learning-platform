import mongoose from 'mongoose';

export const standaloneGroupReviewSchema = new mongoose.Schema({
  groupClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupClass', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 1000, default: '', trim: true },
  flagged: { type: Boolean, default: false },
}, { timestamps: true });
standaloneGroupReviewSchema.index({ groupClassId: 1, studentId: 1 }, { unique: true });
standaloneGroupReviewSchema.index({ teacherId: 1, createdAt: -1 });
