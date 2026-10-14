// server/schemas/groupPointsLedgerSchema.js
// Every change to a student's group-class points (Student.groupPoints): sold by the
// admin, spent on a group class seat, refunded. Points are only for group classes —
// separate from classCredits (one-to-one classes). See utils/groupPoints.js.
import mongoose from 'mongoose';

export const groupPointsLedgerSchema = new mongoose.Schema({
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  kind:         { type: String, enum: ['purchase', 'spend', 'refund', 'adjust'], required: true },
  points:       { type: Number, required: true },        // + added, − taken
  balanceAfter: { type: Number, required: true },
  // purchase: what the student paid the center
  amountPaid:   { type: Number, min: 0 },
  currency:     { type: String, default: '' },
  method:       { type: String, enum: ['cash', 'bank_transfer', 'card', 'online', 'other'] },
  // spend / refund: which class
  groupClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupClass' },
  classTitle:   { type: String, default: '' },
  note:         { type: String, default: '', maxlength: 500 },
  by:           { role: String, id: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

groupPointsLedgerSchema.index({ studentId: 1, createdAt: -1 });
