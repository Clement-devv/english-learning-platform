// server/routes/payrollRoutes.js — monthly teacher salary (mounted at /payroll)
//
// Teacher
//   GET  /me                          — this period's salary so far, payslips, payments received
//   GET  /me/history?type=payslips|payouts&page= — older payslips / payments
// Admin (behind the analytics PIN, like the rest of Payments)
//   GET  /admin/settings              PUT /admin/settings   — pay day, cycle, charges, retention
//   GET  /admin/periods/:key?         — teachers' salaries for a period, paged (?page &limit &q &status)
//   GET  /admin/teachers              — id / name / region of every teacher (pickers)
//   POST /admin/periods/:key/settle   — pay one teacher's salary for that period
//   POST /admin/payouts               — loan / part payment to a teacher, any amount, any day
//   POST /admin/payouts/:id/void      — cancel a mistaken loan / part payment (before it's counted)
//   GET  /admin/payouts               — every payment made to teachers (history)
//   GET  /admin/payslips              — settled salaries (history)
//   GET  /admin/charges               — what the general charges have collected
//   GET  /admin/teacher/:id           — one teacher's statement, as they see it (+ /history)
//
// The calculation lives in utils/payroll.js.
import express from "express";
import mongoose from "mongoose";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { verifyToken, verifyAdmin, verifyTeacher } from "../middleware/authMiddleware.js";
import { requireAnalyticsUnlock } from "../middleware/analyticsPinMiddleware.js";
import { parsePagination } from "../utils/pagination.js";
import { toMoney } from "../utils/classPayment.js";
import { zonedToUtc } from "../utils/schedule.js";
import { PAYOUT_METHODS, ADVANCE_KINDS, CHARGE_REGIONS } from "../schemas/payrollSchemas.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import {
  PayrollError, centerTz, loadSettings, getPayrollSettings, getPayslip, getTeacherPayout,
  periodView, teacherStatement, teacherHistory, chargeApplies, recordAdvance, voidAdvance, settleSalary, applyRetention,
} from "../utils/payroll.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, serverError } from "../utils/apiResponse.js";

const router = express.Router();
router.use(tenantMiddleware);

const MAX_AMOUNT = 1_000_000;
const admin = [verifyToken, verifyAdmin, requireAnalyticsUnlock];
const KEY = /^\d{4}-\d{2}-\d{2}$/;

const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);
/** Teachers a charge can be aimed at (settings page picker) */
const chargeTeachers = (db) => getTeacher(db).find({ status: { $ne: "suspended" } })
  .select("firstName lastName teacherCode continent active").sort({ firstName: 1, lastName: 1 }).lean();

const text = (v, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const method = (v) => (PAYOUT_METHODS.includes(v) ? v : null);

/** Send PayrollError as its status; anything else is a 500. */
const handle = (label, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof PayrollError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    logger.error(`Payroll: ${label}`, { error: err?.message });
    serverError(res, `Error: ${label}`);
  }
};

// ── Teacher ──────────────────────────────────────────────────────────────────
router.get("/me", verifyToken, verifyTeacher, handle("loading salary", async (req, res) => {
  const s = await loadSettings(req.db);
  ok(res, { data: await teacherStatement(req.db, s, centerTz(req.center), req.teacher._id) });
}));

const HISTORY_TYPES = ["payslips", "payouts"];
router.get("/me/history", verifyToken, verifyTeacher, handle("loading salary history", async (req, res) => {
  if (!HISTORY_TYPES.includes(req.query.type)) return badRequest(res, "type must be payslips or payouts");
  ok(res, { data: await teacherHistory(req.db, req.teacher._id, req.query.type, { page: req.query.page }) });
}));

// ── Settings ─────────────────────────────────────────────────────────────────
router.get("/admin/settings", ...admin, handle("loading payroll settings", async (req, res) => {
  const [settings, teachers] = await Promise.all([loadSettings(req.db), chargeTeachers(req.db)]);
  ok(res, { data: { ...settings, timezone: centerTz(req.center), teachers, regions: CHARGE_REGIONS } });
}));

