/**
 * missedClassScheduler.js
 *
 * Runs every 5 minutes per active center.
 * Finds bookings that are still "accepted" but whose scheduled end time has
 * already passed (scheduledTime + duration) — meaning the class window is over
 * and nobody triggered a completion.
 *
 * Logic:
 *   - If NOBODY joined (no ClassroomSession, or session has no join timestamps)
 *     → mark as missed: "Neither teacher nor student joined."
 *   - If only one side joined
 *     → mark as missed with the appropriate reason
 *   - If both joined but bothActiveTime < requiredTime
 *     → mark as missed with attendance reason
 *   - If both joined AND the attendance requirement was met (the classroom
 *     never called complete — e.g. the browser closed at the end)
 *     → complete it through completeClass(): student charged, teacher paid.
 *       Managed students also get the parent-check link, as in the classroom flow.
 *
 * Missed classes are NOT charged or paid.
 * Safe to run multiple times — uses an optimistic lock (status: "accepted")
 * so concurrent runs never double-process.
 */

import { bookingSchema }          from "../schemas/bookingSchema.js";
import { classroomSessionSchema } from "../schemas/classroomSessionSchema.js";
import { studentSchema }          from "../schemas/studentSchema.js";
import { completeClass }          from "../services/classCompletionService.js";
import { issueShareLink }         from "./shareLink.js";
import { logger } from '../utils/logger.js';
import { trackJob } from "./monitor.js";
import { sweepGroupClasses } from "./groupClassSweep.js";

const getBooking          = (db) => db.models.Booking          || db.model("Booking",          bookingSchema);
const getClassroomSession = (db) => db.models.ClassroomSession || db.model("ClassroomSession", classroomSessionSchema);
const getStudent          = (db) => db.models.Student          || db.model("Student",          studentSchema);

/** Same rule as completeClass(): both joined and together ≥ 83% of the class. */
function attendanceMet(session, durationMinutes) {
  if (!session?.teacherJoinedAt || !session?.studentJoinedAt) return false;
  const requiredTime = session.requiredTime ?? Math.floor((durationMinutes || 60) * 60 * 0.83);
  return (session.bothActiveTime || 0) >= requiredTime;
}

/** Attended class nobody marked complete → pay it via the single completion path. */
async function completeAttendedClass(db, booking) {
  const result = await completeClass(db, booking._id, "system");
  if (!result.completed || result.alreadyProcessed) return;

  // Managed student (no login): the teacher confirmed attendance — ask the parent, as classroomRoutes does
  const student = await getStudent(db).findById(result.booking.studentId).select("isManaged").lean();
  if (student?.isManaged) {
    const doc = await getBooking(db).findById(booking._id);
    if (doc && !doc.shareLink?.createdAt) {
      issueShareLink(doc);
      doc.parentCheck = { status: "waiting" };
      doc.attendanceConfirmedBy = "teacher";
      await doc.save();
    }
  }
  logger.info(`[MissedClassSweep] Booking "${booking.classTitle}" (${booking._id}) → completed (attendance met, classroom never closed it)`);
}

const INTERVAL_MS    = 5 * 60 * 1000; // run every 5 minutes
const GRACE_PERIOD_MS = 2 * 60 * 1000; // 2-minute grace after class ends before sweeping

function buildMissedReason(session) {
  if (!session) return "Neither teacher nor student joined.";
  const teacherJoined = !!session.teacherJoinedAt;
  const studentJoined = !!session.studentJoinedAt;
  if (!teacherJoined && !studentJoined) return "Neither teacher nor student joined.";
  if (!teacherJoined) return "Teacher did not join the class.";
  if (!studentJoined) return "Student did not join the class.";
  const bothMins     = Math.floor((session.bothActiveTime || 0) / 60);
  const requiredMins = Math.floor((session.requiredTime   || 0) / 60);
  const pct = session.requiredTime > 0
    ? Math.round(((session.bothActiveTime || 0) / session.requiredTime) * 100)
    : 0;
  return `Insufficient attendance: ${bothMins}m of ${requiredMins}m required (${pct}% — need ≥83%).`;
}

/**
 * Class requests the teacher never accepted, whose time is over → missed. Nothing
 * was charged for a request, so nothing is refunded. (Before, these stayed
 * "pending" forever and kept showing as upcoming.)
 */
