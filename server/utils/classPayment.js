// server/utils/classPayment.js
// Charge + pay for a class that has just been marked completed: deduct one
// credit from the student, add the teacher's rate, and record a pending payment.
// The reverse is utils/classReversal.js.
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { paymentTransactionSchema } from "../schemas/paymentTransactionSchema.js";

const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);

/** Returns { student, teacher, earned }. Trial classes are never charged or paid. */
export async function payForCompletedClass(db, booking, { description }) {
  const studentId = booking.studentId?._id || booking.studentId;
  const teacherId = booking.teacherId?._id || booking.teacherId;

  const student = await getStudent(db).findById(studentId);
  if (student && !booking.isTrial && student.classCredits > 0) {
    student.classCredits -= 1;
    if (student.classCredits === 0) student.active = false;
    await student.save();
  }

  const teacher = await getTeacher(db).findById(teacherId);
  let earned = 0;
  if (teacher && !booking.isTrial) {
    earned = Math.round((parseFloat(teacher.ratePerClass) || 0) * 100) / 100;
    teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
    teacher.earned = Math.round(((teacher.earned || 0) + earned) * 100) / 100;
    await teacher.save();

    await getPaymentTransaction(db).create({
      bookingId: booking._id, teacherId, studentId,
      amount: earned, status: "pending", type: "class_completion",
      classTitle: booking.classTitle, completedAt: new Date(),
      studentName: `${student?.firstName || ""} ${student?.lastName || ""}`.trim(),
      description,
    });
  }
  return { student, teacher, earned };
}
