// server/routes/classroomRoutes.js
import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware }           from "../middleware/tenantMiddleware.js";
import { classroomSessionSchema }     from "../schemas/classroomSessionSchema.js";
import { classComplaintSchema }       from "../schemas/classComplaintSchema.js";
import { bookingSchema }              from "../schemas/bookingSchema.js";
import { studentSchema }              from "../schemas/studentSchema.js";
import { teacherSchema }              from "../schemas/teacherSchema.js";
import { paymentTransactionSchema }   from "../schemas/paymentTransactionSchema.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getClassroomSession   = (db) => db.models.ClassroomSession   || db.model("ClassroomSession",   classroomSessionSchema);
const getClassComplaint     = (db) => db.models.ClassComplaint     || db.model("ClassComplaint",     classComplaintSchema);
const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);

// POST /api/classroom/attendance
router.post("/attendance", verifyToken, async (req, res) => {
  try {
    const { bookingId, userRole, action, timestamp, activeTime } = req.body;
    if (!bookingId || !userRole || !action)
      return badRequest(res, "bookingId, userRole, and action are required");

    const ClassroomSession = getClassroomSession(req.db);

    let session = await ClassroomSession.findOne({ bookingId });

    if (!session) {
      const booking = await getBooking(req.db).findById(bookingId);
      if (!booking) return notFound(res, "Booking not found");

      const durationSeconds = (booking.duration || 60) * 60;
      const requiredSeconds = Math.floor(durationSeconds * 0.83);

      session = new ClassroomSession({ bookingId, requiredTime: requiredSeconds, status: "waiting" });
      try {
        await session.save();
      } catch (dupErr) {
        if (dupErr.code === 11000) {
          session = await ClassroomSession.findOne({ bookingId });
        } else {
          throw dupErr;
        }
      }
    }

    const ts = timestamp ? new Date(timestamp) : new Date();

    if (action === "join") {
      const joinFields = {};
      if (userRole === "teacher") {
        if (!session.teacherJoinedAt) joinFields.teacherJoinedAt = ts;
        joinFields.teacherLeftAt = null;
      } else if (userRole === "student") {
        if (!session.studentJoinedAt) joinFields.studentJoinedAt = ts;
        joinFields.studentLeftAt = null;
      }

      const freshSession = await ClassroomSession.findOneAndUpdate(
        { bookingId },
        { $set: joinFields },
        { new: true }
      );

      if (freshSession.teacherJoinedAt && freshSession.studentJoinedAt && !freshSession.classStartedAt) {
        await ClassroomSession.findOneAndUpdate(
          { bookingId, classStartedAt: null },
          { $set: { classStartedAt: new Date(), status: "active" } }
        );
      }

      const updatedSession = await ClassroomSession.findOne({ bookingId });
      return res.json({ message: "Attendance updated", session: updatedSession });
    }
    else if (action === "leave") {
      if (userRole === "teacher") {
        session.teacherLeftAt = ts;
        if (activeTime != null) session.teacherActiveTime = activeTime;
      } else if (userRole === "student") {
        session.studentLeftAt = ts;
        if (activeTime != null) session.studentActiveTime = activeTime;
      }
    }
    else if (action === "heartbeat") {
      if (userRole === "teacher" && activeTime != null) session.teacherActiveTime = activeTime;
      else if (userRole === "student" && activeTime != null) session.studentActiveTime = activeTime;

      if (session.teacherActiveTime > 0 && session.studentActiveTime > 0) {
        session.bothActiveTime = Math.min(session.teacherActiveTime, session.studentActiveTime);
      }

      session.heartbeats.push({ userRole, timestamp: ts, activeTime: activeTime || 0 });
    }

    await session.save();
    res.json({ message: "Attendance updated", session });
  } catch (err) {
    logger.error("Error updating attendance:", { error: err?.message });
    serverError(res, "Error updating attendance");
  }
});

