// server/routes/parentCheckRoutes.js
// Parent attendance confirmation for managed students (no login).
//
// A managed student's attendance is confirmed only by the teacher ("Student
// joined" in the classroom). For an independent check, the admin sends the
// parent a share link: "Did Linh attend this class?" Yes → confirmed.
// No → the class STAYS completed; a dispute opens with a deadline (red
// heartbeat warning in the UI). Timing rules + auto-resolution: utils/parentCheck.js.
//
// Admin:  GET  /api/v1/parent-checks                 — teacher-confirmed classes + link state
//         POST /api/v1/parent-checks/:bookingId/link — create / refresh the link
// Public: POST /api/v1/parent-checks/link/:token/unlock   { studentName, teacherName }
//         GET  /api/v1/parent-checks/link/:token          (X-Share-Access)
//         POST /api/v1/parent-checks/link/:token/respond  { attended, comment } (X-Share-Access)
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { loginLimiter } from "../middleware/rateLimiter.js";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import {
  issueShareLink, withShareInfo, resolveShareLink, checkUnlock,
  signLinkAccess, verifyLinkAccess, ACCESS_HEADER,
} from "../utils/shareLink.js";
import { parentCheckExpiresAt, disputeDeadlineFrom, DISPUTE_DAYS } from "../utils/parentCheck.js";
import { sendEmail, getCenterBaseUrl } from "../utils/emailService.js";
import { toStr } from "../utils/inputSanitizer.js";
import logger from "../utils/logger.js";
import { badRequest, forbidden, notFound, serverError } from "../utils/apiResponse.js";

const router = express.Router();
router.use(tenantMiddleware);

const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);
const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);
const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);

const expiryFor = (center) => (b) => parentCheckExpiresAt(b, center?.timezone);
const PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    getStudent(req.db); getTeacher(req.db);
    const Booking = getBooking(req.db);
    // Teacher-confirmed classes of managed students: completed, or teacher-logged and
    // awaiting approval. (Real students confirm logged classes in their dashboard — autoConfirmAt.)
    const base = { attendanceConfirmedBy: "teacher", status: { $in: ["completed", "pending_confirmation"] }, autoConfirmAt: { $exists: false } };
    const DISPUTED  = { "parentCheck.status": "denied", disputeStatus: "pending" };
    const WAITING   = { "parentCheck.status": { $in: ["waiting", null] } };           // null also matches "no check yet"
    const ANSWERED  = { $or: [{ "parentCheck.status": { $in: ["confirmed", "no_reply"] } }, { "parentCheck.status": "denied", disputeStatus: { $ne: "pending" } }] };
    const view = ["waiting", "answered", "all"].includes(req.query.view) ? req.query.view : "all";
    const match = view === "waiting" ? { ...base, $or: [WAITING, DISPUTED] } : view === "answered" ? { ...base, ...ANSWERED } : base;

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || PAGE_SIZE, 1), 50);
    const [total, waiting, attended, disputed] = await Promise.all([
      Booking.countDocuments(match),
      Booking.countDocuments({ ...base, ...WAITING }),
      Booking.countDocuments({ ...base, "parentCheck.status": { $in: ["confirmed", "no_reply"] } }),
      Booking.countDocuments({ ...base, ...DISPUTED }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), totalPages);

    // Open disputes first, then newest — needs a computed sort key, so page the ids
    // with an aggregate and load the page's documents normally.
    const ids = (await Booking.aggregate([
      { $match: match },
      { $addFields: { _hot: { $cond: [{ $and: [{ $eq: ["$parentCheck.status", "denied"] }, { $eq: ["$disputeStatus", "pending"] }] }, 1, 0] } } },
      { $sort: { _hot: -1, completedAt: -1, scheduledTime: -1, _id: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { _id: 1 } },
    ])).map(d => String(d._id));
    const docs = await Booking.find({ _id: { $in: ids } })
      .select("+shareLink.tokenEnc shareLink.createdAt classTitle scheduledTime duration status completedAt parentCheck disputeRaised disputeStatus disputeResolution adminRejected loggedByTeacher offline studentId teacherId")
      .populate("studentId", "firstName lastName phone")
      .populate("teacherId", "firstName lastName displayName")
      .lean();
    const order = new Map(ids.map((id, i) => [id, i]));
    docs.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));
    res.json({
      success: true,
      checks: docs.map(b => withShareInfo(b, req.center, { expiresAt: expiryFor(req.center) })),
      pagination: { page, limit, total, totalPages },
      counts: { waiting, attended, disputed },
    });
  } catch (err) {
    logger.error("Parent checks list error:", { error: err?.message });
    serverError(res);
  }
});

