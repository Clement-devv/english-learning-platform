
import express from "express";
import mongoose from "mongoose";
import ClassroomSession from "../models/ClassroomSession.js";
import ClassComplaint from "../models/ClassComplaint.js";
import Booking from "../models/Booking.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/classroom/attendance
// Records join / leave / heartbeat events for a session.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/attendance", verifyToken, async (req, res) => {
  try {
    const { bookingId, userRole, action, timestamp, activeTime } = req.body;

    if (!bookingId || !userRole || !action) {
      return res.status(400).json({ message: "bookingId, userRole, and action are required" });
    }

    // ── Find or create session ──────────────────────────────────────────────
    let session = await ClassroomSession.findOne({ bookingId });

    if (!session) {
      const booking = await Booking.findById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      const durationSeconds = (booking.duration || 60) * 60;
      const requiredSeconds = Math.floor(durationSeconds * 0.83); // 83% required

      session = new ClassroomSession({
        bookingId,
        requiredTime: requiredSeconds,
        status: "waiting",
      });
    }

    const ts = timestamp ? new Date(timestamp) : new Date();

    // ── Handle actions ──────────────────────────────────────────────────────
    if (action === "join") {
      if (userRole === "teacher" && !session.teacherJoinedAt) {
        session.teacherJoinedAt = ts;
        console.log(`👨‍🏫 Teacher joined booking ${bookingId}`);
      } else if (userRole === "student" && !session.studentJoinedAt) {
        session.studentJoinedAt = ts;
        console.log(`👨‍🎓 Student joined booking ${bookingId}`);
      }

      // Both joined → start the class
      if (session.teacherJoinedAt && session.studentJoinedAt && !session.classStartedAt) {
        session.classStartedAt = new Date();
        session.status = "active";
        console.log(`🎉 Class started for booking ${bookingId}! Both parties present.`);
      }
    }
    else if (action === "leave") {
      if (userRole === "teacher") {
        session.teacherLeftAt = ts;
        if (activeTime != null) session.teacherActiveTime = activeTime;
      } else if (userRole === "student") {
        session.studentLeftAt = ts;
        if (activeTime != null) session.studentActiveTime = activeTime;
      }
      console.log(`👋 ${userRole} left booking ${bookingId}`);
    }
    else if (action === "heartbeat") {
      // Update individual active times from heartbeats
      if (userRole === "teacher" && activeTime != null) {
        session.teacherActiveTime = activeTime;
      } else if (userRole === "student" && activeTime != null) {
        session.studentActiveTime = activeTime;
      }

      // bothActiveTime = minimum of both (they must BOTH be there for time to count)
      // Only update if both have non-zero active times
      if (session.teacherActiveTime > 0 && session.studentActiveTime > 0) {
        session.bothActiveTime = Math.min(
          session.teacherActiveTime,
          session.studentActiveTime
        );
      }

      session.heartbeats.push({
        userRole,
        timestamp: ts,
        activeTime: activeTime || 0,
      });
    }

    await session.save();
    res.json({ message: "Attendance updated", session });

  } catch (err) {
    console.error("❌ Error updating attendance:", err);
    res.status(500).json({ message: "Error updating attendance" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/classroom/auto-complete
// Called by the frontend when the class timer hits 0.
// This is the ONLY place that marks a class as complete or missed.
// Idempotent: safe to call multiple times (teacher + student both call it).
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auto-complete", verifyToken, async (req, res) => {
  try {
    const { bookingId, clientBothActiveTime } = req.body;

    if (!bookingId) {
      return res.status(400).json({ message: "bookingId is required" });
    }

    // ── Check if already processed (idempotent) ─────────────────────────────
    const booking = await Booking.findById(bookingId)
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
      .populate("studentId", "firstName surname email noOfClasses active");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Already finalized — just return the current result
    if (booking.status === "completed" || booking.status === "missed") {
      return res.json({
        alreadyProcessed: true,
        completed: booking.status === "completed" && !booking.adminRejected,
        missed: booking.status === "missed" || booking.adminRejected,
        booking: {
          status: booking.status,
          adminRejected: booking.adminRejected,
          adminRejectedReason: booking.adminRejectedReason,
        },
      });
    }

    if (booking.status !== "accepted") {
      return res.status(400).json({
        message: `Cannot auto-complete booking with status: ${booking.status}`,
      });
    }

    // ── Get session ─────────────────────────────────────────────────────────
    const session = await ClassroomSession.findOne({ bookingId });

    const teacherJoined = !!(session?.teacherJoinedAt);
    const studentJoined = !!(session?.studentJoinedAt);
    const bothJoined    = teacherJoined && studentJoined;

    // Use whichever bothActiveTime is higher: server-tracked or client-sent
    const serverBothActiveTime = session?.bothActiveTime || 0;
    const bothActiveTime = Math.max(serverBothActiveTime, clientBothActiveTime || 0);
    const requiredTime   = session?.requiredTime || Math.floor((booking.duration || 60) * 60 * 0.83);
    const meetsRequirement = bothActiveTime >= requiredTime;

    console.log(`🏁 Auto-complete check for booking ${bookingId}:`, {
      teacherJoined,
      studentJoined,
      bothJoined,
      bothActiveTime: `${Math.floor(bothActiveTime / 60)}m ${bothActiveTime % 60}s`,
      requiredTime:   `${Math.floor(requiredTime / 60)}m ${requiredTime % 60}s`,
      meetsRequirement,
    });

    // ── Case 1: CLASS COMPLETED ✅ ───────────────────────────────────────────
    if (bothJoined && meetsRequirement) {
      const dbSession = await mongoose.startSession();
      dbSession.startTransaction();

      try {
        // Mark booking completed
        booking.status = "completed";
        booking.completedAt = new Date();
        booking.markedBy = "system";
        booking.adminRejected = false;
        await booking.save({ session: dbSession });

        // Deduct student class
        const student = await Student.findById(booking.studentId._id).session(dbSession);
        if (student && student.noOfClasses > 0) {
          student.noOfClasses -= 1;
          if (student.noOfClasses === 0) student.active = false;
          await student.save({ session: dbSession });
        }

        // Add teacher earnings
        const teacher = await Teacher.findById(booking.teacherId._id).session(dbSession);
        let earned = 0;
        if (teacher) {
          earned = parseFloat(teacher.ratePerClass || 0);
          teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
          teacher.earned = (teacher.earned || 0) + earned;
          await teacher.save({ session: dbSession });
        }

        // Create payment transaction
        await PaymentTransaction.create([{
          bookingId: booking._id,
          teacherId: booking.teacherId._id,
          studentId: booking.studentId._id,
          amount: earned,
          status: "pending",
          type: "class_completion",
          classTitle: booking.classTitle,
          completedAt: new Date(),
          description: `Auto-completed: ${booking.classTitle} (system)`,
        }], { session: dbSession });

        // Update session status
        if (session) {
          session.status = "completed";
          session.classEndedAt = new Date();
          session.bothActiveTime = bothActiveTime;
          await session.save({ session: dbSession });
        }

        await dbSession.commitTransaction();

        console.log(`✅ Class completed: ${booking.classTitle} | Teacher earned: $${earned} | Student classes left: ${student?.noOfClasses ?? "?"}`);

        return res.json({
          completed: true,
          missed: false,
          message: "Class completed successfully!",
          teacherEarned: earned,
          studentClassesRemaining: student?.noOfClasses ?? 0,
          bothActiveTime,
          requiredTime,
        });

      } catch (err) {
        await dbSession.abortTransaction();
        throw err;
      } finally {
        dbSession.endSession();
      }
    }

    // ── Case 2: CLASS MISSED / INCOMPLETE ❌ ────────────────────────────────
    let missedReason = "";
    if (!teacherJoined && !studentJoined) {
      missedReason = "Neither teacher nor student joined the class";
    } else if (!teacherJoined) {
      missedReason = "Teacher did not join the class";
    } else if (!studentJoined) {
      missedReason = "Student did not join the class";
    } else {
      // Both joined but not long enough
      const shortBy = Math.ceil((requiredTime - bothActiveTime) / 60);
      missedReason = `Attendance requirement not met — both parties needed ${Math.ceil(requiredTime / 60)} min together, were together for ${Math.floor(bothActiveTime / 60)} min (short by ${shortBy} min)`;
    }

    // Mark booking as missed (no deductions, no earnings)
    booking.status = "missed";
    booking.completedAt = new Date();
    booking.markedBy = "system";
    booking.missedReason = missedReason;
    await booking.save();

    // Update session
    if (session) {
      session.status = "incomplete";
      session.classEndedAt = new Date();
      await session.save();
    }

    console.log(`❌ Class missed: ${booking.classTitle} | Reason: ${missedReason}`);

    return res.json({
      completed: false,
      missed: true,
      message: "Class marked as missed",
      reason: missedReason,
      teacherJoined,
      studentJoined,
      bothActiveTime,
      requiredTime,
    });

  } catch (err) {
    console.error("❌ Auto-complete error:", err);
    res.status(500).json({ message: "Error completing class: " + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/classroom/session/:bookingId
// ─────────────────────────────────────────────────────────────────────────────
router.get("/session/:bookingId", verifyToken, async (req, res) => {
  try {
    const session = await ClassroomSession.findOne({ bookingId: req.params.bookingId });
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json({ session });
  } catch (err) {
    console.error("Error getting session:", err);
    res.status(500).json({ message: "Error getting session" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/classroom/check-completion/:bookingId
// ─────────────────────────────────────────────────────────────────────────────
router.get("/check-completion/:bookingId", verifyToken, async (req, res) => {
  try {
    const session = await ClassroomSession.findOne({ bookingId: req.params.bookingId });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const canComplete = session.bothActiveTime >= session.requiredTime;
    res.json({
      canComplete,
      bothJoined: !!(session.teacherJoinedAt && session.studentJoinedAt),
      bothActiveTime: session.bothActiveTime,
      requiredTime: session.requiredTime,
      percentage: Math.round((session.bothActiveTime / session.requiredTime) * 100),
    });
  } catch (err) {
    res.status(500).json({ message: "Error checking completion" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/classroom/end-early  (for admin complaint logging)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/end-early", verifyToken, async (req, res) => {
  try {
    const {
      bookingId, reason, reportedBy, description,
      teacherActiveTime, studentActiveTime, bothActiveTime, requiredTime,
      endedAt, endedBy,
    } = req.body;

    const booking = await Booking.findById(bookingId)
      .populate("teacherId", "firstName lastName")
      .populate("studentId", "firstName surname");

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const complaint = new ClassComplaint({
      bookingId, teacherId: booking.teacherId._id, studentId: booking.studentId._id,
      reason, reportedBy, description,
      teacherActiveTime, studentActiveTime, bothActiveTime, requiredTime,
      endedAt: new Date(endedAt), endedBy, status: "pending",
    });
    await complaint.save();

    res.json({ message: "Early-end logged for admin review", complaint });
  } catch (err) {
    console.error("Error logging end-early:", err);
    res.status(500).json({ message: "Error logging complaint" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/classroom/complaints  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/complaints", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
    const { status } = req.query;
    const filter = status ? { status } : {};
    const complaints = await ClassComplaint.find(filter)
      .populate("bookingId", "classTitle scheduledTime duration")
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .sort({ createdAt: -1 });
    res.json({ complaints });
  } catch (err) {
    res.status(500).json({ message: "Error fetching complaints" });
  }
});


router.post("/auto-complete", verifyToken, async (req, res) => {
  try {
    const { bookingId, clientBothActiveTime } = req.body;
    if (!bookingId) return res.status(400).json({ message: "bookingId required" });

    const booking = await Booking.findById(bookingId)
      .populate("teacherId", "firstName lastName ratePerClass lessonsCompleted earned")
      .populate("studentId", "firstName surname noOfClasses active");
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Idempotency — already processed
    if (booking.status === "completed") {
      const teacher = await Teacher.findById(booking.teacherId._id);
      return res.json({ completed: true, alreadyProcessed: true, message: "Already completed.", teacherEarned: teacher?.earned || 0, studentClassesRemaining: booking.studentId?.noOfClasses || 0 });
    }
    if (booking.status === "missed") {
      return res.json({ completed: false, missed: true, alreadyProcessed: true, reason: booking.missedReason || "Requirements not met.", message: "Already marked missed." });
    }
    if (booking.status !== "accepted") {
      return res.status(400).json({ message: "Cannot auto-complete booking with status: " + booking.status });
    }

    const session = await ClassroomSession.findOne({ bookingId });
    const requiredTime = session?.requiredTime || Math.floor((booking.duration || 60) * 60 * 0.83);

    // ✅ STRICT CHECKS — both must have joined
    const teacherJoined = !!(session && session.teacherJoinedAt);
    const studentJoined = !!(session && session.studentJoinedAt);
    const bothActiveTime = Math.max(session?.bothActiveTime || 0, clientBothActiveTime || 0);
    const shouldComplete = teacherJoined && studentJoined && bothActiveTime >= requiredTime;

    console.log("AUTO-COMPLETE:", { bookingId, teacherJoined, studentJoined, bothActiveTime, requiredTime, shouldComplete });

    if (shouldComplete) {
      const dbSession = await mongoose.startSession();
      dbSession.startTransaction();
      try {
        booking.status = "completed"; booking.completedAt = new Date();
        booking.markedBy = "classroom"; booking.adminRejected = false;
        await booking.save({ session: dbSession });

        const student = await Student.findById(booking.studentId._id).session(dbSession);
        if (student && student.noOfClasses > 0) {
          student.noOfClasses = Math.max(0, student.noOfClasses - 1);
          if (student.noOfClasses === 0) student.active = false;
          await student.save({ session: dbSession });
        }

        const teacher = await Teacher.findById(booking.teacherId._id).session(dbSession);
        const ratePerClass = parseFloat(teacher?.ratePerClass || 0);
        if (teacher) {
          teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
          teacher.earned = (teacher.earned || 0) + ratePerClass;
          await teacher.save({ session: dbSession });
        }

        await PaymentTransaction.create([{
          bookingId: booking._id, teacherId: booking.teacherId._id,
          studentId: booking.studentId._id, amount: ratePerClass,
          status: "pending", type: "class_completion",
          classTitle: booking.classTitle,
          studentName: `${booking.studentId.firstName} ${booking.studentId.surname}`,
          completedAt: new Date(),
          description: `Classroom auto-complete — ${booking.classTitle}`,
        }], { session: dbSession });

        await dbSession.commitTransaction();

        if (session) { session.status = "completed"; session.classEndedAt = new Date(); session.bothActiveTime = bothActiveTime; await session.save(); }

        const updatedStudent = await Student.findById(booking.studentId._id);
        const updatedTeacher = await Teacher.findById(booking.teacherId._id);

        return res.json({ completed: true, missed: false, message: "Class completed!", teacherJoined, studentJoined, bothActiveTime, requiredTime, teacherEarned: ratePerClass, teacherTotalEarned: updatedTeacher?.earned || 0, studentClassesRemaining: updatedStudent?.noOfClasses || 0 });

      } catch (txErr) { await dbSession.abortTransaction(); throw txErr; }
      finally { dbSession.endSession(); }

    } else {
      const fmt = (s) => { const m = Math.floor(s/60), sec = s%60; return sec > 0 ? `${m}m ${sec}s` : `${m}m`; };
      let reason;
      if (!teacherJoined && !studentJoined) reason = "Neither teacher nor student joined the class.";
      else if (!teacherJoined) reason = "Teacher did not join the class.";
      else if (!studentJoined) reason = "Student did not join the class."; // ← THIS is what was broken
      else reason = `Attendance requirement not met — needed ${fmt(requiredTime)} together, only spent ${fmt(bothActiveTime)} (short by ${fmt(requiredTime - bothActiveTime)}).`;

      booking.status = "missed"; booking.missedReason = reason; booking.markedBy = "classroom";
      await booking.save();
      if (session) { session.status = "incomplete"; session.classEndedAt = new Date(); await session.save(); }

      return res.json({ completed: false, missed: true, reason, message: reason, teacherJoined, studentJoined, bothActiveTime, requiredTime });
    }
  } catch (err) {
    console.error("Auto-complete error:", err);
    res.status(500).json({ message: "Error processing completion: " + err.message });
  }
});

export default router;