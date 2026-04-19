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
  sessions: [sessionSchema],
  lastLogin: Date,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: String,
  twoFactorBackupCodes: [String],
  twoFactorVerified: { type: Boolean, default: false },
}, { timestamps: true });

// Forgot-password token lookup
adminSchema.index({ resetPasswordToken: 1 }, { sparse: true });
