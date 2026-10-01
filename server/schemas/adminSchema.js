import mongoose from 'mongoose';
import { sessionSchema } from './shared/sessionSchema.js';

export const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: String,
  lastName: String,
  role: { type: String, default: 'admin' },
  active: { type: Boolean, default: true },
  lastPasswordChange: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  resetPasswordCenter: String,
  sessions: [sessionSchema],
  lastLogin: Date,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: String,
  twoFactorBackupCodes: [String],
  twoFactorVerified: { type: Boolean, default: false },
  pushSubscription: { type: Object, default: null },
  ringEnabled: { type: Boolean, default: true },

  // ── Analytics PIN ────────────────────────────────────────────────────────────
  // Optional 4-digit PIN that gates revenue/analytics data. analyticsPinSetAt
  // is embedded in unlock tokens so changing/removing the PIN revokes them.
  analyticsPinHash:           { type: String, default: null, select: false },
  analyticsPinSetAt:          { type: Date,   default: null },
  analyticsPinFailedAttempts: { type: Number, default: 0 },
  analyticsPinLockedUntil:    { type: Date,   default: null },

  // ── Terms & Conditions ───────────────────────────────────────────────────────
  hasAcceptedTerms: { type: Boolean, default: false },
  termsAcceptedAt:  { type: Date,    default: null  },
}, { timestamps: true });

// Forgot-password token lookup
adminSchema.index({ resetPasswordToken: 1 }, { sparse: true });
