// server/routes/classHistoryRoutes.js
// Paged class history (past classes) for the teacher "Completed Classes" tab and
// the student "Completed" tab. Filtering, search, grouping and paging all happen
// here so nothing is silently cut off as a history grows.
//
// Mounted at /api/v1/bookings (next to bookingRoutes):
//   GET /bookings/teacher/:teacherId/history   teacher (self) | admin
//   GET /bookings/student/:studentId/history   student (self) | admin
// Query: view=all|completed|not_completed  q=<search>  from,to=<ISO dates>
//        page=1  limit=10 (max 50)  export=1 (everything that matches, up to 2000 — for PDF)
import express from "express";
import mongoose from "mongoose";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { readPaging, pageMeta, oid } from "../utils/paging.js";
import logger from "../utils/logger.js";
import { badRequest, forbidden, serverError } from "../utils/apiResponse.js";

const router = express.Router();
router.use(tenantMiddleware);

const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);
const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);
const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);

const EXPORT_MAX = 2000;
const HOUR = 3600000;
const VIEWS = ["all", "completed", "not_completed"];
const isAdmin = (role) => role === "admin";
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Shared query parsing: view, search regex, date range, paging. */
function readQuery(q) {
  const view = VIEWS.includes(q.view) ? q.view : "all";
  const term = typeof q.q === "string" ? q.q.trim().slice(0, 100) : "";
  const rx = term ? new RegExp(escapeRx(term), "i") : null;
  const range = {};
  const from = q.from ? new Date(q.from) : null, to = q.to ? new Date(q.to) : null;
  if (from && !isNaN(from)) range.$gte = from;
  if (to && !isNaN(to)) range.$lte = to;
  const paging = q.export === "1" ? { page: 1, limit: EXPORT_MAX } : readPaging(q, { defaultLimit: 10, maxLimit: 50 });
  return { view, rx, range: Object.keys(range).length ? range : null, paging };
}

