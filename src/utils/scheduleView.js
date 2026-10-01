// src/utils/scheduleView.js
// Helpers for schedule calendars. Everything is shown in the VIEWER's timezone
// (the browser's): the server sends real moments (ISO), so a teacher's 3:00 PM in
// Lagos simply shows as 9:00 PM to a viewer in Vietnam.

export const DAY_MS = 86400000;
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_SUN0 = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
export const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
export const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export const localYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const localHHMM = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "3:00 PM" in the viewer's timezone (or `tz`). */
export function fmtTime(date, tz) {
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, ...(tz ? { timeZone: tz } : {}) }).format(new Date(date));
  } catch { return ""; }
}
/** "3:00 – 4:00 PM" (drops the repeated AM/PM). */
export function fmtRange(start, end, tz) {
  const a = fmtTime(start, tz), b = fmtTime(end, tz);
  const [ta, pa] = a.split(" "), [, pb] = b.split(" ");
  return pa === pb ? `${ta} – ${b}` : `${a} – ${b}`;
}
export function fmtDay(date, tz) {
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", ...(tz ? { timeZone: tz } : {}) }).format(new Date(date));
  } catch { return ""; }
}
/** "HH:MM" → "3:00 PM" (wall-clock text, no conversion). */
export function fmtHHMM(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (h === 24) return "12:00 AM (midnight)";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export const viewerTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export function tzName(tz) {
  if (!tz) return "";
  const city = tz.split("/").pop().replace(/_/g, " ");
  let off = "";
  try {
    off = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value || "";
  } catch { /* old browsers */ }
  return off ? `${city} (${off})` : city;
}
function offsetMin(tz, at = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at).map(x => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}
/** "6h behind you" / "1h 30m ahead of you" / "same time as you". */
export function tzDiffText(theirTz, myTz = viewerTz()) {
  try {
    const diff = offsetMin(theirTz) - offsetMin(myTz);
    if (diff === 0) return "same time as you";
    const a = Math.abs(diff), h = Math.floor(a / 60), m = a % 60;
    return `${h ? `${h}h` : ""}${h && m ? " " : ""}${m ? `${m}m` : ""} ${diff > 0 ? "ahead of" : "behind"} you`;
  } catch { return ""; }
}

/** Part of [start,end) that falls on local `day`, as minutes from that day's midnight. */
export function segmentOnDay(start, end, day) {
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = addDays(dayStart, 1);
  const s = Math.max(new Date(start).getTime(), dayStart.getTime());
  const e = Math.min(new Date(end).getTime(), dayEnd.getTime());
  if (e <= s) return null;
  return { startMin: (s - dayStart.getTime()) / 60000, endMin: (e - dayStart.getTime()) / 60000, continuesBefore: new Date(start) < dayStart, continuesAfter: new Date(end) > dayEnd };
}

/**
 * Bookable start times inside free intervals: every `step` minutes on the viewer's
 * clock (e.g. :00 and :30) where a class of `duration` minutes fits.
 */
export function startTimes(free, duration = 60, step = 30, now = Date.now()) {
  const out = [];
  for (const f of free) {
    const fs = new Date(f.start).getTime(), fe = new Date(f.end).getTime();
    const first = new Date(Math.max(fs, now + 5 * 60000));
    // round up to the next `step` on the viewer's clock
    const mins = first.getHours() * 60 + first.getMinutes() + (first.getSeconds() || first.getMilliseconds() ? 1 : 0);
    const up = Math.ceil(mins / step) * step;
    let t = new Date(first); t.setHours(0, 0, 0, 0); t = new Date(t.getTime() + up * 60000);
    for (; t.getTime() + duration * 60000 <= fe; t = new Date(t.getTime() + step * 60000)) out.push(t);
  }
  return out;
}

/** Does [start, start+duration) fit fully inside one free interval? */
export const fitsFree = (free, start, duration) => {
  const s = new Date(start).getTime(), e = s + duration * 60000;
  return free.some(f => new Date(f.start).getTime() <= s && new Date(f.end).getTime() >= e);
};
/** Does [start, start+duration) overlap any block? */
export const overlapsAny = (blocks, start, duration) => {
  const s = new Date(start).getTime(), e = s + duration * 60000;
  return blocks.some(b => new Date(b.start).getTime() < e && new Date(b.end).getTime() > s);
};
