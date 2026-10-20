// server/utils/centerJobs.js
// Per-center background jobs (reminders, missed-class check, parent checks,
// daily report, progress reports, recording cleanup, class video + summary emails) follow the center's status:
//   • a center that becomes active (approved, invite accepted, reactivated) gets
//     its jobs within SYNC_EVERY_MS — no restart needed;
//   • a center that is suspended / deleted / purged has its jobs stopped, so they
//     never keep running on a closed connection.
// Runs on ONE worker only (index.js — first PM2 instance), so it doesn't matter
// which worker handled the approve request.
import Center from "../models/master/Center.js";
import { getDb } from "../config/dbManager.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { startReminderScheduler } from "./reminderScheduler.js";
import { startRecordingCleanup } from "../routes/recordingRoutes.js";
import { startProgressReportScheduler } from "./progressReportScheduler.js";
import { startDailyClassReportScheduler } from "./dailyClassReportScheduler.js";
import { startMissedClassScheduler } from "./missedClassScheduler.js";
import { startParentCheckScheduler } from "./parentCheck.js";
import { startRecordingLinkScheduler } from "./recordingLinks.js";
import { startSummaryEmailScheduler } from "./classSummaryEmails.js";
import { startFamilyLinkScheduler } from "./familyLinkEmails.js";
import { backfillTeacherCodes } from "./teacherCode.js";
import logger from "./logger.js";

export const SYNC_EVERY_MS = 60 * 1000;

const running = new Map(); // slug → { timers: Timeout[] } (timers: null while starting)
let syncing = false;
let syncTimer = null;

/** Start every job for one active center. Safe to call twice — the second call is a no-op. */
export async function startCenterJobs(center) {
  const { slug } = center;
  if (running.has(slug)) return false;
  running.set(slug, { timers: null }); // claim before the await so a parallel sync can't double-start
  try {
    const db = await getDb(slug);
    if (!running.has(slug)) return false; // stopped while the connection was opening
    const timers = [
      ...startReminderScheduler(db),
      ...startRecordingCleanup(db),
      ...startProgressReportScheduler(db),
      ...startMissedClassScheduler(db),
      ...startParentCheckScheduler(db, center),
      ...startRecordingLinkScheduler(db, center), // email class video links to managed students
      ...startSummaryEmailScheduler(db, center),  // email teachers' class summaries to families
      ...startFamilyLinkScheduler(db, center),    // email parent attendance checks to families
      ...startDailyClassReportScheduler(db, center),
    ];
    running.set(slug, { timers });
    // Give teachers created before ID numbers existed a TCH-xxxxx code (once; no-op after)
    backfillTeacherCodes(db.models.Teacher || db.model("Teacher", teacherSchema))
      .catch(err => logger.warn("teacher code backfill failed", { center: slug, error: err?.message }));
    logger.info(`🏢 Background jobs started for ${slug}`);
    return true;
  } catch (err) {
    running.delete(slug); // retried on the next sync
    throw err;
  }
}

/** Stop every job for one center (suspended, deleted, about to be purged). */
export function stopCenterJobs(slug) {
  const job = running.get(slug);
  if (!job) return false;
  for (const t of job.timers || []) clearInterval(t); // clearInterval also clears setTimeout timers
  running.delete(slug);
  logger.info(`🛑 Background jobs stopped for ${slug}`);
  return true;
}

/** Make the running jobs match the active centers. One failing center never blocks the others. */
export async function syncCenterJobs() {
  if (syncing) return;
  syncing = true;
  try {
    const active = await Center.find({ status: "active" }).select("slug centerName timezone adminEmail").lean();
    const activeSlugs = new Set(active.map(c => c.slug));

    for (const slug of [...running.keys()]) {
      if (!activeSlugs.has(slug)) stopCenterJobs(slug);
    }
    for (const center of active) {
      if (running.has(center.slug)) continue;
      try {
        await startCenterJobs(center);
      } catch (err) {
        logger.error(`Could not start background jobs for ${center.slug} — will retry`, { error: err?.message });
      }
    }
  } catch (err) {
    logger.error("Center job sync failed:", { error: err?.message });
  } finally {
    syncing = false;
  }
}

/** Boot: start jobs for every active center now, then keep them in sync. */
export async function startCenterJobSync() {
  await syncCenterJobs();
  if (!syncTimer) syncTimer = setInterval(syncCenterJobs, SYNC_EVERY_MS);
  return syncTimer;
}

/** For tests / graceful shutdown */
export function stopAllCenterJobs() {
  for (const slug of [...running.keys()]) stopCenterJobs(slug);
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

export const runningCenterJobs = () => [...running.keys()];
