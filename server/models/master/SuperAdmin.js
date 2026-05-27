import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const sessionSchema = new mongoose.Schema({
  token:      { type: String, required: true },
  loginTime:  { type: Date, default: Date.now },
  isActive:   { type: Boolean, default: true },
  // The signed JWT issued for this session — needed by the logout endpoints
  // so the raw token can be added to the blacklist that verifySuperAdmin
  // checks on every request.
  jwtToken:   { type: String, default: null },
  deviceInfo: { browser: String, os: String, device: String },
  ipAddress:  String,
});

const superAdminSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true },
  role:      { type: String, default: 'superadmin' },
  active:    { type: Boolean, default: true },
  sessions:  [sessionSchema],
  lastLogin: Date,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret:  String,
}, { timestamps: true });

export default mongoose.model('SuperAdmin', superAdminSchema);
