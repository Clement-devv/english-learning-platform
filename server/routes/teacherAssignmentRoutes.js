// server/routes/teacherAssignmentRoutes.js
import express from "express";
import { verifyToken, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { assignmentSchema } from "../schemas/assignmentSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { assignStudentId } from "../utils/studentIdGenerator.js";
import logger from "../utils/logger.js";

const router = express.Router();
router.use(tenantMiddleware);

const getAssignment = (db) => db.models.Assignment || db.model("Assignment", assignmentSchema);
const getStudent    = (db) => db.models.Student    || db.model("Student",    studentSchema);
const getTeacher    = (db) => db.models.Teacher    || db.model("Teacher",    teacherSchema);

// Admins may view any teacher; teachers only themselves. Runs after verifyAdminOrTeacher.
const selfOrAdmin = (req, res, next) => {
  if (req.user.role === "teacher" && req.user.id !== req.params.teacherId) {
    return res.status(403).json({ success: false, message: "You can only view your own students" });
  }
  next();
};

/**
 * GET /api/teacher-assignments/my-teachers
 * Returns teachers directly assigned to the current student (any role with a valid token).
 * Used by the student dashboard schedule tab.
 */
router.get("/my-teachers", verifyToken, async (req, res) => {
  try {
    const studentId = req.user?.id || req.user?._id;
    if (!studentId) return res.status(400).json({ message: "No student ID in token" });
    const assignments = await getAssignment(req.db)
      .find({ studentId })
      .populate("teacherId", "firstName lastName photo displayName")
      .lean();
    const teachers = assignments
      .map(a => a.teacherId)
      .filter(Boolean)
      .map(t => ({ _id: t._id, firstName: t.firstName, lastName: t.lastName, photo: t.photo, displayName: t.displayName }));
    res.json({ teachers });
  } catch (err) {
    logger.error("Error fetching student's teachers:", { error: err?.message });
    res.status(500).json({ message: "Error fetching teachers" });
  }
});

/**
 * GET /api/teachers/:teacherId/students
 * Get all students assigned to a specific teacher
 */
router.get("/:teacherId/students", verifyToken, verifyAdminOrTeacher, selfOrAdmin, async (req, res) => {
  try {
    const { teacherId } = req.params;

    getStudent(req.db); // register before populate
    const assignments = await getAssignment(req.db).find({ teacherId })
      .populate({
        path: "studentId",
        select: "firstName lastName email classCredits active age dateOfBirth rank lastPaymentDate studentId isManaged"
      })
      .sort({ assignedDate: -1 });

    // Backfill missing student IDs (lazy migration for existing students).
    // Sequential to avoid concurrent ID collisions within the same request.
    const Student = getStudent(req.db);
    for (const a of assignments) {
      if (a.studentId && !a.studentId.studentId) {
        a.studentId.studentId = await assignStudentId(Student, a.studentId._id);
      }
    }

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
    logger.error("Error fetching assigned students:", { error: err?.message });
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
router.get("/:teacherId/assignments", verifyToken, verifyAdminOrTeacher, selfOrAdmin, async (req, res) => {
  try {
    const { teacherId } = req.params;

    getStudent(req.db); getTeacher(req.db); // register before populate
    const assignments = await getAssignment(req.db).find({ teacherId })
      .populate("studentId", "firstName lastName email classCredits active")
      .populate("teacherId", "firstName lastName email continent")
      .sort({ assignedDate: -1 });

    res.json({
      success: true,
      count: assignments.length,
      data: assignments
    });
  } catch (err) {
    logger.error("Error fetching assignments:", { error: err?.message });
    res.status(500).json({
      success: false,
      message: "Error fetching assignments"
    });
  }
});

export default router;
