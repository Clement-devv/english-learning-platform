import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Reminder, { ClassReminderSettings } from './StandaloneClassReminder';
import client from './client';
const spies = vi.hoisted(() => ({ play: vi.fn(), stop: vi.fn(), enable: vi.fn(async () => ({ ok: true })), auth: { role: 'teacher', user: { _id: 'teacher' } } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => spies.auth }));
vi.mock('../../utils/teacherMode', () => ({ teacherModeKey: () => 'tw-example' }));
vi.mock('../../utils/pushNotifications', () => ({ enablePush: spies.enable, disablePush: vi.fn(), getPushStatus: vi.fn(async () => false), getDeviceChoice: () => null, restorePushIfAllowed: vi.fn(async () => false) }));
vi.mock('./client', () => ({ default: { get: vi.fn() } }));
vi.mock('../../components/ring/ringtones', () => ({ DEFAULT_RINGTONE_ID: 'classic', CUSTOM_RINGTONE_ID: 'custom', RINGTONES: [{ id: 'classic', label: 'Classic', emoji: '☎️' }, { id: 'chime', label: 'Triple Chime', emoji: '🎵' }, { id: 'urgent-pair', label: 'Urgent Pair', emoji: '🚨' }, { id: 'bright-rise', label: 'Bright Rise', emoji: '✨' }, { id: 'double-knock', label: 'Double Knock', emoji: '🛎️' }], getRingtoneById: () => ({ make: spies.play }), makeCustomRingtone: spies.play }));
vi.mock('../../components/ring/ringStorage', () => ({ loadCustomTone: vi.fn(), getCustomToneName: () => null }));
const lesson = (minutes, status = 'accepted') => ({ _id: 'booking', classTitle: 'Reading', scheduledTime: new Date(Date.now() + minutes * 60000).toISOString(), status, studentId: { firstName: 'Minh' } });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-22T11:00:00Z')); localStorage.clear(); vi.clearAllMocks(); spies.play.mockReturnValue({ stop: spies.stop }); spies.auth.role = 'teacher'; });
afterEach(() => vi.useRealTimers());
const mount = (path = '/teacher-mode/dashboard') => render(<MemoryRouter initialEntries={[path]}><Reminder /></MemoryRouter>);
it('rings at five minutes, stops after 30 seconds and does not ring again after remount', async () => {
  const work = [lesson(10)]; client.get.mockResolvedValue({ data: { data: work } });
  const view = mount(); await act(async () => {});
  expect(spies.play).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60000); });
  expect(spies.play).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert')).toHaveTextContent('Reading');
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(spies.stop).toHaveBeenCalled();
  view.unmount(); mount(); await act(async () => {});
  expect(spies.play).toHaveBeenCalledTimes(1);
});
it('checks cancellation on the server before ringing', async () => {
  const work = [lesson(10)];
  client.get.mockResolvedValueOnce({ data: { data: work } }).mockResolvedValue({ data: { data: [{ ...work[0], status: 'cancelled' }] } });
  mount(); await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60000); });
  expect(spies.play).not.toHaveBeenCalled();
});
it('opens the safe dashboard view when a classroom is active and silences dismissal', async () => {
  client.get.mockResolvedValue({ data: { data: [lesson(5)] } });
  const open = vi.fn(); window.addEventListener('studio-open-dashboard', open);
  try {
    mount('/classroom'); await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'View classes' }));
    expect(open).toHaveBeenCalledTimes(1); expect(spies.stop).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  } finally { window.removeEventListener('studio-open-dashboard', open); }
});
it('does not fetch standalone bookings for other roles', async () => {
  spies.auth.role = 'student'; mount(); await act(async () => {});
  expect(client.get).not.toHaveBeenCalled();
});

it('registers background push when the teacher enables reminders', async () => {
  render(<ClassReminderSettings />); await act(async () => {});
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enable background reminders' })); });
  expect(spies.enable).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status')).toHaveTextContent('Background reminders enabled on this device');
  expect(screen.getByRole('button', { name: 'Turn off background notifications' })).toBeEnabled();
});
