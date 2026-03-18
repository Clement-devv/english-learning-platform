// server/models/VocabProgress.js
// Stores the SM-2 spaced repetition state per student per word
import mongoose from "mongoose";

const vocabProgressSchema = new mongoose.Schema({
  studentId:      { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  listId:         { type: mongoose.Schema.Types.ObjectId, ref: "VocabList", required: true },
  wordId:         { type: mongoose.Schema.Types.ObjectId, required: true }, // word._id from VocabList
  // SM-2 fields
  interval:       { type: Number, default: 1 },    // days until next review
  easeFactor:     { type: Number, default: 2.5 },  // SM-2 ease factor
  repetitions:    { type: Number, default: 0 },    // correct reviews in a row
  nextReviewDate: { type: Date, default: Date.now },
  lastReviewedAt: { type: Date },
}, { timestamps: true });

vocabProgressSchema.index({ studentId: 1, listId: 1, wordId: 1 }, { unique: true });
vocabProgressSchema.index({ studentId: 1, nextReviewDate: 1 });

export default mongoose.model("VocabProgress", vocabProgressSchema);
