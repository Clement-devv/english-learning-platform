import mongoose from 'mongoose';
import { shareLinkSchemaDef } from '../utils/shareLink.js';

const { Schema } = mongoose;

const optionSchema = new Schema({ text: { type: String, required: true, maxlength: 500, trim: true } }, { _id: false });
const questionSchema = new Schema({
  question:     { type: String, required: true, maxlength: 1000, trim: true },
  options:      { type: [optionSchema], required: true },
  correctIndex: { type: Number, required: true, min: 0 },
  explanation:  { type: String, maxlength: 500, default: '' },
}, { _id: false });

export const quizSchema = new Schema({
  teacherId:    { type: Schema.Types.ObjectId, ref: 'Teacher', required: true },
  studentId:    { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  title:        { type: String, required: true, maxlength: 200, trim: true },
  instructions: { type: String, maxlength: 2000, default: '' },
  timeLimit:    { type: Number, required: true, min: 1, max: 300 },
  dueDate:      { type: Date, required: true },
  questions:    { type: [questionSchema], required: true },
  status: { type: String, enum: ['assigned', 'attempted'], default: 'assigned' },

  // ── Share link (managed students only) — see utils/shareLink.js ───────────
  shareLink: shareLinkSchemaDef,
  // When the student pressed "Start" on the share link. Set once by the server,
  // so reloading the page can't restart the timer.
  linkStartedAt: { type: Date, default: null },
}, { timestamps: true });

quizSchema.index({ teacherId: 1, createdAt: -1 });
quizSchema.index({ studentId: 1, status: 1 });
quizSchema.index({ teacherId: 1, status: 1, createdAt: -1 }); // teacher list filtered by status (paged)
// Share-link lookup (sparse — only managed students' quizzes have a link)
quizSchema.index({ 'shareLink.tokenHash': 1 }, { unique: true, sparse: true });
