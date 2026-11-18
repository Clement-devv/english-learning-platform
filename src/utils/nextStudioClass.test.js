import { describe, it, expect } from 'vitest';
import { nextStudioClass } from './nextStudioClass';
const now = Date.parse('2026-11-18T12:00:00Z');
const lesson = (id, time, status = 'accepted') => ({ _id: id, scheduledTime: time, status, duration: 30 });
describe('next booked class', () => {
  it('chooses the earliest valid booking, excluding the current and settled classes', () => {
    const work = [lesson('current', '2026-11-18T11:30:00Z', 'completed'), lesson('later', '2026-11-18T13:00:00Z'), lesson('next', '2026-11-18T12:00:00Z'), lesson('cancelled', '2026-11-18T11:50:00Z', 'cancelled'), lesson('expired', '2026-11-18T10:00:00Z')];
    expect(nextStudioClass(work, 'current', now)._id).toBe('next');
  });
  it('does not invent a next booking', () => expect(nextStudioClass([], 'current', now)).toBeNull());
});
