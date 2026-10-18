// src/pages/admin/tabs/payroll/ChargesPanel.jsx
// What the general charges (e.g. 10% of every teacher's class earnings) have
// collected: all time, per charge, per pay period — plus this period so far.
import { useState, useEffect, useCallback } from "react";
import { Percent, PiggyBank, CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../../../api";
import { useOnDataChanged } from "../../../../hooks/useLiveData";
import { useCurrencySymbol, fmtMoney } from "../../../../hooks/useCurrencySymbol";
import { card, th, td, periodLabel, errMsg } from "./payrollUtils";
import { Stat } from "./payrollShared";

export default function ChargesPanel({ onOpenSettings }) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
  const [data, setData] = useState(null);
  const [running, setRunning] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([api.get("/payroll/admin/charges"), api.get("/payroll/admin/periods")]);
      setData(c.data.data); setRunning(p.data.data); setError("");
    } catch (err) { setError(errMsg(err, tr("payroll.loadFailed", "Couldn't load payroll"))); }
  }, [tr]);
  useEffect(() => { load(); }, [load]);
  useOnDataChanged(["payments"], load);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!data || !running) return <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ad-accent" /></div>;

  const projected = running.totals.chargesTotal;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat icon={PiggyBank} cat="cat-green" label={tr("payroll.collectedAllTime", "Collected all time")} value={fmtMoney(data.allTime, sym)}
          sub={tr("payroll.fromPaidSalaries", "From salaries already paid")} />
        <Stat icon={CalendarClock} cat="cat-amber" label={tr("payroll.thisPeriodSoFar", "{{period}} so far", { period: periodLabel(running.period) })}
          value={fmtMoney(projected, sym)} sub={tr("payroll.paidAndUnpaid", "Paid + not yet paid salaries")} />
        <Stat icon={Percent} cat="cat-accent" label={tr("payroll.activeCharges", "Charges in use")}
          value={(running.period.charges || []).map((c) => (c.kind === "percent" ? `${c.value}%` : fmtMoney(c.value, sym))).join(" + ") || "—"}
          sub={(running.period.charges || []).map((c) => c.name).join(", ") || tr("payroll.noCharges", "No charges set")} />
      </div>

      {(running.period.charges || []).length === 0 && (
        <div className={`${card} p-4 text-sm text-ad-ink-2 flex flex-wrap items-center gap-3 justify-between`}>
          <span>{tr("payroll.noChargesHelp", "No general charges are set. Add one (e.g. 10% of class earnings) in Payroll settings.")}</span>
          <button onClick={onOpenSettings} className="text-sm font-semibold text-ad-accent-ink underline">{tr("payroll.openSettings", "Open payroll settings")}</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${card} overflow-hidden`}>
          <h3 className="font-bold text-ad-ink p-4 border-b border-ad-line">{tr("payroll.byCharge", "By charge")}</h3>
          <table className="min-w-full">
            <tbody>
              {data.byRule.length === 0 && <tr><td className={`${td} text-ad-muted`}>{tr("payroll.nothingCollected", "Nothing collected yet")}</td></tr>}
              {data.byRule.map((r) => (
                <tr key={r.name}><td className={td}>{r.name}</td><td className={`${td} text-right tabular-nums font-semibold`}>{fmtMoney(r.amount, sym)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`${card} overflow-hidden lg:col-span-2`}>
          <h3 className="font-bold text-ad-ink p-4 border-b border-ad-line">{tr("payroll.byPeriod", "By pay period")}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className={th}>{tr("payroll.payPeriod", "Pay period")}</th>
                  <th className={th}>{tr("payroll.colTeachersPaid", "Teachers paid")}</th>
                  <th className={th}>{tr("payroll.classEarningsTotal", "Class earnings")}</th>
                  <th className={th}>{tr("payroll.chargesCollected", "Charges collected")}</th>
                </tr>
              </thead>
              <tbody>
                {data.byPeriod.length === 0 && <tr><td colSpan={4} className={`${td} text-ad-muted text-center py-8`}>{tr("payroll.nothingCollected", "Nothing collected yet")}</td></tr>}
                {data.byPeriod.map((p) => (
                  <tr key={p.periodKey}>
                    <td className={td}>{periodLabel(p)}</td>
                    <td className={`${td} tabular-nums`}>{p.teachers}</td>
                    <td className={`${td} tabular-nums`}>{fmtMoney(p.classEarnings, sym)}</td>
                    <td className={`${td} tabular-nums font-semibold`}>{fmtMoney(p.chargesTotal, sym)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="text-xs text-ad-muted">
        {tr("payroll.retentionNote", "Payslip details are kept for {{n}} months after payment; the all-time total keeps counting after that.", { n: data.retentionMonths })}
      </p>
    </div>
  );
}
