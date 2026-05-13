// src/pages/teacher/dashboard-shells/sunshine/SunshineShell.jsx
// Teacher dashboard — Sunshine Explorer design.
// Warm amber/orange palette · rounded cards · Nunito font · grouped sidebar nav.
// Mirrors the student SunshineShell pattern, adapted for teacher content.

import React, { useState, lazy, Suspense } from 'react';
const GroupClassesTab = lazy(() => import('../../tabs/GroupClassesTab'));
import {
  Home, Calendar, CheckCircle2, Users, BookOpen, MessageCircle,
  DollarSign, Star, User, CalendarDays, FileText, Layers, ClipboardList,
  Settings, LogOut, Plus, RefreshCw, Video, Bell, BarChart2, PhoneMissed, X, Clock4,
} from 'lucide-react';
import { useBranding }              from '../../../../context/BrandingContext';
import { useTeacherDashboardData }  from '../useTeacherDashboardData';
import { useRing }                  from '../../../../context/RingContext';
import TeacherTabContent            from '../TeacherTabContent';
import { TabErrorBoundary }         from '../../../../components/ErrorBoundary';
import Classroom                    from '../../../Classroom';
import ClassModal                   from '../../components/classes/ClassModal';
import ConfirmModal                 from '../../components/classes/ConfirmModal';
import RecurringClassForm           from '../../../../components/teacher/RecurringClassForm';
import ChangePassword               from '../../../../components/teacher/auth/ChangePassword';
import SessionManagement            from '../../../../components/SessionManagement';
import SettingsSidebar              from '../../../../components/SettingsSidebar';
import SettingsModal                from '../../../../components/SettingsModal';
import GoogleMeetSettings           from '../../../../components/GoogleMeetSettings';
import LiveClasses                  from '../../components/dashboard/LiveClasses';
import UpcomingClasses              from '../../components/dashboard/UpcomingClasses';

// ── Palette ────────────────────────────────────────────────────────────────────
const palette = (dark) => ({
  bg:       dark ? '#0f1117' : '#fff8f0',
  card:     dark ? '#1a1d2e' : '#ffffff',
  cardAlt:  dark ? '#1f2235' : '#fffbf5',
  border:   dark ? '#2a2d40' : '#ffe8cc',
  heading:  dark ? '#f0f4ff' : '#3d2e20',
  body:     dark ? '#c8cce0' : '#5a4a3a',
  muted:    dark ? '#6b7090' : '#a89480',
  accent:   dark ? '#fbbf24' : '#f97316',
  sidebar:  dark ? '#13111a' : '#ffffff',
});

// ── Nav groups ─────────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: null,
    items: [{ key: 'dashboard', icon: '🏠', label: 'Dashboard', lucide: Home }],
  },
  {
    label: 'Teaching',
    items: [
      { key: 'classes',           icon: '📅', label: 'My Classes',    lucide: CalendarDays  },
      { key: 'group-classes',     icon: '👥', label: 'Group Classes', lucide: Users         },
      { key: 'completed-classes', icon: '✅', label: 'Completed',     lucide: CheckCircle2  },
      { key: 'schedule',          icon: '🗓️', label: 'Schedule',      lucide: Calendar      },
    ],
  },
  {
    label: 'Students',
    items: [
      { key: 'students', icon: '👥', label: 'Students', lucide: Users         },
      { key: 'bookings', icon: '📖', label: 'Bookings',  lucide: ClipboardList },
    ],
  },
  {
    label: 'Content',
    items: [
      { key: 'homework',    icon: '📚', label: 'Homework',   lucide: BookOpen  },
      { key: 'quiz',        icon: '📝', label: 'Quizzes',    lucide: FileText  },
      { key: 'vocab',       icon: '📒', label: 'Vocabulary', lucide: Layers    },
    ],
  },
  {
    label: 'More',
    items: [
      { key: 'messages',          icon: '💬', label: 'Messages',        lucide: MessageCircle },
      { key: 'payment',           icon: '💰', label: 'Payment',         lucide: DollarSign    },
      { key: 'recordings',        icon: '🎬', label: 'Recordings',      lucide: Video         },
      { key: 'reviews',           icon: '⭐', label: 'Reviews',         lucide: Star          },
      { key: 'rating-dashboard',  icon: '📊', label: 'Rating Insights', lucide: BarChart2     },
      { key: 'profile',           icon: '👤', label: 'Profile',         lucide: User          },
    ],
  },
];

