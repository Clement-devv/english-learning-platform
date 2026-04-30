// server/schemas/groupClassSchema.js
import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema({
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  enrolledAt:    { type: Date, default: () => new Date() },
  attendance:    { type: String, enum: ['pending', 'attended', 'absent'], default: 'pending' },
  creditCharged: { type: Number, default: 0 },
}, { _id: false });

export const groupClassSchema = new mongoose.Schema({
  teacherId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  title:         { type: String, required: true, maxlength: 200 },
  description:   { type: String, default: '', maxlength: 2000 },
  level:         { type: String, enum: ['A1','A2','B1','B2','C1','C2','Mixed'], default: 'Mixed' },
  maxSeats:      { type: Number, default: 8, min: 2, max: 20 },
  pricePerSeat:  { type: Number, default: 1, min: 1 },  // credits deducted per student on enroll
  scheduledTime:  { type: Date, required: true },
  teacherTimezone: { type: String, default: '' },
  duration:       { type: Number, default: 60, min: 15, max: 300 },
  status: {
    type: String,
    enum: ['open', 'full', 'in-progress', 'completed', 'cancelled'],
    default: 'open',
  },
  enrollments:  { type: [enrollmentSchema], default: [] },
  notes:        { type: String, default: '' },
  tags:         { type: [String], default: [] },
  completedAt:  Date,
  cancelledAt:  Date,
  cancelReason: { type: String, default: '' },
  createdBy:    { type: String, enum: ['admin', 'teacher'], default: 'admin' },
}, { timestamps: true });

groupClassSchema.index({ teacherId: 1, status: 1 });
groupClassSchema.index({ scheduledTime: 1 });
groupClassSchema.index({ status: 1, scheduledTime: 1 });
groupClassSchema.index({ 'enrollments.studentId': 1 });
