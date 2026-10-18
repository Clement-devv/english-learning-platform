// src/pages/admin/tabs/payroll/PayrollRunPanel.jsx
// Salary run for one pay period: every teacher's class earnings, general charges,
// loans / part payments already handed over and the final salary — and "Pay salary".
import { useState, useEffect, useCallback, Fragment } from "react";
import { CalendarClock, Wallet, Percent, HandCoins, CheckCircle, ChevronDown, ChevronRight, X, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../../../api";
import { useOnDataChanged } from "../../../../hooks/useLiveData";
import { useCurrencySymbol, fmtMoney } from "../../../../hooks/useCurrencySymbol";
import Pagination from "../../../../components/Pagination";
import { PAYOUT_METHODS, fmtYmd, periodLabel, todayYmd, inputCls, btnPrimary, btnGhost, card, th, td, methodLabel, errMsg, kindLabel, fmtDateTime } from "./payrollUtils";
import { Stat, Breakdown } from "./payrollShared";

function PayModal({ row, period, onClose, onPaid }) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
  const [method, setMethod] = useState("bank_transfer");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const early = period.open && todayYmd() < period.payYmd;

  const pay = async () => {
    setBusy(true); setError("");
    try {
      await api.post(`/payroll/admin/periods/${period.key}/settle`, { teacherId: row.teacherId, paymentMethod: method, notes, early });
      onPaid(tr("payroll.paidToast", "Salary paid to {{name}}", { name: row.teacherName }));
    } catch (err) {
      setError(errMsg(err, tr("payroll.payFailed", "Couldn't pay this salary")));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className={`${card} w-full max-w-md p-5 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-ad-ink">{tr("payroll.paySalaryTitle", "Pay salary — {{name}}", { name: row.teacherName })}</h3>
            <p className="text-sm text-ad-muted">{periodLabel(period)}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-ad-muted hover:bg-ad-raised" aria-label={tr("paymentTab.cancel")}><X className="w-5 h-5" /></button>
        </div>

        <div className="rounded-lg bg-ad-raised p-3 mb-4">
          <Breakdown row={row} sym={sym} fmt={fmtMoney} tr={tr} />
        </div>

        {(row.accountNumber || row.bankName) && (
          <div className="rounded-lg border border-ad-line p-3 mb-4 text-sm">
            <p className="text-xs font-semibold text-ad-muted mb-1">{tr("payroll.payTo", "Pay to")}</p>
            <p className="text-ad-ink">{row.accountName || row.teacherName}</p>
            <p className="text-ad-ink-2">{row.bankName} · <span className="font-mono">{row.accountNumber}</span></p>
          </div>
        )}

        {early && (
          <p className="text-xs rounded-lg px-3 py-2 mb-3 bg-amber-50 text-amber-800 border border-amber-200">
            {tr("payroll.earlyWarning", "Salary day is {{date}}. Paying now closes this period for {{name}} — classes completed later go into the next salary.", { date: fmtYmd(period.payYmd), name: row.teacherName })}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="block text-xs font-semibold text-ad-muted mb-1">{tr("paymentTab.paymentMethod")}</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
              {PAYOUT_METHODS.map((m) => <option key={m} value={m}>{methodLabel(m, tr)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-ad-muted mb-1">{tr("paymentTab.notes")}</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className={inputCls}
              placeholder={tr("paymentTab.eGTransactionIdReference")} />
          </label>
        </div>

        {error && <p className="text-sm text-rose-600 mb-3" role="alert">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className={`${btnGhost} flex-1`}>{tr("paymentTab.cancel")}</button>
          <button onClick={pay} disabled={busy} className={`${btnPrimary} flex-1`}>
            {busy ? tr("payroll.paying", "Paying…") : row.amountPaid > 0
              ? tr("payroll.payAmount", "Pay {{amount}}", { amount: fmtMoney(row.amountPaid, sym) })
              : tr("payroll.closeSalary", "Close salary (nothing to pay)")}
          </button>
        </div>
      </div>
    </div>
  );
}

function RowDetail({ row }) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
  const slip = row.payslip;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-ad-raised">
      <div className={`${card} p-3`}>
        <Breakdown row={row} sym={sym} fmt={fmtMoney} tr={tr} />
      </div>
      <div className={`${card} p-3`}>
        {slip ? (
          <div className="text-sm space-y-1">
            <p className="font-semibold text-ad-ink">{tr("payroll.paidOn", "Paid {{date}}", { date: fmtDateTime(slip.paidAt) })}</p>
            <p className="text-ad-ink-2">{methodLabel(slip.paymentMethod, tr)}{slip.notes ? ` · ${slip.notes}` : ""}</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold text-ad-muted mb-2">{tr("payroll.advancesThisPeriod", "Loans / part payments this period")}</p>
            {(row.advances || []).length === 0 ? (
              <p className="text-sm text-ad-muted">{tr("payroll.noAdvances", "None")}</p>
            ) : row.advances.map((a) => (
              <div key={a._id} className="flex justify-between gap-2 text-sm py-1">
                <span className="text-ad-ink-2">{kindLabel(a.kind, tr)} · {fmtDateTime(a.paidAt)}{a.notes ? ` · ${a.notes}` : ""}</span>
                <span className="tabular-nums text-ad-ink">{fmtMoney(a.amount, sym)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const PAGE_SIZE = 25;

export default function PayrollRunPanel({ onToast, isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
  const [key, setKey] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);
  const [paying, setPaying] = useState(null);
  // Paged on the server — totals above the table still cover every teacher
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); setOpen(null); }, [key, status, q]);

  const load = useCallback(async () => {
    try {
      const res = await api.get(key ? `/payroll/admin/periods/${key}` : "/payroll/admin/periods", {
        params: { page, limit: PAGE_SIZE, status: status || undefined, q: q || undefined },
      });
      setData(res.data.data); setError("");
    } catch (err) {
      setError(errMsg(err, tr("payroll.loadFailed", "Couldn't load payroll")));
    } finally { setLoading(false); }
  }, [key, page, status, q, tr]);
  useEffect(() => { load(); }, [load]);
  useOnDataChanged(["payments"], load);

  if (loading) return <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ad-accent" /></div>;
  if (error && !data) return <p className="text-sm text-rose-600">{error}</p>;

  const { period, periods, rows, totals, counts, pagination } = data;
  const filters = [
    ["", tr("payroll.filterAll", "All"), counts.all],
    ["unpaid", tr("payroll.filterUnpaid", "To pay"), counts.unpaid],
    ["owes", tr("payroll.filterOwes", "Owes the center"), counts.owes],
    ["paid", tr("payroll.statusPaid", "Paid"), counts.paid],
    ["nothing", tr("payroll.filterNothing", "No activity"), counts.nothing],
  ];
  const today = todayYmd();
  const dueNow = !period.open || today >= period.payYmd;

  return (
    <div className="space-y-4">
      {paying && (
        <PayModal row={paying} period={period} onClose={() => setPaying(null)}
          onPaid={(msg) => { setPaying(null); onToast?.(msg); load(); }} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h3 className="text-xl font-bold text-ad-ink">{tr("payroll.salaryFor", "Salary — {{period}}", { period: periodLabel(period) })}</h3>
          <p className="text-sm text-ad-muted">
            {fmtYmd(period.startYmd)} → {fmtYmd(period.endYmd)} · {tr("payroll.salaryDay", "Salary day")}: <strong className="text-ad-ink">{fmtYmd(period.payYmd)}</strong>
          </p>
        </div>
        <label className="block sm:w-64">
          <span className="block text-xs font-semibold text-ad-muted mb-1">{tr("payroll.payPeriod", "Pay period")}</span>
          <select value={period.key} onChange={(e) => { setKey(e.target.value); setOpen(null); }} className={inputCls}>
            {periods.map((p) => (
              <option key={p.key} value={p.key}>{periodLabel(p)}{p.open ? ` — ${tr("payroll.running", "running")}` : ""}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={`rounded-xl px-4 py-3 text-sm border ${dueNow && totals.teachersUnpaid > 0
        ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-ad-accent-soft border-ad-accent-line text-ad-accent-ink"}`}>
        {dueNow
          ? totals.teachersUnpaid > 0
            ? tr("payroll.dueBanner", "Salary is due — {{n}} teacher(s) still to pay, {{amount}} in total.", { n: totals.teachersUnpaid, amount: fmtMoney(totals.toPay, sym) })
            : tr("payroll.allPaidBanner", "Every salary for this period has been paid.")
          : tr("payroll.runningBanner", "This period is still running. Figures update as classes are completed; charges are locked in when the period ends. Salary day: {{date}}.", { date: fmtYmd(period.payYmd) })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={CalendarClock} cat="cat-teal" label={tr("payroll.classEarningsTotal", "Class earnings")} value={fmtMoney(totals.classEarnings, sym)} sub={tr("payroll.nClasses", "{{n}} classes", { n: totals.classCount })} />
        <Stat icon={Percent} cat="cat-accent" label={tr("payroll.chargesCollected", "Charges collected")} value={fmtMoney(totals.chargesTotal, sym)}
          sub={(totals.chargeTotals || []).map((c) => c.name).join(", ") || tr("payroll.noCharges", "No charges set")} />
        <Stat icon={HandCoins} cat="cat-amber" label={tr("payroll.advancesTotal", "Loans / part payments")} value={fmtMoney(totals.advancesTotal, sym)} />
        <Stat icon={Wallet} cat="cat-green" label={tr("payroll.toPay", "Still to pay")} value={fmtMoney(totals.toPay, sym)}
          sub={tr("payroll.paidSoFar", "{{amount}} paid", { amount: fmtMoney(totals.paid, sym) })} />
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col lg:flex-row gap-2 lg:items-center justify-between p-3 border-b border-ad-line">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label={tr("payroll.filterLabel", "Show")}>
            {filters.map(([k, label, n]) => (
              <button key={k || "all"} role="tab" aria-selected={status === k} onClick={() => setStatus(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${status === k
                  ? "bg-ad-accent-soft border-ad-accent-line text-ad-accent-ink" : "border-transparent text-ad-ink-2 hover:bg-ad-raised"}`}>
                {label} <span className="opacity-60 tabular-nums">{n}</span>
              </button>
            ))}
          </div>
          <div className="relative lg:w-72">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-ad-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputCls} !pl-8`}
              placeholder={tr("payroll.searchTeachersEmail", "Search name, ID or email…")} aria-label={tr("payroll.searchTeachersEmail", "Search name, ID or email…")} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className={th} />
                <th className={th}>{tr("paymentTab.teacher")}</th>
                <th className={th}>{tr("payroll.colClasses", "Classes")}</th>
                <th className={th}>{tr("payroll.colEarned", "Earned")}</th>
                <th className={th}>{tr("payroll.colCharges", "Charges")}</th>
                <th className={th}>{tr("payroll.colAdvances", "Loans / part")}</th>
                <th className={th}>{tr("payroll.colFinal", "Final salary")}</th>
                <th className={th}>{tr("paymentTab.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className={`${td} text-center text-ad-muted py-10`}>{q || status ? tr("payroll.noTeacherMatch", "No teachers match") : tr("paymentTab.noTeachersFound")}</td></tr>
              )}
              {rows.map((r) => {
                const id = String(r.teacherId);
                const expanded = open === id;
                return (
                  <Fragment key={id}>
                    <tr className="hover:bg-ad-raised cursor-pointer" onClick={() => setOpen(expanded ? null : id)}>
                      <td className={`${td} w-8`}>{expanded ? <ChevronDown className="w-4 h-4 text-ad-muted" /> : <ChevronRight className="w-4 h-4 text-ad-muted" />}</td>
                      <td className={td}>
                        <p className="font-semibold">{r.teacherName}</p>
                        <p className="text-xs text-ad-muted">{r.teacherCode || r.email}</p>
                      </td>
                      <td className={`${td} tabular-nums`}>{r.classCount || 0}</td>
                      <td className={`${td} tabular-nums`}>{fmtMoney(r.classEarnings || 0, sym)}</td>
                      <td className={`${td} tabular-nums text-rose-600`}>{r.chargesTotal ? `−${fmtMoney(r.chargesTotal, sym)}` : "—"}</td>
                      <td className={`${td} tabular-nums text-rose-600`}>{r.advancesTotal ? `−${fmtMoney(r.advancesTotal, sym)}` : "—"}</td>
                      <td className={`${td} tabular-nums font-bold`}>
                        {fmtMoney(r.amountPaid || 0, sym)}
                        {r.carryForward > 0 && <span className="block text-xs font-normal text-rose-600">{tr("payroll.owes", "owes {{amount}}", { amount: fmtMoney(r.carryForward, sym) })}</span>}
                      </td>
                      <td className={td} onClick={(e) => e.stopPropagation()}>
                        {r.status === "paid" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                            <CheckCircle className="w-3 h-3" /> {tr("payroll.statusPaid", "Paid")}
                          </span>
                        ) : r.status === "unpaid" ? (
                          <button onClick={() => setPaying(r)} className={`${dueNow ? btnPrimary : btnGhost} whitespace-nowrap`}>
                            {dueNow ? tr("payroll.paySalary", "Pay salary") : tr("payroll.payEarly", "Pay early")}
                          </button>
                        ) : <span className="text-xs text-ad-muted">{tr("payroll.nothingDue", "Nothing due")}</span>}
                      </td>
                    </tr>
                    {expanded && <tr><td colSpan={8} className="p-0 border-t border-ad-line"><RowDetail row={r} /></td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4">
          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.limit}
            onPage={(p) => { setPage(p); setOpen(null); }} isDarkMode={isDarkMode} />
        </div>
      </div>
      <p className="text-xs text-ad-muted">
        {tr("payroll.howItWorks", "Final salary = class earnings + bonuses − deductions − charges (on the full class earnings) − loans / part payments − any balance owed. A negative result is carried into the next salary.")}
      </p>
    </div>
  );
}
