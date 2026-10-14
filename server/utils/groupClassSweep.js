// server/utils/groupClassSweep.js
// Closes group classes whose time has passed, so they don't stay "Open" or
// "In progress" forever. Runs with the missed-class sweep (missedClassScheduler.js).
//
//   • Never started (open / full) once the class has ended
//       → missed: "The class was never started." Everyone gets their points / credits back.
//   • Started, but nobody completed it, after the class end + a short wait
//       → a student joined (GET /group-classes/:id/join records it)
//            completed: joined = attended, others absent; the teacher fee is paid (once)
//       → no student joined
//            missed: "No students joined." Everyone refunded.
//
// Each class is claimed with a status-conditioned update, so two runs (or a teacher
// pressing Complete at the same moment) can never close or refund it twice.
import { groupClassSchema } from "../schemas/groupClassSchema.js";
import { refundEnrollment, payGroupClassFee } from "./groupPoints.js";
import logger from "./logger.js";

const getGroupClass = (db) => db.models.GroupClass || db.model("GroupClass", groupClassSchema);

export const NOT_STARTED_GRACE_MS = 2 * 60 * 1000;   // after the class ends
export const IN_PROGRESS_GRACE_MS = 10 * 60 * 1000;  // a running class may overrun a little

const endOf = (gc) => new Date(gc.scheduledTime).getTime() + (gc.duration || 60) * 60000;

async function markMissed(db, gc, fromStatuses, reason, now) {
  const before = await getGroupClass(db).findOneAndUpdate(
    { _id: gc._id, status: { $in: fromStatuses } },
    { $set: { status: "missed", missedReason: reason, completedAt: now } },
    { new: false },
  ).lean();
  if (!before) return false; // someone else closed it first
  for (const e of before.enrollments || []) {
    await refundEnrollment(db, before, e, { note: "Class did not take place" });
  }
  logger.info(`[GroupClassSweep] "${gc.title}" (${gc._id}) → missed: ${reason}`);
  return true;
}

export async function sweepGroupClasses(db, now = new Date()) {
  const GroupClass = getGroupClass(db);
  const t = now.getTime();
  const candidates = await GroupClass.find({
    status: { $in: ["open", "full", "in-progress"] },
    scheduledTime: { $lt: new Date(t - NOT_STARTED_GRACE_MS) },
  }).select("title scheduledTime duration status enrollments").lean();

  let closed = 0;
  for (const gc of candidates) {
    try {
      const end = endOf(gc);
      if (gc.status !== "in-progress") {
        if (t - NOT_STARTED_GRACE_MS < end) continue;
        if (await markMissed(db, gc, ["open", "full"], "The class was never started.", now)) closed++;
        continue;
      }
      if (t - IN_PROGRESS_GRACE_MS < end) continue;

      const joined = (gc.enrollments || []).filter((e) => e.joinedAt);
      if (!joined.length) {
        if (await markMissed(db, gc, ["in-progress"], "No students joined.", now)) closed++;
        continue;
      }
      // Students came, the teacher just never pressed Complete: close it as they would
      const enrollments = gc.enrollments.map((e) => ({
        ...e,
        attendance: e.attendance && e.attendance !== "pending" ? e.attendance : (e.joinedAt ? "attended" : "absent"),
      }));
      const done = await GroupClass.updateOne(
        { _id: gc._id, status: "in-progress" },
        { $set: { status: "completed", completedAt: now, enrollments } },
      );
      if (!done.modifiedCount) continue;
      closed++;
      const fee = await payGroupClassFee(db, gc._id)
        .catch((err) => { logger.error("[GroupClassSweep] fee error:", { error: err?.message }); return 0; });
      logger.info(`[GroupClassSweep] "${gc.title}" (${gc._id}) → completed automatically (${joined.length} joined${fee ? `, fee ${fee} paid` : ""})`);
    } catch (err) {
      logger.error(`[GroupClassSweep] Error on group class ${gc._id}:`, { error: err?.message });
    }
  }
  return closed;
}
