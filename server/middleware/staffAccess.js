// server/middleware/staffAccess.js
// Admin pages a sub-admin may also use when the admin gives them the permission
// (Sub-Admins tab). A sub-admin only ever sees / acts on their own teachers
// (assigned, or their region) and those teachers' students.
//
//   router.get("/", verifyToken, verifyAdminOrSubAdmin("canViewParentChecks"), handler)
//
// After it: req.admin (admin) OR req.subAdmin + req.teacherScope (sub-admin).
// Handlers narrow with scopeFilter(req) / inScope(req, teacherId).
import mongoose from "mongoose";
import { verifyAdmin, verifySubAdmin } from "./authMiddleware.js";
import { assignmentSchema } from "../schemas/assignmentSchema.js";
import { bookingSchema } from "../schemas/bookingSchema.js";

/** Permissions for the admin pages sub-admins can be given (all off by default). */
export const SUB_ADMIN_PAGE_PERMISSIONS = [
  "canViewClassReport",        // Class report — view, PDF, email to self
  "canManageGroupClasses",     // Group classes — create, edit, enroll, attendance, complete, cancel
  "canCreateBookings",         // Bookings — send class requests to teachers
  "canManageParentChecks",     // Parent checks — view, create / refresh links
  "canViewParentLinks",        // Parent links — homework / quiz share links
  "canViewLoggedClasses",      // Logged classes — view
  "canApproveLoggedClasses",   // Logged classes — approve (pays the teacher, uses a credit) / reject
];

const run = (mw, req, res) => new Promise((resolve) => {
  let passed = false;
  Promise.resolve(mw(req, res, () => { passed = true; resolve(true); }))
    .then(() => { if (!passed) resolve(false); }, () => resolve(false));
});

/**
 * Admin, or an active sub-admin holding `permission` (one key, or several = all required).
 */
export function verifyAdminOrSubAdmin(permission) {
  const needed = [].concat(permission || []);
  return async (req, res, next) => {
    if (req.user?.role !== "sub-admin") return verifyAdmin(req, res, next);
    if (!(await run(verifySubAdmin, req, res))) return; // verifySubAdmin already answered
    const perms = req.subAdmin.permissions || {};
    if (!needed.every((p) => perms[p] === true))
      return res.status(403).json({ success: false, message: "You don't have permission for this. Ask your admin." });
    next();
  };
}

/**
 * For routes shared with teachers / students: only sub-admins are checked here
 * (permission + loads their teacher scope); everyone else passes through to the
 * route's own role checks.
 */
export function subAdminNeeds(permission) {
  const gate = verifyAdminOrSubAdmin(permission);
  return (req, res, next) => (req.user?.role === "sub-admin" ? gate(req, res, next) : next());
}

export const isSubAdmin = (req) => req.user?.role === "sub-admin";

const toIds = (ids) => (ids || []).filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(String(id)));

/**
 * Mongo filter limiting a query to the sub-admin's teachers ({} for admins).
 * Real ObjectIds, so it also works in aggregate $match (which doesn't cast strings).
 */
export const scopeFilter = (req, field = "teacherId") =>
  isSubAdmin(req) ? { [field]: { $in: toIds(req.teacherScope) } } : {};

/** Is this teacher within the sub-admin's scope? (always true for admins) */
export const inScope = (req, teacherId) =>
  !isSubAdmin(req) || (req.teacherScope || []).includes(String(teacherId?._id || teacherId || ""));

/**
 * Student ids a sub-admin may work with: students assigned to, or booked with,
 * one of their teachers. null for admins (= everyone).
 */
export async function scopedStudentIds(req) {
  if (!isSubAdmin(req)) return null;
  const teacherIds = req.teacherScope || [];
  if (!teacherIds.length) return new Set();
  const Assignment = req.db.models.Assignment || req.db.model("Assignment", assignmentSchema);
  const Booking    = req.db.models.Booking    || req.db.model("Booking", bookingSchema);
  const [assigned, booked] = await Promise.all([
    Assignment.distinct("studentId", { teacherId: { $in: teacherIds } }),
    Booking.distinct("studentId", { teacherId: { $in: teacherIds } }),
  ]);
  return new Set([...assigned, ...booked].map(String));
}
