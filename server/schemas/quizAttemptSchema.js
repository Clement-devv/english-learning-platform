import mongoose from 'mongoose';

const { Schema } = mongoose;

export const quizAttemptSchema = new Schema({
  quizId:         { type: Schema.Types.ObjectId, ref: 'Quiz',    required: true },
  studentId:      { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  teacherId:      { type: Schema.Types.ObjectId, ref: 'Teacher', required: true },
  answers:        [{ type: Number }],
  score:          { type: Number, min: 0 },
  totalQuestions: { type: Number },
  percentage:     { type: Number, min: 0, max: 100 },
  startedAt:      { type: Date },
  submittedAt:    { type: Date, default: Date.now },
  timeTaken:      { type: Number },
}, { timestamps: true });

quizAttemptSchema.index({ quizId: 1, studentId: 1 }, { unique: true });
quizAttemptSchema.index({ teacherId: 1 });
