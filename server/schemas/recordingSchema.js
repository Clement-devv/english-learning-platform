import mongoose from 'mongoose';

export const recordingSchema = new mongoose.Schema({
  bookingId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  teacherId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  studentId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  title:            { type: String, default: '' },
  // 'app' = recorded in our classroom and stored by us.
  // 'external' = teacher recorded elsewhere (Zoom / Google Meet cloud) and
  //              saved the link, so admins can check the class took place.
  source:           { type: String, enum: ['app', 'external'], default: 'app' },
  externalUrl:      { type: String, maxlength: 2000 },
  note:             { type: String, maxlength: 500, default: '' },
  filename:         { type: String, required: function () { return this.source !== 'external'; } },
  duration:         { type: Number, default: 0 },
  fileSize:         { type: Number, default: 0 },
  mimeType:         { type: String, default: 'video/webm' },
  visibleToStudent: { type: Boolean, default: false },
  autoDeleteAt:     { type: Date },
  // Split recording: a class is saved as consecutive parts (e.g. every 8 min)
  // that share one sessionId. Older single-file recordings have no sessionId.
  sessionId:        { type: String },
  partNumber:       { type: Number, default: 1 },
  startOffset:      { type: Number, default: 0 }, // seconds from session start
}, { timestamps: true });

recordingSchema.index({ teacherId: 1, createdAt: -1 });
recordingSchema.index({ studentId: 1, createdAt: -1 });
recordingSchema.index({ bookingId: 1 });
recordingSchema.index({ autoDeleteAt: 1 });
recordingSchema.index({ sessionId: 1, partNumber: 1 });