/** $facet producing one page + totals; `notCompleted` must be a boolean field on each row. */
function facet(view, { page, limit }, project) {
  const viewMatch = view === "completed" ? [{ $match: { notCompleted: false } }]
    : view === "not_completed" ? [{ $match: { notCompleted: true } }] : [];
  return {
    $facet: {
      items: [...viewMatch, { $sort: { scheduledTime: -1, id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: project }],
      total: [...viewMatch, { $count: "n" }],
      counts: [{ $group: { _id: null, all: { $sum: 1 }, notCompleted: { $sum: { $cond: ["$notCompleted", 1, 0] } } } }],
    },
  };
}

function shape(result, paging) {
  const r = result[0] || {};
  const total = r.total?.[0]?.n || 0;
  const c = r.counts?.[0] || { all: 0, notCompleted: 0 };
  return {
    items: r.items || [],
    pagination: pageMeta(paging.page, paging.limit, total),
    counts: { all: c.all, completed: c.all - c.notCompleted, notCompleted: c.notCompleted },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Teacher — one row per class (bookings sharing time + title are one group class)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/teacher/:teacherId/history", verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.params;
    if (!mongoose.isValidObjectId(teacherId)) return badRequest(res, "Invalid teacher");
    if (!(isAdmin(req.user.role) || (req.user.role === "teacher" && req.user.id === teacherId)))
      return forbidden(res, "You can only view your own classes");

    const { view, rx, range, paging } = readQuery(req.query);
    const now = Date.now();
    const match = {
      teacherId: oid(teacherId),
      $or: [
        { status: { $in: ["completed", "missed"] } },
        // Started over an hour ago but never marked complete — still shown, as before
        { status: "accepted", scheduledTime: { $lt: new Date(now - HOUR) } },
      ],
      // ANDed with the $or above, so it limits both branches
      ...(range ? { scheduledTime: range } : {}),
    };

    const result = await getBooking(req.db).aggregate([
      { $match: match },
      { $lookup: { from: getStudent(req.db).collection.name, localField: "studentId", foreignField: "_id", as: "st",
                   pipeline: [{ $project: { firstName: 1, lastName: 1 } }] } },
      { $addFields: { stName: { $trim: { input: { $concat: [
        { $ifNull: [{ $arrayElemAt: ["$st.firstName", 0] }, ""] }, " ",
        { $ifNull: [{ $arrayElemAt: ["$st.lastName", 0] }, ""] },
      ] } } } } },
      { $sort: { _id: 1 } },
      { $group: {
        _id: { t: "$scheduledTime", title: "$classTitle", kind: "$status" },
        id:                  { $first: "$_id" },
        topic:               { $first: "$topic" },
        duration:            { $first: "$duration" },
        students:            { $push: "$stName" },
        adminRejected:       { $max: { $ifNull: ["$adminRejected", false] } },
        adminRejectedReason: { $max: { $ifNull: ["$adminRejectedReason", ""] } },
        adminRejectedAt:     { $max: "$adminRejectedAt" },
        disputeRaised:       { $max: { $ifNull: ["$disputeRaised", false] } },
        missedReason:        { $max: { $ifNull: ["$missedReason", ""] } },
        disputes:            { $push: { $cond: [
          { $and: [{ $eq: ["$parentCheck.status", "denied"] }, { $eq: ["$disputeStatus", "pending"] }] },
          { deadline: "$parentCheck.disputeDeadline", comment: { $ifNull: ["$parentCheck.comment", ""] } },
          null,
        ] } },
      } },
      { $addFields: {
        scheduledTime: "$_id.t",
        title:         "$_id.title",
        isMissed:      { $eq: ["$_id.kind", "missed"] },
        officiallyCompleted: { $eq: ["$_id.kind", "completed"] },
        parentDispute: { $arrayElemAt: [{ $filter: { input: "$disputes", cond: { $ne: ["$$this", null] } } }, 0] },
      } },
      { $addFields: { notCompleted: { $or: ["$isMissed", "$adminRejected"] } } },
      ...(rx ? [{ $match: { $or: [{ title: rx }, { topic: rx }, { students: rx }] } }] : []),
      facet(view, paging, { _id: 0, disputes: 0 }),
    ]);

    const { items, pagination, counts } = shape(result, paging);
    res.json({ success: true, classes: items, pagination, counts });
  } catch (err) {
    logger.error("Teacher class history error:", { error: err?.message });
    serverError(res);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Student — one row per booking
// ─────────────────────────────────────────────────────────────────────────────
router.get("/student/:studentId/history", verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!mongoose.isValidObjectId(studentId)) return badRequest(res, "Invalid student");
    if (!(isAdmin(req.user.role) || (req.user.role === "student" && req.user.id === studentId)))
      return forbidden(res, "You can only view your own classes");

    const { view, rx, range, paging } = readQuery(req.query);
    const result = await getBooking(req.db).aggregate([
      { $match: { studentId: oid(studentId), status: { $in: ["completed", "missed"] }, ...(range ? { scheduledTime: range } : {}) } },
      { $lookup: { from: getTeacher(req.db).collection.name, localField: "teacherId", foreignField: "_id", as: "t",
                   pipeline: [{ $project: { firstName: 1, lastName: 1, displayName: 1 } }] } },
      { $addFields: {
        tt: { $arrayElemAt: ["$t", 0] },
        id: "$_id",
        title: "$classTitle",
        notCompleted: { $or: [{ $eq: ["$status", "missed"] }, { $eq: [{ $ifNull: ["$adminRejected", false] }, true] }] },
      } },
      { $addFields: { teacher: { $cond: [
        { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$tt.displayName", ""] } } } }, 0] },
        { $trim: { input: "$tt.displayName" } },
        { $trim: { input: { $concat: [{ $ifNull: ["$tt.firstName", ""] }, " ", { $ifNull: ["$tt.lastName", ""] }] } } },
      ] } } },
      ...(rx ? [{ $match: { $or: [{ title: rx }, { topic: rx }, { teacher: rx }] } }] : []),
      facet(view, paging, {
        _id: 0, id: 1, status: 1, title: 1, topic: 1, teacher: 1, scheduledTime: 1, completedAt: 1, duration: 1,
        adminRejected: 1, adminRejectedReason: 1, adminRejectedAt: 1, missedReason: 1, teacherTimezone: 1,
      }),
    ]);

    const { items, pagination, counts } = shape(result, paging);
    res.json({ success: true, classes: items, pagination, counts });
  } catch (err) {
    logger.error("Student class history error:", { error: err?.message });
    serverError(res);
  }
});

export default router;
