// server/utils/schedule.js
// Teacher free time, worked out as real moments (UTC) so every viewer can see it
// in their own timezone.
//
//   free = weekly working hours (teacher's timezone)
//          − time off / reserved blocks (TeacherAvailability docs)
//          − pending / accepted classes
//
// Working hours and time-off blocks are stored as wall-clock "HH:MM" in the
// teacher's timezone; they are converted here, day by day, so daylight-saving
// changes and days that cross midnight for the viewer come out right.

export const BUSY_STATUSES = ["pending", "accepted", "in-progress", "scheduled"];
const DAY_MS = 86400000;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export const isHHMM = (s) => typeof s === "string" && HHMM.test(s);
export const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

export function isValidTz(tz) {
  if (!tz || typeof tz !== "string") return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

function parts(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
  }).formatToParts(date).map(x => [x.type, x.value]));
  return p;
}
function offsetMs(date, tz) {
  const p = parts(date, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "YYYY-MM-DD" of `date` as seen in `tz`. */
export function ymdInTz(date, tz) {
  const p = parts(date, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Wall-clock "YYYY-MM-DD" + "HH:MM" in `tz` → the real moment (Date). "24:00" = next midnight. */
export function zonedToUtc(ymd, hhmm, tz) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wall - offsetMs(new Date(wall), tz);
  guess = wall - offsetMs(new Date(guess), tz); // second pass settles DST edges
  return new Date(guess);
}

/** Every calendar day (in `tz`) touching [from, to], with its weekday 0=Sun. */
export function daysInTz(from, to, tz) {
  const out = [];
  const seen = new Set();
  for (let t = from.getTime() - DAY_MS; t <= to.getTime() + DAY_MS; t += DAY_MS / 2) {
    const ymd = ymdInTz(new Date(t), tz);
    if (seen.has(ymd)) continue;
    seen.add(ymd);
    const [y, m, d] = ymd.split("-").map(Number);
    out.push({ ymd, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() });
  }
  return out;
}

// ── Interval maths (ms numbers) ──────────────────────────────────────────────
export function merge(list) {
  const s = list.filter(i => i.end > i.start).sort((a, b) => a.start - b.start);
  const out = [];
  for (const i of s) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ start: i.start, end: i.end });
  }
  return out;
}
export function subtract(base, cuts) {
  let res = merge(base);
  for (const c of merge(cuts)) {
    const next = [];
    for (const r of res) {
      if (c.end <= r.start || c.start >= r.end) { next.push(r); continue; }
      if (c.start > r.start) next.push({ start: r.start, end: c.start });
      if (c.end < r.end) next.push({ start: c.end, end: r.end });
    }
    res = next;
  }
  return res;
}
const clip = (list, from, to) => list
  .map(i => ({ ...i, start: Math.max(i.start, from), end: Math.min(i.end, to) }))
  .filter(i => i.end > i.start);

/** Validate + normalise working hours: [{ day 0-6, start "HH:MM", end "HH:MM" }] */
export function normaliseWorkingHours(input) {
  if (!Array.isArray(input)) return { error: "workingHours must be a list" };
  if (input.length > 35) return { error: "Too many time ranges" };
  const out = [];
  for (const r of input) {
    const day = Number(r?.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) return { error: "Invalid day" };
    if (!isHHMM(r.start) || !isHHMM(r.end) || r.start === "24:00") return { error: "Times must be HH:MM" };
    if (toMin(r.end) <= toMin(r.start)) return { error: "Each range must end after it starts" };
    out.push({ day, start: r.start, end: r.end });
  }
  for (let d = 0; d <= 6; d++) {
    const ranges = out.filter(r => r.day === d).sort((a, b) => toMin(a.start) - toMin(b.start));
    if (ranges.length > 5) return { error: "At most 5 ranges per day" };
    for (let i = 1; i < ranges.length; i++) {
      if (toMin(ranges[i].start) < toMin(ranges[i - 1].end)) return { error: "Time ranges on the same day overlap" };
    }
  }
  return { value: out.sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start)) };
}

/** Working-hours intervals for [from, to] (ms). */
export function workingIntervals(workingHours, tz, from, to) {
  const list = [];
  for (const { ymd, dow } of daysInTz(from, to, tz)) {
    for (const r of workingHours || []) {
      if (r.day !== dow) continue;
      list.push({ start: zonedToUtc(ymd, r.start, tz).getTime(), end: zonedToUtc(ymd, r.end, tz).getTime() });
    }
  }
  return clip(merge(list), from.getTime(), to.getTime());
}

/** Time-off / reserved blocks (TeacherAvailability docs) as intervals for [from, to]. */
export function blockIntervals(blocks, fallbackTz, from, to) {
  const out = [];
  for (const b of blocks || []) {
    const tz = isValidTz(b.timezone) ? b.timezone : fallbackTz;
    if (!isHHMM(b.startTime) || !isHHMM(b.endTime)) continue;
    const days = b.isRecurring
      ? daysInTz(from, to, tz).filter(d => d.dow === b.dayOfWeek).map(d => d.ymd)
      : (b.date ? [ymdInTz(new Date(b.date), tz)] : []);
    for (const ymd of days) {
      const start = zonedToUtc(ymd, b.startTime, tz).getTime();
      const end = zonedToUtc(ymd, b.endTime, tz).getTime();
      if (end > from.getTime() && start < to.getTime()) out.push({ start, end, block: b });
    }
  }
  return out;
}

export const bookingInterval = (bk) => {
  const start = new Date(bk.scheduledTime).getTime();
  return { start, end: start + (bk.duration || 60) * 60000, booking: bk };
};

/**
 * Free time for one teacher in [from, to] (ms intervals), never in the past.
 * `teacher` needs { workingHours, timezone }.
 */
export function freeIntervals({ teacher, tz, blocks, bookings, from, to, now = Date.now() }) {
  const work = workingIntervals(teacher.workingHours, tz, from, to);
  const cuts = [
    ...blockIntervals(blocks, tz, from, to),
    ...(bookings || []).filter(b => BUSY_STATUSES.includes(b.status)).map(bookingInterval),
    { start: -Infinity, end: now },
  ];
  return subtract(work, cuts);
}

/** Timezone of the teacher's working hours: saved with the hours → profile → a block's → UTC. */
export function teacherTz(teacher, blocks = []) {
  if (isValidTz(teacher?.workingHoursTz)) return teacher.workingHoursTz;
  if (isValidTz(teacher?.timezone)) return teacher.timezone;
  const withTz = blocks.find(b => isValidTz(b.timezone));
  return withTz ? withTz.timezone : "UTC";
}