// POST /api/classroom/auto-complete
router.post("/auto-complete", verifyToken, async (req, res) => {
  try {
    const { bookingId, clientBothActiveTime, callerRole } = req.body;
    if (!bookingId) return badRequest(res, "bookingId is required");

    const ClassroomSession = getClassroomSession(req.db);

    const booking = await getBooking(req.db).findById(bookingId)
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
      .populate("studentId", "firstName lastName email classCredits active");

    if (!booking) return notFound(res, "Booking not found");

    if (booking.status === "completed" && !booking.adminRejected) {
      const existingSession = await ClassroomSession.findOne({ bookingId });
      let reportedBothActiveTime = existingSession?.bothActiveTime || 0;
      if (reportedBothActiveTime === 0 && existingSession?.classStartedAt) {
        const endMs = existingSession.classEndedAt
          ? new Date(existingSession.classEndedAt).getTime()
          : booking.completedAt ? new Date(booking.completedAt).getTime() : Date.now();
        const maxDuration = (booking.duration || 60) * 60;
        reportedBothActiveTime = Math.min(
          Math.max(0, Math.floor((endMs - new Date(existingSession.classStartedAt).getTime()) / 1000)),
          maxDuration
        );
      }
      return res.json({
        alreadyProcessed: true, completed: true, missed: false,
        teacherJoined: !!(existingSession?.teacherJoinedAt),
        studentJoined: !!(existingSession?.studentJoinedAt),
        bothActiveTime: reportedBothActiveTime,
        requiredTime: existingSession?.requiredTime || Math.floor((booking.duration || 60) * 60 * 0.83),
        message: "Class already completed",
      });
    }

    const blockedStatuses = ["rejected", "cancelled"];
    if (blockedStatuses.includes(booking.status))
      return res.status(400).json({ message: `Cannot auto-complete booking with status: ${booking.status}` });

    const session = await ClassroomSession.findOne({ bookingId });

    const sessionTeacherJoined    = !!(session?.teacherJoinedAt);
    const sessionStudentJoined    = !!(session?.studentJoinedAt);
    const serverConfirmedBothJoined = !!(session?.classStartedAt);
    const clientEvidenceBothPresent = (clientBothActiveTime || 0) > 0;
    const callerIsTeacher = callerRole === "teacher";
    const callerIsStudent = callerRole === "student";

    const teacherJoined = sessionTeacherJoined || serverConfirmedBothJoined || clientEvidenceBothPresent || callerIsTeacher;
    const studentJoined = sessionStudentJoined || serverConfirmedBothJoined || clientEvidenceBothPresent || callerIsStudent;
    const bothJoined    = teacherJoined && studentJoined;

    const serverBothActiveTime = session?.bothActiveTime || 0;
    let bothActiveTime = Math.max(serverBothActiveTime, clientBothActiveTime || 0);

    if (bothActiveTime === 0 && serverConfirmedBothJoined && session?.classStartedAt) {
      const maxDuration = (booking.duration || 60) * 60;
      const elapsed = Math.floor((Date.now() - new Date(session.classStartedAt)) / 1000);
      bothActiveTime = Math.min(elapsed, maxDuration);
    }

    const requiredTime     = session?.requiredTime || Math.floor((booking.duration || 60) * 60 * 0.83);
    const meetsRequirement = bothActiveTime >= requiredTime;

    // Case 1: CLASS COMPLETED
    if (bothJoined && meetsRequirement) {
      booking.status = "completed";
      booking.completedAt = new Date();
      booking.markedBy = "system";
      booking.adminRejected = false;
      await booking.save();

      const student = await getStudent(req.db).findById(booking.studentId._id);
      if (student && student.classCredits > 0) {
        student.classCredits -= 1;
        if (student.classCredits === 0) student.active = false;
        await student.save();
      }

      const teacher = await getTeacher(req.db).findById(booking.teacherId._id);
      let earned = 0;
      if (teacher) {
        earned = parseFloat(teacher.ratePerClass || 0);
        teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
        teacher.earned = (teacher.earned || 0) + earned;
        await teacher.save();
      }

      await getPaymentTransaction(req.db).create({
        bookingId: booking._id,
        teacherId: booking.teacherId._id,
        studentId: booking.studentId._id,
        amount: earned, status: "pending", type: "class_completion",
        classTitle: booking.classTitle, completedAt: new Date(),
        studentName: `${booking.studentId.firstName || ""} ${booking.studentId.lastName || ""}`.trim(),
        description: `Auto-completed: ${booking.classTitle} (system)`,
      });

      if (session) {
        session.status = "completed";
        session.classEndedAt = new Date();
        session.bothActiveTime = bothActiveTime;
        await session.save();
      }

      return res.json({
        completed: true, missed: false, message: "Class completed successfully!",
        teacherJoined: true, studentJoined: true,
        teacherEarned: earned, studentClassesRemaining: student?.classCredits ?? 0,
        bothActiveTime, requiredTime,
      });
    }

    // Case 2: CLASS MISSED
    let missedReason = "";
    if (!teacherJoined && !studentJoined) missedReason = "Neither teacher nor student joined the class";
    else if (!teacherJoined) missedReason = "Teacher did not join the class";
    else if (!studentJoined) missedReason = "Student did not join the class";
    else {
      const shortBy = Math.ceil((requiredTime - bothActiveTime) / 60);
      missedReason = `Attendance requirement not met — both parties needed ${Math.ceil(requiredTime / 60)} min together, were together for ${Math.floor(bothActiveTime / 60)} min (short by ${shortBy} min)`;
    }

    booking.status = "missed";
    booking.completedAt = new Date();
    booking.markedBy = "system";
    booking.missedReason = missedReason;
    await booking.save();

    if (session) {
      session.status = "incomplete";
      session.classEndedAt = new Date();
      session.bothActiveTime = bothActiveTime;
      await session.save();
    }

    return res.json({
      completed: false, missed: true, message: "Class marked as missed", reason: missedReason,
      teacherJoined, studentJoined, bothActiveTime, requiredTime,
    });
  } catch (err) {
    logger.error("Auto-complete error:", { error: err?.message });
    serverError(res, "Error completing class");
  }
});

