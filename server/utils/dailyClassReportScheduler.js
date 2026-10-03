// server/utils/dailyClassReportScheduler.js
// Emails the daily completed-classes report (PDF) once a day, just after
// midnight in the SCHOOL'S time zone, covering the day that just ended
// (12:00 AM – 11:59 PM local):
//   • admins get the full report (every teacher)
//   • each teacher gets their own report (only their classes)
//
// Checks every 15 minutes; ReminderLog makes sure each day is sent exactly
// once. If the server was down at midnight, the report goes out on the first
// check after it comes back.

import crypto from "crypto";
import mongoose from "mongoose";
import Center from "../models/master/Center.js";
import { reminderLogSchema } from "../schemas/reminderLogSchema.js";
import { adminSchema } from "../schemas/adminSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import {
  buildDailyClassReport, renderDailyClassReportPdf, safeTimeZone, yesterdayInZone,
  teachersInReport, reportForTeacher,
} from "./dailyClassReport.js";
import { sendDailyClassReportEmail, sendTeacherDailyClassReportEmail } from "./emailService.js";
import logger from "./logger.js";

const getReminderLog = (db) => db.models.ReminderLog || db.model("ReminderLog", reminderLogSchema);
const getAdmin       = (db) => db.models.Admin       || db.model("Admin",       adminSchema);
const getTeacher     = (db) => db.models.Teacher     || db.model("Teacher",     teacherSchema);

const CHECK_EVERY_MS = 15 * 60 * 1000;

// ReminderLog keys on an ObjectId — derive a stable one from the report date
// (and teacher, for teacher copies)
const reportRefId = (date, who = "admins") => new mongoose.Types.ObjectId(
  crypto.createHash("md5").update(`daily-class-report:${date}:${who}`).digest("hex").slice(0, 24),
);

/** Run send() at most once per (type, refId); undo the claim if it fails so it is retried */
async function sendOnce(db, type, refId, send) {
  try {
    await getReminderLog(db).create({ type, refId });
  } catch (err) {
    if (err.code === 11000) return; // already sent
    throw err;
  }
  try {
    await send();
  } catch (err) {
    await getReminderLog(db).deleteOne({ type, refId }).catch(() => {});
    throw err;
  }
}

/** Admin email addresses for the school (center contact + active admins) */
export async function reportRecipients(db, center) {
  const admins = await getAdmin(db).find({ active: { $ne: false } }).select("email").lean();
  const list = [center?.adminEmail, ...admins.map(a => a.email)]
    .filter(Boolean).map(e => String(e).toLowerCase().trim());
  return [...new Set(list)];
}

/** Build + email the report for one local date. Returns true when sent. */
export async function sendDailyClassReport(db, center, date, prebuilt = null) {
  const tz     = safeTimeZone(center?.timezone);
  const report = prebuilt || await buildDailyClassReport(db, { date, tz });

  const total = report.counts.completed + report.counts.notCompleted
              + report.counts.changedToCompleted + report.counts.changedToNotCompleted;
  if (total === 0) {
    logger.info(`📋 Daily class report ${date} (${center.slug}): no classes — not sent`);
    return false;
  }

  const to = await reportRecipients(db, center);
  if (!to.length) return false;

  const pdfBuffer = await renderDailyClassReportPdf(report, center.centerName || "");
  const result = await sendDailyClassReportEmail({ to, report, pdfBuffer, centerName: center.centerName || "" });
  if (result && result.success === false) throw new Error(result.error || "email failed");
  logger.info(`📋 Daily class report ${date} sent → ${to.length} admin(s) (${center.slug})`);
  return true;
}

/** Email one teacher their own report for the day. Returns true when sent. */
export async function sendTeacherDailyClassReport(db, center, report, teacherId) {
  const teacher = await getTeacher(db).findById(teacherId).select("firstName lastName email active").lean();
  if (!teacher?.email || teacher.active === false) return false;
  const mine = reportForTeacher(report, teacherId);
  const teacherName = `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();
  const pdfBuffer = await renderDailyClassReportPdf(mine, center.centerName || "", {
    title: `Your classes — ${teacherName || "Teacher"}`, forTeacher: true,
  });
  const result = await sendTeacherDailyClassReportEmail({
    to: teacher.email, teacherName, report: mine, pdfBuffer, centerName: center.centerName || "",
  });
  if (result && result.success === false) throw new Error(result.error || "email failed");
  return true;
}

export function startDailyClassReportScheduler(db, center) {
  const slug = center?.slug || db.name;

  const tick = async () => {
    if (db.readyState !== 1) return;
    try {
      // Re-read so time zone / admin email changes apply without a restart
      const fresh = await Center.findOne({ slug, status: "active" }).select("slug centerName timezone adminEmail").lean();
      if (!fresh) return;
      const tz   = safeTimeZone(fresh.timezone);
      const date = yesterdayInZone(tz);

      // Skip quickly when everything for this day has gone out already
      const adminRef = reportRefId(date);
      const adminDone = await getReminderLog(db).exists({ type: "daily_class_report", refId: adminRef });
      const report = await buildDailyClassReport(db, { date, tz });
      const teachers = teachersInReport(report);
      if (adminDone && teachers.length === 0) return;

      // Admin copy (whole school)
      await sendOnce(db, "daily_class_report", adminRef, () => sendDailyClassReport(db, fresh, date, report))
        .catch(err => logger.error(`Daily class report (admins) error (${slug}):`, { error: err?.message }));

      // Each teacher's own copy
      let sent = 0;
      for (const { teacherId } of teachers) {
        await sendOnce(db, "daily_class_report_teacher", reportRefId(date, teacherId), async () => {
          if (await sendTeacherDailyClassReport(db, fresh, report, teacherId)) sent++;
        }).catch(err => logger.error(`Daily class report (teacher ${teacherId}) error (${slug}):`, { error: err?.message }));
      }
      if (sent) logger.info(`📋 Daily class report ${date} sent → ${sent} teacher(s) (${slug})`);
    } catch (err) {
      logger.error(`Daily class report error (${slug}):`, { error: err?.message });
    }
  };

  logger.info(`📋 Daily class report scheduler started for center: ${slug}`);
  setTimeout(tick, 60 * 1000); // shortly after start-up (catch up a missed midnight)
  setInterval(tick, CHECK_EVERY_MS);
}
