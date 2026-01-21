// server/models/PaymentTransaction.js - Track all payment transactions
import mongoose from "mongoose";

const paymentTransactionSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
    index: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ["class_completion", "manual_adjustment", "bonus", "deduction"],
    default: "class_completion"
  },
  status: {
    type: String,
    enum: ["pending", "paid", "cancelled"],
    default: "pending"
  },
  description: {
    type: String,
    default: ""
  },
  classTitle: {
    type: String,
    default: ""
  },
  studentName: {
    type: String,
    default: ""
  },
  completedAt: {
    type: Date,
    required: true
  },
  paidAt: {
    type: Date
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin"
  },
  paymentMethod: {
    type: String,
    enum: ["bank_transfer", "paypal", "cash", "check", "other"],
    default: "bank_transfer"
  },
  notes: {
    type: String,
    default: ""
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
paymentTransactionSchema.index({ teacherId: 1, status: 1 });
paymentTransactionSchema.index({ completedAt: -1 });
paymentTransactionSchema.index({ paidAt: -1 });

export default mongoose.model("PaymentTransaction", paymentTransactionSchema);