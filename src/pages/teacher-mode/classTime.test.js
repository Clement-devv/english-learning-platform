import { describe, expect, it } from 'vitest';
import process from 'node:process';
import { classTimeToUtc } from './classTime';

describe('standalone class time zones', () => {
  it('stores a Lagos class as one instant and displays it in Vietnam, including the next day', () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = 'Africa/Lagos';
      const instant = classTimeToUtc('2026-11-10T20:30');
      expect(instant).toBe('2026-11-10T19:30:00.000Z');
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).map(p => [p.type, p.value]));
      expect(parts).toMatchObject({ year: '2026', month: '11', day: '11', hour: '02', minute: '30' });
    } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
  });
});
