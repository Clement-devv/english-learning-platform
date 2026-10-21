// server/utils/adminNotify.js
// Add an entry to the admin Notifications tab (schemas/notificationSchema.js).
// Fire-and-forget: a failed notification never breaks the action that caused it.
// The live-update plugin pushes "notifications" to admins, so the badge updates at once.
import { notificationSchema } from "../schemas/notificationSchema.js";
import logger from "./logger.js";
import { pushAdmins } from "./notifyPush.js";

const getNotification = (db) => db.models.Notification || db.model("Notification", notificationSchema);

/**
 * @param {object} db center connection
 * @param {{ type: string, message: string, actorName?: string, actorRole?: string, metadata?: object }} n
 */
// Pop-up titles for the Notifications-tab entries (anything else: a generic one)
const TITLES = {
  booking_accepted: "✅ Class accepted",
  booking_rejected: "❌ Class declined",
};

export function notifyAdmins(db, { type, message, actorName = "", actorRole = "", metadata = {} }) {
  // Also a phone / desktop pop-up for admins who turned notifications on
  pushAdmins(db, TITLES[type] || "🔔 New notification", message, {
    tag: `note-${type}-${metadata.bookingId || Date.now()}`, tab: "notifications",
  });
  return getNotification(db)
    .create({ type, message, actorName, actorRole, metadata })
    .catch((e) => logger.warn("Admin notification failed", { type, error: e?.message }));
}
