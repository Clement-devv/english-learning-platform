// src/pages/admin/tabs/GroupClassesTab.jsx
// Admin view: create, list, manage enrollments, complete/cancel group classes.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Plus, X, ChevronDown, ChevronUp, RefreshCw, Loader2 } from 'lucide-react';
import api from '../../../api';
import { useCurrencySymbol, fmtMoney } from "../../../hooks/useCurrencySymbol";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import Pagination from '../../../components/Pagination';
import StudentPicker from '../../../components/groupClass/StudentPicker';
import PlatformPicker from '../../../components/groupClass/PlatformPicker';
import { PLATFORM_META } from '../../../components/groupClass/platforms';

const GC_PAGE = 20;
import { formatDateInTZ, getUserTimezone, tzAbbr } from '../../../utils/timezone';
import { useTranslation } from "react-i18next";

const F = "'Nunito','Inter',sans-serif";
const adminTZ = getUserTimezone();

const LEVELS   = ['A1','A2','B1','B2','C1','C2','Mixed'];
const STATUSES = ['open','full','in-progress','completed','cancelled','missed'];

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
  completed:   'var(--a-ink-2)',
  cancelled:   '#ef4444',
  missed:       'var(--a-accent-ink)', // time passed, never held — refunded
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
  pointsPerSeat: 1,  // group points each student pays
  teacherFee: '',    // teacher's pay for the class (admin only; empty = center default)
  enrollmentMode: 'open', // 'invite-only' → only the students picked below can enroll
  invitedStudents: [],
  platform: 'agora',      // agora (in the app), googlemeet or zoom
  meetingLink: '',        // Meet / Zoom link for this class; empty = the teacher's saved link
};

// loadPeople: where the teacher / student pickers come from. Admins: everyone;
// sub-admins pass their own scoped list (SubAdminPanels).
const loadAllPeople = async () => {
  const [tRes, sRes] = await Promise.all([
    api.get('/teachers', { params: { limit: 5000 } }),
    api.get('/students', { params: { limit: 5000 } }),
  ]);
  return { teachers: tRes.data?.teachers || tRes.data || [], students: sRes.data?.students || sRes.data || [] };
};

