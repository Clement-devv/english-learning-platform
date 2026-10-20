// server/utils/payroll.js
// Monthly teacher salary: pay periods, the salary calculation and settling it.
//
// What a teacher is owed for a period
//   class earnings            (every class completed in the period — the charge base)
//   + bonuses / adjustments   (manual, from the old Payments tab)
//   − manual deductions
//   − general charges         (e.g. 10% of CLASS EARNINGS — always on the full
//                              amount, however much was handed over early; each
//                              charge is for every teacher, picked teachers or regions)
//   − loans / part payments   (already handed to the teacher during the period)
//   − classes already paid one by one outside payroll
//   − debt brought forward    (last salary came out negative)
//   = net  → paid if positive, otherwise carried into the next salary
//
// Which period an item belongs to
//   Earnings and loans are not tagged with a period when they happen. An item
//   belongs to the period containing its date — unless that period was already
//   settled for the teacher (e.g. paid on the pay day before the day ended), in
//   which case the next period picks it up. Settling a period stamps each item
//   with the payslip, so nothing is ever counted twice.
//
// Periods are worked out from the center's settings in the center's time zone.
// Once a period ends it is saved (PayrollPeriod) with the charges frozen, so a
// later change to the charge rate doesn't rewrite a salary that is already due.
import mongoose from "mongoose";
import { zonedToUtc, ymdInTz, isValidTz } from "./schedule.js";
import { toMoney, adjustTeacherEarnings } from "./classPayment.js";
import { decryptField } from "./encryption.js";
import { paymentTransactionSchema, signedAmount } from "../schemas/paymentTransactionSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import {
  payrollSettingsSchema, payrollPeriodSchema, payslipSchema, teacherPayoutSchema, ADVANCE_KINDS,
} from "../schemas/payrollSchemas.js";

export const getPayrollSettings = (db) => db.models.PayrollSettings || db.model("PayrollSettings", payrollSettingsSchema);
export const getPayrollPeriod   = (db) => db.models.PayrollPeriod   || db.model("PayrollPeriod",   payrollPeriodSchema);
export const getPayslip         = (db) => db.models.Payslip         || db.model("Payslip",         payslipSchema);
export const getTeacherPayout   = (db) => db.models.TeacherPayout   || db.model("TeacherPayout",   teacherPayoutSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);

export class PayrollError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// ── Calendar-day maths on "YYYY-MM-DD" ───────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const toYmd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;           // m = 1–12
const parseYmd = (s) => s.split("-").map(Number);
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addMonths = (y, m, n) => { const t = y * 12 + (m - 1) + n; return [Math.floor(t / 12), (t % 12) + 1]; };
export const addDays = (s, n) => {
  const [y, m, d] = parseYmd(s);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return toYmd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};
const clampDay = (payDay, y, m) => Math.min(payDay, daysIn(y, m));
const monthsLater = (date, n) => { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; };

export const centerTz = (center) => (isValidTz(center?.timezone) ? center.timezone : "UTC");

/** Last day ("YYYY-MM-DD") of the period that contains calendar day `day`. */
export function periodEndFor(day, s) {
  const [y, m, d] = parseYmd(day);
  if (s.cycle === "ends_on_payday") {
    const end = clampDay(s.payDay, y, m);
    if (d <= end) return toYmd(y, m, end);
    const [ny, nm] = addMonths(y, m, 1);
    return toYmd(ny, nm, clampDay(s.payDay, ny, nm));
  }
  return toYmd(y, m, daysIn(y, m));
}

/** First day of the period ending on `endYmd`. */
export function periodStartFor(endYmd, s) {
  const [y, m] = parseYmd(endYmd);
  const [py, pm] = addMonths(y, m, -1);
  const prevEnd = s.cycle === "ends_on_payday" ? toYmd(py, pm, clampDay(s.payDay, py, pm)) : toYmd(py, pm, daysIn(py, pm));
  return addDays(prevEnd, 1);
}

/** The day salaries for the period ending `endYmd` are paid: the first pay day on/after it ends. */
export function payDateFor(endYmd, s) {
  if (s.cycle === "ends_on_payday") return endYmd;
  const [y, m, d] = parseYmd(endYmd);
  if (s.payDay >= d) return endYmd; // "last day of the month"
  const [ny, nm] = addMonths(y, m, 1);
  return toYmd(ny, nm, clampDay(s.payDay, ny, nm));
}

