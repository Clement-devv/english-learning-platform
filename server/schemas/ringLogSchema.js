import mongoose from "mongoose";

export const ringLogSchema = new mongoose.Schema({
  callerId:       { type: mongoose.Schema.Types.ObjectId, required: true },
  callerRole:     { type: String, required: true },
  callerName:     { type: String, default: "" },
  targetId:       { type: mongoose.Schema.Types.ObjectId, required: true },
  targetRole:     { type: String, required: true },
  targetName:     { type: String, default: "" },
  outcome:        { type: String, enum: ["missed", "declined", "answered"], required: true },
  createdAt:      { type: Date, default: Date.now },
}, { timestamps: false });

ringLogSchema.index({ targetId: 1, outcome: 1, createdAt: -1 });
ringLogSchema.index({ callerId: 1, createdAt: -1 });
