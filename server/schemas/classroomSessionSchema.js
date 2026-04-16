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
  videoProvider:   { type: String, enum: ['agora', 'googlemeet', null], default: null },
  contentPage:     { type: Number, default: 1   }, // current PDF page teacher is viewing
  contentScale:    { type: Number, default: 1.3 }, // current PDF zoom level
  contentAnnotation: {                             // latest annotation canvas for current page
    page: { type: Number },
    data: { type: String }, // base64 PNG data URL
    ts:   { type: Number }, // Date.now() — student compares to skip unchanged frames
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
