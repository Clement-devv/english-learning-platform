// server/models/RecurringPattern.js - RECURRING PATTERN MODEL
import mongoose from "mongoose";

const recurringPatternSchema = new mongoose.Schema({
  // Participants
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
    index: true
  },

  // Class details
  classTitle: {
    type: String,
    required: true,
    trim: true
  },
  topic: {
    type: String,
    trim: true,
    default: ""
  },
  duration: {
    type: Number,
    required: true,
    default: 60, // in minutes
    min: 15,
    max: 180
  },
  notes: {
    type: String,
    trim: true,
    default: ""
  },

  // Recurring pattern configuration
  startTime: {
    type: Date,
    required: true,
    index: true
  },
  frequency: {
    type: String,
    required: true,
    enum: ["daily", "weekly", "biweekly", "monthly"],
    index: true
  },
  occurrences: {
    type: Number,
    required: true,
    min: 1,
    max: 100 // Limit to prevent abuse
  },
  daysOfWeek: {
    type: [Number], // Array of day numbers: 0=Sunday, 1=Monday, ..., 6=Saturday
    validate: {
      validator: function(arr) {
        return arr.every(day => day >= 0 && day <= 6);
      },
      message: "Days of week must be numbers between 0 and 6"
    },
    default: []
  },

  // Status tracking
  status: {
    type: String,
    enum: ["active", "completed", "cancelled"],
    default: "active",
    index: true
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  },

  // Associated bookings
  bookingIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking"
  }],

  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  createdByModel: {
    type: String,
    required: true,
    enum: ["Admin", "Teacher"]
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
recurringPatternSchema.index({ teacherId: 1, status: 1 });
recurringPatternSchema.index({ studentId: 1, status: 1 });
recurringPatternSchema.index({ startTime: 1, frequency: 1 });
recurringPatternSchema.index({ createdAt: -1 });

// Virtual for checking if pattern is complete
recurringPatternSchema.virtual('isComplete').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return true;
  }
  
  // Check if all bookings are completed or in the past
  const now = new Date();
  const lastBookingDate = new Date(this.startTime);
  
  switch (this.frequency) {
    case 'daily':
      lastBookingDate.setDate(lastBookingDate.getDate() + this.occurrences);
      break;
    case 'weekly':
      lastBookingDate.setDate(lastBookingDate.getDate() + (this.occurrences * 7));
      break;
    case 'biweekly':
      lastBookingDate.setDate(lastBookingDate.getDate() + (this.occurrences * 14));
      break;
    case 'monthly':
      lastBookingDate.setMonth(lastBookingDate.getMonth() + this.occurrences);
      break;
  }
  
  return lastBookingDate < now;
});

// Method to get summary statistics
recurringPatternSchema.methods.getStats = async function() {
  const Booking = mongoose.model('Booking');
  
  const bookings = await Booking.find({ recurringPatternId: this._id });
  
  return {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    accepted: bookings.filter(b => b.status === 'accepted').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    rejected: bookings.filter(b => b.status === 'rejected').length
  };
};

// Static method to find active patterns for a teacher
recurringPatternSchema.statics.findActiveByTeacher = function(teacherId) {
  return this.find({
    teacherId,
    status: 'active'
  }).populate('studentId', 'firstName surname email');
};

// Static method to find active patterns for a student
recurringPatternSchema.statics.findActiveByStudent = function(studentId) {
  return this.find({
    studentId,
    status: 'active'
  }).populate('teacherId', 'firstName lastName email');
};

// Pre-save middleware
recurringPatternSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const RecurringPattern = mongoose.model("RecurringPattern", recurringPatternSchema);

export default RecurringPattern;