// server/routes/teacherAssignmentRoutes.js
import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { assignmentSchema } from "../schemas/assignmentSchema.js";

const router = express.Router();
router.use(tenantMiddleware);

const getAssignment = (db) => db.models.Assignment || db.model("Assignment", assignmentSchema);

/**
 * GET /api/teachers/:teacherId/students
 * Get all students assigned to a specific teacher
 */
router.get("/:teacherId/students", verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.params;

    const assignments = await getAssignment(req.db).find({ teacherId })
      .populate({
        path: "studentId",
        select: "firstName surname email noOfClasses active age dateOfBirth rank lastPaymentDate"
      })
      .sort({ assignedDate: -1 });

    const students = assignments.map(assignment => ({
      assignmentId: assignment._id,
      assignedDate: assignment.assignedDate,
      student: assignment.studentId
    }));

    res.json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (err) {
    console.error("Error fetching assigned students:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching assigned students"
    });
  }
});

/**
 * GET /api/teachers/:teacherId/assignments
 * Get all assignments for a specific teacher with full details
 */
router.get("/:teacherId/assignments", verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.params;

    const assignments = await getAssignment(req.db).find({ teacherId })
      .populate("studentId", "firstName surname email noOfClasses active")
      .populate("teacherId", "firstName lastName email continent")
      .sort({ assignedDate: -1 });

    res.json({
      success: true,
      count: assignments.length,
      data: assignments
    });
  } catch (err) {
    console.error("Error fetching assignments:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching assignments"
    });
  }
});

export default router;
