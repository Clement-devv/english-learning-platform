// server/routes/classSummaryRoutes.js
// Class summaries: after a completed class the teacher writes what happened.
// Shown to the student (Class reports), the parent (parent portal), and admins
// (Class Report, with "copy for parent"). Works for managed and online students.
//
//   GET /class-summaries/teacher?view=missing|written|all&q=&page=   teacher's completed classes
//   PUT /class-summaries/:bookingId   { text }                        write / edit / clear (teacher)
//   GET /class-summaries/student?page=                                student's own reports
//
// Several bookings at the same time with the same title are one group class:
// they share one summary. Parent access: routes/parentRoutes.js (/me/child/:id/class-summaries).
import express from "express";
import mongoose from "mongoose";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { groupClassSchema } from "../schemas/groupClassSchema.js";
import { readPaging, pageMeta, oid } from "../utils/paging.js";
import logger from "../utils/logger.js";
import { badRequest, forbidden, notFound, serverError } from "../utils/apiResponse.js";

const router = express.Router();
router.use(tenantMiddleware);

const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);
const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);
const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);
const getGroupClass = (db) => db.models.GroupClass || db.model("GroupClass", groupClassSchema);
const hasSummary = { "classSummary.text": { $exists: true, $ne: "" } };
export const SUMMARY_MAX = 3000;
const escapeRx = (s) => s.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
const nameOf = (p) => (p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "");

/** Completed (not admin-rejected) bookings — the only classes a summary belongs to. */
const DONE = { status: "completed", adminRejected: { $ne: true } };

// ── Teacher: my completed classes, with / without a summary ──────────────────
router.get("/teacher", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");
    const view = ["missing", "written", "all"].includes(req.query.view) ? req.query.view : "missing";
    if (req.query.source === "group") return listGroupClasses(req, res, view);
    const Booking = getBooking(req.db);
    const base = { teacherId: oid(req.user.id), ...DONE };

    const term = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 60) : "";
    let search = [];
    if (term) {
      const rx = new RegExp(escapeRx(term), "i");
      const studs = await getStudent(req.db).find({ $or: [{ firstName: rx }, { lastName: rx }, { studentId: rx }] }).select("_id").limit(500).lean();
      search = [{ $match: { $or: [{ classTitle: rx }, { topic: rx }, { studentId: { $in: studs.map(s => s._id) } }] } }];
    }

    const { page: want, limit } = readPaging(req.query, { defaultLimit: 10, maxLimit: 50 });
    const hasText = { $gt: [{ $strLenCP: { $ifNull: ["$summary", ""] } }, 0] };
    const [agg] = await Booking.aggregate([
      { $match: base },
      ...search,
      { $sort: { _id: 1 } },
      { $group: {
        _id: { t: "$scheduledTime", title: "$classTitle" },
        id: { $first: "$_id" }, topic: { $first: "$topic" }, duration: { $first: "$duration" },
        studentIds: { $push: "$studentId" },
        summary: { $max: "$classSummary.text" }, summaryAt: { $max: "$classSummary.updatedAt" },
      } },
      { $addFields: { scheduledTime: "$_id.t", title: "$_id.title", written: hasText } },
      { $facet: {
        items: [
          ...(view === "missing" ? [{ $match: { written: false } }] : view === "written" ? [{ $match: { written: true } }] : []),
          { $sort: { scheduledTime: -1, id: -1 } }, { $skip: (Math.max(want, 1) - 1) * limit }, { $limit: limit },
        ],
        counts: [{ $group: { _id: null, all: { $sum: 1 }, written: { $sum: { $cond: ["$written", 1, 0] } } } }],
      } },
    ]);
    const c = agg?.counts?.[0] || { all: 0, written: 0 };
    const counts = { all: c.all, written: c.written, missing: c.all - c.written };
    const pagination = pageMeta(want, limit, view === "all" ? counts.all : counts[view]);

    const sIds = [...new Set((agg?.items || []).flatMap(i => i.studentIds.map(String)))];
    const studs = await getStudent(req.db).find({ _id: { $in: sIds } }).select("firstName lastName isManaged studentId").lean();
    const byId = Object.fromEntries(studs.map(s => [String(s._id), s]));
    const classes = (agg?.items || []).map(i => ({
      id: String(i.id), title: i.title, topic: i.topic || "", duration: i.duration || 60, scheduledTime: i.scheduledTime,
      summary: i.summary || "", summaryAt: i.summaryAt || null,
      students: i.studentIds.map(id => byId[String(id)]).filter(Boolean)
        .map(s => ({ name: nameOf(s), isManaged: !!s.isManaged, code: s.studentId || "" })),
    }));
    res.json({ success: true, classes, counts, pagination });
  } catch (err) {
    logger.error("Class summaries (teacher) error:", { error: err?.message });
    serverError(res);
  }
});

