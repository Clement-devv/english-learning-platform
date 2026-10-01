// src/components/schedule/WeekCalendar.jsx
// One week calendar for teacher, student and admin schedule screens.
// • Always drawn in the VIEWER's own timezone (items/free are real moments).
// • Free time = green bands; classes, pending requests, time off on top.
// • Hours shown fit the week's content (toggle for all 24h).
// • Narrow screens get an agenda list instead of the grid.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader, Repeat } from "lucide-react";
import { DAY_SHORT, weekDays, sameDay, addDays, segmentOnDay, fmtRange, fmtTime } from "../../utils/scheduleView";

const HOUR_PX = 52;
const BRAND = "var(--brand-primary, #7c3aed)";

const KIND_STYLE = (dark) => ({
  free:     { bg: dark ? "rgba(16,185,129,0.14)" : "rgba(16,185,129,0.10)", border: "#10b981", text: dark ? "#6ee7b7" : "#047857", label: "Free" },
  booked:   { bg: BRAND, border: BRAND, text: "#fff", label: "Booked class" },
  pending:  { bg: "#f59e0b", border: "#d97706", text: "#fff", label: "Pending request" },
  done:     { bg: dark ? "rgba(148,163,184,0.25)" : "#e2e8f0", border: dark ? "#475569" : "#cbd5e1", text: dark ? "#cbd5e1" : "#475569", label: "Completed" },
  off:      { bg: `repeating-linear-gradient(45deg, ${dark ? "#1f2937" : "#f1f5f9"} 0 6px, ${dark ? "#273244" : "#e2e8f0"} 6px 12px)`, border: dark ? "#475569" : "#cbd5e1", text: dark ? "#cbd5e1" : "#475569", label: "Time off" },
  reserved: { bg: dark ? "rgba(14,165,233,0.25)" : "#e0f2fe", border: "#0ea5e9", text: dark ? "#7dd3fc" : "#0369a1", label: "Reserved" },
  busy:     { bg: `repeating-linear-gradient(45deg, ${dark ? "#1f2937" : "#f1f5f9"} 0 6px, ${dark ? "#273244" : "#e2e8f0"} 6px 12px)`, border: dark ? "#475569" : "#cbd5e1", text: dark ? "#94a3b8" : "#64748b", label: "Unavailable" },
});

export function Legend({ kinds, isDarkMode }) {
  const st = KIND_STYLE(isDarkMode);
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
      {kinds.map(k => (
        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: isDarkMode ? "#cbd5e1" : "#475569" }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: st[k].bg, border: `1.5px solid ${st[k].border}` }} />
          {st[k].label}
        </span>
      ))}
    </div>
  );
}

// Greedy lanes so overlapping items sit side by side instead of on top of each other
function laneLayout(segs) {
  const sorted = [...segs].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const lanes = [];
  const groups = [];
  let group = [], groupEnd = -1;
  for (const s of sorted) {
    if (s.startMin >= groupEnd && group.length) { groups.push(group); group = []; lanes.length = 0; }
    let lane = lanes.findIndex(end => end <= s.startMin);
    if (lane < 0) { lane = lanes.length; lanes.push(s.endMin); } else lanes[lane] = s.endMin;
    s.lane = lane;
    group.push(s);
    groupEnd = Math.max(groupEnd, s.endMin);
  }
  if (group.length) groups.push(group);
  for (const g of groups) { const n = Math.max(...g.map(s => s.lane)) + 1; g.forEach(s => { s.lanes = n; }); }
  return sorted;
}

/**
 * Props:
 *   weekStart     Monday (local Date)          onWeekChange(newMonday)
 *   free          [{ start, end }]             items [{ id, kind, start, end, title?, sub?, recurring?, onClick? }]
 *   onPickTime(Date)   click inside a free band (student booking)
 *   onEmptyClick(Date) click anywhere empty & future (teacher: add time off)
 *   pickDuration  minutes (shows the hover guide for onPickTime)
 *   loading, isDarkMode, headerRight (node)
 */
