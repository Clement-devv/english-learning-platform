import mongoose from 'mongoose';

export const teacherAvailabilitySchema = new mongoose.Schema({
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  date:        { type: Date },
  dayOfWeek:   { type: Number, min: 0, max: 6 },
  startTime:   { type: String, required: true },
  endTime:     { type: String, required: true },
  isRecurring: { type: Boolean, default: false },
  note:        { type: String, default: '' },
  timezone:    { type: String, default: '' },
}, { timestamps: true });

teacherAvailabilitySchema.index({ teacherId: 1, date: 1 });
teacherAvailabilitySchema.index({ teacherId: 1, isRecurring: 1, dayOfWeek: 1 });
