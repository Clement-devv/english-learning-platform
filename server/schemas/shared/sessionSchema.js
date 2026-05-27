import mongoose from 'mongoose';

export const sessionSchema = new mongoose.Schema({
  token:        { type: String, required: true },
  deviceInfo:   { browser: String, os: String, device: String },
  ipAddress:    String,
  location:     String,
  loginTime:    { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  isActive:     { type: Boolean, default: true },
  // The signed JWT this session was issued with.  Required for logout-session
  // and logout-all-devices to add the raw token to the in-memory + Redis
  // blacklist so verifyToken rejects it immediately.  Without this field,
  // session.jwtToken was silently dropped by Mongoose strict mode and the
  // blacklist code in /auth/logout-session was effectively a no-op.
  jwtToken:     { type: String, default: null },
});
