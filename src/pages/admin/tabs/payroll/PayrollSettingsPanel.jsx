// src/pages/admin/tabs/payroll/PayrollSettingsPanel.jsx
// The center's salary day, how the pay period runs, the general charges taken
// from teachers' class earnings (all of them, picked ones or by region), and how
// long payment history is kept.
import { useState, useEffect } from "react";
import { Plus, Trash2, CalendarCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../../../api";
import { useCurrencySymbol, fmtMoney } from "../../../../hooks/useCurrencySymbol";
import { inputCls, btnPrimary, btnGhost, card, errMsg } from "./payrollUtils";
import ChargeScopePicker from "./ChargeScopePicker";

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default function PayrollSettingsPanel({ onToast }) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/payroll/admin/settings")
      .then((r) => { setForm(r.data.data); setSaved(r.data.data); })
      .catch((err) => setError(errMsg(err, tr("payroll.loadFailed", "Couldn't load payroll"))));
  }, [tr]);

  if (error && !form) return <p className="text-sm text-rose-600">{error}</p>;
  if (!form) return <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ad-accent" /></div>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const patchCharge = (i, patch) => setForm((f) => ({ ...f, charges: f.charges.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const setCharge = (i, k, v) => patchCharge(i, { [k]: v });
  const addCharge = () => setForm((f) => ({ ...f, charges: [...f.charges,
    { name: "", kind: "percent", value: 10, active: true, appliesTo: "all", teacherIds: [], regions: [] }] }));
  const removeCharge = (i) => setForm((f) => ({ ...f, charges: f.charges.filter((_, j) => j !== i) }));

  const last = form.payDay === 31;
  const dayText = last ? tr("payroll.lastDay", "the last day of the month") : tr("payroll.dayN", "the {{day}}", { day: ordinal(form.payDay), n: form.payDay });
  const summary = form.cycle === "ends_on_payday"
    ? tr("payroll.summaryPayday", "Each pay period runs from the day after one salary day up to and including the next one ({{day}}), and salaries are paid that day.", { day: dayText })
    : last
      ? tr("payroll.summaryCalendarLast", "Work from the 1st to the last day of each month is paid on the last day of that month.")
      : tr("payroll.summaryCalendar", "Work from the 1st to the last day of each month is paid on {{day}} of the following month.", { day: dayText });

  const save = async () => {
    setBusy(true); setError("");
    try {
      const body = {
        payDay: Number(form.payDay), cycle: form.cycle, retentionMonths: Number(form.retentionMonths),
        charges: form.charges.map((c) => ({ ...c, value: Number(c.value) })),
      };
      const r = await api.put("/payroll/admin/settings", body);
      setForm(r.data.data); setSaved(r.data.data);
      onToast?.(tr("payroll.settingsSaved", "Payroll settings saved"));
    } catch (err) {
      setError(errMsg(err, tr("payroll.settingsFailed", "Couldn't save the settings")));
    } finally { setBusy(false); }
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  return (
    <div className="space-y-4 max-w-3xl">
      <section className={`${card} p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-ad-accent" />
          <h3 className="font-bold text-ad-ink">{tr("payroll.salaryDayTitle", "Salary day")}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-ad-muted mb-1">{tr("payroll.payDayLabel", "Salaries are paid on")}</span>
            <select value={form.payDay} onChange={(e) => set("payDay", Number(e.target.value))} className={inputCls}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{tr("payroll.dayOption", "The {{day}} of the month", { day: ordinal(d), n: d })}</option>
              ))}
              <option value={31}>{tr("payroll.lastDayOption", "The last day of the month")}</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-ad-muted mb-1">{tr("payroll.cycleLabel", "Pay period")}</span>
            <select value={form.cycle} onChange={(e) => set("cycle", e.target.value)} className={inputCls}>
              <option value="calendar_month">{tr("payroll.cycleCalendar", "Calendar month (1st – last day)")}</option>
              <option value="ends_on_payday">{tr("payroll.cyclePayday", "Ends on the salary day (e.g. 26th – 25th)")}</option>
            </select>
          </label>
        </div>
        <p className="text-sm text-ad-ink-2 rounded-lg bg-ad-raised px-3 py-2">{summary}</p>
        <p className="text-xs text-ad-muted">
          {tr("payroll.timezoneNote", "Dates follow the center's time zone ({{tz}}). Changing the salary day only affects periods that haven't ended yet.", { tz: form.timezone || "UTC" })}
        </p>
      </section>

      <section className={`${card} p-4 space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-ad-ink">{tr("payroll.chargesTitle", "Charges taken from salaries")}</h3>
          <button onClick={addCharge} className={`${btnGhost} inline-flex items-center gap-1 !py-1.5`}><Plus className="w-4 h-4" /> {tr("payroll.addCharge", "Add charge")}</button>
        </div>
        <p className="text-xs text-ad-muted">
          {tr("payroll.chargesHelp", "Taken automatically from each salary. A percentage is worked out on the teacher's total class earnings for the period — even if part of it was already paid early. A fixed amount is taken from each teacher it applies to who taught that period. Each charge can apply to all teachers, some regions or teachers you pick.")}
        </p>
        {form.charges.length === 0 && <p className="text-sm text-ad-muted">{tr("payroll.noCharges", "No charges set")}</p>}
        {form.charges.map((c, i) => (
          <div key={c._id || `new-${i}`} className={`rounded-lg border border-ad-line p-3 space-y-3 ${c.active === false ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-12 gap-2 items-center">
            <input value={c.name} onChange={(e) => setCharge(i, "name", e.target.value)} maxLength={60}
              placeholder={tr("payroll.chargeName", "Name, e.g. Center fee")} className={`${inputCls} col-span-12 sm:col-span-5`} />
            <select value={c.kind} onChange={(e) => setCharge(i, "kind", e.target.value)} className={`${inputCls} col-span-5 sm:col-span-3`}>
              <option value="percent">{tr("payroll.kindPercent", "% of class earnings")}</option>
              <option value="fixed">{tr("payroll.kindFixed", "Fixed amount ({{sym}})", { sym })}</option>
            </select>
            <input type="number" min="0.01" step="0.01" max={c.kind === "percent" ? 100 : undefined} value={c.value}
              onChange={(e) => setCharge(i, "value", e.target.value)} className={`${inputCls} col-span-3 sm:col-span-2`}
              aria-label={tr("payroll.chargeValue", "Value")} />
            <label className="col-span-2 sm:col-span-1 flex items-center justify-center" title={tr("payroll.chargeActive", "On")}>
              <input type="checkbox" checked={c.active !== false} onChange={(e) => setCharge(i, "active", e.target.checked)} className="w-4 h-4 accent-[var(--a-accent)]" />
            </label>
            <button onClick={() => removeCharge(i)} className="col-span-2 sm:col-span-1 p-2 rounded-lg text-ad-muted hover:text-rose-600 hover:bg-ad-raised justify-self-center"
              aria-label={tr("payroll.removeCharge", "Remove charge")}><Trash2 className="w-4 h-4" /></button>
          </div>
          <ChargeScopePicker charge={c} teachers={form.teachers || []} regions={form.regions || []} onChange={(patch) => patchCharge(i, patch)} />
          </div>
        ))}
        {form.charges.some((c) => c.active !== false && c.kind === "percent" && (c.appliesTo || "all") === "all" && Number(c.value) > 0) && (
          <p className="text-xs text-ad-ink-2">
            {tr("payroll.chargeExampleAll", "Example: a teacher who earned {{earned}} this period pays {{charge}} in percentage charges that apply to all teachers.", {
              earned: fmtMoney(1000, sym),
              charge: fmtMoney(form.charges.filter((c) => c.active !== false && c.kind === "percent" && (c.appliesTo || "all") === "all")
                .reduce((s, c) => s + Number(c.value || 0), 0) * 10, sym),
            })}
          </p>
        )}
      </section>

      <section className={`${card} p-4 space-y-2`}>
        <h3 className="font-bold text-ad-ink">{tr("payroll.historyKept", "Payment history")}</h3>
        <label className="block sm:w-64">
          <span className="block text-xs font-semibold text-ad-muted mb-1">{tr("payroll.keepFor", "Keep payslips and payments for")}</span>
          <select value={form.retentionMonths} onChange={(e) => set("retentionMonths", Number(e.target.value))} className={inputCls}>
            {[4, 5, 6, 9, 12, 18, 24].map((m) => <option key={m} value={m}>{tr("payroll.nMonths", "{{n}} months", { n: m })}</option>)}
          </select>
        </label>
        <p className="text-xs text-ad-muted">{tr("payroll.keepHelp", "Records are wiped automatically this long after the salary they belong to was paid. Loans and part payments not yet taken off a salary are never wiped.")}</p>
      </section>

      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
      <div className="flex gap-3">
        <button onClick={save} disabled={busy || !dirty} className={btnPrimary}>{busy ? tr("payroll.saving", "Saving…") : tr("payroll.saveSettings", "Save settings")}</button>
        {dirty && <button onClick={() => setForm(saved)} className={btnGhost}>{tr("paymentTab.cancel")}</button>}
      </div>
    </div>
  );
}
