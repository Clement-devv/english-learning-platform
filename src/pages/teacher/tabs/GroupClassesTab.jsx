// src/pages/teacher/tabs/GroupClassesTab.jsx
// Teacher view: create own group classes, view enrollments, join classroom, mark attendance/complete.
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, X, ChevronDown, ChevronUp, Video, RefreshCw, Loader2, Lock, Globe, Search, UserMinus } from 'lucide-react';
import api from '../../../api';
import Classroom from '../../Classroom';
import DateTimePicker from '../../../components/DateTimePicker';
import { formatDateInTZ, getUserTimezone, tzAbbr } from '../../../utils/timezone';

const F = "'Nunito','Inter',sans-serif";
const LEVELS   = ['A1','A2','B1','B2','C1','C2','Mixed'];
const STATUSES = ['open','full','in-progress','completed','cancelled'];
const myTZ = getUserTimezone();

const fmtDate = (iso) => {
  const label = formatDateInTZ(iso, myTZ);
  const abbr  = tzAbbr(myTZ);
  return `${label} (${abbr})`;
};

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
  enrollmentMode: 'open',
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

  const [activeClass,    setActiveClass]    = useState(null);
  const [inviteTarget,   setInviteTarget]   = useState(null);   // gc being managed
  const [inviteSearch,   setInviteSearch]   = useState('');
  const [inviteResults,  setInviteResults]  = useState([]);
  const [inviteLoading,  setInviteLoading]  = useState(false);

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
        enrollmentMode: form.enrollmentMode || 'open',
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

  const searchStudents = async (q) => {
    setInviteSearch(q);
    if (!q.trim()) { setInviteResults([]); return; }
    setInviteLoading(true);
    try {
      const { data } = await api.get(`/group-classes/students/search?q=${encodeURIComponent(q)}`);
      setInviteResults(data.students || []);
    } catch { setInviteResults([]); }
    finally { setInviteLoading(false); }
  };

  const addInvite = async (studentId) => {
    if (!inviteTarget) return;
    try {
      await api.patch(`/group-classes/${inviteTarget._id}/invite`, { add: studentId });
      setInviteTarget(prev => ({
        ...prev,
        invitedStudents: [...(prev.invitedStudents || []), studentId],
      }));
      setInviteResults([]);
      setInviteSearch('');
      load();
    } catch (e) { flash(e.response?.data?.message || 'Failed to invite'); }
  };

  const removeInvite = async (studentId) => {
    if (!inviteTarget) return;
    try {
      await api.patch(`/group-classes/${inviteTarget._id}/invite`, { remove: studentId });
      setInviteTarget(prev => ({
        ...prev,
        invitedStudents: (prev.invitedStudents || []).filter(id =>
          (id._id || id).toString() !== studentId.toString()
        ),
      }));
      load();
    } catch (e) { flash(e.response?.data?.message || 'Failed to remove'); }
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
        classData={{ id: activeClass._id, title: activeClass.title, isGroupClass: true }}
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
                    {gc.enrollmentMode === 'invite-only' && (
                      <span style={{ fontSize: 11, background: '#6366f122', color: '#6366f1', borderRadius: 999, padding: '2px 8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Lock size={10} /> Invite-Only
                      </span>
                    )}
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
                    {gc.enrollmentMode === 'invite-only' && ['open','full'].includes(gc.status) && (
                      <button onClick={() => { setInviteTarget(gc); setInviteSearch(''); setInviteResults([]); }}
                        style={{ ...btn('linear-gradient(135deg,#6366f1,#8b5cf6)'), display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Lock size={13} /> Manage Invites ({(gc.invitedStudents || []).length})
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
                  <DateTimePicker
                    value={form.scheduledTime}
                    onChange={v => setForm(p => ({ ...p, scheduledTime: v }))}
                    placeholder="Pick date & time"
                    isDarkMode={isDarkMode}
                    inputStyle={{ ...inp, marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Duration (min)</label>
                  <input type="number" min={15} max={300} value={form.duration} onChange={e => setForm(p => ({ ...p, duration: +e.target.value }))} style={{ ...inp, marginTop: 4 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Enrollment Mode</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  {[
                    { val: 'open',         label: '🌐 Open',         hint: 'Any student with credits can join' },
                    { val: 'invite-only',  label: '🔒 Invite-Only',  hint: 'Only students you invite can enroll' },
                  ].map(m => (
                    <button key={m.val} onClick={() => setForm(p => ({ ...p, enrollmentMode: m.val }))} style={{
                      flex: 1, border: `2px solid ${form.enrollmentMode === m.val ? col.accent : col.border}`,
                      background: form.enrollmentMode === m.val ? col.accent + '18' : 'transparent',
                      borderRadius: 12, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: F,
                    }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: form.enrollmentMode === m.val ? col.accent : col.heading }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: col.muted, marginTop: 2 }}>{m.hint}</div>
                    </button>
                  ))}
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

      {/* ── Invite Management Modal ── */}
      {inviteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: col.card, borderRadius: 24, padding: 28, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', fontFamily: F }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <Lock size={16} color={col.accent} style={{ marginRight: 8 }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: col.heading, flex: 1 }}>Manage Invites — {inviteTarget.title}</h3>
              <button onClick={() => setInviteTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color={col.muted} /></button>
            </div>
            <p style={{ fontSize: 13, color: col.muted, margin: '0 0 14px' }}>Only invited students can enroll. Search by name or email.</p>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={14} color={col.muted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={inviteSearch}
                onChange={e => searchStudents(e.target.value)}
                placeholder="Search students…"
                style={{ ...inp, paddingLeft: 34 }}
              />
            </div>

            {/* Search results */}
            {inviteLoading && <p style={{ fontSize: 13, color: col.muted }}>Searching…</p>}
            {inviteResults.length > 0 && (
              <div style={{ border: `1.5px solid ${col.border}`, borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
                {inviteResults.map(s => {
                  const alreadyInvited = (inviteTarget.invitedStudents || []).some(
                    id => (id._id || id).toString() === s._id.toString()
                  );
                  return (
                    <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${col.border}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: col.heading }}>{s.firstName} {s.lastName}</div>
                        <div style={{ fontSize: 11, color: col.muted }}>{s.email} · {s.classCredits ?? 0} credits</div>
                      </div>
                      {alreadyInvited
                        ? <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓ Invited</span>
                        : <button onClick={() => addInvite(s._id)} style={{ ...btn('linear-gradient(135deg,#10b981,#34d399)'), padding: '6px 14px', fontSize: 12 }}>Invite</button>
                      }
                    </div>
                  );
                })}
              </div>
            )}

            {/* Current invited list */}
            <p style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>
              Invited Students ({(inviteTarget.invitedStudents || []).length})
            </p>
            {(inviteTarget.invitedStudents || []).length === 0
              ? <p style={{ fontSize: 13, color: col.muted }}>No students invited yet.</p>
              : (inviteTarget.invitedStudents || []).map((entry, i) => {
                  const id   = entry._id || entry;
                  const name = entry.firstName ? `${entry.firstName} ${entry.lastName}` : String(id).slice(-6);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: isDarkMode ? '#0f1117' : '#fff8f0', borderRadius: 10, marginBottom: 6 }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: col.body }}>{name}</span>
                      <button onClick={() => removeInvite(id)} title="Remove invite" style={{ background: '#ef444420', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <UserMinus size={13} /> Remove
                      </button>
                    </div>
                  );
                })
            }

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setInviteTarget(null)} style={btn('linear-gradient(135deg,#6366f1,#8b5cf6)')}>Done</button>
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
