// models/Admin.js
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

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: String,
  lastName: String,
  role: { type: String, default: "admin" },
  active: { type: Boolean, default: true },
  lastPasswordChange: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  // Session management
  sessions: [sessionSchema],
  lastLogin: Date,
}, { 
  timestamps: true 
});

export default mongoose.model("Admin", adminSchema);