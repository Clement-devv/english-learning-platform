// server/utils/parentCheck.js
// Rules for parent attendance checks (managed students). Used by
// routes/parentCheckRoutes.js, routes/disputeRoutes.js and the scheduler.
//
//   • The link lasts LINK_DAYS. No answer by then → "no_reply": the teacher's
//     confirmation stands (class counts as attended) and the link is killed.
//   • Parent says "No" → the class STAYS completed, a dispute opens and a
//     DISPUTE_DAYS countdown starts (shown as a red "heartbeat" warning).
//   • Admin settles it (either way) → link killed immediately.
//   • Nobody settles it in time → automatically resolved in the parent's favour:
//     a completed class is reversed (class back to the student, teacher's pay
//     deducted); a teacher-logged class still awaiting approval is rejected
//     (nothing was charged yet).
//   • Real (log-in) students confirm/dispute teacher-logged classes in their
//     dashboard instead of a link; same states, timed by booking.autoConfirmAt.
import { bookingSchema } from "../schemas/bookingSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { linkExpiresAt } from "./shareLink.js";
import { reverseCompletedClass } from "./classReversal.js";
import logger from "./logger.js";

export const LINK_DAYS    = 4;
export const DISPUTE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** When a parent-check link expires: end of the day LINK_DAYS after it was created (center time). */
export const parentCheckExpiresAt = (booking, timeZone) =>
  linkExpiresAt(
    new Date(new Date(booking.shareLink?.createdAt || booking.completedAt || Date.now()).getTime() + LINK_DAYS * DAY_MS),
    timeZone,
  );

/** Deadline for the admin to settle a parent's "No" before it auto-resolves for the parent. */
export const disputeDeadlineFrom = (respondedAt = new Date()) => new Date(new Date(respondedAt).getTime() + DISPUTE_DAYS * DAY_MS);

const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);

/**
 * One sweep for a center DB:
 *   1. Unanswered links past their expiry → "no_reply" (class stands), link removed.
 *   2. Parent disputes past their deadline with no decision → reversed for the parent.
 * Safe to run concurrently: each booking is claimed with a conditional update first.
 */
export async function sweepParentChecks(db, center) {
  db.models.Student || db.model("Student", studentSchema);
  db.models.Teacher || db.model("Teacher", teacherSchema);
  const Booking = getBooking(db);
  const now = new Date();

  // ── 1. No reply (parent link, or a real student's in-app confirmation) ──
  const waiting = await Booking.find({
    "parentCheck.status": "waiting",
    $or: [{ "shareLink.createdAt": { $exists: true } }, { autoConfirmAt: { $exists: true } }],
  }).select("_id completedAt shareLink.createdAt autoConfirmAt").lean();
  for (const b of waiting) {
    const expiry = b.shareLink?.createdAt ? parentCheckExpiresAt(b, center?.timezone) : new Date(b.autoConfirmAt);
    if (expiry > now) continue;
    await Booking.updateOne(
      { _id: b._id, "parentCheck.status": "waiting" },
      { $set: { "parentCheck.status": "no_reply", "parentCheck.respondedAt": now }, $unset: { shareLink: 1 } },
    );
    logger.info(`[ParentCheck] ${b._id}: no reply within ${LINK_DAYS} days — attendance stands`);
  }

  // ── 2. Unsettled parent disputes ──
  const overdue = await Booking.find({
    "parentCheck.status": "denied", disputeStatus: "pending",
    "parentCheck.disputeDeadline": { $lte: now },
  }).select("_id").lean();

  for (const { _id } of overdue) {
    // Claim it: only one sweep can move it out of "pending"
    const claimed = await Booking.findOneAndUpdate(
      { _id, disputeStatus: "pending", adminRejected: { $ne: true } },
      { $set: { disputeStatus: "resolved_student" } },
      { new: true },
    );
    if (!claimed) continue;
    try {
      const autoNote = `Automatically resolved for the parent — no decision within ${DISPUTE_DAYS} days.`;
      if (claimed.status === "completed") {
        await reverseCompletedClass(db, claimed, { reason: `Parent reported absence; not reviewed within ${DISPUTE_DAYS} days`, source: "parent" });
      } else if (claimed.status === "pending_confirmation") {
        // Teacher-logged class not approved yet: nothing was charged — just reject it
        await Booking.updateOne({ _id }, { $set: {
          status: "rejected", rejectionReason: "Logged class not approved: absence reported and not reviewed in time",
          "offline.approval.status": "rejected", "offline.approval.decidedAt": now, "offline.approval.note": autoNote,
        } });
      }
      await Booking.updateOne({ _id }, {
        $set: {
          disputeResolution: "auto_parent",
          disputeAdminNotes: autoNote,
          disputeResolvedAt: now,
        },
        $unset: { shareLink: 1 },
      });
      logger.warn(`[ParentCheck] ${_id}: dispute auto-resolved for parent (class reversed)`);
    } catch (err) {
      // Put it back so the next sweep retries
      await Booking.updateOne({ _id, disputeStatus: "resolved_student" }, { $set: { disputeStatus: "pending" } }).catch(() => {});
      logger.error(`[ParentCheck] ${_id}: auto-resolve failed`, { error: err?.message });
    }
  }
}

const INTERVAL_MS = 10 * 60 * 1000;

/** Start the sweep for one center (call once per center on startup). */
export function startParentCheckScheduler(db, center) {
  const run = () => sweepParentChecks(db, center).catch(err =>
    logger.error("[ParentCheck] Sweep error:", { error: err?.message }));
  run(); // catch up on anything that expired while the server was down
  const id = setInterval(run, INTERVAL_MS);
  logger.info(`[ParentCheck] Scheduler started for ${center?.slug} (every ${INTERVAL_MS / 60000} min)`);
  return id;
}
