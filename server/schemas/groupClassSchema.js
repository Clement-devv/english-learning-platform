// server/schemas/groupClassSchema.js
import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema({
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  enrolledAt:    { type: Date, default: () => new Date() },
  attendance:    { type: String, enum: ['pending', 'attended', 'absent'], default: 'pending' },
  creditCharged: { type: Number, default: 0 }, // older "credits" classes
  pointsCharged: { type: Number, default: 0 }, // "points" classes
  joinedAt:      Date, // first time this student opened the class (GET /:id/join) — the auto-close uses it
}, { _id: false });

export const groupClassSchema = new mongoose.Schema({
  teacherId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  title:         { type: String, required: true, maxlength: 200 },
  description:   { type: String, default: '', maxlength: 2000 },
  level:         { type: String, enum: ['A1','A2','B1','B2','C1','C2','Mixed'], default: 'Mixed' },
  maxSeats:      { type: Number, default: 8, min: 2, max: 20 },
  pricePerSeat:  { type: Number, default: 1, min: 1 },  // credits deducted per student on enroll ("credits" classes)
  // How a seat is paid. New classes use group points; classes created before points
  // existed have no value here and keep using class credits until they finish.
  paymentType:   { type: String, enum: ['credits', 'points'] },
  pointsPerSeat: { type: Number, min: 1, default: 1 },  // points per student ("points" classes)
  // Teacher's pay for this class (fixed), added to their earnings once when the class is
  // completed with at least one student marked attended. Set by the admin.
  teacherFee:    { type: Number, min: 0, default: 0 },
  feePaid: {
    at:     Date,
    amount: Number,
  },
  scheduledTime:  { type: Date, required: true },
  teacherTimezone: { type: String, default: '' },
  duration:       { type: Number, default: 60, min: 15, max: 300 },
  status: {
    type: String,
    // missed = the class time passed and it never happened (utils/groupClassSweep.js) — everyone refunded
    enum: ['open', 'full', 'in-progress', 'completed', 'cancelled', 'missed'],
    default: 'open',
  },
  enrollments:  { type: [enrollmentSchema], default: [] },
  enrollmentMode:  { type: String, enum: ['open', 'invite-only'], default: 'open' },
  invitedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  notes:        { type: String, default: '' },
  tags:         { type: [String], default: [] },
  completedAt:  Date,
  cancelledAt:  Date,
  cancelReason: { type: String, default: '' },
  missedReason: { type: String, default: '' },
  teacherJoinedAt: Date,
  createdBy:    { type: String, enum: ['admin', 'teacher'], default: 'admin' },
  // Where the class happens: the app's own Agora room, or the teacher's Google Meet / Zoom.
  // meetingLink: a link for this class; empty = the teacher's saved profile link.
  // Students get the link only from GET /:id/join once the class has started.
  platform:     { type: String, enum: ['agora', 'googlemeet', 'zoom'], default: 'agora' },
  meetingLink:  { type: String, default: '', maxlength: 500 },
  // Teacher's summary of the class — shared by every enrolled student (routes/classSummaryRoutes.js)
  classSummary: {
    text:      { type: String, maxlength: 3000 },
    updatedAt: Date,
    by:        { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  },
}, { timestamps: true });

groupClassSchema.index({ teacherId: 1, status: 1 });
groupClassSchema.index({ scheduledTime: 1 });
groupClassSchema.index({ status: 1, scheduledTime: 1 });
groupClassSchema.index({ 'enrollments.studentId': 1 });
