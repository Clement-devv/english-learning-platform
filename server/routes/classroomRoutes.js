
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

    // ── Find or create session (upsert to avoid race-condition duplicate-key errors) ──
    let session = await ClassroomSession.findOne({ bookingId });

    if (!session) {
      const booking = await Booking.findById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      const durationSeconds = (booking.duration || 60) * 60;
      const requiredSeconds = Math.floor(durationSeconds * 0.83);

      session = new ClassroomSession({
        bookingId,
        requiredTime: requiredSeconds,
        status: "waiting",
      });
      try {
        await session.save();
      } catch (dupErr) {
        if (dupErr.code === 11000) {
          // Another concurrent request created it first — fetch that one
          session = await ClassroomSession.findOne({ bookingId });
        } else {
          throw dupErr;
        }
      }
    }

    const ts = timestamp ? new Date(timestamp) : new Date();

    // ── Handle actions ──────────────────────────────────────────────────────
    if (action === "join") {
      if (userRole === "teacher") {
        if (!session.teacherJoinedAt) session.teacherJoinedAt = ts;
        session.teacherLeftAt = null; // null (not undefined) so Mongoose actually saves the clear
        console.log(`👨‍🏫 Teacher joined booking ${bookingId}`);
      } else if (userRole === "student") {
        if (!session.studentJoinedAt) session.studentJoinedAt = ts;
        session.studentLeftAt = null; // null (not undefined) so Mongoose actually saves the clear
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
    const { bookingId, clientBothActiveTime, callerRole } = req.body;

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

    // Already COMPLETED and paid — truly finalised, cannot re-process
    if (booking.status === "completed" && !booking.adminRejected) {
      const existingSession = await ClassroomSession.findOne({ bookingId });
      return res.json({
        alreadyProcessed: true,
        completed: true,
        missed: false,
        teacherJoined: !!(existingSession?.teacherJoinedAt),
        studentJoined: !!(existingSession?.studentJoinedAt),
        bothActiveTime: existingSession?.bothActiveTime || 0,
        requiredTime: existingSession?.requiredTime || Math.floor((booking.duration || 60) * 60 * 0.83),
        message: "Class already completed",
      });
    }

    // Already marked missed — return the stored result without re-processing
    if (booking.status === "missed") {
      const existingSession = await ClassroomSession.findOne({ bookingId });
      return res.json({
        alreadyProcessed: true,
        completed: false,
        missed: true,
        teacherJoined: !!(existingSession?.teacherJoinedAt) || callerRole === "teacher",
        studentJoined: !!(existingSession?.studentJoinedAt) || callerRole === "student",
        bothActiveTime: existingSession?.bothActiveTime || 0,
        requiredTime: existingSession?.requiredTime || Math.floor((booking.duration || 60) * 60 * 0.83),
        reason: booking.missedReason || "Attendance requirements were not met.",
        message: "Class already marked as not completed",
      });
    }

    // "missed" bookings can be re-processed (previous run may have had bad data).
    // "pending" bookings are allowed (booking may never have been formally accepted).
    // Hard-block only truly terminal statuses.
    const blockedStatuses = ["rejected", "cancelled"];
    if (blockedStatuses.includes(booking.status)) {
      return res.status(400).json({
        message: `Cannot auto-complete booking with status: ${booking.status}`,
      });
    }

    // ── Get session ─────────────────────────────────────────────────────────
    const session = await ClassroomSession.findOne({ bookingId });

    const sessionTeacherJoined = !!(session?.teacherJoinedAt);
    const sessionStudentJoined = !!(session?.studentJoinedAt);

    // classStartedAt is set server-side ONLY when both teacherJoinedAt AND
    // studentJoinedAt were recorded — so it's definitive proof both joined.
    const serverConfirmedBothJoined = !!(session?.classStartedAt);

    // clientBothActiveTime > 0 means the client timer accumulated time while
    // both presence flags were true — also reliable evidence both were present.
    const clientEvidenceBothPresent = (clientBothActiveTime || 0) > 0;

    // callerRole = the authenticated user who triggered auto-complete.
    // They were physically present in the classroom, so this is direct evidence.
    const callerIsTeacher = callerRole === "teacher";
    const callerIsStudent = callerRole === "student";

    const teacherJoined = sessionTeacherJoined || serverConfirmedBothJoined || clientEvidenceBothPresent || callerIsTeacher;
    const studentJoined = sessionStudentJoined || serverConfirmedBothJoined || clientEvidenceBothPresent || callerIsStudent;
    const bothJoined    = teacherJoined && studentJoined;

    // Use the maximum of server and client values — the client already sends
    // MAX(its local value, server value), so this is MAX of all sources.
    // This prevents a tracking bug on one side from underreporting bothActiveTime.
    const serverBothActiveTime = session?.bothActiveTime || 0;
    const bothActiveTime = Math.max(serverBothActiveTime, clientBothActiveTime || 0);

    const requiredTime = session?.requiredTime || Math.floor((booking.duration || 60) * 60 * 0.83);
    const meetsRequirement = bothActiveTime >= requiredTime
      // Fallback: if the server confirmed both joined (classStartedAt set) AND neither
      // has a leftAt recorded at completion time, they were present for the full class.
      // This covers cases where client-side bothActiveTime tracking was unreliable.
      || (serverConfirmedBothJoined && !session?.teacherLeftAt && !session?.studentLeftAt);

    console.log(`🏁 Auto-complete check for booking ${bookingId}:`, {
      bookingStatus: booking.status,
      sessionExists: !!session,
      sessionTeacherJoined,
      sessionStudentJoined,
      serverConfirmedBothJoined,
      clientBothActiveTime,
      clientEvidenceBothPresent,
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
          teacherJoined: true,
          studentJoined: true,
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
// PATCH /api/classroom/session/:bookingId/video-provider
// Teacher sets the video provider; student's poll picks it up automatically.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/session/:bookingId/video-provider", verifyToken, async (req, res) => {
  try {
    const { videoProvider } = req.body;
    if (!["agora", "googlemeet"].includes(videoProvider)) {
      return res.status(400).json({ message: "Invalid videoProvider" });
    }
    const session = await ClassroomSession.findOneAndUpdate(
      { bookingId: req.params.bookingId },
      { videoProvider },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json({ session });
  } catch (err) {
    console.error("Error setting video provider:", err);
    res.status(500).json({ message: "Error setting video provider" });
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/classroom/complaints/:id  — admin updates complaint status
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/complaints/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
    const { status, adminNotes, resolution } = req.body;
    const complaint = await ClassComplaint.findByIdAndUpdate(
      req.params.id,
      { status, adminNotes, resolution, reviewedAt: new Date(), reviewedBy: req.user.id },
      { new: true }
    ).populate("bookingId", "classTitle scheduledTime duration")
     .populate("teacherId", "firstName lastName email")
     .populate("studentId", "firstName surname email");
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });
    res.json({ complaint });
  } catch (err) {
    res.status(500).json({ message: "Error updating complaint" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/classroom/admin-complete/:bookingId
// Admin manually marks a missed class as completed (e.g. after dispute resolution)
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/admin-complete/:bookingId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });

    const { complaintId, adminNotes } = req.body;

    const booking = await Booking.findById(req.params.bookingId)
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
      .populate("studentId", "firstName surname email noOfClasses active");

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status === "completed") return res.status(400).json({ message: "Already completed" });
    if (!["missed", "accepted", "pending"].includes(booking.status)) {
      return res.status(400).json({ message: `Cannot complete booking with status: ${booking.status}` });
    }

    const session = await ClassroomSession.findOne({ bookingId: req.params.bookingId });

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      booking.status = "completed";
      booking.completedAt = new Date();
      booking.markedBy = "admin";
      booking.adminRejected = false;
      await booking.save({ session: dbSession });

      const student = await Student.findById(booking.studentId._id).session(dbSession);
      if (student && student.noOfClasses > 0) {
        student.noOfClasses -= 1;
        if (student.noOfClasses === 0) student.active = false;
        await student.save({ session: dbSession });
      }

      const teacher = await Teacher.findById(booking.teacherId._id).session(dbSession);
      let earned = 0;
      if (teacher) {
        earned = parseFloat(teacher.ratePerClass || 0);
        teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
        teacher.earned = (teacher.earned || 0) + earned;
        await teacher.save({ session: dbSession });
      }

      await PaymentTransaction.create([{
        bookingId: booking._id,
        teacherId: booking.teacherId._id,
        studentId: booking.studentId._id,
        amount: earned,
        status: "pending",
        type: "class_completion",
        classTitle: booking.classTitle,
        completedAt: new Date(),
        description: `Admin-approved: ${booking.classTitle} (dispute resolved)`,
      }], { session: dbSession });

      if (session) {
        session.status = "completed";
        session.classEndedAt = new Date();
        await session.save({ session: dbSession });
      }

      if (complaintId) {
        await ClassComplaint.findByIdAndUpdate(complaintId, {
          status: "approved",
          resolution: "mark_complete",
          adminNotes: adminNotes || "Marked complete by admin",
          reviewedAt: new Date(),
          reviewedBy: req.user.id,
        }, { session: dbSession });
      }

      await dbSession.commitTransaction();

      return res.json({
        success: true,
        message: `Class marked as completed by admin. Teacher earned $${earned}.`,
        teacherEarned: earned,
        studentClassesRemaining: student?.noOfClasses ?? 0,
      });
    } catch (err) {
      await dbSession.abortTransaction();
      throw err;
    } finally {
      dbSession.endSession();
    }
  } catch (err) {
    console.error("Admin-complete error:", err);
    res.status(500).json({ message: "Error completing class: " + err.message });
  }
});

export default router;