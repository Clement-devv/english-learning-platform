// server/schemas/certificateSchema.js
import mongoose from 'mongoose';

export const certificateSchema = new mongoose.Schema({
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  teacherId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
  type:          { type: String, enum: ['completion', 'manual'], default: 'completion' },
  title:         { type: String, required: true },
  description:   { type: String, default: '' },
  milestone:     { type: Number, default: null },   // class count threshold that triggered this
  classesCompleted: { type: Number, default: 0 },   // snapshot at time of award
  certificateNumber: { type: String, required: true, unique: true },
  issuedAt:      { type: Date, default: Date.now },
  issuedBy:      { type: String, enum: ['system', 'admin'], default: 'system' },
  revokedAt:     { type: Date, default: null },
}, { timestamps: true });

certificateSchema.index({ studentId: 1, issuedAt: -1 });
certificateSchema.index({ studentId: 1, milestone: 1 });