/** A period (not saved) ending on `endYmd`. `afterYmd` keeps it from overlapping the period before. */
export function buildPeriod(endYmd, s, tz, afterYmd = null) {
  let startYmd = periodStartFor(endYmd, s);
  if (afterYmd && afterYmd > startYmd) startYmd = afterYmd;
  return {
    key: endYmd, startYmd, endYmd, payYmd: payDateFor(endYmd, s), timezone: tz,
    startAt: zonedToUtc(startYmd, "00:00", tz),
    endAt:   zonedToUtc(endYmd, "24:00", tz),
  };
}

const DEFAULT_SETTINGS = { payDay: 31, cycle: "calendar_month", charges: [], retentionMonths: 6, chargesCollectedAllTime: 0 };

/** The center's payroll settings (defaults until an admin saves them). */
export async function loadSettings(db) {
  const doc = await getPayrollSettings(db).findOne({ key: "main" }).lean();
  return { ...DEFAULT_SETTINGS, ...(doc || {}) };
}

const freezeCharges = (s) => (s.charges || []).filter((c) => c.active !== false)
  .map((c) => ({
    ruleId: c._id, name: c.name, kind: c.kind, value: c.value, amount: 0,
    appliesTo: c.appliesTo || "all", teacherIds: c.teacherIds || [], regions: c.regions || [],
  }));

/** Does a charge apply to this teacher ({ _id, continent })? Every teacher / the ones picked / their region. */
export function chargeApplies(rule, teacher) {
  if (rule.appliesTo === "teachers") return (rule.teacherIds || []).some((id) => String(id) === String(teacher?._id));
  if (rule.appliesTo === "regions") return (rule.regions || []).includes(teacher?.continent);
  return true;
}
const chargesFor = (rules, teacher) => (rules || []).filter((r) => chargeApplies(r, teacher));

async function savePeriod(db, p, s) {
  const doc = { ...p, charges: freezeCharges(s), purgeAt: monthsLater(p.endAt, s.retentionMonths + 1) };
  try {
    await getPayrollPeriod(db).updateOne({ key: p.key }, { $setOnInsert: doc }, { upsert: true });
  } catch (err) {
    if (err?.code !== 11000) throw err; // a parallel request saved it first
  }
  return getPayrollPeriod(db).findOne({ key: p.key }).lean();
}

/**
 * Save every period that has ended since the last saved one (freezing its charges),
 * and return { open, saved } — the period running now (not saved; current charges)
 * and the saved ones, newest first.
 */
export async function syncPeriods(db, s, tz, now = new Date()) {
  const Period = getPayrollPeriod(db);
  let latest = await Period.findOne().sort({ endAt: -1 }).lean();
  const today = ymdInTz(now, tz);

  if (!latest) {
    // First use: the period before this one may still be waiting for its pay day
    const prevEnd = addDays(periodStartFor(periodEndFor(today, s), s), -1);
    const prev = buildPeriod(prevEnd, s, tz);
    if (prev.payYmd >= today) latest = await savePeriod(db, prev, s);
  }
  for (let guard = 0; latest && guard < 36; guard++) {
    const after = addDays(latest.endYmd, 1);
    const p = buildPeriod(periodEndFor(after, s), s, tz, after);
    if (p.endAt > now) break;
    latest = await savePeriod(db, p, s);
  }

  const after = latest ? addDays(latest.endYmd, 1) : null;
  const openEnd = periodEndFor(after && after > today ? after : today, s);
  const open = { ...buildPeriod(openEnd, s, tz, after), charges: freezeCharges(s), open: true };
  const saved = await Period.find().sort({ endAt: -1 }).limit(36).lean();
  return { open, saved };
}

/**
 * A period by key: the open one or a saved one. With no key, the one the admin should
 * see first: the latest saved period while it is still running (paid early on its pay
 * day) or still has salaries to pay — otherwise the running one.
 */
export async function findPeriod(db, s, tz, key, now = new Date()) {
  const { open, saved } = await syncPeriods(db, s, tz, now);
  if (!key) {
    const last = saved[0];
    if (last && (last.endAt > now || await hasUnsettled(db, last))) return { period: last, open, saved };
    return { period: open, open, saved };
  }
  if (key === open.key) return { period: open, open, saved };
  const period = saved.find((p) => p.key === key);
  if (!period) throw new PayrollError("Pay period not found", 404);
  return { period, open, saved };
}

