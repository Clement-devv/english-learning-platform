// server/models/master/AgoraUsage.js
// Stored in MASTER DB so super admin can query all centers in one place.
// One record per completed Agora session.

import mongoose from 'mongoose';

const agoraUsageSchema = new mongoose.Schema({
  centerId:        { type: String, required: true, index: true },  // center slug
  centerName:      { type: String, required: true },
  channelName:     { type: String, default: null },
  bookingId:       { type: String, default: null },
  durationMinutes: { type: Number, required: true, min: 0 },
  participantCount:{ type: Number, default: 2 },
  sessionDate:     { type: Date,   default: Date.now, index: true },
  month:           { type: String, required: true, index: true },  // "2026-03"
}, { timestamps: true });

// Compound index for monthly per-center queries
agoraUsageSchema.index({ centerId: 1, month: 1 });

export default mongoose.model('AgoraUsage', agoraUsageSchema);
