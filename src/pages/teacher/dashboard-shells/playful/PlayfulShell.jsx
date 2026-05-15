// src/pages/teacher/dashboard-shells/playful/PlayfulShell.jsx
// Teacher dashboard — Playful Platform design.
// Dark 72px icon sidebar · hero banner · category tiles · right panel stats.
// Mirrors the student PlayfulShell pattern, adapted for teacher content.

import React, { useState } from 'react';
import { useViewMode } from '../../../../hooks/useViewMode';
import {
  Home, Calendar, CheckCircle, Users, BookOpen, MessageCircle,
  DollarSign, GraduationCap, Film, Star, User, CalendarDays,
  Settings, LogOut, Plus, Bell, Video, Sun, Moon, ChevronRight, Play,
} from 'lucide-react';
import { useBranding }              from '../../../../context/BrandingContext';
import { useTeacherDashboardData }  from '../useTeacherDashboardData';
import TeacherTabContent            from '../TeacherTabContent';
import { TabErrorBoundary }         from '../../../../components/ErrorBoundary';
import Classroom                    from '../../../Classroom';
import ClassModal                   from '../../components/classes/ClassModal';
import ConfirmModal                 from '../../components/classes/ConfirmModal';
import RecurringClassForm           from '../../../../components/teacher/RecurringClassForm';
import ChangePassword               from '../../../../components/teacher/auth/ChangePassword';
import SessionManagement            from '../../../../components/SessionManagement';
import SettingsModal                from '../../../../components/SettingsModal';
import GoogleMeetSettings           from '../../../../components/GoogleMeetSettings';
import LiveClasses                  from '../../components/dashboard/LiveClasses';
import LanguageSwitcher             from '../../../../components/LanguageSwitcher';
import UpcomingClasses              from '../../components/dashboard/UpcomingClasses';

// ── Palette ────────────────────────────────────────────────────────────────────
const LIGHT = {
  sidebar:   '#13131F',
  sideText:  'rgba(255,255,255,0.55)',
  bg:        '#F4F5FF',
  white:     '#FFFFFF',
  card:      '#FFFFFF',
  border:    '#E8EAFF',
  text:      '#13131F',
  textSub:   '#5A5B72',
  textMuted: '#9899B0',
  inputBg:   '#EDEEFF',
  // Vivid accents
  pink:    '#FF6B9D',
  coral:   '#FF6B6B',
  orange:  '#FF8E53',
  yellow:  '#FFD93D',
  green:   '#4ADE80',
  blue:    '#4D96FF',
  teal:    '#06B6D4',
  indigo:  '#818CF8',
  purple:  '#A855F7',
  red:     '#EF4444',
};
const DARK_OVERRIDES = {
  bg:        '#0C0D1A',
  white:     '#161728',
  card:      '#1C1D2E',
  border:    '#262740',
  text:      '#F0F2FF',
  textSub:   '#A8AAC8',
  textMuted: '#606280',
  inputBg:   '#161728',
};

// ── Sidebar nav items ──────────────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard',  Icon: Home,          label: 'Home',      tab: 'dashboard',         dot: '#FF6B9D' },
  { id: 'classes',    Icon: Calendar,      label: 'Classes',   tab: 'classes',            dot: '#4D96FF' },
  { id: 'students',   Icon: Users,         label: 'Students',  tab: 'students',           dot: '#4ADE80' },
  { id: 'bookings',   Icon: BookOpen,      label: 'Bookings',  tab: 'bookings',           dot: '#FFD93D' },
  { id: 'content',    Icon: GraduationCap, label: 'Content',   tab: 'homework',           dot: '#FF8E53' },
  { id: 'messages',   Icon: MessageCircle, label: 'Messages',  tab: 'messages',           dot: '#06B6D4' },
  { id: 'more',       Icon: Star,          label: 'More',      tab: 'payment',            dot: '#818CF8' },
];

