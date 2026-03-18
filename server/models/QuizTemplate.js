import mongoose from "mongoose";

const { Schema } = mongoose;

const optionSchema = new Schema({
  text: { type: String, required: true, maxlength: 500, trim: true },
}, { _id: false });

const questionSchema = new Schema({
  question:     { type: String, required: true, maxlength: 1000, trim: true },
  options:      { type: [optionSchema], required: true },
  correctIndex: { type: Number, required: true, min: 0 },
  explanation:  { type: String, maxlength: 500, default: "" },
}, { _id: false });

const quizTemplateSchema = new Schema({
  teacherId:    { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
  name:         { type: String, required: true, maxlength: 200, trim: true },
  instructions: { type: String, maxlength: 2000, default: "" },
  timeLimit:    { type: Number, default: 15, min: 1, max: 300 },
  questions:    { type: [questionSchema], required: true },
  usageCount:   { type: Number, default: 0 },
}, { timestamps: true });

quizTemplateSchema.index({ teacherId: 1, createdAt: -1 });

export default mongoose.model("QuizTemplate", quizTemplateSchema);
