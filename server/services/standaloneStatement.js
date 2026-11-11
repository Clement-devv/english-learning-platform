import mongoose from 'mongoose';
import { bookingSchema } from '../schemas/bookingSchema.js';
import { groupClassSchema } from '../schemas/groupClassSchema.js';
import { studentSchema } from '../schemas/studentSchema.js';
import { teacherModeModels, teacherChargeVersionSchema } from '../schemas/teacherModeSchemas.js';
import { localDayRange, safeTimeZone } from '../utils/dailyClassReport.js';

const bad = (message) => Object.assign(new Error(message), { statusCode: 400 });
const model = (db, name, schema) => db.models[name] || db.model(name, schema);
const validDate = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s || '') &&
  !isNaN(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
export function statementRange(from, to, timezone) {
  if (
    !validDate(from) ||
    !validDate(to) ||
    from > to ||
    (Date.parse(to) - Date.parse(from)) / 86400000 > 365
  )
    throw bad('Choose valid start and end dates, up to one year apart.');
  const tz = safeTimeZone(timezone);
  return { start: localDayRange(from, tz).start, end: localDayRange(to, tz).end, tz };
}

// Same UTC calendar-month charge policy as the existing earnings dashboard.
export function monthlyCharges(versions, centerId, currency, month, gross) {
  const [year, mon] = month.split('-').map(Number);
  const end = new Date(Date.UTC(year, mon, 1));
  const version = versions.filter((v) => new Date(v.effectiveAt) < end).at(-1);
  return (version?.rules || [])
    .filter(
      (r) =>
        (!r.centerIds?.length || r.centerIds.some((id) => String(id) === String(centerId))) &&
        (r.kind === 'percent' || r.currency === currency)
    )
    .map((r) => ({
      month,
      name: r.name,
      kind: r.kind,
      value: r.value,
      amountMinor: r.kind === 'fixed' ? r.value : Math.round((gross * r.value) / 10000),
    }));
}

export function calculateStatement({ rows, receipts, centers, versions, start, end }) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.centerId}/${row.currency}/${new Date(row.date).toISOString().slice(0, 7)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const entries = [],
    charges = [];
  for (const monthly of groups.values()) {
    monthly.sort(
      (a, b) => +new Date(a.date) - +new Date(b.date) || String(a.id).localeCompare(String(b.id))
    );
    const first = monthly[0],
      month = new Date(first.date).toISOString().slice(0, 7);
    const gross = monthly.reduce((n, r) => n + r.amountMinor, 0);
    const rules = monthlyCharges(versions, first.centerId, first.currency, month, gross);
    let cumulative = 0;
    for (const row of monthly) {
      const weight = gross ? row.amountMinor : 1,
        totalWeight = gross || monthly.length;
      const allocated = rules.map((r) => ({
        ...r,
        centerId: row.centerId,
        currency: row.currency,
        monthlyAmountMinor: r.amountMinor,
        amountMinor:
          Math.round((r.amountMinor * (cumulative + weight)) / totalWeight) -
          Math.round((r.amountMinor * cumulative) / totalWeight),
      }));
      cumulative += weight;
      if (new Date(row.date) < start || new Date(row.date) >= end) continue;
      const chargesMinor = allocated.reduce((n, r) => n + r.amountMinor, 0);
      entries.push({ ...row, chargesMinor, netMinor: row.amountMinor - chargesMinor });
      for (const r of allocated) {
        const existing = charges.find(
          (c) =>
            c.centerId === r.centerId &&
            c.currency === r.currency &&
            c.month === r.month &&
            c.name === r.name &&
            c.kind === r.kind &&
            c.value === r.value
        );
        if (existing) existing.amountMinor += r.amountMinor;
        else charges.push({ ...r });
      }
    }
  }
  entries.sort(
    (a, b) => +new Date(a.date) - +new Date(b.date) || String(a.id).localeCompare(String(b.id))
  );
  const payments = receipts.filter(
    (r) => new Date(r.receivedAt) >= start && new Date(r.receivedAt) < end
  );
  const accounts = new Map();
  for (const row of [...entries, ...payments]) {
    const centerId = String(row.centerId);
    accounts.set(`${centerId}/${row.currency}`, { centerId, currency: row.currency });
  }
  const totals = [...accounts.values()].map(({ centerId, currency }) => {
    const matching = entries.filter(
      (r) => r.currency === currency && String(r.centerId) === centerId
    );
    const gross = matching.reduce((n, r) => n + r.amountMinor, 0),
      deductions = matching.reduce((n, r) => n + r.chargesMinor, 0);
    const received = payments
      .filter((r) => r.currency === currency && String(r.centerId) === centerId)
      .reduce((n, r) => n + r.amountMinor, 0);
    const net = gross - deductions;
    return {
      centerId,
      centerName: centers.find((c) => String(c._id) === centerId)?.name || 'Center',
      currency,
      lessons: matching.length,
      gross,
      charges: deductions,
      net,
      received,
      outstanding: net - received,
    };
  });
  return { entries, charges, payments, totals, centers };
}

