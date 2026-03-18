import mongoose from "mongoose";

/**
 * Stores each chat message.
 * role: "user" | "assistant"
 * Only the last 20 messages are sent to Claude per request (cost control).
 * Full history is stored so students can scroll back.
 */
const conversationMessageSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  role:      { type: String, enum: ["user", "assistant"], required: true },
  content:   { type: String, required: true, maxlength: 4000 },
}, { timestamps: true });

export default mongoose.model("ConversationMessage", conversationMessageSchema);
