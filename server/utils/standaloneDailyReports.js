import { withStandaloneFooter } from '../emails/standaloneFooter.js';
import { usedClassCounts } from './standaloneClassCounts.js';
import { studentSchema } from '../schemas/studentSchema.js';
import { details, esc, p, renderEmail } from '../emails/layout.js';
import { standaloneMailRecipients } from './standaloneMailRecipients.js';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import TeacherWorkspace from '../models/master/TeacherWorkspace.js';
import { teacherSchema } from '../schemas/teacherSchema.js';
import { teacherModeModels } from '../schemas/teacherModeSchemas.js';
import { getDb } from '../config/dbManager.js';
import { bookingSchema } from '../schemas/bookingSchema.js';
import { groupClassSchema } from '../schemas/groupClassSchema.js';
import { localDateStr, localDayRange, safeTimeZone, yesterdayInZone } from './dailyClassReport.js';
import { sendEmail } from '../emails/core.js';
import logger from './logger.js';

const deliverySchema = new mongoose.Schema({
  date: { type: String, required: true },
  centerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  leaseUntil: Date,
  leaseOwner: String,
  sentAt: Date,
});
deliverySchema.index({ centerId: 1, date: 1 }, { unique: true });
const nextDate = (date) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
export const dueReportDate = (lastDate, timezone, now = new Date()) => {
  const yesterday = yesterdayInZone(safeTimeZone(timezone), now);
  const candidate = lastDate ? nextDate(lastDate) : yesterday;
  return candidate <= yesterday ? candidate : null;
};

// Persistent lease prevents concurrent workers from sending the same date.
// Failed sends retry; a process crash after provider acceptance can still duplicate a message.
export async function deliverStandaloneDailyReport(
  db,
  workspace,
  teacher,
  center,
  now = new Date(),
  deliver = sendEmail
) {
  const timezone = safeTimeZone(teacher.timezone || workspace.timezone);
  if (!center?._id) throw new Error('A center is required for daily reports');
  const date = dueReportDate(center.dailyReportLastDate, timezone, now);
  if (!date) return null;
  return deliverOnce(db, center, date, now, async () => {
    const name = [teacher.firstName, teacher.lastName].filter(Boolean).join(' ');
    const { start, end } = localDayRange(date, timezone);
    const scope = { teacherId: teacher._id, managedCenterId: center._id, scheduledTime: { $gte: start, $lt: end } };
    const ended = { $lte: [{ $add: ['$scheduledTime', { $multiply: [{ $ifNull: ['$duration', 60] }, 60000] }] }, now] };
    const Booking = db.models.Booking || db.model('Booking', bookingSchema);
    const Group = db.models.GroupClass || db.model('GroupClass', groupClassSchema);
    const Student = db.models.Student || db.model('Student', studentSchema);
    const roster = { model: Student, match: { managedCenterId: center._id }, select: 'firstName lastName' };
    const [bookings, groups] = await Promise.all([
      Booking.find({ ...scope, $or: [{ status: { $in: ['completed','missed'] } }, { status: 'accepted', $expr: ended }] })
        .select('classTitle scheduledTime duration status missedReason adminRejected adminRejectedReason studentId').populate({ ...roster, path: 'studentId' }).lean(),
      Group.find({ ...scope, $or: [{ status: { $in: ['completed','missed'] } }, { status: { $in: ['open','full'] }, $expr: ended }] })
        .select('title scheduledTime duration status missedReason enrollments.studentId').populate({ ...roster, path: 'enrollments.studentId' }).lean(),
    ]);
    const rows = [...bookings.map(r => ({ ...r, title: r.classTitle, kind: 'Individual' })), ...groups.map(r => ({ ...r, kind: 'Group' }))]
      .sort((a,b) => a.scheduledTime - b.scheduledTime || String(a._id).localeCompare(String(b._id)));
    const completed = rows.filter(r => r.status === 'completed' && !r.adminRejected);
    const incomplete = rows.filter(r => r.status !== 'completed' || r.adminRejected);
    const clock = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' });
    const studentLine = lesson => {
      const group = lesson.kind === 'Group';
      const students = group ? (lesson.enrollments || []).map(e => e.studentId) : [lesson.studentId];
      const names = students.map(s => [s?.firstName, s?.lastName].filter(Boolean).join(' ') || 'Name unavailable');
      return (group ? 'Enrolled students: ' : 'Student: ') + (names.join(', ') || 'None listed');
    };
    const line = r => [clock.format(r.scheduledTime), r.title, r.kind, (r.duration || 60) + ' min', studentLine(r)].join(' | ');
    const text = [
      'Teacher: ' + name, '', center.name + ' | ' + date + ' (' + timezone + ')',
      'Completed classes: ' + completed.length, 'Not completed: ' + incomplete.length, '',
      'Completed', ...(completed.length ? completed.map(line) : ['None']), '',
      'Not completed', ...(incomplete.length ? incomplete.map(r => line(r) + ' | ' + (r.adminRejectedReason || r.missedReason || 'Not marked as taught.')) : ['None']),
    ].join('\n');
    const section = (label, lessons, showReason) => {
      const heading = p(`<strong>${label} (${lessons.length})</strong>`, { mb: 4 });
      if (!lessons.length) return heading + p('None', { size: 14 });
      return heading + details(lessons.map(lesson => {
        const reason = showReason ? lesson.adminRejectedReason || lesson.missedReason || 'Not marked as taught.' : '';
        const description = [
          esc(lesson.title),
          esc(studentLine(lesson)),
          `<small>${lesson.kind} · ${esc(lesson.duration || 60)} min</small>`,
          reason && `Reason: ${esc(reason)}`,
        ].filter(Boolean).join('<br>');
        return [clock.format(lesson.scheduledTime), description];
      }));
    };
    const html = renderEmail({
      centerName: center.name, eyebrow: 'Daily class report', title: 'Class history for ' + date,
      preheader: completed.length + ' completed · ' + incomplete.length + ' not completed',
      body: details([['Teacher', esc(name)], ['Time zone', esc(timezone)]])
        + section('Completed', completed, false) + section('Not completed', incomplete, true),
    });
    return deliver({ centerName: center.name, to: standaloneMailRecipients(teacher.email, center.notificationEmail), subject: String(center.name).replace(/[\r\n]/g,' ') + ' - daily class history - ' + date, html, text });
  });
}

