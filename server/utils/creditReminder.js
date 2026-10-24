// server/utils/creditReminder.js
// "Classes remaining" email after a completed class uses one of the student's classes
// (called from utils/classPayment.js → chargeClassCredit):
//   • managed students (no login) → the family's notification email, after every class —
//     they have no dashboard to see the balance
//   • students with an account → their own email, only once the balance is low (≤ 2)
//     or zero — they see the balance in their dashboard otherwise
// Sent a little later, and only if the balance is still what this charge left: a class
// that was rolled back or refunded in the meantime sends nothing. Never throws.
import { studentSchema } from "../schemas/studentSchema.js";
import { isManagedEmail } from "./managedStudent.js";
import { sendClassesRemainingEmail, LOW_CLASSES } from "../emails/creditEmails.js";
import Center from "../models/master/Center.js";
import logger from "./logger.js";

const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);
export const SEND_DELAY_MS = 20_000;

/** Where this student's "classes remaining" email goes, or null (pure — unit-tested). */
export function reminderTarget(student, left) {
  if (!student) return null;
  if (student.isManaged) return (student.notifyEmail || "").trim() || null;
  if (left > LOW_CLASSES) return null;
  const email = (student.email || "").trim();
  return email && !isManagedEmail(email) ? email : null;
}

/** Send now (used by the delayed sender and by tests). Returns "sent" | "skipped" | "changed". */
export async function sendCreditReminder(db, studentId, expectedLeft, cls = {}) {
  const student = await getStudent(db).findById(studentId)
    .select("+notifyEmail firstName email isManaged emailLanguage timezone classCredits").lean();
  if (!student) return "skipped";
  const left = student.classCredits || 0;
  if (left !== expectedLeft) return "changed"; // refunded / topped up / charged again since
  const to = reminderTarget(student, left);
  if (!to) return "skipped";
  const center = await Center.findOne({ slug: db.name })
    .select("slug centerName timezone customDomain domainVerified branding.logo").lean();
  await sendClassesRemainingEmail({ student, to, left, cls, center, centerName: center?.centerName });
  return "sent";
}

/** Fire-and-forget after a class used one of the student's classes. */
export function scheduleCreditReminder(db, studentId, left, cls = {}) {
  if (process.env.NODE_ENV === "test") return;
  const t = setTimeout(() => {
    sendCreditReminder(db, studentId, left, cls)
      .catch((err) => logger.warn("[CreditReminder] email failed", { error: err?.message }));
  }, SEND_DELAY_MS);
  t.unref?.();
}