// Which tabs belong to each nav section
const SECTION_TABS = {
  dashboard: ['dashboard'],
  classes:   ['classes', 'completed-classes', 'schedule'],
  students:  ['students'],
  bookings:  ['bookings'],
  content:   ['homework', 'quiz', 'vocab'],
  messages:  ['messages'],
  more:      ['payment', 'recordings', 'reviews', 'profile'],
};

// Sub-tabs shown in the top bar per section
const SUB_TABS = {
  classes: [
    { key: 'classes',           label: 'Active'    },
    { key: 'completed-classes', label: 'Completed' },
    { key: 'schedule',          label: 'Schedule'  },
  ],
  content: [
    { key: 'homework', label: 'Homework'   },
    { key: 'quiz',     label: 'Quizzes'   },
    { key: 'vocab',    label: 'Vocabulary'},
  ],
  more: [
    { key: 'payment',    label: 'Payment'    },
    { key: 'recordings', label: 'Recordings' },
    { key: 'reviews',    label: 'Reviews'    },
    { key: 'profile',    label: 'Profile'    },
  ],
};

// Category tiles shown on the dashboard
const TILES = [
  { tab: 'classes',           label: 'My Classes',  emoji: '📅', g: ['#4D96FF', '#818CF8'], light: '#EEF3FF' },
  { tab: 'students',          label: 'Students',    emoji: '👥', g: ['#4ADE80', '#06B6D4'], light: '#EDFFF6' },
  { tab: 'bookings',          label: 'Bookings',    emoji: '📖', g: ['#FFD93D', '#FF8E53'], light: '#FFFAEE' },
  { tab: 'homework',          label: 'Homework',    emoji: '📚', g: ['#FF6B6B', '#FF8E53'], light: '#FFF1EE' },
  { tab: 'quiz',              label: 'Quizzes',     emoji: '📝', g: ['#A855F7', '#818CF8'], light: '#F5F0FF' },
  { tab: 'messages',          label: 'Messages',    emoji: '💬', g: ['#06B6D4', '#4D96FF'], light: '#EEF9FF' },
  { tab: 'schedule',          label: 'Schedule',    emoji: '🗓️', g: ['#FF6B9D', '#FF6B6B'], light: '#FFF0F6' },
  { tab: 'payment',           label: 'Payment',     emoji: '💰', g: ['#4ADE80', '#06B6D4'], light: '#EDFFF6' },
];

const PAGE_TITLE = {
  dashboard: 'Home', classes: 'My Classes', 'completed-classes': 'Completed Classes',
  schedule: 'Schedule', students: 'Students', bookings: 'Bookings', messages: 'Messages',
  payment: 'Payment', homework: 'Homework', quiz: 'Quizzes', vocab: 'Vocabulary',
  recordings: 'Recordings', reviews: 'Reviews', profile: 'Profile',
};