// Group classes (GroupClass model): one summary per class, shared by all enrolled students
async function listGroupClasses(req, res, view) {
  const GroupClass = getGroupClass(req.db);
  getStudent(req.db);
  const base = { teacherId: oid(req.user.id), status: "completed" };
  const term = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 60) : "";
  if (term) base.title = new RegExp(escapeRx(term), "i");
  const missing = { $or: [{ "classSummary.text": { $exists: false } }, { "classSummary.text": "" }, { "classSummary.text": null }] };
  const [all, written] = await Promise.all([GroupClass.countDocuments(base), GroupClass.countDocuments({ ...base, ...hasSummary })]);
  const counts = { all, written, missing: all - written };
  const filter = view === "missing" ? { ...base, ...missing } : view === "written" ? { ...base, ...hasSummary } : base;
  const { page: want, limit } = readPaging(req.query, { defaultLimit: 10, maxLimit: 50 });
  const pagination = pageMeta(want, limit, view === "all" ? counts.all : counts[view]);
  const docs = await GroupClass.find(filter)
    .select("title description scheduledTime duration enrollments classSummary level")
    .populate("enrollments.studentId", "firstName lastName isManaged studentId")
    .sort({ scheduledTime: -1, _id: -1 })
    .skip((pagination.page - 1) * limit).limit(limit).lean();
  const classes = docs.map(g => ({
    id: String(g._id), group: true, title: g.title, topic: g.level && g.level !== "Mixed" ? `Level ${g.level}` : "",
    duration: g.duration || 60, scheduledTime: g.scheduledTime,
    summary: g.classSummary?.text || "", summaryAt: g.classSummary?.updatedAt || null,
    students: (g.enrollments || []).filter(e => e.studentId && e.attendance !== "absent")
      .map(e => ({ name: nameOf(e.studentId), isManaged: !!e.studentId.isManaged, code: e.studentId.studentId || "" })),
  }));
  res.json({ success: true, classes, counts, pagination });
}

router.put("/group/:groupClassId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Only the class teacher can write the summary");
    if (!mongoose.isValidObjectId(req.params.groupClassId)) return badRequest(res, "Invalid class");
    if (typeof req.body?.text !== "string") return badRequest(res, "text is required");
    const text = req.body.text.replace(/\r\n/g, "\n").trim();
    if (text.length > SUMMARY_MAX) return badRequest(res, `Please keep the summary under ${SUMMARY_MAX} characters`);
    const GroupClass = getGroupClass(req.db);
    const g = await GroupClass.findById(req.params.groupClassId).select("teacherId status").lean();
    if (!g) return notFound(res, "Class not found");
    if (String(g.teacherId) !== String(req.user.id)) return forbidden(res, "This is not your class");
    if (g.status !== "completed") return badRequest(res, "Summaries can only be written for completed classes");
    // findOneAndUpdate so the live-update plugin tells every enrolled student at once
    await GroupClass.findOneAndUpdate({ _id: g._id }, text
      ? { $set: { classSummary: { text, updatedAt: new Date(), by: oid(req.user.id) } } }
      : { $unset: { classSummary: 1 } });
    res.json({ success: true, summary: text, message: text ? "Summary saved" : "Summary removed" });
  } catch (err) {
    logger.error("Save group class summary error:", { error: err?.message });
    serverError(res);
  }
});

