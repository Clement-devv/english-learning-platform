// server/schemas/questionSetSchema.js
// A teacher's set of English questions for the Word Squad game (and later other
// games). Gap questions have exactly one "___" in the prompt. Answers never
// leave the server during play — see routes/gameRoutes.js.
import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  type:        { type: String, enum: ['gap', 'choice', 'spelling', 'meaning'], default: 'gap' },
  prompt:      { type: String, required: true, maxlength: 120, trim: true },
  answer:      { type: String, required: true, maxlength: 24, trim: true },
  distractors: { type: [{ type: String, maxlength: 24, trim: true }], default: [] }, // 1–3 wrong choices
  explanation: { type: String, default: '', maxlength: 300 },
  tags:        { type: [String], default: [] },
});

export const questionSetSchema = new mongoose.Schema({
  title:       { type: String, required: true, maxlength: 120, trim: true },
  level:       { type: String, enum: ['A1', 'A2', 'B1'], default: 'A1' },
  createdBy:   { role: { type: String, enum: ['admin', 'teacher'] }, id: { type: mongoose.Schema.Types.ObjectId } },
  status:      { type: String, enum: ['draft', 'published'], default: 'draft' },
  source:      { type: String, enum: ['manual', 'ai_upload'], default: 'manual' },
  sourceFiles: { type: [String], default: [] }, // S3 keys (Phase 3)
  jobId:       { type: mongoose.Schema.Types.ObjectId, default: null },
  questions:   { type: [questionSchema], default: [] },
}, { timestamps: true });

questionSetSchema.index({ 'createdBy.id': 1, status: 1 });
questionSetSchema.index({ status: 1, updatedAt: -1 });
