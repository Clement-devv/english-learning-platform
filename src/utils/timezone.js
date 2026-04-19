// src/utils/timezone.js
// Shared timezone helpers used across teacher and student views

/**
 * Returns the browser's IANA timezone string, e.g. `"Africa/Lagos"`.
 * @returns {string}
 */
export function getUserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a Date (or ISO string) in a specific IANA timezone.
 * @param {Date|string} date - The date/time to format.
 * @param {string} tz - IANA timezone identifier (e.g. `"America/New_York"`).
 * @returns {string} Formatted time string, e.g. `"3:00 PM"`.
 */
export function formatInTZ(date, tz) {
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: tz || getUserTimezone(),
    }).format(new Date(date));
  } catch {
    return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
}

/**
 * Format full date+time in a specific timezone.
 * @param {Date|string} date - The date/time to format.
 * @param {string} tz - IANA timezone identifier.
 * @returns {string} Formatted string, e.g. `"Mon, Mar 16 · 3:00 PM"`.
 */
export function formatDateInTZ(date, tz) {
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
      timeZone: tz || getUserTimezone(),
    }).format(new Date(date));
  } catch {
    return new Date(date).toLocaleString();
  }
}

/**
 * Get short timezone abbreviation, e.g. `"WAT"`, `"ICT"`, `"GMT+1"`.
 * @param {string} tz - IANA timezone identifier.
 * @returns {string} Abbreviation, or the original `tz` string on failure.
 */
export function tzAbbr(tz) {
  if (!tz) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find(p => p.type === "timeZoneName")?.value || tz;
  } catch {
    return tz;
  }
}

/**
 * Get a human-readable city/region label from an IANA timezone.
 * e.g. `"Africa/Lagos"` → `"Lagos"`, `"Asia/Ho_Chi_Minh"` → `"Ho Chi Minh"`.
 * @param {string} tz - IANA timezone identifier.
 * @returns {string} City/region name with underscores replaced by spaces.
 */
export function tzCity(tz) {
  if (!tz) return "";
  const city = tz.split("/").pop().replace(/_/g, " ");
  return city;
}

/**
 * Build a dual-time display string for bookings.
 * Returns an object: { myTime, theirTime, myAbbr, theirAbbr, theirCity }
 *
 * @param {Date|string} utcDate - The UTC booking time.
 * @param {string} myTZ - Viewer's IANA timezone.
 * @param {string} theirTZ - The other party's IANA timezone.
 * @returns {{ myTime: string, theirTime: string, myAbbr: string, theirAbbr: string, theirCity: string, sameZone: boolean }|null}
 */
export function dualTime(utcDate, myTZ, theirTZ) {
  if (!utcDate) return null;
  const myTZSafe    = myTZ    || getUserTimezone();
  const theirTZSafe = theirTZ || myTZSafe;
  const sameZone    = myTZSafe === theirTZSafe;
  return {
    myTime:    formatInTZ(utcDate, myTZSafe),
    theirTime: formatInTZ(utcDate, theirTZSafe),
    myAbbr:    tzAbbr(myTZSafe),
    theirAbbr: tzAbbr(theirTZSafe),
    theirCity: tzCity(theirTZSafe),
    sameZone,
  };
}
