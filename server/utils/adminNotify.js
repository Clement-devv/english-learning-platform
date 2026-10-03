// server/utils/adminNotify.js
// Add an entry to the admin Notifications tab (schemas/notificationSchema.js).
// Fire-and-forget: a failed notification never breaks the action that caused it.
// The live-update plugin pushes "notifications" to admins, so the badge updates at once.
import { notificationSchema } from "../schemas/notificationSchema.js";
import logger from "./logger.js";

const getNotification = (db) => db.models.Notification || db.model("Notification", notificationSchema);

/**
 * @param {object} db center connection
 * @param {{ type: string, message: string, actorName?: string, actorRole?: string, metadata?: object }} n
 */
export function notifyAdmins(db, { type, message, actorName = "", actorRole = "", metadata = {} }) {
  return getNotification(db)
    .create({ type, message, actorName, actorRole, metadata })
    .catch((e) => logger.warn("Admin notification failed", { type, error: e?.message }));
}
