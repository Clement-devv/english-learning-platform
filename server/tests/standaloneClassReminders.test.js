import { it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import { deliverStandaloneClassReminders } from '../utils/standaloneClassReminders.js';
vi.mock('../utils/webPushService.js', () => ({ PUSH_CONFIGURED: false, sendPush: vi.fn(() => { throw new Error('Real push disabled'); }) }));
async function fixture() {
  const db = global.__TEST_DB__.useDb('reminders-' + new mongoose.Types.ObjectId(), { useCache: true });
  const ownerId = new mongoose.Types.ObjectId(), active = new mongoose.Types.ObjectId(), inactive = new mongoose.Types.ObjectId();
  const subscription = endpoint => ({ endpoint, keys: { auth: 'test', p256dh: 'test' } });
  await db.collection('teachers').insertOne({ _id: ownerId, email: 'teacher@example.test', active: true,
    sessions: [{ _id: active, isActive: true, pushSubscription: subscription('https://fcm.googleapis.com/active') },
      { _id: inactive, isActive: false, pushSubscription: subscription('https://fcm.googleapis.com/inactive') }] });
  const bookingId = new mongoose.Types.ObjectId(), now = new Date();
  await db.collection('bookings').insertOne({ _id: bookingId, teacherId: ownerId, classTitle: 'Reading', status: 'accepted', scheduledTime: new Date(+now + 290000) });
  return { db, workspace: { key: 'tw-test', ownerId }, now, bookingId, active };
}
it('pushes five minutes before class once per active device, even with concurrent workers', async () => {
  const f = await fixture(), send = vi.fn().mockResolvedValue(undefined);
  await Promise.all([deliverStandaloneClassReminders(f.db, f.workspace, f.now, send), deliverStandaloneClassReminders(f.db, f.workspace, f.now, send)]);
  await deliverStandaloneClassReminders(f.db, f.workspace, f.now, send);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0].endpoint).toBe('https://fcm.googleapis.com/active');
  expect(send.mock.calls[0][1]).toMatchObject({ data: { kind: 'standalone-class-reminder', teacherId: String(f.workspace.ownerId), bookingId: String(f.bookingId), url: '/teacher-mode/dashboard?tab=classes' } });
  expect(send.mock.calls[0][2]).toMatchObject({ urgency: 'high', throwOnError: true });
  expect(send.mock.calls[0][2].TTL).toBeLessThanOrEqual(290);
});
it('skips cancelled, distant and other-teacher bookings', async () => {
  const f = await fixture(), send = vi.fn();
  await f.db.collection('bookings').updateOne({ _id: f.bookingId }, { $set: { status: 'cancelled' } });
  await f.db.collection('bookings').insertMany([
    { teacherId: f.workspace.ownerId, status: 'accepted', scheduledTime: new Date(+f.now + 600000) },
    { teacherId: new mongoose.Types.ObjectId(), status: 'accepted', scheduledTime: new Date(+f.now + 200000) },
  ]);
  await deliverStandaloneClassReminders(f.db, f.workspace, f.now, send);
  expect(send).not.toHaveBeenCalled();
});
it('retries failed push delivery and supports group classes', async () => {
  const f = await fixture();
  await f.db.collection('bookings').deleteMany({});
  await f.db.collection('groupclasses').insertOne({ teacherId: f.workspace.ownerId, title: 'Group reading', status: 'full', scheduledTime: new Date(+f.now + 250000) });
  const send = vi.fn().mockRejectedValueOnce(new Error('temporary outage')).mockResolvedValue(undefined);
  await deliverStandaloneClassReminders(f.db, f.workspace, f.now, send);
  await deliverStandaloneClassReminders(f.db, f.workspace, f.now, send);
  await deliverStandaloneClassReminders(f.db, f.workspace, f.now, send);
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1][1].body).toContain('Group reading');
});
it('removes expired subscriptions', async () => {
  const f = await fixture(), send = vi.fn().mockRejectedValue(Object.assign(new Error('gone'), { stale: true }));
  await deliverStandaloneClassReminders(f.db, f.workspace, f.now, send);
  await deliverStandaloneClassReminders(f.db, f.workspace, f.now, send);
  expect(send).toHaveBeenCalledTimes(1);
  const teacher = await f.db.collection('teachers').findOne({ _id: f.workspace.ownerId });
  expect(teacher.sessions.find(session => String(session._id) === String(f.active)).pushSubscription).toBeNull();
});