router.post("/:bookingId/link", verifyToken, verifyAdmin, validateObjectId("bookingId"), async (req, res) => {
  try {
    getStudent(req.db); getTeacher(req.db);
    const booking = await getBooking(req.db).findById(req.params.bookingId)
      .select("+shareLink.tokenEnc")
      .populate("studentId", "firstName lastName phone")
      .populate("teacherId", "firstName lastName displayName");
    if (!booking) return notFound(res, "Class not found");
    if (booking.attendanceConfirmedBy !== "teacher" || !["completed", "pending_confirmation"].includes(booking.status))
      return badRequest(res, "Parent checks are only for classes a teacher confirmed for a managed student");
    if (booking.parentCheck?.status && booking.parentCheck.status !== "waiting")
      return badRequest(res, "The parent has already answered");

    issueShareLink(booking);
    booking.parentCheck = { status: "waiting" };
    await booking.save();
    res.json({ success: true, check: withShareInfo(booking, req.center, { expiresAt: expiryFor(req.center) }) });
  } catch (err) {
    logger.error("Parent check link error:", { error: err?.message });
    serverError(res);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Public (parent) — never 401, so the app's auth interceptor doesn't redirect
// ─────────────────────────────────────────────────────────────────────────────
const LINK_UNAVAILABLE = "This link is invalid or has been replaced. Please ask the school for a new link.";

async function findByLink(req, res) {
  getStudent(req.db); getTeacher(req.db);
  const r = await resolveShareLink(getBooking(req.db), req.params.token, req.center, {
    select: "studentId teacherId classTitle scheduledTime duration status parentCheck completedAt shareLink.createdAt disputeStatus adminRejected",
    expiresAt: expiryFor(req.center),
  });
  if (r.status === "invalid") { notFound(res, LINK_UNAVAILABLE); return null; }
  if (r.status === "expired") {
    res.status(410).json({ success: false, expired: true, message: "This link has expired. Please contact the school if something is wrong." });
    return null;
  }
  return { booking: r.doc, tokenHash: r.tokenHash, expiresAt: r.expiresAt };
}

async function requireAccess(req, res) {
  const found = await findByLink(req, res);
  if (!found) return null;
  if (!verifyLinkAccess(req.center.slug, "attendance", req.get(ACCESS_HEADER), found.booking._id, found.tokenHash)) {
    forbidden(res, "Please confirm the names to open this page.");
    return null;
  }
  return found;
}

// An answer can be changed while the link is valid (checked before we get here)
// and nothing has been settled: a "No" only while its dispute is still pending.
const canChange = (b) => {
  const st = b.parentCheck?.status;
  if (b.adminRejected) return false;
  if (st === "confirmed") return true;
  if (st === "denied") return b.disputeStatus === "pending";
  return false;
};

const view = (b, centerName) => ({
  studentName:   b.studentId.firstName,
  teacherName:   b.teacherId.displayName?.trim() || b.teacherId.firstName,
  centerName:    centerName || "",
  classTitle:    b.classTitle,
  scheduledTime: b.scheduledTime,
  duration:      b.duration,
  status:        b.parentCheck?.status || "waiting",
  respondedAt:   b.parentCheck?.respondedAt || null,
  comment:       b.parentCheck?.comment || "",
  canChange:     canChange(b),
  changed:       (b.parentCheck?.history || []).length > 0,
});

const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Email the center admin about a parent's answer ("no" = new dispute, "withdrawn" = No changed to Yes)
function notifyAdmin(req, b, kind) {
  const adminEmail = req.center?.adminEmail;
  if (!adminEmail) return;
  const { baseUrl } = getCenterBaseUrl(req.center);
  const who = `<ul><li><strong>Student:</strong> ${esc(b.studentId.firstName)} ${esc(b.studentId.lastName)}</li>
<li><strong>Teacher:</strong> ${esc(b.teacherId.firstName)} ${esc(b.teacherId.lastName)}</li>
<li><strong>Class:</strong> ${esc(b.classTitle)} — ${esc(new Date(b.scheduledTime).toUTCString())}</li></ul>`;
  const mail = kind === "withdrawn"
    ? {
        subject: `Parent withdrew their report for ${b.studentId.firstName}`,
        html: `<p>The parent changed their answer from <strong>No</strong> to <strong>Yes</strong> — the student did attend:</p>${who}
<p>The dispute has been <strong>cancelled</strong> and the class stands. Nothing to do.</p>`,
      }
    : {
        subject: `Parent reports ${b.studentId.firstName} missed a class`,
        html: `<p>A parent answered <strong>No</strong> to the attendance check for:</p>${who}
${b.parentCheck.comment ? `<p><strong>Parent's note:</strong> ${esc(b.parentCheck.comment)}</p>` : ""}
<p>The teacher had confirmed this student joined. The class is <strong>not</strong> reversed yet — a dispute is open.</p>
<p><strong>Please review it within ${DISPUTE_DAYS} days</strong> in <a href="${baseUrl}/admin/dashboard">Disputes</a>. If it isn't settled by ${esc(b.parentCheck.disputeDeadline.toUTCString())}, the class is automatically returned to the student and the teacher's pay for it is deducted.</p>`,
      };
  sendEmail({ centerName: req.center?.centerName, to: adminEmail, ...mail })
    .catch(e => logger.warn("Parent check email failed:", { error: e?.message }));
}

router.post("/link/:token/unlock", loginLimiter, async (req, res) => {
  try {
    const found = await findByLink(req, res);
    if (!found) return;
    const { booking, tokenHash, expiresAt } = found;
    const check = await checkUnlock(getBooking(req.db), booking,
      toStr(req.body.studentName, "studentName", { maxLen: 100 }),
      toStr(req.body.teacherName, "teacherName", { maxLen: 100 }));
    if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });
    res.json({
      success: true,
      accessToken: signLinkAccess(req.center.slug, "attendance", booking._id, tokenHash, expiresAt),
      check: view(booking, req.center?.centerName),
    });
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    logger.error("Parent check unlock error:", { error: err?.message });
    serverError(res);
  }
});

router.get("/link/:token", async (req, res) => {
  try {
    const found = await requireAccess(req, res);
    if (!found) return;
    res.json({ success: true, check: view(found.booking, req.center?.centerName) });
  } catch (err) {
    logger.error("Parent check view error:", { error: err?.message });
    serverError(res);
  }
});

// POST /link/:token/respond  { attended: boolean, comment? }
// First answer, or a change of answer (while the link is valid and nothing is settled).
//   waiting → Yes/No
//   No  → Yes : dispute withdrawn (leaves Disputes, heartbeat stops)
//   Yes → No  : dispute opened with a fresh 3-day deadline (DISPUTE_DAYS)
// Each transition is one conditional update, so it can't race the admin settling
// the dispute or the auto-resolve sweep — whichever writes first wins.
router.post("/link/:token/respond", async (req, res) => {
  try {
    const found = await requireAccess(req, res);
    if (!found) return;
    const { booking } = found;
    if (typeof req.body.attended !== "boolean") return badRequest(res, "Please answer Yes or No");
    const attended = req.body.attended;
    const comment  = attended ? "" : toStr(req.body.comment, "comment", { maxLen: 500 });
    const from     = booking.parentCheck?.status || "waiting";
    const to       = attended ? "confirmed" : "denied";
    const Booking  = getBooking(req.db);

    if (from === to) return res.json({ success: true, check: view(booking, req.center?.centerName) });
    if (from !== "waiting" && !canChange(booking))
      return res.status(409).json({ success: false, message: "The school has already reviewed this class, so the answer can't be changed. Please contact the school." });

    const now = new Date();
    const studentFirst = booking.studentId.firstName;
    // Only apply if the booking is still exactly as we saw it
    const guard = { _id: booking._id, "parentCheck.status": from, adminRejected: { $ne: true },
      ...(from === "denied" ? { disputeStatus: "pending" } : {}) };

    const set = {
      "parentCheck.status": to,
      "parentCheck.respondedAt": now,
      "parentCheck.comment": comment,
    };
    const unset = {};
    if (to === "denied") {
      Object.assign(set, {
        "parentCheck.disputeDeadline": disputeDeadlineFrom(now),
        disputeRaised: true,
        disputeStatus: "pending",
        disputeReason: `Parent says ${studentFirst} did not attend this class.${comment ? ` Parent's note: "${comment}"` : ""}`,
        disputedAt: now,
        disputedBy: "Parent (attendance check link)",
      });
      Object.assign(unset, { disputeResolution: 1, disputeAdminNotes: 1, disputeResolvedAt: 1 });
    } else if (from === "denied") {
      // No → Yes: cancel the dispute; the class simply stands
      Object.assign(set, {
        disputeStatus: "withdrawn",
        disputeResolution: "parent_withdrew",
        disputeAdminNotes: "Parent changed their answer to Yes (student attended).",
        disputeResolvedAt: now,
      });
      unset["parentCheck.disputeDeadline"] = 1;
    }

    const update = { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) };
    if (from !== "waiting") update.$push = { "parentCheck.history": { from, to, at: now } };

    const updated = await Booking.findOneAndUpdate(guard, update, { new: true })
      .populate("studentId", "firstName lastName").populate("teacherId", "firstName lastName displayName");
    if (!updated) {
      return res.status(409).json({ success: false, message: "This answer changed in the meantime (the school may have just reviewed it). Please reload the page." });
    }

    if (to === "denied") notifyAdmin(req, updated, "no");
    else if (from === "denied") notifyAdmin(req, updated, "withdrawn");

    res.json({ success: true, check: view(updated, req.center?.centerName) });
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    logger.error("Parent check respond error:", { error: err?.message });
    serverError(res);
  }
});

export default router;
