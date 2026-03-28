// server/services/classCompletionService.js
// THE single source of truth for all class completion logic.
// Routes (classroom, admin, booking) all call completeClass() — nothing else.

import { bookingSchema }            from "../schemas/bookingSchema.js";
import { studentSchema }            from "../schemas/studentSchema.js";
import { teacherSchema }            from "../schemas/teacherSchema.js";
import { paymentTransactionSchema } from "../schemas/paymentTransactionSchema.js";
import { classroomSessionSchema }   from "../schemas/classroomSessionSchema.js";

const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);
const getClassroomSession   = (db) => db.models.ClassroomSession   || db.model("ClassroomSession",   classroomSessionSchema);

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
  const PaymentTransaction = getPaymentTransaction(db);
  const ClassroomSession   = getClassroomSession(db);

  // ══════════════════════════════════════════════════════
  // STEP 1 — Atomic optimistic lock
  // ══════════════════════════════════════════════════════
  const claimedBooking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: "accepted" },
    { $set: { status: "processing" } },
    { new: false }
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
  // STEP 3 — Attendance gate
  // ══════════════════════════════════════════════════════
  const session    = await ClassroomSession.findOne({ bookingId });
  const attendance = evaluateAttendance(session, claimedBooking.duration);

  if (!skipAttendanceCheck && !attendance.meetsRequirement) {
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

    console.log(`[ClassCompletion] Booking ${bookingId} MISSED. ${missedBooking.missedReason}`);

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
  // STEP 4 — Sequential writes
  // ══════════════════════════════════════════════════════
  try {
    const now       = new Date();
    const teacherId = claimedBooking.teacherId._id;
    const studentId = claimedBooking.studentId._id;

    // Write 1: Finalize booking
    await Booking.updateOne(
      { _id: bookingId },
      { $set: { status: "completed", completedAt: now, markedBy, adminRejected: false } }
    );

    // Write 2: Deduct 1 credit from student (floor at 0)
    const student = await Student.findById(studentId);
    if (!student) throw new Error(`Student ${studentId} not found`);
    const newClassCount = Math.max(0, (student.noOfClasses || 0) - 1);
    student.noOfClasses = newClassCount;
    if (newClassCount === 0) student.active = false;
    await student.save();

    // Write 3: Add teacher earnings — float-safe
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) throw new Error(`Teacher ${teacherId} not found`);
    const ratePerClass        = toMoney(teacher.ratePerClass);
    const newLessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
    const newEarned           = toMoney((teacher.earned   || 0) + ratePerClass);
    teacher.lessonsCompleted  = newLessonsCompleted;
    teacher.earned            = newEarned;
    await teacher.save();

    // Write 4: Create PaymentTransaction
    await PaymentTransaction.create({
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
    });

    // Write 5: Update ClassroomSession
    if (session) {
      await ClassroomSession.updateOne(
        { _id: session._id },
        { $set: { status: "completed", classEndedAt: now, bothActiveTime: attendance.bothActiveTime } }
      );
    }

    console.log(
      `[ClassCompletion] "${claimedBooking.classTitle}" (${bookingId})\n` +
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
    // Release processing lock so the booking can be retried
    try {
      await Booking.updateOne(
        { _id: bookingId, status: "processing" },
        { $set: { status: "accepted" } }
      );
      console.warn(`[ClassCompletion] Error on ${bookingId}, reset to "accepted". Error: ${err.message}`);
    } catch (resetErr) {
      console.error(
        `CRITICAL: Could not reset booking ${bookingId} after error!\n` +
        `   Error        : ${err.message}\n` +
        `   Reset error  : ${resetErr.message}\n` +
        `   FIX: db.bookings.updateOne({_id: ObjectId("${bookingId}")}, {$set:{status:"accepted"}})`
      );
    }

    throw err;
  }
}