/** Any earnings or loans / part payments up to this period's end not yet counted in a salary? */
async function hasUnsettled(db, period) {
  const [tx, payout] = await Promise.all([
    getPaymentTransaction(db).exists({ payslipId: null, status: "pending", completedAt: { $lt: period.endAt } }),
    getTeacherPayout(db).exists({ payslipId: null, voided: false, kind: { $in: ADVANCE_KINDS }, paidAt: { $lt: period.endAt } }),
  ]);
  return !!(tx || payout);
}

const previousOf = (period, saved) => saved.find((p) => p.endAt < period.endAt) || null;

// ── The calculation ──────────────────────────────────────────────────────────

/** Salary breakdown from a teacher's earnings rows, loans/part payments and debt. */
export function calculate({ txs = [], advances = [], broughtForward = 0, chargeRules = [] }) {
  let classCount = 0, classEarnings = 0, bonuses = 0, manualDeductions = 0, alreadyPaid = 0;
  for (const tx of txs) {
    const amount = Number(tx.amount) || 0;
    if (tx.type === "class_completion") { classCount++; classEarnings += amount; }
    else if (tx.type === "deduction") manualDeductions += amount;
    else bonuses += amount;
    if (tx.status === "paid") alreadyPaid += signedAmount(tx);
  }
  classEarnings = toMoney(classEarnings);
  const charges = chargeRules.map((r) => ({
    ruleId: r.ruleId, name: r.name, kind: r.kind, value: r.value,
    amount: r.kind === "fixed" ? (classEarnings > 0 ? toMoney(r.value) : 0) : toMoney(classEarnings * r.value / 100),
  }));
  const chargesTotal  = toMoney(charges.reduce((sum, c) => sum + c.amount, 0));
  const advancesTotal = toMoney(advances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0));
  const bf = toMoney(broughtForward);
  const net = toMoney(classEarnings + bonuses - manualDeductions - chargesTotal - alreadyPaid - advancesTotal - bf);
  return {
    classCount, classEarnings,
    bonuses: toMoney(bonuses), manualDeductions: toMoney(manualDeductions),
    charges, chargesTotal, advancesTotal, alreadyPaid: toMoney(alreadyPaid), broughtForward: bf,
    net, amountPaid: Math.max(0, net), carryForward: toMoney(Math.max(0, -net)),
  };
}

/**
 * Live salary for each teacher in a period that they haven't been paid for yet.
 * Returns Map(teacherId → { ...calculate(), advances, txIds, hasActivity }).
 */
export async function computeUnsettled(db, period, saved, teacherIds) {
  const ids = teacherIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const prev = previousOf(period, saved);
  const settledPrev = new Set(prev
    ? (await getPayslip(db).find({ periodKey: prev.key, teacherId: { $in: ids } }).select("teacherId").lean()).map((p) => String(p.teacherId))
    : []);
  // Previous period still unpaid for the teacher → it keeps its own items (and debt)
  const lowerBound = (tid) => (prev && !settledPrev.has(tid) ? prev.endAt : null);

  const [txs, advances, lastSlips] = await Promise.all([
    getPaymentTransaction(db).find({
      teacherId: { $in: ids }, payslipId: null, status: { $ne: "cancelled" },
      completedAt: { $lt: period.endAt },
      // Classes paid one by one before this period were settled under the old flow
      $or: [{ status: "pending" }, { completedAt: { $gte: period.startAt } }],
    }).select("teacherId amount type status completedAt").lean(),
    getTeacherPayout(db).find({
      teacherId: { $in: ids }, payslipId: null, voided: false, kind: { $in: ADVANCE_KINDS },
      paidAt: { $lt: period.endAt },
    }).select("teacherId kind amount paidAt paymentMethod notes paidByName").sort({ paidAt: 1 }).lean(),
    getPayslip(db).aggregate([
      { $match: { teacherId: { $in: ids }, status: "paid", endAt: { $lt: period.endAt } } },
      { $sort: { endAt: -1 } },
      { $group: { _id: "$teacherId", carryForward: { $first: "$carryForward" } } },
    ]),
  ]);
  const carry = new Map(lastSlips.map((r) => [String(r._id), r.carryForward || 0]));

  const regionOf = new Map((await getTeacher(db).find({ _id: { $in: ids } }).select("continent").lean())
    .map((t) => [String(t._id), t.continent]));

  const out = new Map();
  for (const id of ids) {
    const tid = String(id);
    const lb = lowerBound(tid);
    const mine = txs.filter((t) => String(t.teacherId) === tid && (!lb || t.completedAt >= lb));
    const adv  = advances.filter((a) => String(a.teacherId) === tid && (!lb || a.paidAt >= lb));
    const broughtForward = lb ? 0 : (carry.get(tid) || 0);
    out.set(tid, {
      ...calculate({ txs: mine, advances: adv, broughtForward, chargeRules: chargesFor(period.charges, { _id: id, continent: regionOf.get(tid) }) }),
      advances: adv,
      txIds: mine.map((t) => t._id),
      hasActivity: mine.length > 0 || adv.length > 0 || broughtForward > 0,
    });
  }
  return out;
}

