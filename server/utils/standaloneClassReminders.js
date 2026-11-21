import mongoose from 'mongoose';
import crypto from 'node:crypto';
import TeacherWorkspace from '../models/master/TeacherWorkspace.js';
import { getDb } from '../config/dbManager.js';
import { bookingSchema } from '../schemas/bookingSchema.js';
import { groupClassSchema } from '../schemas/groupClassSchema.js';
import { teacherSchema } from '../schemas/teacherSchema.js';
import { sendPush, PUSH_CONFIGURED } from './webPushService.js';
import { sendEmail } from '../emails/core.js';
import { renderEmail, p, details, esc } from '../emails/layout.js';
import { fmtDate, fmtTime, brandOf } from '../emails/i18n.js';
import logger from './logger.js';

const deliverySchema = new mongoose.Schema({
  bookingId: mongoose.Schema.Types.ObjectId, scheduledTime: Date, sessionId: mongoose.Schema.Types.ObjectId,
  leaseUntil: Date, leaseOwner: String, sentAt: Date, expiresAt: Date,
});
deliverySchema.index({ bookingId: 1, scheduledTime: 1, sessionId: 1 }, { unique: true });
deliverySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const model = (db, name, schema) => db.models[name] || db.model(name, schema);

// Exported separately so tests can use an isolated database and a fake sender.
export async function deliverStandaloneClassReminders(db, workspace, now = new Date(), deliver = sendPush) {
  const Teacher = model(db, 'Teacher', teacherSchema);
  const teacher = await Teacher.findOne({ _id: workspace.ownerId, active: true,
    sessions: { $elemMatch: { isActive: true, 'pushSubscription.endpoint': { $exists: true } } } })
    .select('sessions').lean();
  if (!teacher) return;
  const Booking = model(db, 'Booking', bookingSchema), Group = model(db, 'GroupClass', groupClassSchema);
  const scope = { teacherId: workspace.ownerId, scheduledTime: { $gt: now, $lte: new Date(+now + 300000) } };
  const [individual, groups] = await Promise.all([
    Booking.find({ ...scope, status: 'accepted' }).select('classTitle scheduledTime status').lean(),
    Group.find({ ...scope, status: { $in: ['open', 'full'] } }).select('title scheduledTime status').lean(),
  ]);
  if (!individual.length && !groups.length) return;
  const Delivery = model(db, 'StandaloneClassReminderDelivery', deliverySchema);
  await Delivery.init();
  const endpoints = new Set();
  const sessions = teacher.sessions.filter(session => {
    const endpoint = session.isActive && session.pushSubscription?.endpoint;
    if (!endpoint || endpoints.has(endpoint)) return false;
    endpoints.add(endpoint); return true;
  });
  for (const [Lesson, lessons] of [[Booking, individual], [Group, groups]]) for (const lesson of lessons) {
    for (const session of sessions) {
      const key = { bookingId: lesson._id, scheduledTime: lesson.scheduledTime, sessionId: session._id };
      const leaseOwner = crypto.randomUUID();
      let claim;
      try {
        claim = await Delivery.findOneAndUpdate({ ...key, sentAt: { $exists: false },
          $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }] },
          { $set: { leaseOwner, leaseUntil: new Date(+now + 60000), expiresAt: new Date(+lesson.scheduledTime + 7 * 86400000) } },
          { new: true, upsert: true });
      } catch (error) { if (error.code === 11000) continue; throw error; }
      if (!claim) continue;
      try {
        // Recheck changes and sign-out immediately before sending a queued reminder.
        const valid = await Lesson.exists({ _id: lesson._id, teacherId: workspace.ownerId, scheduledTime: lesson.scheduledTime, status: { $in: ['accepted','open','full'] } });
        const signedIn = await Teacher.exists({ _id: workspace.ownerId, active: true, sessions: { $elemMatch: { _id: session._id, isActive: true, 'pushSubscription.endpoint': session.pushSubscription.endpoint } } });
        const remaining = Math.floor((+lesson.scheduledTime - Date.now()) / 1000);
        if (!valid || !signedIn || remaining <= 0) continue;
        await deliver(session.pushSubscription, {
          title: 'Your class starts soon', body: (lesson.classTitle || lesson.title || 'Booked class') + ' starts in about 5 minutes.',
          icon: '/ego-studio/icon-192.png', badge: '/ego-studio/icon-64.png',
          tag: 'studio-class-' + lesson._id + ':' + (+lesson.scheduledTime), renotify: false,
          data: { kind: 'standalone-class-reminder', workspaceKey: workspace.key, teacherId: String(workspace.ownerId), bookingId: String(lesson._id), scheduledTime: lesson.scheduledTime.toISOString(), url: '/teacher-mode/dashboard?tab=classes' },
        }, { TTL: Math.min(300, remaining), urgency: 'high', timeout: 10000, throwOnError: true });
        await Delivery.updateOne({ ...key, leaseOwner }, { $set: { sentAt: new Date() } });
      } catch (error) {
        if (error.stale) await Teacher.updateOne({ _id: workspace.ownerId }, { $set: { 'sessions.$[s].pushSubscription': null } }, { arrayFilters: [{ 's._id': session._id }] });
        else logger.warn('Standalone class push failed; will retry before class starts', { workspace: workspace.key, bookingId: String(lesson._id), error: error.message });
      } finally {
        await Delivery.updateOne({ ...key, leaseOwner }, { $unset: { leaseOwner: '', leaseUntil: '' } });
      }
    }
  }
}

