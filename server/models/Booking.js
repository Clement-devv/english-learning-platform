// server/models/Booking.js
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Teacher", 
    required: true 
  },
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Student", 
    required: true 
  },
  classTitle: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    default: ""
  },
  scheduledTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    default: 60
  },
  status: {
    type: String,
    // "missed" = both parties did not attend long enough — no deductions, no earnings
    enum: ["pending", "accepted", "rejected", "completed", "cancelled", "missed"],
    default: "pending"
  },
  notes: {
    type: String,
    default: ""
  },
  createdBy: {
    type: String,
    enum: ["admin", "teacher", "student"],
    default: "admin"
  },
  createdByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "createdByUserModel"
  },
  createdByUserModel: {
    type: String,
    enum: ["Admin", "Teacher", "Student"]
  },
  rejectionReason: {
    type: String,
    default: ""
  },
  // Who/what marked this as completed or missed
  markedBy: {
    type: String,
    enum: ["admin", "classroom", "system", "teacher"],
    default: null
  },
  // When a class is missed: why
  missedReason: {
    type: String,
    default: ""
  },
  // Admin rejection after completion (admin can reject a completed class)
  adminRejected: {
    type: Boolean,
    default: false
  },
  adminRejectedAt: Date,
  adminRejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin"
  },
  adminRejectedReason: {
    type: String,
    default: ""
  },

  recurringPatternId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RecurringPattern",
    default: null
  },

  acceptedAt:   Date,
  completedAt:  Date,
  cancelledAt:  Date,
}, { 
  timestamps: true 
});

// Indexes for faster queries
bookingSchema.index({ teacherId: 1, status: 1 });
bookingSchema.index({ studentId: 1, status: 1 });
bookingSchema.index({ scheduledTime: 1 });
bookingSchema.index({ recurringPatternId: 1 });

export default mongoose.model("Booking", bookingSchema);