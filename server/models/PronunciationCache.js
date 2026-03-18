import mongoose from "mongoose";

const sentenceSchema = new mongoose.Schema(
  { text: { type: String, required: true }, focus: { type: String, required: true } },
  { _id: false }
);

const pronunciationCacheSchema = new mongoose.Schema({
  difficulty:  { type: String, required: true, enum: ["beginner", "intermediate", "advanced"] },
  sentences:   [sentenceSchema],
  generatedAt: { type: Date, default: Date.now },
});

// One cache document per difficulty level
pronunciationCacheSchema.index({ difficulty: 1 }, { unique: true });

export default mongoose.model("PronunciationCache", pronunciationCacheSchema);
