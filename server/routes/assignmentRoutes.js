import express from "express";
import Assignment from "../models/Assignment.js";
import GroupChat from "../models/GroupChat.js"; // ✅ ADD THIS
import Teacher from "../models/Teacher.js"; // ✅ ADD THIS
import Student from "../models/Student.js"; // ✅ ADD THIS

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

    // Create assignment
    const assignment = await Assignment.create({
      teacherId,
      studentId,
      assignedDate: new Date(),
    });

    const populated = await Assignment.findById(assignment._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");

    // ✅ AUTO-CREATE GROUP CHAT
    try {
      console.log('📱 Creating group chat for assignment:', assignment._id);
      
      // Get full teacher and student data for chat name
      const teacher = await Teacher.findById(teacherId);
      const student = await Student.findById(studentId);
      
      if (!teacher || !student) {
        console.error('❌ Teacher or Student not found for chat creation');
        return res.status(201).json({ 
          message: "Assignment created but chat creation failed", 
          assignment: populated 
        });
      }

      const chatName = `${teacher.firstName} ${teacher.lastName} - ${student.firstName} ${student.surname}`;
      
      // Check if chat already exists for this assignment
      const existingChat = await GroupChat.findOne({ assignmentId: assignment._id });
      
      if (existingChat) {
        console.log('ℹ️ Chat already exists for this assignment');
      } else {
        const groupChat = await GroupChat.create({
          assignmentId: assignment._id,
          teacherId: teacherId,
          studentId: studentId,
          chatName: chatName,
          messages: [{
            senderId: req.user?.id || teacherId, // Use admin ID if available, else teacher
            senderModel: req.user?.role === 'admin' ? 'Admin' : 'Teacher',
            senderName: 'System',
            senderRole: 'admin',
            message: `Chat created for ${chatName}. Welcome to your learning journey! 🎓`,
            messageType: 'system',
            createdAt: new Date()
          }],
          isActive: true,
          lastActivityAt: new Date()
        });
        
        console.log('✅ Group chat created successfully:', groupChat._id);
      }
    } catch (chatErr) {
      console.error('❌ Error creating group chat:', chatErr);
      // Don't fail assignment creation if chat creation fails
      // Just log the error and continue
    }

    res.status(201).json({ 
      message: "Assignment created successfully", 
      assignment: populated 
    });
  } catch (err) {
    console.error('❌ Error creating assignment:', err);
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

    // ✅ OPTIONAL: Delete associated group chat
    try {
      await GroupChat.findOneAndUpdate(
        { assignmentId: req.params.id },
        { isActive: false }
      );
      console.log('✅ Deactivated group chat for deleted assignment');
    } catch (chatErr) {
      console.error('⚠️ Error deactivating group chat:', chatErr);
    }

    res.json({ message: "Assignment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting assignment" });
  }
});

export default router;