import mongoose from "mongoose";

const TeacherAvailabilitySchema = new mongoose.Schema({
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
  date:        { type: Date },          // specific date (when isRecurring = false)
  dayOfWeek:   { type: Number, min: 0, max: 6 }, // 0=Sun … 6=Sat (when isRecurring = true)
  startTime:   { type: String, required: true }, // "09:00"
  endTime:     { type: String, required: true }, // "10:00"
  isRecurring: { type: Boolean, default: false },
  note:        { type: String, default: "" },
  timezone:    { type: String, default: "" }, // teacher's timezone when slot was created
}, { timestamps: true });

TeacherAvailabilitySchema.index({ teacherId: 1, date: 1 });
TeacherAvailabilitySchema.index({ teacherId: 1, isRecurring: 1, dayOfWeek: 1 });

export default mongoose.model("TeacherAvailability", TeacherAvailabilitySchema);
