import mongoose from 'mongoose';

export const classComplaintSchema = new mongoose.Schema({
  bookingId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  teacherId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  studentId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  reason: {
    type: String,
    enum: ['network_issue', 'student_absent', 'student_unprepared', 'emergency', 'insufficient_attendance', 'other'],
    required: true,
  },
  reportedBy:        { type: String, enum: ['network', 'student', 'teacher', 'system', 'other'], required: true },
  description:       { type: String, required: true },
  teacherActiveTime: { type: Number, required: true },
  studentActiveTime: { type: Number, required: true },
  bothActiveTime:    { type: Number, required: true },
  requiredTime:      { type: Number, required: true },
  endedAt:           { type: Date, required: true },
  endedBy:           { type: String, enum: ['teacher', 'student', 'system'], required: true },
  status: {
    type: String, enum: ['pending', 'approved', 'rejected', 'under_review'], default: 'pending',
  },
  adminNotes:  { type: String, default: '' },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  reviewedAt:  Date,
  resolution: {
    type: String,
    enum: ['mark_complete', 'mark_incomplete', 'refund_student', 'no_action'],
    default: null,
  },
}, { timestamps: true });

classComplaintSchema.index({ bookingId: 1 });
classComplaintSchema.index({ teacherId: 1 });
classComplaintSchema.index({ status: 1 });
classComplaintSchema.index({ createdAt: -1 });
