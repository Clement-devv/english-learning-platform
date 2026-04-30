// src/pages/admin/tabs/GroupClassesTab.jsx
// Admin view: create, list, manage enrollments, complete/cancel group classes.
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, X, ChevronDown, ChevronUp, RefreshCw, Loader2 } from 'lucide-react';
import api from '../../../api';
import { formatDateInTZ, getUserTimezone, tzAbbr } from '../../../utils/timezone';

const F = "'Nunito','Inter',sans-serif";
const adminTZ = getUserTimezone();

const LEVELS   = ['A1','A2','B1','B2','C1','C2','Mixed'];
const STATUSES = ['open','full','in-progress','completed','cancelled'];

// Show the time in the teacher's stored timezone (if available) + admin's local time
const fmtDate = (iso, teacherTimezone) => {
  if (teacherTimezone && teacherTimezone !== adminTZ) {
    const teacherTime = formatDateInTZ(iso, teacherTimezone);
    const adminTime   = formatDateInTZ(iso, adminTZ);
    const tAbbr = tzAbbr(teacherTimezone);
    const aAbbr = tzAbbr(adminTZ);
    return `${teacherTime} ${tAbbr} · ${adminTime} ${aAbbr} (you)`;
  }
  return `${formatDateInTZ(iso, adminTZ)} (${tzAbbr(adminTZ)})`;
};

const STATUS_COLOR = {
  open:        '#10b981',
  full:        '#f59e0b',
  'in-progress':'#3b82f6',
  completed:   '#6b7280',
  cancelled:   '#ef4444',
};