export async function buildStandaloneStatement(
  db,
  { teacherId, teacherName, timezone, from, to, centerId }
) {
  const { start, end, tz } = statementRange(from, to, timezone);
  const { ManagedCenter, TeacherReceipt } = teacherModeModels(db);
  if (centerId && !mongoose.isValidObjectId(centerId)) throw bad('Invalid center.');
  const centers = await ManagedCenter.find(centerId ? { _id: centerId } : {})
    .select('name currency')
    .lean();
  if (centerId && !centers.length) throw bad('Center not found.');
  const monthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(+end - 1),
    monthEnd = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1));
  const filter = {
    teacherId,
    managedCenterId: { $in: centers.map((c) => c._id) },
    status: 'completed',
    'standalonePay.currency': { $exists: true },
    $expr: {
      $and: [
        { $gte: [{ $ifNull: ['$completedAt', '$scheduledTime'] }, monthStart] },
        { $lt: [{ $ifNull: ['$completedAt', '$scheduledTime'] }, monthEnd] },
      ],
    },
  };
  model(db, 'Student', studentSchema);
  const [bookings, groups, receipts, versions] = await Promise.all([
    model(db, 'Booking', bookingSchema)
      .find(filter)
      .select(
        'classTitle studentId scheduledTime completedAt duration managedCenterId standalonePay'
      )
      .populate('studentId', 'firstName lastName')
      .limit(20001)
      .lean(),
    model(db, 'GroupClass', groupClassSchema)
      .find(filter)
      .select('title scheduledTime completedAt duration managedCenterId standalonePay')
      .limit(20001)
      .lean(),
    TeacherReceipt.find({
      centerId: { $in: centers.map((c) => c._id) },
      receivedAt: { $gte: start, $lt: end },
    })
      .sort({ receivedAt: 1, _id: 1 })
      .limit(20001)
      .lean(),
    model(db, 'TeacherChargeVersion', teacherChargeVersionSchema)
      .find()
      .sort({ effectiveAt: 1, _id: 1 })
      .lean(),
  ]);
  if (bookings.length + groups.length > 20000 || receipts.length > 20000)
    throw bad('Too many records. Choose a shorter date range.');
  const row = (r, type) => ({
    id: String(r._id),
    type,
    title: r.classTitle || r.title,
    student: r.studentId
      ? [r.studentId.firstName, r.studentId.lastName].filter(Boolean).join(' ')
      : 'Group class',
    centerId: String(r.managedCenterId),
    date: r.completedAt || r.scheduledTime,
    scheduledTime: r.scheduledTime,
    duration: r.duration,
    currency: r.standalonePay.currency,
    amountMinor: r.standalonePay.amountMinor || 0,
  });
  return {
    teacherName,
    from,
    to,
    timezone: tz,
    generatedAt: new Date(),
    ...calculateStatement({
      rows: [...bookings.map((r) => row(r, 'lesson')), ...groups.map((r) => row(r, 'group'))],
      receipts,
      centers,
      versions,
      start,
      end,
    }),
  };
}