const fullName = (t) => `${t?.firstName || ""} ${t?.lastName || ""}`.trim();

const ROW_STATUSES = ["unpaid", "paid", "owes", "nothing"];

/**
 * Admin: teachers' salaries for one period — settled ones from their payslip, the rest live.
 * Totals cover every teacher; `rows` is one page, after the search (name / ID / email) and
 * status filter (unpaid | paid | owes | nothing).
 */
export async function periodView(db, s, tz, key, now = new Date(), { page = 1, limit = 25, q = "", status = "" } = {}) {
  const { period, open, saved } = await findPeriod(db, s, tz, key, now);
  const Teacher = getTeacher(db);
  const [slips, owedIds, advIds] = await Promise.all([
    getPayslip(db).find({ periodKey: period.key }).lean(),
    getPaymentTransaction(db).distinct("teacherId", { payslipId: null, status: "pending" }),
    getTeacherPayout(db).distinct("teacherId", { payslipId: null, voided: false }),
  ]);
  const teachers = await Teacher.find({ $or: [
    { active: true },
    { _id: { $in: [...slips.map((p) => p.teacherId), ...owedIds, ...advIds] } },
  ] }).select("firstName lastName email ratePerClass teacherCode continent active").lean();

  const slipBy = new Map(slips.map((p) => [String(p.teacherId), p]));
  const live = await computeUnsettled(db, period, saved, teachers.filter((t) => !slipBy.has(String(t._id))).map((t) => t._id));
  const today = ymdInTz(now, tz);

  const rows = teachers.map((t) => {
    const tid = String(t._id);
    const base = {
      teacherId: t._id, teacherName: fullName(t), email: t.email, teacherCode: t.teacherCode || "",
      ratePerClass: t.ratePerClass || 0, active: t.active, continent: t.continent || "",
    };
    const slip = slipBy.get(tid);
    if (slip) return { ...base, status: "paid", payslip: slip, ...pickTotals(slip) };
    const calc = live.get(tid);
    const { txIds, ...rest } = calc;  
    return { ...base, status: calc.hasActivity ? "unpaid" : "nothing", ...rest };
  }).filter((r) => r.status !== "nothing" || r.active)
    .sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  // One page of rows (unpaid first, then by name); bank details only for the rows sent
  const term = String(q || "").trim().toLowerCase();
  const order = { unpaid: 0, owes: 1, paid: 2, nothing: 3 };
  const rowStatus = (r) => (r.status === "unpaid" && r.carryForward > 0 ? "owes" : r.status);
  const matching = rows
    .filter((r) => !term || `${r.teacherName} ${r.teacherCode} ${r.email}`.toLowerCase().includes(term))
    .filter((r) => !ROW_STATUSES.includes(status) || rowStatus(r) === status || (status === "unpaid" && rowStatus(r) === "owes"))
    .sort((a, b) => order[rowStatus(a)] - order[rowStatus(b)] || a.teacherName.localeCompare(b.teacherName));
  const size = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 200);
  const totalPages = Math.max(1, Math.ceil(matching.length / size));
  const pageNo = Math.min(Math.max(parseInt(page, 10) || 1, 1), totalPages);
  const pageRows = matching.slice((pageNo - 1) * size, pageNo * size);
  const bank = new Map((await Teacher.find({ _id: { $in: pageRows.map((r) => r.teacherId) } })
    .select("bankName accountNumber accountName").lean())
    .map((t) => [String(t._id), { bankName: decryptField(t.bankName) || "", accountNumber: decryptField(t.accountNumber) || "", accountName: decryptField(t.accountName) || "" }]));
  pageRows.forEach((r) => Object.assign(r, bank.get(String(r.teacherId)) || {}));

  const sum = (f, pred = () => true) => toMoney(rows.filter(pred).reduce((acc, r) => acc + (r[f] || 0), 0));
  const chargeTotals = {};
  rows.forEach((r) => (r.charges || []).forEach((c) => { chargeTotals[c.name] = toMoney((chargeTotals[c.name] || 0) + c.amount); }));
  return {
    period: { ...period, status: period.open ? "open" : "ended", payable: today >= period.payYmd || !period.open },
    periods: [open, ...saved].map((p) => ({ key: p.key, startYmd: p.startYmd, endYmd: p.endYmd, payYmd: p.payYmd, open: !!p.open })),
    rows: pageRows,
    pagination: { page: pageNo, limit: size, total: matching.length, totalPages },
    counts: {
      all: rows.length,
      unpaid: rows.filter((r) => r.status === "unpaid").length,
      owes: rows.filter((r) => rowStatus(r) === "owes").length,
      paid: rows.filter((r) => r.status === "paid").length,
      nothing: rows.filter((r) => r.status === "nothing").length,
    },
    totals: {
      classEarnings: sum("classEarnings"), classCount: sum("classCount"),
      chargesTotal: sum("chargesTotal"), advancesTotal: sum("advancesTotal"),
      toPay: sum("amountPaid", (r) => r.status === "unpaid"), paid: sum("amountPaid", (r) => r.status === "paid"),
      carryForward: sum("carryForward"),
      teachersUnpaid: rows.filter((r) => r.status === "unpaid").length,
      teachersPaid: rows.filter((r) => r.status === "paid").length,
      chargeTotals: Object.entries(chargeTotals).map(([name, amount]) => ({ name, amount })),
    },
  };
}

