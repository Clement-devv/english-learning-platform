import mongoose from "mongoose";

// Tracks which timed reminder emails have already been sent
// so the scheduler never fires the same reminder twice.
const reminderLogSchema = new mongoose.Schema({
  type:  { type: String, required: true },   // e.g. 'class_60min', 'homework_30min'
  refId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sentAt: { type: Date, default: Date.now },
}, { timestamps: false });

reminderLogSchema.index({ type: 1, refId: 1 }, { unique: true });

export default mongoose.model("ReminderLog", reminderLogSchema);
