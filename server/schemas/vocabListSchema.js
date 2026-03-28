import mongoose from 'mongoose';

const wordSchema = new mongoose.Schema({
  word:       { type: String, required: true, trim: true },
  definition: { type: String, required: true, trim: true },
  example:    { type: String, default: '', trim: true },
}, { _id: true });

const assignedToSchema = new mongoose.Schema({
  studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  assignedAt: { type: Date, default: Date.now },
  dueDate:    { type: Date },
}, { _id: false });

export const vocabListSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  words:       [wordSchema],
  assignedTo:  [assignedToSchema],
}, { timestamps: true });
