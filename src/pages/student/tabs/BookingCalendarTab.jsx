// src/pages/student/tabs/BookingCalendarTab.jsx
// Student booking: pick a teacher → timeline calendar → click free space → request.
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Loader, Calendar, AlertCircle } from 'lucide-react';
import api from '../../../api';

// ── Constants ─────────────────────────────────────────────────────────────────
const HOUR_START  = 6;
const HOUR_END    = 22;
const HOUR_HEIGHT = 76;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const DAY_LABELS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const F           = "'Nunito','Inter',sans-serif";

const HOUR_MIN_STR = `${String(HOUR_START).padStart(2,'0')}:00`;
const HOUR_MAX_STR = `${String(HOUR_END).padStart(2,'0')}:00`;

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
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function diffMins(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
function toMins(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function eventPos(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const top    = (sh - HOUR_START + sm / 60) * HOUR_HEIGHT;
  const height = Math.max(diffMins(startTime, endTime) / 60 * HOUR_HEIGHT, 24);
  return { top, height };
}
function bookingEventPos(b) {
  const s = new Date(b.scheduledTime);
  const e = new Date(s.getTime() + (b.duration || 60) * 60000);
  const st = `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}`;
  const et = `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`;
  return eventPos(st, et);
}
function localDateStr(date) {
  const y  = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d  = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

// Is the proposed booking time blocked by an existing booking?
function overlapsBooking(bookings, bookDate, durationMins) {
  const bStart = bookDate.getTime();
  const bEnd   = bStart + durationMins * 60000;
  return bookings.some(bk => {
    const s = new Date(bk.scheduledTime).getTime();
    const e = s + (bk.duration || 60) * 60000;
    return bStart < e && bEnd > s;
  });
}

// Is the proposed time (in total mins from midnight) blocked by a teacher's occupied slot?
function overlapsOccupied(slots, day, startMins, durationMins) {
  const endMins = startMins + durationMins;
  const dow = day.getDay();
  return slots.some(slot => {
    const matches = slot.isRecurring
      ? slot.dayOfWeek === dow
      : isSameDay(new Date(slot.date), day);
    if (!matches) return false;
    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    return startMins < (eh * 60 + em) && endMins > (sh * 60 + sm);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BookingCalendarTab({ isDarkMode, studentInfo }) {
  const col = {
    bg:      isDarkMode ? '#0f1117' : '#fff8f0',
    card:    isDarkMode ? '#1a1d2e' : '#ffffff',
    border:  isDarkMode ? '#2a2d40' : '#ffe8cc',
    heading: isDarkMode ? '#f0f4ff' : '#3d2e20',
    body:    isDarkMode ? '#c8cce0' : '#5a4a3a',
    muted:   isDarkMode ? '#6b7090' : '#a89480',
    accent:  isDarkMode ? '#fbbf24' : '#f97316',
    line:    isDarkMode ? '#1e2235' : '#f5f0ec',
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [step,            setStep]            = useState('pick-teacher');
  const [teachers,        setTeachers]        = useState([]);
  const [loadingT,        setLoadingT]        = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  const [weekStart,    setWeekStart]    = useState(() => getMonday(new Date()));
  const [slots,        setSlots]        = useState([]);
  const [bookings,     setBookings]     = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Modal open flag
  const [showModal, setShowModal] = useState(false);

  // Booking form fields
  const [formTitle,    setFormTitle]    = useState('');
  const [formTopic,    setFormTopic]    = useState('');
  const [formNotes,    setFormNotes]    = useState('');
  const [formDate,     setFormDate]     = useState('');
  const [formStart,    setFormStart]    = useState('');
  const [formEnd,      setFormEnd]      = useState('');
  const [formDuration, setFormDuration] = useState(0);
  const [timeError,    setTimeError]    = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [msg,          setMsg]          = useState('');

  const scrollRef = useRef(null);
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000); };

  // ── Scroll to 8 AM when entering calendar ─────────────────────────────────
  useEffect(() => {
    if (step === 'calendar' && scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = (8 - HOUR_START) * HOUR_HEIGHT - 16;
      }, 60);
    }
  }, [step]);

  // ── Load teachers ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/teachers/for-booking');
        setTeachers(res.data?.teachers || []);
      } catch {
        flash('Failed to load teachers');
      } finally {
        setLoadingT(false);
      }
    })();
  }, []);

  // ── Load schedule for selected teacher / week ──────────────────────────────
  const loadWeek = useCallback(async () => {
    if (!selectedTeacher) return;
    setLoadingSlots(true);
    const wEnd = addDays(weekStart, 7);
    try {
      const [availRes, bookRes] = await Promise.all([
        api.get(`/teacher-availability/${selectedTeacher._id}`, {
          params: { startDate: weekStart.toISOString(), endDate: wEnd.toISOString() },
        }),
        api.get(`/bookings/teacher/${selectedTeacher._id}`, {
          params: { status: 'scheduled,pending,accepted,in-progress' },
        }),
      ]);
      setSlots(availRes.data.availability || []);
      const b = Array.isArray(bookRes.data) ? bookRes.data : (bookRes.data?.bookings || []);
      setBookings(b);
    } catch {
      flash('Failed to load schedule');
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedTeacher, weekStart]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const weekDays  = getWeekDays(weekStart);
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${weekEnd.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
  const today     = new Date();
  const todayStr  = localDateStr(today);

  const getSlotsForDay = useCallback((date) => {
    const dow = date.getDay();
    return slots.filter(s =>
      s.isRecurring ? s.dayOfWeek === dow : isSameDay(new Date(s.date), date)
    );
  }, [slots]);

  const getBookingsForDay = useCallback((date) => {
    return bookings.filter(b => isSameDay(new Date(b.scheduledTime), date));
  }, [bookings]);

  // ── Time validation ────────────────────────────────────────────────────────
  const validateTimeFields = useCallback((date, start, end) => {
    if (!date || !start || !end) return '';
    const startMins = toMins(start);
    const endMins   = toMins(end);
    if (endMins <= startMins) return 'End time must be after start time.';
    const dur = endMins - startMins;
    const day = new Date(date + 'T00:00:00');
    const bookDate = new Date(date + 'T' + start + ':00');
    if (bookDate <= new Date()) return 'Please select a future date and time.';
    if (overlapsOccupied(slots, day, startMins, dur)) {
      return "This time clashes with the teacher's occupied slot. Please check the schedule and select an available time.";
    }
    if (overlapsBooking(bookings, bookDate, dur)) {
      return 'This time slot is already booked. Please select a different time.';
    }
    return '';
  }, [slots, bookings]);

  // ── Open booking modal (from "Book a Class" button) ──────────────────────
  const openBookingModal = () => {
    setFormDate(todayStr);
    setFormStart('');
    setFormEnd('');
    setFormDuration(0);
    setTimeError('');
    setFormTitle('');
    setFormTopic('');
    setFormNotes('');
    setShowModal(true);
  };

  // ── Form time change handlers ──────────────────────────────────────────────
  const handleDateChange = (val) => {
    setFormDate(val);
    setTimeError(validateTimeFields(val, formStart, formEnd));
  };

  const handleStartChange = (val) => {
    setFormStart(val);
    // Auto-advance end time to preserve existing duration (or default 60 min)
    const dur = formDuration > 0 ? formDuration : 60;
    const newEndMins = toMins(val) + dur;
    if (newEndMins <= HOUR_END * 60) {
      const eh = Math.floor(newEndMins / 60);
      const em = newEndMins % 60;
      const newEnd = `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`;
      setFormEnd(newEnd);
      setTimeError(validateTimeFields(formDate, val, newEnd));
    } else {
      setFormEnd('');
      setFormDuration(0);
      setTimeError('');
    }
  };

  const handleEndChange = (val) => {
    setFormEnd(val);
    if (val && formStart) {
      const dur = toMins(val) - toMins(formStart);
      setFormDuration(dur > 0 ? dur : 0);
      setTimeError(validateTimeFields(formDate, formStart, val));
    }
  };

  // ── Submit booking request ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formTitle.trim()) return flash('Please enter a class title');
    if (!formTopic.trim()) return flash('Please enter a class topic');
    if (!formDate || !formStart || !formEnd) return flash('Please fill in the date and time');
    const err = validateTimeFields(formDate, formStart, formEnd);
    if (err) { setTimeError(err); return; }
    const dur = toMins(formEnd) - toMins(formStart);
    if (dur <= 0) return flash('End time must be after start time');

    setSubmitting(true);
    try {
      await api.post('/bookings/student-request', {
        teacherId:     selectedTeacher._id,
        classTitle:    formTitle,
        topic:         formTopic,
        notes:         formNotes,
        scheduledTime: new Date(formDate + 'T' + formStart + ':00').toISOString(),
        duration:      dur,
      });
      setShowModal(false);
      flash("✅ Booking request sent! You'll be notified when the teacher confirms.");
      loadWeek();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to send booking request');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  // Text inputs — strip native appearance for consistent look
  const inp = {
    width: '100%', background: isDarkMode ? '#0f1117' : '#fff8f0',
    border: `1.5px solid ${col.border}`, borderRadius: 12, padding: '9px 12px',
    fontSize: 14, color: col.body, fontFamily: F, outline: 'none',
    boxSizing: 'border-box', appearance: 'none', WebkitAppearance: 'none',
  };
  // Date/time inputs — keep native picker UI (calendar, clock)
  const inpPicker = {
    width: '100%', background: isDarkMode ? '#0f1117' : '#fff8f0',
    border: `1.5px solid ${col.border}`, borderRadius: 12, padding: '9px 12px',
    fontSize: 14, color: col.body, fontFamily: F, outline: 'none',
    boxSizing: 'border-box', colorScheme: isDarkMode ? 'dark' : 'light',
  };
  const btn = (grad, txt = '#fff', dis = false) => ({
    background: dis ? (isDarkMode ? '#2a2d40' : '#f5f0ec') : grad,
    color: dis ? col.muted : txt, border: 'none', borderRadius: 12, padding: '9px 20px',
    fontSize: 13, fontWeight: 800, cursor: dis ? 'default' : 'pointer', fontFamily: F,
  });
  const navBtn = {
    background: isDarkMode ? '#1e2235' : '#f5f0ec', border: `1px solid ${col.border}`,
    borderRadius: 10, cursor: 'pointer', color: col.heading, display: 'flex', alignItems: 'center',
  };
  const lbl = {
    display: 'block', fontSize: 11, fontWeight: 800, color: col.muted,
    textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: F }}>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0;transform:translateY(8px) } to { opacity:1;transform:translateY(0) } }
        .bc-scroll::-webkit-scrollbar { width: 4px }
        .bc-scroll::-webkit-scrollbar-thumb { background: ${isDarkMode?'#2a2d40':'#ffd0a8'}; border-radius:4px }
        .teacher-card { transition: transform .15s, box-shadow .15s }
        .teacher-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.10) !important; }
      `}</style>

      {/* Flash message */}
      {msg && (
        <div style={{
          background: msg.startsWith('✅') ? (isDarkMode?'rgba(16,185,129,0.12)':'#f0fdf4') : '#fef2f2',
          border: `1.5px solid ${msg.startsWith('✅')?'#86efac':'#fecaca'}`,
          borderRadius: 14, padding: '10px 16px', marginBottom: 16,
          fontSize: 14, fontWeight: 700,
          color: msg.startsWith('✅') ? '#16a34a' : '#dc2626',
        }}>{msg}</div>
      )}

      {/* ════════════════ STEP 1: PICK TEACHER ════════════════ */}
      {step === 'pick-teacher' && (
        <>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin:'0 0 4px', fontSize:20, fontWeight:900, color:col.heading }}>Book a Class</h2>
            <p  style={{ margin:0, fontSize:13, color:col.muted }}>Choose a teacher, then click any free time to request a class</p>
          </div>

          {loadingT ? (
            <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
              <Loader size={28} color={col.accent} style={{ animation:'spin 1s linear infinite' }} />
            </div>
          ) : teachers.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, background:col.card, borderRadius:20, border:`2px solid ${col.border}` }}>
              <Calendar size={40} color={col.muted} style={{ margin:'0 auto 12px' }} />
              <p style={{ color:col.muted, fontWeight:700, margin:0 }}>No teachers available right now</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
              {teachers.map(t => (
                <div key={t._id} className="teacher-card"
                  onClick={() => { setSelectedTeacher(t); setStep('calendar'); setWeekStart(getMonday(new Date())); }}
                  style={{ background:col.card, border:`2px solid ${col.border}`, borderRadius:20, padding:20, cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                    <div style={{ width:48, height:48, borderRadius:14, background:'linear-gradient(135deg,#f97316,#f43f5e)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:900, fontSize:18, flexShrink:0, overflow:'hidden' }}>
                      {t.photo
                        ? <img src={t.photo} alt="" style={{ width:48, height:48, objectFit:'cover' }} />
                        : (t.firstName?.[0]||'T').toUpperCase()}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:col.heading }}>{t.firstName} {t.lastName}</div>
                      {t.continent && <div style={{ fontSize:12, color:col.muted }}>{t.continent}</div>}
                    </div>
                  </div>
                  {t.bio && (
                    <p style={{ fontSize:12, color:col.body, margin:'0 0 10px', lineHeight:1.5,
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {t.bio}
                    </p>
                  )}
                  {t.specializations?.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:10 }}>
                      {t.specializations.slice(0,3).map(s => (
                        <span key={s} style={{ fontSize:11, fontWeight:700, background:isDarkMode?'rgba(249,115,22,0.12)':'#fff7ed', color:col.accent, borderRadius:999, padding:'2px 8px' }}>{s}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize:12, fontWeight:700, color:col.accent }}>View schedule →</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ════════════════ STEP 2: CALENDAR ════════════════ */}
      {step === 'calendar' && selectedTeacher && (
        <>
          {/* ── Header row ── */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
            <button onClick={() => setStep('pick-teacher')}
              style={{ ...btn(isDarkMode?'#2a2d40':'#f5f0ec', col.body), display:'flex', alignItems:'center', gap:5, padding:'8px 14px' }}>
              <ChevronLeft size={14}/> Teachers
            </button>

            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#f97316,#f43f5e)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:900, fontSize:16, overflow:'hidden', flexShrink:0 }}>
                {selectedTeacher.photo
                  ? <img src={selectedTeacher.photo} alt="" style={{ width:38, height:38, objectFit:'cover' }} />
                  : (selectedTeacher.firstName?.[0]||'T').toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:900, color:col.heading }}>{selectedTeacher.firstName} {selectedTeacher.lastName}</div>
                <div style={{ fontSize:11, color:col.muted }}>Check the schedule below, then book a class</div>
              </div>
            </div>

            {/* Book a Class button */}
            <button
              onClick={openBookingModal}
              style={{ marginLeft:'auto', background:'linear-gradient(135deg,#f97316,#f43f5e)', color:'#fff', border:'none', borderRadius:12, padding:'10px 18px', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:F, whiteSpace:'nowrap' }}>
              + Book a Class
            </button>
          </div>

          {/* ── Week navigator ── */}
          <div style={{ background:col.card, border:`2px solid ${col.border}`, borderRadius:14, padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <button onClick={() => setWeekStart(w => addDays(w,-7))} style={{ ...navBtn, padding:'7px 10px' }}><ChevronLeft size={15}/></button>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:14, fontWeight:800, color:col.heading }}>{weekLabel}</div>
              {loadingSlots && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginTop:2 }}>
                  <Loader size={10} style={{ animation:'spin 1s linear infinite', color:col.accent }}/>
                  <span style={{ fontSize:11, color:col.accent }}>Loading…</span>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setWeekStart(getMonday(new Date()))} style={{ ...navBtn, padding:'7px 12px', fontSize:12, fontWeight:700, fontFamily:F }}>Today</button>
              <button onClick={() => setWeekStart(w => addDays(w,7))} style={{ ...navBtn, padding:'7px 10px' }}><ChevronRight size={15}/></button>
            </div>
          </div>

          {/* ── Legend ── */}
          <div style={{ display:'flex', gap:16, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
            {[
              { color:'#6366f1', label:"Occupied (teacher's schedule)" },
              { color:'#f97316', label:'Your booking' },
              { color:'#ef4444', label:'Already booked' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:3, background:color }}/>
                <span style={{ fontSize:12, color:col.muted, fontWeight:600 }}>{label}</span>
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:16, height:10, borderRadius:3, border:`1.5px dashed ${col.muted}`, background:'transparent' }}/>
              <span style={{ fontSize:12, color:col.muted, fontWeight:600 }}>Free — click to book</span>
            </div>
          </div>

          {/* ── Calendar grid ── */}
          <div style={{ background:col.card, border:`2px solid ${col.border}`, borderRadius:20, overflow:'hidden' }}>

            {/* Day headers */}
            <div style={{ display:'grid', gridTemplateColumns:'52px repeat(7,1fr)', borderBottom:`2px solid ${col.border}`, background:isDarkMode?'#141620':'#fffaf5', position:'sticky', top:0, zIndex:10 }}>
              <div style={{ borderRight:`1px solid ${col.border}` }}/>
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, today);
                return (
                  <div key={i} style={{ padding:'10px 4px', textAlign:'center', borderRight:i<6?`1px solid ${col.border}`:'none', background:isToday?(isDarkMode?'rgba(249,115,22,0.12)':'rgba(249,115,22,0.06)'):'transparent' }}>
                    <p style={{ margin:0, fontSize:'10px', fontWeight:700, color:isToday?col.accent:col.muted, textTransform:'uppercase', letterSpacing:'0.07em' }}>{DAY_LABELS[i]}</p>
                    <div style={{ width:30, height:30, borderRadius:'50%', margin:'3px auto 0', display:'flex', alignItems:'center', justifyContent:'center', background:isToday?'linear-gradient(135deg,#f97316,#f43f5e)':'transparent' }}>
                      <span style={{ fontSize:15, fontWeight:800, color:isToday?'#fff':col.heading }}>{day.getDate()}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable grid */}
            <div ref={scrollRef} className="bc-scroll" style={{ overflowY:'auto', maxHeight:560 }}>
              <div style={{ display:'grid', gridTemplateColumns:'52px repeat(7,1fr)', position:'relative', height:`${TOTAL_HOURS*HOUR_HEIGHT}px` }}>

                {/* Time labels */}
                <div style={{ borderRight:`1px solid ${col.border}`, position:'relative', zIndex:2 }}>
                  {Array.from({ length:TOTAL_HOURS }, (_,i) => {
                    const hour = HOUR_START + i;
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const h12  = hour===12?12:hour>12?hour-12:hour;
                    return (
                      <div key={i} style={{ position:'absolute', top:`${i*HOUR_HEIGHT}px`, width:'100%', height:`${HOUR_HEIGHT}px`, display:'flex', alignItems:'flex-start', paddingTop:6, paddingRight:7, justifyContent:'flex-end', borderBottom:`1px solid ${col.line}` }}>
                        <span style={{ fontSize:10, fontWeight:700, color:col.muted }}>{h12}<span style={{ fontSize:9 }}>{ampm}</span></span>
                      </div>
                    );
                  })}
                </div>

                {/* Day columns */}
                {weekDays.map((day, di) => {
                  const isPastDay   = day < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  const isToday     = isSameDay(day, today);
                  const isWeekend   = di >= 5;
                  const daySlots    = getSlotsForDay(day);
                  const dayBookings = getBookingsForDay(day);

                  return (
                    <div key={di}
                      style={{
                        position:'relative',
                        borderRight: di<6?`1px solid ${col.border}`:'none',
                        background: isToday
                          ? (isDarkMode?'rgba(249,115,22,0.025)':'rgba(249,115,22,0.015)')
                          : isWeekend
                            ? (isDarkMode?'rgba(255,255,255,0.004)':'rgba(0,0,0,0.008)')
                            : 'transparent',
                      }}>

                      {/* Hour row lines */}
                      {Array.from({ length:TOTAL_HOURS }, (_,hi) => (
                        <div key={hi} style={{ position:'absolute', top:`${hi*HOUR_HEIGHT}px`, width:'100%', height:`${HOUR_HEIGHT}px`, borderBottom:`1px solid ${col.line}`, pointerEvents:'none' }}>
                          <div style={{ position:'absolute', top:'50%', left:4, right:4, height:1, background:isDarkMode?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)' }}/>
                        </div>
                      ))}

                      {/* Now indicator */}
                      {isToday && (() => {
                        const now  = new Date();
                        const mins = (now.getHours()-HOUR_START)*60 + now.getMinutes();
                        if (mins<0||mins>TOTAL_HOURS*60) return null;
                        return (
                          <div style={{ position:'absolute', top:`${(mins/60)*HOUR_HEIGHT}px`, left:0, right:0, zIndex:5, pointerEvents:'none' }}>
                            <div style={{ height:2, background:col.accent, boxShadow:`0 0 6px ${col.accent}55`, position:'relative' }}>
                              <div style={{ width:7, height:7, borderRadius:'50%', background:col.accent, position:'absolute', left:-3, top:-2.5 }}/>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Occupied slots */}
                      {daySlots.map(slot => {
                        const { top, height } = eventPos(slot.startTime, slot.endTime);
                        return (
                          <div key={slot._id}
                            style={{
                              position:'absolute', top:top+2, left:2, right:2, height:height-4,
                              background: isDarkMode?'rgba(99,102,241,0.20)':'rgba(99,102,241,0.12)',
                              border:`1.5px solid ${isDarkMode?'rgba(99,102,241,0.50)':'rgba(99,102,241,0.35)'}`,
                              borderRadius:8, zIndex:2, overflow:'hidden', pointerEvents:'none',
                            }}>
                            <div style={{ padding:'3px 6px' }}>
                              <span style={{ fontSize:9, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'0.06em' }}>Occupied</span>
                              {height > 36 && (
                                <p style={{ margin:0, fontSize:10, color:'#6366f1', fontWeight:600, opacity:0.9 }}>
                                  {fmt12(slot.startTime)}–{fmt12(slot.endTime)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Booking tiles */}
                      {dayBookings.map(b => {
                        const { top, height } = bookingEventPos(b);
                        const isMe = String(b.studentId?._id || b.studentId) === String(studentInfo?._id || studentInfo?.id);
                        return (
                          <div key={b._id}
                            style={{
                              position:'absolute', top:top+2, left:2, right:2, height:height-4,
                              background: isMe
                                ? 'linear-gradient(135deg,#f97316,#f43f5e)'
                                : 'linear-gradient(135deg,#ef4444,#dc2626)',
                              borderRadius:8, padding:'4px 6px', zIndex:4, overflow:'hidden',
                              pointerEvents:'none',
                              boxShadow: isMe?'0 2px 10px rgba(249,115,22,0.35)':'0 2px 8px rgba(239,68,68,0.25)',
                            }}>
                            <p style={{ margin:0, fontSize:10, fontWeight:800, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {isMe ? (b.classTitle||'My Class') : 'Booked'}
                            </p>
                            {height > 32 && (() => {
                              const s = new Date(b.scheduledTime);
                              return <p style={{ margin:0, fontSize:9, color:'rgba(255,255,255,0.85)' }}>{String(s.getHours()).padStart(2,'0')}:{String(s.getMinutes()).padStart(2,'0')}</p>;
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <p style={{ margin:'10px 0 0', fontSize:12, color:col.muted, fontWeight:600, textAlign:'center' }}>
            Indigo = teacher's occupied time &nbsp;·&nbsp; Use the <strong>Book a Class</strong> button above to request a session
          </p>
        </>
      )}

      {/* ════════════════ BOOKING MODAL ════════════════ */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}
          onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:col.card, borderRadius:24, padding:28, width:'100%', maxWidth:500, fontFamily:F, animation:'fadeIn 0.2s ease', maxHeight:'90vh', overflowY:'auto' }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', marginBottom:22 }}>
              <h3 style={{ margin:0, fontSize:18, fontWeight:900, color:col.heading, flex:1 }}>Request a Class</h3>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer' }}>
                <X size={20} color={col.muted}/>
              </button>
            </div>

            {/* Teacher badge */}
            <div style={{ display:'flex', alignItems:'center', gap:10, background:isDarkMode?'rgba(249,115,22,0.1)':'#fff7ed', border:`1.5px solid ${isDarkMode?'rgba(249,115,22,0.25)':'#fed7aa'}`, borderRadius:14, padding:'10px 14px', marginBottom:20 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#f97316,#f43f5e)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:900, fontSize:14, flexShrink:0, overflow:'hidden' }}>
                {selectedTeacher?.photo
                  ? <img src={selectedTeacher.photo} alt="" style={{ width:34, height:34, objectFit:'cover' }} />
                  : (selectedTeacher?.firstName?.[0]||'T').toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:col.accent }}>{selectedTeacher?.firstName} {selectedTeacher?.lastName}</div>
                <div style={{ fontSize:11, color:col.muted }}>Fill in your class details below</div>
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Class Title */}
              <div>
                <label style={lbl}>Class Title *</label>
                <input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Speaking Practice"
                  style={inp}
                />
              </div>

              {/* Topic */}
              <div>
                <label style={lbl}>Topic *</label>
                <input
                  value={formTopic}
                  onChange={e => setFormTopic(e.target.value)}
                  placeholder="e.g. Job interviews, IELTS writing"
                  style={inp}
                />
              </div>

              {/* Date */}
              <div>
                <label style={lbl}>Date *</label>
                <input
                  type="date"
                  value={formDate}
                  min={todayStr}
                  onChange={e => handleDateChange(e.target.value)}
                  style={inpPicker}
                />
              </div>

              {/* Start / End time */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Start Time *</label>
                  <input
                    type="time"
                    value={formStart}
                    min={HOUR_MIN_STR}
                    max={HOUR_MAX_STR}
                    onChange={e => handleStartChange(e.target.value)}
                    style={inpPicker}
                  />
                </div>
                <div>
                  <label style={lbl}>End Time *</label>
                  <input
                    type="time"
                    value={formEnd}
                    min={formStart || HOUR_MIN_STR}
                    max={HOUR_MAX_STR}
                    onChange={e => handleEndChange(e.target.value)}
                    style={inpPicker}
                  />
                </div>
              </div>

              {/* Duration (auto-calculated, read-only) */}
              {formDuration > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:8, background:isDarkMode?'rgba(16,185,129,0.08)':'#f0fdf4', border:`1.5px solid ${isDarkMode?'rgba(16,185,129,0.25)':'#86efac'}`, borderRadius:12, padding:'10px 14px' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#10b981', flexShrink:0 }}/>
                  <span style={{ fontSize:13, fontWeight:800, color:'#10b981' }}>
                    Class duration: <strong>{formDuration} minutes</strong>
                    {formStart && formEnd && (
                      <span style={{ fontWeight:600, opacity:0.85 }}> &nbsp;({fmt12(formStart)} – {fmt12(formEnd)})</span>
                    )}
                  </span>
                </div>
              )}

              {/* Time clash error */}
              {timeError && (
                <div style={{ display:'flex', gap:8, alignItems:'flex-start', background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:12, padding:'10px 14px' }}>
                  <AlertCircle size={16} color='#dc2626' style={{ flexShrink:0, marginTop:1 }}/>
                  <span style={{ fontSize:13, fontWeight:700, color:'#dc2626', lineHeight:1.5 }}>{timeError}</span>
                </div>
              )}

              {/* Notes */}
              <div>
                <label style={lbl}>Notes for teacher (optional)</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={3}
                  placeholder="Anything specific you'd like to cover…"
                  style={{ ...inp, resize:'vertical' }}
                />
              </div>
            </div>

            <p style={{ fontSize:12, color:col.muted, margin:'14px 0 20px', fontWeight:600 }}>
              The teacher will accept or decline your request. Credits are only deducted when the class is completed.
            </p>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={() => setShowModal(false)} style={btn(isDarkMode?'#2a2d40':'#f5f0ec', col.body)}>Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formTitle || !formTopic || !formDate || !formStart || !formEnd || !!timeError}
                style={btn('linear-gradient(135deg,#f97316,#f43f5e)','#fff', submitting || !formTitle || !formTopic || !formDate || !formStart || !formEnd || !!timeError)}>
                {submitting ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
