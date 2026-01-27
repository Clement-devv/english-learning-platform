// server/routes/classroomRoutes.js - CLASSROOM MANAGEMENT ROUTES
import express from "express";
import ClassroomSession from "../models/ClassroomSession.js";
import ClassComplaint from "../models/ClassComplaint.js";
import Booking from "../models/Booking.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * POST /api/classroom/attendance
 * Update classroom attendance (join, leave, heartbeat)
 */
router.post("/attendance", verifyToken, async (req, res) => {
  try {
    const { bookingId, userRole, action, timestamp, activeTime } = req.body;

    // Find or create classroom session
    let session = await ClassroomSession.findOne({ bookingId });

    if (!session) {
      // Create new session
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const durationSeconds = (booking.duration || 60) * 60;
      const requiredSeconds = Math.floor(durationSeconds * 0.83); // 83% required

      session = new ClassroomSession({
        bookingId: bookingId,
        requiredTime: requiredSeconds
      });
    }

    // Handle different actions
    if (action === "join") {
      if (userRole === "teacher") {
        session.teacherJoinedAt = new Date(timestamp);
      } else if (userRole === "student") {
        session.studentJoinedAt = new Date(timestamp);
      }

      // If both have joined, mark class as started
      if (session.teacherJoinedAt && session.studentJoinedAt && !session.classStartedAt) {
        session.classStartedAt = new Date();
        session.status = "active";
      }
    } 
    else if (action === "leave") {
      if (userRole === "teacher") {
        session.teacherLeftAt = new Date(timestamp);
        session.teacherActiveTime = activeTime || session.teacherActiveTime;
      } else if (userRole === "student") {
        session.studentLeftAt = new Date(timestamp);
        session.studentActiveTime = activeTime || session.studentActiveTime;
      }
    }
    else if (action === "heartbeat") {
      // Record heartbeat
      session.heartbeats.push({
        userRole: userRole,
        timestamp: new Date(timestamp),
        activeTime: activeTime
      });

      // Update active times
      if (userRole === "teacher") {
        session.teacherActiveTime = activeTime;
      } else if (userRole === "student") {
        session.studentActiveTime = activeTime;
      }

      // Calculate both active time (minimum of both times)
      if (session.teacherActiveTime > 0 && session.studentActiveTime > 0) {
        session.bothActiveTime = Math.min(
          session.teacherActiveTime,
          session.studentActiveTime
        );
      }
    }

    await session.save();

    res.json({
      message: "Attendance updated",
      session: session
    });

  } catch (err) {
    console.error("Error updating attendance:", err);
    res.status(500).json({ message: "Error updating attendance" });
  }
});

/**
 * POST /api/classroom/end-early
 * End class early and create complaint for admin review
 */
router.post("/end-early", verifyToken, async (req, res) => {
  try {
    const {
      bookingId,
      reason,
      reportedBy,
      description,
      teacherActiveTime,
      studentActiveTime,
      bothActiveTime,
      requiredTime,
      endedAt,
      endedBy
    } = req.body;

    // Get booking details
    const booking = await Booking.findById(bookingId)
      .populate("teacherId", "firstName lastName")
      .populate("studentId", "firstName surname");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Create complaint record
    const complaint = new ClassComplaint({
      bookingId: bookingId,
      teacherId: booking.teacherId._id,
      studentId: booking.studentId._id,
      reason: reason,
      reportedBy: reportedBy,
      description: description,
      teacherActiveTime: teacherActiveTime,
      studentActiveTime: studentActiveTime,
      bothActiveTime: bothActiveTime,
      requiredTime: requiredTime,
      endedAt: new Date(endedAt),
      endedBy: endedBy,
      status: "pending"
    });

    await complaint.save();

    // Update booking status to pending (awaiting admin review)
    booking.status = "pending";
    await booking.save();

    // Update classroom session
    const session = await ClassroomSession.findOne({ bookingId });
    if (session) {
      session.status = "ended-early";
      session.classEndedAt = new Date(endedAt);
      session.teacherActiveTime = teacherActiveTime;
      session.studentActiveTime = studentActiveTime;
      session.bothActiveTime = bothActiveTime;
      await session.save();
    }

    // TODO: Send notification to admin
    console.log(`📩 Complaint submitted for booking ${bookingId}`);
    console.log(`   Teacher: ${booking.teacherId.firstName} ${booking.teacherId.lastName}`);
    console.log(`   Student: ${booking.studentId.firstName} ${booking.studentId.surname}`);
    console.log(`   Reason: ${reason}`);

    res.json({
      message: "Complaint submitted successfully",
      complaint: complaint
    });

  } catch (err) {
    console.error("Error ending class early:", err);
    res.status(500).json({ message: "Error submitting complaint" });
  }
});

