// src/pages/student/tabs/GroupClassTab.jsx
// Student view: browse open classes, enroll, view enrolled, join live class.
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Video, RefreshCw, Loader2, LogIn } from 'lucide-react';
import api from '../../../api';
import Classroom from '../../Classroom';
import { formatDateInTZ, getUserTimezone, dualTime } from '../../../utils/timezone';

const F = "'Nunito','Inter',sans-serif";
const myTZ = getUserTimezone();

// Show the time in the student's local timezone. If the teacher's timezone
// differs, also show the teacher's local time so students know the reference.
function GCTime({ scheduledTime, teacherTimezone }) {
  const dt = dualTime(scheduledTime, myTZ, teacherTimezone || myTZ);
  if (!dt) return null;
  const dateLabel = formatDateInTZ(scheduledTime, myTZ);
  if (dt.sameZone || !teacherTimezone) {
    return <span>📅 {dateLabel} ({dt.myAbbr})</span>;
  }
  return (
    <span>
      📅 {dateLabel} ({dt.myAbbr})
      <span style={{ opacity: 0.75, marginLeft: 4 }}>· {dt.theirTime} {dt.theirAbbr} teacher</span>
    </span>
  );
}

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

function LevelBadge({ level }) {
  return (
    <span style={{ background: '#f97316' + '18', color: '#f97316', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
      {level}
    </span>
  );
}

export default function GroupClassTab({ isDarkMode, studentInfo }) {
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

  const [tab,         setTab]         = useState('browse');   // 'browse' | 'enrolled'
  const [allClasses,  setAllClasses]  = useState([]);
  const [myClasses,   setMyClasses]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [msg,         setMsg]         = useState('');
  const [enrolling,   setEnrolling]   = useState({});
  const [activeClass, setActiveClass] = useState(null);
  const [myCredits,   setMyCredits]   = useState(null);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/group-classes');
      const all = res.data.classes || [];
      const studentId = studentInfo?.id || studentInfo?._id;
      setAllClasses(all.filter(gc => gc.status === 'open' && !gc.enrollments?.some(e => (e.studentId?._id || e.studentId)?.toString() === studentId?.toString())));
      setMyClasses(all.filter(gc => gc.enrollments?.some(e => (e.studentId?._id || e.studentId)?.toString() === studentId?.toString())));
    } catch {
      flash('Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, [studentInfo?.id || studentInfo?._id]);

  useEffect(() => { load(); }, [load]);

  // Fetch own credit balance
  useEffect(() => {
    const myId = studentInfo?.id || studentInfo?._id;
    if (!myId) return;
    api.get(`/students/${myId}`).then(r => {
      const credits = r.data?.student?.classCredits ?? r.data?.classCredits;
      if (credits !== undefined) setMyCredits(credits);
    }).catch(() => {});
  }, [studentInfo?.id, studentInfo?._id]);

  const handleEnroll = async (gc) => {
    setEnrolling(p => ({ ...p, [gc._id]: true }));
    try {
      const res = await api.post(`/group-classes/${gc._id}/enroll`);
      if (res.data.creditsRemaining !== undefined) setMyCredits(res.data.creditsRemaining);
      flash(`Enrolled in "${gc.title}" — ${gc.pricePerSeat} credit(s) deducted`);
      load();
    } catch (e) {
      flash(e.response?.data?.message || 'Enrollment failed');
    } finally {
      setEnrolling(p => ({ ...p, [gc._id]: false }));
    }
  };

  const handleUnenroll = async (gc) => {
    if (!window.confirm('Leave this class and get a credit refund?')) return;
    try {
      await api.delete(`/group-classes/${gc._id}/enroll/${studentInfo.id || studentInfo._id}`);
      flash('You have left the class. Credits refunded.');
      load();
    } catch (e) {
      flash(e.response?.data?.message || 'Failed to unenroll');
    }
  };

  const handleJoin = (gc) => setActiveClass(gc);

  if (activeClass) {
    return (
      <Classroom
        classData={{ id: activeClass._id, title: activeClass.title, isGroupClass: true }}
        userRole="student"
        onLeave={() => { setActiveClass(null); load(); }}
      />
    );
  }

  const card = { background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 20, marginBottom: 12, fontFamily: F };
  const btn  = (grad, text='#fff', disabled=false) => ({
    background: disabled ? (isDarkMode ? '#2a2d40' : '#f5f0ec') : grad,
    color: disabled ? col.muted : text,
    border: 'none', borderRadius: 12, padding: '9px 18px', fontSize: 13,
    fontWeight: 800, cursor: disabled ? 'default' : 'pointer', fontFamily: F,
  });

  const displayList = tab === 'browse' ? allClasses : myClasses;

  return (
    <div style={{ fontFamily: F }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'browse',   label: '🔍 Browse Open', count: allClasses.length },
          { key: 'enrolled', label: '📚 My Classes',  count: myClasses.length  },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? 'linear-gradient(135deg,#f97316,#f43f5e)' : (isDarkMode ? '#1a1d2e' : '#ffffff'),
            color: tab === t.key ? '#fff' : col.body,
            border: `2px solid ${tab === t.key ? 'transparent' : col.border}`,
            borderRadius: 14, padding: '8px 18px', fontSize: 13, fontWeight: 800,
            cursor: 'pointer', fontFamily: F,
          }}>
            {t.label} <span style={{ opacity: 0.75 }}>({t.count})</span>
          </button>
        ))}
        <button onClick={load} style={{ marginLeft: 'auto', ...btn(isDarkMode ? '#2a2d40' : '#f5f0ec', col.body), padding: '8px 12px' }}>
          <RefreshCw size={15} />
        </button>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith('Failed') || msg.includes('fail') ? '#fef2f2' : '#f0fdf4', border: `1.5px solid ${msg.startsWith('Failed') || msg.includes('fail') ? '#fecaca' : '#bbf7d0'}`, borderRadius: 12, padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 700, color: msg.startsWith('Failed') || msg.includes('fail') ? '#dc2626' : '#16a34a' }}>
          {msg}
        </div>
      )}

      {/* Credits balance */}
      {myCredits !== null && (
        <div style={{ background: isDarkMode ? 'rgba(249,115,22,0.08)' : '#fff7ed', border: `1.5px solid ${isDarkMode ? 'rgba(249,115,22,0.2)' : '#fed7aa'}`, borderRadius: 14, padding: '10px 16px', marginBottom: 16, fontSize: 13, fontWeight: 700, color: col.accent }}>
          💳 Class credits: <strong>{myCredits}</strong>
          {myCredits === 0 && <span style={{ marginLeft: 8, color: '#ef4444', fontWeight: 600 }}>— Contact your school to top up</span>}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={32} color={col.accent} style={{ animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : displayList.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <Users size={40} color={col.muted} style={{ margin: '0 auto 12px' }} />
          <p style={{ color: col.muted, fontWeight: 700 }}>
            {tab === 'browse' ? 'No open classes available right now' : "You're not enrolled in any group classes yet"}
          </p>
        </div>
      ) : (
        displayList.map(gc => {
          const myId = studentInfo?.id || studentInfo?._id;
          const myEnrollment = gc.enrollments?.find(e => (e.studentId?._id || e.studentId)?.toString() === myId?.toString());
          const seatsLeft = gc.maxSeats - (gc.enrollments?.length || 0);
          const canJoin = myEnrollment && gc.status === 'in-progress';

          return (
            <div key={gc._id} style={card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: col.heading }}>{gc.title}</span>
                    <Badge status={gc.status} />
                    <LevelBadge level={gc.level} />
                    {gc.enrollmentMode === 'invite-only' && (
                      <span style={{ fontSize: 11, background: '#6366f118', color: '#6366f1', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>🔒 Invite-Only</span>
                    )}
                  </div>

                  <div style={{ fontSize: 13, color: col.muted, display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span>👨‍🏫 {gc.teacherId?.firstName ? `${gc.teacherId.firstName} ${gc.teacherId.lastName}` : 'Teacher'}</span>
                    <GCTime scheduledTime={gc.scheduledTime} teacherTimezone={gc.teacherTimezone} />
                    <span>⏱ {gc.duration}min</span>
                    <span>💳 {gc.pricePerSeat} credit{gc.pricePerSeat !== 1 ? 's' : ''}</span>
                    {tab === 'browse' && <span style={{ color: seatsLeft <= 2 ? '#f59e0b' : col.muted }}>🪑 {seatsLeft} seat{seatsLeft !== 1 ? 's' : ''} left</span>}
                  </div>

                  {gc.description && <p style={{ fontSize: 13, color: col.body, margin: 0 }}>{gc.description}</p>}

                  {myEnrollment && (
                    <div style={{ marginTop: 8, fontSize: 12, color: STATUS_COLOR[myEnrollment.attendance] || col.muted, fontWeight: 700 }}>
                      Attendance: {myEnrollment.attendance}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  {canJoin && (
                    <button onClick={() => handleJoin(gc)} style={{ ...btn('linear-gradient(135deg,#10b981,#34d399)'), display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Video size={13} /> Join Class
                    </button>
                  )}
                  {tab === 'browse' && gc.status === 'open' && (
                    <button
                      onClick={() => handleEnroll(gc)}
                      disabled={enrolling[gc._id] || (myCredits ?? 0) < gc.pricePerSeat}
                      style={btn('linear-gradient(135deg,#f97316,#f43f5e)', '#fff', enrolling[gc._id] || (myCredits ?? 0) < gc.pricePerSeat)}>
                      <LogIn size={13} style={{ display: 'inline', marginRight: 4 }} />
                      {enrolling[gc._id] ? 'Enrolling…' : (myCredits ?? 0) < gc.pricePerSeat ? 'Not enough credits' : 'Enroll'}
                    </button>
                  )}
                  {tab === 'enrolled' && !['completed','cancelled'].includes(gc.status) && (
                    <button onClick={() => handleUnenroll(gc)} style={btn('#fef2f2', '#dc2626')}>
                      Leave Class
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
