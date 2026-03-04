// server/services/classCompletionService.js
// THE single source of truth for all class completion logic.
// Routes (classroom, admin, booking) all call completeClass() — nothing else.

import mongoose from "mongoose";
import Booking            from "../models/Booking.js";
import Student            from "../models/Student.js";
import Teacher            from "../models/Teacher.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import ClassroomSession   from "../models/ClassroomSession.js";

/** Round to exactly 2dp — prevents 0.1+0.2 = 0.30000000000004 salary drift */
function toMoney(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

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
 * completeClass(bookingId, markedBy, options)
 *
 * @param bookingId  - MongoDB booking _id
 * @param markedBy   - "system" | "admin" | "classroom"
 * @param options.skipAttendanceCheck - true ONLY for admin manual override
 *
 * Returns: { success, alreadyProcessed?, completed, missed, reason?,
 *            studentClassesRemaining, teacherEarned, rateEarned,
 *            teacherLessonsCompleted, attendance, markedBy }
 * Throws on unexpected DB errors — let route handler return 500.
 */
export async function completeClass(bookingId, markedBy = "system", options = {}) {
  const { skipAttendanceCheck = false } = options;

  // ══════════════════════════════════════════════════════
  // STEP 1 — Atomic optimistic lock  [fixes BUG-1]
  // ══════════════════════════════════════════════════════
  // findOneAndUpdate is a single atomic MongoDB operation.
  // The filter { status:"accepted" } means ONLY ONE concurrent caller
  // can ever match. All others get null → alreadyProcessed.
  // This completely eliminates the read → check → write race condition.
  //
  // "processing" is a transient lock state. The catch block resets it
  // back to "accepted" on failure so booking can be retried.
  const claimedBooking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: "accepted" }, // atomic — matches ONCE ever
    { $set: { status: "processing" } },      // transient lock
    { new: false }                           // return OLD doc
  )
    .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
    .populate("studentId", "firstName surname email noOfClasses active");

  // ══════════════════════════════════════════════════════
  // STEP 2 — Idempotency guard
  // ══════════════════════════════════════════════════════
  if (!claimedBooking) {
    const existing = await Booking.findById(bookingId)
      .populate("teacherId", "firstName lastName earned lessonsCompleted")
      .populate("studentId", "firstName surname noOfClasses");

    if (!existing) throw new Error(`Booking ${bookingId} not found`);

    const isTerminal = ["completed", "missed", "processing"].includes(existing.status);
    if (isTerminal) {
      return {
        alreadyProcessed: true,
        completed: existing.status === "completed",
        missed:    existing.status === "missed",
        booking:   existing,
        studentClassesRemaining: existing.studentId?.noOfClasses ?? 0,
        teacherEarned:           existing.teacherId?.earned       ?? 0,
      };
    }
    throw new Error(`Cannot complete booking with status: "${existing.status}"`);
  }

  // ══════════════════════════════════════════════════════
  // STEP 3 — Attendance gate  [fixes BUG-2]
  // ══════════════════════════════════════════════════════
  const session    = await ClassroomSession.findOne({ bookingId });
  const attendance = evaluateAttendance(session, claimedBooking.duration);

  if (!skipAttendanceCheck && !attendance.meetsRequirement) {
    // Release processing lock → mark as missed
    const missedBooking = await Booking.findByIdAndUpdate(
      bookingId,
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

    if (session) {
      session.status       = "missed";
      session.classEndedAt = new Date();
      await session.save();
    }

    console.log(`⚠️  [ClassCompletion] Booking ${bookingId} MISSED. ${missedBooking.missedReason}`);

    return {
      success:   true,
      completed: false,
      missed:    true,
      reason:    missedBooking.missedReason,
      attendance,
      booking:   missedBooking,
      studentClassesRemaining: claimedBooking.studentId?.noOfClasses ?? 0,
      teacherEarned:           claimedBooking.teacherId?.earned       ?? 0,
    };
  }

  // ══════════════════════════════════════════════════════
  // STEP 4 — Multi-document transaction (5 atomic writes)
  // ══════════════════════════════════════════════════════
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const now       = new Date();
    const teacherId = claimedBooking.teacherId._id;
    const studentId = claimedBooking.studentId._id;

    // Write 1: Finalize booking
    await Booking.updateOne(
      { _id: bookingId },
      { $set: { status: "completed", completedAt: now, markedBy, adminRejected: false } },
      { session: dbSession }
    );

    // Write 2: Deduct 1 credit from student (floor at 0)  [fixes inconsistent Math.max]
    const student = await Student.findById(studentId).session(dbSession);
    if (!student) throw new Error(`Student ${studentId} not found`);
    const newClassCount = Math.max(0, (student.noOfClasses || 0) - 1);
    student.noOfClasses = newClassCount;
    if (newClassCount === 0) student.active = false;
    await student.save({ session: dbSession });

    // Write 3: Add teacher earnings — float-safe  [fixes BUG-4]
    const teacher = await Teacher.findById(teacherId).session(dbSession);
    if (!teacher) throw new Error(`Teacher ${teacherId} not found`);
    const ratePerClass        = toMoney(teacher.ratePerClass);
    const newLessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
    const newEarned           = toMoney((teacher.earned   || 0) + ratePerClass);
    teacher.lessonsCompleted  = newLessonsCompleted;
    teacher.earned            = newEarned;
    await teacher.save({ session: dbSession });

    // Write 4: Create PaymentTransaction  [fixes BUG-3 — unique bookingId index is 2nd safety net]
    await PaymentTransaction.create(
      [{
        bookingId:   claimedBooking._id,
        teacherId,
        studentId,
        amount:      ratePerClass,
        status:      "pending",
        type:        "class_completion",
        classTitle:  claimedBooking.classTitle,
        studentName: `${claimedBooking.studentId.firstName} ${claimedBooking.studentId.surname}`,
        completedAt: now,
        description: `Completed by ${markedBy} — ${claimedBooking.classTitle}`,
      }],
      { session: dbSession }
    );

    // Write 5: Update ClassroomSession INSIDE the transaction  [fixes BUG-5]
    // Previous code: session.save() ran AFTER commitTransaction — crash between
    // commit and save left session permanently stale. Now it rolls back with all.
    if (session) {
      await ClassroomSession.updateOne(
        { _id: session._id },
        { $set: { status: "completed", classEndedAt: now, bothActiveTime: attendance.bothActiveTime } },
        { session: dbSession }
      );
    }

    // ── Commit ─────────────────────────────────────────
    await dbSession.commitTransaction();

    console.log(
      `✅ [ClassCompletion] "${claimedBooking.classTitle}" (${bookingId})\n` +
      `   Teacher : ${teacher.firstName} ${teacher.lastName} → +$${ratePerClass} (total $${newEarned})\n` +
      `   Student : ${student.firstName} ${student.surname} → credits left: ${newClassCount}`
    );

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

  } catch (err) {
    await dbSession.abortTransaction();

    // STEP 7 — Release processing lock  [fixes BUG-6]
    try {
      await Booking.updateOne(
        { _id: bookingId, status: "processing" },
        { $set: { status: "accepted" } }
      );
      console.warn(`⚠️  [ClassCompletion] Rolled back ${bookingId}. Reset to "accepted".`);
    } catch (resetErr) {
      // 🚨 CRITICAL: booking is stuck in "processing" — needs manual fix in Atlas
      console.error(
        `🚨 CRITICAL: Could not reset booking ${bookingId} after rollback!\n` +
        `   Transaction error : ${err.message}\n` +
        `   Reset error       : ${resetErr.message}\n` +
        `   FIX: db.bookings.updateOne({_id: ObjectId("${bookingId}")}, {$set:{status:"accepted"}})`
      );
    }

    throw err;
  } finally {
    dbSession.endSession();
  }
}