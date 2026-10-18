// src/pages/teacher/components/payment/SalaryStatement.jsx
// The teacher's monthly salary (GET /payroll/me): this period's class earnings,
// the center's charges, loans / part payments already received, the final total —
// plus past payslips and every payment the center has made to them.
import { useState, useEffect, useCallback } from "react";
import { Wallet, CalendarClock, ChevronDown, ChevronUp, HandCoins, CheckCircle, Info } from "lucide-react";
import api from "../../../../api";
import { useOnDataChanged } from "../../../../hooks/useLiveData";
import { useCurrencySymbol, fmtMoney } from "../../../../hooks/useCurrencySymbol";
import { fmtYmd, periodLabel } from "../../../../utils/payPeriod";

const KIND = { salary: "Salary", part_payment: "Part payment", loan: "Loan" };
const METHOD = { bank_transfer: "Bank transfer", paypal: "PayPal", cash: "Cash", check: "Cheque", other: "Other" };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

function Breakdown({ row, isDarkMode, sym }) {
  const sub = isDarkMode ? "text-gray-400" : "text-gray-600";
  const line = (label, amount, minus, key) => (amount ? (
    <div key={key || label} className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className={sub}>{label}</span>
      <span className={`tabular-nums font-medium ${minus ? "text-rose-500" : isDarkMode ? "text-gray-100" : "text-gray-900"}`}>
        {minus ? "−" : ""}{fmtMoney(Math.abs(amount), sym)}
      </span>
    </div>
  ) : null);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 py-1 text-sm">
        <span className={sub}>Class earnings ({row.classCount || 0} classes)</span>
        <span className={`tabular-nums font-semibold ${isDarkMode ? "text-gray-100" : "text-gray-900"}`}>{fmtMoney(row.classEarnings || 0, sym)}</span>
      </div>
      {line("Bonuses / adjustments", row.bonuses)}
      {line("Deductions", row.manualDeductions, true)}
      {(row.charges || []).map((c) => line(`${c.name}${c.kind === "percent" ? ` (${c.value}%)` : ""}`, c.amount, true, `c-${c.name}`))}
      {line("Loans / part payments received", row.advancesTotal, true)}
      {line("Classes already paid individually", row.alreadyPaid, true)}
      {line("Balance owed from last salary", row.broughtForward, true)}
      <div className={`flex items-center justify-between gap-3 pt-2 mt-1 border-t ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
        <span className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>Final salary</span>
        <span className={`text-lg font-bold tabular-nums ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`}>{fmtMoney(row.amountPaid || 0, sym)}</span>
      </div>
      {row.carryForward > 0 && (
        <p className="text-xs text-rose-500 mt-1">{fmtMoney(row.carryForward, sym)} is still owed to the center and will come off your next salary.</p>
      )}
    </div>
  );
}

function PeriodCard({ c, isDarkMode, sym }) {
  const due = !c.period.open;
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-emerald-900/50 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}>
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              {due ? "Salary awaiting payment" : "This period's salary so far"} — {periodLabel(c.period)}
            </p>
            <p className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              {fmtYmd(c.period.startYmd)} – {fmtYmd(c.period.endYmd)}
            </p>
          </div>
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
          due ? (isDarkMode ? "bg-amber-900/40 text-amber-300" : "bg-amber-50 text-amber-700")
              : (isDarkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600")}`}>
          <CalendarClock className="w-3 h-3" /> Salary day {fmtYmd(c.period.payYmd, { day: "numeric", month: "short" })}
        </span>
      </div>
      <Breakdown row={c} isDarkMode={isDarkMode} sym={sym} />
      {(c.advances || []).length > 0 && (
        <div className={`mt-3 rounded-lg p-3 text-xs space-y-1 ${isDarkMode ? "bg-gray-900/60 text-gray-300" : "bg-gray-50 text-gray-600"}`}>
          {c.advances.map((a) => (
            <div key={a._id} className="flex justify-between gap-2">
              <span>{KIND[a.kind]} · {fmtDate(a.paidAt)}{a.notes ? ` · ${a.notes}` : ""}</span>
              <span className="tabular-nums">{fmtMoney(a.amount, sym)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PayslipRow({ p, isDarkMode, sym }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-t ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
      <button onClick={() => setOpen((v) => !v)} className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left ${isDarkMode ? "hover:bg-gray-700/40" : "hover:bg-gray-50"}`}>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>{periodLabel(p)}</p>
          <p className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Paid {fmtDate(p.paidAt)} · {METHOD[p.paymentMethod] || p.paymentMethod}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`}>{fmtMoney(p.amountPaid, sym)}</span>
          {open ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
        </div>
      </button>
      {open && <div className="px-4 pb-4"><Breakdown row={p} isDarkMode={isDarkMode} sym={sym} /></div>}
    </div>
  );
}

export default function SalaryStatement({ isDarkMode }) {
  const sym = useCurrencySymbol();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    api.get("/payroll/me").then((r) => { setData(r.data.data); setFailed(false); }).catch(() => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load]);
  useOnDataChanged(["payments"], load);

  if (failed && !data) return null; // the earnings list below still works
  if (!data) return <div className={`rounded-2xl h-40 animate-pulse ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />;

  const cardCls = `rounded-2xl border overflow-hidden shadow-sm ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`;
  const head = `text-sm font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`;
  const charges = data.settings.charges || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {data.current.map((c) => <PeriodCard key={c.period.key} c={c} isDarkMode={isDarkMode} sym={sym} />)}
      </div>

      {charges.length > 0 && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl text-xs ${isDarkMode ? "bg-blue-900/20 border border-blue-800/40 text-blue-300" : "bg-blue-50 border border-blue-100 text-blue-700"}`}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Center charges: <strong>{charges.map((c) => `${c.name} ${c.kind === "percent" ? `${c.value}%` : fmtMoney(c.value, sym)}`).join(", ")}</strong>.
            {" "}Percentages are worked out on your total class earnings for the period — including any part you received early.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className={cardCls}>
          <div className="flex items-center gap-2 px-4 py-3">
            <CheckCircle className={`w-4 h-4 ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`} />
            <p className={head}>Payslips</p>
          </div>
          {data.payslips.length === 0
            ? <p className={`px-4 pb-4 text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>No salary paid yet.</p>
            : data.payslips.map((p) => <PayslipRow key={p._id} p={p} isDarkMode={isDarkMode} sym={sym} />)}
        </div>

        <div className={cardCls}>
          <div className="flex items-center gap-2 px-4 py-3">
            <HandCoins className={`w-4 h-4 ${isDarkMode ? "text-amber-300" : "text-amber-600"}`} />
            <p className={head}>Payments received</p>
          </div>
          {data.payouts.length === 0
            ? <p className={`px-4 pb-4 text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>No payments yet.</p>
            : (
              <div className="max-h-96 overflow-y-auto">
                {data.payouts.map((p) => (
                  <div key={p._id} className={`flex items-center justify-between gap-3 px-4 py-2.5 border-t text-sm ${isDarkMode ? "border-gray-700" : "border-gray-100"} ${p.voided ? "opacity-50" : ""}`}>
                    <div className="min-w-0">
                      <p className={`font-medium ${isDarkMode ? "text-gray-100" : "text-gray-800"}`}>
                        {KIND[p.kind]}{p.kind === "salary" && p.periodKey ? ` · period to ${fmtYmd(p.periodKey)}` : ""}
                        {p.voided && <span className="ml-1 text-xs text-rose-500">(cancelled)</span>}
                      </p>
                      <p className={`text-xs truncate ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                        {fmtDate(p.paidAt)} · {METHOD[p.paymentMethod] || p.paymentMethod}{p.notes ? ` · ${p.notes}` : ""}
                        {p.kind !== "salary" && !p.voided && (p.payslipId ? " · taken off salary" : " · comes off next salary")}
                      </p>
                    </div>
                    <span className={`tabular-nums font-semibold flex-shrink-0 ${p.voided ? "line-through" : ""} ${isDarkMode ? "text-gray-100" : "text-gray-900"}`}>{fmtMoney(p.amount, sym)}</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
      <p className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
        Payslips and payments are kept for {data.settings.retentionMonths} months.
      </p>
    </div>
  );
}
