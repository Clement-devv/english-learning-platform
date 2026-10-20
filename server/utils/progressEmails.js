// server/utils/progressEmails.js
// Who hears about a student's progress, and the sends (fire-and-forget — a failed email
// never fails the request that triggered it):
//   • homework graded        → the student; a managed student's family (if their
//                              homework/quiz-link emails are on); linked parent accounts
//   • certificate awarded    → same people, with the certificate PDF attached
//   • payment / points paid  → same people (a receipt)
// Templates: emails/progressEmails.js.
import { studentSchema } from "../schemas/studentSchema.js";
import { parentSchema } from "../schemas/parentSchema.js";
import { homeworkSchema } from "../schemas/homeworkSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { classPricingSchema } from "../schemas/classPricingSchema.js";
import { getCenterBaseUrl } from "../emails/core.js";
import { langOf } from "../emails/i18n.js";
import { sendHomeworkGradedEmail, sendCertificateEmail, sendPaymentReceiptEmail } from "../emails/progressEmails.js";
import { loadCenterSettings, prefOn } from "./familyEmailPrefs.js";
import { getCert, buildCertificatePdf, checkAndAwardCertificates } from "./certificates.js";
import mongoose from "mongoose";
import Center from "../models/master/Center.js";
import logger from "./logger.js";

const getStudent  = (db) => db.models.Student      || db.model("Student",      studentSchema);
const getParent   = (db) => db.models.Parent       || db.model("Parent",       parentSchema);
const getHomework = (db) => db.models.Homework     || db.model("Homework",     homeworkSchema);
const getTeacher  = (db) => db.models.Teacher      || db.model("Teacher",      teacherSchema);
const getPricing  = (db) => db.models.ClassPricing || db.model("ClassPricing", classPricingSchema);

const fullName = (u) => `${u?.firstName || ""} ${u?.lastName || ""}`.trim();

/**
 * Everyone to tell about this student: [{ to, lang, href }] (deduplicated), plus the student.
 * `familyPref`: the familyEmailPrefs kind that gates a managed student's family address
 * (null = always, for receipts and certificates).
 */
export async function progressRecipients(db, center, studentId, { familyPref = null } = {}) {
  const student = await getStudent(db).findById(studentId)
    .select(`+notifyEmail firstName lastName email isManaged status emailLanguage classCredits groupPoints ${familyPref || ""}`).lean();
  if (!student) return { student: null, list: [] };
  const { baseUrl } = getCenterBaseUrl(center);
  const lang = langOf(student);
  const list = [];
  if (!student.isManaged && student.email && student.status !== "pending") {
    list.push({ to: student.email, lang, href: `${baseUrl}/student/dashboard` });
  }
  if (student.isManaged && student.notifyEmail &&
      (!familyPref || prefOn(student, await loadCenterSettings(db), familyPref))) {
    list.push({ to: student.notifyEmail, lang, href: null }); // the family has no login
  }
  const parents = await getParent(db).find({ children: student._id }).select("email").lean();
  for (const p of parents) if (p.email) list.push({ to: p.email, lang, href: `${baseUrl}/parent/dashboard` });
  const seen = new Set();
  return { student, list: list.filter((r) => { const k = r.to.trim().toLowerCase(); return !seen.has(k) && seen.add(k); }) };
}

const each = (list, send, what) => Promise.all(list.map((r) => send(r).catch((e) => logger.warn(`${what} email failed:`, { error: e?.message }))));

/** After a teacher grades homework */
export async function emailHomeworkGraded(db, center, homeworkId) {
  try {
    const hw = await getHomework(db).findById(homeworkId).select("title studentId teacherId grade status").lean();
    if (!hw || hw.status !== "graded") return;
    const [{ student, list }, teacher] = await Promise.all([
      progressRecipients(db, center, hw.studentId, { familyPref: "shareLinkEmails" }),
      getTeacher(db).findById(hw.teacherId).select("firstName lastName displayName").lean(),
    ]);
    if (!student) return;
    const teacherName = teacher?.displayName?.trim() || fullName(teacher);
    await each(list, (r) => sendHomeworkGradedEmail({ ...r, studentName: student.firstName, teacherName, homework: hw, center }), "Homework graded");
  } catch (err) {
    logger.warn("Homework graded emails failed:", { error: err?.message });
  }
}

/** After a certificate is created (by an admin or a milestone) — PDF attached */
export async function emailCertificate(db, center, certId) {
  try {
    const cert = await getCert(db).findById(certId).lean();
    if (!cert) return;
    const { student, list } = await progressRecipients(db, center, cert.studentId);
    if (!student || !list.length) return;
    const fullCenter = center?.slug ? (await Center.findOne({ slug: center.slug }).lean()) || center : center;
    let pdf = null;
    try { pdf = await buildCertificatePdf(cert, student, fullCenter); } catch (e) { logger.warn("Certificate PDF for email failed:", { error: e?.message }); }
    await each(list, (r) => sendCertificateEmail({ ...r, studentName: student.firstName, cert, pdf, center }), "Certificate");
  } catch (err) {
    logger.warn("Certificate emails failed:", { error: err?.message });
  }
}

/**
 * Award any milestone certificates a newly completed class earned; their emails go out
 * in the background. Returns the new certificates. Called from every completion path.
 */
export async function awardMilestonesAndNotify(db, studentId, center) {
  if (!studentId) return []; // a missing id would count every student's classes
  // The center lives in the master DB — if it's not connected, skip rather than let the
  // query wait (Mongoose buffers ~10 s) and hold up the class completion that called us
  if (mongoose.connection.readyState !== 1) return [];
  try {
    const slug = center?.slug || db.name;
    const centerDoc = center?._id ? center : await Center.findOne({ slug }).select("_id slug centerName customDomain domainVerified branding").lean();
    if (!centerDoc) return [];
    const awarded = await checkAndAwardCertificates(db, studentId, slug, centerDoc._id);
    for (const cert of awarded) emailCertificate(db, centerDoc, cert._id);
    return awarded;
  } catch (err) {
    logger.warn("Milestone certificates failed:", { error: err?.message });
    return [];
  }
}

/** After a payment for classes / a group points sale is recorded */
export async function emailPaymentReceipt(db, center, { studentId, amount, count, kind = "classes", method, pending = false }) {
  try {
    if (!(Number(amount) > 0)) return; // free points / zero amounts need no receipt
    const [{ student, list }, pricing] = await Promise.all([
      progressRecipients(db, center, studentId),
      getPricing(db).findOne().select("currencySymbol").lean(),
    ]);
    if (!student) return;
    const balance = kind === "points" ? student.groupPoints : student.classCredits;
    await each(list, (r) => sendPaymentReceiptEmail({
      ...r, studentName: fullName(student), amount, symbol: pricing?.currencySymbol || "", count, kind, method, pending, balance, center,
    }), "Payment receipt");
  } catch (err) {
    logger.warn("Payment receipt emails failed:", { error: err?.message });
  }
}
