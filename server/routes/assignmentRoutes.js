// server/routes/assignmentRoutes.js
import express from "express";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { assignmentSchema } from "../schemas/assignmentSchema.js";
import { groupChatSchema }  from "../schemas/groupChatSchema.js";
import { teacherSchema }    from "../schemas/teacherSchema.js";
import { studentSchema }    from "../schemas/studentSchema.js";
import { parsePagination }  from "../utils/pagination.js";
import logger from "../utils/logger.js";

const router = express.Router();
router.use(tenantMiddleware);

const getAssignment = (db) => db.models.Assignment || db.model("Assignment", assignmentSchema);
const getGroupChat  = (db) => db.models.GroupChat  || db.model("GroupChat",  groupChatSchema);
const getTeacher    = (db) => db.models.Teacher    || db.model("Teacher",    teacherSchema);
const getStudent    = (db) => db.models.Student    || db.model("Student",    studentSchema);

// Get all assignments
router.get("/", async (req, res) => {
  try {
    const { limit, skip } = parsePagination(req.query);
    const assignments = await getAssignment(req.db)
      .find()
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .sort({ assignedDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.json(assignments);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: "Error fetching assignments" });
  }
});

// Create new assignment
router.post("/", async (req, res) => {
  try {
    const { teacherId, studentId } = req.body;

    if (!teacherId || !studentId)
      return res.status(400).json({ message: "Teacher and Student required" });

    const Assignment = getAssignment(req.db);
    const GroupChat  = getGroupChat(req.db);

    const exists = await Assignment.findOne({ teacherId, studentId });
    if (exists) return res.status(400).json({ message: "Assignment already exists" });

    const assignment = await Assignment.create({
      teacherId,
      studentId,
      assignedDate: new Date(),
    });

    const populated = await Assignment.findById(assignment._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");

    // Auto-create group chat
    try {
      const teacher = await getTeacher(req.db).findById(teacherId);
      const student = await getStudent(req.db).findById(studentId);

      if (!teacher || !student) {
        logger.error("Teacher or Student not found for chat creation");
        return res.status(201).json({
          message: "Assignment created but chat creation failed",
          assignment: populated,
        });
      }

      const chatName = `${teacher.firstName} ${teacher.lastName} - ${student.firstName} ${student.surname}`;
      const existingChat = await GroupChat.findOne({ assignmentId: assignment._id });

      if (!existingChat) {
        await GroupChat.create({
          assignmentId: assignment._id,
          teacherId,
          studentId,
          chatName,
          messages: [{
            senderId:    req.user?.id || teacherId,
            senderModel: req.user?.role === "admin" ? "Admin" : "Teacher",
            senderName:  "System",
            senderRole:  "admin",
            message:     `Chat created for ${chatName}. Welcome to your learning journey!`,
            messageType: "system",
            createdAt:   new Date(),
          }],
          isActive:       true,
          lastActivityAt: new Date(),
        });
      }
    } catch (chatErr) {
      logger.error("Error creating group chat:", chatErr);
    }

    res.status(201).json({ message: "Assignment created successfully", assignment: populated });
  } catch (err) {
    logger.error("Error creating assignment:", { error: err?.message });
    res.status(500).json({ message: "Error creating assignment" });
  }
});

// Delete assignment
router.delete("/:id", async (req, res) => {
  try {
    const Assignment = getAssignment(req.db);
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });

    try {
      await getGroupChat(req.db).findOneAndUpdate(
        { assignmentId: req.params.id },
        { isActive: false }
      );
    } catch (chatErr) {
      logger.error("Error deactivating group chat:", chatErr);
    }

    res.json({ message: "Assignment deleted" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: "Error deleting assignment" });
  }
});

export default router;
