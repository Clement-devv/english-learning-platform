import mongoose from 'mongoose';

export const recordingSchema = new mongoose.Schema({
  bookingId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  teacherId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  studentId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  title:            { type: String, default: '' },
  filename:         { type: String, required: true },
  duration:         { type: Number, default: 0 },
  fileSize:         { type: Number, default: 0 },
  mimeType:         { type: String, default: 'video/webm' },
  visibleToStudent: { type: Boolean, default: true },
  autoDeleteAt:     { type: Date },
}, { timestamps: true });

recordingSchema.index({ teacherId: 1, createdAt: -1 });
recordingSchema.index({ studentId: 1, createdAt: -1 });
recordingSchema.index({ bookingId: 1 });
recordingSchema.index({ autoDeleteAt: 1 });
