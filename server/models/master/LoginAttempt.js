// server/models/master/LoginAttempt.js
// Stored in MASTER DB — tracks failed login attempts globally across all centers.
// Used by rateLimiter.js for account lockout logic.

import mongoose from 'mongoose';

const loginAttemptSchema = new mongoose.Schema({
  identifier:     { type: String, required: true, unique: true, index: true }, // email, username, or IP
  count:          { type: Number, default: 0 },
  firstAttemptAt: { type: Date,   default: Date.now },
  lockUntil:      { type: Date,   default: null },
});

// TTL: auto-delete records after 2 hours of inactivity
loginAttemptSchema.index({ firstAttemptAt: 1 }, { expireAfterSeconds: 2 * 60 * 60 });

export default mongoose.model('LoginAttempt', loginAttemptSchema);
