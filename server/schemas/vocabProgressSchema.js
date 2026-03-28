import mongoose from 'mongoose';

export const vocabProgressSchema = new mongoose.Schema({
  studentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  listId:         { type: mongoose.Schema.Types.ObjectId, ref: 'VocabList', required: true },
  wordId:         { type: mongoose.Schema.Types.ObjectId, required: true },
  interval:       { type: Number, default: 1 },
  easeFactor:     { type: Number, default: 2.5 },
  repetitions:    { type: Number, default: 0 },
  nextReviewDate: { type: Date, default: Date.now },
  lastReviewedAt: { type: Date },
}, { timestamps: true });

vocabProgressSchema.index({ studentId: 1, listId: 1, wordId: 1 }, { unique: true });
vocabProgressSchema.index({ studentId: 1, nextReviewDate: 1 });