const TOTAL_FIELDS = ["classCount", "classEarnings", "bonuses", "manualDeductions", "charges", "chargesTotal",
  "advancesTotal", "alreadyPaid", "broughtForward", "net", "amountPaid", "carryForward"];
const pickTotals = (o) => Object.fromEntries(TOTAL_FIELDS.map((f) => [f, o[f]]));

/** A teacher's own salary page (also the admin's "verify" view of one teacher). */
export async function teacherStatement(db, s, tz, teacherId, now = new Date()) {
  const { open, saved } = await syncPeriods(db, s, tz, now);
  const tid = new mongoose.Types.ObjectId(String(teacherId));
  const Payslip = getPayslip(db);
  const recentSaved = saved.filter((p) => p.endAt > monthsLater(now, -s.retentionMonths));
  const [payslips, payouts, me, settled] = await Promise.all([
    teacherHistory(db, tid, "payslips"),
    teacherHistory(db, tid, "payouts"),
    getTeacher(db).findById(tid).select("continent").lean(),
    Payslip.distinct("periodKey", { teacherId: tid, periodKey: { $in: [open, ...recentSaved].map((p) => p.key) } }),
  ]);
  const settledKeys = new Set(settled);

  // The running period, plus any ended period not paid yet that has something in it
  const current = [];
  for (const p of [open, ...recentSaved]) {
    if (settledKeys.has(p.key)) continue;
    const calc = (await computeUnsettled(db, p, saved, [tid])).get(String(tid));
    if (!p.open && !calc.hasActivity) continue;
    const { txIds, ...rest } = calc;  
    current.push({ period: { key: p.key, startYmd: p.startYmd, endYmd: p.endYmd, payYmd: p.payYmd, open: !!p.open }, ...rest });
  }
  return {
    settings: {
      payDay: s.payDay, cycle: s.cycle,
      charges: chargesFor((s.charges || []).filter((c) => c.active !== false), { _id: tid, continent: me?.continent }).map((c) => ({ name: c.name, kind: c.kind, value: c.value })),
      retentionMonths: s.retentionMonths,
    },
    current, payslips, payouts,
  };
}