async function deliverOnce(db, center, date, now, send) {
  const Delivery =
    db.models.StandaloneCenterDailyDelivery ||
    db.model('StandaloneCenterDailyDelivery', deliverySchema);
  await Delivery.init();
  const key = { date, centerId: center._id };
  if (await Delivery.exists({ ...key, sentAt: { $exists: true } })) return date;
  const leaseOwner = crypto.randomUUID();
  let claim;
  try {
    claim = await Delivery.findOneAndUpdate(
      {
        ...key,
        sentAt: { $exists: false },
        $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }],
      },
      { $set: { leaseOwner, leaseUntil: new Date(+now + 15 * 60000) } },
      { upsert: true, new: true }
    );
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
  if (!claim) return null;
  try {
    const response = await withStandaloneFooter(send);
    if (!response?.success || response.skipped)
      throw new Error(response?.error || 'Daily report was not delivered');
    await Delivery.updateOne(
      { ...key, leaseOwner },
      { $set: { sentAt: new Date() }, $unset: { leaseUntil: 1, leaseOwner: 1 } }
    );
    return date;
  } catch (error) {
    await Delivery.updateOne({ ...key, leaseOwner }, { $unset: { leaseUntil: 1, leaseOwner: 1 } });
    throw error;
  }
}

export async function deliverWeeklyStudentCounts(db, workspace, teacher, center, now = new Date(), deliver = sendEmail) {
  if (!center.notificationEmail) return;
  const zone = safeTimeZone(teacher.timezone || workspace.timezone);
  const localDate = instant => localDateStr(instant, zone);
  const today = localDate(now);
  // Use the local calendar date so Monday midnight follows daylight saving changes.
  const monday = new Date(today + 'T00:00:00Z');
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const due = monday.toISOString().slice(0, 10);
  const enabledAt = center.weeklyReportStart || center.createdAt;
  if (enabledAt && localDate(enabledAt) >= due) return;
  if (center.weeklyReportLastDate >= due) return;
  const sent = await deliverOnce(db, center, 'weekly:' + due, now, async () => {
    const Student = db.models.Student || db.model('Student', studentSchema);
    const students = await Student.find({ managedCenterId: center._id, standaloneManaged: true })
      .select('firstName lastName classCredits').sort({ firstName: 1, lastName: 1, _id: 1 }).lean();
    const counts = await usedClassCounts(db, students.map(s => s._id));
    const rows = students.map(s => {
      const used = counts.get(String(s._id)) || 0;
      return [[s.firstName, s.lastName].filter(Boolean).join(' '), used + '/' + (used + (s.classCredits || 0))];
    });
    const teacherName = [teacher.firstName, teacher.lastName].filter(Boolean).join(' ');
    return deliver({ to: center.notificationEmail, centerName: center.name,
      subject: 'Weekly student class counts · ' + today,
      text: [teacherName, today, 'Paid classes used / total', ...rows.map(r => r.join(': '))].join('\n'),
      html: renderEmail({ centerName: center.name, eyebrow: 'Weekly student progress', title: 'Paid class counts',
        preheader: teacherName + ' · Paid classes used and total purchased for ' + rows.length + (rows.length === 1 ? ' student.' : ' students.'),
        body: p(esc(teacherName) + ' · ' + today) + p('Paid classes used / total') +
          (rows.length ? details(rows) : p('No registered students.')) }),
    });
  });
  return sent ? due : null;
}