router.put("/admin/settings", ...admin, handle("saving payroll settings", async (req, res) => {
  const b = req.body || {};
  const payDay = Number(b.payDay);
  if (!Number.isInteger(payDay) || !((payDay >= 1 && payDay <= 28) || payDay === 31)) {
    return badRequest(res, "Pay day must be 1–28, or the last day of the month");
  }
  if (!["calendar_month", "ends_on_payday"].includes(b.cycle)) return badRequest(res, "Choose how the pay period runs");
  const retentionMonths = Number(b.retentionMonths ?? 6);
  if (!Number.isInteger(retentionMonths) || retentionMonths < 4 || retentionMonths > 24) {
    return badRequest(res, "History must be kept for 4–24 months");
  }
  if (!Array.isArray(b.charges) || b.charges.length > 20) return badRequest(res, "Up to 20 charges");
  const charges = [];
  for (const c of b.charges) {
    const name = text(c?.name, 60);
    const value = toMoney(c?.value);
    if (!name) return badRequest(res, "Every charge needs a name");
    if (!["percent", "fixed"].includes(c?.kind)) return badRequest(res, `"${name}": choose percent or fixed amount`);
    if (!(value > 0) || (c.kind === "percent" && value > 100) || value > MAX_AMOUNT) {
      return badRequest(res, `"${name}": ${c.kind === "percent" ? "percent must be between 0.01 and 100" : "enter an amount above 0"}`);
    }
    // Who pays it: every teacher, the teachers picked, or teachers in the regions picked
    const appliesTo = ["all", "teachers", "regions"].includes(c.appliesTo) ? c.appliesTo : "all";
    const teacherIds = appliesTo === "teachers"
      ? [...new Set((Array.isArray(c.teacherIds) ? c.teacherIds : []).map(String))].filter((id) => mongoose.isValidObjectId(id))
      : [];
    const regions = appliesTo === "regions"
      ? [...new Set((Array.isArray(c.regions) ? c.regions : []).filter((r) => CHARGE_REGIONS.includes(r)))]
      : [];
    if (appliesTo === "teachers" && (teacherIds.length === 0 || teacherIds.length > 5000)) return badRequest(res, `"${name}": pick at least one teacher`);
    if (appliesTo === "regions" && regions.length === 0) return badRequest(res, `"${name}": pick at least one region`);
    charges.push({
      ...(mongoose.isValidObjectId(c._id) ? { _id: c._id } : {}),
      name, kind: c.kind, value, active: c.active !== false, appliesTo, teacherIds, regions,
    });
  }
  // No teacher may lose more than 100% of their class earnings to percentage charges
  const percent = charges.filter((c) => c.active && c.kind === "percent");
  const teachers = await chargeTeachers(req.db);
  const allPct = percent.filter((c) => c.appliesTo === "all").reduce((sum, c) => sum + c.value, 0);
  if (allPct > 100) return badRequest(res, "Percentage charges add up to more than 100%");
  const over = teachers.find((t) => percent.filter((c) => chargeApplies(c, t)).reduce((sum, c) => sum + c.value, 0) > 100);
  if (over) return badRequest(res, `Percentage charges add up to more than 100% for ${over.firstName} ${over.lastName}`);

  const before = await loadSettings(req.db);
  const doc = await getPayrollSettings(req.db).findOneAndUpdate(
    { key: "main" },
    { $set: { payDay, cycle: b.cycle, charges, retentionMonths,
      ...(mongoose.isValidObjectId(req.admin?._id) ? { updatedBy: req.admin._id } : {}) } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  if (before.retentionMonths !== retentionMonths) await applyRetention(req.db, retentionMonths);
  logger.info(`Payroll settings saved: pay day ${payDay}, ${b.cycle}, ${charges.length} charge(s)`);
  ok(res, { data: { ...doc, timezone: centerTz(req.center), teachers, regions: CHARGE_REGIONS }, message: "Payroll settings saved" });
}));

// ── Periods ──────────────────────────────────────────────────────────────────
const periodKey = (req) => (KEY.test(req.params.key || "") ? req.params.key : null);

router.get(["/admin/periods", "/admin/periods/:key"], ...admin, handle("loading payroll", async (req, res) => {
  const s = await loadSettings(req.db);
  const { page, limit, q, status } = req.query;
  ok(res, { data: await periodView(req.db, s, centerTz(req.center), periodKey(req), new Date(), {
    page, limit, q: text(q, 100), status: typeof status === "string" ? status : "",
  }) });
}));

router.get("/admin/teachers", ...admin, handle("loading teachers", async (req, res) => {
  const teachers = await getTeacher(req.db).find().select("firstName lastName teacherCode continent active")
    .sort({ firstName: 1, lastName: 1 }).lean();
  ok(res, { data: teachers });
}));

router.post("/admin/periods/:key/settle", ...admin, handle("paying salary", async (req, res) => {
  const key = periodKey(req);
  if (!key) return badRequest(res, "Invalid pay period");
  if (!mongoose.isValidObjectId(req.body?.teacherId)) return badRequest(res, "Choose a teacher");
  const paymentMethod = method(req.body?.paymentMethod || "bank_transfer");
  if (!paymentMethod) return badRequest(res, `Payment method must be one of: ${PAYOUT_METHODS.join(", ")}`);
  const s = await loadSettings(req.db);
  const payslip = await settleSalary(req.db, s, centerTz(req.center), {
    key, teacherId: req.body.teacherId, paymentMethod, notes: text(req.body?.notes),
    admin: req.admin, early: req.body?.early === true,
  });
  logger.info(`💰 Salary paid: ${payslip.amountPaid} to ${payslip.teacherName} for ${key} (charges ${payslip.chargesTotal})`);
  ok(res, { data: payslip, message: `Salary paid to ${payslip.teacherName}` });
}));

// ── Loans / part payments ────────────────────────────────────────────────────
router.post("/admin/payouts", ...admin, handle("recording payment", async (req, res) => {
  const b = req.body || {};
  if (!mongoose.isValidObjectId(b.teacherId)) return badRequest(res, "Choose a teacher");
  if (!ADVANCE_KINDS.includes(b.kind)) return badRequest(res, "Choose loan or part payment");
  const amount = toMoney(b.amount);
  if (!(amount > 0) || amount > MAX_AMOUNT) return badRequest(res, `Amount must be between 0.01 and ${MAX_AMOUNT}`);
  const paymentMethod = method(b.paymentMethod || "bank_transfer");
  if (!paymentMethod) return badRequest(res, `Payment method must be one of: ${PAYOUT_METHODS.join(", ")}`);
  const payout = await recordAdvance(req.db, {
    teacherId: b.teacherId, kind: b.kind, amount, paymentMethod, notes: text(b.notes), admin: req.admin,
  });
  logger.info(`💸 ${b.kind} of ${amount} to ${payout.teacherName}`);
  created(res, { data: payout, message: "Payment recorded — it will come off the next salary" });
}));

router.post("/admin/payouts/:id/void", ...admin, handle("voiding payment", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return badRequest(res, "Invalid payment");
  const s = await loadSettings(req.db);
  const payout = await voidAdvance(req.db, s, { payoutId: req.params.id, reason: text(req.body?.reason, 200) });
  ok(res, { data: payout, message: "Payment voided" });
}));

/** ?teacherId= &kind= &from= &to= (YYYY-MM-DD, whole days in the center's time zone) shared by the two history lists */
function historyFilter(req, dateField) {
  const tz = centerTz(req.center);
  const q = req.query;
  const filter = {};
  if (mongoose.isValidObjectId(q.teacherId)) filter.teacherId = new mongoose.Types.ObjectId(String(q.teacherId));
  const range = {};
  if (KEY.test(q.from || "")) range.$gte = zonedToUtc(q.from, "00:00", tz);
  if (KEY.test(q.to || ""))   range.$lt  = zonedToUtc(q.to, "24:00", tz);
  if (Object.keys(range).length) filter[dateField] = range;
  return filter;
}

const paged = async (Model, filter, sort, req) => {
  let { limit, skip } = parsePagination(req.query);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Model.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Model.countDocuments(filter),
  ]);
  return { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
};

