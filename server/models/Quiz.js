import mongoose from "mongoose";

const { Schema } = mongoose;

const optionSchema = new Schema({
  text: { type: String, required: true, maxlength: 500, trim: true },
}, { _id: false });

const questionSchema = new Schema({
  question:     { type: String, required: true, maxlength: 1000, trim: true },
  options:      { type: [optionSchema], required: true },   // 2–4 options
  correctIndex: { type: Number, required: true, min: 0 },   // index into options[]
  explanation:  { type: String, maxlength: 500, default: "" },
}, { _id: false });

const quizSchema = new Schema({
  teacherId:    { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
  studentId:    { type: Schema.Types.ObjectId, ref: "Student", required: true },

  title:        { type: String, required: true, maxlength: 200, trim: true },
  instructions: { type: String, maxlength: 2000, default: "" },

  timeLimit:    { type: Number, required: true, min: 1, max: 300 }, // minutes
  dueDate:      { type: Date, required: true },

  questions:    { type: [questionSchema], required: true },

  status: {
    type:    String,
    enum:    ["assigned", "attempted"],
    default: "assigned",
  },
}, { timestamps: true });

quizSchema.index({ teacherId: 1, createdAt: -1 });
quizSchema.index({ studentId: 1, status: 1 });

export default mongoose.model("Quiz", quizSchema);