let timer = null,
  running = false,
  stopped = true;
export async function tickStandaloneDailyReports(now = new Date()) {
  if (running) return;
  running = true;
  try {
    for await (const workspace of TeacherWorkspace.find({
      status: 'active',
      ownerId: { $exists: true },
    }).cursor()) {
      if (stopped) break;
      try {
        const db = await getDb(workspace.key);
        const Teacher = db.models.Teacher || db.model('Teacher', teacherSchema);
        const teacher = await Teacher.findOne({ _id: workspace.ownerId, active: true })
          .select('firstName lastName email timezone')
          .lean();
        if (!teacher?.email) continue;
        const { ManagedCenter } = teacherModeModels(db);
        for await (const center of ManagedCenter.find({ archived: { $ne: true } }).cursor()) {
          if (stopped) break;
          try {
            const weekly = await deliverWeeklyStudentCounts(db, workspace, teacher, center, now);
            if (weekly) await ManagedCenter.updateOne({ _id: center._id }, { $set: { weeklyReportLastDate: weekly } });
          } catch (error) {
            logger.error('Center weekly student report failed', { center: String(center._id), error: error.message });
          }
          try {
            const date = await deliverStandaloneDailyReport(db, workspace, teacher, center, now);
            if (date)
              await ManagedCenter.updateOne(
                { _id: center._id },
                { $set: { dailyReportLastDate: date } }
              );
          } catch (error) {
            logger.error('Center daily report failed', {
              workspace: workspace.key,
              center: String(center._id),
              error: error.message,
            });
          }
        }
      } catch (error) {
        logger.error('Standalone daily report failed', {
          workspace: workspace.key,
          error: error.message,
        });
      }
    }
  } finally {
    running = false;
  }
}
export function startStandaloneDailyReports() {
  if (timer) return;
  stopped = false;
  const tick = () =>
    tickStandaloneDailyReports().catch((error) =>
      logger.error('Standalone report scheduler failed', { error: error.message })
    );
  timer = setInterval(tick, 60000);
  tick();
}
export function stopStandaloneDailyReports() {
  stopped = true;
  clearInterval(timer);
  timer = null;
}
