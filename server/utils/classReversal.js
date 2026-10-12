// server/utils/classReversal.js
// Reverse a completed class: restore the student's credit, deduct the teacher's
// earnings and cancel the pending payment. Used by the admin "unmark" action and
// by dispute resolution (e.g. a parent reports a managed student didn't attend).
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { paymentTransactionSchema } from "../schemas/paymentTransactionSchema.js";
import { recordOutcomeChange } from "./classOutcome.js";
import { refundClassCredit, adjustTeacherEarnings, toMoney } from "./classPayment.js";

const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);

/**
 * `booking` must be a completed, not-yet-rejected Booking document.
 * Marks it adminRejected and saves it. Returns { student, teacher, ratePerClass }.
 * If another request reversed it first, nothing changes and the result is
 * { alreadyReversed: true } — a double click can't refund / deduct twice.
 */
export async function reverseCompletedClass(db, booking, { reason = "", adminId = null, source } = {}) {
  // Claim the reversal atomically — only the request that flips adminRejected moves money
  const claim = await booking.constructor.updateOne(
    { _id: booking._id, status: "completed", adminRejected: { $ne: true } },
    { $set: { adminRejected: true } },
  );
  if (claim.modifiedCount === 0) return { alreadyReversed: true, student: null, teacher: null, ratePerClass: 0 };

  booking.adminRejected       = true;
  booking.adminRejectedAt     = new Date();
  booking.adminRejectedBy     = adminId;
  booking.adminRejectedReason = reason;
  // Shown in the daily completed-classes report as "completed → not completed"
  recordOutcomeChange(booking, { to: "not_completed", source: source || (adminId ? "admin" : "system"), reason });
  await booking.save();

  const studentId = booking.studentId?._id || booking.studentId;
  const teacherId = booking.teacherId?._id || booking.teacherId;

  // Trial classes never deducted a credit or paid the teacher.
  // Atomic updates — a class settling for the same student/teacher at the same moment can't be overwritten.
  const student = booking.isTrial
    ? await getStudent(db).findById(studentId).lean()
    : await refundClassCredit(db, studentId);

  let teacher = await getTeacher(db).findById(teacherId).select("ratePerClass firstName lastName earned lessonsCompleted").lean();
  let ratePerClass = 0;
  if (teacher && !booking.isTrial) {
    ratePerClass = toMoney(teacher.ratePerClass);
    teacher = await adjustTeacherEarnings(db, teacherId, -ratePerClass, -1);
  }

  if (!booking.isTrial) {
    await getPaymentTransaction(db).updateMany(
      { bookingId: booking._id, status: "pending" },
      { $set: { status: "cancelled", notes: `Reversed: ${reason || "No reason given"}` } },
    );
  }

  return { student, teacher, ratePerClass };
}
