import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { sessionSchema } from './shared/sessionSchema.js';

export const subAdminSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending',
    },
    inviteToken:   { type: String, default: null },
    inviteExpires: { type: Date, default: null },
    assignmentType: {
      type: String,
      enum: ['region', 'manual'],
      default: 'manual',
    },
    region: {
      type: String,
      enum: ['africa', 'asia', 'europe', 'americas', 'oceania', null],
      default: null,
    },
    assignedTeachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
    permissions: {
      canMarkLessons:  { type: Boolean, default: false },
      canViewPayments: { type: Boolean, default: false },
      canSendMessages: { type: Boolean, default: true  },
      canViewBookings: { type: Boolean, default: true  },
      canViewClasses:  { type: Boolean, default: true  },
    },
    twoFactorEnabled:     { type: Boolean, default: false },
    twoFactorSecret:      { type: String,  default: null  },
    twoFactorBackupCodes: { type: [String], default: []   },
    resetPasswordToken:   { type: String, default: null },
    resetPasswordExpires: { type: Date,   default: null },
    resetPasswordCenter:  { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    lastLogin:  { type: Date, default: null },
    notes:      { type: String, default: '' },
    // Per-device session tracking — required for /logout-session and
    // /logout-all-devices to revoke specific JWTs server-side.  Without this
    // field, clicking "Log out" only wiped browser storage; the JWT remained
    // valid on the server for up to 7 days.
    sessions:   [sessionSchema],
  },
  { timestamps: true }
);

subAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

subAdminSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

subAdminSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});
