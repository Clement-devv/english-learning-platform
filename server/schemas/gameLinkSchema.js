// server/schemas/gameLinkSchema.js
// A personal Word Squad link for one managed (no-login) student and one game
// assignment. Same share-link rules as homework and quizzes (utils/shareLink.js):
// the student types their name and their teacher's name to open it. The link
// works for as long as the assignment does (stopped or past due → it ends).
import mongoose from 'mongoose';
import { shareLinkSchemaDef } from '../utils/shareLink.js';

const { ObjectId } = mongoose.Schema.Types;

export const gameLinkSchema = new mongoose.Schema({
  assignmentId: { type: ObjectId, ref: 'GameAssignment', required: true },
  studentId:    { type: ObjectId, ref: 'Student', required: true },
  teacherId:    { type: ObjectId, ref: 'Teacher', required: true }, // the name the student confirms
  shareLink:    shareLinkSchemaDef,
}, { timestamps: true });

gameLinkSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
gameLinkSchema.index({ 'shareLink.tokenHash': 1 }, { unique: true, sparse: true });
