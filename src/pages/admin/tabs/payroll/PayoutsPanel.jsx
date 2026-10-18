// src/pages/admin/tabs/payroll/PayoutsPanel.jsx
// Pay a teacher any amount on any day (a loan or a part payment of their salary)
// and the full history of every payment made to every teacher.
import { useState, useEffect, useCallback, useRef } from "react";
import { HandCoins, Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../../../api";
import { useOnDataChanged } from "../../../../hooks/useLiveData";
import Pagination from "../../../../components/Pagination";
import { useCurrencySymbol, fmtMoney } from "../../../../hooks/useCurrencySymbol";
import { PAYOUT_METHODS, inputCls, btnPrimary, btnGhost, card, th, td, kindLabel, methodLabel, fmtDateTime, errMsg, teacherLabel } from "./payrollUtils";
import TeacherSelect from "./TeacherSelect";

const KIND_STYLE = {
  loan: "bg-amber-50 text-amber-700",
  part_payment: "bg-sky-50 text-sky-700",
  salary: "bg-emerald-50 text-emerald-700",
};

function AdvanceForm({ teachers, onSaved }) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
  const empty = { teacherId: "", kind: "part_payment", amount: "", paymentMethod: "bank_transfer", notes: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const teacher = teachers.find((t) => String(t._id) === form.teacherId);

  // The chosen teacher's salary so far this period (their own statement)
  const [soFar, setSoFar] = useState(null);
  useEffect(() => {
    setSoFar(null);
    if (!form.teacherId) return;
    let stale = false;
    api.get(`/payroll/admin/teacher/${form.teacherId}`)
      .then((r) => { if (!stale) setSoFar(r.data.data.current.find((c) => c.period.open) || null); })
      .catch(() => {});
    return () => { stale = true; };
  }, [form.teacherId]);

  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.teacherId || !(amount > 0)) { setError(tr("payroll.fillTeacherAmount", "Choose a teacher and enter an amount")); return; }
    if (!window.confirm(tr("payroll.confirmAdvance", "Record {{kind}} of {{amount}} to {{name}}? It will come off their next salary.", {
      kind: kindLabel(form.kind, tr).toLowerCase(), amount: fmtMoney(amount, sym), name: teacher ? teacherLabel(teacher) : "",
    }))) return;
    setBusy(true); setError("");
    try {
      await api.post("/payroll/admin/payouts", { ...form, amount });
      setForm(empty);
      onSaved(tr("payroll.advanceSaved", "Payment recorded — it will come off the next salary"));
    } catch (err) {
      setError(errMsg(err, tr("payroll.advanceFailed", "Couldn't record the payment")));
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className={`${card} p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <HandCoins className="w-5 h-5 text-ad-accent" />
        <h3 className="font-bold text-ad-ink">{tr("payroll.payTeacherNow", "Pay a teacher now")}</h3>
      </div>
      <p className="text-xs text-ad-muted">
        {tr("payroll.payNowHelp", "For a loan or part of their salary before salary day. The amount is taken off their next salary — charges are still worked out on their full class earnings.")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <label className="block lg:col-span-2">
          <span className="block text-xs font-semibold text-ad-muted mb-1">{tr("paymentTab.teacher")}</span>
          <TeacherSelect teachers={teachers} value={form.teacherId} onChange={(v) => setForm((f) => ({ ...f, teacherId: v }))}
            emptyLabel={tr("payroll.chooseTeacher", "Choose a teacher…")} required ariaLabel={tr("paymentTab.teacher")} />
          {soFar && (
            <span className="block text-xs text-ad-muted mt-1">
              {tr("payroll.salarySoFarLine", "Salary so far this period: {{amount}}", { amount: fmtMoney(soFar.amountPaid, sym) })}
            </span>
          )}
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-ad-muted mb-1">{tr("payroll.type", "Type")}</span>
          <select value={form.kind} onChange={set("kind")} className={inputCls}>
            <option value="part_payment">{kindLabel("part_payment", tr)}</option>
            <option value="loan">{kindLabel("loan", tr)}</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-ad-muted mb-1">{tr("paymentTab.amount")} ({sym})</span>
          <input type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={set("amount")} className={inputCls} required />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-ad-muted mb-1">{tr("paymentTab.paymentMethod")}</span>
          <select value={form.paymentMethod} onChange={set("paymentMethod")} className={inputCls}>
            {PAYOUT_METHODS.map((m) => <option key={m} value={m}>{methodLabel(m, tr)}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={form.notes} onChange={set("notes")} maxLength={500} className={`${inputCls} flex-1`}
          placeholder={tr("payroll.notesPlaceholder", "Note (e.g. reason, transfer reference)")} />
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? tr("payroll.saving", "Saving…") : tr("payroll.recordPayment", "Record payment")}</button>
      </div>
      {soFar && Number(form.amount) > soFar.amountPaid && (
        <p className="text-xs text-amber-700">{tr("payroll.moreThanEarned", "This is more than the teacher's salary so far — the difference will be owed and carried into later salaries.")}</p>
      )}
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
    </form>
  );
}

export default function PayoutsPanel({ onToast, isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  const toast = useRef(onToast);
  toast.current = onToast;
  const sym = useCurrencySymbol();
  const [teachers, setTeachers] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pager, setPager] = useState({ page: 1, totalPages: 1, total: 0, limit: 25 });
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ teacherId: "", kind: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);

  const loadTeachers = useCallback(() => {
    api.get("/payroll/admin/teachers").then((r) => setTeachers(r.data.data)).catch(() => {});
  }, []);
  const loadHistory = useCallback(async () => {
    try {
      const params = { page, limit: 25, ...Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) };
      const r = await api.get("/payroll/admin/payouts", { params });
      setItems(r.data.data.items); setPager(r.data.data.pagination); setTotal(r.data.data.total);
    } catch (err) {
      toast.current?.(errMsg(err, tr("payroll.loadFailed", "Couldn't load payroll")));
    } finally { setLoading(false); }
  }, [page, filter, tr]);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  useOnDataChanged(["payments"], () => { loadTeachers(); loadHistory(); });

  const setF = (k) => (e) => { setPage(1); setFilter((f) => ({ ...f, [k]: e.target.value })); };

  const voidPayout = async (p) => {
    const reason = window.prompt(tr("payroll.voidPrompt", "Void this {{kind}} of {{amount}} to {{name}}? Give a reason:", {
      kind: kindLabel(p.kind, tr).toLowerCase(), amount: fmtMoney(p.amount, sym), name: p.teacherName,
    }));
    if (reason === null) return;
    try {
      await api.post(`/payroll/admin/payouts/${p._id}/void`, { reason });
      onToast?.(tr("payroll.voided", "Payment voided"));
      loadHistory(); loadTeachers();
    } catch (err) { onToast?.(errMsg(err, tr("payroll.voidFailed", "Couldn't void the payment"))); }
  };

  return (
    <div className="space-y-4">
      <AdvanceForm teachers={teachers} onSaved={(msg) => { onToast?.(msg); loadHistory(); loadTeachers(); }} />

      <div className={`${card} overflow-hidden`}>
        <div className="p-4 border-b border-ad-line space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-bold text-ad-ink">{tr("payroll.historyTitle", "Payment history — all teachers")}</h3>
            <p className="text-sm text-ad-muted">{tr("payroll.historyTotal", "{{count}} payments · {{amount}} in total", { count: pager.total, amount: fmtMoney(total, sym) })}</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="col-span-2">
              <TeacherSelect teachers={teachers} value={filter.teacherId} onChange={(v) => { setPage(1); setFilter((f) => ({ ...f, teacherId: v })); }}
                emptyLabel={tr("payroll.allTeachers", "All teachers")} ariaLabel={tr("paymentTab.teacher")} />
            </div>
            <select value={filter.kind} onChange={setF("kind")} className={inputCls} aria-label={tr("payroll.type", "Type")}>
              <option value="">{tr("payroll.allTypes", "All types")}</option>
              {["salary", "part_payment", "loan"].map((k) => <option key={k} value={k}>{kindLabel(k, tr)}</option>)}
            </select>
            <input type="date" value={filter.from} onChange={setF("from")} className={inputCls} aria-label={tr("payroll.from", "From")} />
            <input type="date" value={filter.to} onChange={setF("to")} className={inputCls} aria-label={tr("payroll.to", "To")} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className={th}>{tr("payroll.colDate", "Date")}</th>
                <th className={th}>{tr("paymentTab.teacher")}</th>
                <th className={th}>{tr("payroll.type", "Type")}</th>
                <th className={th}>{tr("paymentTab.amount")}</th>
                <th className={th}>{tr("paymentTab.paymentMethod")}</th>
                <th className={th}>{tr("payroll.colBy", "Paid by / note")}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr><td colSpan={7} className={`${td} text-center text-ad-muted py-10`}>{tr("payroll.noPayments", "No payments yet")}</td></tr>
              )}
              {items.map((p) => (
                <tr key={p._id} className={p.voided ? "opacity-60" : ""}>
                  <td className={`${td} whitespace-nowrap`}>{fmtDateTime(p.paidAt)}</td>
                  <td className={`${td} font-semibold`}>{p.teacherName}</td>
                  <td className={td}>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${KIND_STYLE[p.kind] || ""}`}>{kindLabel(p.kind, tr)}</span>
                    {p.kind === "salary" && p.periodKey && <span className="block text-xs text-ad-muted mt-0.5">{p.periodKey}</span>}
                    {p.kind !== "salary" && !p.voided && (
                      <span className="block text-xs text-ad-muted mt-0.5">
                        {p.payslipId ? tr("payroll.deducted", "taken off salary {{key}}", { key: p.periodKey }) : tr("payroll.toDeduct", "comes off next salary")}
                      </span>
                    )}
                  </td>
                  <td className={`${td} tabular-nums font-semibold ${p.voided ? "line-through" : ""}`}>{fmtMoney(p.amount, sym)}</td>
                  <td className={td}>{methodLabel(p.paymentMethod, tr)}</td>
                  <td className={`${td} text-ad-ink-2`}>
                    {p.paidByName}{p.notes ? ` · ${p.notes}` : ""}
                    {p.voided && <span className="block text-xs text-rose-600">{tr("payroll.voidedNote", "Voided {{date}}", { date: fmtDateTime(p.voidedAt) })}{p.voidReason ? ` · ${p.voidReason}` : ""}</span>}
                  </td>
                  <td className={td}>
                    {p.kind !== "salary" && !p.payslipId && !p.voided && (
                      <button onClick={() => voidPayout(p)} className={`${btnGhost} !px-2 !py-1 inline-flex items-center gap-1 text-xs`}>
                        <Ban className="w-3.5 h-3.5" /> {tr("payroll.void", "Void")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4">
          <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit} onPage={setPage} isDarkMode={isDarkMode} />
        </div>
      </div>
    </div>
  );
}