/** One page of a teacher's payslips or payments received: { items, pagination } (newest first). */
export async function teacherHistory(db, teacherId, type, { page = 1, limit = type === "payslips" ? 10 : 20 } = {}) {
  const tid = new mongoose.Types.ObjectId(String(teacherId));
  const [Model, filter, sort] = type === "payslips"
    ? [getPayslip(db), { teacherId: tid, status: "paid" }, { endAt: -1 }]
    : [getTeacherPayout(db), { teacherId: tid }, { paidAt: -1 }];
  const size = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const pageNo = Math.max(parseInt(page, 10) || 1, 1);
  const [items, total] = await Promise.all([
    Model.find(filter).sort(sort).skip((pageNo - 1) * size).limit(size).lean(),
    Model.countDocuments(filter),
  ]);
  return { items, pagination: { page: pageNo, limit: size, total, totalPages: Math.max(1, Math.ceil(total / size)) } };
}

// ── Money out ────────────────────────────────────────────────────────────────

const adminRef = (admin) => ({
  ...(admin?._id && mongoose.isValidObjectId(admin._id) ? { paidBy: admin._id } : {}),
  paidByName: admin?._id ? fullName(admin) : "Support (impersonation)",
});

/** Hand a teacher a loan or part payment now; it comes off their next salary. */
export async function recordAdvance(db, { teacherId, kind, amount, paymentMethod, notes, admin, now = new Date() }) {
  const teacher = await getTeacher(db).findById(teacherId).select("firstName lastName").lean();
  if (!teacher) throw new PayrollError("Teacher not found", 404);
  return getTeacherPayout(db).create({
    teacherId, teacherName: fullName(teacher), kind, amount: toMoney(amount),
    paymentMethod, notes, paidAt: now, ...adminRef(admin),
  });
}

/** Cancel a loan / part payment entered by mistake (only before it's counted in a salary). */
export async function voidAdvance(db, s, { payoutId, reason, now = new Date() }) {
  const payout = await getTeacherPayout(db).findOneAndUpdate(
    { _id: payoutId, payslipId: null, voided: false, kind: { $in: ADVANCE_KINDS } },
    { $set: { voided: true, voidedAt: now, voidReason: reason, purgeAt: monthsLater(now, s.retentionMonths) } },
    { new: true },
  ).lean();
  if (!payout) {
    const existing = await getTeacherPayout(db).findById(payoutId).select("voided payslipId").lean();
    if (!existing) throw new PayrollError("Payment not found", 404);
    throw new PayrollError(existing.voided ? "This payment was already voided" : "This payment is already part of a paid salary and can't be voided");
  }
  return payout;
}

/**
 * Pay one teacher's salary for a period. Freezes the period, stamps every earning
 * and loan/part payment counted with the new payslip, lowers Teacher.earned by the
 * classes settled, and records the salary payout. Returns the payslip.
 */
