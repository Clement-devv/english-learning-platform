// src/components/groupClass/StudentPicker.jsx
// Pick students for an invite-only group class (create window).
//   options — students already loaded: filtered here (admin / sub-admin)
//   search  — async (query) => students: asks the server (teachers)
// Picked students show as removable chips; `value` / `onChange` hold their ids.
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Check } from "lucide-react";

const nameOf = (s) => `${s.firstName || ""} ${s.lastName || ""}`.trim();

export default function StudentPicker({ options, search, value = [], onChange, col, labels = {} }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [known, setKnown] = useState({}); // id → student, so chips keep their names
  // Latest search function without re-running the search when the parent re-renders
  const searchRef = useRef(search);
  useEffect(() => { searchRef.current = search; }, [search]);
  const L = {
    placeholder: "Search students…", none: "No students found", selected: "{{count}} selected",
    typeToSearch: "Type a name to search", points: "{{count}} pts", ...labels,
  };
  const fill = (t, vars) => Object.entries(vars).reduce((a, [k, v]) => a.replace(`{{${k}}}`, v), t);

  useEffect(() => {
    if (options) return;
    const term = q.trim();
    if (!term) { setResults([]); return; }
    const timer = setTimeout(() => {
      searchRef.current(term).then((list) => setResults(list || [])).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, options]);

  const shown = useMemo(() => {
    if (!options) return results;
    const term = q.trim().toLowerCase();
    const list = term ? options.filter((s) => `${nameOf(s)} ${s.email || ""}`.toLowerCase().includes(term)) : options;
    return list.slice(0, 50);
  }, [options, results, q]);

  const picked = new Set(value.map(String));
  const toggle = (s) => {
    const id = String(s._id);
    setKnown((k) => ({ ...k, [id]: s }));
    onChange(picked.has(id) ? value.filter((v) => String(v) !== id) : [...value, id]);
  };
  const lookup = (id) => known[id] || options?.find((s) => String(s._id) === id);

  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map((id) => {
            const s = lookup(String(id));
            return (
              <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 6px 4px 10px", borderRadius: 999, background: col.accent + "18", color: col.heading, fontSize: 12, fontWeight: 700 }}>
                {s ? nameOf(s) : "…"}
                <button type="button" aria-label={`Remove ${s ? nameOf(s) : ""}`} onClick={() => onChange(value.filter((v) => String(v) !== String(id)))}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: col.muted }}>
                  <X size={13} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div style={{ position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: col.muted }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.placeholder}
          style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px 9px 30px", borderRadius: 10, border: `1.5px solid ${col.border}`, background: "transparent", color: col.heading, fontSize: 13, fontFamily: "inherit" }} />
      </div>
      <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 6, border: `1px solid ${col.border}`, borderRadius: 10 }}>
        {shown.length === 0 ? (
          <p style={{ margin: 0, padding: "10px 12px", fontSize: 12.5, color: col.muted }}>{!options && !q.trim() ? L.typeToSearch : L.none}</p>
        ) : shown.map((s) => {
          const on = picked.has(String(s._id));
          return (
            <button type="button" key={s._id} onClick={() => toggle(s)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: on ? col.accent + "12" : "transparent", border: "none", borderBottom: `1px solid ${col.border}`, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `2px solid ${on ? col.accent : col.border}`, background: on ? col.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {on && <Check size={12} color="#fff" />}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: col.heading, fontWeight: 600 }}>{nameOf(s)}</span>
              {s.groupPoints !== undefined && <span style={{ fontSize: 11.5, color: col.muted }}>{fill(L.points, { count: s.groupPoints || 0 })}</span>}
            </button>
          );
        })}
      </div>
      {value.length > 0 && <p style={{ margin: "6px 0 0", fontSize: 12, color: col.muted }}>{fill(L.selected, { count: value.length })}</p>}
    </div>
  );
}
