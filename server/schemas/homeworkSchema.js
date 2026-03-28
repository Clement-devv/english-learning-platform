import mongoose from 'mongoose';

const { Schema } = mongoose;

const attachmentSchema = new Schema({
  fileId:       { type: String, required: true },
  originalName: { type: String, required: true },
  size:         { type: Number, required: true },
  mimeType:     { type: String, required: true },
  uploadedAt:   { type: Date, default: Date.now },
}, { _id: false });

export const homeworkSchema = new Schema({
  teacherId:   { type: Schema.Types.ObjectId, ref: 'Teacher', required: true },
  studentId:   { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  title:       { type: String, required: true, maxlength: 200, trim: true },
  description: { type: String, maxlength: 2000, default: '', trim: true },
  dueDate:     { type: Date, required: true },
  attachments: [attachmentSchema],
  status: {
    type: String, enum: ['assigned', 'submitted', 'graded'], default: 'assigned',
  },
  submission: {
    text:        { type: String, maxlength: 5000, default: '' },
    attachments: [attachmentSchema],
    submittedAt: Date,
  },
  grade: {
    score:    { type: Number, min: 0, max: 100, default: null },
    feedback: { type: String, maxlength: 2000, default: '' },
    gradedAt: Date,
    audioFeedback: {
      fileId:   { type: String, default: null },
      duration: { type: Number, default: 0 },
      size:     { type: Number, default: 0 },
      mimeType: { type: String, default: '' },
    },
  },
}, { timestamps: true });

homeworkSchema.index({ teacherId: 1, createdAt: -1 });
homeworkSchema.index({ studentId: 1, status: 1 });
