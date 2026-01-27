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
    enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
    default: "pending"
  },
  pendingConfirmation: {
      type: Boolean,
      default: false,
    },
    
    teacherConfirmedAt: {
      type: Date,
    },
    
    studentConfirmedAt: {
      type: Date,
    },
    
    autoConfirmAt: {
      type: Date, // When to auto-confirm (24 hours after teacher confirms)
    },
    
    disputed: {
      type: Boolean,
      default: false,
    },
    
    disputeReason: {
      type: String,
    },
    
    disputedAt: {
      type: Date,
    },
    
    disputedBy: {
      type: String,
      enum: ["teacher", "student"],
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
  // Add these new fields to your Booking schema
disputeResolution: {
  type: String,
  enum: ['approved_teacher', 'approved_student'],
},
disputeResolvedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Admin'
},
disputeResolvedAt: {
  type: Date
},
adminNotes: {
  type: String,
  default: ''
},
  completedAt: Date,
  cancelledAt: Date
}, { 
  timestamps: true 
});

// Index for faster queries
bookingSchema.index({ teacherId: 1, status: 1 });
bookingSchema.index({ studentId: 1, status: 1 });
bookingSchema.index({ scheduledTime: 1 });

export default mongoose.model("Booking", bookingSchema);