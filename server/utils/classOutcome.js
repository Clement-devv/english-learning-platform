// server/utils/classOutcome.js
// Record that a class's outcome changed after the fact (completed → not
// completed, or not completed → completed). The daily completed-classes report
// shows these on the day the change happened, referencing the class's date.

/**
 * Push an outcome change onto a Booking document (caller saves it).
 * @param {object} booking  Mongoose Booking document
 * @param {object} change
 * @param {'completed'|'not_completed'} change.to
 * @param {'admin'|'dispute'|'parent'|'system'} [change.source]
 * @param {string} [change.reason]
 */
export function recordOutcomeChange(booking, { to, source = "system", reason = "" }) {
  if (!booking) return;
  if (!Array.isArray(booking.outcomeChanges)) booking.outcomeChanges = [];
  booking.outcomeChanges.push({ at: new Date(), to, source, reason: String(reason || "").slice(0, 500) });
}

/** Same, for code paths that use updateOne instead of a document */
export function outcomeChangePush({ to, source = "system", reason = "" }) {
  return { $push: { outcomeChanges: { at: new Date(), to, source, reason: String(reason || "").slice(0, 500) } } };
}
