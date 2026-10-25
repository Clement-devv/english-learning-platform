// server/schemas/questionSourceSchema.js
// A book page (photo) or PDF a teacher uploaded for AI to make Word Squad
// questions from. Stored privately (S3 key centers/<slug>/question-sources/…,
// or on local disk when S3 isn't set up). The teacher can delete it any time;
// otherwise it's deleted automatically at expiresAt (30 days).
import mongoose from 'mongoose';

export const SOURCE_TTL_DAYS = 30;

export const questionSourceSchema = new mongoose.Schema({
  createdBy: { role: { type: String, enum: ['admin', 'teacher'] }, id: { type: mongoose.Schema.Types.ObjectId } },
  name:      { type: String, required: true, maxlength: 140 },
  mime:      { type: String, enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], required: true },
  size:      { type: Number, required: true, min: 1 },
  key:       { type: String, required: true },
  storage:   { type: String, enum: ['s3', 'local'], required: true },
  status:    { type: String, enum: ['pending', 'ready'], default: 'pending' }, // pending until the upload finishes
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

questionSourceSchema.index({ 'createdBy.id': 1, createdAt: -1 });
questionSourceSchema.index({ expiresAt: 1 });
