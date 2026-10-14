// server/utils/groupPoints.js
// Group-class points: a separate balance (Student.groupPoints) that students buy
// from the admin and spend only on group class seats. Every change is one atomic
// update + a ledger row (groupPointsLedgerSchema), so two enrollments at the same
// moment can't spend the same points.
//
// Also: paying the teacher's fixed fee when a group class is completed (once).
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { groupClassSchema } from "../schemas/groupClassSchema.js";
import { groupPointsLedgerSchema } from "../schemas/groupPointsLedgerSchema.js";
import { paymentTransactionSchema } from "../schemas/paymentTransactionSchema.js";
import { adjustTeacherEarnings, toMoney } from "./classPayment.js";

const getStudent    = (db) => db.models.Student            || db.model("Student", studentSchema);
const getGroupClass = (db) => db.models.GroupClass         || db.model("GroupClass", groupClassSchema);
const getLedger     = (db) => db.models.GroupPointsLedger  || db.model("GroupPointsLedger", groupPointsLedgerSchema);
const getTx         = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);
const getTeacher    = (db) => db.models.Teacher            || db.model("Teacher", teacherSchema);

export { getLedger as getGroupPointsLedger };

/** Does this class charge group points? (classes from before points have no paymentType → credits) */
export const usesPoints = (gc) => gc?.paymentType === "points";

const who = (user) => (user ? { role: user.role, id: user.id } : undefined);

/** Admin sold `points` to a student. Returns the new balance. */
export async function addPoints(db, studentId, points, { kind = "purchase", amountPaid, currency, method, note, user, groupClassId, classTitle } = {}) {
  const after = await getStudent(db).findOneAndUpdate(
    { _id: studentId },
    { $inc: { groupPoints: points } },
    { new: true },
  ).select("groupPoints").lean();
  if (!after) return null;
  await getLedger(db).create({
    studentId, kind, points, balanceAfter: after.groupPoints,
    amountPaid, currency, method, note, groupClassId, classTitle, by: who(user),
  });
  return after.groupPoints;
}

/** Take `points` only if the student has that many right now. Returns the new balance, or null if not enough. */
export async function spendPoints(db, studentId, points, { groupClassId, classTitle, user } = {}) {
  const after = await getStudent(db).findOneAndUpdate(
    { _id: studentId, groupPoints: { $gte: points } },
    { $inc: { groupPoints: -points } },
    { new: true },
  ).select("groupPoints").lean();
  if (!after) return null;
  await getLedger(db).create({
    studentId, kind: "spend", points: -points, balanceAfter: after.groupPoints,
    groupClassId, classTitle, by: who(user),
  });
  return after.groupPoints;
}

/** Give back what an enrollment was charged (points or, for older classes, credits). */
export async function refundEnrollment(db, gc, enrollment, { user, note } = {}) {
  if (!enrollment) return;
  if ((enrollment.pointsCharged || 0) > 0) {
    await addPoints(db, enrollment.studentId, enrollment.pointsCharged, {
      kind: "refund", groupClassId: gc._id, classTitle: gc.title, user, note,
    });
  }
  if ((enrollment.creditCharged || 0) > 0) {
    await getStudent(db).updateOne({ _id: enrollment.studentId }, { $inc: { classCredits: enrollment.creditCharged } });
  }
}

/**
 * Pay the teacher's fixed fee for a completed group class — once, and only if at
 * least one student was marked attended. Safe to call again (after a later
 * attendance change): the fee is claimed atomically on the class first.
 * Returns the amount paid now (0 if nothing was due).
 */
export async function payGroupClassFee(db, groupClassId) {
  const GroupClass = getGroupClass(db);
  const gc = await GroupClass.findById(groupClassId).lean();
  if (!gc || gc.status !== "completed" || !(gc.teacherFee > 0) || gc.feePaid?.at) return 0;
  const attended = (gc.enrollments || []).filter((e) => e.attendance === "attended").length;
  if (!attended) return 0;

  const amount = toMoney(gc.teacherFee);
  const claimed = await GroupClass.findOneAndUpdate(
    { _id: gc._id, status: "completed", "feePaid.at": { $exists: false } },
    { $set: { "feePaid.at": new Date(), "feePaid.amount": amount } },
  );
  if (!claimed) return 0; // someone else just paid it

  // The salary record first: it is unique per group class, so even a retry after a
  // crash can never create a second one. Then the earnings.
  let tx = null;
  try {
    const teacher = await getTeacher(db).findById(gc.teacherId).select("firstName").lean();
    tx = await getTx(db).create({
      teacherId: gc.teacherId, groupClassId: gc._id, amount,
      type: "class_completion", status: "pending",
      classTitle: gc.title, completedAt: gc.completedAt || new Date(),
      studentName: `Group class · ${attended} student${attended === 1 ? "" : "s"}`,
      description: `Group class fee: ${gc.title}${teacher ? ` (${teacher.firstName})` : ""}`,
    });
    await adjustTeacherEarnings(db, gc.teacherId, amount, 1);
    return amount;
  } catch (err) {
    // Not paid — undo the record and release the claim so it can be retried
    if (tx) await getTx(db).deleteOne({ _id: tx._id }).catch(() => {});
    await GroupClass.updateOne({ _id: gc._id }, { $unset: { feePaid: 1 } });
    throw err;
  }
}
