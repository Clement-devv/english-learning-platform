// src/pages/student/tabs/StudentScheduleTab.jsx
// Student view of their teacher's schedule.
// ⚠️  Timezone, country, continent and email are intentionally HIDDEN.
import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, BookOpen,
  Clock, Calendar, Loader, GraduationCap, Lock,
} from "lucide-react";
import api from "../../../api";

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
  const top    = (() => { const [h,m]=startTime.split(":").map(Number); return (h-HOUR_START+m/60)*HOUR_HEIGHT; })();
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

// ── Palette (warm student theme) ──────────────────────────────────────────
function pal(dark) {
  return {
    bg:      dark ? "#0f1117" : "#fff8f0",
    card:    dark ? "#1a1d2e" : "#ffffff",
    border:  dark ? "#2a2d40" : "#ffe8cc",
    heading: dark ? "#f0f4ff" : "#2d1f6e",
    text:    dark ? "#c8cce0" : "#4a4060",
    muted:   dark ? "#6b7090" : "#9b8ab0",
    line:    dark ? "#1e2235" : "#f3f0ff",
    hover:   dark ? "rgba(255,255,255,0.015)" : "rgba(124,58,237,0.025)",
  };
}

// ─────────────────────────────────────────────────────────────────────────
export default function StudentScheduleTab({ studentId, isDarkMode }) {
  const col = pal(isDarkMode);

  const [teachers,     setTeachers]     = useState([]); // distinct teachers from bookings
  const [teacher,      setTeacher]      = useState(null);
  const [weekStart,    setWeekStart]    = useState(() => getMonday(new Date()));
  const [availability, setAvailability] = useState([]);
  const [myBookings,   setMyBookings]   = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [detail,       setDetail]       = useState(null);
  const [hidden,       setHidden]       = useState(false);
  const scrollRef = useRef(null);

  const today    = new Date();
  const weekDays = getWeekDays(weekStart);
  const weekEnd  = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${weekEnd.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;

  // ── Load distinct teachers from accepted bookings ──────────────────────
  useEffect(() => {
    if (!studentId) return;
    (async () => {
      try {
        const { data } = await api.get(`/api/bookings/student/${studentId}?status=accepted`);
        const map = new Map();
        (data || []).forEach(b => {
          const t = b.teacherId;
          if (t && !map.has(t._id || t)) {
            map.set(t._id || t, {
              _id:       t._id || t,
              firstName: t.firstName || "Teacher",
              lastName:  t.lastName  || "",
            });
          }
        });
        const list = [...map.values()];
        setTeachers(list);
        if (list.length === 1) setTeacher(list[0]); // auto-select if only one
      } catch { /* silent */ }
    })();
  }, [studentId]);

  // ── Scroll to 8 AM when teacher is selected ───────────────────────────
  useEffect(() => {
    if (teacher && scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = (8 - HOUR_START) * HOUR_HEIGHT - 16;
      }, 60);
    }
  }, [teacher]);

  // ── Fetch schedule when teacher / week changes ────────────────────────
  useEffect(() => {
    if (teacher) fetchSchedule();
  }, [teacher, weekStart]); // eslint-disable-line

  const fetchSchedule = async () => {
    if (!teacher?._id) return;
    setLoading(true);
    try {
      const end = new Date(weekStart); end.setDate(weekStart.getDate() + 7);
      const [availRes, bookRes] = await Promise.all([
        api.get(`/api/teacher-availability/${teacher._id}?startDate=${weekStart.toISOString()}&endDate=${end.toISOString()}`),
        api.get(`/api/bookings/student/${studentId}?status=accepted`),
      ]);
      if (availRes.data.hidden) {
        setHidden(true);
        setAvailability([]);
      } else {
        setHidden(false);
        setAvailability(availRes.data.availability || []);
      }
      // Only show future bookings with this teacher
      const now = Date.now();
      setMyBookings(
        (bookRes.data || []).filter(b => {
          const tid = b.teacherId?._id || b.teacherId;
          const endMs = new Date(b.scheduledTime).getTime() + (b.duration || 60) * 60000;
          return String(tid) === String(teacher._id) && endMs > now;
        })
      );
    } catch { /* silent */ }
    finally  { setLoading(false); }
  };

  const goWeek  = d => setWeekStart(ws => { const n = new Date(ws); n.setDate(ws.getDate() + d * 7); return n; });
  const goToday = () => setWeekStart(getMonday(new Date()));

  const getEventsForDay = useCallback((date) => {
    const jsDay = date.getDay();
    const now   = Date.now();
    const dayAvail = availability.filter(a =>
      a.isRecurring ? a.dayOfWeek === jsDay : isSameDay(new Date(a.date), date)
    );
    const dayBookings = myBookings.filter(b => {
      if (!isSameDay(new Date(b.scheduledTime), date)) return false;
      const endMs = new Date(b.scheduledTime).getTime() + (b.duration || 60) * 60000;
      return endMs > now;
    });
    return { dayAvail, dayBookings };
  }, [availability, myBookings]);

  // ── Teacher picker (if multiple teachers) ─────────────────────────────
  if (!teacher) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:"20px", fontFamily:"Plus Jakarta Sans, sans-serif" }}>
        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div>
          <h2 style={{ margin:0, fontSize:"20px", fontWeight:"800", color:col.heading }}>📅 Teacher Schedule</h2>
          <p style={{ margin:"4px 0 0", fontSize:"13px", color:col.text }}>See when your teacher is available</p>
        </div>

        {teachers.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 20px", background:col.card, borderRadius:"20px", border:`1px solid ${col.border}` }}>
            <p style={{ fontSize:"40px", margin:"0 0 12px" }}>📚</p>
            <p style={{ margin:0, fontWeight:"700", color:col.heading }}>No teacher assigned yet</p>
            <p style={{ margin:"6px 0 0", fontSize:"13px", color:col.muted }}>Once you have a confirmed class, your teacher's schedule will appear here.</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {teachers.map(t => (
              <button key={t._id} onClick={() => setTeacher(t)}
                style={{ background:col.card, border:`2px solid ${col.border}`, borderRadius:"16px", padding:"18px 20px", cursor:"pointer", display:"flex", alignItems:"center", gap:"14px", textAlign:"left", fontFamily:"inherit", transition:"all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="#7c3aed"; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=col.border; e.currentTarget.style.transform=""; }}
              >
                <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:"linear-gradient(135deg,#7c3aed,#ec4899)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ color:"#fff", fontWeight:"800", fontSize:"16px" }}>{t.firstName[0]}</span>
                </div>
                <div>
                  <p style={{ margin:0, fontWeight:"800", fontSize:"15px", color:col.heading }}>{t.firstName} {t.lastName}</p>
                  <p style={{ margin:"3px 0 0", fontSize:"12px", color:col.muted }}>Tap to view schedule</p>
                </div>
                <ChevronRight size={18} color={col.muted} style={{ marginLeft:"auto" }} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Calendar view ──────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"18px", fontFamily:"Plus Jakarta Sans, sans-serif" }}>
      <style>{`
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .stu-scroll::-webkit-scrollbar{width:4px}
        .stu-scroll::-webkit-scrollbar-thumb{background:${isDarkMode?"#2a2d40":"#f0e6ff"};border-radius:4px}
        .stu-tile{transition:filter .15s,transform .15s}
        .stu-tile:hover{filter:brightness(1.08);transform:translateY(-1px);cursor:pointer}
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", gap:"14px", flexWrap:"wrap" }}>
        {teachers.length > 1 && (
          <button onClick={() => { setTeacher(null); setAvailability([]); setMyBookings([]); }}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 14px", background:isDarkMode?"#1e2235":"#f3f0ff", border:`1px solid ${col.border}`, borderRadius:"10px", cursor:"pointer", color:col.heading, fontSize:"13px", fontWeight:"700", fontFamily:"inherit" }}>
            <ChevronLeft size={14} /> Back
          </button>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:"linear-gradient(135deg,#7c3aed,#ec4899)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span style={{ color:"#fff", fontWeight:"800", fontSize:"14px" }}>{teacher.firstName[0]}</span>
          </div>
          <div>
            <p style={{ margin:0, fontWeight:"800", fontSize:"16px", color:col.heading }}>
              {teacher.firstName} {teacher.lastName}
            </p>
            <p style={{ margin:0, fontSize:"12px", color:col.muted }}>Your teacher's availability</p>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ display:"flex", gap:"16px", flexWrap:"wrap", alignItems:"center" }}>
        {[
          { color:"#7c3aed", label:"My class" },
          { color:"#0ea5e9", label:"Occupied" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <span style={{ width:"9px", height:"9px", borderRadius:"3px", background:color }} />
            <span style={{ fontSize:"12px", color:col.text }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize:"12px", color:col.muted, marginLeft:"auto" }}>
          Empty = teacher is free
        </span>
      </div>

      {/* ── Week navigator ── */}
      <div style={{ background:col.card, border:`2px solid ${col.border}`, borderRadius:"16px", padding:"11px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <button onClick={() => goWeek(-1)} style={{ background:isDarkMode?"#1e2235":"#f3f0ff", border:`1px solid ${col.border}`, borderRadius:"10px", padding:"7px 10px", cursor:"pointer", color:col.heading, display:"flex", alignItems:"center" }}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign:"center" }}>
          <p style={{ margin:0, fontSize:"14px", fontWeight:"800", color:col.heading }}>{weekLabel}</p>
          {loading && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"4px", marginTop:"2px" }}>
              <Loader size={10} style={{ animation:"spin 1s linear infinite", color:"#7c3aed" }} />
              <span style={{ fontSize:"11px", color:"#7c3aed" }}>Loading…</span>
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={goToday} style={{ background:isDarkMode?"#1e2235":"#f3f0ff", border:`1px solid ${col.border}`, borderRadius:"10px", padding:"7px 13px", cursor:"pointer", fontSize:"12px", fontWeight:"700", color:col.heading }}>Today</button>
          <button onClick={() => goWeek(1)} style={{ background:isDarkMode?"#1e2235":"#f3f0ff", border:`1px solid ${col.border}`, borderRadius:"10px", padding:"7px 10px", cursor:"pointer", color:col.heading, display:"flex", alignItems:"center" }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Hidden notice ── */}
      {hidden && (
        <div style={{ textAlign:"center", padding:"40px 24px", background:col.card, border:`2px solid ${col.border}`, borderRadius:"20px", animation:"fadeIn 0.2s ease" }}>
          <p style={{ fontSize:"44px", margin:"0 0 12px" }}>🔒</p>
          <p style={{ margin:0, fontSize:"16px", fontWeight:"800", color:col.heading }}>Schedule not available</p>
          <p style={{ margin:"8px 0 0", fontSize:"13px", color:col.muted, maxWidth:"300px", marginLeft:"auto", marginRight:"auto", lineHeight:1.6 }}>
            Your teacher has chosen to keep their schedule private. Please contact them directly to arrange a class.
          </p>
        </div>
      )}

      {/* ── Calendar ── */}
      {!hidden && <div style={{ background:col.card, border:`2px solid ${col.border}`, borderRadius:"20px", overflow:"hidden", animation:"fadeIn 0.2s ease" }}>

        {/* Day headers */}
        <div style={{ display:"grid", gridTemplateColumns:"52px repeat(7,1fr)", borderBottom:`2px solid ${col.border}`, background:isDarkMode?"#141620":"#fdf8ff", position:"sticky", top:0, zIndex:10 }}>
          <div style={{ borderRight:`1px solid ${col.border}` }} />
          {weekDays.map((day, i) => {
            const isToday   = isSameDay(day, today);
            const isWeekend = i >= 5;
            return (
              <div key={i} style={{ padding:"10px 4px", textAlign:"center", borderRight:i<6?`1px solid ${col.border}`:"none", background:isToday?(isDarkMode?"rgba(124,58,237,0.12)":"rgba(124,58,237,0.06)"):"transparent" }}>
                <p style={{ margin:0, fontSize:"10px", fontWeight:"700", color:isToday?"#7c3aed":col.muted, textTransform:"uppercase", letterSpacing:"0.07em" }}>{DAY_LABELS[i]}</p>
                <div style={{ width:"30px", height:"30px", borderRadius:"50%", margin:"3px auto 0", display:"flex", alignItems:"center", justifyContent:"center", background:isToday?"linear-gradient(135deg,#7c3aed,#ec4899)":"transparent" }}>
                  <span style={{ fontSize:"15px", fontWeight:"800", color:isToday?"#fff":isWeekend?col.text:col.heading }}>{day.getDate()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable grid */}
        <div ref={scrollRef} className="stu-scroll" style={{ overflowY:"auto", maxHeight:"540px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"52px repeat(7,1fr)", position:"relative", height:`${TOTAL_HOURS * HOUR_HEIGHT}px` }}>

            {/* Time labels */}
            <div style={{ borderRight:`1px solid ${col.border}`, position:"relative", zIndex:2 }}>
              {Array.from({ length:TOTAL_HOURS }, (_,i) => {
                const hour = HOUR_START + i;
                const ampm = hour >= 12 ? "PM" : "AM";
                const h12  = hour===12?12:hour>12?hour-12:hour;
                return (
                  <div key={i} style={{ position:"absolute", top:`${i*HOUR_HEIGHT}px`, width:"100%", height:`${HOUR_HEIGHT}px`, display:"flex", alignItems:"flex-start", paddingTop:"6px", paddingRight:"7px", justifyContent:"flex-end", borderBottom:`1px solid ${col.line}` }}>
                    <span style={{ fontSize:"10px", fontWeight:"700", color:col.muted }}>{h12}<span style={{ fontSize:"9px" }}>{ampm}</span></span>
                  </div>
                );
              })}
            </div>

            {/* 7 day columns */}
            {weekDays.map((day, di) => {
              const { dayAvail, dayBookings } = getEventsForDay(day);
              const isToday   = isSameDay(day, today);
              const isWeekend = di >= 5;

              return (
                <div key={di} style={{ position:"relative", borderRight:di<6?`1px solid ${col.border}`:"none", background:isToday?(isDarkMode?"rgba(124,58,237,0.025)":"rgba(124,58,237,0.018)"):isWeekend?(isDarkMode?"rgba(255,255,255,0.004)":"rgba(0,0,0,0.008)"):"transparent" }}>

                  {/* Hour rows */}
                  {Array.from({ length:TOTAL_HOURS }, (_,hi) => (
                    <div key={hi} style={{ position:"absolute", top:`${hi*HOUR_HEIGHT}px`, width:"100%", height:`${HOUR_HEIGHT}px`, borderBottom:`1px solid ${col.line}` }}>
                      <div style={{ position:"absolute", top:"50%", left:"4px", right:"4px", height:"1px", background:isDarkMode?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)", pointerEvents:"none" }} />
                    </div>
                  ))}

                  {/* Now indicator */}
                  {isToday && (() => {
                    const now  = new Date();
                    const mins = (now.getHours()-HOUR_START)*60 + now.getMinutes();
                    if (mins<0||mins>TOTAL_HOURS*60) return null;
                    return (
                      <div style={{ position:"absolute", top:`${(mins/60)*HOUR_HEIGHT}px`, left:0, right:0, zIndex:5, pointerEvents:"none" }}>
                        <div style={{ height:"2px", background:"#f97316", boxShadow:"0 0 6px rgba(249,115,22,0.5)", position:"relative" }}>
                          <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#f97316", position:"absolute", left:"-3px", top:"-2.5px" }} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Occupied tiles (no names, no timezone) ── */}
                  {dayAvail.map(avail => {
                    const { top, height } = eventPos(avail.startTime, avail.endTime);
                    return (
                      <div key={avail._id} className="stu-tile"
                        onClick={() => setDetail({ type:"avail", data:avail })}
                        style={{ position:"absolute", top:`${top+2}px`, left:"3px", right:"3px", height:`${height-4}px`,
                          background:"linear-gradient(135deg,#0ea5e9,#0284c7)",
                          borderRadius:"8px", padding:"4px 6px", zIndex:3, overflow:"hidden",
                          boxShadow:"0 2px 8px rgba(14,165,233,0.2)",
                        }}>
                        <div style={{ display:"inline-flex", alignItems:"center", gap:"3px", background:"rgba(255,255,255,0.2)", borderRadius:"3px", padding:"1px 5px" }}>
                          <Lock size={7} color="#fff" />
                          <span style={{ fontSize:"8px", fontWeight:"800", color:"#fff", textTransform:"uppercase", letterSpacing:"0.06em" }}>Occupied</span>
                        </div>
                        {height > 34 && (
                          <p style={{ margin:"2px 0 0", fontSize:"10px", color:"rgba(255,255,255,0.9)" }}>
                            {fmt12(avail.startTime)}–{fmt12(avail.endTime)}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* ── My class tiles ── */}
                  {dayBookings.map(b => {
                    const { startTime, endTime } = bookingTimes(b);
                    const { top, height } = eventPos(startTime, endTime);
                    return (
                      <div key={b._id} className="stu-tile"
                        onClick={() => setDetail({ type:"booking", data:b })}
                        style={{ position:"absolute", top:`${top+2}px`, left:"3px", right:"3px", height:`${height-4}px`,
                          background:"linear-gradient(135deg,#7c3aed,#ec4899)",
                          borderRadius:"8px", padding:"4px 6px", zIndex:4, overflow:"hidden",
                          boxShadow:"0 2px 10px rgba(124,58,237,0.35)",
                        }}>
                        <p style={{ margin:0, fontSize:"10px", fontWeight:"800", color:"#fff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {b.classTitle || "My Class"}
                        </p>
                        {height > 32 && (
                          <p style={{ margin:0, fontSize:"9px", color:"rgba(255,255,255,0.85)" }}>
                            {fmt12(startTime)}–{fmt12(endTime)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>}

      {/* ══ Detail modal ══ */}
      {detail && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}
          onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:col.card, border:`2px solid ${col.border}`, borderRadius:"20px", width:"100%", maxWidth:"360px", boxShadow:"0 24px 64px rgba(0,0,0,0.25)", overflow:"hidden", animation:"fadeIn 0.2s ease" }}>

            {detail.type === "avail" ? (() => {
              const a = detail.data;
              return (
                <>
                  <div style={{ background:"linear-gradient(135deg,#0ea5e9,#0284c7)", padding:"20px 22px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ display:"inline-flex", alignItems:"center", gap:"4px", background:"rgba(255,255,255,0.2)", borderRadius:"5px", padding:"2px 8px", marginBottom:"6px" }}>
                        <Lock size={9} color="#fff" />
                        <span style={{ fontSize:"10px", fontWeight:"800", color:"#fff", textTransform:"uppercase" }}>Occupied</span>
                      </div>
                      <p style={{ margin:0, fontSize:"17px", fontWeight:"800", color:"#fff" }}>
                        {fmt12(a.startTime)} – {fmt12(a.endTime)}
                      </p>
                      <p style={{ margin:"2px 0 0", fontSize:"12px", color:"rgba(255,255,255,0.8)" }}>
                        {diffMins(a.startTime, a.endTime)} min · {a.isRecurring ? `Every ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][a.dayOfWeek]}` : new Date(a.date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
                      </p>
                    </div>
                    <button onClick={() => setDetail(null)} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"8px", padding:"6px", cursor:"pointer", color:"#fff", display:"flex" }}>✕</button>
                  </div>
                  <div style={{ padding:"18px 22px" }}>
                    <p style={{ margin:0, fontSize:"13px", color:col.text, lineHeight:1.6 }}>
                      Your teacher is busy during this time. Check the empty slots to request a class!
                    </p>
                  </div>
                </>
              );
            })() : (() => {
              const b = detail.data;
              const { startTime, endTime } = bookingTimes(b);
              return (
                <>
                  <div style={{ background:"linear-gradient(135deg,#7c3aed,#ec4899)", padding:"20px 22px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ display:"inline-flex", background:"rgba(255,255,255,0.2)", borderRadius:"5px", padding:"2px 8px", marginBottom:"6px" }}>
                        <span style={{ fontSize:"10px", fontWeight:"800", color:"#fff", textTransform:"uppercase" }}>My Class ✓</span>
                      </div>
                      <p style={{ margin:0, fontSize:"17px", fontWeight:"800", color:"#fff" }}>{b.classTitle || "English Class"}</p>
                    </div>
                    <button onClick={() => setDetail(null)} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"8px", padding:"6px", cursor:"pointer", color:"#fff", display:"flex" }}>✕</button>
                  </div>
                  <div style={{ padding:"18px 22px", display:"flex", flexDirection:"column", gap:"12px" }}>
                    {[
                      { icon:Calendar, label:"Date",     val:new Date(b.scheduledTime).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}) },
                      { icon:Clock,    label:"Time",     val:`${fmt12(startTime)} – ${fmt12(endTime)}` },
                      { icon:Clock,    label:"Duration", val:`${b.duration||60} minutes` },
                      ...(b.topic ? [{ icon:BookOpen, label:"Topic", val:b.topic }] : []),
                    ].map(({ icon:Icon, label, val }) => (
                      <div key={label} style={{ display:"flex", alignItems:"flex-start", gap:"10px" }}>
                        <div style={{ width:"28px", height:"28px", borderRadius:"8px", background:isDarkMode?"rgba(124,58,237,0.12)":"#f5f3ff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <Icon size={12} color="#7c3aed" />
                        </div>
                        <div>
                          <p style={{ margin:0, fontSize:"10px", fontWeight:"700", color:col.muted, textTransform:"uppercase" }}>{label}</p>
                          <p style={{ margin:"2px 0 0", fontSize:"13px", fontWeight:"600", color:col.heading }}>{val}</p>
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
