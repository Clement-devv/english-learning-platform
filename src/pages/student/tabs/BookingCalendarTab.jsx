// src/pages/student/tabs/BookingCalendarTab.jsx
// Student booking: pick a teacher → see their FREE time in your own timezone →
// tap a time → request. Free time comes from the server (working hours − time off
// − other classes), as real moments, so it is always shown in the student's clock.
// The teacher's own timezone is intentionally never shown to students.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, X, Loader, Calendar, AlertCircle, Globe, Clock } from 'lucide-react';
import api from '../../../api';
import { useOnDataChanged } from '../../../hooks/useLiveData';
import WeekCalendar, { Legend } from '../../../components/schedule/WeekCalendar';
import {
  getMonday, addDays, localYmd, localHHMM, fmtTime, fmtRange, fmtDay, viewerTz, tzName,
  startTimes, fitsFree, overlapsAny, sameDay,
} from '../../../utils/scheduleView';

const F = "'Nunito','Inter',sans-serif";
const DURATIONS = [30, 45, 60, 90];

export default function BookingCalendarTab({ isDarkMode }) {
  const col = {
    card:    isDarkMode ? '#1a1d2e' : '#ffffff',
    border:  isDarkMode ? '#2a2d40' : '#ffe8cc',
    heading: isDarkMode ? '#f0f4ff' : '#3d2e20',
    body:    isDarkMode ? '#c8cce0' : '#5a4a3a',
    muted:   isDarkMode ? '#6b7090' : '#a89480',
    accent:  isDarkMode ? '#fbbf24' : '#f97316',
  };
  const myTz = viewerTz();

  const [step,            setStep]            = useState('pick-teacher');
  const [teachers,        setTeachers]        = useState([]);
  const [loadingT,        setLoadingT]        = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [weekStart,       setWeekStart]       = useState(() => getMonday());
  const [cal,             setCal]             = useState({ free: [], blocks: [], hasHours: false });
  const [loading,         setLoading]         = useState(false);
  const [duration,        setDuration]        = useState(60);
  const [msg,             setMsg]             = useState('');

  // Request form
  const [modal,      setModal]      = useState(null); // { date: "YYYY-MM-DD", start: "HH:MM", duration }
  const [formTitle,  setFormTitle]  = useState('');
  const [formTopic,  setFormTopic]  = useState('');
  const [formNotes,  setFormNotes]  = useState('');
  const [submitting, setSubmitting] = useState(false);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000); };

  useEffect(() => {
    api.get('/teachers/for-booking')
      .then(res => setTeachers(res.data?.teachers || []))
      .catch(() => flash('Failed to load teachers'))
      .finally(() => setLoadingT(false));
  }, []);

  const loadWeek = useCallback(async () => {
    if (!selectedTeacher) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/teacher-availability/${selectedTeacher._id}/calendar`, {
        params: { from: weekStart.toISOString(), to: addDays(weekStart, 7).toISOString() },
      });
      setCal(data);
    } catch {
      flash('Failed to load schedule');
    } finally { setLoading(false); }
  }, [selectedTeacher, weekStart]);
  useEffect(() => { loadWeek(); }, [loadWeek]);
  useOnDataChanged(['schedule', 'bookings'], loadWeek); // live: free time changes as others book

  // ── What's bookable ────────────────────────────────────────────────────────
  const blocks = useMemo(() => cal.blocks || [], [cal.blocks]);
  const busy = blocks; // own classes + anonymous "busy" time
  const canBook = (start, mins) => {
    if (new Date(start) <= new Date()) return false;
    return cal.hasHours ? fitsFree(cal.free, start, mins) : !overlapsAny(busy, start, mins);
  };
  const nextTimes = useMemo(() => cal.hasHours ? startTimes(cal.free, duration, 30).slice(0, 8) : [], [cal.free, cal.hasHours, duration]);

  const items = useMemo(() => blocks.map(b => ({
    ...b,
    title: b.mine ? (b.kind === 'pending' ? 'Your request' : 'Your class') : 'Unavailable',
    sub: b.mine ? b.title : '',
    kind: b.mine ? b.kind : 'busy',
  })), [blocks]);

  // ── Request form ───────────────────────────────────────────────────────────
  const openRequest = (at) => {
    const start = at ? new Date(at) : (nextTimes[0] || new Date(Date.now() + 3600000));
    if (!at && !nextTimes[0]) start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
    setModal({ date: localYmd(start), start: localHHMM(start), duration });
    setFormTitle(''); setFormTopic(''); setFormNotes('');
  };
  const modalStart = modal ? new Date(`${modal.date}T${modal.start}:00`) : null;
  const modalEnd = modal ? new Date(modalStart.getTime() + modal.duration * 60000) : null;
  const dayOptions = useMemo(() => {
    if (!modal || !cal.hasHours) return [];
    const day = new Date(`${modal.date}T00:00:00`);
    return startTimes(cal.free, modal.duration, 30).filter(t => sameDay(t, day));
  }, [modal, cal.free, cal.hasHours]);
  const timeError = !modal ? '' :
    !modal.date || !modal.start ? 'Please choose a date and time.' :
    modalStart <= new Date() ? 'Please choose a time in the future.' :
    !canBook(modalStart, modal.duration) ? (cal.hasHours ? "That time isn't free for this teacher — pick one of the free times." : 'That time clashes with another class — please pick a different time.') : '';

  const handleSubmit = async () => {
    if (!formTitle.trim()) return flash('Please enter a class title');
    if (!formTopic.trim()) return flash('Please enter a class topic');
    if (timeError) return;
    setSubmitting(true);
    try {
      await api.post('/bookings/student-request', {
        teacherId: selectedTeacher._id, classTitle: formTitle, topic: formTopic, notes: formNotes,
        scheduledTime: modalStart.toISOString(), duration: modal.duration,
      });
      setModal(null);
      flash(`✅ Request sent for ${fmtDay(modalStart)}, ${fmtTime(modalStart)}. You'll be notified when the teacher confirms.`);
      loadWeek();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to send booking request');
      loadWeek();
    } finally { setSubmitting(false); }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inp = { width: '100%', background: isDarkMode ? '#0f1117' : '#fff8f0', border: `1.5px solid ${col.border}`, borderRadius: 12, padding: '9px 12px',
    fontSize: 14, color: col.body, fontFamily: F, outline: 'none', boxSizing: 'border-box', colorScheme: isDarkMode ? 'dark' : 'light' };
  const btn = (grad, txt = '#fff', dis = false) => ({ background: dis ? (isDarkMode ? '#2a2d40' : '#f5f0ec') : grad, color: dis ? col.muted : txt, border: 'none',
    borderRadius: 12, padding: '9px 18px', fontSize: 13, fontWeight: 800, cursor: dis ? 'default' : 'pointer', fontFamily: F });
  const lbl = { display: 'block', fontSize: 11, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 };
  const chip = (active) => ({ padding: '7px 12px', borderRadius: 999, border: `1.5px solid ${active ? col.accent : col.border}`, background: active ? (isDarkMode ? 'rgba(249,115,22,0.15)' : '#fff7ed') : 'transparent',
    color: active ? col.accent : col.body, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: F });
  const ORANGE = 'linear-gradient(135deg,#f97316,#f43f5e)';

  return (
    <div style={{ fontFamily: F }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .teacher-card{transition:transform .15s, box-shadow .15s} .teacher-card:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,0.10)!important}`}</style>

      {msg && (
        <div role="status" style={{ background: msg.startsWith('✅') ? (isDarkMode ? 'rgba(16,185,129,0.12)' : '#f0fdf4') : '#fef2f2', border: `1.5px solid ${msg.startsWith('✅') ? '#86efac' : '#fecaca'}`,
          borderRadius: 14, padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 700, color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</div>
      )}

      {/* ═════ STEP 1: PICK TEACHER ═════ */}
      {step === 'pick-teacher' && (
        <>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 900, color: col.heading }}>Book a Class</h2>
            <p style={{ margin: 0, fontSize: 13, color: col.muted }}>Choose a teacher to see their free times — shown in your own time ({tzName(myTz)})</p>
          </div>
          {loadingT ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader size={28} color={col.accent} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : teachers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: col.card, borderRadius: 20, border: `2px solid ${col.border}` }}>
              <Calendar size={40} color={col.muted} style={{ margin: '0 auto 12px' }} />
              <p style={{ color: col.muted, fontWeight: 700, margin: 0 }}>No teachers available right now</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
              {teachers.map(t => (
                <button key={t._id} type="button" className="teacher-card" onClick={() => { setSelectedTeacher(t); setStep('calendar'); setWeekStart(getMonday()); }}
                  style={{ textAlign: 'left', background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 20, cursor: 'pointer', fontFamily: F }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 18, flexShrink: 0, overflow: 'hidden' }}>
                      {t.photo ? <img src={t.photo} alt="" style={{ width: 48, height: 48, objectFit: 'cover' }} /> : (t.firstName?.[0] || 'T').toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: col.heading }}>{t.firstName} {t.lastName}</div>
                    </div>
                  </div>
                  {t.bio && <p style={{ fontSize: 12, color: col.body, margin: '0 0 10px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.bio}</p>}
                  {t.specializations?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                      {t.specializations.slice(0, 3).map(s => <span key={s} style={{ fontSize: 11, fontWeight: 700, background: isDarkMode ? 'rgba(249,115,22,0.12)' : '#fff7ed', color: col.accent, borderRadius: 999, padding: '2px 8px' }}>{s}</span>)}
                    </div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 700, color: col.accent }}>See free times →</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═════ STEP 2: FREE TIMES ═════ */}
      {step === 'calendar' && selectedTeacher && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setStep('pick-teacher')} style={{ ...btn(isDarkMode ? '#2a2d40' : '#f5f0ec', col.body), display: 'flex', alignItems: 'center', gap: 5 }}>
              <ChevronLeft size={14} /> Teachers
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16, overflow: 'hidden', flexShrink: 0 }}>
                {selectedTeacher.photo ? <img src={selectedTeacher.photo} alt="" style={{ width: 38, height: 38, objectFit: 'cover' }} /> : (selectedTeacher.firstName?.[0] || 'T').toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: col.heading }}>{selectedTeacher.firstName} {selectedTeacher.lastName}</div>
                <div style={{ fontSize: 12, color: col.muted, display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={11} /> Times are in your time: {tzName(myTz)}</div>
              </div>
            </div>
            <button type="button" onClick={() => openRequest()} disabled={cal.hidden}
              style={{ ...btn(ORANGE, '#fff', cal.hidden), marginLeft: 'auto', padding: '10px 18px' }}>+ Request a class</button>
          </div>

          {cal.hidden ? (
            <div style={{ padding: 24, borderRadius: 16, background: col.card, border: `2px solid ${col.border}`, color: col.body, fontWeight: 700, textAlign: 'center' }}>
              This teacher isn't taking bookings here right now.
            </div>
          ) : (
            <>
              <div style={{ padding: '12px 14px', borderRadius: 14, background: col.card, border: `2px solid ${col.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: col.heading, display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> Class length:</span>
                  {DURATIONS.map(d => <button key={d} type="button" onClick={() => setDuration(d)} style={chip(duration === d)}>{d} min</button>)}
                </div>
                {cal.hasHours ? (
                  nextTimes.length ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: col.heading }}>Next free times:</span>
                      {nextTimes.map(t => (
                        <button key={t.toISOString()} type="button" onClick={() => openRequest(t)}
                          style={{ ...chip(false), borderColor: '#10b981', color: isDarkMode ? '#6ee7b7' : '#047857', background: isDarkMode ? 'rgba(16,185,129,0.12)' : '#ecfdf5' }}>
                          {fmtDay(t)} · {fmtTime(t)}
                        </button>
                      ))}
                    </div>
                  ) : <span style={{ fontSize: 13, color: col.muted, fontWeight: 700 }}>No free {duration}-minute times this week — try next week or a shorter class.</span>
                ) : (
                  <span style={{ fontSize: 13, color: col.body, fontWeight: 600 }}>
                    This teacher hasn't set their working hours yet. Pick any time that suits you — they'll confirm or suggest another.
                  </span>
                )}
              </div>

              <Legend kinds={cal.hasHours ? ['free', 'booked', 'pending', 'busy'] : ['booked', 'pending', 'busy']} isDarkMode={isDarkMode} />
              <WeekCalendar
                weekStart={weekStart} onWeekChange={(w) => setWeekStart(w || getMonday())}
                free={cal.free} items={items} loading={loading} isDarkMode={isDarkMode}
                pickDuration={duration}
                onPickTime={cal.hasHours ? (at) => openRequest(at) : undefined}
                onEmptyClick={cal.hasHours ? undefined : (at) => openRequest(at)}
                emptyText={cal.hasHours ? 'No free time' : 'Nothing booked'}
              />
            </>
          )}
        </div>
      )}

      {/* ═════ REQUEST MODAL ═════ */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Request a class"
            style={{ background: col.card, borderRadius: 24, padding: 24, width: '100%', maxWidth: 480, fontFamily: F, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col.heading, flex: 1 }}>Request a class with {selectedTeacher?.firstName}</h3>
              <button type="button" aria-label="Close" onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color={col.muted} /></button>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 14, background: isDarkMode ? 'rgba(16,185,129,0.10)' : '#ecfdf5', border: '1.5px solid #86efac' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: isDarkMode ? '#6ee7b7' : '#047857' }}>
                {modalStart && !isNaN(modalStart) ? `${fmtDay(modalStart)} · ${fmtRange(modalStart, modalEnd)}` : 'Choose a time'}
              </div>
              <div style={{ fontSize: 12, color: col.body, marginTop: 2 }}>Your time ({tzName(myTz)}) · {modal.duration} minutes</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl} htmlFor="bk-date">Date</label>
                <input id="bk-date" type="date" value={modal.date} min={localYmd(new Date())} onChange={e => setModal(m => ({ ...m, date: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl} htmlFor="bk-start">Start</label>
                {cal.hasHours ? (
                  <select id="bk-start" value={modal.start} onChange={e => setModal(m => ({ ...m, start: e.target.value }))} style={inp}>
                    {!dayOptions.some(t => localHHMM(t) === modal.start) && <option value={modal.start}>{fmtTime(modalStart)} (not free)</option>}
                    {dayOptions.map(t => <option key={t.toISOString()} value={localHHMM(t)}>{fmtTime(t)}</option>)}
                  </select>
                ) : (
                  <input id="bk-start" type="time" step={900} value={modal.start} onChange={e => setModal(m => ({ ...m, start: e.target.value }))} style={inp} />
                )}
              </div>
              <div>
                <label style={lbl} htmlFor="bk-dur">Length</label>
                <select id="bk-dur" value={modal.duration} onChange={e => setModal(m => ({ ...m, duration: Number(e.target.value) }))} style={inp}>
                  {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
            </div>
            {cal.hasHours && dayOptions.length === 0 && <div style={{ fontSize: 12.5, color: col.muted, fontWeight: 700 }}>No free {modal.duration}-minute times on this day.</div>}

            {timeError && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, padding: '10px 14px' }}>
                <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', lineHeight: 1.5 }}>{timeError}</span>
              </div>
            )}

            <div>
              <label style={lbl} htmlFor="bk-title">Class title *</label>
              <input id="bk-title" value={formTitle} maxLength={200} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Speaking practice" style={inp} />
            </div>
            <div>
              <label style={lbl} htmlFor="bk-topic">Topic *</label>
              <input id="bk-topic" value={formTopic} maxLength={500} onChange={e => setFormTopic(e.target.value)} placeholder="e.g. Job interviews, IELTS writing" style={inp} />
            </div>
            <div>
              <label style={lbl} htmlFor="bk-notes">Notes for teacher (optional)</label>
              <textarea id="bk-notes" value={formNotes} maxLength={2000} onChange={e => setFormNotes(e.target.value)} rows={3} placeholder="Anything you'd like to cover…" style={{ ...inp, resize: 'vertical' }} />
            </div>

            <p style={{ fontSize: 12, color: col.muted, margin: 0, fontWeight: 600 }}>The teacher will accept or decline your request. A class is only used up when it's completed.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setModal(null)} style={btn(isDarkMode ? '#2a2d40' : '#f5f0ec', col.body)}>Cancel</button>
              <button type="button" onClick={handleSubmit} disabled={submitting || !formTitle.trim() || !formTopic.trim() || !!timeError}
                style={btn(ORANGE, '#fff', submitting || !formTitle.trim() || !formTopic.trim() || !!timeError)}>
                {submitting ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