// ── Teacher: write / edit / clear the summary of one class ───────────────────
router.put("/:bookingId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Only the class teacher can write the summary");
    if (!mongoose.isValidObjectId(req.params.bookingId)) return badRequest(res, "Invalid class");
    if (typeof req.body?.text !== "string") return badRequest(res, "text is required");
    const text = req.body.text.replace(/\r\n/g, "\n").trim();
    if (text.length > SUMMARY_MAX) return badRequest(res, `Please keep the summary under ${SUMMARY_MAX} characters`);

    const Booking = getBooking(req.db);
    const b = await Booking.findById(req.params.bookingId).select("teacherId scheduledTime classTitle status adminRejected").lean();
    if (!b) return notFound(res, "Class not found");
    if (String(b.teacherId) !== String(req.user.id)) return forbidden(res, "This is not your class");
    if (b.status !== "completed" || b.adminRejected) return badRequest(res, "Summaries can only be written for completed classes");

    // The whole group class (same teacher, time and title) gets the same summary
    const group = { teacherId: b.teacherId, scheduledTime: b.scheduledTime, classTitle: b.classTitle, ...DONE };
    const update = text
      ? { $set: { classSummary: { text, updatedAt: new Date(), by: oid(req.user.id) } } }
      : { $unset: { classSummary: 1 } };
    const r = await Booking.updateMany(group, update);
    res.json({ success: true, updated: r.modifiedCount, summary: text, message: text ? "Summary saved" : "Summary removed" });
  } catch (err) {
    logger.error("Save class summary error:", { error: err?.message });
    serverError(res);
  }
});

/** Shared shape for student / parent views */
export async function summariesForStudent(db, studentId, query) {
  const Booking = getBooking(db), GroupClass = getGroupClass(db);
  getTeacher(db);
  const sid = oid(studentId);
  const onlyWritten = query.view === "all" ? {} : hasSummary;
  const bFilter = { studentId: sid, ...DONE, ...onlyWritten };
  // Group classes the student attended (absent = not their class report)
  const gFilter = { status: "completed", enrollments: { $elemMatch: { studentId: sid, attendance: { $ne: "absent" } } }, ...onlyWritten };
  const { page: want, limit } = readPaging(query, { defaultLimit: 10, maxLimit: 50 });
  const [bTotal, gTotal, bWritten, gWritten] = await Promise.all([
    Booking.countDocuments(bFilter), GroupClass.countDocuments(gFilter),
    Booking.countDocuments({ studentId: sid, ...DONE, ...hasSummary }),
    GroupClass.countDocuments({ ...gFilter, ...hasSummary }),
  ]);
  const pagination = pageMeta(want, limit, bTotal + gTotal);
  // Two sorted sources → take the newest page*limit of each, merge, slice the page
  const upto = pagination.page * limit;
  const teacherPop = ["teacherId", "firstName lastName displayName teacherCode"];
  const [bDocs, gDocs] = await Promise.all([
    Booking.find(bFilter).select("classTitle topic scheduledTime duration teacherId classSummary")
      .populate(...teacherPop).sort({ scheduledTime: -1, _id: -1 }).limit(upto).lean(),
    GroupClass.find(gFilter).select("title level scheduledTime duration teacherId classSummary")
      .populate(...teacherPop).sort({ scheduledTime: -1, _id: -1 }).limit(upto).lean(),
  ]);
  const teacherOf = (t) => (t ? { name: t.displayName?.trim() || nameOf(t), code: t.teacherCode || "" } : null);
  const merged = [
    ...bDocs.map(d => ({ id: String(d._id), title: d.classTitle, topic: d.topic || "", scheduledTime: d.scheduledTime, duration: d.duration || 60,
      teacher: teacherOf(d.teacherId), summary: d.classSummary?.text || "", summaryAt: d.classSummary?.updatedAt || null })),
    ...gDocs.map(g => ({ id: String(g._id), group: true, title: g.title, topic: g.level && g.level !== "Mixed" ? `Group class · Level ${g.level}` : "Group class",
      scheduledTime: g.scheduledTime, duration: g.duration || 60,
      teacher: teacherOf(g.teacherId), summary: g.classSummary?.text || "", summaryAt: g.classSummary?.updatedAt || null })),
  ].sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));
  const reports = merged.slice((pagination.page - 1) * limit, upto);
  return { reports, pagination, counts: { written: bWritten + gWritten } };
}

// ── Student: my class reports ────────────────────────────────────────────────
router.get("/student", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return forbidden(res, "Students only");
    res.json({ success: true, ...(await summariesForStudent(req.db, req.user.id, req.query)) });
  } catch (err) {
    logger.error("Class summaries (student) error:", { error: err?.message });
    serverError(res);
  }
});

export default router;
