// server/services/classCompletionService.js
// THE single source of truth for all class completion logic.
// Routes (classroom, admin, booking) all call completeClass() — nothing else.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { bookingSchema }            from "../schemas/bookingSchema.js";
import { studentSchema }            from "../schemas/studentSchema.js";
import { teacherSchema }            from "../schemas/teacherSchema.js";
import { classroomSessionSchema }   from "../schemas/classroomSessionSchema.js";
import { recordActivity, recordClassCompletion } from "../utils/streakService.js";
import { chargeClassCredit, adjustTeacherEarnings, toMoney, recordPendingPayment, rollbackPendingPayment } from "../utils/classPayment.js";
import logger from "../utils/logger.js";

const __filename   = fileURLToPath(import.meta.url);
const __dirname    = path.dirname(__filename);
const CONTENT_DIR  = path.join(__dirname, "..", "uploads", "content");

function tryDeletePdf(bookingId) {
  try {
    const filePath = path.join(CONTENT_DIR, `${String(bookingId)}.pdf`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`[ClassCompletion] PDF deleted for booking ${bookingId}`);
    }
  } catch (err) {
    logger.warn(`[ClassCompletion] Could not delete PDF for ${bookingId}:`, { error: err?.message });
  }
}

const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getClassroomSession   = (db) => db.models.ClassroomSession   || db.model("ClassroomSession",   classroomSessionSchema);

/**
 * Server-side only attendance evaluator.
 * clientBothActiveTime is intentionally NOT accepted — prevents spoofing.
 */
function evaluateAttendance(session, bookingDurationMinutes) {
  const requiredTime =
    session?.requiredTime ??
    Math.floor((bookingDurationMinutes || 60) * 60 * 0.83);

  const teacherJoined  = !!(session?.teacherJoinedAt);
  const studentJoined  = !!(session?.studentJoinedAt);
  const bothActiveTime = session?.bothActiveTime || 0;

  return {
    teacherJoined,
    studentJoined,
    bothJoined:       teacherJoined && studentJoined,
    bothActiveTime,
    requiredTime,
    meetsRequirement: teacherJoined && studentJoined && bothActiveTime >= requiredTime,
  };
}

function buildMissedReason({ teacherJoined, studentJoined, bothActiveTime, requiredTime }) {
  if (!teacherJoined && !studentJoined) return "Neither teacher nor student joined.";
  if (!teacherJoined) return "Teacher did not join the class.";
  if (!studentJoined) return "Student did not join the class.";
  const pct  = requiredTime > 0 ? Math.round((bothActiveTime / requiredTime) * 100) : 0;
  const minA = Math.floor(bothActiveTime / 60);
  const minR = Math.floor(requiredTime   / 60);
  return `Insufficient attendance: ${minA}m of ${minR}m required (${pct}% — need ≥83%).`;
}

/**
 * completeClass(db, bookingId, markedBy, options)
 *
 * @param db         - per-center Mongoose connection (req.db)
 * @param bookingId  - MongoDB booking _id
 * @param markedBy   - "system" | "admin" | "classroom" | "sub-admin"
 * @param options.skipAttendanceCheck - true ONLY for admin manual override
 *
 * Returns: { success, alreadyProcessed?, completed, missed, reason?,
 *            studentClassesRemaining, teacherEarned, rateEarned,
 *            teacherLessonsCompleted, attendance, markedBy }
 * Throws on unexpected DB errors — let route handler return 500.
 */
