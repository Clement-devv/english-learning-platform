// server/schemas/gameAssignmentSchema.js
// A published question set given to students to play. The platform has no
// "class" model: an assignment targets group classes (their enrolled students)
// and/or students picked one by one. Named GameAssignment so it doesn't clash
// with Assignment (the teacher ↔ student link).
import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const gameAssignmentSchema = new mongoose.Schema({
  setId:          { type: ObjectId, ref: 'QuestionSet', required: true },
  gameType:       { type: String, enum: ['word-squad'], default: 'word-squad' },
  groupClassIds:  { type: [{ type: ObjectId, ref: 'GroupClass' }], default: [] },
  studentIds:     { type: [{ type: ObjectId, ref: 'Student' }], default: [] },
  chapters:       { type: Number, min: 1, max: 3, default: 3 },
  startsAt:       { type: Date, default: Date.now },
  dueAt:          { type: Date, default: null },
  maxPlaysPerDay: { type: Number, min: 1, max: 20, default: 3 }, // sessions that earn stars, per student per day
  createdBy:      { role: { type: String, enum: ['admin', 'teacher'] }, id: { type: ObjectId } },
  active:         { type: Boolean, default: true },
}, { timestamps: true });

gameAssignmentSchema.index({ studentIds: 1, active: 1 });
gameAssignmentSchema.index({ groupClassIds: 1, active: 1 });
gameAssignmentSchema.index({ 'createdBy.id': 1, createdAt: -1 });
