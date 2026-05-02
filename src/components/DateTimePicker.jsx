// DateTimePicker.jsx — Calendar + scrollable time picker
// value: "YYYY-MM-DDTHH:MM" string or ""
// onChange: (isoString) => void  e.g. "2026-05-10T14:30"
import React, { useState, useRef, useEffect } from "react";

const WEEK  = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstDayOf(y, m)  { return new Date(y, m, 1).getDay(); }

// Parse "YYYY-MM-DDTHH:MM" into { year, month, day, hour12, minute, pm }
function parseValue(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d)) return null;
  const h = d.getHours();
  return {
    year:   d.getFullYear(),
    month:  d.getMonth(),
    day:    d.getDate(),
    hour12: h === 0 ? 12 : h > 12 ? h - 12 : h,
    minute: d.getMinutes(),
    pm:     h >= 12,
  };
}

// Build ISO string from parts
function buildISO(year, month, day, hour12, minute, pm) {
  const h24 = pm ? (hour12 === 12 ? 12 : hour12 + 12) : (hour12 === 12 ? 0 : hour12);
  const pad2 = n => String(n).padStart(2, "0");
  return `${year}-${pad2(month + 1)}-${pad2(day)}T${pad2(h24)}:${pad2(minute)}`;
}

// Tiny scrollable column — clicking selects a value
function ScrollCol({ items, selected, onSelect, fmt = v => String(v).padStart(2, "0"), width = 52 }) {
  const ref = useRef(null);

  // Scroll selected item into view on mount / change
  useEffect(() => {
    if (!ref.current) return;
    const idx = items.indexOf(selected);
    if (idx >= 0) {
      const child = ref.current.children[idx];
      if (child) child.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      {/* Selected badge */}
      <div style={{
        background: "#3b82f6", color: "#fff", borderRadius: 10,
        padding: "4px 0", fontSize: 15, fontWeight: 800,
        width, textAlign: "center", marginBottom: 4,
      }}>
        {fmt(selected)}
      </div>

      {/* Scrollable list */}
      <div ref={ref} style={{
        height: 168, overflowY: "auto", display: "flex",
        flexDirection: "column", scrollSnapType: "y mandatory",
        scrollbarWidth: "none",
      }}>
        {items.map(item => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            style={{
              border: "none",
              background: item === selected ? "#eff6ff" : "transparent",
              color: item === selected ? "#1d4ed8" : "#6b7280",
              fontWeight: item === selected ? 700 : 400,
              fontSize: 13, cursor: "pointer",
              padding: "6px 0", width, textAlign: "center",
              borderRadius: 8, flexShrink: 0,
              scrollSnapAlign: "start",
            }}
          >
            {fmt(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DateTimePicker({ value, onChange, placeholder, inputStyle, isDarkMode }) {
  const parsed = parseValue(value);

  const now = new Date();
  const [view,    setView]    = useState({ year: parsed?.year || now.getFullYear(), month: parsed?.month ?? now.getMonth() });
  const [selDay,  setSelDay]  = useState(parsed?.day    || null);
  const [selYear, setSelYear] = useState(parsed?.year   || null);
  const [selMon,  setSelMon]  = useState(parsed?.month  ?? null);
  const [hour,    setHour]    = useState(parsed?.hour12 || 9);
  const [minute,  setMinute]  = useState(parsed?.minute || 0);
  const [pm,      setPm]      = useState(parsed?.pm     ?? false);
  const [open,    setOpen]    = useState(false);

  const wrapRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const emit = (y, mo, d, hr, mi, isPm) => {
    if (y == null || mo == null || d == null) return;
    onChange(buildISO(y, mo, d, hr, mi, isPm));
  };

  const selectDay = (day) => {
    setSelDay(day); setSelYear(view.year); setSelMon(view.month);
    emit(view.year, view.month, day, hour, minute, pm);
  };

  const changeHour = (h)  => { setHour(h);   emit(selYear, selMon, selDay, h, minute, pm); };
  const changeMin  = (m)  => { setMinute(m);  emit(selYear, selMon, selDay, hour, m, pm); };
  const changePm   = (v)  => { setPm(v);      emit(selYear, selMon, selDay, hour, minute, v); };

  const goToday = () => {
    const t = new Date();
    const h12 = t.getHours() === 0 ? 12 : t.getHours() > 12 ? t.getHours() - 12 : t.getHours();
    setView({ year: t.getFullYear(), month: t.getMonth() });
    setSelDay(t.getDate()); setSelYear(t.getFullYear()); setSelMon(t.getMonth());
    setHour(h12); setMinute(t.getMinutes()); setPm(t.getHours() >= 12);
    emit(t.getFullYear(), t.getMonth(), t.getDate(), h12, t.getMinutes(), t.getHours() >= 12);
  };

  const clearValue = () => {
    setSelDay(null); setSelYear(null); setSelMon(null);
    onChange("");
  };

  const prevMonth = () => setView(v => {
    const m = v.month === 0 ? 11 : v.month - 1;
    return { year: v.month === 0 ? v.year - 1 : v.year, month: m };
  });
  const nextMonth = () => setView(v => {
    const m = v.month === 11 ? 0 : v.month + 1;
    return { year: v.month === 11 ? v.year + 1 : v.year, month: m };
  });

  // Display text in the trigger input
  const displayText = (selDay != null && selYear != null && selMon != null)
    ? `${MONTHS[selMon]} ${selDay}, ${selYear}  ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")} ${pm ? "PM" : "AM"}`
    : "";

  const dm = isDarkMode;
  const bg      = dm ? "#1a1d2e" : "#ffffff";
  const border  = dm ? "#2a2d40" : "#e5e7eb";
  const text     = dm ? "#e2e8f0" : "#1e293b";
  const muted    = dm ? "#64748b" : "#94a3b8";
  const dayHover = dm ? "#2d3748" : "#f1f5f9";

  const days   = daysInMonth(view.year, view.month);
  const blanks = firstDayOf(view.year, view.month);
  const HOURS   = Array.from({ length: 12 }, (_, i) => i + 1);
  const MINUTES = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {/* Trigger field */}
      <input
        readOnly
        value={displayText}
        placeholder={placeholder || "Select date & time"}
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", cursor: "pointer",
          caretColor: "transparent",
          ...inputStyle,
        }}
      />

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 10000,
          background: bg, border: `1.5px solid ${border}`,
          borderRadius: 18, boxShadow: "0 12px 48px rgba(0,0,0,0.22)",
          display: "flex", overflow: "hidden",
          fontFamily: "'Inter','Nunito',sans-serif",
        }}>

          {/* ── Calendar ── */}
          <div style={{ padding: "18px 20px 14px", width: 286 }}>
            {/* Month nav */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              <span style={{ flex: 1, fontWeight: 800, fontSize: 14, color: text }}>
                {MONTHS[view.month]} {view.year}
              </span>
              <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: muted, fontSize: 16, lineHeight: 1, padding: "2px 6px" }}>↑</button>
              <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", color: muted, fontSize: 16, lineHeight: 1, padding: "2px 6px" }}>↓</button>
            </div>

            {/* Weekday labels */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
              {WEEK.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: muted, padding: "2px 0" }}>{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
              {Array.from({ length: blanks }).map((_, i) => <div key={`b${i}`} />)}
              {Array.from({ length: days }, (_, i) => i + 1).map(d => {
                const isToday   = d === now.getDate() && view.month === now.getMonth() && view.year === now.getFullYear();
                const isSel     = d === selDay && view.month === selMon && view.year === selYear;
                return (
                  <button key={d} onClick={() => selectDay(d)} style={{
                    width: "100%", aspectRatio: "1", border: "none", borderRadius: "50%",
                    cursor: "pointer", fontSize: 12,
                    fontWeight: isSel || isToday ? 700 : 400,
                    background: isSel ? "#3b82f6" : isToday ? (dm ? "#1d4ed820" : "#dbeafe") : "transparent",
                    color: isSel ? "#fff" : isToday ? "#2563eb" : text,
                  }}>{d}</button>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${border}` }}>
              <button onClick={clearValue} style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", fontWeight: 700, fontSize: 13 }}>Clear</button>
              <button onClick={goToday}   style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", fontWeight: 700, fontSize: 13 }}>Today</button>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: border, margin: "12px 0" }} />

          {/* ── Time picker ── */}
          <div style={{ padding: "18px 16px 14px", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <ScrollCol items={HOURS}   selected={hour}   onSelect={changeHour} />
            <ScrollCol items={MINUTES} selected={minute} onSelect={changeMin}  />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 36 }}>
              {["AM","PM"].map(p => (
                <button key={p} onClick={() => changePm(p === "PM")} style={{
                  border: "none", borderRadius: 10, padding: "8px 14px",
                  cursor: "pointer", fontSize: 13, fontWeight: 700,
                  background: (pm ? "PM" : "AM") === p ? "#3b82f6" : (dm ? "#2a2d40" : "#f1f5f9"),
                  color: (pm ? "PM" : "AM") === p ? "#fff" : muted,
                }}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
