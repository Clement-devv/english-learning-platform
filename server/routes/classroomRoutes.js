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
import { issueShareLink } from "../utils/shareLink.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';
import { recordOutcomeChange } from "../utils/classOutcome.js";
import { payForCompletedClass } from "../utils/classPayment.js";

const router = express.Router();
router.use(tenantMiddleware);

const getClassroomSession   = (db) => db.models.ClassroomSession   || db.model("ClassroomSession",   classroomSessionSchema);
const getClassComplaint     = (db) => db.models.ClassComplaint     || db.model("ClassComplaint",     classComplaintSchema);
const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);

// ── Access control ────────────────────────────────────────────────────────────
// Every classroom route acts on one booking. Only that booking's teacher or
// student may use it (admins/sub-admins may read). The caller's role always
// comes from the token — never from the request body.
const ADMIN_ROLES = ["admin", "sub-admin"];

// Booking statuses /auto-complete may settle (see the handler for why)
const AUTO_COMPLETABLE = ["accepted", "pending", "missed"];

// populate("teacherId"/"studentId") needs the models registered on this center's
// connection first — otherwise the first request after a restart fails with
// "Schema hasn't been registered for model Teacher".
const registerModels = (db) => { getStudent(db); getTeacher(db); };
router.use((req, _res, next) => { if (req.db) registerModels(req.db); next(); });

async function authorizeClass(req, res, bookingId, { teacherOnly = false, allowAdmin = false } = {}) {
  if (!bookingId || !/^[a-f\d]{24}$/i.test(String(bookingId))) { badRequest(res, "Valid bookingId is required"); return null; }
  const booking = await getBooking(req.db).findById(bookingId).select("teacherId studentId status duration").lean();
  if (!booking) { notFound(res, "Booking not found"); return null; }

  const { role, id } = req.user;
  const isTeacher = role === "teacher" && String(booking.teacherId) === id;
  const isStudent = role === "student" && String(booking.studentId) === id;
  const isAdmin   = allowAdmin && ADMIN_ROLES.includes(role);

  if (teacherOnly ? !isTeacher : !(isTeacher || isStudent || isAdmin)) {
    forbidden(res, "You are not part of this class");
    return null;
  }
  return { booking, role: isTeacher ? "teacher" : isStudent ? "student" : role };
}

