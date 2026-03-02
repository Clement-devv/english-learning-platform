// server/models/Teacher.js
import mongoose from "mongoose";

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

const teacherSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, required: true },
  ratePerClass: Number,
  password: String,
  continent: {
    type: String,
    enum: ["Africa", "Europe", "Asia", "Americas", "Oceania"],
    required: true,
  },

  googleMeetLink: {
  type: String,
  default: "",
},

  // ── Invite / account status ──────────────────────────────────────────────
  status: {
    type: String,
    enum: ["pending", "active", "suspended"],
    default: "pending",    // starts pending until teacher sets password
  },
  inviteToken:   String,   // crypto token sent in email
  inviteExpires: Date,     // 48h expiry

  // ── Existing fields ───────────────────────────────────────────────────────
  active: { type: Boolean, default: false }, // false until invite accepted
  lessonsCompleted: { type: Number, default: 0 },
  earned: { type: Number, default: 0 },

  // Password reset
  resetPasswordToken:   String,
  resetPasswordExpires: Date,
  lastPasswordChange:   Date,

  // Session management
  sessions:  [sessionSchema],
  lastLogin: Date,

  // Two-Factor Authentication
  twoFactorEnabled:     { type: Boolean, default: false },
  twoFactorSecret:      String,
  twoFactorBackupCodes: [String],
  twoFactorVerified:    { type: Boolean, default: false },

}, { timestamps: true });

export default mongoose.model("Teacher", teacherSchema);