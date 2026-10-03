import mongoose from 'mongoose';
import { hideSecrets } from './shared/hideSecrets.js';
import { sessionSchema, knownDeviceSchema, alertsSeenDef } from './shared/sessionSchema.js';

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
  knownDevices: { type: [knownDeviceSchema], default: [] },
  alertsSeenAt: alertsSeenDef,
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
  // A requested PIN change (set / change / reset / remove) waiting for the
  // 6-digit code emailed to the admin. Knowing the password alone is not
  // enough to change the PIN — the code proves access to the account email.
  analyticsPinPending: {
    type: new mongoose.Schema({
      action:    { type: String, enum: ["set", "remove"], required: true },
      pinHash:   { type: String, default: null },  // new PIN (for "set"), already hashed
      codeHash:  { type: String, required: true },
      expiresAt: { type: Date,   required: true },
      sentAt:    { type: Date,   required: true },
      attempts:  { type: Number, default: 0 },
    }, { _id: false }),
    default: null,
    select: false,
  },

  // ── Terms & Conditions ───────────────────────────────────────────────────────
  hasAcceptedTerms: { type: Boolean, default: false },
  termsAcceptedAt:  { type: Date,    default: null  },
}, { timestamps: true });

// Forgot-password token lookup
adminSchema.index({ resetPasswordToken: 1 }, { sparse: true });

// Never serialize password hash, session tokens, invite/reset tokens or 2FA secrets
hideSecrets(adminSchema);