function Badge({ status }) {
  return (
    <span style={{ background: STATUS_COLOR[status] + '22', color: STATUS_COLOR[status], borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
      {status}
    </span>
  );
}

const BLANK_FORM = {
  title: '', description: '', level: 'Mixed', maxSeats: 8,
  pricePerSeat: 1, scheduledTime: '', duration: 60, notes: '', tags: '',
  teacherId: '',
};

export default function GroupClassesTab({ isDarkMode }) {
  const col = {
    bg:      isDarkMode ? '#0f1117' : '#fff8f0',
    card:    isDarkMode ? '#1a1d2e' : '#ffffff',
    border:  isDarkMode ? '#2a2d40' : '#ffe8cc',
    heading: isDarkMode ? '#f0f4ff' : '#3d2e20',
    body:    isDarkMode ? '#c8cce0' : '#5a4a3a',
    muted:   isDarkMode ? '#6b7090' : '#a89480',
    accent:  isDarkMode ? '#fbbf24' : '#f97316',
    input:   isDarkMode ? '#0f1117' : '#fff8f0',
  };

  const [classes,    setClasses]    = useState([]);
  const [teachers,   setTeachers]   = useState([]);
  const [students,   setStudents]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [msg,        setMsg]        = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded,   setExpanded]   = useState({});

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form,       setForm]       = useState(BLANK_FORM);
  const [saving,     setSaving]     = useState(false);

  // enroll modal
  const [enrollTarget, setEnrollTarget] = useState(null);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrolling,  setEnrolling]  = useState(false);

  // attendance modal
  const [attTarget,  setAttTarget]  = useState(null);
  const [attMap,     setAttMap]     = useState({});

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const [gcRes, tRes, sRes] = await Promise.all([
        api.get(`/group-classes${params}`),
        api.get('/teachers'),
        api.get('/students'),
      ]);
      setClasses(gcRes.data.classes || []);
      setTeachers(tRes.data?.teachers || tRes.data || []);
      setStudents(sRes.data?.students || sRes.data || []);
    } catch (e) {
      flash('Failed to load group classes');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const teacherName = (id) => {
    const t = teachers.find(t => t._id === id || t._id?.toString() === id?.toString());
    return t ? `${t.firstName} ${t.lastName}` : id;
  };

  const handleCreate = async () => {
    if (!form.title || !form.scheduledTime || !form.teacherId) {
      return flash('Title, teacher and scheduled time are required');
    }
    setSaving(true);
    try {
      await api.post('/group-classes', {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      });
      flash('Group class created');
      setShowCreate(false);
      setForm(BLANK_FORM);
      load();
    } catch (e) {
      flash(e.response?.data?.message || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const handleEnroll = async () => {
    if (!enrollStudentId) return flash('Select a student');
    setEnrolling(true);
    try {
      await api.post(`/group-classes/${enrollTarget._id}/enroll`, { studentId: enrollStudentId });
      flash('Student enrolled');
      setEnrollTarget(null);
      setEnrollStudentId('');
      load();
    } catch (e) {
      flash(e.response?.data?.message || 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  };

  const handleRemoveEnrollment = async (gcId, studentId) => {
    if (!window.confirm('Remove this student and refund credits?')) return;
    try {
      await api.delete(`/group-classes/${gcId}/enroll/${studentId}`);
      flash('Enrollment removed');
      load();
    } catch (e) {
      flash(e.response?.data?.message || 'Failed to remove');
    }
  };

  const handleComplete = async (gcId) => {
    if (!window.confirm('Mark this class as completed?')) return;
    try {
      await api.patch(`/group-classes/${gcId}/complete`);
      flash('Class completed');
      load();
    } catch (e) {
      flash(e.response?.data?.message || 'Failed');
    }
  };

  const handleCancel = async (gcId) => {
    const reason = window.prompt('Reason for cancellation (optional):') ?? '';
    if (reason === null) return;
    try {
      await api.patch(`/group-classes/${gcId}/cancel`, { reason });
      flash('Class cancelled and credits refunded');
      load();
    } catch (e) {
      flash(e.response?.data?.message || 'Failed');
    }
  };

  const openAttendance = (gc) => {
    const map = {};
    (gc.enrollments || []).forEach(e => {
      const sid = e.studentId?._id || e.studentId;
      map[sid] = e.attendance || 'pending';
    });
    setAttMap(map);
    setAttTarget(gc);
  };

  const saveAttendance = async () => {
    const attendance = Object.entries(attMap).map(([studentId, status]) => ({ studentId, status }));
    try {
      await api.patch(`/group-classes/${attTarget._id}/attendance`, { attendance });
      flash('Attendance saved');
      setAttTarget(null);
      load();
    } catch (e) {
      flash('Failed to save attendance');
    }
  };

  const card = { background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 20, marginBottom: 12, fontFamily: F };
  const inp  = { width: '100%', background: col.input, border: `1.5px solid ${col.border}`, borderRadius: 12, padding: '9px 12px', fontSize: 14, color: col.body, fontFamily: F, outline: 'none' };
  const btn  = (grad, text='#fff') => ({ background: grad, color: text, border: 'none', borderRadius: 12, padding: '9px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: F });

  return (
    <div style={{ fontFamily: F }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: col.heading }}>Group Classes</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: col.muted }}>{classes.length} class{classes.length !== 1 ? 'es' : ''}</p>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 140 }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} style={{ ...btn('#f5f0ec', col.body), padding: '9px 12px' }}><RefreshCw size={15} /></button>
        <button onClick={() => setShowCreate(true)} style={{ ...btn('linear-gradient(135deg,#f97316,#f43f5e)'), display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New Class
        </button>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith('Failed') || msg.includes('fail') ? '#fef2f2' : '#f0fdf4', border: `1.5px solid ${msg.startsWith('Failed') || msg.includes('fail') ? '#fecaca' : '#bbf7d0'}`, borderRadius: 12, padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 700, color: msg.startsWith('Failed') || msg.includes('fail') ? '#dc2626' : '#16a34a' }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={32} color={col.accent} style={{ animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : classes.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <Users size={40} color={col.muted} style={{ margin: '0 auto 12px' }} />
          <p style={{ color: col.muted, fontWeight: 700 }}>No group classes yet</p>
        </div>
      ) : (
        classes.map(gc => {
          const isOpen = expanded[gc._id];
          return (
            <div key={gc._id} style={card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer' }} onClick={() => setExpanded(p => ({ ...p, [gc._id]: !p[gc._id] }))}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: col.heading }}>{gc.title}</span>
                    <Badge status={gc.status} />
                    <span style={{ fontSize: 12, color: col.muted, background: isDarkMode ? '#2a2d40' : '#fff7ed', borderRadius: 999, padding: '2px 8px' }}>{gc.level}</span>
                  </div>
                  <div style={{ fontSize: 13, color: col.muted, marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>👨‍🏫 {teacherName(gc.teacherId?._id || gc.teacherId)}</span>
                    <span>📅 {fmtDate(gc.scheduledTime, gc.teacherTimezone)}</span>
                    <span>⏱ {gc.duration}min</span>
                    <span>👥 {gc.enrollments?.length || 0}/{gc.maxSeats} seats</span>
                    <span>💳 {gc.pricePerSeat} credit/seat</span>
                  </div>
                </div>
                {isOpen ? <ChevronUp size={18} color={col.muted} /> : <ChevronDown size={18} color={col.muted} />}
              </div>

              {isOpen && (
                <div style={{ borderTop: `1.5px solid ${col.border}`, marginTop: 14, paddingTop: 14 }}>
                  {gc.description && <p style={{ fontSize: 13, color: col.body, margin: '0 0 10px' }}>{gc.description}</p>}

                  {/* Enrolled students */}
                  <p style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>Enrolled Students</p>
                  {(gc.enrollments || []).length === 0 ? (
                    <p style={{ fontSize: 13, color: col.muted, marginBottom: 12 }}>No students enrolled yet</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {gc.enrollments.map((e, i) => {
                        const sid = e.studentId?._id || e.studentId;
                        const sName = e.studentId?.firstName
                          ? `${e.studentId.firstName} ${e.studentId.lastName}`
                          : students.find(s => s._id === sid || s._id?.toString() === sid?.toString())?.firstName
                            ? `${students.find(s => s._id?.toString() === sid?.toString()).firstName} ${students.find(s => s._id?.toString() === sid?.toString()).lastName}`
                            : sid;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: isDarkMode ? '#0f1117' : '#fff8f0', borderRadius: 10, padding: '7px 12px' }}>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: col.body }}>{sName}</span>
                            <span style={{ fontSize: 12, color: STATUS_COLOR[e.attendance] || col.muted }}>{e.attendance}</span>
                            <span style={{ fontSize: 12, color: col.muted }}>{e.creditCharged} cr</span>
                            {!['completed','cancelled'].includes(gc.status) && (
                              <button onClick={() => handleRemoveEnrollment(gc._id, sid)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0 }}>
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {gc.status === 'open' && (
                      <button onClick={() => { setEnrollTarget(gc); setEnrollStudentId(''); }}
                        style={btn('linear-gradient(135deg,#10b981,#34d399)')}>
                        + Enroll Student
                      </button>
                    )}
                    {['in-progress','open','full'].includes(gc.status) && (
                      <button onClick={() => openAttendance(gc)}
                        style={btn('linear-gradient(135deg,#3b82f6,#60a5fa)')}>
                        Mark Attendance
                      </button>
                    )}
                    {['open','full','in-progress'].includes(gc.status) && (
                      <button onClick={() => handleComplete(gc._id)}
                        style={btn('linear-gradient(135deg,#f97316,#f43f5e)')}>
                        Complete
                      </button>
                    )}
                    {!['completed','cancelled'].includes(gc.status) && (
                      <button onClick={() => handleCancel(gc._id)}
                        style={btn('#fef2f2', '#dc2626')}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: col.card, borderRadius: 24, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', fontFamily: F }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col.heading, flex: 1 }}>New Group Class</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color={col.muted} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Teacher *</label>
                <select value={form.teacherId} onChange={e => setForm(p => ({ ...p, teacherId: e.target.value }))} style={{ ...inp, marginTop: 4 }}>
                  <option value="">Select teacher</option>
                  {teachers.map(t => <option key={t._id} value={t._id}>{t.firstName} {t.lastName}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. B1 Conversation Class" style={{ ...inp, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ ...inp, marginTop: 4, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Level</label>
                  <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))} style={{ ...inp, marginTop: 4 }}>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Max Seats</label>
                  <input type="number" min={2} max={20} value={form.maxSeats} onChange={e => setForm(p => ({ ...p, maxSeats: +e.target.value }))} style={{ ...inp, marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Credits/Seat</label>
                  <input type="number" min={1} value={form.pricePerSeat} onChange={e => setForm(p => ({ ...p, pricePerSeat: +e.target.value }))} style={{ ...inp, marginTop: 4 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Scheduled Time *</label>
                  <input type="datetime-local" value={form.scheduledTime} onChange={e => setForm(p => ({ ...p, scheduledTime: e.target.value }))} style={{ ...inp, marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Duration (min)</label>
                  <input type="number" min={15} max={300} value={form.duration} onChange={e => setForm(p => ({ ...p, duration: +e.target.value }))} style={{ ...inp, marginTop: 4 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Tags (comma-separated)</label>
                <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="grammar, speaking, IELTS" style={{ ...inp, marginTop: 4 }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} style={btn(isDarkMode ? '#2a2d40' : '#f5f0ec', col.body)}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} style={btn('linear-gradient(135deg,#f97316,#f43f5e)')}>
                {saving ? 'Creating...' : 'Create Class'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Enroll Modal ── */}
      {enrollTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: col.card, borderRadius: 24, padding: 28, width: '100%', maxWidth: 400, fontFamily: F }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: col.heading, flex: 1 }}>Enroll Student</h3>
              <button onClick={() => setEnrollTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color={col.muted} /></button>
            </div>
            <p style={{ fontSize: 13, color: col.muted, margin: '0 0 12px' }}>Class: <strong>{enrollTarget.title}</strong> — {enrollTarget.enrollments?.length || 0}/{enrollTarget.maxSeats} seats</p>
            <select value={enrollStudentId} onChange={e => setEnrollStudentId(e.target.value)} style={{ ...inp, marginBottom: 16 }}>
              <option value="">Select student</option>
              {students
                .filter(s => !enrollTarget.enrollments?.some(e => (e.studentId?._id || e.studentId)?.toString() === s._id?.toString()))
                .map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.classCredits} credits)</option>)}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setEnrollTarget(null)} style={btn(isDarkMode ? '#2a2d40' : '#f5f0ec', col.body)}>Cancel</button>
              <button onClick={handleEnroll} disabled={enrolling} style={btn('linear-gradient(135deg,#10b981,#34d399)')}>
                {enrolling ? 'Enrolling...' : 'Enroll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attendance Modal ── */}
      {attTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: col.card, borderRadius: 24, padding: 28, width: '100%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto', fontFamily: F }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: col.heading, flex: 1 }}>Mark Attendance</h3>
              <button onClick={() => setAttTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color={col.muted} /></button>
            </div>
            <p style={{ fontSize: 13, color: col.muted, margin: '0 0 16px' }}>{attTarget.title}</p>
            {attTarget.enrollments?.map((e, i) => {
              const sid = e.studentId?._id || e.studentId;
              const sName = e.studentId?.firstName
                ? `${e.studentId.firstName} ${e.studentId.lastName}`
                : students.find(s => s._id?.toString() === sid?.toString())?.firstName
                  ? `${students.find(s => s._id?.toString() === sid?.toString()).firstName} ${students.find(s => s._id?.toString() === sid?.toString()).lastName}`
                  : sid;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: col.body }}>{sName}</span>
                  <select value={attMap[sid] || 'pending'} onChange={ev => setAttMap(p => ({ ...p, [sid]: ev.target.value }))}
                    style={{ ...inp, width: 130 }}>
                    <option value="pending">Pending</option>
                    <option value="attended">Attended</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setAttTarget(null)} style={btn(isDarkMode ? '#2a2d40' : '#f5f0ec', col.body)}>Cancel</button>
              <button onClick={saveAttendance} style={btn('linear-gradient(135deg,#3b82f6,#60a5fa)')}>Save Attendance</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
