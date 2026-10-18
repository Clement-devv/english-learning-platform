// server/schemas/payrollSchemas.js
// Monthly teacher payroll (utils/payroll.js, routes/payrollRoutes.js).
//
//   PayrollSettings — one doc per center: pay day, how the pay period runs, the
//                     general charges taken from every teacher, history retention
//   PayrollPeriod   — a pay period once it has ended (or been paid early); freezes
//                     the charges that apply to it
//   Payslip         — one teacher's settled salary for one period (a snapshot)
//   TeacherPayout   — money the center actually handed a teacher: a loan / part
//                     payment during the period, or the final salary
//
// Class earnings themselves stay in PaymentTransaction; a settled one carries
// the payslipId it was paid under.
import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const PAYOUT_METHODS = ['bank_transfer', 'paypal', 'cash', 'check', 'other'];
export const ADVANCE_KINDS  = ['loan', 'part_payment'];
// Same regions as Teacher.continent
export const CHARGE_REGIONS = ['Africa', 'Europe', 'Asia', 'Americas', 'Oceania'];

// Who a charge is taken from: every teacher, the teachers picked, or teachers in the regions picked
const chargeScope = {
  appliesTo:  { type: String, enum: ['all', 'teachers', 'regions'], default: 'all' },
  teacherIds: { type: [ObjectId], default: [] },
  regions:    { type: [{ type: String, enum: CHARGE_REGIONS }], default: [] },
};

const chargeRuleSchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true, maxlength: 60 },
  kind:   { type: String, enum: ['percent', 'fixed'], default: 'percent' },
  value:  { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true },
  ...chargeScope,
}, { _id: true });

export const payrollSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  // 1–28, or 31 = the last day of the month
  payDay: { type: Number, default: 31, min: 1, max: 31 },
  // calendar_month — the period is the 1st → last day; salary is paid on the next pay day
  // ends_on_payday — the period runs up to and including the pay day (e.g. 26th → 25th)
  cycle:  { type: String, enum: ['calendar_month', 'ends_on_payday'], default: 'calendar_month' },
  charges: { type: [chargeRuleSchema], default: [] },
  retentionMonths: { type: Number, default: 6, min: 4, max: 24 },
  // Running total of every charge ever collected — survives history purges
  chargesCollectedAllTime: { type: Number, default: 0 },
  updatedBy: { type: ObjectId, ref: 'Admin' },
}, { timestamps: true });

const chargeLineSchema = new mongoose.Schema({
  ruleId: ObjectId,
  name:   String,
  kind:   { type: String, enum: ['percent', 'fixed'] },
  value:  Number,
  amount: { type: Number, default: 0 },
  ...chargeScope, // frozen with the period; not stored on payslips (they only list the charges taken)
}, { _id: false });

export const payrollPeriodSchema = new mongoose.Schema({
  key:      { type: String, required: true, unique: true }, // end day "YYYY-MM-DD"
  startYmd: { type: String, required: true },
  endYmd:   { type: String, required: true },
  payYmd:   { type: String, required: true },
  startAt:  { type: Date, required: true },
  endAt:    { type: Date, required: true },               // exclusive
  timezone: { type: String, default: 'UTC' },
  charges:  { type: [chargeLineSchema], default: [] },    // frozen rules (amount unused)
  purgeAt:  { type: Date, default: null },
}, { timestamps: true });
payrollPeriodSchema.index({ endAt: -1 });
payrollPeriodSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export const payslipSchema = new mongoose.Schema({
  periodKey: { type: String, required: true },
  teacherId: { type: ObjectId, ref: 'Teacher', required: true },
  teacherName: { type: String, default: '' },
  status:    { type: String, enum: ['processing', 'paid'], default: 'processing' },
  startYmd: String, endYmd: String, payYmd: String,
  endAt: Date,

  classCount:       { type: Number, default: 0 },
  classEarnings:    { type: Number, default: 0 }, // charges are worked out on this
  bonuses:          { type: Number, default: 0 },
  manualDeductions: { type: Number, default: 0 },
  charges:          { type: [chargeLineSchema], default: [] },
  chargesTotal:     { type: Number, default: 0 },
  advancesTotal:    { type: Number, default: 0 }, // loans + part payments already handed over
  alreadyPaid:      { type: Number, default: 0 }, // classes paid one by one outside payroll
  broughtForward:   { type: Number, default: 0 }, // debt from the previous payslip
  net:              { type: Number, default: 0 },
  amountPaid:       { type: Number, default: 0 }, // max(net, 0)
  carryForward:     { type: Number, default: 0 }, // max(-net, 0) — taken from the next salary

  paymentMethod: { type: String, enum: PAYOUT_METHODS, default: 'bank_transfer' },
  notes:  { type: String, default: '' },
  paidAt: Date,
  paidBy: { type: ObjectId, ref: 'Admin' },
  // Kept `retentionMonths` after payment; a payslip still carrying debt is never purged
  purgeAt: { type: Date, default: null },
}, { timestamps: true });
payslipSchema.index({ periodKey: 1, teacherId: 1 }, { unique: true });
payslipSchema.index({ teacherId: 1, endAt: -1 });
payslipSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export const teacherPayoutSchema = new mongoose.Schema({
  teacherId: { type: ObjectId, ref: 'Teacher', required: true },
  teacherName: { type: String, default: '' },
  kind:   { type: String, enum: [...ADVANCE_KINDS, 'salary'], required: true },
  amount: { type: Number, required: true, min: 0.01 },
  paymentMethod: { type: String, enum: PAYOUT_METHODS, default: 'bank_transfer' },
  notes:  { type: String, default: '' },
  paidAt: { type: Date, required: true },
  paidBy: { type: ObjectId, ref: 'Admin' },
  paidByName: { type: String, default: '' },
  // Set once the payout has been counted in a salary (loans / part payments) or is the salary itself
  payslipId: { type: ObjectId, ref: 'Payslip' },
  periodKey: { type: String, default: '' },
  // A mistaken loan / part payment can be voided before it's counted — the record stays
  voided:     { type: Boolean, default: false },
  voidedAt:   Date,
  voidReason: { type: String, default: '' },
  purgeAt: { type: Date, default: null },
}, { timestamps: true });
teacherPayoutSchema.index({ teacherId: 1, paidAt: -1 });
teacherPayoutSchema.index({ paidAt: -1 });
teacherPayoutSchema.index({ payslipId: 1 });
teacherPayoutSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
