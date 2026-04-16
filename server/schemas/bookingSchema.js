import mongoose from 'mongoose';

export const bookingSchema = new mongoose.Schema({
  teacherId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  studentId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  classTitle:         { type: String, required: true },
  topic:              { type: String, default: '' },
  scheduledTime:      { type: Date, required: true },
  duration:           { type: Number, default: 60 },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled', 'missed', 'pending_confirmation'],
    default: 'pending',
  },
  notes:              { type: String, default: '' },
  createdBy:          { type: String, enum: ['admin', 'teacher', 'student'], default: 'admin' },
  createdByUserId:    { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByUserModel' },
  createdByUserModel: { type: String, enum: ['Admin', 'Teacher', 'Student'] },
  rejectionReason:    { type: String, default: '' },
  markedBy:           { type: String, enum: ['admin', 'classroom', 'system', 'teacher'], default: null },
  missedReason:       { type: String, default: '' },
  adminRejected:      { type: Boolean, default: false },
  adminRejectedAt:    Date,
  adminRejectedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  adminRejectedReason:{ type: String, default: '' },
  recurringPatternId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringPattern', default: null },
  disputeRaised:      { type: Boolean, default: false },
  disputeReason:      { type: String, default: '' },
  disputeStatus:      { type: String, enum: ['pending', 'resolved_teacher', 'resolved_student'], default: null },
  disputedAt:         Date,
  disputedBy:         { type: String, default: '' },
  disputeResolution:  { type: String, default: '' },
  disputeAdminNotes:  { type: String, default: '' },
  disputeResolvedAt:  Date,
  acceptedAt:         Date,
  completedAt:        Date,
  cancelledAt:        Date,
  teacherTimezone:    { type: String, default: '' },
  studentTimezone:    { type: String, default: '' },
}, { timestamps: true });

bookingSchema.index({ teacherId: 1, status: 1 });
bookingSchema.index({ studentId: 1, status: 1 });
bookingSchema.index({ scheduledTime: 1 });
bookingSchema.index({ recurringPatternId: 1 });
// Compound for upcoming-class queries (teacher dashboard: upcoming accepted classes)
bookingSchema.index({ teacherId: 1, scheduledTime: 1, status: 1 });
bookingSchema.index({ studentId: 1, scheduledTime: 1, status: 1 });
// Dispute panel: open disputes
bookingSchema.index({ disputeRaised: 1, disputeStatus: 1 }, { sparse: true });
// Admin-rejected sweep
bookingSchema.index({ adminRejected: 1 }, { sparse: true });
// Reminder scheduler queries upcoming bookings by time
bookingSchema.index({ status: 1, scheduledTime: 1 });
