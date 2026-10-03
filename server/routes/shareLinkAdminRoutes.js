// server/routes/shareLinkAdminRoutes.js
// Admin view of the parent links teachers created for homework and quizzes
// (managed students), so the admin can copy one and send it to the parent.
//
//   GET /share-links?kind=homework|quiz&view=active|expired|all&q=&page=
//
// The token is decrypted only here, for admins (same as the teacher's own view —
// utils/shareLink.js withShareInfo). Links are never created or changed here.
import express from "express";
import mongoose from "mongoose";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { homeworkSchema } from "../schemas/homeworkSchema.js";
import { quizSchema } from "../schemas/quizSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { withShareInfo, linkExpiresAt } from "../utils/shareLink.js";
import { readPaging, pageMeta } from "../utils/paging.js";
import logger from "../utils/logger.js";
import { badRequest, serverError } from "../utils/apiResponse.js";

const router = express.Router();
router.use(tenantMiddleware);

const MODELS = {
  homework: (db) => db.models.Homework || db.model("Homework", homeworkSchema),
  quiz:     (db) => db.models.Quiz     || db.model("Quiz",     quizSchema),
};
const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);
const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);
const escapeRx = (s) => s.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
const DAY = 86400000;

router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const kind = req.query.kind === "quiz" ? "quiz" : req.query.kind === "homework" ? "homework" : null;
    if (!kind) return badRequest(res, "kind must be homework or quiz");
    const view = ["active", "expired", "all"].includes(req.query.view) ? req.query.view : "active";
    const Model = MODELS[kind](req.db);
    const Student = getStudent(req.db), Teacher = getTeacher(req.db);

    const filter = { "shareLink.tokenHash": { $exists: true, $ne: null } };
    // Links expire at the end of the due day in the center's timezone. Narrow by
    // due date in the database (±1 day covers every timezone), then decide exactly below.
    if (view === "active") filter.dueDate = { $gte: new Date(Date.now() - 1.5 * DAY) };
    if (view === "expired") filter.dueDate = { $lt: new Date(Date.now() + DAY) };

    // Search: title, or the student's / teacher's name or ID number
    const term = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 60) : "";
    if (term) {
      const rx = new RegExp(escapeRx(term), "i");
      const words = term.split(/\s+/).filter(Boolean);
      const nameOr = [{ firstName: rx }, { lastName: rx }];
      if (words.length >= 2) nameOr.push({ firstName: new RegExp("^" + escapeRx(words[0]), "i"), lastName: new RegExp("^" + escapeRx(words.slice(1).join(" ")), "i") });
      const [ss, ts] = await Promise.all([
        Student.find({ $or: [...nameOr, { studentId: rx }] }).select("_id").limit(500).lean(),
        Teacher.find({ $or: [...nameOr, { teacherCode: rx }, { displayName: rx }] }).select("_id").limit(500).lean(),
      ]);
      filter.$or = [{ title: rx }, { studentId: { $in: ss.map(s => s._id) } }, { teacherId: { $in: ts.map(t => t._id) } }];
    }

    const { page: want, limit } = readPaging(req.query, { defaultLimit: 20, maxLimit: 50 });
    const total = await Model.countDocuments(filter);
    const pagination = pageMeta(want, limit, total);
    const docs = await Model.find(filter)
      .select("+shareLink.tokenEnc shareLink.createdAt title dueDate status studentId teacherId createdAt")
      .populate("studentId", "firstName lastName isManaged phone studentId")
      .populate("teacherId", "firstName lastName displayName teacherCode")
      .sort({ dueDate: view === "expired" ? -1 : 1, _id: 1 })
      .skip((pagination.page - 1) * limit).limit(limit).lean();

    const now = Date.now();
    const items = docs.map(d => {
      const info = withShareInfo(d, req.center);
      const expiresAt = info.shareLink?.expiresAt || linkExpiresAt(d.dueDate, req.center?.timezone);
      const s = d.studentId, t = d.teacherId;
      return {
        _id: d._id, kind, title: d.title, dueDate: d.dueDate, status: d.status,
        shareToken: info.shareToken, createdAt: d.shareLink?.createdAt, expiresAt,
        expired: new Date(expiresAt).getTime() < now,
        student: s ? { name: `${s.firstName} ${s.lastName || ""}`.trim(), firstName: s.firstName, isManaged: !!s.isManaged, code: s.studentId || "", phone: s.phone || "" } : null,
        teacher: t ? { name: t.displayName?.trim() || `${t.firstName} ${t.lastName || ""}`.trim(), code: t.teacherCode || "" } : null,
      };
    }).filter(i => i.shareToken && (view === "all" || (view === "active" ? !i.expired : i.expired)));

    res.json({ success: true, items, pagination });
  } catch (err) {
    logger.error("Admin share links error:", { error: err?.message });
    serverError(res);
  }
});

export default router;
