// src/pages/admin/tabs/payroll/TeacherSelect.jsx
// A teacher dropdown that stays usable with hundreds of teachers: type to narrow
// the list (name, ID number or region), then pick.
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { inputCls, regionName, teacherLabel } from "./payrollUtils";

const MAX_OPTIONS = 300;

export default function TeacherSelect({ teachers, value, onChange, emptyLabel, required, ariaLabel }) {
  const { t: tr } = useTranslation("admin");
  const [q, setQ] = useState("");

  const options = useMemo(() => {
    const term = q.trim().toLowerCase();
    const hit = teachers.filter((t) => !term ||
      `${teacherLabel(t)} ${t.teacherCode || ""} ${t.continent || ""}`.toLowerCase().includes(term));
    const list = hit.slice(0, MAX_OPTIONS);
    // Keep the chosen teacher in the list even when the search hides them
    const chosen = teachers.find((t) => String(t._id) === value);
    if (chosen && !list.includes(chosen)) list.unshift(chosen);
    return { list, more: hit.length - Math.min(hit.length, MAX_OPTIONS) };
  }, [teachers, q, value]);

  return (
    <div className="flex gap-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} !w-32 sm:!w-36 flex-shrink-0`}
        placeholder={tr("payroll.searchShort", "Search…")} aria-label={tr("payroll.searchTeachers", "Search name or ID…")} />
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} min-w-0`} required={required} aria-label={ariaLabel}>
        <option value="">{emptyLabel}</option>
        {options.list.map((t) => (
          <option key={t._id} value={String(t._id)}>
            {teacherLabel(t)}{t.teacherCode ? ` · ${t.teacherCode}` : ""}{t.continent ? ` · ${regionName(t.continent, tr)}` : ""}
            {t.active === false ? ` (${tr("payroll.inactive", "inactive")})` : ""}
          </option>
        ))}
        {options.more > 0 && <option disabled>{tr("payroll.moreTeachers", "…{{n}} more — type to search", { n: options.more })}</option>}
      </select>
    </div>
  );
}
