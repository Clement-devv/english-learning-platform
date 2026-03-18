// server/models/Review.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const reviewSchema = new Schema({
  bookingId:  { type: Schema.Types.ObjectId, ref: "Booking",  required: true, unique: true },
  studentId:  { type: Schema.Types.ObjectId, ref: "Student",  required: true },
  teacherId:  { type: Schema.Types.ObjectId, ref: "Teacher",  required: true },
  rating:     { type: Number, required: true, min: 1, max: 5 },
  comment:    { type: String, maxlength: 1000, default: "", trim: true },

  // Admin moderation
  flagged:    { type: Boolean, default: false },
  flagReason: { type: String, default: "" },
}, { timestamps: true });

reviewSchema.index({ teacherId: 1, createdAt: -1 });
reviewSchema.index({ studentId: 1, createdAt: -1 });

export default mongoose.model("Review", reviewSchema);
