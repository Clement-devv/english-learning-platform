// src/pages/admin/tabs/payroll/ChargeScopePicker.jsx
// Who a payroll charge is taken from: every teacher, teachers in some regions,
// or teachers picked one by one (with search, a region filter and select all).
import { useState, useMemo } from "react";
import { Users, Globe2, UserCheck, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { inputCls, regionName } from "./payrollUtils";

const MODES = [
  { key: "all", icon: Users },
  { key: "regions", icon: Globe2 },
  { key: "teachers", icon: UserCheck },
];

export default function ChargeScopePicker({ charge, teachers, regions, onChange }) {
  const { t: tr } = useTranslation("admin");
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const mode = charge.appliesTo || "all";
  const picked = useMemo(() => new Set((charge.teacherIds || []).map(String)), [charge.teacherIds]);
  const pickedRegions = charge.regions || [];

  const modeLabel = {
    all: tr("payroll.scopeAll", "All teachers"),
    regions: tr("payroll.scopeRegions", "By region"),
    teachers: tr("payroll.scopeTeachers", "Selected teachers"),
  };

  const perRegion = useMemo(() => {
    const n = {};
    teachers.forEach((t) => { if (t.continent) n[t.continent] = (n[t.continent] || 0) + 1; });
    return n;
  }, [teachers]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return teachers.filter((t) => (!region || t.continent === region) &&
      (!term || `${t.firstName} ${t.lastName} ${t.teacherCode || ""}`.toLowerCase().includes(term)));
  }, [teachers, q, region]);

  const setTeachers = (ids) => onChange({ teacherIds: [...ids] });
  const toggleTeacher = (id) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setTeachers(next);
  };
  const selectShown = () => setTeachers(new Set([...picked, ...shown.map((t) => String(t._id))]));
  const clearShown = () => { const ids = new Set(shown.map((t) => String(t._id))); setTeachers([...picked].filter((id) => !ids.has(id))); };
  const toggleRegion = (r) => onChange({ regions: pickedRegions.includes(r) ? pickedRegions.filter((x) => x !== r) : [...pickedRegions, r] });
  const allRegions = pickedRegions.length === regions.length;

  const chip = (on) => `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${on
    ? "bg-ad-accent-soft border-ad-accent-line text-ad-accent-ink" : "border-ad-line text-ad-ink-2 hover:bg-ad-raised"}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={tr("payroll.appliesTo", "Applies to")}>
        <span className="text-xs font-semibold text-ad-muted mr-1">{tr("payroll.appliesTo", "Applies to")}</span>
        {MODES.map(({ key, icon: Icon }) => (
          <button key={key} type="button" role="radio" aria-checked={mode === key}
            onClick={() => onChange({ appliesTo: key })} className={`${chip(mode === key)} inline-flex items-center gap-1`}>
            <Icon className="w-3.5 h-3.5" /> {modeLabel[key]}
          </button>
        ))}
      </div>

      {mode === "regions" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => onChange({ regions: allRegions ? [] : [...regions] })} className={chip(allRegions)}>
            {tr("payroll.allRegions", "All regions")}
          </button>
          {regions.map((r) => (
            <button key={r} type="button" aria-pressed={pickedRegions.includes(r)} onClick={() => toggleRegion(r)} className={chip(pickedRegions.includes(r))}>
              {regionName(r, tr)} <span className="opacity-60">· {perRegion[r] || 0}</span>
            </button>
          ))}
          {pickedRegions.length === 0 && <span className="text-xs text-rose-600">{tr("payroll.pickRegion", "Pick at least one region")}</span>}
        </div>
      )}

      {mode === "teachers" && (
        <div className="rounded-lg border border-ad-line">
          <div className="flex flex-col sm:flex-row gap-2 p-2 border-b border-ad-line">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-ad-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("payroll.searchTeachers", "Search name or ID…")}
                className={`${inputCls} !pl-8`} aria-label={tr("payroll.searchTeachers", "Search name or ID…")} />
            </div>
            <select value={region} onChange={(e) => setRegion(e.target.value)} className={`${inputCls} sm:w-40`} aria-label={tr("payroll.scopeRegions", "By region")}>
              <option value="">{tr("payroll.allRegions", "All regions")}</option>
              {regions.map((r) => <option key={r} value={r}>{regionName(r, tr)}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs border-b border-ad-line">
            <span className={picked.size ? "text-ad-ink-2" : "text-rose-600"}>
              {tr("payroll.nSelected", "{{n}} of {{total}} selected", { n: picked.size, total: teachers.length })}
            </span>
            <span className="flex gap-3">
              <button type="button" onClick={selectShown} className="font-semibold text-ad-accent-ink hover:underline">
                {q || region ? tr("payroll.selectShown", "Select these ({{n}})", { n: shown.length }) : tr("payroll.selectAll", "Select all")}
              </button>
              <button type="button" onClick={clearShown} className="font-semibold text-ad-muted hover:underline">{tr("payroll.clear", "Clear")}</button>
            </span>
          </div>
          <ul className="max-h-56 overflow-y-auto divide-y divide-[var(--a-line)]">
            {shown.length === 0 && <li className="px-3 py-3 text-xs text-ad-muted">{tr("payroll.noTeacherMatch", "No teachers match")}</li>}
            {shown.map((t) => {
              const id = String(t._id);
              return (
                <li key={id}>
                  <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-ad-raised">
                    <input type="checkbox" checked={picked.has(id)} onChange={() => toggleTeacher(id)} className="w-4 h-4 accent-[var(--a-accent)]" />
                    <span className="flex-1 min-w-0 text-sm text-ad-ink truncate">
                      {t.firstName} {t.lastName}
                      {!t.active && <span className="ml-1 text-xs text-ad-muted">({tr("payroll.inactive", "inactive")})</span>}
                    </span>
                    <span className="text-xs text-ad-muted whitespace-nowrap">{t.teacherCode}{t.continent ? ` · ${regionName(t.continent, tr)}` : ""}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
