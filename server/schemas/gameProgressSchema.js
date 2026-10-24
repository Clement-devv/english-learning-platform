// server/schemas/gameProgressSchema.js
// A student's progress in one game assignment, so it carries over between
// devices: which chapters are unlocked, the best 3-star rating and best stars
// per chapter, and how many times they played.
import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const gameProgressSchema = new mongoose.Schema({
  studentId:    { type: ObjectId, ref: 'Student', required: true },
  assignmentId: { type: ObjectId, ref: 'GameAssignment', required: true },
  unlocked:     { type: Number, min: 0, max: 2, default: 0 },  // highest chapter index that can be played
  ratings:      { type: [Number], default: [0, 0, 0] },        // best 0–3 stars per chapter
  bestStars:    { type: [Number], default: [0, 0, 0] },
  plays:        { type: Number, default: 0 },
  lastPlayedAt: { type: Date, default: null },
}, { timestamps: true });

gameProgressSchema.index({ studentId: 1, assignmentId: 1 }, { unique: true });
