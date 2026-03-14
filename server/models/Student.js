// server/models/Student.js - UPDATED WITH INVITE FIELDS
import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  token:       { type: String, required: true },
  deviceInfo:  { browser: String, os: String, device: String },
  ipAddress:   String,
  location:    String,
  loginTime:   { type: Date, default: Date.now },
  lastActivity:{ type: Date, default: Date.now },
  isActive:    { type: Boolean, default: true },
});

const studentSchema = new mongoose.Schema({
  firstName:   { type: String, required: true },
  surname:     { type: String, required: true },
  email:       { type: String, required: true, unique: true },
  password:    { type: String, required: false },   // ← not required until setup
  active:      { type: Boolean, default: false },   // ← false until invite accepted
  noOfClasses: { type: Number, default: 0 },
  lastPaymentDate: Date,
  showTempPassword:{ type: Boolean, default: false },
  age:         { type: Number },
  dateOfBirth: { type: Date },
  rank:        { type: String, default: "" },

  // ── Invite flow (same pattern as Teacher) ──────────────────────────────────
  status: {
    type:    String,
    enum:    ["pending", "active", "suspended"],
    default: "pending",                             // pending until setup complete
  },
  inviteToken:   { type: String },
  inviteExpires: { type: Date },

  // ── Password reset ─────────────────────────────────────────────────────────
  resetPasswordToken:   String,
  resetPasswordExpires: Date,
  lastPasswordChange:   Date,

  // ── Session management ─────────────────────────────────────────────────────
  sessions:  [sessionSchema],
  lastLogin: Date,

  // ── Two-Factor Authentication ──────────────────────────────────────────────
  twoFactorEnabled:     { type: Boolean, default: false },
  twoFactorSecret:      String,
  twoFactorBackupCodes: [String],
  twoFactorVerified:    { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("Student", studentSchema);