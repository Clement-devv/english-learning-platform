import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  calculateStatement,
  statementRange,
  buildStandaloneStatement,
} from '../services/standaloneStatement.js';
import { renderStandaloneStatementPdf, statementMoney } from '../utils/standaloneStatementPdf.js';
import { dueReportDate, deliverStandaloneDailyReport, deliverWeeklyStudentCounts } from '../utils/standaloneDailyReports.js';
vi.mock('../emails/core.js', () => ({
  sendEmail: vi.fn(() => {
    throw new Error('Real mail disabled in tests');
  }),
}));

const rows = [1, 2, 3].map((n) => ({
  id: String(n),
  centerId: 'center',
  currency: 'USD',
  date: `2026-11-0${n}T12:00:00Z`,
  scheduledTime: `2026-11-0${n}T11:00:00Z`,
  amountMinor: 1001,
  title: `Confident conversations ${n}`,
  student: 'Nguyễn Minh',
  duration: 45,
}));
const versions = [
  {
    effectiveAt: new Date('2026-01-01'),
    rules: [
      { name: 'Platform fee', kind: 'percent', value: 1000 },
      { name: 'Monthly service', kind: 'fixed', currency: 'USD', value: 500 },
    ],
  },
];
const calc = (from, to) =>
  calculateStatement({
    rows,
    receipts: [
      {
        centerId: 'center',
        currency: 'USD',
        amountMinor: 1000,
        receivedAt: '2026-11-02T12:00:00Z',
        note: 'Payment received',
      },
    ],
    centers: [{ _id: 'center', name: 'Bright Futures Academy' }],
    versions,
    ...statementRange(from, to, 'UTC'),
  });
