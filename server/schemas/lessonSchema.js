import mongoose from 'mongoose';

export const lessonSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  teacher:   { type: String, required: true },
  date:      { type: Date, default: Date.now },
}, { timestamps: true });

// Student lesson history
lessonSchema.index({ studentId: 1, date: -1 });
