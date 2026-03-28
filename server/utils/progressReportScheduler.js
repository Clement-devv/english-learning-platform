// server/utils/progressReportScheduler.js
//
// Runs every hour and sends:
//   - Weekly reports  → every Monday at 08:00 (server local time)
//   - Monthly reports → 1st of every month at 08:00
//
// Uses ReminderLog to ensure each report is sent exactly once.
// Call startProgressReportScheduler(db) once per active center connection.

import { studentSchema }     from "../schemas/studentSchema.js";
import { bookingSchema }     from "../schemas/bookingSchema.js";
import { reminderLogSchema } from "../schemas/reminderLogSchema.js";
import { generateProgressReport } from "./progressReportGenerator.js";
import { sendProgressReport }     from "./emailService.js";

const getStudent     = (db) => db.models.Student     || db.model("Student",     studentSchema);
const getBooking     = (db) => db.models.Booking     || db.model("Booking",     bookingSchema);
const getReminderLog = (db) => db.models.ReminderLog || db.model("ReminderLog", reminderLogSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────
async function markSent(db, key) {
  try {
    await getReminderLog(db).create({ type: key, refId: key });
    return true;    // first time → proceed
  } catch (err) {
    if (err.code === 11000) return false;  // already sent
    throw err;
  }
}

/** ISO week number (Mon = day 1) */
function isoWeek(date) {
  const d  = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ── Find the teacher most associated with a student ───────────────────────────
async function primaryTeacher(db, studentId) {
  const last = await getBooking(db).findOne({ studentId, status: "completed" })
    .sort({ scheduledTime: -1 })
    .populate("teacherId", "firstName lastName");
  return last?.teacherId ?? null;
}

// ── Send one report ───────────────────────────────────────────────────────────
async function sendReport(db, student, period, from, to, logKey) {
  if (!(await markSent(db, logKey))) return;  // already sent this cycle

  try {
    const teacher   = await primaryTeacher(db, student._id);
    const pdfBuffer = await generateProgressReport(db, student, teacher, from, to, period);
    const result    = await sendProgressReport(student, pdfBuffer, period, from, to);
    if (result.success) {
      console.log(`📊 ${period} report sent → ${student.email} (${from.toISOString().slice(0,10)})`);
    } else {
      console.error(`❌ Progress report failed → ${student.email}: ${result.error}`);
    }
  } catch (err) {
    console.error(`❌ Progress report error for ${student.email}:`, err.message);
  }
}

// ── Weekly check (runs Mon 08:00) ─────────────────────────────────────────────
async function checkWeeklyReports(db) {
  const now = new Date();
  if (now.getDay()   !== 1) return;  // not Monday
  if (now.getHours() !== 8) return;  // not 8am hour

  const to   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekKey = `w${now.getFullYear()}-${isoWeek(now)}`;

  const students = await getStudent(db).find({ status: "active" });
  for (const student of students) {
    if (!student.email) continue;
    await sendReport(db, student, "weekly", from, to, `weekly_${weekKey}_${student._id}`);
  }
}

// ── Monthly check (runs 1st of month 08:00) ───────────────────────────────────
async function checkMonthlyReports(db) {
  const now = new Date();
  if (now.getDate()  !== 1) return;  // not 1st of month
  if (now.getHours() !== 8) return;  // not 8am hour

  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to   = new Date(now.getFullYear(), now.getMonth(),     1);
  const monthKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;

  const students = await getStudent(db).find({ status: "active" });
  for (const student of students) {
    if (!student.email) continue;
    await sendReport(db, student, "monthly", from, to, `monthly_${monthKey}_${student._id}`);
  }
}

// ── Main tick (runs every hour per center) ────────────────────────────────────
function makeTick(db) {
  return async function runTick() {
    if (db.readyState !== 1) return;
    try {
      await Promise.all([
        checkWeeklyReports(db),
        checkMonthlyReports(db),
      ]);
    } catch (err) {
      console.error("Progress report scheduler error:", err.message);
    }
  };
}

export function startProgressReportScheduler(db) {
  const centerSlug = db.name || "unknown";
  console.log(`📊 Progress report scheduler started for center: ${centerSlug} (hourly check)`);
  const runTick = makeTick(db);
  runTick();
  setInterval(runTick, 60 * 60 * 1000);
}
