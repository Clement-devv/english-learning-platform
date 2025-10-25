// models/Student.js
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

const studentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  surname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  active: { type: Boolean, default: true },
  noOfClasses: { type: Number, default: 0 },
  lastPaymentDate: Date,
  showTempPassword: { type: Boolean, default: false },
  age: { type: Number },
  
  // Password reset fields
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastPasswordChange: Date,
  
  // Session management
  sessions: [sessionSchema],
  lastLogin: Date,
}, { 
  timestamps: true 
});

export default mongoose.model("Student", studentSchema);