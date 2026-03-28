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
  videoProvider: { type: String, enum: ['agora', 'googlemeet', null], default: null },
  heartbeats: [{
    userRole:   { type: String, enum: ['teacher', 'student'] },
    timestamp:  Date,
    activeTime: Number,
  }],
}, { timestamps: true });

classroomSessionSchema.index({ bookingId: 1 }, { unique: true });
