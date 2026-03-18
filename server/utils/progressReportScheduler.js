// server/utils/progressReportScheduler.js
//
// Runs every hour and sends:
//   - Weekly reports  → every Monday at 08:00 (server local time)
//   - Monthly reports → 1st of every month at 08:00
//
// Uses ReminderLog to ensure each report is sent exactly once.

import Student        from "../models/Student.js";
import Teacher        from "../models/Teacher.js";
import Booking        from "../models/Booking.js";
import ReminderLog    from "../models/ReminderLog.js";
import { generateProgressReport } from "./progressReportGenerator.js";
import { sendProgressReport }     from "./emailService.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
async function markSent(key) {
  try {
    await ReminderLog.create({ type: key, refId: key });
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
async function primaryTeacher(studentId) {
  const last = await Booking.findOne({ studentId, status: "completed" })
    .sort({ scheduledTime: -1 })
    .populate("teacherId", "firstName lastName");
  return last?.teacherId ?? null;
}

// ── Send one report ───────────────────────────────────────────────────────────
async function sendReport(student, period, from, to, logKey) {
  if (!(await markSent(logKey))) return;  // already sent this cycle

  try {
    const teacher   = await primaryTeacher(student._id);
    const pdfBuffer = await generateProgressReport(student, teacher, from, to, period);
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
async function checkWeeklyReports() {
  const now = new Date();
  if (now.getDay() !== 1)    return;  // not Monday
  if (now.getHours() !== 8)  return;  // not 8am hour

  // Window = last 7 days (Mon 00:00 to Sun 23:59)
  const to   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekKey = `w${now.getFullYear()}-${isoWeek(now)}`;

  const students = await Student.find({ status: "active" });
  for (const student of students) {
    if (!student.email) continue;
    await sendReport(student, "weekly", from, to, `weekly_${weekKey}_${student._id}`);
  }
}

// ── Monthly check (runs 1st of month 08:00) ───────────────────────────────────
async function checkMonthlyReports() {
  const now = new Date();
  if (now.getDate()   !== 1) return;  // not 1st of month
  if (now.getHours()  !== 8) return;  // not 8am hour

  // Window = entire previous month
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to   = new Date(now.getFullYear(), now.getMonth(),     1);
  const monthKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;

  const students = await Student.find({ status: "active" });
  for (const student of students) {
    if (!student.email) continue;
    await sendReport(student, "monthly", from, to, `monthly_${monthKey}_${student._id}`);
  }
}

// ── Main tick (runs every hour) ───────────────────────────────────────────────
async function runTick() {
  try {
    await Promise.all([
      checkWeeklyReports(),
      checkMonthlyReports(),
    ]);
  } catch (err) {
    console.error("Progress report scheduler error:", err.message);
  }
}

export function startProgressReportScheduler() {
  console.log("📊 Progress report scheduler started (hourly check)");
  runTick();
  setInterval(runTick, 60 * 60 * 1000);  // every 1 hour
}
