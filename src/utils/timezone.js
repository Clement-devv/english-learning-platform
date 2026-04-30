// src/utils/timezone.js
// Shared timezone helpers used across teacher, student, and admin views

/**
 * Curated list of IANA timezone identifiers with human-readable labels.
 * Stored in the DB as `value` (IANA code). Used by profile and admin dropdowns.
 * Ordered by UTC offset then alphabetically within each region.
 */
export const TIMEZONE_OPTIONS = [
  // ── Africa ────────────────────────────────────────────────────────────
  { value: "Africa/Abidjan",      label: "Abidjan, Côte d'Ivoire (GMT, UTC+0)" },
  { value: "Africa/Accra",        label: "Accra, Ghana (GMT, UTC+0)" },
  { value: "Africa/Lagos",        label: "Lagos / Abuja, Nigeria (WAT, UTC+1)" },
  { value: "Africa/Douala",       label: "Douala, Cameroon (WAT, UTC+1)" },
  { value: "Africa/Kinshasa",     label: "Kinshasa, DR Congo (WAT, UTC+1)" },
  { value: "Africa/Luanda",       label: "Luanda, Angola (WAT, UTC+1)" },
  { value: "Africa/Cairo",        label: "Cairo, Egypt (EET, UTC+2)" },
  { value: "Africa/Johannesburg", label: "Johannesburg, South Africa (SAST, UTC+2)" },
  { value: "Africa/Harare",       label: "Harare, Zimbabwe (CAT, UTC+2)" },
  { value: "Africa/Nairobi",      label: "Nairobi, Kenya (EAT, UTC+3)" },
  { value: "Africa/Addis_Ababa",  label: "Addis Ababa, Ethiopia (EAT, UTC+3)" },
  { value: "Africa/Dar_es_Salaam",label: "Dar es Salaam, Tanzania (EAT, UTC+3)" },

  // ── Asia ──────────────────────────────────────────────────────────────
  { value: "Asia/Riyadh",         label: "Riyadh, Saudi Arabia (AST, UTC+3)" },
  { value: "Asia/Kuwait",         label: "Kuwait City (AST, UTC+3)" },
  { value: "Asia/Dubai",          label: "Dubai / Abu Dhabi (GST, UTC+4)" },
  { value: "Asia/Karachi",        label: "Karachi, Pakistan (PKT, UTC+5)" },
  { value: "Asia/Tashkent",       label: "Tashkent, Uzbekistan (UZT, UTC+5)" },
  { value: "Asia/Kolkata",        label: "India (IST, UTC+5:30)" },
  { value: "Asia/Dhaka",          label: "Dhaka, Bangladesh (BST, UTC+6)" },
  { value: "Asia/Rangoon",        label: "Yangon, Myanmar (MMT, UTC+6:30)" },
  { value: "Asia/Bangkok",        label: "Bangkok, Thailand (ICT, UTC+7)" },
  { value: "Asia/Ho_Chi_Minh",    label: "Ho Chi Minh City / Hanoi, Vietnam (ICT, UTC+7)" },
  { value: "Asia/Jakarta",        label: "Jakarta, Indonesia (WIB, UTC+7)" },
  { value: "Asia/Phnom_Penh",     label: "Phnom Penh, Cambodia (ICT, UTC+7)" },
  { value: "Asia/Kuala_Lumpur",   label: "Kuala Lumpur, Malaysia (MYT, UTC+8)" },
  { value: "Asia/Singapore",      label: "Singapore (SGT, UTC+8)" },
  { value: "Asia/Manila",         label: "Manila, Philippines (PHT, UTC+8)" },
  { value: "Asia/Shanghai",       label: "Beijing / Shanghai, China (CST, UTC+8)" },
  { value: "Asia/Taipei",         label: "Taipei, Taiwan (CST, UTC+8)" },
  { value: "Asia/Seoul",          label: "Seoul, South Korea (KST, UTC+9)" },
  { value: "Asia/Tokyo",          label: "Tokyo, Japan (JST, UTC+9)" },

  // ── Europe ────────────────────────────────────────────────────────────
  { value: "Europe/London",       label: "London, UK (GMT/BST)" },
  { value: "Europe/Lisbon",       label: "Lisbon, Portugal (WET/WEST)" },
  { value: "Europe/Paris",        label: "Paris, France (CET/CEST)" },
  { value: "Europe/Berlin",       label: "Berlin, Germany (CET/CEST)" },
  { value: "Europe/Rome",         label: "Rome, Italy (CET/CEST)" },
  { value: "Europe/Madrid",       label: "Madrid, Spain (CET/CEST)" },
  { value: "Europe/Warsaw",       label: "Warsaw, Poland (CET/CEST)" },
  { value: "Europe/Istanbul",     label: "Istanbul, Turkey (TRT, UTC+3)" },
  { value: "Europe/Moscow",       label: "Moscow, Russia (MSK, UTC+3)" },

  // ── Americas ──────────────────────────────────────────────────────────
  { value: "America/New_York",    label: "New York / Miami / Toronto (ET)" },
  { value: "America/Chicago",     label: "Chicago / Dallas / Houston (CT)" },
  { value: "America/Denver",      label: "Denver / Phoenix (MT)" },
  { value: "America/Los_Angeles", label: "Los Angeles / San Francisco / Vancouver (PT)" },
  { value: "America/Anchorage",   label: "Anchorage, Alaska (AKT)" },
  { value: "America/Mexico_City", label: "Mexico City (CST/CDT)" },
  { value: "America/Bogota",      label: "Bogotá, Colombia (COT, UTC-5)" },
  { value: "America/Lima",        label: "Lima, Peru (PET, UTC-5)" },
  { value: "America/Sao_Paulo",   label: "São Paulo, Brazil (BRT, UTC-3)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires, Argentina (ART, UTC-3)" },

  // ── Pacific / Oceania ─────────────────────────────────────────────────
  { value: "Pacific/Honolulu",    label: "Honolulu, Hawaii (HST, UTC-10)" },
  { value: "Australia/Perth",     label: "Perth, Australia (AWST, UTC+8)" },
  { value: "Australia/Darwin",    label: "Darwin, Australia (ACST, UTC+9:30)" },
  { value: "Australia/Sydney",    label: "Sydney / Melbourne, Australia (AEST/AEDT)" },
  { value: "Australia/Brisbane",  label: "Brisbane, Australia (AEST, UTC+10)" },
  { value: "Pacific/Auckland",    label: "Auckland, New Zealand (NZST/NZDT)" },

  // ── UTC ───────────────────────────────────────────────────────────────
  { value: "UTC",                 label: "UTC (Coordinated Universal Time)" },
];

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
