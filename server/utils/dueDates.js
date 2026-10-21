// server/utils/dueDates.js
// Changing a homework / quiz due date (teacher). The share link for a managed student
// lives until the end of the due date (utils/shareLink.js → linkExpiresAt), so moving the
// date also reopens an expired link — same token, nothing to resend by hand.
import { reminderLogSchema } from "../schemas/reminderLogSchema.js";
import { linkExpiresAt } from "./shareLink.js";

const MAX_AHEAD_DAYS = 365;
const getReminderLog = (db) => db.models.ReminderLog || db.model("ReminderLog", reminderLogSchema);

const bad = (message) => Object.assign(new Error(message), { statusCode: 400 });

/**
 * A new due date from the request ("2026-10-25" from a date input, or an ISO string).
 * It must still be open at the end of that day in the center's time zone, and at most a
 * year ahead. Throws { statusCode: 400 } otherwise.
 */
export function parseNewDueDate(raw, timeZone = "UTC") {
  if (typeof raw !== "string" || !raw.trim()) throw bad("Choose the new due date");
  const date = new Date(raw.trim());
  if (isNaN(date)) throw bad("That due date isn't a valid date");
  if (linkExpiresAt(date, timeZone).getTime() <= Date.now()) throw bad("The new due date must be today or later");
  if (date.getTime() > Date.now() + MAX_AHEAD_DAYS * 86400000) throw bad("The due date can be at most a year ahead");
  return date;
}

/** The 30-minute "due soon" reminder is sent once per item — let it go out again for the new date */
export async function forgetDueReminder(db, kind, id) {
  await getReminderLog(db).deleteOne({ type: `${kind}_30min_${id}` }).catch(() => {});
}