export default function PlayfulShell() {
  const { branding, center } = useBranding();
  const d = useTeacherDashboardData();
  const P = d.isDarkMode ? { ...LIGHT, ...DARK_OVERRIDES } : LIGHT;
  const F = "'Poppins','Inter',sans-serif";

  const [showSettings,       setShowSettings]       = useState(false);
  const [showRecurringLocal, setShowRecurringLocal] = useState(false);
  const { isMobile, forcedMode, setViewMode, isSmallScreen } = useViewMode();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const tipStyle = { background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, fontSize: 13, fontFamily: F, color: P.text };

  const activeSection = NAV.find(n => SECTION_TABS[n.id]?.includes(d.activeTab))?.id || 'dashboard';
  const subTabs = SUB_TABS[activeSection] || [];

  // ── Loading ──────────────────────────────────────────────────────────────
  if (d.loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.bg, fontFamily: F }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
          @keyframes pfBounce{to{transform:translateY(-16px)}}
        `}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, animation: 'pfBounce 0.8s infinite alternate' }}>🎓</div>
          <p style={{ color: P.pink, fontWeight: 700, fontSize: 18, marginTop: 16, fontFamily: F }}>Loading your classes...</p>
        </div>
      </div>
    );
  }

  // ── Classroom overlay ────────────────────────────────────────────────────
  if (d.isClassroomOpen && d.activeClass)
    return <Classroom classData={d.activeClass} userRole="teacher" onLeave={d.handleLeaveClassroom} />;

  // ── Hero content ─────────────────────────────────────────────────────────
  const hasLive   = d.liveClasses.length > 0;
  const nextClass = d.upcomingClasses[0];
  const heroGrad  = hasLive
    ? 'linear-gradient(135deg,#FF6B6B,#FF8E53)'
    : d.pendingBookings > 0
      ? 'linear-gradient(135deg,#4D96FF,#818CF8)'
      : 'linear-gradient(135deg,#FF6B9D,#FF8E53)';
  const heroTitle = hasLive
    ? `You have a LIVE class right now!`
    : d.pendingBookings > 0
      ? `${d.pendingBookings} booking${d.pendingBookings > 1 ? 's' : ''} waiting for your response!`
      : nextClass
        ? `Next class: ${nextClass.title}`
        : `Keep up the great work, ${d.teacherInfo?.firstName || 'Teacher'}!`;
  const heroSub = hasLive
    ? `"${d.liveClasses[0]?.title}" is live — join now`
    : d.pendingBookings > 0
      ? 'Review and accept or reject these booking requests.'
      : nextClass
        ? `${nextClass.date} · ${nextClass.time}`
        : `You have ${d.completedCount} completed classes so far.`;
  const heroBtn = hasLive
    ? { label: 'Join Class →', action: () => d.handleJoinClass(d.liveClasses[0]) }
    : d.pendingBookings > 0
      ? { label: 'Review Bookings →', action: () => d.setActiveTab('bookings') }
      : { label: 'View Schedule →', action: () => d.setActiveTab('schedule') };
  const heroEmojis = hasLive ? ['🔴', '📡', '🎉'] : d.pendingBookings > 0 ? ['📖', '✅', '🔔'] : ['🌟', '📚', '🎓'];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: F, background: P.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${P.border}; border-radius: 99px; }
        .pft-nav:hover { background: rgba(255,255,255,0.08) !important; }
        .pft-tile { transition: transform .18s, box-shadow .18s; cursor: pointer; }
        .pft-tile:hover { transform: translateY(-4px) scale(1.03); box-shadow: 0 12px 32px rgba(0,0,0,0.18) !important; }
        .pft-btn { transition: transform .12s, filter .12s; }
        .pft-btn:hover { transform: translateY(-2px); filter: brightness(1.08); }
        .pft-card { transition: box-shadow .15s; }
        .pft-card:hover { box-shadow: 0 6px 24px rgba(77,150,255,0.10) !important; }
        @keyframes pf0 { 0%,100%{transform:translateY(0) rotate(-12deg)} 50%{transform:translateY(-8px) rotate(-12deg)} }
        @keyframes pf1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes pf2 { 0%,100%{transform:translateY(0) rotate(10deg)} 50%{transform:translateY(-6px) rotate(10deg)} }
      `}</style>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside style={{
        width: 72, flexShrink: 0, background: P.sidebar,
        display: isMobile ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '18px 0', gap: 2, zIndex: 100,
        boxShadow: '3px 0 20px rgba(0,0,0,0.25)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: 'linear-gradient(135deg,#FF6B9D,#FF8E53)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 12px rgba(255,107,157,0.5)' }}>
            👨‍🏫
          </div>
          <div style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '.04em', maxWidth: 60, textAlign: 'center', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {center?.centerName}
          </div>
        </div>

        {NAV.map(({ id, Icon, label, tab, dot }) => {
          const isActive = id === activeSection;
          const badge = id === 'bookings' && d.pendingBookings > 0 ? d.pendingBookings
                      : id === 'content' && (d.homeworkToGrade + d.quizAttempted) > 0 ? (d.homeworkToGrade + d.quizAttempted)
                      : id === 'messages' && d.unreadMessages > 0 ? d.unreadMessages
                      : null;
          return (
            <button key={id} className="pft-nav" title={label}
              onClick={() => d.setActiveTab(tab)}
              style={{
                width: 52, height: 52, borderRadius: 16, border: 'none', cursor: 'pointer',
                background: isActive ? dot + '22' : 'transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, position: 'relative',
                outline: isActive ? `2px solid ${dot}44` : 'none',
              }}>
              <Icon size={20} color={isActive ? dot : P.sideText} strokeWidth={isActive ? 2.5 : 1.8} />
              {isActive && <div style={{ width: 4, height: 4, borderRadius: '50%', background: dot }} />}
              {badge && (
                <span style={{ position: 'absolute', top: 4, right: 4, background: P.coral, color: '#fff', borderRadius: 999, fontSize: 8, fontWeight: 800, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* Push toggle */}
        {d.pushSupported() && (
          <button className="pft-nav" title={d.pushEnabled ? 'Disable notifications' : 'Enable notifications'}
            onClick={d.togglePush}
            style={{ width: 52, height: 52, borderRadius: 16, border: 'none', cursor: 'pointer', background: d.pushEnabled ? '#16a34a22' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: d.pushEnabled ? P.green : P.sideText }}>
            <Bell size={20} fill={d.pushEnabled ? 'currentColor' : 'none'} strokeWidth={1.8} />
          </button>
        )}

        <button className="pft-nav" title="Settings" onClick={() => setShowSettings(true)}
          style={{ width: 52, height: 52, borderRadius: 16, border: 'none', cursor: 'pointer', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.sideText }}>
          <Settings size={20} strokeWidth={1.8} />
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <LanguageSwitcher compact col={{ border: 'rgba(255,255,255,0.15)', body: P.sideText }} fontFamily={F} />
        </div>
        <button className="pft-nav" title="Sign out" onClick={d.handleLogout}
          style={{ width: 52, height: 52, borderRadius: 16, border: 'none', cursor: 'pointer', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.sideText, marginBottom: 4 }}>
          <LogOut size={20} strokeWidth={1.8} />
        </button>
        {isSmallScreen && !isMobile && (
          <button className="pft-nav" title="Mobile View" onClick={() => setViewMode('mobile')}
            style={{ width: 52, height: 52, borderRadius: 16, border: 'none', cursor: 'pointer', background: `${P.pink}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 4 }}>
            📱
          </button>
        )}
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── TOP BAR ── */}
        <header style={{ height: 64, background: P.white, borderBottom: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 24px', gap: isMobile ? 8 : 14, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: P.text, whiteSpace: 'nowrap' }}>
            {PAGE_TITLE[d.activeTab] || 'Home'}
          </h1>

          {/* Sub-tab pills */}
          {subTabs.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              {subTabs.map(st => (
                <button key={st.key} onClick={() => d.setActiveTab(st.key)}
                  style={{ padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: F,
                    background: d.activeTab === st.key ? `linear-gradient(135deg,${P.pink},${P.coral})` : P.inputBg,
                    color: d.activeTab === st.key ? '#fff' : P.textSub,
                  }}>
                  {st.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Pending bookings — desktop only */}
          {!isMobile && d.pendingBookings > 0 && (
            <div onClick={() => d.setActiveTab('bookings')} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 999, padding: '5px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>🔔</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{d.pendingBookings} pending</span>
            </div>
          )}

          {/* Dark mode — desktop only */}
          {!isMobile && (
            <button onClick={d.toggleDarkMode}
              style={{ width: 36, height: 36, borderRadius: 12, border: `1px solid ${P.border}`, background: P.inputBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.textSub }}>
              {d.isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          )}

          {/* New Class */}
          <button className="pft-btn" onClick={() => d.setIsModalOpen(true)}
            style={{ background: `linear-gradient(135deg,${P.pink},${P.coral})`, color: '#fff', border: 'none', borderRadius: 12, padding: isMobile ? '8px 12px' : '9px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 6, boxShadow: `0 4px 14px ${P.pink}55` }}>
            <Plus size={14} />{isMobile ? '' : ' New Class'}
          </button>

          {/* Avatar — desktop only */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg,${P.pink},${P.orange})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, boxShadow: `0 3px 10px ${P.pink}55`, cursor: 'pointer' }}
                onClick={() => setShowSettings(true)}>
                {(d.teacherInfo?.firstName?.[0] || 'T').toUpperCase()}
              </div>
            </div>
          )}
        </header>

        {/* ── SCROLL AREA ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? `16px 14px calc(80px + env(safe-area-inset-bottom, 0px))` : 24 }}>

          {/* Toast */}
          {d.toast && (
            <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, background: d.toast.type === 'error' ? P.coral : P.green, color: '#fff', borderRadius: 16, padding: '12px 20px', fontSize: 14, fontWeight: 700, boxShadow: '0 6px 24px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: F }}>
              {d.toast.type === 'error' ? '✕' : '✓'} {d.toast.message}
            </div>
          )}

          {/* ════ DASHBOARD HOME ════ */}
          {d.activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20, alignItems: 'flex-start' }}>

              {/* LEFT column */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

                {/* Hero banner */}
                <div style={{ background: heroGrad, borderRadius: 24, padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', minHeight: 160, boxShadow: `0 12px 40px rgba(255,107,157,0.3)` }}>
                  {/* Decorative blobs */}
                  <div style={{ position: 'absolute', top: -30, right: 240, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: -40, right: 120, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: 10, right: 20, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', pointerEvents: 'none' }} />

                  <div style={{ zIndex: 1, maxWidth: '58%' }}>
                    <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.25)', borderRadius: 999, padding: '3px 14px', fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 1, marginBottom: 10, backdropFilter: 'blur(6px)' }}>
                      {hasLive ? '🔴 LIVE NOW' : d.pendingBookings > 0 ? '📋 ACTION NEEDED' : '🌟 ALL GOOD'}
                    </div>
                    <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.25, letterSpacing: '-0.3px' }}>{heroTitle}</h2>
                    <p style={{ margin: '0 0 18px', fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{heroSub}</p>
                    <button className="pft-btn" onClick={heroBtn.action}
                      style={{ background: 'rgba(255,255,255,0.95)', color: hasLive ? '#FF6B6B' : d.pendingBookings > 0 ? '#4D96FF' : '#FF6B9D', border: 'none', borderRadius: 999, padding: '10px 24px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: F, display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}>
                      <Play size={14} fill="currentColor" /> {heroBtn.label}
                    </button>
                  </div>

                  <div style={{ zIndex: 1, display: 'flex', gap: 8, alignItems: 'flex-end', paddingRight: 8 }}>
                    {heroEmojis.map((e, i) => (
                      <div key={i} style={{ fontSize: i === 1 ? 56 : 40, lineHeight: 1, filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.2))', marginBottom: i === 1 ? 0 : 8, animation: `pf${i} 3s ease-in-out infinite` }}>{e}</div>
                    ))}
                  </div>
                </div>

                {/* Category tiles */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: P.text }}>Quick Access</h2>
                    <span style={{ fontSize: 13, color: P.textMuted }}>Jump to any section</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
                    {TILES.map(tile => {
                      const badge = tile.tab === 'bookings'  ? d.pendingBookings
                                  : tile.tab === 'homework'  ? d.homeworkToGrade
                                  : tile.tab === 'quiz'      ? d.quizAttempted
                                  : tile.tab === 'messages'  ? d.unreadMessages
                                  : 0;
                      return (
                        <div key={tile.tab} className="pft-tile"
                          onClick={() => d.setActiveTab(tile.tab)}
                          style={{ background: `linear-gradient(135deg,${tile.g[0]},${tile.g[1]})`, borderRadius: 20, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, position: 'relative', boxShadow: `0 4px 16px ${tile.g[0]}44`, minHeight: 110 }}>
                          {badge > 0 && (
                            <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.95)', color: tile.g[0], borderRadius: 999, fontSize: 10, fontWeight: 800, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                              {badge}
                            </span>
                          )}
                          <div style={{ width: 50, height: 50, borderRadius: 16, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, backdropFilter: 'blur(4px)' }}>
                            {tile.emoji}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.2px' }}>{tile.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live classes */}
                <div className="pft-card" style={{ background: P.card, borderRadius: 20, padding: 20, border: `1px solid ${P.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: P.text }}>🔴 Live Classes</h2>
                    {d.liveClasses.length > 0 && <span style={{ background: '#FEE2E2', color: P.red, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{d.liveClasses.length} live</span>}
                  </div>
                  {d.liveClasses.length === 0
                    ? <div style={{ textAlign: 'center', padding: '16px 0', color: P.textMuted }}><div style={{ fontSize: 28, marginBottom: 6 }}>📡</div><p style={{ margin: 0, fontSize: 13 }}>No live classes right now.</p></div>
                    : <LiveClasses classes={d.liveClasses} onJoin={d.handleJoinClass} isDarkMode={d.isDarkMode} />
                  }
                </div>
              </div>

              {/* RIGHT panel */}
              <div style={{ width: isMobile ? '100%' : 290, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Stat tiles */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Students',   value: d.students.length,    emoji: '👥', g: [P.blue, P.teal]      },
                    { label: 'Classes',    value: d.classes.length,      emoji: '📅', g: [P.pink, P.indigo]    },
                    { label: 'Completed',  value: d.completedCount,      emoji: '✅', g: [P.green, P.teal]     },
                    { label: 'Bookings',   value: d.pendingBookings,     emoji: '🔔', g: [P.coral, P.orange]   },
                  ].map(s => (
                    <div key={s.label} style={{ background: `linear-gradient(135deg,${s.g[0]},${s.g[1]})`, borderRadius: 16, padding: '14px 12px', textAlign: 'center', boxShadow: `0 4px 14px ${s.g[0]}44` }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{s.emoji}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Upcoming classes */}
                <div className="pft-card" style={{ background: P.card, borderRadius: 20, padding: 18, border: `1px solid ${P.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: P.text }}>📅 Upcoming</h3>
                    <button onClick={() => d.setActiveTab('schedule')} style={{ background: 'none', border: 'none', color: P.blue, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                      All <ChevronRight size={13} />
                    </button>
                  </div>
                  {d.upcomingClasses.length === 0
                    ? <div style={{ textAlign: 'center', padding: '12px 0', color: P.textMuted, fontSize: 12 }}>No upcoming classes scheduled.</div>
                    : <UpcomingClasses classes={d.upcomingClasses.slice(0, 3)} students={d.students} onCancel={d.askCancelClass} onDelete={d.askDeleteClass} isDarkMode={d.isDarkMode} />
                  }
                </div>

                {/* Attention items */}
                {(d.homeworkToGrade > 0 || d.quizAttempted > 0) && (
                  <div className="pft-card" style={{ background: P.card, borderRadius: 20, border: `1px solid ${P.border}`, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${P.border}` }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: P.text }}>📬 Needs Attention</h3>
                    </div>
                    <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {d.homeworkToGrade > 0 && (
                        <div onClick={() => d.setActiveTab('homework')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: '#FFF1EE', cursor: 'pointer' }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📚</div>
                          <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700, color: P.text }}>{d.homeworkToGrade} homework to grade</div></div>
                          <ChevronRight size={13} color={P.textMuted} />
                        </div>
                      )}
                      {d.quizAttempted > 0 && (
                        <div onClick={() => d.setActiveTab('quiz')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: '#F5F0FF', cursor: 'pointer' }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📝</div>
                          <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700, color: P.text }}>{d.quizAttempted} quiz results to review</div></div>
                          <ChevronRight size={13} color={P.textMuted} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Google Meet quick-setup */}
                {d.teacherInfo?._id && (
                  <div className="pft-card" style={{ background: P.card, borderRadius: 20, overflow: 'hidden', border: `1px solid ${P.border}` }}>
                    <button onClick={() => d.setShowGoogleMeetSettings(!d.showGoogleMeetSettings)}
                      style={{ width: '100%', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: F }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Video size={16} color="white" />
                      </div>
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: P.text }}>Google Meet</p>
                        <p style={{ margin: 0, fontSize: 11, color: P.textMuted }}>{d.googleMeetLink ? 'Configured ✓' : 'Click to set up'}</p>
                      </div>
                      <ChevronRight size={14} color={P.textMuted} style={{ transform: d.showGoogleMeetSettings ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                    </button>
                    {d.showGoogleMeetSettings && (
                      <div style={{ padding: '0 18px 16px', borderTop: `1px solid ${P.border}` }}>
                        <GoogleMeetSettings teacherId={d.teacherInfo._id} initialLink={d.googleMeetLink || ''} onUpdate={d.setGoogleMeetLink} isDarkMode={d.isDarkMode} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ OTHER TABS ════ */}
          {d.activeTab !== 'dashboard' && (
            <TabErrorBoundary key={d.activeTab}>
              <TeacherTabContent
                d={d}
                wrapStyle={{ background: P.card, borderRadius: 20, padding: 24, border: `1px solid ${P.border}` }}
                msgStyle={{ background: P.card, borderRadius: 20, border: `1px solid ${P.border}`, overflow: 'hidden' }}
              />
            </TabErrorBoundary>
          )}
        </main>
      </div>

      {/* ── SETTINGS DRAWER ──────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setShowSettings(false)}>
          <div style={{ width: 320, background: P.white, height: '100%', padding: 28, overflowY: 'auto', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: P.text }}>Settings</h2>
              <button onClick={() => setShowSettings(false)} style={{ background: P.inputBg, border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: P.text }}>✕</button>
            </div>

            {/* Profile card */}
            <div style={{ background: `linear-gradient(135deg,${P.pink},${P.orange})`, borderRadius: 16, padding: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 20 }}>
                {(d.teacherInfo?.firstName?.[0] || 'T').toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{d.teacherInfo?.firstName} {d.teacherInfo?.lastName}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{d.teacherInfo?.email || 'Teacher'}</div>
              </div>
            </div>

            {/* Dark mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: P.inputBg, borderRadius: 12, marginBottom: 8, border: `1px solid ${P.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {d.isDarkMode ? <Moon size={15} color={P.pink} /> : <Sun size={15} color={P.orange} />}
                <span style={{ fontSize: 14, color: P.text, fontWeight: 600 }}>{d.isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
              </div>
              <button onClick={d.toggleDarkMode}
                style={{ width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: d.isDarkMode ? P.pink : P.border, position: 'relative', transition: 'background .2s' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: d.isDarkMode ? 23 : 3, transition: 'left .2s' }} />
              </button>
            </div>

            {[
              { label: 'Change Password',    action: () => { setShowSettings(false); d.setShowChangePassword(true); } },
              { label: 'Session Management', action: () => { setShowSettings(false); d.setShowSessionManagement(true); } },
              { label: 'Security & 2FA',     action: () => { setShowSettings(false); d.setShowSettingsModal(true); } },
              { label: 'Recurring Classes',  action: () => { setShowSettings(false); setShowRecurringLocal(true); } },
            ].map(({ label, action }) => (
              <button key={label} onClick={action}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: P.inputBg, border: `1px solid ${P.border}`, borderRadius: 12, marginBottom: 8, cursor: 'pointer', fontFamily: F, fontSize: 14, color: P.text, fontWeight: 500 }}>
                {label} <ChevronRight size={14} style={{ marginLeft: 'auto', color: P.textMuted }} />
              </button>
            ))}

            <button onClick={d.handleLogout}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, background: `linear-gradient(135deg,${P.coral},${P.orange})`, border: 'none', borderRadius: 12, cursor: 'pointer', color: '#fff', fontWeight: 800, fontSize: 14, marginTop: 16, fontFamily: F, boxShadow: `0 4px 16px ${P.coral}55` }}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      )}

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
        <SessionManagement onClose={() => d.setShowSessionManagement(false)} userType="teacher" />
      )}

      {d.showSettingsModal && (
        <SettingsModal isOpen={d.showSettingsModal} onClose={() => d.setShowSettingsModal(false)} userType="teacher" />
      )}

      {/* Floating pill — switch to mobile view on small screens showing desktop layout */}
      {isSmallScreen && !isMobile && (
        <button onClick={() => setViewMode('mobile')}
          style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 999, background: `linear-gradient(135deg,${P.pink},${P.coral})`, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: F, fontSize: 13, fontWeight: 800, boxShadow: `0 4px 18px ${P.pink}66` }}>
          📱 Mobile View
        </button>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: P.white, borderTop: `1px solid ${P.border}`, display: 'flex', zIndex: 200, boxShadow: '0 -4px 20px rgba(0,0,0,0.10)', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
          {[
            { key: 'dashboard', Icon: Home,          label: 'Home',     dot: P.pink   },
            { key: 'classes',   Icon: Calendar,      label: 'Classes',  dot: P.blue   },
            { key: 'students',  Icon: Users,          label: 'Students', dot: P.green  },
            { key: 'messages',  Icon: MessageCircle, label: 'Messages', dot: P.teal   },
          ].map(({ key, Icon, label, dot }) => {
            const isActive = d.activeTab === key;
            const badge = key === 'messages' && d.unreadMessages > 0 ? d.unreadMessages : 0;
            return (
              <button key={key} onClick={() => d.setActiveTab(key)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: F, color: isActive ? dot : P.textMuted, position: 'relative', height: 62, paddingBottom: 6 }}>
                <div style={{ position: 'relative' }}>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                  {badge > 0 && (
                    <span style={{ position: 'absolute', top: -7, right: -10, background: P.coral, color: '#fff', borderRadius: 999, minWidth: 18, height: 18, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: `2px solid ${P.white}` }}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600 }}>{label}</span>
                {isActive && <span style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 28, height: 3, borderRadius: '3px 3px 0 0', background: dot }} />}
              </button>
            );
          })}
          <button onClick={() => setShowMobileMenu(true)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: F, color: P.textMuted, height: 62, paddingBottom: 6 }}>
            <Settings size={22} strokeWidth={1.8} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>More</span>
          </button>
        </nav>
      )}

      {/* ── MOBILE MENU SHEET ── */}
      {isMobile && showMobileMenu && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9500 }} onClick={() => setShowMobileMenu(false)}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: P.white, borderRadius: '20px 20px 0 0', padding: '12px 16px 40px', maxHeight: '75vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: P.border, borderRadius: 999, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {NAV.filter(n => !['dashboard','classes','students','messages'].includes(n.id)).map(({ id, Icon, label, tab, dot }) => {
                const isActive = d.activeTab === tab || (id === 'content' && ['homework','quiz','vocab'].includes(d.activeTab)) || (id === 'more' && ['payment','recordings','reviews','profile'].includes(d.activeTab));
                return (
                  <button key={id} onClick={() => { d.setActiveTab(tab); setShowMobileMenu(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, border: 'none', background: isActive ? `${dot}18` : 'transparent', color: isActive ? dot : P.text, cursor: 'pointer', fontFamily: F, width: '100%' }}>
                    <Icon size={18} color={isActive ? dot : P.textMuted} strokeWidth={1.8} />
                    <span style={{ fontSize: 14, fontWeight: isActive ? 800 : 600 }}>{label}</span>
                  </button>
                );
              })}
              <div style={{ borderTop: `1px solid ${P.border}`, margin: '8px 0 4px' }} />
              <button onClick={() => { setShowMobileMenu(false); setShowSettings(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, border: 'none', background: 'transparent', color: P.text, cursor: 'pointer', fontFamily: F, width: '100%' }}>
                <Settings size={18} color={P.textMuted} strokeWidth={1.8} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Settings</span>
              </button>
              <LanguageSwitcher col={{ body: P.text, muted: P.textMuted, border: P.border }} fontFamily={F} />
              <button onClick={() => setViewMode('desktop')}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, border: 'none', background: 'transparent', color: P.text, cursor: 'pointer', fontFamily: F, width: '100%' }}>
                <span style={{ fontSize: 18 }}>🖥️</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Desktop View</span>
              </button>
              <button onClick={d.handleLogout}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, border: 'none', background: 'transparent', color: P.coral, cursor: 'pointer', fontFamily: F, width: '100%' }}>
                <LogOut size={18} color={P.coral} strokeWidth={1.8} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
