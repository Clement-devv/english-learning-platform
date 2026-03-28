import mongoose from 'mongoose';

export const conversationMessageSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  role:      { type: String, enum: ['user', 'assistant'], required: true },
  content:   { type: String, required: true, maxlength: 4000 },
}, { timestamps: true });
