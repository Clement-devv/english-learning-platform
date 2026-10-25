// server/schemas/questionJobSchema.js
// One "make questions from these pages" request. Queued by the teacher, run by
// the background worker (utils/questionJobs.js, one at a time per server), and
// finished as a DRAFT question set the teacher reviews — never published by itself.
import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const questionJobSchema = new mongoose.Schema({
  createdBy:   { role: { type: String, enum: ['admin', 'teacher'] }, id: { type: ObjectId } },
  sourceIds:   { type: [{ type: ObjectId, ref: 'QuestionSource' }], default: [] },
  title:       { type: String, required: true, maxlength: 120 },
  level:       { type: String, enum: ['A1', 'A2', 'B1'], default: 'A1' },
  wantedCount: { type: Number, min: 10, max: 30, default: 15 },
  focus:       { type: String, enum: ['grammar', 'vocabulary', 'both'], default: 'both' },
  status:      { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued' },
  attempts:    { type: Number, default: 0 },
  estimate:    { type: Number, default: 0 },
  creditsUsed: { type: Number, default: 0 },
  usage:       { input_tokens: { type: Number, default: 0 }, output_tokens: { type: Number, default: 0 } },
  setId:       { type: ObjectId, ref: 'QuestionSet', default: null },
  made:        { type: Number, default: 0 },   // questions in the draft
  error:       { type: String, default: '' },
  startedAt:   { type: Date, default: null },
  finishedAt:  { type: Date, default: null },
}, { timestamps: true });

questionJobSchema.index({ status: 1, createdAt: 1 });
questionJobSchema.index({ 'createdBy.id': 1, createdAt: -1 });
