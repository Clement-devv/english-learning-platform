// server/schemas/gameSessionSchema.js
// One chapter played by one student. The gates keep their right answers here
// (select: false) — the client only ever gets prompts and choices, and asks the
// server whether a choice was right.
import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const gateSchema = new mongoose.Schema({
  gateId:     { type: String, required: true },
  questionId: { type: ObjectId },
  prompt:     { type: String, required: true },
  choices:    { type: [String], default: [] },
  answer:     { type: String, required: true },
  reward:     { type: Object, default: null },
  choice:     { type: String, default: null },
  correct:    { type: Boolean, default: null },
  answeredAt: { type: Date, default: null },
}, { _id: false });

export const gameSessionSchema = new mongoose.Schema({
  studentId:      { type: ObjectId, ref: 'Student', required: true },
  assignmentId:   { type: ObjectId, ref: 'GameAssignment', required: true },
  setId:          { type: ObjectId, ref: 'QuestionSet', required: true },
  gameType:       { type: String, default: 'word-squad' },
  chapter:        { type: Number, min: 0, max: 2, required: true },
  seed:           { type: Number, required: true },
  gates:          { type: [gateSchema], select: false },
  revive:         { type: gateSchema, select: false },
  status:         { type: String, enum: ['active', 'finished'], default: 'active' },
  countsForStars: { type: Boolean, default: true },
  lastAnswerAt:   { type: Date, default: null },
  expiresAt:      { type: Date, required: true },
  finishedAt:     { type: Date, default: null },
  // what the game reported at the end (only a capped bonus comes from these)
  stats:          { type: Object, default: null },
  right:          { type: Number, default: 0 },
  answered:       { type: Number, default: 0 },
  starsAwarded:   { type: Number, default: 0 },
  rating:         { type: Number, default: 0 },
}, { timestamps: true });

gameSessionSchema.index({ studentId: 1, createdAt: -1 });
gameSessionSchema.index({ assignmentId: 1, studentId: 1, createdAt: -1 });
