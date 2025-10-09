import express from "express";
import Assignment from "../models/Assignment.js";

const router = express.Router();

// Get all assignments
router.get("/", async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .sort({ assignedDate: -1 });
    res.json(assignments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching assignments" });
  }
});

// Create new assignment
router.post("/", async (req, res) => {
  try {
    const { teacherId, studentId } = req.body;

    if (!teacherId || !studentId) {
      return res.status(400).json({ message: "Teacher and Student required" });
    }

    // Check if already assigned
    const exists = await Assignment.findOne({ teacherId, studentId });
    if (exists) {
      return res.status(400).json({ message: "Assignment already exists" });
    }

    const assignment = await Assignment.create({
      teacherId,
      studentId,
      assignedDate: new Date(),
    });

    const populated = await Assignment.findById(assignment._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");

    res.status(201).json({ message: "Assignment created", assignment: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating assignment" });
  }
});

// Delete assignment
router.delete("/:id", async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json({ message: "Assignment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting assignment" });
  }
});

export default router;