export default function WeekCalendar({
  weekStart, onWeekChange, free = [], items = [], onPickTime, onEmptyClick, pickDuration = 60,
  loading = false, isDarkMode = false, headerRight = null, emptyText,
}) {
  const dark = isDarkMode;
  const c = {
    card: dark ? "#111827" : "#ffffff", border: dark ? "#1f2937" : "#e5e7eb", line: dark ? "#1b2430" : "#f1f5f9",
    heading: dark ? "#f1f5f9" : "#0f172a", text: dark ? "#cbd5e1" : "#475569", muted: dark ? "#64748b" : "#94a3b8",
    head: dark ? "#0b1220" : "#f8fafc", past: dark ? "rgba(0,0,0,0.25)" : "rgba(148,163,184,0.10)",
  };
  const st = KIND_STYLE(dark);
  const wrapRef = useRef(null), scrollRef = useRef(null);
  const [narrow, setNarrow] = useState(false);
  const [allHours, setAllHours] = useState(false);
  const [hover, setHover] = useState(null); // { di, min }
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const el = wrapRef.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 720));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const weekEnd = addDays(weekStart, 6);
  const label = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // Per-day segments (a block crossing midnight shows on both days)
  const perDay = useMemo(() => days.map(day => ({
    free: free.map(f => { const s = segmentOnDay(f.start, f.end, day); return s && { ...s, src: f }; }).filter(Boolean),
    items: laneLayout(items.map(it => { const s = segmentOnDay(it.start, it.end, day); return s && { ...s, src: it }; }).filter(Boolean)),
  })), [days, free, items]);

  // Hours to show: fit everything this week, at least 8 AM–8 PM
  const [h0, h1] = useMemo(() => {
    if (allHours) return [0, 24];
    let lo = 8 * 60, hi = 20 * 60;
    perDay.forEach(d => [...d.free, ...d.items].forEach(s => { lo = Math.min(lo, s.startMin); hi = Math.max(hi, s.endMin); }));
    return [Math.max(0, Math.floor(lo / 60)), Math.min(24, Math.ceil(hi / 60))];
  }, [perDay, allHours]);
  const hours = Array.from({ length: h1 - h0 }, (_, i) => h0 + i);
  const yOf = (min) => ((min - h0 * 60) / 60) * HOUR_PX;

  useEffect(() => {
    if (!scrollRef.current) return;
    const first = perDay.flatMap(d => [...d.free, ...d.items]).reduce((m, s) => Math.min(m, s.startMin), Infinity);
    const target = isFinite(first) ? first : 8 * 60;
    scrollRef.current.scrollTop = Math.max(0, yOf(target) - 24);
  }, [weekStart, h0, narrow]); // eslint-disable-line react-hooks/exhaustive-deps

  const dateAt = (day, min) => { const d = new Date(day); d.setHours(0, 0, 0, 0); return new Date(d.getTime() + min * 60000); };
  const snap = (min) => Math.floor(min / 30) * 30;

  const nav = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${c.border}`, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button type="button" aria-label="Previous week" onClick={() => onWeekChange(addDays(weekStart, -7))} style={navBtn(c)}><ChevronLeft size={16} /></button>
        <button type="button" onClick={() => onWeekChange(null)} style={{ ...navBtn(c), padding: "6px 12px", fontSize: 13, fontWeight: 700 }}>This week</button>
        <button type="button" aria-label="Next week" onClick={() => onWeekChange(addDays(weekStart, 7))} style={navBtn(c)}><ChevronRight size={16} /></button>
        <span style={{ marginLeft: 8, fontSize: 15, fontWeight: 800, color: c.heading }}>{label}</span>
        {loading && <Loader size={14} style={{ animation: "wc-spin 1s linear infinite", color: c.muted }} />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {!narrow && (
          <button type="button" onClick={() => setAllHours(v => !v)} style={{ ...navBtn(c), padding: "6px 10px", fontSize: 12, fontWeight: 600 }}>
            {allHours ? "Fit to schedule" : "Show all 24 hours"}
          </button>
        )}
        {headerRight}
      </div>
    </div>
  );

  // ── Agenda (phones) ────────────────────────────────────────────────────────
  if (narrow) {
    return (
      <div ref={wrapRef} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, overflow: "hidden" }}>
        <style>{`@keyframes wc-spin{to{transform:rotate(360deg)}}`}</style>
        {nav}
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 14 }}>
          {days.map((day, di) => {
            const rows = [
              ...perDay[di].free.map(s => ({ kind: "free", s })),
              ...perDay[di].items.map(s => ({ kind: s.src.kind, s })),
            ].sort((a, b) => a.s.startMin - b.s.startMin);
            const isToday = sameDay(day, now);
            return (
              <div key={di}>
                <div style={{ fontSize: 13, fontWeight: 800, color: isToday ? BRAND : c.heading, marginBottom: 6 }}>
                  {day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}{isToday ? " · Today" : ""}
                </div>
                {rows.length === 0 ? (
                  <div style={{ fontSize: 12, color: c.muted, padding: "6px 0" }}>{emptyText || "Nothing scheduled"}</div>
                ) : rows.map((r, i) => {
                  const k = st[r.kind] || st.busy;
                  const it = r.kind === "free" ? null : r.s.src;
                  const start = dateAt(day, r.s.startMin), end = dateAt(day, r.s.endMin);
                  const click = r.kind === "free" ? (onPickTime ? () => onPickTime(start) : onEmptyClick ? () => onEmptyClick(start) : null) : it.onClick;
                  return (
                    <button key={i} type="button" onClick={click || undefined} disabled={!click}
                      style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", marginBottom: 6, borderRadius: 10,
                        background: k.bg, border: `1.5px solid ${k.border}`, color: k.text, cursor: click ? "pointer" : "default", fontFamily: "inherit" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{fmtRange(start, end)}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.kind === "free" ? (onPickTime ? "Free · tap to book" : "Free") : `${it.title || k.label}${it.sub ? ` · ${it.sub}` : ""}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Week grid ──────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, overflow: "hidden" }}>
      <style>{`@keyframes wc-spin{to{transform:rotate(360deg)}} .wc-tile{transition:filter .12s, transform .12s} .wc-tile:hover{filter:brightness(1.06);transform:translateY(-1px)}`}</style>
      {nav}
      <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, minmax(0,1fr))", background: c.head, borderBottom: `1px solid ${c.border}` }}>
        <div />
        {days.map((d, i) => {
          const isToday = sameDay(d, now);
          return (
            <div key={i} style={{ padding: "8px 4px", textAlign: "center", borderLeft: `1px solid ${c.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: isToday ? BRAND : c.muted }}>{DAY_SHORT[i]}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? BRAND : c.heading }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} style={{ maxHeight: 620, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, minmax(0,1fr))", position: "relative", height: hours.length * HOUR_PX }}>
          {/* hour labels */}
          <div style={{ position: "relative" }}>
            {hours.map((h, i) => (
              <div key={h} style={{ position: "absolute", top: i * HOUR_PX - 7, right: 8, fontSize: 11, fontWeight: 600, color: c.muted }}>
                {i === 0 ? "" : fmtTime(dateAt(new Date(2000, 0, 1), h * 60)).replace(":00", "")}
              </div>
            ))}
          </div>

          {days.map((day, di) => {
            const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
            const pastMin = now > addDays(dayStart, 1) ? 24 * 60 : now > dayStart ? (now - dayStart) / 60000 : 0;
            const isToday = sameDay(day, now);
            return (
              <div key={di} style={{ position: "relative", borderLeft: `1px solid ${c.border}`,
                  backgroundImage: `repeating-linear-gradient(to bottom, ${c.line} 0 1px, transparent 1px ${HOUR_PX}px)` }}
                onClick={onEmptyClick ? (e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const min = snap(h0 * 60 + ((e.clientY - r.top) / HOUR_PX) * 60);
                  const at = dateAt(day, min);
                  if (at > now) onEmptyClick(at);
                } : undefined}
              >
                {/* past shading */}
                {pastMin > h0 * 60 && (
                  <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: Math.min(yOf(pastMin), hours.length * HOUR_PX), background: c.past, pointerEvents: "none" }} />
                )}

                {/* free bands */}
                {perDay[di].free.map((s, i) => {
                  const pickable = !!onPickTime;
                  return (
                    <div key={`f${i}`} className={pickable ? "wc-tile" : undefined}
                      onMouseMove={pickable ? (e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setHover({ di, min: snap(s.startMin + ((e.clientY - r.top) / HOUR_PX) * 60) });
                      } : undefined}
                      onMouseLeave={pickable ? () => setHover(null) : undefined}
                      onClick={pickable ? (e) => {
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        let min = snap(s.startMin + ((e.clientY - r.top) / HOUR_PX) * 60);
                        min = Math.max(min, Math.ceil(s.startMin / 30) * 30);
                        if (min + pickDuration > s.endMin) min = Math.max(Math.ceil(s.startMin / 30) * 30, Math.floor((s.endMin - pickDuration) / 30) * 30);
                        onPickTime(dateAt(day, min));
                      } : undefined}
                      title={`Free ${fmtRange(s.src.start, s.src.end)}`}
                      style={{ position: "absolute", left: 3, right: 3, top: yOf(s.startMin), height: Math.max(yOf(s.endMin) - yOf(s.startMin), 6),
                        background: st.free.bg, borderLeft: `3px solid ${st.free.border}`, borderRadius: 6, cursor: pickable ? "pointer" : onEmptyClick ? "copy" : "default", zIndex: 1, overflow: "hidden" }}>
                      {yOf(s.endMin) - yOf(s.startMin) > 30 && (
                        <div style={{ padding: "3px 6px", fontSize: 10.5, fontWeight: 800, color: st.free.text }}>
                          Free · {fmtRange(dateAt(day, s.startMin), dateAt(day, s.endMin))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* hover guide for booking */}
                {onPickTime && hover?.di === di && (
                  <div style={{ position: "absolute", left: 3, right: 3, top: yOf(hover.min), height: (pickDuration / 60) * HOUR_PX, border: `2px dashed ${st.free.border}`, borderRadius: 6, zIndex: 2, pointerEvents: "none",
                    display: "flex", alignItems: "flex-start", padding: "2px 6px", fontSize: 11, fontWeight: 800, color: st.free.text, background: dark ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.7)" }}>
                    Book {fmtTime(dateAt(day, hover.min))}
                  </div>
                )}

                {/* items */}
                {perDay[di].items.map((s) => {
                  const it = s.src, k = st[it.kind] || st.busy;
                  const top = yOf(s.startMin), height = Math.max(yOf(s.endMin) - top, 20);
                  const w = 100 / s.lanes;
                  return (
                    <div key={`${it.id}-${di}`} className={it.onClick ? "wc-tile" : undefined}
                      onClick={it.onClick ? (e) => { e.stopPropagation(); it.onClick(); } : (e) => e.stopPropagation()}
                      title={`${it.title || k.label} · ${fmtRange(it.start, it.end)}${it.sub ? ` · ${it.sub}` : ""}`}
                      style={{ position: "absolute", top: top + 1, height: height - 2, left: `calc(${s.lane * w}% + 3px)`, width: `calc(${w}% - 6px)`,
                        background: k.bg, border: `1.5px solid ${k.border}`, color: k.text, borderRadius: 7, padding: "3px 6px", zIndex: 3, overflow: "hidden",
                        cursor: it.onClick ? "pointer" : "default", boxShadow: ["booked", "pending"].includes(it.kind) ? "0 2px 8px rgba(0,0,0,0.12)" : "none" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4 }}>
                        {it.recurring && <Repeat size={9} />}{it.title || k.label}
                      </div>
                      {height > 34 && <div style={{ fontSize: 10, opacity: 0.9, whiteSpace: "nowrap" }}>{fmtRange(it.start, it.end)}</div>}
                      {height > 50 && it.sub && <div style={{ fontSize: 10, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.sub}</div>}
                    </div>
                  );
                })}

                {/* now line */}
                {isToday && pastMin >= h0 * 60 && pastMin <= h1 * 60 && (
                  <div style={{ position: "absolute", left: 0, right: 0, top: yOf(pastMin), height: 2, background: "#ef4444", zIndex: 4, pointerEvents: "none" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const navBtn = (c) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 8, border: `1px solid ${c.border}`, background: "transparent", color: c.heading, cursor: "pointer", fontFamily: "inherit" });
