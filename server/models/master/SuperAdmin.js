import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const sessionSchema = new mongoose.Schema({
  token:      { type: String, required: true },
  loginTime:  { type: Date, default: Date.now },
  isActive:   { type: Boolean, default: true },
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
