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
 *     → mark as missed with attendance reason (handled by completeClass already,
 *       but catches edge cases where the classroom didn't call complete)
 *
 * Does NOT deduct student credits or add teacher earnings — nobody joined.
 * Safe to run multiple times — uses an optimistic lock (status: "accepted")
 * so concurrent runs never double-process.
 */

import { bookingSchema }          from "../schemas/bookingSchema.js";
import { classroomSessionSchema } from "../schemas/classroomSessionSchema.js";
import { logger } from '../utils/logger.js';

const getBooking          = (db) => db.models.Booking          || db.model("Booking",          bookingSchema);
const getClassroomSession = (db) => db.models.ClassroomSession || db.model("ClassroomSession", classroomSessionSchema);

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

async function sweepMissedClasses(db) {
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
  sweepMissedClasses(db).catch(err =>
    logger.error("[MissedClassSweep] Initial sweep error:", { error: err?.message })
  );

  const id = setInterval(() => {
    sweepMissedClasses(db).catch(err =>
      logger.error("[MissedClassSweep] Sweep error:", { error: err?.message })
    );
  }, INTERVAL_MS);

  logger.info(`[MissedClassSweep] Scheduler started (every ${INTERVAL_MS / 60000} min)`);
  return id;
}