describe('standalone statements', () => {
  it('bundles glyphs needed for Vietnamese names', () => {
    const font = createRequire(import.meta.url)('fontkit').openSync(fileURLToPath(new URL('../assets/fonts/DejaVuSans.ttf', import.meta.url)));
    expect([... 'Nguyễn Trần Đặng'].every(c => font.hasGlyphForCodePoint(c.codePointAt(0)))).toBe(true);
  });
  it('keeps same-currency centers and their distinct charges and receipts separate', () => {
    const report = calculateStatement({
      rows: [...rows, { ...rows[0], id: 'other', centerId: 'other', amountMinor: 5000 }],
      receipts: [
        { centerId: 'other', currency: 'USD', amountMinor: 10000, receivedAt: rows[0].date },
      ],
      centers: [
        { _id: 'center', name: 'Academy A' },
        { _id: 'other', name: 'Academy B' },
      ],
      versions: [
        {
          effectiveAt: new Date('2026-01-01'),
          rules: [
            { name: 'A fee', kind: 'percent', value: 1000, centerIds: ['center'] },
            { name: 'B fee', kind: 'percent', value: 2000, centerIds: ['other'] },
          ],
        },
      ],
      ...statementRange('2026-11-01', '2026-11-30', 'UTC'),
    });
    expect(report.totals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          centerId: 'center',
          gross: 3003,
          charges: 300,
          received: 0,
          outstanding: 2703,
        }),
        expect.objectContaining({
          centerId: 'other',
          gross: 5000,
          charges: 1000,
          received: 10000,
          outstanding: -6000,
        }),
      ])
    );
    expect(report.totals).toHaveLength(2);
  });
  it('formats currency units correctly for Vietnam and the USA', () => {
    expect(statementMoney(200000, 'VND')).toBe('VND 200,000');
    expect(statementMoney(200000, 'USD')).toBe('USD 2,000.00');
  });
  it('reconciles gross, allocated charges, receipts and net without mixing currencies', () => {
    const report = calc('2026-11-01', '2026-11-30');
    expect(report.totals[0]).toMatchObject({
      gross: 3003,
      charges: 800,
      net: 2203,
      received: 1000,
      outstanding: 1203,
      lessons: 3,
    });
    const daily = [1, 2, 3].map((n) => calc(`2026-11-0${n}`, `2026-11-0${n}`).totals[0]);
    expect(daily.reduce((n, t) => n + t.charges, 0)).toBe(800);
    expect(daily.reduce((n, t) => n + t.net, 0)).toBe(2203);
  });
  it('validates ranges and handles Vietnam and US DST days', () => {
    expect(() => statementRange('2026-02-30', '2026-03-01', 'UTC')).toThrow();
    expect(() => statementRange('2026-11-03', '2026-11-01', 'UTC')).toThrow();
    const vn = statementRange('2026-11-10', '2026-11-10', 'Asia/Ho_Chi_Minh');
    expect(vn.start.toISOString()).toBe('2026-11-09T17:00:00.000Z');
    const spring = statementRange('2026-03-08', '2026-03-08', 'America/New_York');
    const autumn = statementRange('2026-11-01', '2026-11-01', 'America/New_York');
    expect((spring.end - spring.start) / 3600000).toBe(23);
    expect((autumn.end - autumn.start) / 3600000).toBe(25);
  });
  it('uses the previous local day and resumes missed dates in sequence', () => {
    const now = new Date('2026-11-10T17:00:30Z');
    expect(dueReportDate(null, 'Asia/Ho_Chi_Minh', now)).toBe('2026-11-10');
    expect(dueReportDate(null, 'America/New_York', now)).toBe('2026-11-09');
    expect(dueReportDate('2026-11-10', 'Asia/Ho_Chi_Minh', now)).toBeNull();
    expect(dueReportDate('2026-11-07', 'Asia/Ho_Chi_Minh', now)).toBe('2026-11-08');
  });
  it('renders a multi-page Unicode PDF with totals', async () => {
    const base = calc('2026-11-01', '2026-11-30');
    const report = {
      ...base,
      entries: Array.from({ length: 48 }, (_, i) => ({
        ...base.entries[i % 3],
        title: `Lesson ${i + 1}: Reading, vocabulary and confident conversations`,
      })),
      teacherName: 'Amara Williams',
      from: '2026-11-01',
      to: '2026-11-30',
      timezone: 'Asia/Ho_Chi_Minh',
      generatedAt: new Date('2026-11-30'),
    };
    // Totals in the layout fixture match the repeated rows.
    report.totals = [
      {
        centerId: 'center',
        centerName: 'Bright Futures Academy',
        currency: 'USD',
        lessons: 48,
        gross: 48048,
        charges: 12800,
        net: 35248,
        received: 1000,
        outstanding: 34248,
      },
    ];
    report.charges = base.charges.map((c) => ({ ...c, amountMinor: c.amountMinor * 16 }));
    report.centers.push({ _id: 'second', name: 'Private lessons' });
    report.entries.push({
      ...base.entries[0],
      id: 'second',
      centerId: 'second',
      amountMinor: 5000,
      chargesMinor: 1000,
      netMinor: 4000,
    });
    report.charges.push({
      centerId: 'second',
      currency: 'USD',
      month: '2026-11',
      name: 'Service fee',
      kind: 'percent',
      value: 2000,
      amountMinor: 1000,
    });
    report.totals.push({
      centerId: 'second',
      centerName: 'Private lessons',
      currency: 'USD',
      lessons: 1,
      gross: 5000,
      charges: 1000,
      net: 4000,
      received: 0,
      outstanding: 4000,
    });
    const pdf = await renderStandaloneStatementPdf(report);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    if (process.env.STATEMENT_PDF_OUTPUT) fs.writeFileSync(process.env.STATEMENT_PDF_OUTPUT, pdf);
  });
  it('queries only the owner, includes group classes and retries failed mail without resending successful dates', async () => {
    const db = global.__TEST_DB__.useDb('standalone-statement', { useCache: true });
    const owner = new mongoose.Types.ObjectId(),
      center = new mongoose.Types.ObjectId();
    await db
      .collection('managedcenters')
      .insertOne({ _id: center, name: 'Test center', currency: 'USD' });
    const linh = new mongoose.Types.ObjectId(), minh = new mongoose.Types.ObjectId();
    await db.collection('students').insertMany([
      { _id: linh, managedCenterId: center, firstName: 'Linh', lastName: 'Đặng' },
      { _id: minh, managedCenterId: center, firstName: 'Minh' },
    ]);
    const common = {
      teacherId: owner,
      managedCenterId: center,
      status: 'completed',
      scheduledTime: new Date('2026-11-10T10:00:00Z'),
      completedAt: new Date('2026-11-10T11:00:00Z'),
      duration: 45,
      standalonePay: { currency: 'USD', amountMinor: 2000 },
    };
    await db.collection('bookings').insertMany([
      { ...common, studentId: linh, classTitle: 'Reading' },
      { ...common, studentId: minh, status: 'missed', classTitle: 'Speaking practice', missedReason: 'No one joined.' },
      { ...common, teacherId: new mongoose.Types.ObjectId(), classTitle: 'Other teacher' },
    ]);
    await db.collection('groupclasses').insertOne({ ...common, title: 'Group vocabulary', enrollments: [{ studentId: linh }, { studentId: minh }] });
    const options = {
      teacherId: owner,
      timezone: 'Asia/Ho_Chi_Minh',
      from: '2026-11-10',
      to: '2026-11-10',
    };
    const report = await buildStandaloneStatement(db, options);
    expect(report.entries).toHaveLength(2);
    expect(report.totals[0].gross).toBe(4000);
    await expect(
      buildStandaloneStatement(db, { ...options, centerId: String(new mongoose.Types.ObjectId()) })
    ).rejects.toThrow('Center not found');
    const teacher = {
        _id: owner,
        firstName: 'Amara',
        email: 'teacher@example.test',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      workspace = {};
    const send = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'Offline' })
      .mockResolvedValue({ success: true });
    const now = new Date('2026-11-10T17:01:00Z');
    const reportCenter = { _id: center, name: 'Test center', notificationEmail: 'center@example.test' };
    await expect(
      deliverStandaloneDailyReport(db, workspace, teacher, reportCenter, now, send)
    ).rejects.toThrow('Offline');
    expect(
      await deliverStandaloneDailyReport(db, workspace, teacher, reportCenter, now, send)
    ).toBe('2026-11-10');
    expect(
      await deliverStandaloneDailyReport(db, workspace, teacher, reportCenter, now, send)
    ).toBe('2026-11-10');
    expect(send).toHaveBeenCalledTimes(2);

    const html = send.mock.calls[1][0].html;
    for (const value of ['data-em-layout', 'Test center', 'Completed (2)', 'Not completed (1)', 'Student: Linh Đặng', 'Enrolled students: Linh Đặng, Minh', 'Student: Minh', 'Speaking practice', 'No one joined.']) {
      expect(html).toContain(value);
    }
    expect(send.mock.calls[1][0].attachments).toBeUndefined();
    expect(send.mock.calls[1][0].text).toContain('Not completed: 1');
    expect(send.mock.calls[1][0].text).toContain('Speaking practice | Individual | 45 min | Student: Minh | No one joined.');
    expect(send.mock.calls[1][0].text).not.toMatch(/salary|earnings|charges|USD|Other teacher/i);
    const second = { _id: new mongoose.Types.ObjectId(), name: 'Second center' };
    await db.collection('managedcenters').insertOne({ ...second, currency: 'USD' });
    await db
      .collection('bookings')
      .insertOne({ ...common, managedCenterId: second._id, classTitle: 'Second center class' });
    expect(await deliverStandaloneDailyReport(db, workspace, teacher, second, now, send)).toBe(
      '2026-11-10'
    );
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[1][0].to).toEqual([teacher.email, reportCenter.notificationEmail]);
    expect(send.mock.calls[2][0].to).toBe(teacher.email);
    expect(send.mock.calls[1][0].centerName).toBe('Test center');
    expect(send.mock.calls[2][0].centerName).toBe('Second center');
    expect(send.mock.calls[1][0].subject).toContain('Test center');
    expect(send.mock.calls[1][0].text).toContain('Completed classes: 2');
    expect(send.mock.calls[2][0].subject).toContain('Second center');
    expect(send.mock.calls[2][0].text).toContain('Completed classes: 1');
    expect(send.mock.calls[2][0].text).not.toMatch(/Reading|Speaking practice|Group vocabulary/);
    expect(await deliverStandaloneDailyReport(db, workspace, teacher, second, now, send)).toBe(
      '2026-11-10'
    );
    expect(send).toHaveBeenCalledTimes(3);
  });
});