// GET /api/classroom/session/:bookingId
// First-visit lookup — returns `session: null` (200) when none exists yet
// instead of 404.  The client checks `data.session?.videoProvider`, so null
// is the natural "not picked yet" signal, and the browser console stays clean.
router.get("/session/:bookingId", verifyToken, async (req, res) => {
  try {
    const session = await getClassroomSession(req.db).findOne({ bookingId: req.params.bookingId });
    res.json({ session: session || null });
  } catch (err) {
    serverError(res, "Error getting session");
  }
});

// PATCH /api/classroom/session/:bookingId/video-provider
router.patch("/session/:bookingId/video-provider", verifyToken, async (req, res) => {
  try {
    const { videoProvider } = req.body;
    if (!["agora", "googlemeet", "zoom"].includes(videoProvider))
      return badRequest(res, "Invalid videoProvider");

    const session = await getClassroomSession(req.db).findOneAndUpdate(
      { bookingId: req.params.bookingId },
      { videoProvider },
      { new: true }
    );
    if (!session) return notFound(res, "Session not found");
    res.json({ session });
  } catch (err) {
    serverError(res, "Error setting video provider");
  }
});

// PATCH /api/classroom/session/:bookingId/content-state  (teacher only)
router.patch("/session/:bookingId/content-state", verifyToken, async (req, res) => {
  try {
    const { page, scale, annotation, annotationPage } = req.body;
    const update = {};
    if (page  != null) update.contentPage  = page;
    if (scale != null) update.contentScale = scale;
    if (annotation != null && annotationPage != null) {
      update.contentAnnotation = { page: annotationPage, data: annotation, ts: Date.now() };
    }
    if (!Object.keys(update).length) return badRequest(res, "page, scale or annotation required");

    const session = await getClassroomSession(req.db).findOneAndUpdate(
      { bookingId: req.params.bookingId },
      { $set: update },
      { new: true }
    );
    if (!session) return notFound(res, "Session not found");
    res.json({
      contentPage:       session.contentPage,
      contentScale:      session.contentScale,
      contentAnnotation: session.contentAnnotation,
    });
  } catch (err) {
    serverError(res, "Error updating content state");
  }
});

