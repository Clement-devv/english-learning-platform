// server/routes/groupPointsRoutes.js
// Group-class points (utils/groupPoints.js).
//   POST /api/v1/group-points/students/:id/sell  — admin sells points { points, amountPaid, method, note }
//   GET  /api/v1/group-points/students/:id       — balance + history (admin; sub-admin with "Group classes", own students)
//   GET  /api/v1/group-points/me                 — the signed-in student's balance + history
import express from "express";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { verifyAdminOrSubAdmin, scopedStudentIds } from "../middleware/staffAccess.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { classPricingSchema } from "../schemas/classPricingSchema.js";
import { addPoints, getGroupPointsLedger } from "../utils/groupPoints.js";
import { toStr } from "../utils/inputSanitizer.js";
import { badRequest, forbidden, notFound, serverError } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";

const router = express.Router();
router.use(tenantMiddleware);

const getStudent = (db) => db.models.Student      || db.model("Student", studentSchema);
const getPricing = (db) => db.models.ClassPricing || db.model("ClassPricing", classPricingSchema);
const METHODS = ["cash", "bank_transfer", "card", "online", "other"];

async function balanceAndHistory(db, studentId) {
  const [student, history] = await Promise.all([
    getStudent(db).findById(studentId).select("firstName lastName groupPoints").lean(),
    getGroupPointsLedger(db).find({ studentId }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  if (!student) return null;
  return { balance: student.groupPoints || 0, student: { _id: student._id, firstName: student.firstName, lastName: student.lastName }, history };
}

router.post("/students/:id/sell", verifyToken, verifyAdmin, validateObjectId("id"), async (req, res) => {
  try {
    const points = Number(req.body?.points);
    if (!Number.isInteger(points) || points < 1 || points > 10000) return badRequest(res, "Points must be a whole number from 1 to 10000");
    const amountPaid = req.body?.amountPaid === undefined || req.body?.amountPaid === "" ? undefined : Number(req.body.amountPaid);
    if (amountPaid !== undefined && (!Number.isFinite(amountPaid) || amountPaid < 0)) return badRequest(res, "Amount paid must be 0 or more");
    const method = METHODS.includes(req.body?.method) ? req.body.method : "cash";
    const note = toStr(req.body?.note, "note", { maxLen: 500 }) || "";
    const pricing = await getPricing(req.db).findOne().select("currency").lean();

    const balance = await addPoints(req.db, req.params.id, points, {
      kind: "purchase", amountPaid, currency: pricing?.currency || "", method, note, user: req.user,
    });
    if (balance === null) return notFound(res, "Student not found");
    res.json({ success: true, balance, message: `${points} group point${points === 1 ? "" : "s"} added` });
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    logger.error("Sell group points error:", { error: err?.message });
    serverError(res);
  }
});

router.get("/students/:id", verifyToken, verifyAdminOrSubAdmin("canManageGroupClasses"), validateObjectId("id"), async (req, res) => {
  try {
    const allowed = await scopedStudentIds(req);
    if (allowed && !allowed.has(String(req.params.id))) return notFound(res, "Student not found");
    const data = await balanceAndHistory(req.db, req.params.id);
    if (!data) return notFound(res, "Student not found");
    res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Group points history error:", { error: err?.message });
    serverError(res);
  }
});

router.get("/me", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return forbidden(res, "Students only");
    const data = await balanceAndHistory(req.db, req.user.id);
    if (!data) return notFound(res, "Student not found");
    res.json({ success: true, balance: data.balance, history: data.history });
  } catch (err) {
    logger.error("My group points error:", { error: err?.message });
    serverError(res);
  }
});

export default router;
