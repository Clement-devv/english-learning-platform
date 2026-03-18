import mongoose from "mongoose";

const { Schema } = mongoose;

const quizAttemptSchema = new Schema({
  quizId:     { type: Schema.Types.ObjectId, ref: "Quiz",    required: true },
  studentId:  { type: Schema.Types.ObjectId, ref: "Student", required: true },
  teacherId:  { type: Schema.Types.ObjectId, ref: "Teacher", required: true },

  answers:    [{ type: Number }],   // selectedIndex per question (-1 = skipped)

  score:           { type: Number, min: 0 },   // number correct
  totalQuestions:  { type: Number },
  percentage:      { type: Number, min: 0, max: 100 },

  startedAt:   { type: Date },
  submittedAt: { type: Date, default: Date.now },
  timeTaken:   { type: Number },   // seconds
}, { timestamps: true });

quizAttemptSchema.index({ quizId: 1, studentId: 1 }, { unique: true });
quizAttemptSchema.index({ teacherId: 1 });

export default mongoose.model("QuizAttempt", quizAttemptSchema);