// GET /api/classroom/session/:bookingId/content-state  (student polls this)
router.get("/session/:bookingId/content-state", verifyToken, async (req, res) => {
  try {
    const session = await getClassroomSession(req.db)
      .findOne({ bookingId: req.params.bookingId })
      .select("contentPage contentScale contentAnnotation");
    if (!session) return notFound(res, "Session not found");
    res.json({
      contentPage:       session.contentPage  ?? 1,
      contentScale:      session.contentScale ?? 1.3,
      contentAnnotation: session.contentAnnotation ?? null,
    });
  } catch (err) {
    serverError(res, "Error fetching content state");
  }
});

// PATCH /api/classroom/session/:bookingId/extend-time
router.patch("/session/:bookingId/extend-time", verifyToken, async (req, res) => {
  try {
    const { minutes } = req.body;
    if (!minutes || minutes < 1 || minutes > 60)
      return badRequest(res, "minutes must be between 1 and 60");

    const ClassroomSession = getClassroomSession(req.db);
    const session = await ClassroomSession.findOne({ bookingId: req.params.bookingId });
    if (!session) return notFound(res, "Session not found");
    if (!["active", "waiting"].includes(session.status))
      return badRequest(res, "Class is not active");

    const addSeconds = minutes * 60;
    session.extendedTime = (session.extendedTime || 0) + addSeconds;
    session.timeExtensions.push({ minutes, extendedBy: req.user.role, extendedAt: new Date() });
    await session.save();

    res.json({ session, addedSeconds: addSeconds });
  } catch (err) {
    logger.error("Extend-time error:", { error: err?.message });
    serverError(res, "Error extending class time");
  }
});

// GET /api/classroom/check-completion/:bookingId
router.get("/check-completion/:bookingId", verifyToken, async (req, res) => {
  try {
    const session = await getClassroomSession(req.db).findOne({ bookingId: req.params.bookingId });
    if (!session) return notFound(res, "Session not found");

    const canComplete = session.bothActiveTime >= session.requiredTime;
    res.json({
      canComplete,
      bothJoined: !!(session.teacherJoinedAt && session.studentJoinedAt),
      bothActiveTime: session.bothActiveTime,
      requiredTime: session.requiredTime,
      percentage: Math.round((session.bothActiveTime / session.requiredTime) * 100),
    });
  } catch (err) {
    serverError(res, "Error checking completion");
  }
});

// POST /api/classroom/end-early
router.post("/end-early", verifyToken, async (req, res) => {
  try {
    const {
      bookingId, reason, reportedBy, description,
      teacherActiveTime, studentActiveTime, bothActiveTime, requiredTime,
      endedAt, endedBy,
    } = req.body;

    const booking = await getBooking(req.db).findById(bookingId)
      .populate("teacherId", "firstName lastName")
      .populate("studentId", "firstName lastName");

    if (!booking) return notFound(res, "Booking not found");

    const ClassComplaint = getClassComplaint(req.db);
    const complaint = new ClassComplaint({
      bookingId, teacherId: booking.teacherId._id, studentId: booking.studentId._id,
      reason, reportedBy, description,
      teacherActiveTime, studentActiveTime, bothActiveTime, requiredTime,
      endedAt: new Date(endedAt), endedBy, status: "pending",
    });
    await complaint.save();

    res.json({ message: "Early-end logged for admin review", complaint });
  } catch (err) {
    logger.error("Error logging end-early:", { error: err?.message });
    serverError(res, "Error logging complaint");
  }
});

