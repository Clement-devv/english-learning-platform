// server/utils/parentCheckFilters.js
// Which bookings the admin "Parent checks" list covers, and its buckets. Shared by the
// list (routes/parentCheckRoutes.js) and the dashboard's attention counts
// (routes/attentionRoutes.js) so the two always agree.

/** Teacher-confirmed classes of managed students: completed, or teacher-logged and awaiting
 *  approval. (Real students confirm logged classes in their dashboard — autoConfirmAt.) */
export const PARENT_CHECK_BASE = { attendanceConfirmedBy: "teacher", status: { $in: ["completed", "pending_confirmation"] }, autoConfirmAt: { $exists: false } };
/** Parent said the class didn't happen and the dispute is still open */
export const PARENT_CHECK_DISPUTED = { "parentCheck.status": "denied", disputeStatus: "pending" };
/** No answer yet (null also matches "no check sent yet") */
export const PARENT_CHECK_WAITING = { "parentCheck.status": { $in: ["waiting", null] } };
/** Settled: attended, no reply, or a denial that has been resolved */
export const PARENT_CHECK_ANSWERED = { $or: [{ "parentCheck.status": { $in: ["confirmed", "no_reply"] } }, { "parentCheck.status": "denied", disputeStatus: { $ne: "pending" } }] };
