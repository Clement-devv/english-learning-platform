import mongoose from 'mongoose';
import { hideSecrets } from './shared/hideSecrets.js';
import { encryptField, decryptField } from '../utils/encryption.js';
import { sessionSchema, knownDeviceSchema, alertsSeenDef } from './shared/sessionSchema.js';
import { generateTeacherCode } from '../utils/teacherCode.js';

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
  zoomLink:       { type: String, default: '' },
  timezone: { type: String, default: '' },
  bio: { type: String, default: '' },
  yearsOfExperience: { type: Number, default: 0 },
  specializations: { type: [String], default: [] },
  certifications: { type: [String], default: [] },
  showScheduleToStudents: { type: Boolean, default: true },
  // Human-friendly ID number (TCH-12345) — names repeat, IDs don't. utils/teacherCode.js
  teacherCode: { type: String, unique: true, sparse: true },
  // Weekly teaching hours, wall-clock in `workingHoursTz` (saved with the hours —
  // NOT `timezone`, which follows whatever device the teacher last used). Free time =
  // these hours − time off − booked classes (server/utils/schedule.js).
  workingHours: {
    type: [{ day: { type: Number, min: 0, max: 6 }, start: String, end: String, _id: false }],
    default: [],
  },
  workingHoursTz: { type: String, default: "" },
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
  resetPasswordCenter: String,
  lastPasswordChange: Date,
  sessions: [sessionSchema],
  knownDevices: { type: [knownDeviceSchema], default: [] },
  alertsSeenAt: alertsSeenDef,
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

  // ── Ring / attention-call preference ────────────────────────────────────────
  ringEnabled: { type: Boolean, default: true },  // false = do not ring this teacher

  // ── Terms & Conditions ───────────────────────────────────────────────────────
  hasAcceptedTerms: { type: Boolean, default: false },
  termsAcceptedAt:  { type: Date,    default: null  },
}, { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } });

// Lookup by status (admin lists active/pending/suspended teachers)
teacherSchema.index({ status: 1 });

// Every new teacher gets an ID number, whichever route creates them
teacherSchema.pre('save', async function () {
  if (this.isNew && !this.teacherCode) this.teacherCode = await generateTeacherCode(this.constructor);
});
// Sub-admin region scope filter (MT-3): find teachers by continent
teacherSchema.index({ continent: 1 });
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

// Never serialize password hash, session tokens, invite/reset tokens or 2FA secrets
hideSecrets(teacherSchema);
