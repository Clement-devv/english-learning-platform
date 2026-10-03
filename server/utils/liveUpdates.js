// server/utils/liveUpdates.js
// "Something changed" pushes over Socket.IO, so screens refresh in about a
// second instead of waiting for a timer or a manual page reload.
//
// How it works
//   • A Mongoose plugin on the main center models notices every write
//     (save / update / delete) and works out who it affects: the teacher,
//     the student, and the center's admins.
//   • Each of them gets   socket "data-changed" { keys: ["bookings", …] }
//     The message carries NO data — the browser just re-fetches the matching
//     screens through the normal, permission-checked API (TanStack Query).
//   • Messages to the same room are merged over a short window, so a burst of
//     writes (bulk approve, scheduler sweep) becomes one small message.
//
// Center = the Mongo database name (each center DB is named after its slug —
// config/dbManager.js), so this needs no request context.
import { bookingSchema }             from "../schemas/bookingSchema.js";
import { homeworkSchema }            from "../schemas/homeworkSchema.js";
import { quizSchema }                from "../schemas/quizSchema.js";
import { quizAttemptSchema }         from "../schemas/quizAttemptSchema.js";
import { recordingSchema }           from "../schemas/recordingSchema.js";
import { paymentTransactionSchema }  from "../schemas/paymentTransactionSchema.js";
import { paymentSchema }             from "../schemas/paymentSchema.js";
import { teacherAvailabilitySchema } from "../schemas/teacherAvailabilitySchema.js";
import { studentSchema }             from "../schemas/studentSchema.js";
import { teacherSchema }             from "../schemas/teacherSchema.js";
import { assignmentSchema }          from "../schemas/assignmentSchema.js";
import { reviewSchema }              from "../schemas/reviewSchema.js";
import { groupClassSchema }          from "../schemas/groupClassSchema.js";
import { classroomSessionSchema }    from "../schemas/classroomSessionSchema.js";
import { notificationSchema }        from "../schemas/notificationSchema.js";
import logger from "./logger.js";
import { markSnapshotDirty, setSnapshotNotifier } from "./sharedSnapshot.js";
import { adminOnlyRoom } from "./socketRooms.js";

const MERGE_MS = 300;           // merge window per room
const MAX_LOOKUP = 200;         // docs read to find who an updateMany affected

let io = null;
export function setLiveIO(server) {
  io = server;
  // Shared admin snapshots tell admins "analytics changed" once per change window
  setSnapshotNotifier((slug, keys) => io?.to(`admin-broadcast:${slug}`).emit("data-changed", { keys }));
}

// ── Merge + send ──────────────────────────────────────────────────────────────
const pending = new Map(); // room → Set(keys)
let timer = null;
function flush() {
  timer = null;
  if (!io) { pending.clear(); return; }
  for (const [room, keys] of pending) io.to(room).emit("data-changed", { keys: [...keys] });
  pending.clear();
}
function queue(room, keys) {
  if (!pending.has(room)) pending.set(room, new Set());
  const set = pending.get(room);
  keys.forEach(k => set.add(k));
  if (!timer) timer = setTimeout(flush, MERGE_MS);
}

/**
 * Tell the affected people that `keys` changed.
 * @param {string} slug  center slug
 * @param {{ teachers?: any[], students?: any[], admins?: boolean }} who
 * @param {string[]} keys  resource names the client caches under
 */
export function notifyChanged(slug, who, keys) {
  if (!slug || !keys?.length) return;
  markSnapshotDirty(slug);
  try {
    for (const t of new Set((who.teachers || []).filter(Boolean).map(String))) queue(`teacher-room:${slug}:${t}`, keys);
    for (const s of new Set((who.students || []).filter(Boolean).map(String))) queue(`student-room:${slug}:${s}`, keys);
    if (who.admins !== false) queue(`admin-broadcast:${slug}`, keys);
  } catch (err) {
    logger.warn("live update failed", { error: err?.message });
  }
}

// ── Mongoose plugin ───────────────────────────────────────────────────────────
// `who(doc)` → { teachers, students } for one changed document.
function livePlugin(schema, { keys, who, fields }) {
  const send = (slug, docs) => {
    if (!slug || !docs?.length) return;
    const teachers = [], students = [];
    for (const d of docs) {
      const w = who(d) || {};
      teachers.push(...(w.teachers || []));
      students.push(...(w.students || []));
    }
    notifyChanged(slug, { teachers, students }, keys);
  };
  const slugOfModel = (m) => m?.db?.name;

  // Document writes
  schema.post("save", function (doc) { send(slugOfModel(doc.constructor), [doc]); });
  schema.post("deleteOne", { document: true, query: false }, function (doc) { send(slugOfModel(doc.constructor), [doc]); });
  schema.post("insertMany", function (docs) { send(slugOfModel(this), docs); });

  // findOneAnd… returns the document
  schema.post(["findOneAndUpdate", "findOneAndDelete", "findOneAndReplace"], function (doc) {
    if (doc) send(slugOfModel(this.model), [doc]);
  });

  // update/delete without a document: read who is affected first (bounded)
  const queryOps = ["updateOne", "updateMany", "deleteOne", "deleteMany"];
  schema.pre(queryOps, { document: false, query: true }, async function () {
    try {
      this._liveDocs = await this.model.find(this.getFilter()).select(fields).limit(MAX_LOOKUP).lean();
    } catch { this._liveDocs = []; }
  });
  schema.post(queryOps, { document: false, query: true }, function () {
    send(slugOfModel(this.model), this._liveDocs || []);
  });
}

