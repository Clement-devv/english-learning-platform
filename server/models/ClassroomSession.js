// server/models/ClassroomSession.js - Track classroom attendance
import mongoose from "mongoose";

const classroomSessionSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true
    // unique: true - Removed, will be defined in schema.index() below
  },
  teacherJoinedAt: Date,
  teacherLeftAt: Date,
  teacherActiveTime: {
    type: Number, // in seconds
    default: 0
  },
  studentJoinedAt: Date,
  studentLeftAt: Date,
  studentActiveTime: {
    type: Number, // in seconds
    default: 0
  },
  bothActiveTime: {
    type: Number, // in seconds - time when BOTH were present
    default: 0
  },
  requiredTime: {
    type: Number, // in seconds - minimum required for completion
    required: true
  },
  classStartedAt: Date, // When both joined
  classEndedAt: Date,
  status: {
    type: String,
    enum: ["waiting", "active", "completed", "ended-early", "incomplete"],
    default: "waiting"
  },
  heartbeats: [{
    userRole: {
      type: String,
      enum: ["teacher", "student"]
    },
    timestamp: Date,
    activeTime: Number
  }]
}, {
  timestamps: true
});

// Index for faster queries and unique constraint
classroomSessionSchema.index({ bookingId: 1 }, { unique: true });

export default mongoose.model("ClassroomSession", classroomSessionSchema);