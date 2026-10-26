import mongoose from 'mongoose';

export const classroomSessionSchema = new mongoose.Schema({
  bookingId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  teacherJoinedAt:    Date,
  teacherLeftAt:      Date,
  teacherActiveTime:  { type: Number, default: 0 },
  studentJoinedAt:    Date,
  studentLeftAt:      Date,
  studentActiveTime:  { type: Number, default: 0 },
  bothActiveTime:     { type: Number, default: 0 },
  requiredTime:       { type: Number, required: true },
  classStartedAt:     Date,
  classEndedAt:       Date,
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed', 'ended-early', 'incomplete', 'missed'],
    default: 'waiting',
  },
  videoProvider:   { type: String, enum: ['agora', 'googlemeet', 'zoom', null], default: null },
  // Managed students (no login) can't join the app — the teacher toggles
  // "Student joined" in the classroom. presenceLog is the audit trail of those taps.
  managedAttendance: { type: Boolean, default: false },
  presenceLog: [{
    present: { type: Boolean },
    at:      { type: Date },
    by:      { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  }],
  contentPage:     { type: Number, default: 1   }, // current PDF page teacher is viewing
  contentScale:    { type: Number, default: 1.3 }, // current PDF zoom level
  // Teacher's pen marks on the PDF, one entry per page ("3" → that page's strokes).
  // Kept for every page so going back to a page (or rejoining) still shows them.
  contentAnnotations: {
    type: Map,
    of: new mongoose.Schema({
      data: { type: String }, // JSON array of strokes [{ tool, color, points: [{x, y}] }], points 0–1
      ts:   { type: Number }, // Date.now() at save — the student redraws when it changes
    }, { _id: false }),
    default: undefined,
  },
  extendedTime:    { type: Number, default: 0 }, // total extra seconds added via time extensions
  timeExtensions:  [{
    minutes:    { type: Number },
    extendedBy: { type: String },
    extendedAt: { type: Date },
  }],
  heartbeats: [{
    userRole:   { type: String, enum: ['teacher', 'student'] },
    timestamp:  Date,
    activeTime: Number,
  }],
}, { timestamps: true });

classroomSessionSchema.index({ bookingId: 1 }, { unique: true });
// Active session lookup (heartbeat polling)
classroomSessionSchema.index({ status: 1 });
// Usage reporting by time range
classroomSessionSchema.index({ classStartedAt: -1 });
