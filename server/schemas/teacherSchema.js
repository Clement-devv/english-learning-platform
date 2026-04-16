import mongoose from 'mongoose';
import { encryptField, decryptField } from '../utils/encryption.js';

const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true },
  deviceInfo: {
    browser: String,
    os: String,
    device: String,
  },
  ipAddress: String,
  location: String,
  loginTime: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
});

export const teacherSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, required: true },
  ratePerClass: Number,
  password: String,
  continent: {
    type: String,
    enum: ['Africa', 'Europe', 'Asia', 'Americas', 'Oceania'],
    required: true,
  },
  phone: { type: String, default: '' },
  country: { type: String, default: '' },
  googleMeetLink: { type: String, default: '' },
  timezone: { type: String, default: '' },
  bio: { type: String, default: '' },
  yearsOfExperience: { type: Number, default: 0 },
  specializations: { type: [String], default: [] },
  certifications: { type: [String], default: [] },
  showScheduleToStudents: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended'],
    default: 'pending',
  },
  inviteToken: String,
  inviteExpires: Date,
  active: { type: Boolean, default: false },
  lessonsCompleted: { type: Number, default: 0 },
  earned: { type: Number, default: 0 },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastPasswordChange: Date,
  sessions: [sessionSchema],
  lastLogin: Date,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: String,
  twoFactorBackupCodes: [String],
  twoFactorVerified: { type: Boolean, default: false },
  pushSubscription: { type: Object, default: null },
  scheduledDeletionAt: { type: Date, default: null },
  deletionWarningEmailSent: { type: Boolean, default: false },
  photo:       { type: String, default: "" },
  displayName: { type: String, default: "" },
  bankName:      { type: String, default: "", set: encryptField, get: decryptField },
  accountNumber: { type: String, default: "", set: encryptField, get: decryptField },
  accountName:   { type: String, default: "", set: encryptField, get: decryptField },
}, { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } });

// Lookup by status (admin lists active/pending/suspended teachers)
teacherSchema.index({ status: 1 });
// Analytics overview: countDocuments({ active: true })
teacherSchema.index({ active: 1 });
// Analytics overview: $match { earned: { $gt: 0 } } for pending payments
teacherSchema.index({ earned: 1 });
// Forgot-password token lookup
teacherSchema.index({ resetPasswordToken: 1 }, { sparse: true });
// Scheduled soft-delete sweep
teacherSchema.index({ scheduledDeletionAt: 1 }, { sparse: true });
// Invite setup link lookup
teacherSchema.index({ inviteToken: 1 }, { sparse: true });
