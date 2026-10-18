// src/pages/admin/tabs/payroll/payrollUtils.js
// Helpers + class names shared by the Payroll panels of the admin Payments tab.
import { dateLocale } from "../../../../i18n/dateLocale.js";

export { fmtYmd, periodLabel } from "../../../../utils/payPeriod.js";

export const PAYOUT_METHODS = ["bank_transfer", "cash", "paypal", "check", "other"];

export function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString(dateLocale("en-US"), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-ad-line bg-ad-surface text-ad-ink placeholder:text-ad-muted focus:outline-none focus:ring-2 focus:ring-[var(--a-accent-line)]";
export const btnPrimary = "px-4 py-2 rounded-lg text-sm font-semibold bg-ad-accent text-ad-on-accent hover:bg-ad-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
export const btnGhost = "px-4 py-2 rounded-lg text-sm font-semibold border border-ad-line text-ad-ink-2 hover:bg-ad-raised transition-colors disabled:opacity-50";
export const card = "rounded-xl border border-ad-line bg-ad-surface shadow-[var(--a-shadow)]";
export const th = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ad-muted bg-ad-raised whitespace-nowrap";
export const td = "px-4 py-3 text-sm text-ad-ink border-t border-ad-line";

export const kindLabel = (kind, tr) => ({
  loan: tr("payroll.kindLoan", "Loan"),
  part_payment: tr("payroll.kindPart", "Part payment"),
  salary: tr("payroll.kindSalary", "Salary"),
}[kind] || kind);

export const methodLabel = (m, tr) => ({
  bank_transfer: tr("paymentTab.bankTransfer"), paypal: tr("paymentTab.paypal"), cash: tr("paymentTab.cash"),
  check: tr("paymentTab.check"), other: tr("paymentTab.other"),
}[m] || m);

/** Teacher.continent shown in the admin's language */
export const regionName = (r, tr) => tr(`payroll.region${r}`, r);

/** "Asia, Europe" / "3 teachers" / "" (all teachers) — who a charge is taken from */
export const scopeLabel = (c, tr) => (c.appliesTo === "regions" ? (c.regions || []).map((r) => regionName(r, tr)).join(", ")
  : c.appliesTo === "teachers" ? tr("payroll.nTeachers", "{{n}} teachers", { n: (c.teacherIds || []).length }) : "");

export const teacherLabel = (t) => `${t.firstName || ""} ${t.lastName || ""}`.trim();

export const errMsg = (err, fallback) => err?.response?.data?.message || fallback;