export async function expirePendingRequests(db, now = new Date()) {
  const Booking = getBooking(db);
  const stale = await Booking.find({
    status: "pending",
    scheduledTime: { $lt: new Date(now.getTime() - GRACE_PERIOD_MS) },
  }).select("_id scheduledTime duration classTitle").lean();
  let expired = 0;
  for (const b of stale) {
    if (now.getTime() - GRACE_PERIOD_MS < new Date(b.scheduledTime).getTime() + (b.duration || 60) * 60000) continue;
    const r = await Booking.updateOne(
      { _id: b._id, status: "pending" },
      { $set: { status: "missed", markedBy: "system", completedAt: now,
                missedReason: "The teacher didn't accept the class request before the class time." } },
    );
    if (r.modifiedCount) { expired++; logger.info(`[MissedClassSweep] Request "${b.classTitle}" (${b._id}) → missed (never accepted)`); }
  }
  return expired;
}

/** Everything the 5-minute sweep closes: unaccepted requests, missed / attended classes, group classes. */
export async function sweepEndedClasses(db) {
  await expirePendingRequests(db);
  await sweepMissedClasses(db);
  await sweepGroupClasses(db);
}

export async function sweepMissedClasses(db) {
  const Booking          = getBooking(db);
  const ClassroomSession = getClassroomSession(db);

  const now = new Date();

  // Find all accepted bookings whose scheduled end time is in the past
  // (scheduledTime + duration minutes) + grace period
  // We query scheduledTime < (now - grace - min duration) as a rough pre-filter,
  // then do the exact check in JS.
  const candidates = await Booking.find({
    status:        "accepted",
    scheduledTime: { $lt: new Date(now.getTime() - GRACE_PERIOD_MS) },
  })
    .select("_id scheduledTime duration classTitle")
    .lean();

  if (candidates.length === 0) return;

  const toMark = candidates.filter(b => {
    const durationMs  = ((b.duration || 60) * 60 * 1000);
    const classEndTime = new Date(b.scheduledTime).getTime() + durationMs;
    return (now.getTime() - GRACE_PERIOD_MS) >= classEndTime;
  });

  if (toMark.length === 0) return;

  logger.info(`[MissedClassSweep] Checking ${toMark.length} overdue booking(s)...`);

  for (const booking of toMark) {
    try {
      const attended = await ClassroomSession.findOne({ bookingId: booking._id }).lean();
      if (attendanceMet(attended, booking.duration)) {
        await completeAttendedClass(db, booking);
        continue;
      }

      // Optimistic lock — only claim if still "accepted"
      const claimed = await Booking.findOneAndUpdate(
        { _id: booking._id, status: "accepted" },
        { $set: { status: "processing" } },
        { new: false }
      );
      if (!claimed) continue; // already claimed by another process or state changed

      // Look up session (may not exist if nobody ever opened the classroom)
      const session = await ClassroomSession.findOne({ bookingId: booking._id });
      const missedReason = buildMissedReason(session);

      // Mark booking as missed
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            status:       "missed",
            markedBy:     "system",
            missedReason,
            completedAt:  now,
          },
        }
      );

      // Update session if it exists
      if (session) {
        await ClassroomSession.updateOne(
          { _id: session._id },
          { $set: { status: "missed", classEndedAt: now } }
        );
      }

      logger.info(`[MissedClassSweep] Booking "${booking.classTitle}" (${booking._id}) → missed. Reason: ${missedReason}`);

    } catch (err) {
      // Release the processing lock so it can be retried next sweep
      try {
        await Booking.updateOne(
          { _id: booking._id, status: "processing" },
          { $set:  { status: "accepted" } }
        );
      } catch (_) {}
      logger.error(`[MissedClassSweep] Error on booking ${booking._id}:`, { error: err?.message });
    }
  }
}

/**
 * Start the missed-class sweep for one center DB.
 * Call once per center on server startup.
 * Returns the interval ID so it can be cleared if needed.
 */
export function startMissedClassScheduler(db) {
  // Run once immediately on startup to catch anything that was missed during downtime
  sweepEndedClasses(db).catch(err =>
    logger.error("[MissedClassSweep] Initial sweep error:", { error: err?.message })
  );

  const id = setInterval(trackJob("Missed-class check", db.name, INTERVAL_MS, () =>
    sweepEndedClasses(db).catch(err => {
      logger.error("[MissedClassSweep] Sweep error:", { error: err?.message });
      throw err; // → App Health
    })
  ), INTERVAL_MS);

  logger.info(`[MissedClassSweep] Scheduler started (every ${INTERVAL_MS / 60000} min)`);
  return [id];
}