export async function completeClass(db, bookingId, markedBy = "system", options = {}) {
  const { skipAttendanceCheck = false } = options;

  const Booking            = getBooking(db);
  const Student            = getStudent(db);
  const Teacher            = getTeacher(db);
  const ClassroomSession   = getClassroomSession(db);

  // ══════════════════════════════════════════════════════
  // STEP 1 — Atomic optimistic lock
  // Admin override can claim missed/pending classes too;
  // normal flow only claims "accepted".
  // ══════════════════════════════════════════════════════
  const claimableStatuses = skipAttendanceCheck
    ? ["accepted", "missed", "pending", "pending_confirmation"]
    : ["accepted"];

  const claimedBooking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: { $in: claimableStatuses } },
    { $set: { status: "processing" } },
    { new: false }
  )
    .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
    .populate("studentId", "firstName lastName email classCredits active");

  // ══════════════════════════════════════════════════════
  // STEP 2 — Idempotency guard
  // ══════════════════════════════════════════════════════
  if (!claimedBooking) {
    const existing = await Booking.findById(bookingId)
      .populate("teacherId", "firstName lastName earned lessonsCompleted")
      .populate("studentId", "firstName lastName classCredits");

    if (!existing) throw new Error(`Booking ${bookingId} not found`);

    // For admin override, only "completed" and "processing" are truly terminal.
    // For normal flow, "missed" is also terminal.
    const terminalStatuses = skipAttendanceCheck
      ? ["completed", "processing"]
      : ["completed", "missed", "processing"];

    if (terminalStatuses.includes(existing.status)) {
      return {
        alreadyProcessed: true,
        completed: existing.status === "completed",
        missed:    existing.status === "missed",
        booking:   existing,
        studentClassesRemaining: existing.studentId?.classCredits ?? 0,
        teacherEarned:           existing.teacherId?.earned       ?? 0,
      };
    }
    throw new Error(`Cannot complete booking with status: "${existing.status}"`);
  }

  // ══════════════════════════════════════════════════════
  // STEP 3 — Attendance gate
  // ══════════════════════════════════════════════════════
  const session    = await ClassroomSession.findOne({ bookingId });
  const attendance = evaluateAttendance(session, claimedBooking.duration);

  if (!skipAttendanceCheck && !attendance.meetsRequirement) {
    let missedBooking;
    try {
      missedBooking = await Booking.findOneAndUpdate(
        { _id: bookingId, status: "processing" },
        {
          $set: {
            status:       "missed",
            markedBy,
            missedReason: buildMissedReason(attendance),
            completedAt:  new Date(),
          },
        },
        { new: true }
      );
      if (!missedBooking) throw new Error("Booking left the processing state");
    } catch (err) {
      await releaseClaim(Booking, bookingId, claimedBooking.status, err);
      throw err;
    }

    // Housekeeping — the outcome is already saved; a failure here must not undo it
    if (session) {
      await ClassroomSession.updateOne({ _id: session._id }, { $set: { status: "missed", classEndedAt: new Date() } })
        .catch((e) => logger.warn(`[ClassCompletion] Session update failed for ${bookingId}:`, { error: e?.message }));
    }

    tryDeletePdf(bookingId);
    logger.info(`[ClassCompletion] Booking ${bookingId} MISSED. ${missedBooking.missedReason}`);

    return {
      success:   true,
      completed: false,
      missed:    true,
      reason:    missedBooking.missedReason,
      attendance,
      booking:   missedBooking,
      studentClassesRemaining: claimedBooking.studentId?.classCredits ?? 0,
      teacherEarned:           claimedBooking.teacherId?.earned       ?? 0,
    };
  }

  // ══════════════════════════════════════════════════════
  // STEP 4 — Money writes, then finalize the booking LAST
  // The booking stays "processing" until every money write succeeded. If one
  // fails, the ones already done are undone and the claim is released, so the
  // booking is never "completed" with the student uncharged / teacher unpaid.
  // ══════════════════════════════════════════════════════
  const now     = new Date();
  const isTrial = !!claimedBooking.isTrial;
  const done = { charged: false, deactivated: false, paid: 0, lessonAdded: false, paymentRecorded: false };

  let student, teacher, teacherId, studentId, ratePerClass = 0;
  try {
    // populate() leaves null when the teacher/student was deleted — fail inside the try so the claim is released
    teacherId = claimedBooking.teacherId?._id;
    studentId = claimedBooking.studentId?._id;
    if (!teacherId || !studentId) throw new Error(`Booking ${bookingId} has no ${teacherId ? "student" : "teacher"} (deleted?)`);

    // Write 1: Deduct 1 credit from student (skipped for trial lessons) — atomic, never below 0
    if (isTrial) {
      student = await Student.findById(studentId).lean();
    } else {
      const charge = await chargeClassCredit(db, studentId);
      student = charge.student;
      done.charged = charge.charged;
      done.deactivated = charge.deactivated;
    }
    if (!student) throw new Error(`Student ${studentId} not found`);

    // Write 2: Add teacher earnings — atomic + rounded to 2dp (skipped for trial lessons)
    teacher = await Teacher.findById(teacherId).select("firstName lastName ratePerClass earned lessonsCompleted").lean();
    if (!teacher) throw new Error(`Teacher ${teacherId} not found`);
    if (!isTrial) {
      ratePerClass = toMoney(teacher.ratePerClass);
      teacher = await adjustTeacherEarnings(db, teacherId, ratePerClass, 1);
      done.paid = ratePerClass;
      done.lessonAdded = true;
    }

    // Write 3: Pending PaymentTransaction (skipped for trial lessons)
    if (!isTrial) {
      await recordPendingPayment(db, claimedBooking._id, {
        teacherId, studentId, amount: ratePerClass,
        classTitle:  claimedBooking.classTitle,
        studentName: `${claimedBooking.studentId.firstName} ${claimedBooking.studentId.lastName}`,
        completedAt: now,
        description: `Completed by ${markedBy} — ${claimedBooking.classTitle}`,
      });
      done.paymentRecorded = true;
    }

    // Write 4: Finalize booking — only from our own "processing" claim
    const fin = await Booking.updateOne(
      { _id: bookingId, status: "processing" },
      { $set: { status: "completed", completedAt: now, markedBy, adminRejected: false } }
    );
    if (fin.modifiedCount === 0) throw new Error("Booking left the processing state during completion");
  } catch (err) {
    await undoMoneyWrites(db, { bookingId, studentId, teacherId, done }, err);
    await releaseClaim(Booking, bookingId, claimedBooking.status, err);
    throw err;
  }

  // ── Housekeeping — the completion is saved; failures here never undo it ──
  {
    const newClassCount       = student.classCredits || 0;
    const newLessonsCompleted = teacher.lessonsCompleted || 0;
    const newEarned           = toMoney(teacher.earned || 0);

    if (session) {
      await ClassroomSession.updateOne(
        { _id: session._id },
        { $set: { status: "completed", classEndedAt: now, bothActiveTime: attendance.bothActiveTime } }
      ).catch((e) => logger.warn(`[ClassCompletion] Session update failed for ${bookingId}:`, { error: e?.message }));
    }

    // Delete class PDF — non-blocking
    tryDeletePdf(bookingId);

    logger.info(`[ClassCompletion] "${claimedBooking.classTitle}" (${bookingId})`, {
      teacher: `${teacher.firstName} ${teacher.lastName}`, earned: newEarned,
      student: `${student.firstName} ${student.lastName}`, creditsLeft: newClassCount,
    });

    // Fire-and-forget streak updates — never block completion
    const sid = String(studentId);
    recordActivity(db, sid).catch((e) => logger.error("[Streak] recordActivity error:", { error: e?.message }));
    recordClassCompletion(db, sid).catch((e) => logger.error("[Streak] recordClassCompletion error:", { error: e?.message }));

    return {
      success:                 true,
      completed:               true,
      missed:                  false,
      attendance,
      booking:                 await Booking.findById(bookingId).lean(),
      studentClassesRemaining: newClassCount,
      teacherEarned:           newEarned,
      teacherLessonsCompleted: newLessonsCompleted,
      rateEarned:              ratePerClass,
      markedBy,
    };
  }
}

