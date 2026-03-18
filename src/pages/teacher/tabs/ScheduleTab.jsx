// src/pages/teacher/tabs/ScheduleTab.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2,
  Clock, User, BookOpen, Calendar, Check, Repeat,
  AlertCircle, Loader, GraduationCap,
} from "lucide-react";
import api from "../../../api";
import { getUserTimezone, tzAbbr, tzCity } from "../../../utils/timezone";

// ── Calendar constants ────────────────────────────────────────────────────────
const HOUR_START   = 6;
const HOUR_END     = 22;
const HOUR_HEIGHT  = 80;   // px per hour
const TOTAL_HOURS  = HOUR_END - HOUR_START;
const DAY_LABELS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DURATIONS    = [25, 30, 45, 60, 90, 120];

// Build all 15-min-increment time options between HOUR_START and HOUR_END
const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === HOUR_END && m > 0) break;
      opts.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
    }
  }
  return opts;
})();

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
}
function addMins(timeStr, mins) {
  const [h, m] = timeStr.split(":").map(Number);
  const total  = h * 60 + m + mins;
  const nh     = Math.min(Math.floor(total / 60), HOUR_END);
  const nm     = nh === HOUR_END ? 0 : total % 60;
  return `${String(nh).padStart(2,"0")}:${String(nm).padStart(2,"0")}`;
}
function diffMins(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
function eventPos(startTime, endTime) {
  const [sh, sm] = startTime.split(":").map(Number);
  const top    = (sh - HOUR_START + sm / 60) * HOUR_HEIGHT;
  const height = Math.max(diffMins(startTime, endTime) / 60 * HOUR_HEIGHT, 28);
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
// Snap a raw minute value to nearest 15
function snapTo15(rawMinute) { return Math.round(rawMinute / 15) * 15; }

// ── Palette ───────────────────────────────────────────────────────────────────
function pal(dark) {
  return {
    bg:       dark ? "#0f1117" : "#f4f6fb",
    card:     dark ? "#1a1d27" : "#ffffff",
    border:   dark ? "#1e2235" : "#e8ecf4",
    heading:  dark ? "#e2e8f0" : "#1e293b",
    text:     dark ? "#94a3b8" : "#475569",
    muted:    dark ? "#4b5563" : "#94a3b8",
    line:     dark ? "#1e2235" : "#f1f5f9",
    input:    dark ? "#141620" : "#f8faff",
    colHover: dark ? "rgba(255,255,255,0.015)" : "rgba(124,58,237,0.025)",
  };
}

// ── Shared select style ───────────────────────────────────────────────────────
function selStyle(c, accent = c.border) {
  return {
    width: "100%", padding: "10px 12px",
    background: c.input, border: `1.5px solid ${accent}`,
    borderRadius: "10px", color: c.heading,
    fontSize: "13.5px", fontWeight: "600",
    outline: "none", fontFamily: "inherit", cursor: "pointer",
    appearance: "none", WebkitAppearance: "none",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ScheduleTab({
  teacherInfo,
  isDarkMode,
  classes   = [],   // accepted bookings
  bookings  = [],   // pending bookings
  students  = [],
}) {
  const c  = pal(isDarkMode);
  const myTZ     = getUserTimezone();
  const myAbbr   = tzAbbr(myTZ);
  const myCity   = tzCity(myTZ);

  const [weekStart,    setWeekStart]    = useState(() => getMonday(new Date()));
  const [scheduleVisible, setScheduleVisible] = useState(
    teacherInfo?.showScheduleToStudents !== false // default true
  );
  const [togglingVis, setTogglingVis] = useState(false);
  const [availability, setAvailability] = useState([]);
  const [loading,      setLoading]      = useState(false);

  // Add-slot modal state
  const DEFAULT_FORM = { startTime: "09:00", endTime: "10:00", selectedDuration: 60, studentId: "", isRecurring: false, note: "" };
  const [addModal,  setAddModal]  = useState(null); // { date }
  const [addForm,   setAddForm]   = useState(DEFAULT_FORM);
  const [saving,    setSaving]    = useState(false);

  // Detail panel
  const [detail, setDetail] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);

  const scrollRef = useRef(null);

  // Scroll to 8 AM on mount
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = (8 - HOUR_START) * HOUR_HEIGHT - 16;
  }, []);

  useEffect(() => { fetchAvailability(); }, [weekStart, teacherInfo?._id]); // eslint-disable-line

  const fetchAvailability = async () => {
    if (!teacherInfo?._id) return;
    setLoading(true);
    try {
      const end = new Date(weekStart); end.setDate(weekStart.getDate() + 7);
      const { data } = await api.get(
        `/api/teacher-availability/${teacherInfo._id}?startDate=${weekStart.toISOString()}&endDate=${end.toISOString()}`
      );
      setAvailability(data.availability || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const goWeek = d => setWeekStart(ws => { const n = new Date(ws); n.setDate(ws.getDate() + d * 7); return n; });
  const goToday = () => setWeekStart(getMonday(new Date()));

  const weekDays = getWeekDays(weekStart);
  const today    = new Date();
  const weekEnd  = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${weekEnd.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;

  // ── Events for a day ──────────────────────────────────────────────────────
  const getEventsForDay = useCallback((date) => {
    const jsDay  = date.getDay();
    const DONE = ["completed", "cancelled", "rejected", "missed"];
    const now  = Date.now();
    const dayBookings = [...classes, ...bookings].filter(b => {
      if (DONE.includes(b.status)) return false;
      if (!isSameDay(new Date(b.scheduledTime), date)) return false;
      // Hide if the class end time has already passed (stale "accepted" bookings)
      const endMs = new Date(b.scheduledTime).getTime() + (b.duration || 60) * 60000;
      return endMs > now;
    });
    const dayAvail    = availability.filter(a => a.isRecurring ? a.dayOfWeek === jsDay : isSameDay(new Date(a.date), date));
    return { dayBookings, dayAvail };
  }, [classes, bookings, availability]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const allThisWeek    = [...classes, ...bookings].filter(b => { const d = new Date(b.scheduledTime); return d >= weekStart && d < weekEnd; });
  const confirmedCount = allThisWeek.filter(b => b.status === "accepted").length;
  const pendingCount   = allThisWeek.filter(b => b.status === "pending").length;
  const occupiedCount  = availability.length;

  // ── Cell click — snap to nearest 15 min within the hour cell ─────────────
  const handleCellClick = (e, date, hour) => {
    e.stopPropagation();
    const rect      = e.currentTarget.getBoundingClientRect();
    const relY      = e.clientY - rect.top;
    const rawMinute = (relY / HOUR_HEIGHT) * 60;
    const minute    = Math.min(snapTo15(rawMinute), 45);
    const hStr = String(hour).padStart(2,"0");
    const mStr = String(minute).padStart(2,"0");
    const startTime = `${hStr}:${mStr}`;
    const endTime   = addMins(startTime, 60);
    setAddForm({ ...DEFAULT_FORM, startTime, endTime, selectedDuration: 60 });
    setAddModal({ date });
    setDetail(null);
  };

  // When start time changes, maintain the selected duration
  const handleStartChange = (val) => {
    const endTime = addMins(val, addForm.selectedDuration);
    setAddForm(f => ({ ...f, startTime: val, endTime }));
  };

  // When duration button is clicked
  const handleDuration = (mins) => {
    const endTime = addMins(addForm.startTime, mins);
    setAddForm(f => ({ ...f, selectedDuration: mins, endTime }));
  };

  // When end time is changed manually, clear duration highlight
  const handleEndChange = (val) => {
    const d = diffMins(addForm.startTime, val);
    setAddForm(f => ({ ...f, endTime: val, selectedDuration: DURATIONS.includes(d) ? d : null }));
  };

  const addFormErr = addForm.startTime >= addForm.endTime;

  // ── Conflict detection ────────────────────────────────────────────────────
  const checkConflict = useCallback((date, startTime, endTime) => {
    const jsDay = date.getDay();
    for (const a of availability) {
      const sameDay = a.isRecurring
        ? a.dayOfWeek === jsDay
        : isSameDay(new Date(a.date), date);
      if (!sameDay) continue;
      if (startTime < a.endTime && endTime > a.startTime) {
        return `Conflicts with occupied slot ${fmt12(a.startTime)}–${fmt12(a.endTime)}`;
      }
    }
    for (const b of [...classes, ...bookings]) {
      if (!isSameDay(new Date(b.scheduledTime), date)) continue;
      const { startTime: bS, endTime: bE } = bookingTimes(b);
      if (startTime < bE && endTime > bS) {
        return `Conflicts with ${b.status === "accepted" ? "confirmed" : "pending"} class ${fmt12(bS)}–${fmt12(bE)}`;
      }
    }
    return null;
  }, [availability, classes, bookings]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!teacherInfo?._id || !addModal || addFormErr) return;
    const conflict = checkConflict(addModal.date, addForm.startTime, addForm.endTime);
    if (conflict) { showToast(conflict, "error"); return; }
    setSaving(true);
    try {
      await api.post("/api/teacher-availability", {
        teacherId:   teacherInfo._id,
        studentId:   addForm.studentId || null,
        date:        addModal.date.toISOString(),
        dayOfWeek:   addModal.date.getDay(),
        startTime:   addForm.startTime,
        endTime:     addForm.endTime,
        isRecurring: addForm.isRecurring,
        note:        addForm.note,
        timezone:    myTZ,
      });
      setAddModal(null);
      showToast("Schedule slot added!");
      fetchAvailability();
    } catch (err) {
      const msg = err?.response?.data?.message;
      showToast(msg || "Failed to save slot", "error");
    }
    finally  { setSaving(false); }
  };

  // ── Delete availability ───────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/teacher-availability/${id}`);
      showToast("Slot removed");
      fetchAvailability();
      setDetail(null);
    } catch { showToast("Failed to remove", "error"); }
  };

  // ── Toggle schedule visibility ───────────────────────────────────────────
  const toggleVisibility = async () => {
    if (!teacherInfo?._id || togglingVis) return;
    setTogglingVis(true);
    const next = !scheduleVisible;
    try {
      await api.patch(`/api/teachers/${teacherInfo._id}/schedule-visibility`, {
        showScheduleToStudents: next,
      });
      setScheduleVisible(next);
      showToast(next ? "Schedule now visible to students" : "Schedule hidden from students");
    } catch {
      showToast("Failed to update visibility", "error");
    } finally {
      setTogglingVis(false);
    }
  };

  // ── Look up student ───────────────────────────────────────────────────────
  const findStudent = useCallback((id) => {
    if (!id) return null;
    return students.find(s => String(s._id) === String(id?._id || id));
  }, [students]);

  const bookingStudentName = useCallback((b) => {
    const id = b.studentId?._id || b.studentId;
    const s  = findStudent(id);
    if (s) return `${s.firstName} ${s.surname || ""}`.trim();
    if (b.studentId?.firstName) return `${b.studentId.firstName} ${b.studentId.surname||""}`.trim();
    return "Student";
  }, [findStudent]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"20px", fontFamily:"Plus Jakarta Sans, sans-serif" }}>

      {/* ── Global styles ── */}
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .sched-scroll::-webkit-scrollbar{width:5px}
        .sched-scroll::-webkit-scrollbar-thumb{background:${isDarkMode?"#1e2235":"#e0e4f4"};border-radius:4px}
        .time-cell:hover{background:${c.colHover}!important;cursor:pointer}
        .avail-tile{transition:filter .15s,transform .15s,box-shadow .15s}
        .avail-tile:hover{filter:brightness(1.1);transform:translateY(-1px)!important;box-shadow:0 6px 18px rgba(124,58,237,0.35)!important}
        .booking-tile{transition:filter .15s,transform .15s}
        .booking-tile:hover{filter:brightness(1.08);transform:translateY(-1px)}
        .dur-btn{transition:all .15s;cursor:pointer}
        .dur-btn:hover{transform:translateY(-1px)}
        select option{background:${isDarkMode?"#1a1d27":"#fff"};color:${c.heading}}
      `}</style>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position:"fixed", top:"20px", right:"20px", zIndex:9999,
          background: toast.type==="error" ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#7c3aed,#6d28d9)",
          color:"#fff", borderRadius:"12px", padding:"12px 20px",
          fontSize:"13.5px", fontWeight:"600",
          boxShadow:"0 8px 32px rgba(0,0,0,0.2)",
          display:"flex", alignItems:"center", gap:"8px",
          animation:"fadeIn 0.25s ease",
        }}>
          {toast.type==="error" ? <AlertCircle size={15}/> : <Check size={15}/>} {toast.msg}
        </div>
      )}

      {/* ── Page header ── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <h1 style={{ margin:0, fontSize:"22px", fontWeight:"800", color:c.heading }}>My Schedule</h1>
          <p style={{ margin:"4px 0 0", fontSize:"13px", color:c.text, display:"flex", alignItems:"center", gap:"7px", flexWrap:"wrap" }}>
            Block out your time and assign students to sessions
            <span style={{ background:isDarkMode?"rgba(14,165,233,0.15)":"#e0f2fe", color:"#0284c7", borderRadius:"6px", padding:"2px 8px", fontSize:"11px", fontWeight:"700" }}>
              🌍 {myCity} · {myAbbr}
            </span>
          </p>
        </div>

        {/* Visibility toggle */}
        <div
          onClick={toggleVisibility}
          title={scheduleVisible ? "Click to hide schedule from students" : "Click to show schedule to students"}
          style={{
            display:"flex", alignItems:"center", gap:"10px",
            padding:"8px 14px",
            background: scheduleVisible
              ? (isDarkMode ? "rgba(16,185,129,0.12)" : "#f0fdf4")
              : (isDarkMode ? "rgba(239,68,68,0.1)"  : "#fef2f2"),
            border: `1.5px solid ${scheduleVisible ? "#10b981" : "#ef4444"}`,
            borderRadius:"12px", cursor: togglingVis ? "wait" : "pointer",
            transition:"all 0.2s",
          }}
        >
          {/* Toggle pill */}
          <div style={{
            width:"36px", height:"20px", borderRadius:"10px",
            background: scheduleVisible ? "#10b981" : "#ef4444",
            position:"relative", transition:"background 0.2s", flexShrink:0,
          }}>
            <div style={{
              width:"14px", height:"14px", borderRadius:"50%", background:"#fff",
              position:"absolute", top:"3px",
              left: scheduleVisible ? "19px" : "3px",
              transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
            }}/>
          </div>
          <div>
            <p style={{ margin:0, fontSize:"12px", fontWeight:"800", color: scheduleVisible ? "#059669" : "#dc2626" }}>
              {togglingVis ? "Updating…" : scheduleVisible ? "Visible to students" : "Hidden from students"}
            </p>
            <p style={{ margin:0, fontSize:"10px", color:c.muted }}>
              {scheduleVisible ? "Students can see your schedule" : "Students cannot see your schedule"}
            </p>
          </div>
        </div>

        {/* Stats pills */}
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          {[
            { label:"Confirmed", count:confirmedCount, color:"#7c3aed", bg:isDarkMode?"rgba(124,58,237,0.15)":"#f5f3ff" },
            { label:"Pending",   count:pendingCount,   color:"#d97706", bg:isDarkMode?"rgba(217,119,6,0.15)":"#fffbeb"  },
            { label:"Occupied",  count:occupiedCount,  color:"#0ea5e9", bg:isDarkMode?"rgba(14,165,233,0.15)":"#f0f9ff" },
          ].map(({ label, count, color, bg }) => (
            <div key={label} style={{ background:bg, border:`1px solid ${color}30`, borderRadius:"10px", padding:"6px 14px", display:"flex", alignItems:"center", gap:"6px" }}>
              <span style={{ width:"7px", height:"7px", borderRadius:"50%", background:color }} />
              <span style={{ fontSize:"13px", fontWeight:"700", color }}>{count}</span>
              <span style={{ fontSize:"12px", color:c.text }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Week navigator ── */}
      <div style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:"16px", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:isDarkMode?"none":"0 2px 12px rgba(0,0,0,0.05)" }}>
        <button onClick={()=>goWeek(-1)} style={{ background:isDarkMode?"#1e2235":"#f8faff", border:`1px solid ${c.border}`, borderRadius:"10px", padding:"8px 12px", cursor:"pointer", color:c.heading, display:"flex", alignItems:"center" }}>
          <ChevronLeft size={18}/>
        </button>
        <div style={{ textAlign:"center" }}>
          <p style={{ margin:0, fontSize:"16px", fontWeight:"800", color:c.heading }}>{weekLabel}</p>
          {loading && <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"5px", marginTop:"3px" }}><Loader size={11} style={{ animation:"spin 1s linear infinite", color:"#7c3aed" }}/><span style={{ fontSize:"11px", color:"#7c3aed" }}>Loading…</span></div>}
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={goToday} style={{ background:isDarkMode?"#1e2235":"#f8faff", border:`1px solid ${c.border}`, borderRadius:"10px", padding:"8px 16px", cursor:"pointer", fontSize:"13px", fontWeight:"700", color:c.heading }}>Today</button>
          <button onClick={()=>goWeek(1)} style={{ background:isDarkMode?"#1e2235":"#f8faff", border:`1px solid ${c.border}`, borderRadius:"10px", padding:"8px 12px", cursor:"pointer", color:c.heading, display:"flex", alignItems:"center" }}>
            <ChevronRight size={18}/>
          </button>
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ display:"flex", gap:"20px", flexWrap:"wrap", alignItems:"center" }}>
        {[
          { color:"#7c3aed", radius:"3px", label:"Confirmed class" },
          { color:"#d97706", radius:"3px", label:"Pending request" },
          { color:"#0ea5e9", radius:"3px", label:"Occupied (your schedule)" },
        ].map(({ color, radius, label }) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:"7px" }}>
            <span style={{ width:"10px", height:"10px", borderRadius:radius, background:color }}/>
            <span style={{ fontSize:"12px", color:c.text }}>{label}</span>
          </div>
        ))}
        <span style={{ marginLeft:"auto", fontSize:"12px", color:c.muted, display:"flex", alignItems:"center", gap:"5px" }}>
          <Plus size={11} color={c.muted}/> Click any empty slot to mark as occupied
        </span>
      </div>

      {/* ── Calendar ── */}
      <div style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:"20px", overflow:"hidden", boxShadow:isDarkMode?"none":"0 4px 24px rgba(0,0,0,0.07)" }}>

        {/* Day headers */}
        <div style={{ display:"grid", gridTemplateColumns:"64px repeat(7,1fr)", borderBottom:`2px solid ${c.border}`, background:isDarkMode?"#141620":"#fafbff", position:"sticky", top:0, zIndex:10 }}>
          <div style={{ borderRight:`1px solid ${c.border}` }}/>
          {weekDays.map((day, i) => {
            const isToday   = isSameDay(day, today);
            const isWeekend = i >= 5;
            return (
              <div key={i} style={{ padding:"14px 8px", textAlign:"center", borderRight:i<6?`1px solid ${c.border}`:"none", background:isToday?(isDarkMode?"rgba(124,58,237,0.12)":"rgba(124,58,237,0.05)"):isWeekend?(isDarkMode?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.01)"):"transparent" }}>
                <p style={{ margin:0, fontSize:"11px", fontWeight:"700", color:isToday?"#7c3aed":c.muted, textTransform:"uppercase", letterSpacing:"0.07em" }}>{DAY_LABELS[i]}</p>
                <div style={{ width:"36px", height:"36px", borderRadius:"50%", margin:"4px auto 0", display:"flex", alignItems:"center", justifyContent:"center", background:isToday?"linear-gradient(135deg,#7c3aed,#6d28d9)":"transparent", boxShadow:isToday?"0 4px 12px rgba(124,58,237,0.4)":"none" }}>
                  <span style={{ fontSize:"18px", fontWeight:"800", color:isToday?"#fff":isWeekend?c.text:c.heading, lineHeight:1 }}>{day.getDate()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable time grid */}
        <div ref={scrollRef} className="sched-scroll" style={{ overflowY:"auto", maxHeight:"580px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"64px repeat(7,1fr)", position:"relative", height:`${TOTAL_HOURS * HOUR_HEIGHT}px` }}>

            {/* Time labels */}
            <div style={{ borderRight:`1px solid ${c.border}`, position:"relative", zIndex:2 }}>
              {Array.from({ length:TOTAL_HOURS }, (_,i) => {
                const hour = HOUR_START + i;
                const ampm = hour >= 12 ? "PM" : "AM";
                const h12  = hour===12?12:hour>12?hour-12:hour;
                return (
                  <div key={i} style={{ position:"absolute", top:`${i*HOUR_HEIGHT}px`, width:"100%", height:`${HOUR_HEIGHT}px`, display:"flex", alignItems:"flex-start", paddingTop:"7px", paddingRight:"10px", justifyContent:"flex-end", borderBottom:`1px solid ${c.line}` }}>
                    <span style={{ fontSize:"11px", fontWeight:"700", color:c.muted, letterSpacing:"0.04em" }}>{h12}<span style={{ fontSize:"9px" }}>{ampm}</span></span>
                  </div>
                );
              })}
            </div>

            {/* 7 day columns */}
            {weekDays.map((day, di) => {
              const { dayBookings, dayAvail } = getEventsForDay(day);
              const isPast    = day < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const isToday   = isSameDay(day, today);
              const isWeekend = di >= 5;

              return (
                <div key={di} style={{ position:"relative", borderRight:di<6?`1px solid ${c.border}`:"none", background:isToday?(isDarkMode?"rgba(124,58,237,0.025)":"rgba(124,58,237,0.015)"):isWeekend?(isDarkMode?"rgba(255,255,255,0.004)":"rgba(0,0,0,0.007)"):"transparent" }}>

                  {/* Hour-click cells */}
                  {Array.from({ length:TOTAL_HOURS }, (_,hi) => (
                    <div key={hi} className={isPast?"":"time-cell"} onClick={isPast?undefined:(e)=>handleCellClick(e,day,HOUR_START+hi)}
                      style={{ position:"absolute", top:`${hi*HOUR_HEIGHT}px`, width:"100%", height:`${HOUR_HEIGHT}px`, borderBottom:`1px solid ${c.line}`, transition:"background 0.12s", opacity:isPast?0.45:1, cursor:isPast?"default":"pointer" }}
                    >
                      {/* Half-hour hairline */}
                      <div style={{ position:"absolute", top:"50%", left:"6px", right:"6px", height:"1px", background:isDarkMode?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)", pointerEvents:"none" }}/>
                    </div>
                  ))}

                  {/* Current-time indicator */}
                  {isToday && (() => {
                    const now = new Date();
                    const mins = (now.getHours() - HOUR_START)*60 + now.getMinutes();
                    if (mins < 0 || mins > TOTAL_HOURS*60) return null;
                    return (
                      <div style={{ position:"absolute", top:`${(mins/60)*HOUR_HEIGHT}px`, left:0, right:0, zIndex:5, pointerEvents:"none" }}>
                        <div style={{ height:"2px", background:"#ef4444", boxShadow:"0 0 6px rgba(239,68,68,0.5)", position:"relative" }}>
                          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#ef4444", position:"absolute", left:"-4px", top:"-3px" }}/>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Occupied (teacher availability) tiles ── */}
                  {dayAvail.map(avail => {
                    const { top, height } = eventPos(avail.startTime, avail.endTime);
                    const student = findStudent(avail.studentId);
                    const hasStudent = !!student;
                    return (
                      <div key={avail._id} className="avail-tile"
                        onClick={e => { e.stopPropagation(); setDetail({ type:"avail", data:avail }); setAddModal(null); }}
                        style={{ position:"absolute", top:`${top+2}px`, left:"3px", right:"3px", height:`${height-4}px`,
                          background: hasStudent
                            ? "linear-gradient(135deg,#0ea5e9,#0284c7)"
                            : "linear-gradient(135deg,#0ea5e9,#0369a1)",
                          borderRadius:"9px", padding:"5px 8px",
                          cursor:"pointer", zIndex:3, overflow:"hidden",
                          boxShadow:"0 3px 10px rgba(14,165,233,0.3)",
                          border:"1px solid rgba(14,165,233,0.3)",
                        }}>
                        {/* "OCCUPIED" badge */}
                        <div style={{ display:"inline-flex", alignItems:"center", gap:"3px", background:"rgba(255,255,255,0.2)", borderRadius:"4px", padding:"1px 5px", marginBottom:"2px" }}>
                          <span style={{ fontSize:"9px", fontWeight:"800", color:"#fff", textTransform:"uppercase", letterSpacing:"0.06em" }}>Occupied</span>
                        </div>
                        {/* Student name */}
                        {hasStudent && height > 30 && (
                          <p style={{ margin:0, fontSize:"11px", fontWeight:"800", color:"#fff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {student.firstName} {student.surname || ""}
                          </p>
                        )}
                        {/* Time range */}
                        {height > (hasStudent ? 52 : 36) && (
                          <p style={{ margin:"1px 0 0", fontSize:"10px", color:"rgba(255,255,255,0.85)" }}>
                            {fmt12(avail.startTime)} – {fmt12(avail.endTime)}
                          </p>
                        )}
                        {avail.isRecurring && height > 64 && (
                          <div style={{ display:"flex", alignItems:"center", gap:"3px", marginTop:"2px" }}>
                            <Repeat size={9} color="rgba(255,255,255,0.7)"/>
                            <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.7)" }}>Weekly</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* ── Booking tiles ── */}
                  {dayBookings.map(booking => {
                    const { startTime, endTime } = bookingTimes(booking);
                    const { top, height } = eventPos(startTime, endTime);
                    const isAccepted = booking.status === "accepted";
                    const name = bookingStudentName(booking);
                    return (
                      <div key={booking._id} className="booking-tile"
                        onClick={e => { e.stopPropagation(); setDetail({ type:"booking", data:booking }); setAddModal(null); }}
                        style={{ position:"absolute", top:`${top+2}px`, left:"3px", right:"3px", height:`${height-4}px`,
                          background: isAccepted ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "linear-gradient(135deg,#d97706,#b45309)",
                          borderRadius:"9px", padding:"6px 8px",
                          cursor:"pointer", zIndex:4, overflow:"hidden",
                          boxShadow: isAccepted ? "0 3px 12px rgba(124,58,237,0.35)" : "0 3px 12px rgba(217,119,6,0.3)",
                          border:`1px solid ${isAccepted?"rgba(109,40,217,0.4)":"rgba(180,83,9,0.4)"}`,
                        }}>
                        <p style={{ margin:0, fontSize:"11px", fontWeight:"800", color:"#fff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {booking.classTitle || "Class"}
                        </p>
                        {height > 34 && (
                          <p style={{ margin:"2px 0 0", fontSize:"10px", color:"rgba(255,255,255,0.9)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", display:"flex", alignItems:"center", gap:"3px" }}>
                            <GraduationCap size={9}/> {name}
                          </p>
                        )}
                        {height > 52 && (
                          <p style={{ margin:"2px 0 0", fontSize:"10px", color:"rgba(255,255,255,0.7)" }}>
                            {fmt12(startTime)} – {fmt12(endTime)}
                          </p>
                        )}
                        {!isAccepted && height > 66 && (
                          <div style={{ display:"inline-flex", background:"rgba(255,255,255,0.2)", borderRadius:"4px", padding:"1px 5px", marginTop:"2px" }}>
                            <span style={{ fontSize:"9px", fontWeight:"800", color:"#fff" }}>PENDING</span>
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

      {/* ═══════════════════════ ADD SLOT MODAL ═══════════════════════ */}
      {addModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }} onClick={() => setAddModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:"22px", width:"100%", maxWidth:"430px", boxShadow:"0 24px 64px rgba(0,0,0,0.25)", overflow:"hidden", animation:"fadeIn 0.2s ease" }}>

            {/* Modal header */}
            <div style={{ background:"linear-gradient(135deg,#0ea5e9,#0284c7)", padding:"20px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <p style={{ margin:0, fontSize:"11px", fontWeight:"700", color:"rgba(255,255,255,0.8)", textTransform:"uppercase", letterSpacing:"0.07em" }}>New Occupied Slot</p>
                <p style={{ margin:"3px 0 0", fontSize:"17px", fontWeight:"800", color:"#fff" }}>
                  {addModal.date.toLocaleDateString("en-US",{ weekday:"long", month:"long", day:"numeric" })}
                </p>
              </div>
              <button onClick={() => setAddModal(null)} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"9px", padding:"7px", cursor:"pointer", color:"#fff", display:"flex", alignItems:"center" }}>
                <X size={16}/>
              </button>
            </div>

            <div style={{ padding:"22px 24px", display:"flex", flexDirection:"column", gap:"18px" }}>

              {/* ── Student selector ── */}
              <div>
                <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:c.muted, marginBottom:"7px", textTransform:"uppercase", letterSpacing:"0.05em" }}>
                  Assign Student <span style={{ color:c.muted, fontWeight:"500", textTransform:"none", letterSpacing:"normal", fontSize:"11px" }}>(optional)</span>
                </label>
                <div style={{ position:"relative" }}>
                  <GraduationCap size={15} color="#0ea5e9" style={{ position:"absolute", left:"11px", top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}/>
                  <select value={addForm.studentId} onChange={e => setAddForm(f=>({...f, studentId:e.target.value}))} style={{ ...selStyle(c), paddingLeft:"32px" }}>
                    <option value="">— No student assigned —</option>
                    {students.map(s => (
                      <option key={s._id} value={s._id}>
                        {s.firstName} {s.surname || ""} {s.noOfClasses > 0 ? `(${s.noOfClasses} classes left)` : "(inactive)"}
                      </option>
                    ))}
                  </select>
                  <ChevronRight size={14} color={c.muted} style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%) rotate(90deg)", pointerEvents:"none" }}/>
                </div>
                {addForm.studentId && (() => {
                  const s = findStudent(addForm.studentId);
                  if (!s) return null;
                  return (
                    <div style={{ marginTop:"8px", padding:"10px 12px", background:isDarkMode?"rgba(14,165,233,0.1)":"#f0f9ff", borderRadius:"10px", border:"1px solid rgba(14,165,233,0.2)", display:"flex", alignItems:"center", gap:"9px" }}>
                      <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:"linear-gradient(135deg,#0ea5e9,#0284c7)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <span style={{ color:"#fff", fontWeight:"800", fontSize:"13px" }}>{s.firstName[0]}</span>
                      </div>
                      <div>
                        <p style={{ margin:0, fontSize:"13px", fontWeight:"700", color:c.heading }}>{s.firstName} {s.surname||""}</p>
                        <p style={{ margin:0, fontSize:"11px", color:"#0ea5e9" }}>{s.noOfClasses || 0} classes remaining</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Time selectors ── */}
              <div>
                <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:c.muted, marginBottom:"7px", textTransform:"uppercase", letterSpacing:"0.05em" }}>Time</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:"8px", alignItems:"center" }}>
                  {/* Start */}
                  <div style={{ position:"relative" }}>
                    <select value={addForm.startTime} onChange={e=>handleStartChange(e.target.value)} style={selStyle(c)}>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{fmt12(t)}</option>)}
                    </select>
                    <ChevronRight size={14} color={c.muted} style={{ position:"absolute", right:"10px", top:"50%", transform:"translateY(-50%) rotate(90deg)", pointerEvents:"none" }}/>
                  </div>
                  <span style={{ fontSize:"13px", color:c.muted, fontWeight:"600", textAlign:"center" }}>→</span>
                  {/* End */}
                  <div style={{ position:"relative" }}>
                    <select value={addForm.endTime} onChange={e=>handleEndChange(e.target.value)} style={selStyle(c, addFormErr?"#ef4444":c.border)}>
                      {TIME_OPTIONS.filter(t => t > addForm.startTime).map(t => <option key={t} value={t}>{fmt12(t)}</option>)}
                    </select>
                    <ChevronRight size={14} color={c.muted} style={{ position:"absolute", right:"10px", top:"50%", transform:"translateY(-50%) rotate(90deg)", pointerEvents:"none" }}/>
                  </div>
                </div>
                {addFormErr && <p style={{ color:"#ef4444", fontSize:"12px", marginTop:"5px", margin:"5px 0 0" }}>End time must be after start time.</p>}
              </div>

              {/* ── Duration quick-select ── */}
              <div>
                <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:c.muted, marginBottom:"7px", textTransform:"uppercase", letterSpacing:"0.05em" }}>Duration</label>
                <div style={{ display:"flex", gap:"7px", flexWrap:"wrap" }}>
                  {DURATIONS.map(d => {
                    const active = addForm.selectedDuration === d;
                    const hrs  = Math.floor(d/60);
                    const mins = d % 60;
                    const label = hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${d}m`;
                    return (
                      <button key={d} className="dur-btn" onClick={() => handleDuration(d)}
                        style={{ padding:"7px 13px", borderRadius:"9px", border:`1.5px solid ${active?"#0ea5e9":c.border}`, background:active?(isDarkMode?"rgba(14,165,233,0.15)":"#f0f9ff"):"transparent", color:active?"#0ea5e9":c.text, fontSize:"13px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                {/* Live duration preview */}
                {!addFormErr && (
                  <div style={{ marginTop:"8px", display:"flex", alignItems:"center", gap:"5px" }}>
                    <Clock size={12} color="#0ea5e9"/>
                    <span style={{ fontSize:"12px", color:"#0ea5e9", fontWeight:"600" }}>
                      {diffMins(addForm.startTime, addForm.endTime)} min · {fmt12(addForm.startTime)} – {fmt12(addForm.endTime)}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Recurring toggle ── */}
              <div onClick={() => setAddForm(f=>({...f, isRecurring:!f.isRecurring}))}
                style={{ display:"flex", alignItems:"center", gap:"12px", cursor:"pointer", padding:"12px 14px", background:isDarkMode?"#141620":"#f8faff", borderRadius:"12px", border:`1px solid ${addForm.isRecurring?"#0ea5e9":c.border}`, transition:"border-color 0.2s" }}>
                <div style={{ width:"40px", height:"22px", borderRadius:"11px", background:addForm.isRecurring?"linear-gradient(135deg,#0ea5e9,#0284c7)":(isDarkMode?"#1e2235":"#e2e8f0"), position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                  <div style={{ width:"16px", height:"16px", borderRadius:"50%", background:"#fff", position:"absolute", top:"3px", left:addForm.isRecurring?"21px":"3px", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontSize:"13px", fontWeight:"700", color:c.heading }}>Repeat every week</p>
                  <p style={{ margin:0, fontSize:"11px", color:c.text }}>Every {addModal.date.toLocaleDateString("en-US",{weekday:"long"})}</p>
                </div>
                {addForm.isRecurring && <Repeat size={15} color="#0ea5e9"/>}
              </div>

              {/* ── Note ── */}
              <div>
                <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:c.muted, marginBottom:"7px", textTransform:"uppercase", letterSpacing:"0.05em" }}>
                  Note <span style={{ color:c.muted, fontWeight:"500", textTransform:"none", fontSize:"11px" }}>(optional)</span>
                </label>
                <input type="text" placeholder="e.g. Grammar revision, phonics…" value={addForm.note} onChange={e=>setAddForm(f=>({...f,note:e.target.value}))}
                  style={{ width:"100%", padding:"10px 12px", background:c.input, border:`1.5px solid ${c.border}`, borderRadius:"10px", color:c.heading, fontSize:"13.5px", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}/>
              </div>

              {/* ── Actions ── */}
              <div style={{ display:"flex", gap:"10px" }}>
                <button onClick={() => setAddModal(null)} style={{ flex:1, padding:"12px", borderRadius:"12px", background:isDarkMode?"#1e2235":"#f1f5f9", border:"none", cursor:"pointer", fontWeight:"700", fontSize:"13.5px", color:c.heading, fontFamily:"inherit" }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving || addFormErr}
                  style={{ flex:2, padding:"12px", borderRadius:"12px", background:(saving||addFormErr)?"#9ca3af":"linear-gradient(135deg,#0ea5e9,#0284c7)", border:"none", cursor:(saving||addFormErr)?"not-allowed":"pointer", fontWeight:"700", fontSize:"13.5px", color:"#fff", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:"7px" }}>
                  {saving ? <Loader size={14} style={{ animation:"spin 1s linear infinite" }}/> : <Check size={14}/>}
                  {saving ? "Saving…" : "Mark as Occupied"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ DETAIL PANEL ═══════════════════════ */}
      {detail && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }} onClick={()=>setDetail(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:"22px", width:"100%", maxWidth:"400px", boxShadow:"0 24px 64px rgba(0,0,0,0.25)", overflow:"hidden", animation:"fadeIn 0.2s ease" }}>

            {detail.type === "avail" ? (() => {
              const avail   = detail.data;
              const student = findStudent(avail.studentId);
              return (
                <>
                  <div style={{ background:"linear-gradient(135deg,#0ea5e9,#0284c7)", padding:"22px 24px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ display:"inline-flex", alignItems:"center", gap:"4px", background:"rgba(255,255,255,0.2)", borderRadius:"6px", padding:"2px 8px", marginBottom:"7px" }}>
                        <span style={{ fontSize:"10px", fontWeight:"800", color:"#fff", textTransform:"uppercase", letterSpacing:"0.07em" }}>Occupied</span>
                      </div>
                      <p style={{ margin:0, fontSize:"19px", fontWeight:"800", color:"#fff" }}>{fmt12(avail.startTime)} – {fmt12(avail.endTime)}</p>
                      <p style={{ margin:"3px 0 0", fontSize:"12px", color:"rgba(255,255,255,0.8)" }}>{diffMins(avail.startTime, avail.endTime)} minutes</p>
                    </div>
                    <button onClick={()=>setDetail(null)} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"8px", padding:"6px", cursor:"pointer", color:"#fff", display:"flex" }}><X size={16}/></button>
                  </div>

                  <div style={{ padding:"22px 24px", display:"flex", flexDirection:"column", gap:"14px" }}>
                    {/* Student */}
                    {student ? (
                      <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 14px", background:isDarkMode?"rgba(14,165,233,0.08)":"#f0f9ff", borderRadius:"12px", border:"1px solid rgba(14,165,233,0.2)" }}>
                        <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:"linear-gradient(135deg,#0ea5e9,#0284c7)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <span style={{ color:"#fff", fontWeight:"800", fontSize:"16px" }}>{student.firstName[0]}</span>
                        </div>
                        <div>
                          <p style={{ margin:0, fontSize:"15px", fontWeight:"800", color:c.heading }}>{student.firstName} {student.surname||""}</p>
                          <p style={{ margin:0, fontSize:"12px", color:"#0ea5e9" }}>{student.noOfClasses||0} classes remaining</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display:"flex", alignItems:"center", gap:"10px", color:c.muted }}>
                        <User size={15}/><span style={{ fontSize:"13px" }}>No student assigned</span>
                      </div>
                    )}

                    {/* Date & time info */}
                    {[
                      { icon:Calendar, label:"Date",      val: avail.isRecurring ? `Every ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][avail.dayOfWeek]}` : new Date(avail.date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}) },
                      { icon:Clock,    label:"Time",      val: `${fmt12(avail.startTime)} – ${fmt12(avail.endTime)}` },
                      { icon:Clock,    label:"Duration",  val: `${diffMins(avail.startTime, avail.endTime)} minutes` },
                      ...(avail.timezone ? [{ icon:Clock, label:"Timezone", val: `${tzCity(avail.timezone)} (${tzAbbr(avail.timezone)})` }] : []),
                      ...(avail.note ? [{ icon:BookOpen, label:"Note", val:avail.note }] : []),
                    ].map(({ icon:Icon, label, val }) => (
                      <div key={label} style={{ display:"flex", alignItems:"flex-start", gap:"11px" }}>
                        <div style={{ width:"30px", height:"30px", borderRadius:"8px", background:isDarkMode?"rgba(14,165,233,0.12)":"#f0f9ff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Icon size={13} color="#0ea5e9"/></div>
                        <div>
                          <p style={{ margin:0, fontSize:"10px", fontWeight:"700", color:c.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</p>
                          <p style={{ margin:"2px 0 0", fontSize:"13px", fontWeight:"600", color:c.heading }}>{val}</p>
                        </div>
                      </div>
                    ))}

                    <button onClick={() => handleDelete(avail._id)}
                      style={{ padding:"11px", background:isDarkMode?"rgba(239,68,68,0.1)":"#fef2f2", border:`1.5px solid ${isDarkMode?"rgba(239,68,68,0.25)":"#fecaca"}`, borderRadius:"11px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", color:"#ef4444", fontSize:"13.5px", fontWeight:"700", fontFamily:"inherit" }}>
                      <Trash2 size={14}/> Remove This Slot
                    </button>
                  </div>
                </>
              );
            })() : (() => {
              const b      = detail.data;
              const { startTime, endTime } = bookingTimes(b);
              const isAcc  = b.status === "accepted";
              const name   = bookingStudentName(b);
              return (
                <>
                  <div style={{ background: isAcc ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "linear-gradient(135deg,#d97706,#b45309)", padding:"22px 24px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ display:"inline-flex", background:"rgba(255,255,255,0.2)", borderRadius:"6px", padding:"2px 8px", marginBottom:"7px" }}>
                        <span style={{ fontSize:"10px", fontWeight:"800", color:"#fff", textTransform:"uppercase", letterSpacing:"0.07em" }}>{b.status}</span>
                      </div>
                      <p style={{ margin:0, fontSize:"18px", fontWeight:"800", color:"#fff" }}>{b.classTitle || "Class"}</p>
                    </div>
                    <button onClick={()=>setDetail(null)} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"8px", padding:"6px", cursor:"pointer", color:"#fff", display:"flex" }}><X size={16}/></button>
                  </div>
                  <div style={{ padding:"22px 24px", display:"flex", flexDirection:"column", gap:"14px" }}>
                    {[
                      { icon:User,     label:"Student",  val:name },
                      { icon:Calendar, label:"Date",     val:new Date(b.scheduledTime).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}) },
                      { icon:Clock,    label:"Your time (teacher)", val:`${fmt12(startTime)} – ${fmt12(endTime)} ${myAbbr}` },
                      ...( b.studentTimezone && b.studentTimezone !== myTZ ? [{ icon:Clock, label:`Student time (${tzCity(b.studentTimezone)})`, val:`${new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit",hour12:true,timeZone:b.studentTimezone}).format(new Date(b.scheduledTime))} ${tzAbbr(b.studentTimezone)}` }] : []),
                      { icon:Clock,    label:"Duration", val:`${b.duration||60} minutes` },
                      ...(b.topic ? [{ icon:BookOpen, label:"Topic", val:b.topic }] : []),
                    ].map(({ icon:Icon, label, val }) => (
                      <div key={label} style={{ display:"flex", alignItems:"flex-start", gap:"11px" }}>
                        <div style={{ width:"30px", height:"30px", borderRadius:"8px", background:isDarkMode?"rgba(124,58,237,0.12)":"#f5f3ff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Icon size={13} color="#7c3aed"/></div>
                        <div>
                          <p style={{ margin:0, fontSize:"10px", fontWeight:"700", color:c.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</p>
                          <p style={{ margin:"2px 0 0", fontSize:"13px", fontWeight:"600", color:c.heading }}>{val}</p>
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