// POST /api/classroom/attendance
router.post("/attendance", verifyToken, async (req, res) => {
  try {
    const { bookingId, action, timestamp, activeTime } = req.body;
    if (!bookingId || !action)
      return badRequest(res, "bookingId and action are required");

    const access = await authorizeClass(req, res, bookingId);
    if (!access) return;
    if (!["teacher", "student"].includes(access.role)) return forbidden(res, "Only the class teacher or student can record attendance");
    // Role comes from the token, not the body — nobody can report attendance as the other side
    if (req.body.userRole && req.body.userRole !== access.role) return forbidden(res, "Role mismatch");
    const userRole = access.role;

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

      if (session.managedAttendance) {
        // Managed student has no device: the teacher's client only counts time while
        // the teacher has the student marked present. Cap at time since first confirmed.
        const sinceJoin = session.studentJoinedAt ? Math.floor((Date.now() - session.studentJoinedAt.getTime()) / 1000) : 0;
        session.bothActiveTime = Math.max(0, Math.min(session.teacherActiveTime, sinceJoin));
      } else if (session.teacherActiveTime > 0 && session.studentActiveTime > 0) {
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

// POST /api/classroom/managed-presence  { bookingId, present: boolean }
// Managed students (no login) can't join the classroom themselves, so the class
// teacher confirms it: "Student joined" / "Student left". Acts exactly like the
// student's own join/leave, so the normal completion rules apply afterwards.
router.post("/managed-presence", verifyToken, async (req, res) => {
  try {
    const { bookingId, present } = req.body;
    if (!bookingId || typeof present !== "boolean") return badRequest(res, "bookingId and present (boolean) are required");
    if (req.user.role !== "teacher") return forbidden(res, "Only the class teacher can confirm attendance");

    const booking = await getBooking(req.db).findById(bookingId).populate("studentId", "isManaged");
    if (!booking) return notFound(res, "Booking not found");
    if (booking.teacherId.toString() !== req.user.id) return forbidden(res, "This is not your class");
    if (!booking.studentId?.isManaged) return badRequest(res, "This student joins the classroom themselves");
    if (!["accepted", "pending"].includes(booking.status)) return badRequest(res, `This class is already ${booking.status}`);

    const ClassroomSession = getClassroomSession(req.db);
    let session = await ClassroomSession.findOne({ bookingId });
    if (!session) return badRequest(res, "Join the classroom first");
    if (["completed", "incomplete", "missed"].includes(session.status)) return badRequest(res, "This class has already ended");
    if (!session.teacherJoinedAt) return badRequest(res, "Join the classroom first");

    const now = new Date();
    const set = { managedAttendance: true };
    if (present) {
      if (!session.studentJoinedAt) set.studentJoinedAt = now;
      set.studentLeftAt = null;
    } else {
      set.studentLeftAt = now;
    }
    session = await ClassroomSession.findOneAndUpdate(
      { bookingId },
      { $set: set, $push: { presenceLog: { present, at: now, by: req.user.id } } },
      { new: true },
    );

    // Same rule as a real join: the class clock starts once both are in
    if (present && session.teacherJoinedAt && !session.classStartedAt) {
      session = await ClassroomSession.findOneAndUpdate(
        { bookingId, classStartedAt: null },
        { $set: { classStartedAt: now, status: "active" } },
        { new: true },
      ) || await ClassroomSession.findOne({ bookingId });
    }

    res.json({ success: true, session });
  } catch (err) {
    logger.error("Managed presence error:", { error: err?.message });
    serverError(res, "Error updating attendance");
  }
});

// POST /api/classroom/auto-complete
router.post("/auto-complete", verifyToken, async (req, res) => {
  try {
    const { bookingId, clientBothActiveTime } = req.body;
    if (!bookingId) return badRequest(res, "bookingId is required");

    const access = await authorizeClass(req, res, bookingId);
    if (!access) return;
    const callerRole = access.role;

    const ClassroomSession = getClassroomSession(req.db);

    const booking = await getBooking(req.db).findById(bookingId)
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
      .populate("studentId", "firstName lastName email classCredits active isManaged");

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

    // Only a scheduled class can be settled here. "missed" stays open so the
    // re-check after a time extension can still complete it. Everything else —
    // teacher-logged classes awaiting admin approval (pending_confirmation),
    // admin-rejected, cancelled… — has its own flow and must never pay out here.
    if (!AUTO_COMPLETABLE.includes(booking.status) || booking.adminRejected)
      return res.status(400).json({ message: `Cannot auto-complete booking with status: ${booking.status}` });

    const session = await ClassroomSession.findOne({ bookingId });

    const sessionTeacherJoined    = !!(session?.teacherJoinedAt);
    const sessionStudentJoined    = !!(session?.studentJoinedAt);
    const serverConfirmedBothJoined = !!(session?.classStartedAt);
    const callerIsTeacher = callerRole === "teacher";
    const callerIsStudent = callerRole === "student";

    // Managed student (no login): only the teacher's "Student joined" confirmation
    // counts as the student joining.
    const isManaged = !!booking.studentId?.isManaged;

    // Presence comes from the server's join records. The caller may vouch for
    // themselves only — client-reported time is never proof the OTHER side came.
    const teacherJoined = sessionTeacherJoined || serverConfirmedBothJoined || callerIsTeacher;
    const studentJoined = isManaged
      ? sessionStudentJoined
      : sessionStudentJoined || serverConfirmedBothJoined || callerIsStudent;
    const bothJoined    = teacherJoined && studentJoined;

    // Time together can't exceed the overlap the server saw: from the moment both
    // were in (classStartedAt) until the first of them left (or now), and never
    // more than the booked length plus extensions. This caps clientBothActiveTime,
    // which the caller controls.
    const maxDuration = (booking.duration || 60) * 60 + (session?.extendedTime || 0);
    let overlapBound = 0;
    if (session?.classStartedAt) {
      const startMs = new Date(session.classStartedAt).getTime();
      const leftAt  = (d) => (d && new Date(d).getTime() > startMs ? new Date(d).getTime() : Date.now());
      const endMs   = Math.min(leftAt(session.teacherLeftAt), leftAt(session.studentLeftAt), Date.now());
      overlapBound  = Math.min(Math.max(0, Math.floor((endMs - startMs) / 1000)), maxDuration);
    }

    const serverBothActiveTime = session?.bothActiveTime || 0;
    const clientTime = Number.isFinite(Number(clientBothActiveTime)) ? Math.max(0, Number(clientBothActiveTime)) : 0;
    let bothActiveTime = Math.min(Math.max(serverBothActiveTime, clientTime), overlapBound);

    if (bothActiveTime === 0 && serverConfirmedBothJoined) {
      bothActiveTime = overlapBound;
    }

    const requiredTime     = session?.requiredTime || Math.floor((booking.duration || 60) * 60 * 0.83);
    const meetsRequirement = bothActiveTime >= requiredTime;

    // Case 1: CLASS COMPLETED
    if (bothJoined && meetsRequirement) {
      // Claim the booking atomically — two simultaneous calls (teacher + student,
      // or a retry) must not both pay. Only the request that flips the status pays.
      const claimed = await getBooking(req.db).findOneAndUpdate(
        { _id: booking._id, status: { $in: AUTO_COMPLETABLE }, adminRejected: { $ne: true } },
        { $set: {
          status: "completed", completedAt: new Date(), markedBy: "system", adminRejected: false,
          attendanceConfirmedBy: isManaged ? "teacher" : "student",
        } },
        { new: true },
      );
      if (!claimed) {
        const now = await getBooking(req.db).findById(booking._id).select("status").lean();
        const done = now?.status === "completed";
        return res.json({ alreadyProcessed: true, completed: done, missed: now?.status === "missed",
          message: done ? "Class already completed" : "This class was already settled" });
      }

      if (isManaged) {
        // Only the teacher saw the student — ready a link so the admin can ask the parent
        issueShareLink(claimed);
        claimed.parentCheck = { status: "waiting" };
        await claimed.save();
      }

      // Same charge/pay rules as every other completion path (trial classes are free)
      const { student, earned } = await payForCompletedClass(req.db, claimed, {
        description: `Auto-completed: ${booking.classTitle} (${isManaged ? "attendance confirmed by teacher" : "system"})`,
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
    else if (!studentJoined) missedReason = isManaged
      ? "Teacher did not confirm that the student joined (managed student)"
      : "Student did not join the class";
    else {
      const shortBy = Math.ceil((requiredTime - bothActiveTime) / 60);
      missedReason = `Attendance requirement not met — both parties needed ${Math.ceil(requiredTime / 60)} min together, were together for ${Math.floor(bothActiveTime / 60)} min (short by ${shortBy} min)`;
    }

    // Conditional so a parallel request that just completed the class isn't overwritten
    const markedMissed = await getBooking(req.db).findOneAndUpdate(
      { _id: booking._id, status: { $in: AUTO_COMPLETABLE }, adminRejected: { $ne: true } },
      { $set: { status: "missed", completedAt: new Date(), markedBy: "system", missedReason } },
      { new: true },
    );
    if (!markedMissed) {
      return res.json({ alreadyProcessed: true, message: "This class was already settled" });
    }

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
    if (!(await authorizeClass(req, res, req.params.bookingId, { allowAdmin: true }))) return;
    const session = await getClassroomSession(req.db).findOne({ bookingId: req.params.bookingId });
    res.json({ session: session || null });
  } catch (err) {
    serverError(res, "Error getting session");
  }
});

// PATCH /api/classroom/session/:bookingId/video-provider
router.patch("/session/:bookingId/video-provider", verifyToken, async (req, res) => {
  try {
    if (!(await authorizeClass(req, res, req.params.bookingId, { teacherOnly: true }))) return;
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
    if (!(await authorizeClass(req, res, req.params.bookingId, { teacherOnly: true }))) return;
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
    if (!(await authorizeClass(req, res, req.params.bookingId))) return;
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
    const access = await authorizeClass(req, res, req.params.bookingId);
    if (!access) return;
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
    session.timeExtensions.push({ minutes, extendedBy: access.role, extendedAt: new Date() });
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
    if (!(await authorizeClass(req, res, req.params.bookingId, { allowAdmin: true }))) return;
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

    if (!(await authorizeClass(req, res, bookingId))) return;

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
    recordOutcomeChange(booking, { to: "completed", source: "admin", reason: adminNotes || "Marked completed by admin" });
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
