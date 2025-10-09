import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Teacher", 
    required: true 
  },
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Student", 
    required: true 
  },
  assignedDate: { 
    type: Date, 
    default: Date.now 
  },
}, { timestamps: true });

// Prevent duplicate assignments
assignmentSchema.index({ teacherId: 1, studentId: 1 }, { unique: true });

export default mongoose.model("Assignment", assignmentSchema);