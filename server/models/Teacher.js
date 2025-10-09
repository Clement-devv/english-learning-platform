// models/Teacher.js
import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, required: true },
  ratePerClass: Number,
  password: String,
  active: { type: Boolean, default: true },
  lessonsCompleted: { type: Number, default: 0 },
  earned: { type: Number, default: 0 },
  continent: {
    type: String,
    enum: ["Africa", "Europe", "Asia"],
    required: true,
  },
  
  // Password reset fields
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  // Track password changes
  lastPasswordChange: Date,
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
});

export default mongoose.model("Teacher", teacherSchema);