// Email reminders run for accepted 1:1 lessons and scheduled group classes. A
// separate durable ledger prevents duplicate email across concurrent app workers.
export async function deliverStandaloneClassEmailReminders(db, workspace, now = new Date(), deliver = sendEmail) {
  const Teacher = model(db, 'Teacher', teacherSchema);
  const teacher = await Teacher.findOne({ _id: workspace.ownerId, active: true, email: { $exists: true, $ne: '' } })
    .select('email firstName timezone').lean();
  if (!teacher?.email) return;
  const Booking = model(db, 'Booking', bookingSchema), Group = model(db, 'GroupClass', groupClassSchema);
  const scope = { teacherId: workspace.ownerId, scheduledTime: { $gt: now, $lte: new Date(+now + 600000) } };
  const [individual, groups] = await Promise.all([
    Booking.find({ ...scope, status: 'accepted' }).select('classTitle scheduledTime duration status').lean(),
    Group.find({ ...scope, status: { $in: ['open', 'full'] } }).select('title scheduledTime duration status').lean(),
  ]);
  if (!individual.length && !groups.length) return;
  const Delivery = model(db, 'StandaloneClassEmailReminderDelivery', deliverySchema);
  await Delivery.init();
  const center = { kind: 'teacher-workspace', centerName: workspace.centerName || workspace.name || 'E.G.O', slug: workspace.key };
  const brand = brandOf(center, center.centerName);
  for (const [Lesson, lessons] of [[Booking, individual], [Group, groups]]) for (const lesson of lessons) {
    const key = { bookingId: lesson._id, scheduledTime: lesson.scheduledTime, sessionId: workspace.ownerId };
    const leaseOwner = crypto.randomUUID();
    try {
      const claim = await Delivery.findOneAndUpdate({ ...key, sentAt: { $exists: false },
        $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }] },
        { $set: { leaseOwner, leaseUntil: new Date(+now + 60000), expiresAt: new Date(+lesson.scheduledTime + 7 * 86400000) } },
        { new: true, upsert: true });
      if (!claim) continue;
      const valid = await Lesson.exists({ _id: lesson._id, teacherId: workspace.ownerId, scheduledTime: lesson.scheduledTime, status: { $in: ['accepted','open','full'] } });
      if (!valid || +lesson.scheduledTime - Date.now() <= 0) continue;
      const tz = teacher.timezone || 'Africa/Lagos';
      const title = lesson.classTitle || lesson.title || 'Booked class';
      await deliver({
        centerName: brand.centerName,
        to: teacher.email,
        subject: `${brand.centerName} class reminder: ${title}`,
        html: renderEmail({ ...brand, preheader: `${title} · ${fmtTime(lesson.scheduledTime, 'en', tz)}`,
          eyebrow: 'Upcoming class reminder', title: 'Your class starts in 10 minutes',
          body: p(`Hi ${esc(teacher.firstName || 'Teacher')}, this is a reminder about your upcoming class.`) + details([
            ['Class', esc(title)], ['Date', fmtDate(lesson.scheduledTime, 'en', tz)],
            ['Time', fmtTime(lesson.scheduledTime, 'en', tz)], ['Duration', `${lesson.duration || 60} minutes`],
          ]), cta: { label: 'Open teacher dashboard', href: `${brand.baseUrl}/teacher-mode/dashboard?tab=classes` },
        }),
      });
      await Delivery.updateOne({ ...key, leaseOwner }, { $set: { sentAt: new Date() } });
    } catch (error) {
      if (error.code !== 11000) logger.warn('Standalone class email reminder failed; will retry before class starts', { workspace: workspace.key, bookingId: String(lesson._id), error: error.message });
    } finally {
      await Delivery.updateOne({ ...key, leaseOwner }, { $unset: { leaseOwner: '', leaseUntil: '' } });
    }
  }
}
let timer, running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    for await (const workspace of TeacherWorkspace.find({ status: 'active', ownerId: { $exists: true } }).select('key ownerId').cursor()) {
      if (!timer) break;
      try {
        const db = await getDb(workspace.key);
        if (PUSH_CONFIGURED) await deliverStandaloneClassReminders(db, workspace);
        await deliverStandaloneClassEmailReminders(db, workspace);
      }
      catch (error) { logger.warn('Standalone class reminder scan failed', { workspace: workspace.key, error: error.message }); }
    }
  } finally { running = false; }
}
export function startStandaloneClassReminders() {
  if (timer) return;
  const run = () => tick().catch(error => logger.error('Standalone reminder scheduler failed', { error: error.message }));
  timer = setInterval(run, 30000); run();
}
export function stopStandaloneClassReminders() { clearInterval(timer); timer = null; }
