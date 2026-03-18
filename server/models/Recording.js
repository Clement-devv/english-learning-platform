// server/models/Recording.js
import mongoose from "mongoose";

const recordingSchema = new mongoose.Schema({
  bookingId:        { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
  teacherId:        { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  studentId:        { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  title:            { type: String, default: "" },
  filename:         { type: String, required: true },
  duration:         { type: Number, default: 0 },        // seconds
  fileSize:         { type: Number, default: 0 },        // bytes
  mimeType:         { type: String, default: "video/webm" },
  visibleToStudent: { type: Boolean, default: true },    // teacher can hide/show
  autoDeleteAt:     { type: Date },                      // set on upload, auto-purge job reads this
}, { timestamps: true });

recordingSchema.index({ teacherId: 1, createdAt: -1 });
recordingSchema.index({ studentId: 1, createdAt: -1 });
recordingSchema.index({ bookingId: 1 });
recordingSchema.index({ autoDeleteAt: 1 });

export default mongoose.model("Recording", recordingSchema);
