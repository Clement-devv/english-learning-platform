// src/pages/student/tabs/GroupClassTab.jsx
// Student view: browse open classes, enroll, view enrolled, join live class.
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Video, RefreshCw, Loader2, LogIn } from 'lucide-react';
import api from '../../../api';
import { useOnDataChanged } from '../../../hooks/useLiveData';
import Classroom from '../../Classroom';
import { joinGroupClass } from '../../../components/groupClass/joinGroupClass';
import { PLATFORM_META } from '../../../components/groupClass/platforms';
import { formatDateInTZ, getUserTimezone, dualTime } from '../../../utils/timezone';
import { useTranslation } from "react-i18next";

const F = "'Nunito','Inter',sans-serif";
const myTZ = getUserTimezone();

// Show the time in the student's local timezone. If the teacher's timezone
// differs, also show the teacher's local time so students know the reference.
function GCTime({ scheduledTime, teacherTimezone }) {
  const { t: tr } = useTranslation("student");
  const dt = dualTime(scheduledTime, myTZ, teacherTimezone || myTZ);
  if (!dt) return null;
  const dateLabel = formatDateInTZ(scheduledTime, myTZ);
  if (dt.sameZone || !teacherTimezone) {
    return <span>📅 {dateLabel} ({dt.myAbbr})</span>;
  }
  return (
    <span>
      📅 {dateLabel} ({dt.myAbbr})
      <span style={{ opacity: 0.75, marginLeft: 4 }}>{tr("groupClassTab.teacher", { theirTime: dt.theirTime, theirAbbr: dt.theirAbbr })}</span>
    </span>
  );
}