// A field can hold a plain id or a populated document (e.g. booking.save() after .populate())
const idOf = (x) => (x && typeof x === "object" && x._id ? x._id : x);
const ids = (...xs) => xs.map(idOf).filter(Boolean);
let applied = false;
/** Attach the plugin to the center schemas. Call once at startup, before any model is compiled. */
export function applyLivePlugins() {
  if (applied) return;
  applied = true;
  const tsWho = (d) => ({ teachers: ids(d.teacherId), students: ids(d.studentId) });
  livePlugin(bookingSchema,             { keys: ["bookings", "schedule", "classes"], fields: "teacherId studentId", who: tsWho });
  livePlugin(homeworkSchema,            { keys: ["homework"],  fields: "teacherId studentId", who: tsWho });
  livePlugin(quizSchema,                { keys: ["quizzes"],   fields: "teacherId studentId", who: tsWho });
  livePlugin(quizAttemptSchema,         { keys: ["quizzes"],   fields: "teacherId studentId", who: tsWho });
  livePlugin(recordingSchema,           { keys: ["recordings"], fields: "teacherId studentId", who: tsWho });
  livePlugin(paymentTransactionSchema,  { keys: ["payments"],  fields: "teacherId studentId", who: tsWho });
  livePlugin(paymentSchema,             { keys: ["credits", "students"], fields: "studentId", who: (d) => ({ students: ids(d.studentId) }) });
  livePlugin(teacherAvailabilitySchema, { keys: ["schedule"],  fields: "teacherId", who: (d) => ({ teachers: ids(d.teacherId) }) });
  livePlugin(reviewSchema,              { keys: ["reviews"],   fields: "teacherId studentId", who: tsWho });
  livePlugin(assignmentSchema,          { keys: ["students"],  fields: "teacherId studentId", who: tsWho });
  livePlugin(studentSchema,             { keys: ["students", "credits"], fields: "_id", who: (d) => ({ students: ids(d._id) }) });
  livePlugin(teacherSchema,             { keys: ["teachers", "schedule"], fields: "_id", who: (d) => ({ teachers: ids(d._id) }) });
  livePlugin(notificationSchema,        { keys: ["notifications"], fields: "_id", who: () => ({}) }); // admins only
  livePlugin(groupClassSchema,          { keys: ["group-classes"], fields: "teacherId enrollments.studentId",
    who: (d) => ({ teachers: ids(d.teacherId), students: ids(...(d.enrollments || []).map(e => e.studentId)) }) });
}

// ── Live-class presence for admins ───────────────────────────────────────────
// Classroom sessions are written every ~15s per person (heartbeats) and on every
// whiteboard/PDF change, so a "changed → refetch" message would multiply load.
// Instead the server pushes a tiny presence summary straight to the center's
// admins — and only when it means something new: someone joined/left, the video
// provider or status changed, or a heartbeat is a minute newer than the last one
// sent (the admin view treats ≤90s as "active"). ~1 message per class per minute,
// zero database reads by admins.
const lastPresence = new Map(); // "slug:bookingId" → { sig, beat, at }
const BEAT_RESEND_MS = 60_000;
function presenceSummary(doc) {
  const last = (role) => {
    let t = 0;
    for (const h of doc.heartbeats || []) if (h.userRole === role) { const v = +new Date(h.timestamp); if (v > t) t = v; }
    return t || null;
  };
  return {
    bookingId: String(doc.bookingId),
    teacherJoinedAt: doc.teacherJoinedAt || null,
    studentJoinedAt: doc.studentJoinedAt || null,
    videoProvider: doc.videoProvider || null,
    status: doc.status || null,
    managedAttendance: !!doc.managedAttendance,
    lastBeat: { teacher: last("teacher"), student: last("student") },
  };
}
function sendPresence(slug, doc) {
  if (!io || !slug || !doc?.bookingId) return;
  try {
    const s = presenceSummary(doc);
    const key = `${slug}:${s.bookingId}`;
    const sig = JSON.stringify([s.teacherJoinedAt, s.studentJoinedAt, s.videoProvider, s.status, s.managedAttendance]);
    const prev = lastPresence.get(key);
    const newer = (r) => s.lastBeat[r] && (!prev?.beat?.[r] || s.lastBeat[r] - prev.beat[r] >= BEAT_RESEND_MS);
    if (prev && prev.sig === sig && !newer("teacher") && !newer("student")) return;
    lastPresence.set(key, { sig, beat: s.lastBeat, at: Date.now() });
    if (lastPresence.size > 5000) { // forget classes not touched for 6h
      const cutoff = Date.now() - 6 * 3600000;
      for (const [k, v] of lastPresence) if (v.at < cutoff) lastPresence.delete(k);
    }
    io.to(adminOnlyRoom(slug)).emit("class-presence", s); // content → admins only
  } catch (err) {
    logger.warn("presence push failed", { error: err?.message });
  }
}
let presenceApplied = false;
export function applyPresencePlugin() {
  if (presenceApplied) return;
  presenceApplied = true;
  classroomSessionSchema.post("save", function (doc) { sendPresence(doc.constructor?.db?.name, doc); });
  classroomSessionSchema.post("findOneAndUpdate", function (doc) { if (doc) sendPresence(this.model?.db?.name, doc); });
}