const PAGE_LABEL = NAV_GROUPS.flatMap(g => g.items).reduce((m, i) => ({ ...m, [i.key]: i.label }), {});
const F = "'Nunito','Inter',sans-serif";
const FONT_IMPORT = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap';

// ── Missed Calls Banner ────────────────────────────────────────────────────────
const ROLE_LABEL = { teacher: 'Teacher', student: 'Student', admin: 'Admin', subAdmin: 'Sub-Admin' };

function MissedCallsBanner({ missedCalls, clearMissedCalls, col, isDarkMode }) {
  const formatTime = (ms) => {
    const d = new Date(ms);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      background: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fff5f5',
      border: `2px solid ${isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca'}`,
      borderRadius: 20,
      padding: '16px 20px',
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
    }}>
      {/* Icon */}
      <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#ef4444,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(239,68,68,0.35)' }}>
        <PhoneMissed size={20} color='#fff' />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: isDarkMode ? '#fca5a5' : '#dc2626', fontFamily: F }}>
            {missedCalls.length} Missed Call{missedCalls.length > 1 ? 's' : ''}
          </h3>
          <span style={{ fontSize: 11, color: col.muted, fontWeight: 600 }}>while you were away</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {missedCalls.map((mc, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: isDarkMode ? 'rgba(255,255,255,0.06)' : '#fff',
              border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.2)' : '#fecaca'}`,
              borderRadius: 12, padding: '7px 12px',
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: 'linear-gradient(135deg,#ef4444,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                {(mc.callerName?.[0] || '?').toUpperCase()}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: col.heading, lineHeight: 1.2 }}>{mc.callerName}</p>
                <p style={{ margin: 0, fontSize: 10, color: col.muted, fontWeight: 600 }}>{ROLE_LABEL[mc.callerRole] || mc.callerRole} · {formatTime(mc.at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={clearMissedCalls}
        title='Mark all as seen'
        style={{ background: isDarkMode ? 'rgba(255,255,255,0.08)' : '#fff', border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.12)' : '#fecaca'}`, borderRadius: 10, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: col.muted, flexShrink: 0, fontFamily: F }}
      >
        <X size={12} /> Mark seen
      </button>
    </div>
  );
}

// ── Shell ──────────────────────────────────────────────────────────────────────
export default function SunshineShell() {
  const { branding, center } = useBranding();
  const d   = useTeacherDashboardData();
  const col = palette(d.isDarkMode);
  const { missedCalls, missedCallCount, clearMissedCalls } = useRing();
  const centerName = center?.centerName || 'Teacher Portal';

  const [showRecurringLocal, setShowRecurringLocal] = useState(false);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (d.loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: col.bg, fontFamily: F }}>
        <style>{`@import url('${FONT_IMPORT}'); @keyframes bounce{to{transform:translateY(-16px)}}`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', animation: 'bounce 0.8s infinite alternate' }}>👨‍🏫</div>
          <p style={{ color: col.accent, fontWeight: 700, fontSize: '18px', marginTop: '16px', fontFamily: F }}>Loading your classes...</p>
        </div>
      </div>
    );
  }

  // ── Classroom overlay ────────────────────────────────────────────────────
  if (d.isClassroomOpen && d.activeClass)
    return <Classroom classData={d.activeClass} userRole="teacher" onLeave={d.handleLeaveClassroom} />;

  const accentGradient = 'linear-gradient(135deg,#f97316,#fbbf24)';
  const tabShadow      = 'rgba(249,115,22,0.35)';

  // Badge helper
  const getBadge = (key) => {
    if (key === 'bookings')  return d.pendingBookings > 0 ? d.pendingBookings : null;
    if (key === 'homework')  return d.homeworkToGrade > 0 ? d.homeworkToGrade : null;
    if (key === 'quiz')      return d.quizAttempted  > 0 ? d.quizAttempted  : null;
    if (key === 'messages')  return d.unreadMessages > 0 ? d.unreadMessages : null;
    return null;
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: F, background: col.bg }}>
      <style>{`
        @import url('${FONT_IMPORT}');
        * { box-sizing: border-box; }
        .ts-nav { transition: all 0.18s; }
        .ts-nav:hover { background: ${d.isDarkMode ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.08)'} !important; }
        .ts-card { transition: transform 0.2s, box-shadow 0.2s; }
        .ts-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.10) !important; }
        .ts-btn { transition: transform 0.15s; }
        .ts-btn:hover { transform: scale(1.04); }
        .ts-btn:active { transform: scale(0.97); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${d.isDarkMode ? '#2a2d40' : '#ffd0a8'}; border-radius: 10px; }
      `}</style>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: col.sidebar,
        borderRight: `2px solid ${col.border}`,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', overflowX: 'hidden',
        zIndex: 100,
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 16px 14px', borderBottom: `2px solid ${col.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: accentGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: `0 4px 12px ${tabShadow}`, flexShrink: 0 }}>
              👨‍🏫
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: col.heading, lineHeight: 1.1 }}>{centerName}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: col.muted }}>Teacher Portal</div>
            </div>
          </div>
        </div>

        {/* Teacher card */}
        <div style={{ margin: '12px 10px', background: d.isDarkMode ? 'rgba(249,115,22,0.1)' : '#fff7ed', border: `2px solid ${d.isDarkMode ? 'rgba(249,115,22,0.2)' : '#fed7aa'}`, borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: accentGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
            {(d.teacherInfo?.firstName?.[0] || 'T').toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: col.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.teacherInfo?.firstName}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: col.muted }}>{d.students.length} students</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 4 }}>
              {group.label && (
                <div style={{ fontSize: 10, fontWeight: 800, color: col.muted, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 8px 4px' }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => {
                const isActive = d.activeTab === item.key;
                const badge    = getBadge(item.key);
                return (
                  <button key={item.key} className="ts-nav"
                    onClick={() => d.setActiveTab(item.key)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer',
                      background: isActive ? (d.isDarkMode ? 'rgba(249,115,22,0.18)' : '#fff7ed') : 'transparent',
                      fontFamily: F, textAlign: 'left',
                      borderLeft: isActive ? `3px solid ${col.accent}` : '3px solid transparent',
                      marginBottom: 1,
                    }}>
                    {(() => { const LI = item.lucide; return <LI size={17} strokeWidth={1.8} color={isActive ? col.accent : col.body} style={{ flexShrink: 0 }} />; })()}
                    <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? col.accent : col.body }}>
                      {item.label}
                    </span>
                    {badge != null && (
                      <span style={{ background: isActive ? col.accent : (d.isDarkMode ? 'rgba(249,115,22,0.3)' : '#fff7ed'), color: isActive ? '#fff' : col.accent, borderRadius: 999, fontSize: 10, fontWeight: 900, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '8px 8px 16px', borderTop: `2px solid ${col.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: col.muted }}>{d.isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
            <button onClick={d.toggleDarkMode}
              style={{ width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: d.isDarkMode ? col.accent : col.border, position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: d.isDarkMode ? 21 : 3, transition: 'left .2s' }} />
            </button>
          </div>
          <button className="ts-nav" onClick={() => d.setShowSettingsSidebar(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F, marginBottom: 1 }}>
            <Settings size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>Settings</span>
          </button>
          <button className="ts-nav" onClick={d.handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F }}>
            <LogOut size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── TOP BAR ── */}
        <header style={{ height: 64, background: col.sidebar, borderBottom: `2px solid ${col.border}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col.heading, flex: 1, fontFamily: F }}>
            {PAGE_LABEL[d.activeTab] || 'Dashboard'}
          </h1>

          {/* Student count pill */}
          <div style={{ background: d.isDarkMode ? 'rgba(249,115,22,0.12)' : '#fff7ed', border: `2px solid ${d.isDarkMode ? 'rgba(249,115,22,0.25)' : '#fed7aa'}`, borderRadius: 999, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>👨‍🎓</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: col.accent }}>{d.students.length} students</span>
          </div>

          {/* Pending bookings pill */}
          {d.pendingBookings > 0 && (
            <div onClick={() => d.setActiveTab('bookings')} style={{ background: d.isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: `2px solid ${d.isDarkMode ? 'rgba(239,68,68,0.25)' : '#fecaca'}`, borderRadius: 999, padding: '5px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>🔔</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>{d.pendingBookings} pending</span>
            </div>
          )}

          {/* Push toggle */}
          {d.pushSupported() && (
            <button onClick={d.togglePush} title={d.pushEnabled ? 'Disable push notifications' : 'Enable push notifications'}
              style={{ width: 38, height: 38, borderRadius: 12, border: `2px solid ${col.border}`, background: d.pushEnabled ? '#16a34a' : col.cardAlt, cursor: 'pointer', color: d.pushEnabled ? '#fff' : col.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={16} fill={d.pushEnabled ? 'currentColor' : 'none'} />
            </button>
          )}

          {/* New Class button */}
          <button className="ts-btn" onClick={() => d.setIsModalOpen(true)}
            style={{ background: accentGradient, color: 'white', border: 'none', borderRadius: 12, padding: '9px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 6, boxShadow: `0 4px 14px ${tabShadow}` }}>
            <Plus size={14} /> New Class
          </button>
        </header>

        {/* ── SCROLL AREA ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* Toast */}
          {d.toast && (
            <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, padding: '12px 22px', borderRadius: 20, fontWeight: 700, fontSize: 14, background: d.toast.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', fontFamily: F, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
              {d.toast.type === 'error' ? '😬' : '✅'} {d.toast.message}
            </div>
          )}

          {/* ══ DASHBOARD ══ */}
          {d.activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Welcome hero */}
              <div style={{ background: 'linear-gradient(135deg,#f97316 0%,#f43f5e 100%)', borderRadius: 28, padding: '28px 32px', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: '0 12px 40px rgba(249,115,22,0.3)' }}>
                <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
                <div style={{ position: 'absolute', bottom: -20, right: 60, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, opacity: 0.85, letterSpacing: '.08em', textTransform: 'uppercase' }}>Welcome back 🎉</p>
                    <h1 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 900, fontFamily: F }}>Hey, {d.teacherInfo?.firstName}! 👋</h1>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
                        👥 {d.students.length} students
                      </span>
                      <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
                        📅 {d.classes.length} classes
                      </span>
                      {d.pendingBookings > 0 && (
                        <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
                          🔔 {d.pendingBookings} pending
                        </span>
                      )}
                    </div>
                  </div>
                  {d.teacherInfo?.photo ? (
                    <img
                      src={d.teacherInfo.photo}
                      alt={d.teacherInfo.firstName}
                      style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '3px solid rgba(255,255,255,0.4)', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}
                    />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 900, color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                      {(d.teacherInfo?.firstName?.[0] || 'T').toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Missed calls alert */}
              {missedCallCount > 0 && (
                <MissedCallsBanner missedCalls={missedCalls} clearMissedCalls={clearMissedCalls} col={col} isDarkMode={d.isDarkMode} />
              )}

              {/* 4-stat strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {[
                  { lucide: Users,        n: d.students.length,  l: 'Students',    grad: 'linear-gradient(135deg,#f97316,#fb923c)' },
                  { lucide: CalendarDays, n: d.classes.length,   l: 'Classes',     grad: 'linear-gradient(135deg,#f97316,#f43f5e)' },
                  { lucide: CheckCircle2, n: d.completedCount,   l: 'Completed',   grad: 'linear-gradient(135deg,#10b981,#34d399)' },
                  { lucide: BookOpen,     n: d.homeworkToGrade,  l: 'To Grade',    grad: 'linear-gradient(135deg,#f43f5e,#fb7185)' },
                ].map(({ lucide: LI, n, l, grad }) => (
                  <div key={l} className="ts-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', boxShadow: '0 4px 10px rgba(249,115,22,0.25)' }}>
                      <LI size={20} color="#fff" strokeWidth={2} />
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: col.heading, marginBottom: 2, fontFamily: F }}>{n}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: col.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Google Meet collapsible */}
              {d.teacherInfo?._id && (
                <div className="ts-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 24, overflow: 'hidden' }}>
                  <button onClick={() => d.setShowGoogleMeetSettings(!d.showGoogleMeetSettings)}
                    style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: F }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Video size={16} color="white" />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: col.heading }}>Google Meet Link</p>
                        <p style={{ margin: 0, fontSize: 12, color: col.muted }}>{d.googleMeetLink ? 'Link configured ✓' : 'Click to configure'}</p>
                      </div>
                    </div>
                    <div style={{ transform: d.showGoogleMeetSettings ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <svg style={{ width: 18, height: 18 }} fill="none" stroke={col.muted} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {d.showGoogleMeetSettings && (
                    <div style={{ padding: '16px 20px 20px', borderTop: `2px solid ${col.border}` }}>
                      <GoogleMeetSettings
                        teacherId={d.teacherInfo._id}
                        initialLink={d.googleMeetLink || ''}
                        onUpdate={d.setGoogleMeetLink}
                        isDarkMode={d.isDarkMode}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Classes area */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="ts-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 24, padding: 20 }}>
                    <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 900, color: col.heading, fontFamily: F, display: 'flex', alignItems: 'center', gap: 8 }}>
                      🔴 Live Classes
                      {d.liveClasses.length > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 900 }}>{d.liveClasses.length}</span>}
                    </h2>
                    <LiveClasses classes={d.liveClasses} onJoin={d.handleJoinClass} isDarkMode={d.isDarkMode} />
                  </div>
                  <div className="ts-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 24, padding: 20 }}>
                    <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 900, color: col.heading, fontFamily: F }}>📅 Upcoming Classes</h2>
                    <UpcomingClasses
                      classes={d.upcomingClasses}
                      students={d.students}
                      onCancel={d.askCancelClass}
                      onDelete={d.askDeleteClass}
                      isDarkMode={d.isDarkMode}
                    />
                  </div>
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Quick actions */}
                  <div className="ts-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 24, padding: 20 }}>
                    <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 900, color: col.heading, fontFamily: F }}>⚡ Quick Actions</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { icon: '➕', label: 'New Class',        action: () => d.setIsModalOpen(true)       },
                        { icon: '🔄', label: 'Recurring Classes', action: () => setShowRecurringLocal(true)  },
                        { icon: '📖', label: 'View Bookings',     action: () => d.setActiveTab('bookings')  },
                        { icon: '👥', label: 'View Students',     action: () => d.setActiveTab('students')  },
                        { icon: '🔃', label: 'Refresh Data',      action: d.fetchTeacherData                },
                      ].map(({ icon, label, action }) => (
                        <button key={label} className="ts-btn" onClick={action}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, border: `2px solid ${col.border}`, background: col.cardAlt, cursor: 'pointer', fontFamily: F, textAlign: 'left' }}>
                          <span style={{ fontSize: 16 }}>{icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: col.body }}>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Homework / Quiz badges */}
                  {(d.homeworkToGrade > 0 || d.quizAttempted > 0) && (
                    <div className="ts-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 24, padding: 20 }}>
                      <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 900, color: col.heading, fontFamily: F }}>📬 Needs Attention</h2>
                      {d.homeworkToGrade > 0 && (
                        <div onClick={() => d.setActiveTab('homework')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: d.isDarkMode ? 'rgba(236,72,153,0.1)' : '#fdf2f8', border: `2px solid ${d.isDarkMode ? 'rgba(236,72,153,0.2)' : '#fbcfe8'}`, cursor: 'pointer', marginBottom: 8 }}>
                          <span style={{ fontSize: 20 }}>📚</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: col.heading }}>{d.homeworkToGrade} homework to grade</p>
                          </div>
                        </div>
                      )}
                      {d.quizAttempted > 0 && (
                        <div onClick={() => d.setActiveTab('quiz')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: d.isDarkMode ? 'rgba(249,115,22,0.1)' : '#fff7ed', border: `2px solid ${d.isDarkMode ? 'rgba(249,115,22,0.2)' : '#fed7aa'}`, cursor: 'pointer' }}>
                          <span style={{ fontSize: 20 }}>📝</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: col.heading }}>{d.quizAttempted} quiz attempts to review</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>

              {/* Summary stats — full width below classes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                {[
                  { lucide: Users,        value: d.students.length,   label: 'Total Students',    sub: '+2 this month',       grad: 'linear-gradient(135deg,#3b82f6,#6366f1)' },
                  { lucide: CalendarDays, value: d.classes.length,    label: 'Scheduled Classes', sub: 'Next 7 days',          grad: 'linear-gradient(135deg,#a855f7,#ec4899)' },
                  { lucide: Clock4,       value: d.pendingBookings,   label: 'Pending Requests',  sub: 'Needs attention',      grad: 'linear-gradient(135deg,#f59e0b,#f97316)' },
                  { lucide: CheckCircle2, value: d.completedCount,    label: 'Completed Today',   sub: 'Great progress!',      grad: 'linear-gradient(135deg,#10b981,#34d399)' },
                ].map(({ lucide: LI, value, label, sub, grad }) => (
                  <div key={label} className="ts-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ height: 4, background: grad }} />
                    <div style={{ padding: '18px 18px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}>
                          <LI size={20} color="#fff" strokeWidth={2} />
                        </div>
                        <span style={{ fontSize: 32, fontWeight: 900, color: col.heading, lineHeight: 1, fontFamily: F }}>{value}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: col.body, marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 11, color: col.muted }}>{sub}</div>
                    </div>
                    <div style={{ height: 3, background: grad, transform: 'scaleX(0)', transformOrigin: 'left', transition: 'transform 0.3s' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ GROUP CLASSES TAB ══ */}
          {d.activeTab === 'group-classes' && (
            <TabErrorBoundary key="group-classes">
              <Suspense fallback={null}>
                <GroupClassesTab isDarkMode={d.isDarkMode} />
              </Suspense>
            </TabErrorBoundary>
          )}

          {/* ══ OTHER TABS ══ */}
          {d.activeTab !== 'dashboard' && d.activeTab !== 'group-classes' && (
            <TabErrorBoundary key={d.activeTab}>
              <TeacherTabContent
                d={d}
                wrapStyle={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 24, padding: 24 }}
                msgStyle={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 24, overflow: 'hidden' }}
              />
            </TabErrorBoundary>
          )}
        </main>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}
      <ClassModal
        isOpen={d.isModalOpen}
        onClose={() => d.setIsModalOpen(false)}
        onSave={d.handleAddClass}
        students={d.students}
        isDarkMode={d.isDarkMode}
      />

      {(d.showRecurringForm || showRecurringLocal) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 24, maxWidth: 900, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <RecurringClassForm
              students={d.students}
              teacherInfo={d.teacherInfo}
              onSuccess={(pattern) => {
                setShowRecurringLocal(false);
                d.setShowRecurringForm(false);
                d.showToast(`Created ${pattern.occurrences} recurring classes!`);
                setTimeout(d.fetchTeacherData, 1000);
              }}
              onCancel={() => { setShowRecurringLocal(false); d.setShowRecurringForm(false); }}
            />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={d.confirmModal.open}
        type={d.confirmModal.type}
        onConfirm={d.handleConfirm}
        onCancel={() => d.setConfirmModal({ open: false, type: null, classId: null })}
        isDarkMode={d.isDarkMode}
      />

      {d.showChangePassword && (
        <ChangePassword onClose={() => d.setShowChangePassword(false)} onSuccess={d.handlePasswordChangeSuccess} />
      )}

      {d.showSessionManagement && (
        <SessionManagement isOpen onClose={() => d.setShowSessionManagement(false)} userType="teacher" />
      )}

      {d.showSettingsSidebar && (
        <SettingsSidebar
          isOpen={d.showSettingsSidebar}
          onClose={() => d.setShowSettingsSidebar(false)}
          onChangePassword={() => { d.setShowSettingsSidebar(false); d.setShowChangePassword(true); }}
          onManageSessions={() => { d.setShowSettingsSidebar(false); d.setShowSessionManagement(true); }}
          onManage2FA={() => { d.setShowSettingsSidebar(false); d.setShowSettingsModal(true); }}
          userInfo={{ firstName: d.teacherInfo?.firstName, lastName: d.teacherInfo?.lastName, email: d.teacherInfo?.email }}
        />
      )}

      {d.showSettingsModal && (
        <SettingsModal isOpen={d.showSettingsModal} onClose={() => d.setShowSettingsModal(false)} userType="teacher" />
      )}
    </div>
  );
}
