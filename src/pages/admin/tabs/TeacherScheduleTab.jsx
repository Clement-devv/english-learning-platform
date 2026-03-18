// src/pages/admin/tabs/TeacherScheduleTab.jsx
// Admin view: pick a teacher → see their full weekly schedule (read-only)
import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Search, User,
  Clock, Calendar, BookOpen, Repeat, Loader,
  GraduationCap, Globe,
} from "lucide-react";
import api from "../../../api";
import { tzAbbr, tzCity } from "../../../utils/timezone";

// ── Calendar constants ─────────────────────────────────────────────────────
const HOUR_START  = 6;
const HOUR_END    = 22;
const HOUR_HEIGHT = 72;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const DAY_LABELS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Helpers ────────────────────────────────────────────────────────────────
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function getWeekDays(start) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
function fmt12(t) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
function diffMins(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
function eventPos(startTime, endTime) {
  const [sh, sm] = startTime.split(":").map(Number);
  const top    = (sh - HOUR_START + sm / 60) * HOUR_HEIGHT;
  const height = Math.max(diffMins(startTime, endTime) / 60 * HOUR_HEIGHT, 24);
  return { top, height };
}
function bookingTimes(b) {
  const s = new Date(b.scheduledTime);
  const e = new Date(s.getTime() + (b.duration || 60) * 60000);
  return {
    startTime: `${String(s.getHours()).padStart(2,"0")}:${String(s.getMinutes()).padStart(2,"0")}`,
    endTime:   `${String(e.getHours()).padStart(2,"0")}:${String(e.getMinutes()).padStart(2,"0")}`,
  };
}

// ── Palette ────────────────────────────────────────────────────────────────
function pal(dark) {
  return {
    bg:      dark ? "#0f1117" : "#f4f6fb",
    card:    dark ? "#1a1d27" : "#ffffff",
    border:  dark ? "#1e2235" : "#e8ecf4",
    heading: dark ? "#e2e8f0" : "#1e293b",
    text:    dark ? "#94a3b8" : "#475569",
    muted:   dark ? "#4b5563" : "#94a3b8",
    line:    dark ? "#1e2235" : "#f1f5f9",
    input:   dark ? "#141620" : "#f8faff",
    hover:   dark ? "rgba(255,255,255,0.015)" : "rgba(99,102,241,0.03)",
  };
}

// ── Teacher picker card ────────────────────────────────────────────────────
function TeacherCard({ teacher, onClick, isDarkMode }) {
  const c = pal(isDarkMode);
  const initials = `${teacher.firstName?.[0] || ""}${teacher.lastName?.[0] || ""}`.toUpperCase();
  return (
    <div
      onClick={() => onClick(teacher)}
      style={{
        background: c.card, border: `1px solid ${c.border}`,
        borderRadius: "16px", padding: "20px",
        cursor: "pointer", transition: "all 0.18s",
        display: "flex", flexDirection: "column", gap: "12px",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = isDarkMode ? "0 8px 24px rgba(0,0,0,0.3)" : "0 8px 24px rgba(99,102,241,0.15)"; e.currentTarget.style.borderColor = "#7c3aed"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.borderColor = c.border; }}
    >
      {/* Avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ color: "#fff", fontWeight: "800", fontSize: "15px" }}>{initials}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: "800", fontSize: "14px", color: c.heading, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {teacher.firstName} {teacher.lastName}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "11px", color: c.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {teacher.email}
          </p>
        </div>
      </div>

      {/* Meta pills */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "6px", background: isDarkMode ? "rgba(124,58,237,0.15)" : "#f5f3ff", color: "#7c3aed" }}>
          {teacher.continent || "—"}
        </span>
        {teacher.timezone && (
          <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px", background: isDarkMode ? "rgba(14,165,233,0.12)" : "#f0f9ff", color: "#0284c7", display: "flex", alignItems: "center", gap: "4px" }}>
            <Globe size={9} /> {tzCity(teacher.timezone)} · {tzAbbr(teacher.timezone)}
          </span>
        )}
        <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px", background: teacher.active ? (isDarkMode ? "rgba(16,185,129,0.12)" : "#f0fdf4") : (isDarkMode ? "rgba(239,68,68,0.1)" : "#fef2f2"), color: teacher.active ? "#059669" : "#dc2626" }}>
          {teacher.active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* View schedule button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
        <span style={{ fontSize: "12px", color: c.muted }}>{teacher.lessonsCompleted || 0} lessons done</span>
        <span style={{ fontSize: "12px", fontWeight: "700", color: "#7c3aed", display: "flex", alignItems: "center", gap: "4px" }}>
          View Schedule <ChevronRight size={13} />
        </span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function TeacherScheduleTab({ teachers = [], isDarkMode }) {
  const c = pal(isDarkMode);
  const [search,       setSearch]       = useState("");
  const [selected,     setSelected]     = useState(null); // selected teacher
  const [weekStart,    setWeekStart]    = useState(() => getMonday(new Date()));
  const [availability, setAvailability] = useState([]);
  const [bookings,     setBookings]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [detail,       setDetail]       = useState(null);
  const scrollRef = useRef(null);

  const today    = new Date();
  const weekDays = getWeekDays(weekStart);
  const weekEnd  = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${weekEnd.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;

  // Scroll to 8am on open
  useEffect(() => {
    if (selected && scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = (8 - HOUR_START) * HOUR_HEIGHT - 16;
      }, 50);
    }
  }, [selected]);

  useEffect(() => {
    if (selected) fetchSchedule();
  }, [selected, weekStart]); // eslint-disable-line

  const fetchSchedule = async () => {
    if (!selected?._id) return;
    setLoading(true);
    try {
      const end = new Date(weekStart); end.setDate(weekStart.getDate() + 7);
      const [availRes, acceptedRes, pendingRes] = await Promise.all([
        api.get(`/api/teacher-availability/${selected._id}?startDate=${weekStart.toISOString()}&endDate=${end.toISOString()}`),
        api.get(`/api/bookings/teacher/${selected._id}?status=accepted`),
        api.get(`/api/bookings/teacher/${selected._id}?status=pending`),
      ]);
      setAvailability(availRes.data.availability || []);
      setBookings([...(acceptedRes.data || []), ...(pendingRes.data || [])]);
    } catch { /* silent */ }
    finally  { setLoading(false); }
  };

  const goWeek = (d) => setWeekStart(ws => { const n = new Date(ws); n.setDate(ws.getDate() + d * 7); return n; });
  const goToday = () => setWeekStart(getMonday(new Date()));

  const getEventsForDay = useCallback((date) => {
    const jsDay = date.getDay();
    const now = Date.now();
    const dayBookings = bookings.filter(b => {
      if (!isSameDay(new Date(b.scheduledTime), date)) return false;
      // Hide bookings whose class end time has already passed
      const endMs = new Date(b.scheduledTime).getTime() + (b.duration || 60) * 60000;
      return endMs > now;
    });
    const dayAvail = availability.filter(a =>
      a.isRecurring ? a.dayOfWeek === jsDay : isSameDay(new Date(a.date), date)
    );
    return { dayBookings, dayAvail };
  }, [bookings, availability]);

  // ── Stats for selected teacher this week ──
  const thisWeekBookings = bookings.filter(b => {
    const d = new Date(b.scheduledTime);
    return d >= weekStart && d < weekEnd;
  });
  const confirmedCount = thisWeekBookings.filter(b => b.status === "accepted").length;
  const pendingCount   = thisWeekBookings.filter(b => b.status === "pending").length;
  const occupiedCount  = availability.length;

  // ── Filtered teacher list ──
  const filtered = teachers.filter(t =>
    `${t.firstName} ${t.lastName} ${t.email}`.toLowerCase().includes(search.toLowerCase())
  );

  // ═══════════════════════ TEACHER PICKER VIEW ═══════════════════════
  if (!selected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <style>{`
          @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        `}</style>

        {/* Header */}
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: c.heading }}>Teacher Schedules</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.text }}>
            Select a teacher to view their availability and bookings
          </p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: "360px" }}>
          <Search size={15} color={c.muted} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search teachers…"
            style={{
              width: "100%", padding: "10px 12px 10px 36px",
              background: c.card, border: `1.5px solid ${c.border}`,
              borderRadius: "12px", color: c.heading, fontSize: "13.5px",
              outline: "none", fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Teacher grid */}
        {filtered.length === 0 ? (
          <p style={{ color: c.muted, fontSize: "13px" }}>No teachers found.</p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "16px",
            animation: "fadeIn 0.2s ease",
          }}>
            {filtered.map(t => (
              <TeacherCard key={t._id} teacher={t} onClick={setSelected} isDarkMode={isDarkMode} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════ CALENDAR VIEW ═══════════════════════
  const initials = `${selected.firstName?.[0] || ""}${selected.lastName?.[0] || ""}`.toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .adm-sched-scroll::-webkit-scrollbar{width:5px}
        .adm-sched-scroll::-webkit-scrollbar-thumb{background:${isDarkMode?"#1e2235":"#e0e4f4"};border-radius:4px}
        .adm-tile{transition:filter .15s,transform .15s}
        .adm-tile:hover{filter:brightness(1.1);transform:translateY(-1px);cursor:pointer}
      `}</style>

      {/* ── Back + teacher header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <button
          onClick={() => { setSelected(null); setAvailability([]); setBookings([]); setDetail(null); }}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: isDarkMode ? "#1e2235" : "#f1f5f9", border: `1px solid ${c.border}`, borderRadius: "10px", cursor: "pointer", color: c.heading, fontSize: "13px", fontWeight: "700", fontFamily: "inherit" }}
        >
          <ChevronLeft size={15} /> All Teachers
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: "800", fontSize: "14px" }}>{initials}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: "800", fontSize: "16px", color: c.heading }}>
              {selected.firstName} {selected.lastName}
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: c.muted, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              {selected.email}
              {selected.timezone && (
                <span style={{ background: isDarkMode ? "rgba(14,165,233,0.12)" : "#f0f9ff", color: "#0284c7", borderRadius: "6px", padding: "1px 7px", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", gap: "3px" }}>
                  <Globe size={9} /> {tzCity(selected.timezone)} · {tzAbbr(selected.timezone)}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Stats pills */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            { label: "Confirmed", count: confirmedCount, color: "#7c3aed", bg: isDarkMode ? "rgba(124,58,237,0.15)" : "#f5f3ff" },
            { label: "Pending",   count: pendingCount,   color: "#d97706", bg: isDarkMode ? "rgba(217,119,6,0.15)"  : "#fffbeb" },
            { label: "Occupied",  count: occupiedCount,  color: "#0ea5e9", bg: isDarkMode ? "rgba(14,165,233,0.15)" : "#f0f9ff" },
          ].map(({ label, count, color, bg }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: "10px", padding: "5px 12px", display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color }} />
              <span style={{ fontSize: "13px", fontWeight: "700", color }}>{count}</span>
              <span style={{ fontSize: "11px", color: c.text }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center" }}>
        {[
          { color: "#7c3aed", label: "Confirmed class" },
          { color: "#d97706", label: "Pending request" },
          { color: "#0ea5e9", label: "Occupied slot" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: color }} />
            <span style={{ fontSize: "12px", color: c.text }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize: "12px", color: c.muted, marginLeft: "auto" }}>
          Empty cells = teacher is FREE
        </span>
      </div>

      {/* ── Week navigator ── */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: isDarkMode ? "none" : "0 2px 12px rgba(0,0,0,0.05)" }}>
        <button onClick={() => goWeek(-1)} style={{ background: isDarkMode ? "#1e2235" : "#f8faff", border: `1px solid ${c.border}`, borderRadius: "10px", padding: "7px 10px", cursor: "pointer", color: c.heading, display: "flex", alignItems: "center" }}>
          <ChevronLeft size={17} />
        </button>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: c.heading }}>{weekLabel}</p>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", marginTop: "2px" }}>
              <Loader size={10} style={{ animation: "spin 1s linear infinite", color: "#7c3aed" }} />
              <span style={{ fontSize: "11px", color: "#7c3aed" }}>Loading…</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={goToday} style={{ background: isDarkMode ? "#1e2235" : "#f8faff", border: `1px solid ${c.border}`, borderRadius: "10px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: "700", color: c.heading }}>Today</button>
          <button onClick={() => goWeek(1)} style={{ background: isDarkMode ? "#1e2235" : "#f8faff", border: `1px solid ${c.border}`, borderRadius: "10px", padding: "7px 10px", cursor: "pointer", color: c.heading, display: "flex", alignItems: "center" }}>
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "20px", overflow: "hidden", boxShadow: isDarkMode ? "none" : "0 4px 24px rgba(0,0,0,0.07)", animation: "fadeIn 0.2s ease" }}>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7,1fr)", borderBottom: `2px solid ${c.border}`, background: isDarkMode ? "#141620" : "#fafbff", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ borderRight: `1px solid ${c.border}` }} />
          {weekDays.map((day, i) => {
            const isToday   = isSameDay(day, today);
            const isWeekend = i >= 5;
            return (
              <div key={i} style={{ padding: "12px 6px", textAlign: "center", borderRight: i < 6 ? `1px solid ${c.border}` : "none", background: isToday ? (isDarkMode ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.05)") : "transparent" }}>
                <p style={{ margin: 0, fontSize: "10px", fontWeight: "700", color: isToday ? "#7c3aed" : c.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{DAY_LABELS[i]}</p>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", margin: "3px auto 0", display: "flex", alignItems: "center", justifyContent: "center", background: isToday ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "transparent" }}>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: isToday ? "#fff" : isWeekend ? c.text : c.heading }}>{day.getDate()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable time grid */}
        <div ref={scrollRef} className="adm-sched-scroll" style={{ overflowY: "auto", maxHeight: "560px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7,1fr)", position: "relative", height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>

            {/* Time labels */}
            <div style={{ borderRight: `1px solid ${c.border}`, position: "relative", zIndex: 2 }}>
              {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                const hour = HOUR_START + i;
                const ampm = hour >= 12 ? "PM" : "AM";
                const h12  = hour === 12 ? 12 : hour > 12 ? hour - 12 : hour;
                return (
                  <div key={i} style={{ position: "absolute", top: `${i * HOUR_HEIGHT}px`, width: "100%", height: `${HOUR_HEIGHT}px`, display: "flex", alignItems: "flex-start", paddingTop: "6px", paddingRight: "8px", justifyContent: "flex-end", borderBottom: `1px solid ${c.line}` }}>
                    <span style={{ fontSize: "10px", fontWeight: "700", color: c.muted, letterSpacing: "0.04em" }}>{h12}<span style={{ fontSize: "9px" }}>{ampm}</span></span>
                  </div>
                );
              })}
            </div>

            {/* 7 day columns */}
            {weekDays.map((day, di) => {
              const { dayBookings, dayAvail } = getEventsForDay(day);
              const isToday   = isSameDay(day, today);
              const isWeekend = di >= 5;

              return (
                <div key={di} style={{ position: "relative", borderRight: di < 6 ? `1px solid ${c.border}` : "none", background: isToday ? (isDarkMode ? "rgba(124,58,237,0.02)" : "rgba(124,58,237,0.012)") : isWeekend ? (isDarkMode ? "rgba(255,255,255,0.004)" : "rgba(0,0,0,0.007)") : "transparent" }}>

                  {/* Hour rows */}
                  {Array.from({ length: TOTAL_HOURS }, (_, hi) => (
                    <div key={hi} style={{ position: "absolute", top: `${hi * HOUR_HEIGHT}px`, width: "100%", height: `${HOUR_HEIGHT}px`, borderBottom: `1px solid ${c.line}` }}>
                      <div style={{ position: "absolute", top: "50%", left: "4px", right: "4px", height: "1px", background: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", pointerEvents: "none" }} />
                    </div>
                  ))}

                  {/* Current-time indicator */}
                  {isToday && (() => {
                    const now  = new Date();
                    const mins = (now.getHours() - HOUR_START) * 60 + now.getMinutes();
                    if (mins < 0 || mins > TOTAL_HOURS * 60) return null;
                    return (
                      <div style={{ position: "absolute", top: `${(mins / 60) * HOUR_HEIGHT}px`, left: 0, right: 0, zIndex: 5, pointerEvents: "none" }}>
                        <div style={{ height: "2px", background: "#ef4444", boxShadow: "0 0 6px rgba(239,68,68,0.5)", position: "relative" }}>
                          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444", position: "absolute", left: "-3px", top: "-2.5px" }} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Occupied (availability) tiles ── */}
                  {dayAvail.map(avail => {
                    const { top, height } = eventPos(avail.startTime, avail.endTime);
                    return (
                      <div key={avail._id} className="adm-tile"
                        onClick={() => setDetail({ type: "avail", data: avail })}
                        style={{
                          position: "absolute", top: `${top + 2}px`, left: "3px", right: "3px", height: `${height - 4}px`,
                          background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
                          borderRadius: "8px", padding: "4px 6px", zIndex: 3, overflow: "hidden",
                          boxShadow: "0 2px 8px rgba(14,165,233,0.25)",
                          border: "1px solid rgba(14,165,233,0.3)",
                        }}>
                        <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.2)", borderRadius: "3px", padding: "1px 4px", marginBottom: "1px" }}>
                          <span style={{ fontSize: "8px", fontWeight: "800", color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em" }}>Occupied</span>
                        </div>
                        {height > 32 && (
                          <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.9)" }}>
                            {fmt12(avail.startTime)}–{fmt12(avail.endTime)}
                          </p>
                        )}
                        {avail.isRecurring && height > 50 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "2px", marginTop: "1px" }}>
                            <Repeat size={8} color="rgba(255,255,255,0.7)" />
                            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.7)" }}>Weekly</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* ── Booking tiles ── */}
                  {dayBookings.map(booking => {
                    const { startTime, endTime } = bookingTimes(booking);
                    const { top, height } = eventPos(startTime, endTime);
                    const isAcc = booking.status === "accepted";
                    const sName = booking.studentId?.firstName
                      ? `${booking.studentId.firstName} ${booking.studentId.surname || ""}`.trim()
                      : "Student";
                    return (
                      <div key={booking._id} className="adm-tile"
                        onClick={() => setDetail({ type: "booking", data: booking })}
                        style={{
                          position: "absolute", top: `${top + 2}px`, left: "3px", right: "3px", height: `${height - 4}px`,
                          background: isAcc ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "linear-gradient(135deg,#d97706,#b45309)",
                          borderRadius: "8px", padding: "4px 6px", zIndex: 4, overflow: "hidden",
                          boxShadow: isAcc ? "0 2px 8px rgba(124,58,237,0.3)" : "0 2px 8px rgba(217,119,6,0.25)",
                        }}>
                        <p style={{ margin: 0, fontSize: "10px", fontWeight: "800", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {booking.classTitle || "Class"}
                        </p>
                        {height > 32 && (
                          <p style={{ margin: 0, fontSize: "9px", color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: "2px" }}>
                            <GraduationCap size={8} /> {sName}
                          </p>
                        )}
                        {height > 50 && (
                          <p style={{ margin: "1px 0 0", fontSize: "9px", color: "rgba(255,255,255,0.75)" }}>
                            {fmt12(startTime)}–{fmt12(endTime)}
                          </p>
                        )}
                        {!isAcc && height > 64 && (
                          <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.2)", borderRadius: "3px", padding: "1px 4px", marginTop: "1px" }}>
                            <span style={{ fontSize: "8px", fontWeight: "800", color: "#fff" }}>PENDING</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═════════════ DETAIL MODAL ═════════════ */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
          onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "20px", width: "100%", maxWidth: "380px", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden", animation: "fadeIn 0.2s ease" }}>

            {detail.type === "avail" ? (() => {
              const a = detail.data;
              return (
                <>
                  <div style={{ background: "linear-gradient(135deg,#0ea5e9,#0284c7)", padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ display: "inline-flex", background: "rgba(255,255,255,0.2)", borderRadius: "5px", padding: "2px 8px", marginBottom: "6px" }}>
                        <span style={{ fontSize: "10px", fontWeight: "800", color: "#fff", textTransform: "uppercase" }}>Occupied Slot</span>
                      </span>
                      <p style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#fff" }}>{fmt12(a.startTime)} – {fmt12(a.endTime)}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>{diffMins(a.startTime, a.endTime)} min · {a.isRecurring ? `Every ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][a.dayOfWeek]}` : new Date(a.date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
                    </div>
                    <button onClick={() => setDetail(null)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "8px", padding: "6px", cursor: "pointer", color: "#fff", display: "flex" }}>✕</button>
                  </div>
                  <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {[
                      { icon: Clock,    label: "Duration", val: `${diffMins(a.startTime, a.endTime)} minutes` },
                      ...(a.timezone ? [{ icon: Globe, label: "Teacher timezone", val: `${tzCity(a.timezone)} (${tzAbbr(a.timezone)})` }] : []),
                      ...(a.note       ? [{ icon: BookOpen, label: "Note", val: a.note }] : []),
                    ].map(({ icon: Icon, label, val }) => (
                      <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: isDarkMode ? "rgba(14,165,233,0.12)" : "#f0f9ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={12} color="#0ea5e9" />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: "10px", fontWeight: "700", color: c.muted, textTransform: "uppercase" }}>{label}</p>
                          <p style={{ margin: "2px 0 0", fontSize: "13px", fontWeight: "600", color: c.heading }}>{val}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })() : (() => {
              const b = detail.data;
              const { startTime, endTime } = bookingTimes(b);
              const isAcc = b.status === "accepted";
              const sName = b.studentId?.firstName
                ? `${b.studentId.firstName} ${b.studentId.surname || ""}`.trim()
                : "Student";
              return (
                <>
                  <div style={{ background: isAcc ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "linear-gradient(135deg,#d97706,#b45309)", padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ display: "inline-flex", background: "rgba(255,255,255,0.2)", borderRadius: "5px", padding: "2px 8px", marginBottom: "6px" }}>
                        <span style={{ fontSize: "10px", fontWeight: "800", color: "#fff", textTransform: "uppercase" }}>{b.status}</span>
                      </span>
                      <p style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#fff" }}>{b.classTitle || "Class"}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>{fmt12(startTime)} – {fmt12(endTime)}</p>
                    </div>
                    <button onClick={() => setDetail(null)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "8px", padding: "6px", cursor: "pointer", color: "#fff", display: "flex" }}>✕</button>
                  </div>
                  <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {[
                      { icon: User,     label: "Student",  val: sName },
                      { icon: Calendar, label: "Date",     val: new Date(b.scheduledTime).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}) },
                      { icon: Clock,    label: "Time",     val: `${fmt12(startTime)} – ${fmt12(endTime)}` },
                      { icon: Clock,    label: "Duration", val: `${b.duration || 60} minutes` },
                      ...(b.teacherTimezone ? [{ icon: Globe, label: "Teacher timezone", val: `${tzCity(b.teacherTimezone)} (${tzAbbr(b.teacherTimezone)})` }] : []),
                      ...(b.studentTimezone ? [{ icon: Globe, label: "Student timezone", val: `${tzCity(b.studentTimezone)} (${tzAbbr(b.studentTimezone)})` }] : []),
                      ...(b.topic ? [{ icon: BookOpen, label: "Topic", val: b.topic }] : []),
                    ].map(({ icon: Icon, label, val }) => (
                      <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: isDarkMode ? "rgba(124,58,237,0.12)" : "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={12} color="#7c3aed" />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: "10px", fontWeight: "700", color: c.muted, textTransform: "uppercase" }}>{label}</p>
                          <p style={{ margin: "2px 0 0", fontSize: "13px", fontWeight: "600", color: c.heading }}>{val}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