/**
 * GET /api/classroom/check-completion/:bookingId
 * Check if class meets completion requirements
 */
router.get("/check-completion/:bookingId", verifyToken, async (req, res) => {
  try {
    const session = await ClassroomSession.findOne({ 
      bookingId: req.params.bookingId 
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const canComplete = session.bothActiveTime >= session.requiredTime;

    res.json({
      canComplete: canComplete,
      bothActiveTime: session.bothActiveTime,
      requiredTime: session.requiredTime,
      percentage: Math.round((session.bothActiveTime / session.requiredTime) * 100)
    });

  } catch (err) {
    console.error("Error checking completion:", err);
    res.status(500).json({ message: "Error checking completion" });
  }
});

/**
 * GET /api/classroom/session/:bookingId
 * Get classroom session details
 */
router.get("/session/:bookingId", verifyToken, async (req, res) => {
  try {
    const session = await ClassroomSession.findOne({ 
      bookingId: req.params.bookingId 
});

    if (!session) {
  return res.json({ session: null });
}

    res.json({ session });

  } catch (err) {
    console.error("Error getting session:", err);
    res.status(500).json({ message: "Error getting session" });
  }
});

/**
 * GET /api/classroom/complaints
 * Get all complaints (Admin only)
 */
router.get("/complaints", verifyToken, async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { status } = req.query;
    const filter = status ? { status } : {};

    const complaints = await ClassComplaint.find(filter)
      .populate("bookingId", "classTitle scheduledTime duration")
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .populate("reviewedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.json({ complaints });

  } catch (err) {
    console.error("Error getting complaints:", err);
    res.status(500).json({ message: "Error getting complaints" });
  }
});

/**
 * PATCH /api/classroom/complaints/:id/review
 * Review and resolve a complaint (Admin only)
 */
router.patch("/complaints/:id/review", verifyToken, async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { status, resolution, adminNotes } = req.body;

    const complaint = await ClassComplaint.findById(req.params.id)
      .populate("bookingId");

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Update complaint
    complaint.status = status; // approved, rejected, under_review
    complaint.resolution = resolution; // mark_complete, mark_incomplete, refund_student, no_action
    complaint.adminNotes = adminNotes || "";
    complaint.reviewedBy = req.user.id;
    complaint.reviewedAt = new Date();

    await complaint.save();

    // Apply resolution
    if (resolution === "mark_complete") {
      // Mark booking as completed and reduce student's classes
      const Booking = mongoose.model("Booking");
      const Student = mongoose.model("Student");

      const booking = await Booking.findById(complaint.bookingId._id);
      if (booking && booking.status !== "completed") {
        booking.status = "completed";
        booking.completedAt = new Date();
        await booking.save();

        // Reduce student's class count
        const student = await Student.findById(complaint.studentId);
        if (student && student.noOfClasses > 0) {
          student.noOfClasses -= 1;
          await student.save();
        }
      }
    } else if (resolution === "mark_incomplete") {
      // Mark booking as cancelled/rejected
      const Booking = mongoose.model("Booking");
      const booking = await Booking.findById(complaint.bookingId._id);
      if (booking) {
        booking.status = "cancelled";
        await booking.save();
      }
    }

    res.json({
      message: "Complaint reviewed successfully",
      complaint: complaint
    });

  } catch (err) {
    console.error("Error reviewing complaint:", err);
    res.status(500).json({ message: "Error reviewing complaint" });
  }
});

export default router;