import mongoose from 'mongoose';

export const sessionSchema = new mongoose.Schema({
  token:        { type: String, required: true },
  deviceInfo:   { browser: String, os: String, device: String },
  ipAddress:    String,
  location:     String,
  loginTime:    { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  isActive:     { type: Boolean, default: true },
});
