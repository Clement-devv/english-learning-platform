// src/pages/admin/tabs/payroll/payrollShared.jsx
// Components shared by the Payroll panels of the admin Payments tab.

/** Small stat tile in the style of the Payments summary cards */
export function Stat({ icon: Icon, label, value, sub, cat = "cat-accent" }) {
  return (
    <div className={`${cat} relative overflow-hidden rounded-xl border border-ad-line p-4 flex items-center gap-3 shadow-[var(--a-shadow)]`}
      style={{ background: "radial-gradient(120% 100% at 100% 0%, var(--cat-soft) 0%, transparent 60%), var(--a-surface)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: "var(--cat)", boxShadow: "0 6px 14px -6px var(--cat)" }}>
        <Icon className="w-5 h-5" strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ad-muted">{label}</p>
        <p className="text-xl font-bold tabular-nums text-ad-ink mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-ad-muted mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

/** One line of a salary breakdown: label … amount */
export function Line({ label, amount, sym, fmt, minus, strong, muted }) {
  if (!strong && !amount) return null;
  return (
    <div className={`flex items-center justify-between gap-3 py-1 ${strong ? "border-t border-ad-line mt-1 pt-2" : ""}`}>
      <span className={`text-sm ${muted ? "text-ad-muted" : "text-ad-ink-2"} ${strong ? "font-semibold text-ad-ink" : ""}`}>{label}</span>
      <span className={`text-sm tabular-nums ${strong ? "font-bold text-ad-ink" : minus ? "text-rose-600" : "text-ad-ink"}`}>
        {minus && amount ? "−" : ""}{fmt(Math.abs(amount || 0), sym)}
      </span>
    </div>
  );
}

/** The full breakdown of one salary (live row or payslip) */
export function Breakdown({ row, sym, fmt, tr }) {
  return (
    <div>
      <Line label={tr("payroll.classEarnings", "Class earnings ({{n}} classes)", { n: row.classCount || 0 })} amount={row.classEarnings} sym={sym} fmt={fmt} strong={false} />
      <Line label={tr("payroll.bonuses", "Bonuses / adjustments")} amount={row.bonuses} sym={sym} fmt={fmt} />
      <Line label={tr("payroll.manualDeductions", "Deductions")} amount={row.manualDeductions} sym={sym} fmt={fmt} minus />
      {(row.charges || []).map((c) => (
        <Line key={c.name} label={`${c.name}${c.kind === "percent" ? ` (${c.value}%)` : ""}`} amount={c.amount} sym={sym} fmt={fmt} minus />
      ))}
      <Line label={tr("payroll.advancesLine", "Loans / part payments already paid")} amount={row.advancesTotal} sym={sym} fmt={fmt} minus />
      <Line label={tr("payroll.alreadyPaid", "Classes already paid individually")} amount={row.alreadyPaid} sym={sym} fmt={fmt} minus />
      <Line label={tr("payroll.broughtForward", "Balance owed from last salary")} amount={row.broughtForward} sym={sym} fmt={fmt} minus />
      <Line label={tr("payroll.finalSalary", "Final salary")} amount={row.amountPaid} sym={sym} fmt={fmt} strong />
      {row.carryForward > 0 && (
        <p className="text-xs text-rose-600 mt-1">
          {tr("payroll.carryNote", "{{amount}} is still owed and will come off the next salary.", { amount: fmt(row.carryForward, sym) })}
        </p>
      )}
    </div>
  );
}
