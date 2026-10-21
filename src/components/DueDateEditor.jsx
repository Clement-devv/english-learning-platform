// src/components/DueDateEditor.jsx
// Teacher-side "change due date" for a homework or quiz (PATCH /<kind>/:id/due-date).
// Moving the date also reopens an expired parent link (same address) — the server emails
// the student / family the new date.
import { useState } from "react";
import { CalendarClock, Check, X } from "lucide-react";

const BRAND = "var(--brand-primary, #2563eb)";
// Due dates are calendar days stored at 00:00 UTC — read and show them in UTC
const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const toInput = (d) => new Date(d).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * dueDate: current due date; onSave(yyyyMmDd) → Promise (throws to keep the editor open)
 */
export default function DueDateEditor({ dueDate, onSave, isDarkMode }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(toInput(dueDate));
  const [saving, setSaving]   = useState(false);
  const muted = isDarkMode ? "#9ca3af" : "#6b7280";
  const ink   = isDarkMode ? "#f3f4f6" : "#111827";
  const btn = (bg, color) => ({
    display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9,
    border: "none", background: bg, color, fontSize: 12, fontWeight: 700, cursor: "pointer",
  });

  const save = async () => {
    if (!value || value === toInput(dueDate)) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(value); setEditing(false); }
    catch { /* the caller shows the error; keep the editor open */ }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <CalendarClock size={16} color={muted} />
      {editing ? (
        <>
          <input type="date" value={value} min={today()} onChange={(e) => setValue(e.target.value)}
            aria-label="New due date" disabled={saving}
            style={{ padding: "6px 10px", borderRadius: 9, border: `1.5px solid ${muted}`, background: "transparent", color: ink, fontSize: 13 }} />
          <button type="button" onClick={save} disabled={saving || !value} style={btn(BRAND, "#fff")}>
            <Check size={13} /> {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => { setEditing(false); setValue(toInput(dueDate)); }} disabled={saving}
            style={btn("transparent", muted)}>
            <X size={13} /> Cancel
          </button>
        </>
      ) : (
        <>
          <span style={{ fontSize: 13, color: ink }}>Due <strong>{fmtDate(dueDate)}</strong></span>
          <button type="button" onClick={() => { setValue(toInput(dueDate)); setEditing(true); }} style={btn("transparent", BRAND)}>
            Change due date
          </button>
        </>
      )}
    </div>
  );
}