const STATUS_COLOR = {
  open:         '#10b981',
  full:         '#f59e0b',
  'in-progress':'#3b82f6',
  completed:    '#6b7280',
  cancelled:    '#ef4444',
  missed:       '#ea580c', // time passed, never held — refunded
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
  const { t: tr } = useTranslation("student");
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
  const [myPoints,    setMyPoints]    = useState(null); // group points (new group classes)

  // New group classes are paid with group points; older ones with class credits
  const usesPoints = (gc) => gc.paymentType === 'points';
  const priceOf    = (gc) => (usesPoints(gc) ? (gc.pointsPerSeat || 1) : (gc.pricePerSeat || 1));
  const canAfford  = (gc) => (usesPoints(gc) ? (myPoints ?? 0) : (myCredits ?? 0)) >= priceOf(gc);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const load = useCallback(async (quiet) => {
    if (quiet !== true) setLoading(true);
    try {
      const res = await api.get('/group-classes');
      const all = res.data.classes || [];
      const studentId = studentInfo?.id || studentInfo?._id;
      setAllClasses(all.filter(gc => gc.status === 'open' && !gc.enrollments?.some(e => (e.studentId?._id || e.studentId)?.toString() === studentId?.toString())));
      // Finished classes move to My Classes → Completed / Not completed
      setMyClasses(all.filter(gc => !["completed", "missed", "cancelled"].includes(gc.status)
        && gc.enrollments?.some(e => (e.studentId?._id || e.studentId)?.toString() === studentId?.toString())));
    } catch {
      flash(tr("groupClassTab.failedToLoadClasses"));
    } finally {
      setLoading(false);
    }
  }, [studentInfo?.id || studentInfo?._id, tr]);

  useEffect(() => { load(); }, [load]);
  useOnDataChanged(['group-classes'], () => load(true)); // live: seats, invites, status

  // Fetch own credit balance
  useEffect(() => {
    const myId = studentInfo?.id || studentInfo?._id;
    if (!myId) return;
    api.get(`/students/${myId}`).then(r => {
      const credits = r.data?.student?.classCredits ?? r.data?.classCredits;
      if (credits !== undefined) setMyCredits(credits);
    }).catch(() => {});
  }, [studentInfo?.id, studentInfo?._id]);

  const loadPoints = useCallback(() => {
    api.get('/group-points/me').then(r => setMyPoints(r.data?.balance ?? 0)).catch(() => {});
  }, []);
  useEffect(() => { loadPoints(); }, [loadPoints]);
  useOnDataChanged(['students'], loadPoints); // live: the admin sold points

  const handleEnroll = async (gc) => {
    setEnrolling(p => ({ ...p, [gc._id]: true }));
    try {
      const res = await api.post(`/group-classes/${gc._id}/enroll`);
      if (res.data.creditsRemaining !== undefined) setMyCredits(res.data.creditsRemaining);
      if (res.data.pointsRemaining !== undefined) setMyPoints(res.data.pointsRemaining);
      flash(usesPoints(gc)
        ? tr("groupClassTab.enrolledPointsDeducted", { title: gc.title, count: priceOf(gc) })
        : tr("groupClassTab.enrolledInCreditSDeducted", { title: gc.title, pricePerSeat: gc.pricePerSeat }));
      load();
    } catch (e) {
      flash(e.response?.data?.message || tr("groupClassTab.enrollmentFailed"));
    } finally {
      setEnrolling(p => ({ ...p, [gc._id]: false }));
    }
  };

  const handleUnenroll = async (gc) => {
    if (!window.confirm(tr("groupClassTab.leaveThisClassAndGet"))) return;
    try {
      await api.delete(`/group-classes/${gc._id}/enroll/${studentInfo.id || studentInfo._id}`);
      flash(tr("groupClassTab.youHaveLeftTheClass"));
      load();
      loadPoints(); // refunded
    } catch (e) {
      flash(e.response?.data?.message || tr("groupClassTab.failedToUnenroll"));
    }
  };

  // Agora → the in-app classroom; Google Meet / Zoom → the class link in a new tab
  const handleJoin = (gc) => joinGroupClass(gc, { onAgora: (c) => setActiveClass(c), onError: (m) => flash(m) });

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
          { key: 'browse',   label: tr("groupClassTab.browseOpen"), count: allClasses.length },
          { key: 'enrolled', label: tr("groupClassTab.myClasses"),  count: myClasses.length  },
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

      {/* Group points balance (+ class credits while older credit-paid classes are still listed) */}
      {myPoints !== null && (
        <div style={{ background: isDarkMode ? 'rgba(249,115,22,0.08)' : '#fff7ed', border: `1.5px solid ${isDarkMode ? 'rgba(249,115,22,0.2)' : '#fed7aa'}`, borderRadius: 14, padding: '10px 16px', marginBottom: 16, fontSize: 13, fontWeight: 700, color: col.accent }}>
          {tr("groupClassTab.groupPoints")} <strong>{myPoints}</strong>
          {myPoints === 0 && <span style={{ marginLeft: 8, color: '#ef4444', fontWeight: 600 }}>{tr("groupClassTab.buyPointsFromSchool")}</span>}
          {myCredits !== null && [...allClasses, ...myClasses].some(gc => !usesPoints(gc)) && (
            <span style={{ marginLeft: 14, color: col.muted, fontWeight: 600 }}>{tr("groupClassTab.classCredits")} {myCredits}</span>
          )}
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
            {tab === 'browse' ? tr("groupClassTab.noOpenClassesAvailableRight") : tr("groupClassTab.youReNotEnrolledIn")}
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
                    {gc.status === 'missed' && gc.missedReason && <span style={{ fontSize: 12, color: '#ea580c', fontWeight: 600 }}>{gc.missedReason}</span>}
                    <LevelBadge level={gc.level} />
                    {gc.enrollmentMode === 'invite-only' && (
                      <span style={{ fontSize: 11, background: '#6366f118', color: '#6366f1', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>{tr("groupClassTab.inviteOnly")}</span>
                    )}
                  </div>

                  <div style={{ fontSize: 13, color: col.muted, display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span>👨‍🏫 {gc.teacherId?.firstName ? `${gc.teacherId.firstName} ${gc.teacherId.lastName}` : tr("groupClassTab.teacher2")}</span>
                    <GCTime scheduledTime={gc.scheduledTime} teacherTimezone={gc.teacherTimezone} />
                    <span>{tr("groupClassTab.min", { duration: gc.duration })}</span>
                    <span>{PLATFORM_META[gc.platform || "agora"].icon} {PLATFORM_META[gc.platform || "agora"].name}</span>
                    <span>{usesPoints(gc)
                      ? tr("groupClassTab.points", { count: priceOf(gc) })
                      : tr("groupClassTab.credit", { pricePerSeat: gc.pricePerSeat, value: gc.pricePerSeat !== 1 ? 's' : '' })}</span>
                    {tab === 'browse' && <span style={{ color: seatsLeft <= 2 ? '#f59e0b' : col.muted }}>{tr("groupClassTab.seatLeft", { seatsLeft, value: seatsLeft !== 1 ? 's' : '' })}</span>}
                  </div>

                  {gc.description && <p style={{ fontSize: 13, color: col.body, margin: 0 }}>{gc.description}</p>}

                  {myEnrollment && (
                    <div style={{ marginTop: 8, fontSize: 12, color: STATUS_COLOR[myEnrollment.attendance] || col.muted, fontWeight: 700 }}>{tr("groupClassTab.attendance", { attendance: myEnrollment.attendance })}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  {canJoin && (
                    <button onClick={() => handleJoin(gc)} style={{ ...btn('linear-gradient(135deg,#10b981,#34d399)'), display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Video size={13} /> {tr("groupClassTab.joinClass")}
                    </button>
                  )}
                  {tab === 'browse' && gc.status === 'open' && (
                    <button
                      onClick={() => handleEnroll(gc)}
                      disabled={enrolling[gc._id] || !canAfford(gc)}
                      style={btn('linear-gradient(135deg,#f97316,#f43f5e)', '#fff', enrolling[gc._id] || !canAfford(gc))}>
                      <LogIn size={13} style={{ display: 'inline', marginRight: 4 }} />
                      {enrolling[gc._id] ? tr("groupClassTab.enrolling") : !canAfford(gc) ? (usesPoints(gc) ? tr("groupClassTab.notEnoughPoints") : tr("groupClassTab.notEnoughCredits")) : tr("groupClassTab.enroll")}
                    </button>
                  )}
                  {tab === 'enrolled' && !['completed','cancelled','missed'].includes(gc.status) && (
                    <button onClick={() => handleUnenroll(gc)} style={btn('#fef2f2', '#dc2626')}>
                      {tr("groupClassTab.leaveClass")}
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