it('sends paid class progress to the center at the end of the calendar week, once per week', async () => {
  const db = global.__TEST_DB__.useDb('weekly-progress', { useCache: true });
  const id = () => new mongoose.Types.ObjectId();
  const center = { _id: id(), name: 'E.G.O', notificationEmail: 'office@example.test', weeklyReportStart: new Date('2026-11-08T09:00:00Z') };
  const teacher = { _id: id(), firstName: 'Amara', timezone: 'Asia/Ho_Chi_Minh' };
  const student = id();
  await db.collection('students').insertMany([
    { _id: student, managedCenterId: center._id, standaloneManaged: true, firstName: 'Linh', classCredits: 5 },
    { managedCenterId: id(), standaloneManaged: true, firstName: 'Other center', classCredits: 4 },
  ]);
  await db.collection('bookings').insertMany(Array.from({length:5}, () => ({ status: 'completed', standaloneCompletion: { chargedStudentIds: [student] } })));
  const send = vi.fn().mockResolvedValue({ success: true });
  const report = date => deliverWeeklyStudentCounts(db, {}, teacher, center, new Date(date), send);
  await report('2026-11-08T16:59:59Z');
  expect(send).not.toHaveBeenCalled();
  await report('2026-11-08T17:00:00Z');
  await report('2026-11-08T17:01:00Z');
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toMatchObject({ to: center.notificationEmail, text: expect.stringContaining('Linh: 5/10') });
  expect(send.mock.calls[0][0].text).not.toContain('Other center');
  await db.collection('students').updateOne({ _id: student }, { $inc: { classCredits: 5 } });
  await report('2026-11-15T17:00:00Z');
  expect(send.mock.calls[1][0].text).toContain('Linh: 5/15');
});

it('formats Nigeria daily email times in WAT even when the workspace previously defaulted to UTC', async () => {
  const db = global.__TEST_DB__.useDb('standalone-nigeria-timezone', { useCache: true });
  const owner = new mongoose.Types.ObjectId(), center = new mongoose.Types.ObjectId();
  await db.collection('managedcenters').insertOne({ _id: center, name: 'E.G.O' });
  await db.collection('bookings').insertOne({ teacherId: owner, managedCenterId: center,
    scheduledTime: new Date('2026-11-19T12:00:00Z'), completedAt: new Date('2026-11-19T12:48:00Z'),
    classTitle: 'Nigeria afternoon class', duration: 48, status: 'completed' });
  const send = vi.fn().mockResolvedValue({ success: true });
  await deliverStandaloneDailyReport(db, { timezone: 'UTC' }, { _id: owner, firstName: 'Teacher', email: 'teacher@example.test', timezone: 'Africa/Lagos' },
    { _id: center, name: 'E.G.O' }, new Date('2026-11-19T23:01:00Z'), send);
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][0].text).toContain('13:00 | Nigeria afternoon class');
  expect(send.mock.calls[0][0].text).toContain('Africa/Lagos');
});
