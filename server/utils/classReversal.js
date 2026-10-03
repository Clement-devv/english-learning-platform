// server/utils/classReversal.js
// Reverse a completed class: restore the student's credit, deduct the teacher's
// earnings and cancel the pending payment. Used by the admin "unmark" action and
// by dispute resolution (e.g. a parent reports a managed student didn't attend).
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { paymentTransactionSchema } from "../schemas/paymentTransactionSchema.js";
import { recordOutcomeChange } from "./classOutcome.js";

const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);

/**
 * `booking` must be a completed, not-yet-rejected Booking document.
 * Marks it adminRejected and saves it. Returns { student, teacher, ratePerClass }.
 */
export async function reverseCompletedClass(db, booking, { reason = "", adminId = null, source } = {}) {
  booking.adminRejected       = true;
  booking.adminRejectedAt     = new Date();
  booking.adminRejectedBy     = adminId;
  booking.adminRejectedReason = reason;
  // Shown in the daily completed-classes report as "completed → not completed"
  recordOutcomeChange(booking, { to: "not_completed", source: source || (adminId ? "admin" : "system"), reason });
  await booking.save();

  const studentId = booking.studentId?._id || booking.studentId;
  const teacherId = booking.teacherId?._id || booking.teacherId;

  // Trial classes never deducted a credit or paid the teacher
  const student = await getStudent(db).findById(studentId);
  if (student && !booking.isTrial) {
    student.classCredits = (student.classCredits || 0) + 1;
    student.active = true;
    await student.save();
  }

  const teacher = await getTeacher(db).findById(teacherId);
  let ratePerClass = 0;
  if (teacher && !booking.isTrial) {
    ratePerClass = Math.round((parseFloat(teacher.ratePerClass) || 0) * 100) / 100;
    teacher.lessonsCompleted = Math.max(0, (teacher.lessonsCompleted || 0) - 1);
    teacher.earned = Math.max(0, Math.round(((teacher.earned || 0) - ratePerClass) * 100) / 100);
    await teacher.save();
  }

  if (!booking.isTrial) {
    await getPaymentTransaction(db).updateMany(
      { bookingId: booking._id, status: "pending" },
      { $set: { status: "cancelled", notes: `Reversed: ${reason || "No reason given"}` } },
    );
  }

  return { student, teacher, ratePerClass };
}
