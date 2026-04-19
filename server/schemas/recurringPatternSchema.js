import mongoose from 'mongoose';

export const recurringPatternSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  classTitle: { type: String, required: true, trim: true },
  topic:      { type: String, trim: true, default: '' },
  duration:   { type: Number, required: true, default: 60, min: 15, max: 180 },
  notes:      { type: String, trim: true, default: '' },
  startTime:  { type: Date, required: true, index: true },
  frequency: {
    type: String, required: true,
    enum: ['daily', 'weekly', 'biweekly', 'monthly'],
    index: true,
  },
  occurrences: { type: Number, required: true, min: 1, max: 100 },
  daysOfWeek: {
    type: [Number],
    validate: { validator: (arr) => arr.every(d => d >= 0 && d <= 6), message: 'Days must be 0-6' },
    default: [],
  },
  status: {
    type: String, enum: ['active', 'completed', 'cancelled'], default: 'active', index: true,
  },
  cancelledAt:        Date,
  cancellationReason: String,
  bookingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
  createdBy:      { type: mongoose.Schema.Types.ObjectId, required: true },
  createdByModel: { type: String, required: true, enum: ['Admin', 'Teacher'] },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now },
}, { timestamps: true });

recurringPatternSchema.index({ teacherId: 1, status: 1 });
recurringPatternSchema.index({ studentId: 1, status: 1 });
recurringPatternSchema.index({ startTime: 1, frequency: 1 });
recurringPatternSchema.index({ createdAt: -1 });

recurringPatternSchema.virtual('isComplete').get(function () {
  if (this.status === 'completed' || this.status === 'cancelled') return true;
  const now = new Date();
  const last = new Date(this.startTime);
  switch (this.frequency) {
    case 'daily':    last.setDate(last.getDate() + this.occurrences); break;
    case 'weekly':   last.setDate(last.getDate() + this.occurrences * 7); break;
    case 'biweekly': last.setDate(last.getDate() + this.occurrences * 14); break;
    case 'monthly':  last.setMonth(last.getMonth() + this.occurrences); break;
  }
  return last < now;
});

// Uses the same per-center connection via this.constructor.db
recurringPatternSchema.methods.getStats = async function () {
  const Booking = this.constructor.db.models.Booking || this.constructor.db.model('Booking');
  const bookings = await Booking.find({ recurringPatternId: this._id });
  return {
    total:     bookings.length,
    pending:   bookings.filter(b => b.status === 'pending').length,
    accepted:  bookings.filter(b => b.status === 'accepted').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    rejected:  bookings.filter(b => b.status === 'rejected').length,
  };
};

recurringPatternSchema.statics.findActiveByTeacher = function (teacherId) {
  return this.find({ teacherId, status: 'active' }).populate('studentId', 'firstName lastName email');
};

recurringPatternSchema.statics.findActiveByStudent = function (studentId) {
  return this.find({ studentId, status: 'active' }).populate('teacherId', 'firstName lastName email');
};

recurringPatternSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});
