import mongoose from 'mongoose';

const { Schema } = mongoose;

export const referralSchema = new Schema({
  referrerId:         { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  referrerCode:       { type: String, required: true },
  referredFirstName:  { type: String, required: true },
  referredLastName:   { type: String, required: true },
  referredEmail:      { type: String, required: true, lowercase: true, trim: true },
  referredStudentId:  { type: Schema.Types.ObjectId, ref: 'Student', default: null },
  status: {
    type: String,
    enum: ['pending', 'invited', 'active', 'rejected'],
    default: 'pending',
  },
  creditAwarded: { type: Boolean, default: false },
  creditedAt:    { type: Date, default: null },
}, { timestamps: true });

referralSchema.index({ referrerId: 1 });
referralSchema.index({ referredEmail: 1 });