export async function settleSalary(db, s, tz, { key, teacherId, paymentMethod, notes, admin, early = false, now = new Date() }) {
  let { period, saved } = await findPeriod(db, s, tz, key, now);
  const today = ymdInTz(now, tz);
  if (period.open && today < period.payYmd && !early) {
    throw new PayrollError(`Salary for this period is due on ${period.payYmd}. Use a part payment to pay before then.`);
  }
  const tid = String(teacherId);
  const teacher = await getTeacher(db).findById(tid).select("firstName lastName continent").lean();
  if (!teacher) throw new PayrollError("Teacher not found", 404);

  // Pay periods in order — a teacher's older unpaid salary first
  const prev = previousOf(period, saved);
  if (prev && !(await getPayslip(db).exists({ periodKey: prev.key, teacherId: tid }))) {
    const prevCalc = (await computeUnsettled(db, prev, saved, [tid])).get(tid);
    if (prevCalc.hasActivity) throw new PayrollError(`Pay the salary for the period ending ${prev.endYmd} first`);
  }

  // Paying the running period (on its pay day, or early) freezes its charges now
  if (period.open) {
    const { open: _o, ...p } = period;  
    period = await savePeriod(db, p, s);
    saved = [period, ...saved.filter((x) => x.key !== period.key)];
  }

  const before = (await computeUnsettled(db, period, saved, [tid])).get(tid);
  if (!before.hasActivity) throw new PayrollError("Nothing to pay this teacher for this period");

  const Payslip = getPayslip(db), Tx = getPaymentTransaction(db), Payout = getTeacherPayout(db);
  let slip;
  try {
    slip = await Payslip.create({
      periodKey: period.key, teacherId: tid, teacherName: fullName(teacher), status: "processing",
      startYmd: period.startYmd, endYmd: period.endYmd, payYmd: period.payYmd, endAt: period.endAt,
    });
  } catch (err) {
    if (err?.code === 11000) throw new PayrollError("This teacher's salary for this period has already been paid", 409);
    throw err;
  }

  const paidAt = now;
  const by = adminRef(admin);
  let earnedTaken = 0;
  try {
    const txIds = before.txIds;
    await Tx.updateMany(
      { _id: { $in: txIds }, status: "pending", payslipId: null },
      { $set: { status: "paid", paidAt, paymentMethod, payslipId: slip._id, notes: `Salary ${period.endYmd}`, ...(by.paidBy ? { paidBy: by.paidBy } : {}) } },
    );
    await Tx.updateMany({ _id: { $in: txIds }, status: "paid", payslipId: null }, { $set: { payslipId: slip._id } });
    await Payout.updateMany(
      { _id: { $in: before.advances.map((a) => a._id) }, payslipId: null, voided: false },
      { $set: { payslipId: slip._id, periodKey: period.key } },
    );

    // Work the salary out from exactly what got stamped (a class reversed a moment ago is out)
    const [txs, advances] = await Promise.all([
      Tx.find({ payslipId: slip._id }).select("amount type status paidAt").lean(),
      Payout.find({ payslipId: slip._id, kind: { $in: ADVANCE_KINDS } }).select("amount").lean(),
    ]);
    const settledNow = txs.filter((t) => t.paidAt && t.paidAt.getTime() === paidAt.getTime());
    earnedTaken = toMoney(settledNow.reduce((sum, t) => sum + signedAmount(t), 0));
    // Teacher.earned is the unpaid class balance (never below 0)
    if (earnedTaken) await adjustTeacherEarnings(db, tid, -earnedTaken, 0);

    // Classes this salary just paid count as earnings, not as "already paid" before it
    const asCounted = txs.map((t) => (settledNow.includes(t) ? { ...t, status: "pending" } : t));
    const calc = calculate({ txs: asCounted, advances, broughtForward: before.broughtForward, chargeRules: chargesFor(period.charges, teacher) });
    const purgeAt = calc.carryForward > 0 ? null : monthsLater(paidAt, s.retentionMonths);
    if (calc.amountPaid > 0) {
      await Payout.create({
        teacherId: tid, teacherName: fullName(teacher), kind: "salary", amount: calc.amountPaid,
        paymentMethod, notes, paidAt, ...by, payslipId: slip._id, periodKey: period.key, purgeAt,
      });
    }
    await Payout.updateMany({ payslipId: slip._id }, { $set: { purgeAt } });
    slip = await Payslip.findByIdAndUpdate(slip._id, { $set: {
      ...calc, status: "paid", paymentMethod, notes, paidAt, purgeAt, ...(by.paidBy ? { paidBy: by.paidBy } : {}),
    } }, { new: true }).lean();
    if (calc.chargesTotal) {
      await getPayrollSettings(db).updateOne({ key: "main" }, { $inc: { chargesCollectedAllTime: calc.chargesTotal } }, { upsert: true });
    }
    return slip;
  } catch (err) {
    // Put everything back so the salary can be paid again
    await Tx.updateMany({ payslipId: slip._id, paidAt }, { $set: { status: "pending" }, $unset: { paidAt: "", paidBy: "", payslipId: "" } }).catch(() => {});
    await Tx.updateMany({ payslipId: slip._id }, { $unset: { payslipId: "" } }).catch(() => {});
    await Payout.deleteMany({ payslipId: slip._id, kind: "salary" }).catch(() => {});
    await Payout.updateMany({ payslipId: slip._id }, { $unset: { payslipId: "", purgeAt: "" }, $set: { periodKey: "" } }).catch(() => {});
    if (earnedTaken) await adjustTeacherEarnings(db, tid, earnedTaken, 0).catch(() => {});
    await Payslip.deleteOne({ _id: slip._id }).catch(() => {});
    throw err;
  }
}

/** When a center changes how long history is kept, move existing purge dates to match. */
export async function applyRetention(db, months) {
  const shift = async (Model) => {
    const docs = await Model.find({ purgeAt: { $ne: null } }).select("paidAt voidedAt voided").lean();
    if (!docs.length) return;
    await Model.bulkWrite(docs.map((d) => ({ updateOne: {
      filter: { _id: d._id },
      update: { $set: { purgeAt: monthsLater(d.voided ? d.voidedAt : d.paidAt, months) } },
    } })));
  };
  await Promise.all([shift(getPayslip(db)), shift(getTeacherPayout(db))]);
}
