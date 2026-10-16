// server/emails/i18n.js
// Language helpers for emails sent to students (and parents of managed students).
// Teachers, admins and sub-admins get English.
//
// A student's language is `student.emailLanguage` ("en" default, "vi"), set by the
// student in Settings. Make sure the field is loaded where the student comes from —
// populate("studentId", "… email emailLanguage timezone").
//
// To add a language: add it to LANGS, the student schema enum, and a block in every
// email's text table (search for `vi:` in server/emails/).
import { config } from "../config/config.js";
import { getCenterBaseUrl } from "./core.js";

export const LANGS = ["en", "vi"];
const LOCALE = { en: "en-US", vi: "vi-VN" };

/** "en" | "vi" for a user doc (anything unknown → English) */
export const langOf = (user) => (LANGS.includes(user?.emailLanguage) ? user.emailLanguage : "en");

/** Valid IANA zone or undefined (bad/empty values would make toLocale* throw) */
const zone = (tz) => {
  if (!tz) return undefined;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return undefined; }
};

/** "Tuesday, October 20, 2026" / "Thứ Ba, 20 tháng 10, 2026" — in the user's timezone when known */
export const fmtDate = (date, lang = "en", tz) => new Date(date).toLocaleDateString(LOCALE[lang] || "en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: zone(tz),
});

/** "4:30 PM" / "16:30" plus the zone name when known, e.g. "4:30 PM GMT+7" */
export const fmtTime = (date, lang = "en", tz) => new Date(date).toLocaleTimeString(LOCALE[lang] || "en-US", {
  hour: "numeric", minute: "2-digit", timeZone: zone(tz), ...(zone(tz) && { timeZoneName: "short" }),
});

/** Short date, no weekday: "Oct 22, 2026" / "22 thg 10, 2026" */
export const fmtShortDate = (date, lang = "en", tz) => new Date(date).toLocaleDateString(LOCALE[lang] || "en-US", {
  year: "numeric", month: "short", day: "numeric", timeZone: zone(tz),
});

/**
 * Everything the layout needs about the center. `center` may be the center doc or just
 * its slug (the reminder scheduler passes the slug).
 */
export const brandOf = (center, centerName = "") => {
  const { baseUrl } = getCenterBaseUrl(center);
  const doc = center && typeof center === "object" ? center : null;
  return {
    center: doc,
    centerName: centerName || doc?.centerName || config.appName,
    baseUrl,
  };
};

/** Pick the right language block from { en: {...}, vi: {...} } */
export const pick = (table, lang) => table[lang] || table.en;
