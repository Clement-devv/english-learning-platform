// server/schemas/starLedgerSchema.js
// Every star a student earns (Student.stars is the running total). Stars are
// rewards, separate from the paid groupPoints / classCredits. One row per game
// session at most — the unique index stops a finish from paying twice.
import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const starLedgerSchema = new mongoose.Schema({
  studentId: { type: ObjectId, ref: 'Student', required: true },
  amount:    { type: Number, required: true },
  source:    { type: String, enum: ['word-squad', 'adjust'], required: true },
  sessionId: { type: ObjectId, ref: 'GameSession', default: null },
  note:      { type: String, default: '', maxlength: 200 },
}, { timestamps: true });

starLedgerSchema.index({ studentId: 1, createdAt: -1 });
starLedgerSchema.index({ sessionId: 1 }, { unique: true, partialFilterExpression: { sessionId: { $type: 'objectId' } } });