router.get("/admin/payouts", ...admin, handle("loading payment history", async (req, res) => {
  const filter = historyFilter(req, "paidAt");
  if ([...ADVANCE_KINDS, "salary"].includes(req.query.kind)) filter.kind = req.query.kind;
  const { items, pagination } = await paged(getTeacherPayout(req.db), filter, { paidAt: -1 }, req);
  const [sum] = await getTeacherPayout(req.db).aggregate([
    { $match: { ...filter, voided: false } },
    { $group: { _id: null, amount: { $sum: "$amount" }, n: { $sum: 1 } } },
  ]);
  ok(res, { data: { items, pagination, total: toMoney(sum?.amount || 0) } });
}));

router.get("/admin/payslips", ...admin, handle("loading payslips", async (req, res) => {
  const filter = { ...historyFilter(req, "paidAt"), status: "paid" };
  if (KEY.test(req.query.periodKey || "")) filter.periodKey = req.query.periodKey;
  ok(res, { data: await paged(getPayslip(req.db), filter, { paidAt: -1 }, req) });
}));

// ── Charges collected ────────────────────────────────────────────────────────
router.get("/admin/charges", ...admin, handle("loading charges", async (req, res) => {
  const s = await loadSettings(req.db);
  const Payslip = getPayslip(req.db);
  const [byPeriod, byRule] = await Promise.all([
    Payslip.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: "$periodKey", startYmd: { $first: "$startYmd" }, endYmd: { $first: "$endYmd" },
        chargesTotal: { $sum: "$chargesTotal" }, classEarnings: { $sum: "$classEarnings" }, teachers: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]),
    Payslip.aggregate([
      { $match: { status: "paid" } },
      { $unwind: "$charges" },
      { $group: { _id: "$charges.name", amount: { $sum: "$charges.amount" } } },
      { $sort: { amount: -1 } },
    ]),
  ]);
  const round = (r) => ({ ...r, chargesTotal: toMoney(r.chargesTotal), classEarnings: toMoney(r.classEarnings) });
  ok(res, { data: {
    allTime: toMoney(s.chargesCollectedAllTime || 0),
    retentionMonths: s.retentionMonths,
    byPeriod: byPeriod.map(round).map(({ _id, ...r }) => ({ periodKey: _id, ...r })),
    byRule: byRule.map((r) => ({ name: r._id, amount: toMoney(r.amount) })),
  } });
}));

router.get("/admin/teacher/:id/history", ...admin, handle("loading salary history", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return badRequest(res, "Invalid teacher");
  if (!HISTORY_TYPES.includes(req.query.type)) return badRequest(res, "type must be payslips or payouts");
  ok(res, { data: await teacherHistory(req.db, req.params.id, req.query.type, { page: req.query.page }) });
}));

router.get("/admin/teacher/:id", ...admin, handle("loading teacher salary", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return badRequest(res, "Invalid teacher");
  const s = await loadSettings(req.db);
  ok(res, { data: await teacherStatement(req.db, s, centerTz(req.center), req.params.id) });
}));

export default router;