// canSetFee: only the admin sets a class's teacher fee (sub-admins get the center default)
export default function GroupClassesTab({ isDarkMode, loadPeople = loadAllPeople, canSetFee = true }) {
  const sym = useCurrencySymbol();
  const { t: tr } = useTranslation("admin");
  const col = {
    bg:      'var(--a-raised)',
    card:    'var(--a-surface)',
    border:  'var(--a-line)',
    heading: 'var(--a-ink)',
    body:    'var(--a-ink-2)',
    muted:   'var(--a-muted)',
    accent:  'var(--a-accent-ink)',
    input:   'var(--a-raised)',
  };

  const [classes,    setClasses]    = useState([]);
  const [teachers,   setTeachers]   = useState([]);
  const [students,   setStudents]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [msg,        setMsg]        = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // upcoming + running by default
  const [gcPage,  setGcPage]  = useState(1);
  const [gcTotal, setGcTotal] = useState(0);
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

  // Live: refresh quietly (no spinner) when the server says this data changed
  const quietRef = useRef(false);
  useOnDataChanged(["group-classes"], () => { quietRef.current = true; load(); });

  const load = useCallback(async () => {
    if (!quietRef.current) setLoading(true);
    quietRef.current = false;
    try {
      // One page at a time (server returns the total)
      const params = `?skip=${(gcPage - 1) * GC_PAGE}&limit=${GC_PAGE}${statusFilter ? `&status=${statusFilter}` : ''}`;
      const [gcRes, people] = await Promise.all([
        api.get(`/group-classes${params}`),
        loadPeople(),
      ]);
      setClasses(gcRes.data.classes || []);
      setGcTotal(gcRes.data.total ?? 0);
      setTeachers(people.teachers || []);
      setStudents(people.students || []);
    } catch {
      flash(tr("groupClassesTab.failedToLoadGroupClasses"));
    } finally {
      setLoading(false);
    }
  }, [gcPage, statusFilter, tr, loadPeople]);

  useEffect(() => { load(); }, [load]);

  const teacherName = (id) => {
    const t = teachers.find(t => t._id === id || t._id?.toString() === id?.toString());
    return t ? `${t.firstName} ${t.lastName}` : id;
  };

  const handleCreate = async () => {
    if (!form.title || !form.scheduledTime || !form.teacherId) {
      return flash(tr("groupClassesTab.titleTeacherAndScheduledTime"));
    }
    if (form.enrollmentMode === 'invite-only' && form.invitedStudents.length === 0) {
      return flash(tr("groupClassesTab.pickAtLeastOneStudent"));
    }
    setSaving(true);
    try {
      const { teacherFee, ...rest } = form;
      await api.post('/group-classes', {
        ...rest,
        ...(canSetFee && teacherFee !== '' ? { teacherFee: Number(teacherFee) } : {}),
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      });
      flash(tr("groupClassesTab.groupClassCreated"));
      setShowCreate(false);
      setForm(BLANK_FORM);
      load();
    } catch (e) {
      flash(e.response?.data?.message || tr("groupClassesTab.failedToCreate"));
    } finally {
      setSaving(false);
    }
  };

  const handleEnroll = async () => {
    if (!enrollStudentId) return flash(tr("groupClassesTab.selectAStudent"));
    setEnrolling(true);
    try {
      await api.post(`/group-classes/${enrollTarget._id}/enroll`, { studentId: enrollStudentId });
      flash(tr("groupClassesTab.studentEnrolled"));
      setEnrollTarget(null);
      setEnrollStudentId('');
      load();
    } catch (e) {
      flash(e.response?.data?.message || tr("groupClassesTab.enrollmentFailed"));
    } finally {
      setEnrolling(false);
    }
  };

  const handleRemoveEnrollment = async (gcId, studentId) => {
    if (!window.confirm(tr("groupClassesTab.removeThisStudentAndRefund"))) return;
    try {
      await api.delete(`/group-classes/${gcId}/enroll/${studentId}`);
      flash(tr("groupClassesTab.enrollmentRemoved"));
      load();
    } catch (e) {
      flash(e.response?.data?.message || tr("groupClassesTab.failedToRemove"));
    }
  };

  const handleComplete = async (gcId) => {
    if (!window.confirm(tr("groupClassesTab.markThisClassAsCompleted"))) return;
    try {
      const { data } = await api.patch(`/group-classes/${gcId}/complete`);
      flash(data?.feePaid > 0 ? tr("groupClassesTab.completedFeePaid", { fee: fmtMoney(data.feePaid, sym) }) : tr("groupClassesTab.classCompleted"));
      load();
    } catch (e) {
      flash(e.response?.data?.message || tr("groupClassesTab.failed"));
    }
  };

  const handleCancel = async (gcId) => {
    const reason = window.prompt(tr("groupClassesTab.reasonForCancellationOptional")) ?? '';
    if (reason === null) return;
    try {
      await api.patch(`/group-classes/${gcId}/cancel`, { reason });
      flash(tr("groupClassesTab.classCancelledAndCreditsRefunded"));
      load();
    } catch (e) {
      flash(e.response?.data?.message || tr("groupClassesTab.failed"));
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
      const { data } = await api.patch(`/group-classes/${attTarget._id}/attendance`, { attendance });
      flash(data?.feePaid > 0 ? tr("groupClassesTab.attendanceFeePaid", { fee: fmtMoney(data.feePaid, sym) }) : tr("groupClassesTab.attendanceSaved"));
      setAttTarget(null);
      load();
    } catch {
      flash(tr("groupClassesTab.failedToSaveAttendance"));
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
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: col.heading }}>{tr("groupClassesTab.groupClasses")}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: col.muted }}>{tr("groupClassesTab.class", { gcTotal, value: gcTotal !== 1 ? 'es' : '' })}</p>
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setGcPage(1); }} style={{ ...inp, width: 140 }}>
          <option value="active">{tr("groupClassesTab.activeStatuses")}</option>
          <option value="">{tr("groupClassesTab.allStatuses")}</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} style={{ ...btn('var(--a-ink)', col.body), padding: '9px 12px' }}><RefreshCw size={15} /></button>
        <button onClick={() => setShowCreate(true)} style={{ ...btn('var(--a-accent)'), display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> {tr("groupClassesTab.newClass")}
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
          <p style={{ color: col.muted, fontWeight: 700 }}>{tr("groupClassesTab.noGroupClassesYet")}</p>
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
                    {gc.status === 'missed' && gc.missedReason && <span style={{ fontSize: 12, color: 'var(--a-accent-ink)', fontWeight: 600 }}>{gc.missedReason}</span>}
                    <span style={{ fontSize: 12, color: col.muted, background: 'var(--a-accent-soft)', borderRadius: 999, padding: '2px 8px' }}>{gc.level}</span>
                  </div>
                  <div style={{ fontSize: 13, color: col.muted, marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>👨‍🏫 {teacherName(gc.teacherId?._id || gc.teacherId)}</span>
                    <span>📅 {fmtDate(gc.scheduledTime, gc.teacherTimezone)}</span>
                    <span>{PLATFORM_META[gc.platform || 'agora'].icon} {PLATFORM_META[gc.platform || 'agora'].name}</span>
                    <span>{tr("groupClassesTab.min", { duration: gc.duration })}</span>
                    <span>{tr("groupClassesTab.seats", { value: gc.enrollments?.length || 0, maxSeats: gc.maxSeats })}</span>
                    <span>{gc.paymentType === 'points'
                      ? tr("groupClassesTab.pointsSeat", { count: gc.pointsPerSeat || 1 })
                      : tr("groupClassesTab.creditSeat", { pricePerSeat: gc.pricePerSeat })}</span>
                    {gc.teacherFee > 0 && (
                      <span title={gc.feePaid?.at ? tr("groupClassesTab.feePaidHint") : tr("groupClassesTab.feeDueHint")}>
                        {gc.feePaid?.at ? tr("groupClassesTab.feePaid", { fee: fmtMoney(gc.teacherFee, sym) }) : tr("groupClassesTab.feeLabel", { fee: fmtMoney(gc.teacherFee, sym) })}
                      </span>
                    )}
                  </div>
                </div>
                {isOpen ? <ChevronUp size={18} color={col.muted} /> : <ChevronDown size={18} color={col.muted} />}
              </div>

              {isOpen && (
                <div style={{ borderTop: `1.5px solid ${col.border}`, marginTop: 14, paddingTop: 14 }}>
                  {gc.description && <p style={{ fontSize: 13, color: col.body, margin: '0 0 10px' }}>{gc.description}</p>}

                  {/* Enrolled students */}
                  <p style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>{tr("groupClassesTab.enrolledStudents")}</p>
                  {(gc.enrollments || []).length === 0 ? (
                    <p style={{ fontSize: 13, color: col.muted, marginBottom: 12 }}>{tr("groupClassesTab.noStudentsEnrolledYet")}</p>
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
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--a-raised)', borderRadius: 10, padding: '7px 12px' }}>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: col.body }}>{sName}</span>
                            <span style={{ fontSize: 12, color: STATUS_COLOR[e.attendance] || col.muted }}>{e.attendance}</span>
                            <span style={{ fontSize: 12, color: col.muted }}>{e.pointsCharged > 0 ? tr("groupClassesTab.pts", { count: e.pointsCharged }) : tr("groupClassesTab.cr", { creditCharged: e.creditCharged })}</span>
                            {!['completed','cancelled','missed'].includes(gc.status) && (
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
                        {tr("groupClassesTab.enrollStudent")}
                      </button>
                    )}
                    {['in-progress','open','full'].includes(gc.status) && (
                      <button onClick={() => openAttendance(gc)}
                        style={btn('linear-gradient(135deg,#3b82f6,#60a5fa)')}>
                        {tr("groupClassesTab.markAttendance")}
                      </button>
                    )}
                    {['open','full','in-progress'].includes(gc.status) && (
                      <button onClick={() => handleComplete(gc._id)}
                        style={btn('var(--a-accent)')}>
                        {tr("groupClassesTab.complete")}
                      </button>
                    )}
                    {!['completed','cancelled','missed'].includes(gc.status) && (
                      <button onClick={() => handleCancel(gc._id)}
                        style={btn('#fef2f2', '#dc2626')}>
                        {tr("groupClassesTab.cancel")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
      {!loading && (
        <Pagination page={gcPage} totalPages={Math.max(1, Math.ceil(gcTotal / GC_PAGE))} total={gcTotal} pageSize={GC_PAGE}
          onPage={(p) => { setGcPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} isDarkMode={isDarkMode} />
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: col.card, borderRadius: 24, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', fontFamily: F }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col.heading, flex: 1 }}>{tr("groupClassesTab.newGroupClass")}</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color={col.muted} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("groupClassesTab.teacher")}</label>
                <select value={form.teacherId} onChange={e => setForm(p => ({ ...p, teacherId: e.target.value }))} style={{ ...inp, marginTop: 4 }}>
                  <option value="">{tr("groupClassesTab.selectTeacher")}</option>
                  {teachers.map(t => <option key={t._id} value={t._id}>{t.firstName} {t.lastName}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("groupClassesTab.title")}</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={tr("groupClassesTab.eGB1ConversationClass")} style={{ ...inp, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("groupClassesTab.description")}</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ ...inp, marginTop: 4, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("groupClassesTab.level")}</label>
                  <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))} style={{ ...inp, marginTop: 4 }}>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("groupClassesTab.maxSeats")}</label>
                  <input type="number" min={2} max={20} value={form.maxSeats} onChange={e => setForm(p => ({ ...p, maxSeats: +e.target.value }))} style={{ ...inp, marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("groupClassesTab.pointsPerStudent")}</label>
                  <input type="number" min={1} step={1} value={form.pointsPerSeat} onChange={e => setForm(p => ({ ...p, pointsPerSeat: +e.target.value }))} style={{ ...inp, marginTop: 4 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("groupClassesTab.teacherFee")}</label>
                {canSetFee ? (
                  <input type="number" min={0} step="0.01" value={form.teacherFee} placeholder={tr("groupClassesTab.teacherFeePlaceholder")} onChange={e => setForm(p => ({ ...p, teacherFee: e.target.value }))} style={{ ...inp, marginTop: 4 }} />
                ) : (
                  <p style={{ fontSize: 13, color: col.body, margin: '6px 0 0' }}>{tr("groupClassesTab.teacherFeeDefault")}</p>
                )}
                <p style={{ fontSize: 11.5, color: col.muted, margin: '4px 0 0' }}>{tr("groupClassesTab.teacherFeeHint")}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("groupClassesTab.scheduledTime")}</label>
                  <input type="datetime-local" value={form.scheduledTime} onChange={e => setForm(p => ({ ...p, scheduledTime: e.target.value }))} style={{ ...inp, marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("groupClassesTab.durationMin")}</label>
                  <input type="number" min={15} max={300} value={form.duration} onChange={e => setForm(p => ({ ...p, duration: +e.target.value }))} style={{ ...inp, marginTop: 4 }} />
                </div>
              </div>
              {/* Where the class happens */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("groupClassesTab.classPlatform")}</label>
                <PlatformPicker platform={form.platform} link={form.meetingLink} col={col}
                  onChange={({ platform, link }) => setForm(p => ({ ...p, platform, meetingLink: link }))}
                  labels={{ agoraHint: tr("groupClassesTab.agoraHint"), externalHint: tr("groupClassesTab.externalHint"), linkPlaceholder: tr("groupClassesTab.linkPlaceholder"), linkHint: tr("groupClassesTab.linkHint") }} />
              </div>
              {/* Who can join: everyone, or only the students picked here */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("groupClassesTab.whoCanJoin")}</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {[
                    { val: 'open',        label: tr("groupClassesTab.joinOpen"),     hint: tr("groupClassesTab.joinOpenHint") },
                    { val: 'invite-only', label: tr("groupClassesTab.joinSelected"), hint: tr("groupClassesTab.joinSelectedHint") },
                  ].map(m => (
                    <button type="button" key={m.val} onClick={() => setForm(p => ({ ...p, enrollmentMode: m.val }))}
                      style={{ flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: F,
                        border: `2px solid ${form.enrollmentMode === m.val ? col.accent : col.border}`, background: form.enrollmentMode === m.val ? col.accent + '18' : 'transparent' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: form.enrollmentMode === m.val ? col.accent : col.heading }}>{m.label}</div>
                      <div style={{ fontSize: 11.5, color: col.muted, marginTop: 2 }}>{m.hint}</div>
                    </button>
                  ))}
                </div>
                {form.enrollmentMode === 'invite-only' && (
                  <div style={{ marginTop: 10 }}>
                    <StudentPicker options={students} value={form.invitedStudents} onChange={ids => setForm(p => ({ ...p, invitedStudents: ids }))} col={col}
                      labels={{ placeholder: tr("groupClassesTab.searchStudentsPicker"), none: tr("groupClassesTab.noStudentsFoundPicker"), selected: tr("groupClassesTab.studentsSelected", { count: "{{count}}" }), points: tr("groupClassesTab.pickerPoints", { count: "{{count}}" }) }} />
                    <p style={{ fontSize: 11.5, color: col.muted, margin: '6px 0 0' }}>{tr("groupClassesTab.invitedHint")}</p>
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("groupClassesTab.tagsCommaSeparated")}</label>
                <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder={tr("groupClassesTab.grammarSpeakingIelts")} style={{ ...inp, marginTop: 4 }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} style={btn('var(--a-ink)', col.body)}>{tr("groupClassesTab.cancel")}</button>
              <button onClick={handleCreate} disabled={saving} style={btn('var(--a-accent)')}>
                {saving ? tr("groupClassesTab.creating") : tr("groupClassesTab.createClass")}
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: col.heading, flex: 1 }}>{tr("groupClassesTab.enrollStudent2")}</h3>
              <button onClick={() => setEnrollTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color={col.muted} /></button>
            </div>
            <p style={{ fontSize: 13, color: col.muted, margin: '0 0 12px' }}>{tr("groupClassesTab.class2")} <strong>{enrollTarget.title}</strong> — {enrollTarget.enrollments?.length || 0}/{enrollTarget.maxSeats} {tr("groupClassesTab.seats2")}</p>
            <select value={enrollStudentId} onChange={e => setEnrollStudentId(e.target.value)} style={{ ...inp, marginBottom: 16 }}>
              <option value="">{tr("groupClassesTab.selectStudent")}</option>
              {students
                .filter(s => !enrollTarget.enrollments?.some(e => (e.studentId?._id || e.studentId)?.toString() === s._id?.toString()))
                .map(s => <option key={s._id} value={s._id}>{enrollTarget.paymentType === 'points'
                  ? tr("groupClassesTab.studentPoints", { firstName: s.firstName, lastName: s.lastName, count: s.groupPoints || 0 })
                  : tr("groupClassesTab.credits", { firstName: s.firstName, lastName: s.lastName, classCredits: s.classCredits })}</option>)}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setEnrollTarget(null)} style={btn('var(--a-ink)', col.body)}>{tr("groupClassesTab.cancel")}</button>
              <button onClick={handleEnroll} disabled={enrolling} style={btn('linear-gradient(135deg,#10b981,#34d399)')}>
                {enrolling ? tr("groupClassesTab.enrolling") : tr("groupClassesTab.enroll")}
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: col.heading, flex: 1 }}>{tr("groupClassesTab.markAttendance")}</h3>
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
                    <option value="pending">{tr("groupClassesTab.pending")}</option>
                    <option value="attended">{tr("groupClassesTab.attended")}</option>
                    <option value="absent">{tr("groupClassesTab.absent")}</option>
                  </select>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setAttTarget(null)} style={btn('var(--a-ink)', col.body)}>{tr("groupClassesTab.cancel")}</button>
              <button onClick={saveAttendance} style={btn('linear-gradient(135deg,#3b82f6,#60a5fa)')}>{tr("groupClassesTab.saveAttendance")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
