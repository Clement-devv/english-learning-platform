// server/utils/classAccess.js
// Who may use a class's video channel or lesson files: its teacher and
// student(s), admins, and sub-admins whose teacher scope includes the teacher.
import crypto from "crypto";
import mongoose from "mongoose";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { groupClassSchema } from "../schemas/groupClassSchema.js";

const getBooking    = (db) => db.models.Booking    || db.model("Booking",    bookingSchema);
const getGroupClass = (db) => db.models.GroupClass || db.model("GroupClass", groupClassSchema);

/**
 * @param {object} req      needs req.db and req.user
 * @param {string} kind     "class" (one-to-one booking) | "group"
 * @param {string} id       booking id / group class id
 * @returns {Promise<boolean>}
 */
export async function canAccessClass(req, kind, id) {
  if (!mongoose.isValidObjectId(id)) return false;
  const { role, id: userId } = req.user || {};

  // The class must exist in THIS center's database before anyone — admins
  // included — is allowed in. Otherwise an admin of one center could get a
  // video token or file for another center's class by guessing its id.
  let teacherId, studentIds = [];
  if (kind === "group") {
    const g = await getGroupClass(req.db).findById(id).select("teacherId enrollments.studentId").lean();
    if (!g) return false;
    teacherId  = String(g.teacherId);
    studentIds = (g.enrollments || []).map(s => String(s.studentId));
  } else {
    const b = await getBooking(req.db).findById(id).select("teacherId studentId").lean();
    if (!b) return false;
    teacherId  = String(b.teacherId);
    studentIds = [String(b.studentId)];
  }

  if (role === "admin")     return true;
  if (role === "teacher")   return teacherId === String(userId);
  if (role === "student")   return studentIds.includes(String(userId));
  if (role === "sub-admin") return (req.user.teacherScope || []).map(String).includes(teacherId);
  return false;
}

/**
 * The real Agora channel for a class: "class-<id>" prefixed with a short,
 * stable tag for the center. Every center shares one Agora app, so without the
 * prefix two centers' channel names live in the same namespace. Fixed length
 * (≤ 44 chars) keeps it under Agora's 64-byte limit however long the slug is.
 */
export function tenantChannel(slug, channel) {
  const tag = crypto.createHash("sha256").update(String(slug)).digest("hex").slice(0, 12);
  return `t${tag}_${channel}`;
}

/** "class-<id>" / "group-<id>" → { kind, id } (null for anything else) */
export function parseChannel(channel) {
  const m = /^(class|group)-([a-f\d]{24})$/i.exec(String(channel || ""));
  return m ? { kind: m[1].toLowerCase(), id: m[2] } : null;
}
