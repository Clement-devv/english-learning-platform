import mongoose from 'mongoose';

export const paymentTransactionSchema = new mongoose.Schema({
  teacherId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
  studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student', index: true },
  // No default: manual transactions omit it entirely (the unique sparse index indexes null)
  bookingId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  amount:     { type: Number, required: true, min: 0 },
  type: {
    type: String,
    enum: ['class_completion', 'manual_adjustment', 'bonus', 'deduction'],
    default: 'class_completion',
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending',
  },
  description:   { type: String, default: '' },
  classTitle:    { type: String, default: '' },
  studentName:   { type: String, default: '' },
  completedAt:   { type: Date, required: true },
  paidAt:        Date,
  paidBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'paypal', 'cash', 'check', 'other'],
    default: 'bank_transfer',
  },
  notes: { type: String, default: '' },
}, { timestamps: true });

paymentTransactionSchema.index({ bookingId: 1 }, { unique: true, sparse: true });
paymentTransactionSchema.index({ teacherId: 1, status: 1 });
paymentTransactionSchema.index({ completedAt: -1 });
paymentTransactionSchema.index({ paidAt: -1 });

// Deductions are stored as a positive `amount` with type "deduction". Every total
// must subtract them — use these instead of summing `amount` directly.
export const SIGNED_AMOUNT = { $cond: [{ $eq: ['$type', 'deduction'] }, { $multiply: ['$amount', -1] }, '$amount'] };
export const signedAmount = (tx) => (tx?.type === 'deduction' ? -1 : 1) * (Number(tx?.amount) || 0);
