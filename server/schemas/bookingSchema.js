import mongoose from 'mongoose';
import { shareLinkSchemaDef } from '../utils/shareLink.js';

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
  // Who confirmed the student was present: 'student' (joined the app classroom) or
  // 'teacher' (managed student — teacher tapped "Student joined"). Shown to admins.
  attendanceConfirmedBy: { type: String, enum: ['student', 'teacher', null], default: null },

  // ── Parent check (managed students) ─────────────────────────────────────────
  // When a teacher confirmed a managed student's attendance, the admin can send the
  // parent a link: "Did your child attend?" A "No" raises a dispute on the class.
  // Rules (link lifetime, dispute deadline): utils/parentCheck.js.
  shareLink: shareLinkSchemaDef,
  parentCheck: {
    // no_reply: link expired unanswered — the teacher's confirmation stands
    status:      { type: String, enum: ['waiting', 'confirmed', 'denied', 'no_reply', null], default: null },
    respondedAt: Date,
    // After a "No": admin must settle the dispute by this time, else it auto-resolves for the parent
    disputeDeadline: Date,
    // Every answer change (parent may change while the link is valid and nothing is settled)
    history: [{
      _id: false,
      from: { type: String },
      to:   { type: String },
      at:   { type: Date },
    }],
    comment:     { type: String, maxlength: 500, default: '' },
  },
  adminRejected:      { type: Boolean, default: false },
  adminRejectedAt:    Date,
  adminRejectedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  adminRejectedReason:{ type: String, default: '' },
  recurringPatternId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringPattern', default: null },
  disputeRaised:      { type: Boolean, default: false },
  disputeReason:      { type: String, default: '' },
  // withdrawn: the parent changed their "No" to "Yes" before the admin settled it
  disputeStatus:      { type: String, enum: ['pending', 'resolved_teacher', 'resolved_student', 'withdrawn'], default: null },
  disputedAt:         Date,
  disputedBy:         { type: String, default: '' },
  disputeResolution:  { type: String, default: '' },
  disputeAdminNotes:  { type: String, default: '' },
  disputeResolvedAt:  Date,
  // Every time the class's outcome changed AFTER it was first decided
  // (completed → not completed, or the reverse). The daily admin report lists
  // these under the day they happened, with the original class date.
  outcomeChanges: [{
    _id:    false,
    at:     { type: Date, default: Date.now },
    to:     { type: String, enum: ['completed', 'not_completed'], required: true },
    source: { type: String, enum: ['admin', 'dispute', 'parent', 'system'], default: 'system' },
    reason: { type: String, maxlength: 500, default: '' },
  }],
  acceptedAt:         Date,
  completedAt:        Date,
  cancelledAt:        Date,
  teacherTimezone:    { type: String, default: '' },
  studentTimezone:    { type: String, default: '' },
  isTrial:            { type: Boolean, default: false },

  // ── Teacher-logged class (held outside the app: site down, Meet/Zoom…) ─────
  // Created as status "pending_confirmation"; nothing is charged or paid until an
  // admin approves it. See routes/offlineClassRoutes.js.
  loggedByTeacher:    { type: Boolean, default: false },
  // Real (log-in) students confirm or dispute a teacher-logged class in their
  // dashboard (components/student/ClassConfirmation.jsx). No answer by autoConfirmAt
  // → counts as attended (utils/parentCheck.js sweep).
  teacherConfirmedAt: Date,
  autoConfirmAt:      Date,
  offline: {
    platform: { type: String, enum: ['googlemeet', 'zoom', 'other'] },
    reason:   { type: String, maxlength: 500, default: '' },
    loggedAt: Date,
    approval: {
      status:    { type: String, enum: ['pending', 'processing', 'approved', 'rejected'] },
      decidedAt: Date,
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      note:      { type: String, maxlength: 500, default: '' },
    },
  },
}, { timestamps: true });

bookingSchema.index({ teacherId: 1, status: 1 });
// Admin approval queue for teacher-logged classes
bookingSchema.index({ loggedByTeacher: 1, "offline.approval.status": 1, scheduledTime: -1 });
// Parent-check link lookup (sparse — only teacher-confirmed managed classes)
bookingSchema.index({ 'shareLink.tokenHash': 1 }, { unique: true, sparse: true });
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
