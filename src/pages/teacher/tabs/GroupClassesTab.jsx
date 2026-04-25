// src/pages/teacher/tabs/GroupClassesTab.jsx
// Teacher view: create own group classes, view enrollments, join classroom, mark attendance/complete.
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, X, ChevronDown, ChevronUp, Video, RefreshCw, Loader2 } from 'lucide-react';
import api from '../../../api';
import Classroom from '../../Classroom';

const F = "'Nunito','Inter',sans-serif";
const LEVELS   = ['A1','A2','B1','B2','C1','C2','Mixed'];
const STATUSES = ['open','full','in-progress','completed','cancelled'];

const fmtDate = (iso) =>
  new Date(iso).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

const STATUS_COLOR = {
  open:         '#10b981',
  full:         '#f59e0b',
  'in-progress':'#3b82f6',
  completed:    '#6b7280',
  cancelled:    '#ef4444',
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

  const [classes,      setClasses]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [msg,          setMsg]          = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded,     setExpanded]     = useState({});

  const [showCreate, setShowCreate] = useState(false);
  const [form,       setForm]       = useState(BLANK_FORM);
  const [saving,     setSaving]     = useState(false);

  const [attTarget,  setAttTarget]  = useState(null);
  const [attMap,     setAttMap]     = useState({});

  const [activeClass, setActiveClass] = useState(null);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/group-classes${params}`);
      setClasses(res.data.classes || []);
    } catch {
      flash('Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.title || !form.scheduledTime) return flash('Title and scheduled time are required');
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

  const handleStart = async (gc) => {
    try {
      await api.patch(`/group-classes/${gc._id}/start`);
      setActiveClass(gc);
    } catch (e) {
      flash(e.response?.data?.message || 'Failed to start');
    }
  };

  const handleJoin = (gc) => setActiveClass(gc);

  const handleComplete = async (gcId) => {
    if (!window.confirm('Mark this class as completed?')) return;
    const attendance = Object.entries(attMap).map(([studentId, status]) => ({ studentId, status }));
    try {
      await api.patch(`/group-classes/${gcId}/complete`, { attendance });
      flash('Class completed');
      setAttTarget(null);
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
    } catch {
      flash('Failed to save attendance');
    }
  };

  if (activeClass) {
    return (
      <Classroom
        classData={{ id: activeClass._id, title: activeClass.title }}
        userRole="teacher"
        onLeave={() => { setActiveClass(null); load(); }}
      />
    );
  }

  const card = { background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 20, marginBottom: 12, fontFamily: F };
  const inp  = { width: '100%', background: col.input, border: `1.5px solid ${col.border}`, borderRadius: 12, padding: '9px 12px', fontSize: 14, color: col.body, fontFamily: F, outline: 'none' };
  const btn  = (grad, text='#fff') => ({ background: grad, color: text, border: 'none', borderRadius: 12, padding: '9px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: F });

  return (
    <div style={{ fontFamily: F }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: col.heading }}>My Group Classes</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: col.muted }}>{classes.length} class{classes.length !== 1 ? 'es' : ''}</p>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 140 }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} style={{ ...btn('#f5f0ec', col.body), padding: '9px 12px' }}><RefreshCw size={15} /></button>
        <button onClick={() => setShowCreate(true)} style={{ ...btn('linear-gradient(135deg,#f97316,#f43f5e)'), display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New Group Class
        </button>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith('Failed') ? '#fef2f2' : '#f0fdf4', border: `1.5px solid ${msg.startsWith('Failed') ? '#fecaca' : '#bbf7d0'}`, borderRadius: 12, padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 700, color: msg.startsWith('Failed') ? '#dc2626' : '#16a34a' }}>
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
          <p style={{ color: col.muted, fontWeight: 700 }}>No group classes yet. Create your first one!</p>
        </div>
      ) : (
        classes.map(gc => {
          const isOpen = expanded[gc._id];
          const canJoin = gc.status === 'in-progress';
          const canStart = gc.status === 'open' || gc.status === 'full';

          return (
            <div key={gc._id} style={card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpanded(p => ({ ...p, [gc._id]: !p[gc._id] }))}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: col.heading }}>{gc.title}</span>
                    <Badge status={gc.status} />
                    <span style={{ fontSize: 12, color: col.muted, background: isDarkMode ? '#2a2d40' : '#fff7ed', borderRadius: 999, padding: '2px 8px' }}>{gc.level}</span>
                  </div>
                  <div style={{ fontSize: 13, color: col.muted, marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span>📅 {fmtDate(gc.scheduledTime)}</span>
                    <span>⏱ {gc.duration}min</span>
                    <span>👥 {gc.enrollments?.length || 0}/{gc.maxSeats} enrolled</span>
                    <span>💳 {gc.pricePerSeat} cr/seat</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {canStart && (
                    <button onClick={() => handleStart(gc)} style={{ ...btn('linear-gradient(135deg,#3b82f6,#60a5fa)'), display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Video size={13} /> Start
                    </button>
                  )}
                  {canJoin && (
                    <button onClick={() => handleJoin(gc)} style={{ ...btn('linear-gradient(135deg,#10b981,#34d399)'), display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Video size={13} /> Join
                    </button>
                  )}
                  <button onClick={() => setExpanded(p => ({ ...p, [gc._id]: !p[gc._id] }))} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    {isOpen ? <ChevronUp size={18} color={col.muted} /> : <ChevronDown size={18} color={col.muted} />}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: `1.5px solid ${col.border}`, marginTop: 14, paddingTop: 14 }}>
                  {gc.description && <p style={{ fontSize: 13, color: col.body, margin: '0 0 12px' }}>{gc.description}</p>}

                  <p style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>Enrolled Students</p>
                  {(gc.enrollments || []).length === 0 ? (
                    <p style={{ fontSize: 13, color: col.muted, marginBottom: 10 }}>No students enrolled yet</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {gc.enrollments.map((e, i) => {
                        const sName = e.studentId?.firstName
                          ? `${e.studentId.firstName} ${e.studentId.lastName}`
                          : 'Student';
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: isDarkMode ? '#0f1117' : '#fff8f0', borderRadius: 10, padding: '7px 12px' }}>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: col.body }}>{sName}</span>
                            <span style={{ fontSize: 12, color: STATUS_COLOR[e.attendance] || col.muted }}>{e.attendance}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['in-progress','open','full'].includes(gc.status) && (
                      <button onClick={() => openAttendance(gc)} style={btn('linear-gradient(135deg,#3b82f6,#60a5fa)')}>
                        Mark Attendance
                      </button>
                    )}
                    {['open','full','in-progress'].includes(gc.status) && (
                      <button onClick={() => handleComplete(gc._id)} style={btn('linear-gradient(135deg,#f97316,#f43f5e)')}>
                        Mark Complete
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
                <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="grammar, speaking" style={{ ...inp, marginTop: 4 }} />
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
              const sName = e.studentId?.firstName ? `${e.studentId.firstName} ${e.studentId.lastName}` : 'Student';
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
