import mongoose from 'mongoose';
import { sessionSchema } from './shared/sessionSchema.js';

export const studentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  active: { type: Boolean, default: false },
  classCredits: { type: Number, default: 0 },
  lastPaymentDate: Date,
  showTempPassword: { type: Boolean, default: false },
  age: { type: Number },
  dateOfBirth: { type: Date },
  rank: { type: String, default: '' },
  phone: { type: String, default: '' },
  country: { type: String, default: '' },
  timezone: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended'],
    default: 'pending',
  },
  inviteToken: { type: String },
  inviteExpires: { type: Date },
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
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  referralCreditsEarned: { type: Number, default: 0 },
  scheduledDeletionAt: { type: Date, default: null },
  deletionWarningEmailSent: { type: Boolean, default: false },

  // ── Streak tracking ──────────────────────────────────────────────────────
  currentStreak:            { type: Number, default: 0 },   // consecutive active days
  longestStreak:            { type: Number, default: 0 },
  lastActivityDate:         { type: Date,   default: null }, // midnight UTC of last active day
  streakFreezes:            { type: Number, default: 1 },    // 1 free freeze to start
  weeklyClassStreak:        { type: Number, default: 0 },   // consecutive weeks with ≥1 completed class
  longestWeeklyClassStreak: { type: Number, default: 0 },
  lastClassWeek:            { type: String, default: null }, // e.g. "2026-W13"
  activityDates:            { type: [Date], default: [] },   // last 30 active days (for 7-day dots)

  // ── Ring / attention-call preference ────────────────────────────────────────
  ringEnabled: { type: Boolean, default: true },  // false = do not ring this student
}, { timestamps: true });

// Lookup by status (admin lists active/pending/suspended students)
studentSchema.index({ status: 1 });
// Analytics overview: countDocuments({ active: true, classCredits: { $gt: 0 } })
studentSchema.index({ active: 1, classCredits: 1 });
// Forgot-password token lookup (sparse — most docs have no token)
studentSchema.index({ resetPasswordToken: 1 }, { sparse: true });
// Scheduled soft-delete sweep
studentSchema.index({ scheduledDeletionAt: 1 }, { sparse: true });
// Invite setup link lookup
studentSchema.index({ inviteToken: 1 }, { sparse: true });
