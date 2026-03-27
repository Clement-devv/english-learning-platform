import mongoose from "mongoose";

const loginAttemptSchema = new mongoose.Schema({
  identifier: { type: String, required: true, unique: true, index: true },
  count:      { type: Number, default: 0 },
  lockUntil:  { type: Date,   default: null },
  firstAttemptAt: { type: Date, default: Date.now },
});

// TTL index: MongoDB automatically removes records 2 hours after firstAttemptAt
loginAttemptSchema.index({ firstAttemptAt: 1 }, { expireAfterSeconds: 7200 });

export default mongoose.model("LoginAttempt", loginAttemptSchema);
