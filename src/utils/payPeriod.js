// src/utils/payPeriod.js
// Labels for payroll pay periods (server/utils/payroll.js). Days are "YYYY-MM-DD"
// calendar days in the center's time zone — shown as-is, never shifted.
import { dateLocale } from "../i18n/dateLocale.js";

/** "2026-10-31" → "31 Oct 2026" (calendar day, no time-zone shift) */
export function fmtYmd(ymd, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(dateLocale("en-US"), { ...opts, timeZone: "UTC" });
}

/** "October 2026" for calendar months, "26 Sep – 25 Oct 2026" otherwise */
export function periodLabel(p) {
  if (!p) return "";
  const calendar = p.startYmd?.endsWith("-01") && p.startYmd.slice(0, 7) === p.endYmd?.slice(0, 7);
  if (calendar) return fmtYmd(p.endYmd, { month: "long", year: "numeric" });
  return `${fmtYmd(p.startYmd, { day: "numeric", month: "short" })} – ${fmtYmd(p.endYmd)}`;
}