// GET /api/classroom/complaints — admin only
router.get("/complaints", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return forbidden(res, "Admin only");
    const { status } = req.query;
    const filter = status ? { status } : {};
    const complaints = await getClassComplaint(req.db).find(filter)
      .populate("bookingId", "classTitle scheduledTime duration")
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email")
      .sort({ createdAt: -1 });
    res.json({ complaints });
  } catch (err) {
    serverError(res, "Error fetching complaints");
  }
});

// PATCH /api/classroom/complaints/:id — admin updates complaint status
router.patch("/complaints/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return forbidden(res, "Admin only");
    const { status, adminNotes, resolution } = req.body;
    const complaint = await getClassComplaint(req.db).findByIdAndUpdate(
      req.params.id,
      { status, adminNotes, resolution, reviewedAt: new Date(), reviewedBy: req.user.id },
      { new: true }
    )
      .populate("bookingId", "classTitle scheduledTime duration")
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email");
    if (!complaint) return notFound(res, "Complaint not found");
    res.json({ complaint });
  } catch (err) {
    serverError(res, "Error updating complaint");
  }
});

// PATCH /api/classroom/admin-complete/:bookingId
router.patch("/admin-complete/:bookingId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return forbidden(res, "Admin only");

    const { complaintId, adminNotes } = req.body;

    const booking = await getBooking(req.db).findById(req.params.bookingId)
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
      .populate("studentId", "firstName lastName email classCredits active");

    if (!booking) return notFound(res, "Booking not found");
    if (booking.status === "completed") return badRequest(res, "Already completed");
    if (!["missed", "accepted", "pending"].includes(booking.status))
      return res.status(400).json({ message: `Cannot complete booking with status: ${booking.status}` });

    const session = await getClassroomSession(req.db).findOne({ bookingId: req.params.bookingId });

    booking.status = "completed";
    booking.completedAt = new Date();
    booking.markedBy = "admin";
    booking.adminRejected = false;
    await booking.save();

    const student = await getStudent(req.db).findById(booking.studentId._id);
    if (student && student.classCredits > 0) {
      student.classCredits -= 1;
      if (student.classCredits === 0) student.active = false;
      await student.save();
    }

    const teacher = await getTeacher(req.db).findById(booking.teacherId._id);
    let earned = 0;
    if (teacher) {
      earned = parseFloat(teacher.ratePerClass || 0);
      teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
      teacher.earned = (teacher.earned || 0) + earned;
      await teacher.save();
    }

    await getPaymentTransaction(req.db).create({
      bookingId: booking._id,
      teacherId: booking.teacherId._id,
      studentId: booking.studentId._id,
      amount: earned, status: "pending", type: "class_completion",
      classTitle: booking.classTitle, completedAt: new Date(),
      studentName: `${booking.studentId.firstName || ""} ${booking.studentId.lastName || ""}`.trim(),
      description: `Admin-approved: ${booking.classTitle} (dispute resolved)`,
    });

    if (session) {
      session.status = "completed";
      session.classEndedAt = new Date();
      await session.save();
    }

    if (complaintId) {
      await getClassComplaint(req.db).findByIdAndUpdate(complaintId, {
        status: "approved", resolution: "mark_complete",
        adminNotes: adminNotes || "Marked complete by admin",
        reviewedAt: new Date(), reviewedBy: req.user.id,
      });
    }

    return res.json({
      success: true,
      message: `Class marked as completed by admin. Teacher earned $${earned}.`,
      teacherEarned: earned,
      studentClassesRemaining: student?.classCredits ?? 0,
    });
  } catch (err) {
    logger.error("Admin-complete error:", { error: err?.message });
    serverError(res, "Error completing class");
  }
});

export default router;
