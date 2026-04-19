// server/models/master/AgoraSession.js
// Stored in MASTER DB — one record per Agora class session, keyed by bookingId.
// Only the teacher writes to this model (prevents double-counting).
// Duration is calculated server-side from startedAt → endedAt.

import mongoose from 'mongoose';

const agoraSessionSchema = new mongoose.Schema({
  bookingId:       { type: String, required: true, unique: true, index: true },
  centerId:        { type: String, required: true, index: true },
  centerName:      { type: String, required: true },
  channelName:     { type: String, default: null },
  startedAt:       { type: Date,   required: true },
  endedAt:         { type: Date,   default: null },
  durationSeconds: { type: Number, default: 0 },
  durationMinutes: { type: Number, default: 0 },

  // active   → teacher joined, class in progress
  // completed → teacher left cleanly, endedAt + duration recorded
  // abandoned → session was active for too long (browser crash, etc.)
  status: {
    type:    String,
    enum:    ['active', 'completed', 'abandoned'],
    default: 'active',
    index:   true,
  },

  month: { type: String, required: true, index: true },  // "2026-04"
}, { timestamps: true });

agoraSessionSchema.index({ centerId: 1, month: 1 });
agoraSessionSchema.index({ centerId: 1, startedAt: -1 });

export default mongoose.model('AgoraSession', agoraSessionSchema);
