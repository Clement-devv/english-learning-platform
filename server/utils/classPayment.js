// server/utils/classPayment.js
// Charge + pay for a class that has just been marked completed: deduct one
// credit from the student, add the teacher's rate, and record a pending payment.
// The reverse is utils/classReversal.js.
//
// Credits and earnings are changed with single atomic updates (never read →
// change → save), so two classes settling at the same moment can't overwrite
// each other's change.
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { paymentTransactionSchema } from "../schemas/paymentTransactionSchema.js";

const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);

/** Round to exactly 2dp — prevents 0.1+0.2 = 0.30000000000004 salary drift */
export const toMoney = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

/**
 * Take one credit (never below 0). A student left with 0 credits is deactivated
 * (only if still at 0 — a top-up landing at the same moment wins).
 * Returns { student (after the change, lean; null if not found), charged, deactivated }.
 */
export async function chargeClassCredit(db, studentId) {
  const Student = getStudent(db);
  const after = await Student.findOneAndUpdate(
    { _id: studentId, classCredits: { $gt: 0 } },
    { $inc: { classCredits: -1 } },
    { new: true },
  ).lean();
  const student = after || await Student.findById(studentId).lean();
  let deactivated = false;
  if (student && (student.classCredits || 0) <= 0 && student.active !== false) {
    const off = await Student.updateOne({ _id: studentId, classCredits: { $lte: 0 } }, { $set: { active: false } });
    if (off.modifiedCount) { student.active = false; deactivated = true; }
  }
  return { student, charged: !!after, deactivated };
}

/**
 * Record the teacher's pending payment for a completed class. One transaction per
 * booking (unique index): a class completed again after a reversal reuses its
 * cancelled transaction.
 */
export async function recordPendingPayment(db, bookingId, fields) {
  const PaymentTransaction = getPaymentTransaction(db);
  const set = { ...fields, status: "pending", type: "class_completion" };
  const reopened = await PaymentTransaction.findOneAndUpdate(
    { bookingId, status: "cancelled" },
    { $set: { ...set, notes: "" }, $unset: { paidAt: "", paidBy: "" } },
  );
  if (!reopened) await PaymentTransaction.create({ bookingId, ...set });
}

/** Undo recordPendingPayment when the completion around it fails. */
export function rollbackPendingPayment(db, bookingId, note = "Rolled back: class completion failed") {
  return getPaymentTransaction(db).updateOne(
    { bookingId, status: "pending" },
    { $set: { status: "cancelled", notes: note } },
  );
}

/** Give one credit back and reactivate. Returns the student after the change (lean). */
export function refundClassCredit(db, studentId) {
  return getStudent(db).findOneAndUpdate(
    { _id: studentId },
    { $inc: { classCredits: 1 }, $set: { active: true } },
    { new: true },
  ).lean();
}

/**
 * Add `amount` to the teacher's earnings (rounded to 2dp in the same update) and
 * `lessons` to lessonsCompleted (negative to take back; neither goes below 0).
 * Returns the teacher after the change (lean).
 */
export function adjustTeacherEarnings(db, teacherId, amount, lessons) {
  return getTeacher(db).findOneAndUpdate(
    { _id: teacherId },
    [{ $set: {
      earned: { $max: [0, { $round: [{ $add: [{ $ifNull: ["$earned", 0] }, amount] }, 2] }] },
      lessonsCompleted: { $max: [0, { $add: [{ $ifNull: ["$lessonsCompleted", 0] }, lessons] }] },
    } }],
    { new: true },
  ).lean();
}

/** Returns { student, teacher, earned }. Trial classes are never charged or paid. */
export async function payForCompletedClass(db, booking, { description }) {
  const studentId = booking.studentId?._id || booking.studentId;
  const teacherId = booking.teacherId?._id || booking.teacherId;

  const student = booking.isTrial
    ? await getStudent(db).findById(studentId).lean()
    : (await chargeClassCredit(db, studentId)).student;

  let teacher = await getTeacher(db).findById(teacherId).select("ratePerClass firstName lastName").lean();
  let earned = 0;
  if (teacher && !booking.isTrial) {
    earned = toMoney(teacher.ratePerClass);
    teacher = await adjustTeacherEarnings(db, teacherId, earned, 1);

    await recordPendingPayment(db, booking._id, {
      teacherId, studentId, amount: earned,
      classTitle: booking.classTitle, completedAt: new Date(),
      studentName: `${student?.firstName || ""} ${student?.lastName || ""}`.trim(),
      description,
    });
  }
  return { student, teacher, earned };
}

/**
 * Re-mark a class an admin had un-marked (status "completed" + adminRejected) as completed:
 * claims the flag atomically, then charges the credit and pays the teacher again.
 * Returns { student, earned } or null when the class isn't an un-marked one.
 * (completeClass treats any "completed" booking as done, so without this an un-marked
 * class could never be marked again.)
 */
export async function reinstateUnmarkedClass(db, bookingId, by = "admin") {
  const Booking = db.models.Booking;
  if (!Booking) return null;
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: "completed", adminRejected: true },
    { $set: { adminRejected: false, adminRejectedReason: "", markedBy: by } },
    { new: true },
  );
  if (!booking) return null;
  const { student, earned } = await payForCompletedClass(db, booking, {
    description: `Re-marked as completed (${by}): ${booking.classTitle}`,
  });
  return { student, earned, studentId: booking.studentId };
}