/** Put a claimed booking back to the status it had before we set "processing". */
async function releaseClaim(Booking, bookingId, originalStatus = "accepted", err) {
  try {
    await Booking.updateOne({ _id: bookingId, status: "processing" }, { $set: { status: originalStatus } });
    logger.warn(`[ClassCompletion] Error on ${bookingId}, reset to "${originalStatus}". Error: ${err?.message}`);
  } catch (resetErr) {
    logger.error(`CRITICAL: Could not reset booking ${bookingId} after error!`, {
      originalError: err?.message, resetError: resetErr.message,
      fix: `db.bookings.updateOne({_id:ObjectId("${bookingId}")},{$set:{status:"${originalStatus}"}})`,
    });
  }
}

/** Undo the money writes a failed completion already made (each step independently). */
async function undoMoneyWrites(db, { bookingId, studentId, teacherId, done }, err) {
  const steps = [];
  if (done.paymentRecorded) steps.push(["payment", () => rollbackPendingPayment(db, bookingId)]);
  if (done.paid || done.lessonAdded) steps.push(["teacher", () => adjustTeacherEarnings(db, teacherId, -done.paid, done.lessonAdded ? -1 : 0)]);
  if (done.charged) {
    const Student = getStudent(db);
    steps.push(["student", () => Student.updateOne(
      { _id: studentId },
      { $inc: { classCredits: 1 }, ...(done.deactivated ? { $set: { active: true } } : {}) },
    )]);
  }
  for (const [what, undo] of steps) {
    try {
      await undo();
    } catch (undoErr) {
      logger.error(`CRITICAL: completion of ${bookingId} failed and the ${what} change could not be undone — fix by hand`, {
        originalError: err?.message, undoError: undoErr?.message, studentId: String(studentId), teacherId: String(teacherId),
        teacherAmount: done.paid,
      });
    }
  }
}
