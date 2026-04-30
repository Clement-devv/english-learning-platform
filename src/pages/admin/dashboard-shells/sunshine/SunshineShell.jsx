// src/pages/admin/dashboard-shells/sunshine/SunshineShell.jsx
// Admin dashboard — Sunshine Explorer design.
// Warm amber/orange palette · grouped sidebar nav · Nunito font · dark mode support.
// Same design language as student/teacher Sunshine shells.

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import {
  TrendingUp, Video, User, Home, Bell, Users, DollarSign,
  Calendar, BarChart3, AlertTriangle, MessageCircle, Mic,
  BookOpen, Shield, CalendarDays, FileText, Star, Palette, Globe,
  Settings, LogOut, CheckCircle2, ClipboardList, Award,
} from 'lucide-react';
import { useNavigate }            from 'react-router-dom';
import { useAuth }                from '../../../../context/AuthContext.jsx';
import { useRing }               from '../../../../context/RingContext';
import { useBranding }            from '../../../../context/BrandingContext';
import { useDarkMode }            from '../../../../hooks/useDarkMode';
import { TabErrorBoundary }       from '../../../../components/ErrorBoundary';
import SessionManagement          from '../../../../components/SessionManagement';
import SettingsSidebar            from '../../../../components/SettingsSidebar';
import SettingsModal              from '../../../../components/SettingsModal';
import api                        from '../../../../api';
import { getTeachers }            from '../../../../services/teacherService';
import { getStudents }            from '../../../../services/studentService';

// Tab components — lazy loaded
const OverviewTab        = lazy(() => import('../../tabs/OverviewTab'));
const TeachersTab        = lazy(() => import('../../tabs/TeachersTab'));
const StudentsTab        = lazy(() => import('../../tabs/StudentsTab'));
const ClassesTab         = lazy(() => import('../../tabs/ClassesTab'));
const ApplicationsTab    = lazy(() => import('../../tabs/ApplicationsTab'));
const NotificationsTab   = lazy(() => import('../../tabs/NotificationsTab'));
const AssignStudentsTab  = lazy(() => import('../../tabs/AssignStudentsTab'));
const BookingsTab        = lazy(() => import('../../tabs/BookingsTab'));
const MessagesTab        = lazy(() => import('../../../../components/chat/MessagesTab'));
const PaymentsTab        = lazy(() => import('../../tabs/PaymentTab'));
const DisputeReview      = lazy(() => import('../../../../components/admin/DisputeReview'));
const AnalyticsDashboard = lazy(() => import('../../../../components/analytics/AnalyticsDashboard'));
const SubAdminsTab       = lazy(() => import('../../tabs/SubAdminsTab'));
const TeacherScheduleTab = lazy(() => import('../../tabs/TeacherScheduleTab'));
const ChatCreditsTab          = lazy(() => import('../../tabs/ChatCreditsTab'));
const PronunciationCreditsTab = lazy(() => import('../../tabs/PronunciationCreditsTab'));
const RecordingsTab      = lazy(() => import('../../tabs/RecordingsTab'));
const ReportsTab         = lazy(() => import('../../tabs/ReportsTab'));
const ReviewsTab         = lazy(() => import('../../tabs/ReviewsTab'));
const ReferralsTab       = lazy(() => import('../../tabs/ReferralsTab'));
const BrandingTab        = lazy(() => import('../../tabs/BrandingTab'));
const DomainTab          = lazy(() => import('../../tabs/DomainTab'));
const ClassPricingTab    = lazy(() => import('../../tabs/ClassPricingTab'));
const GroupClassesTab                = lazy(() => import('../../tabs/GroupClassesTab'));
const CertificatesTab                = lazy(() => import('../../tabs/CertificatesTab'));
const CertificateTemplateSettingsTab = lazy(() => import('../../tabs/CertificateTemplateSettingsTab'));
const ParentsTab                     = lazy(() => import('../../tabs/ParentsTab'));

// ── Heartbeat intervals ───────────────────────────────────────────────────────
const TICK_MS     = 30_000;
const TICK_NOTIF  = 2;   // every 60s — unread notification count
const TICK_PEOPLE = 6;   // every 3 min — teachers + students lists

// ── Design tokens ─────────────────────────────────────────────────────────────
const palette = (dark) => ({
  bg:      dark ? '#0f1117' : '#fff8f0',
  card:    dark ? '#1a1d2e' : '#ffffff',
  cardAlt: dark ? '#1f2235' : '#fffbf5',
  border:  dark ? '#2a2d40' : '#ffe8cc',
  heading: dark ? '#f0f4ff' : '#3d2e20',
  body:    dark ? '#c8cce0' : '#5a4a3a',
  muted:   dark ? '#6b7090' : '#a89480',
  accent:  dark ? '#fbbf24' : '#f97316',
  sidebar: dark ? '#13111a' : '#ffffff',
});

// ── Nav groups ────────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { key: 'overview',  label: 'Overview',  lucide: TrendingUp },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { key: 'analytics',     label: 'Analytics',     lucide: BarChart3       },
      { key: 'notifications', label: 'Notifications', lucide: Bell            },
      { key: 'messages',      label: 'Messages',      lucide: MessageCircle   },
      { key: 'sub-admins',    label: 'Sub-Admins',    lucide: Shield          },
    ],
  },
  {
    label: 'People',
    items: [
      { key: 'teachers',          label: 'Teachers',          lucide: Video        },
      { key: 'teacher-schedules', label: 'Teacher Schedules', lucide: CalendarDays },
      { key: 'students',          label: 'Students',          lucide: User         },
      { key: 'parents',           label: 'Parents',           lucide: Users        },
      { key: 'applications',      label: 'Applications',      lucide: Home         },
      { key: 'assign',            label: 'Assign Students',   lucide: Users        },
    ],
  },
  {
    label: 'Classes',
    items: [
      { key: 'classes',       label: 'All Classes',    lucide: BookOpen     },
      { key: 'group-classes', label: 'Group Classes',  lucide: Users        },
      { key: 'bookings',   label: 'Bookings',         lucide: ClipboardList},
      { key: 'recordings',    label: 'Recordings',       lucide: Video    },
      { key: 'certificates',  label: 'Certificates',     lucide: Award    },
      { key: 'reports',       label: 'Progress Reports', lucide: FileText },
      { key: 'reviews',       label: 'Reviews',          lucide: Star     },
      { key: 'referrals',     label: 'Referrals',        lucide: Users    },
    ],
  },
  {
    label: 'Finance',
    items: [
      { key: 'payments',      label: 'Payments',      lucide: DollarSign     },
      { key: 'class-pricing', label: 'Class Pricing', lucide: DollarSign     },
      { key: 'chat-credits',          label: 'Chat Credits',          lucide: MessageCircle  },
      { key: 'pronunciation-credits', label: 'Pronunciation Credits', lucide: Mic            },
      { key: 'disputes',              label: 'Disputes',              lucide: AlertTriangle  },
    ],
  },
  {
    label: 'Settings',
    items: [
      { key: 'branding',      label: 'Branding',              lucide: Palette },
      { key: 'domain',        label: 'Custom Domain',         lucide: Globe   },
      { key: 'cert-template', label: 'Certificate Template',  lucide: Award   },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items);
const PAGE_LABEL = ALL_ITEMS.reduce((m, i) => ({ ...m, [i.key]: i.label }), {});
const F = "'Nunito','Inter',sans-serif";
const FONT_IMPORT = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap';
const ACCENT_GRADIENT = 'linear-gradient(135deg,#f97316 0%,#f43f5e 100%)';
const TAB_SHADOW = 'rgba(249,115,22,0.35)';

function TabLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', fontFamily: F }}>
      <style>{`@keyframes as-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #ffe8cc', borderTopColor: '#f97316', animation: 'as-spin .75s linear infinite' }} />
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
export default function SunshineShell() {
  const navigate = useNavigate();
  const { user: adminInfo, logout: authLogout } = useAuth();
  const { branding, center } = useBranding();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const col = palette(isDarkMode);
  const centerName = center?.centerName || 'Admin Panel';
  const { missedCalls, missedCallCount, clearMissedCalls } = useRing();

  const [activeTab,       setActiveTab]       = useState('overview');
  const [teachers,        setTeachers]        = useState([]);
  const [students,        setStudents]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [unreadMessages,  setUnreadMessages]  = useState(0);
  const [unreadNotif,     setUnreadNotif]     = useState(0);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [showSettingsModal,   setShowSettingsModal]   = useState(false);
  const [showSessionMgmt,     setShowSessionMgmt]     = useState(false);
  const [notifications,   setNotifications]   = useState([]);
  const [toast,           setToast]           = useState('');

  const activeTeachers = teachers.filter(t => t.active && t.status === 'active' && !t.scheduledDeletionAt);

  useEffect(() => {
    (async () => {
      try {
        const [t, s] = await Promise.all([getTeachers(), getStudents()]);
        setTeachers(t);
        setStudents(s);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshNotif = useCallback(async () => {
    // Skip if the token is missing entirely — avoids a guaranteed 401 when
    // sessionStorage was cleared (tab restore after browser restart, etc.)
    if (!sessionStorage.getItem('adminToken')) return;
    try {
      const res = await api.get('/notifications/unread-count');
      if (res.data.success) setUnreadNotif(res.data.count);
    } catch (_) {}
  }, []);

  const refreshPeople = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([getTeachers(), getStudents()]);
      setTeachers(t);
      setStudents(s);
    } catch (_) {}
  }, []);

  // ── Heartbeat — single interval, visibility-aware ─────────────────────────
  useEffect(() => {
    refreshNotif();
    const tickRef = { current: 0 };
    const id = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      tickRef.current += 1;
      const tick = tickRef.current;
      if (tick % TICK_NOTIF  === 0) refreshNotif();
      if (tick % TICK_PEOPLE === 0) refreshPeople();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [refreshNotif, refreshPeople]);

  const handleLogout = () => { authLogout(); navigate('/admin/login'); };
  const handleNotify = (note) => {
    const full = typeof note === 'string'
      ? { message: note, date: new Date().toISOString() }
      : { ...note, date: note.date || new Date().toISOString() };
    setNotifications(p => [full, ...p]);
  };

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'overview':          return <OverviewTab isDarkMode={isDarkMode} />;
      case 'analytics':         return <AnalyticsDashboard isDarkMode={isDarkMode} />;
      case 'teachers':          return <TeachersTab onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case 'teacher-schedules': return <TeacherScheduleTab teachers={activeTeachers} isDarkMode={isDarkMode} />;
      case 'students':          return <StudentsTab onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case 'classes':           return <ClassesTab isDarkMode={isDarkMode} />;
      case 'group-classes':     return <GroupClassesTab  isDarkMode={isDarkMode} />;
      case 'certificates':      return <CertificatesTab  isDarkMode={isDarkMode} />;
      case 'parents':           return <ParentsTab        isDarkMode={isDarkMode} />;
      case 'applications':      return <ApplicationsTab isDarkMode={isDarkMode} />;
      case 'notifications':     return <NotificationsTab isDarkMode={isDarkMode} onUnreadCount={setUnreadNotif} />;
      case 'assign':            return <AssignStudentsTab teachers={activeTeachers} students={students} onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case 'bookings':          return <BookingsTab teachers={activeTeachers} students={students} onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case 'messages':          return <MessagesTab userRole="admin" onUnreadCount={setUnreadMessages} />;
      case 'payments':          return <PaymentsTab isDarkMode={isDarkMode} />;
      case 'class-pricing':     return <ClassPricingTab isDarkMode={isDarkMode} />;
      case 'chat-credits':          return <ChatCreditsTab isDarkMode={isDarkMode} />;
      case 'pronunciation-credits': return <PronunciationCreditsTab isDarkMode={isDarkMode} />;
      case 'disputes':          return <DisputeReview isDarkMode={isDarkMode} />;
      case 'recordings':        return <RecordingsTab teachers={teachers} isDarkMode={isDarkMode} />;
      case 'reports':           return <ReportsTab students={students} isDarkMode={isDarkMode} />;
      case 'reviews':           return <ReviewsTab isDarkMode={isDarkMode} />;
      case 'referrals':         return <ReferralsTab isDarkMode={isDarkMode} />;
      case 'sub-admins':        return <SubAdminsTab isDarkMode={isDarkMode} teachers={teachers} />;
      case 'branding':          return <BrandingTab isDarkMode={isDarkMode} />;
      case 'domain':            return <DomainTab isDarkMode={isDarkMode} />;
      case 'cert-template':     return <CertificateTemplateSettingsTab isDarkMode={isDarkMode} />;
      default:                  return <OverviewTab isDarkMode={isDarkMode} />;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isDarkMode, loading, teachers, students]);

  const STATS = [
    { label: 'Teachers',  value: teachers.length,       icon: Video,         g: 'linear-gradient(135deg,#f97316,#fbbf24)' },
    { label: 'Students',  value: students.length,       icon: Users,         g: 'linear-gradient(135deg,#f43f5e,#fb7185)' },
    { label: 'Messages',  value: unreadMessages || 0,   icon: MessageCircle, g: 'linear-gradient(135deg,#8b5cf6,#a78bfa)' },
    { label: 'Alerts',    value: unreadNotif || 0,      icon: Bell,          g: 'linear-gradient(135deg,#06b6d4,#67e8f9)' },
  ];

  const showHero = activeTab === 'overview';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: F, background: col.bg }}>
      <style>{`
        @import url('${FONT_IMPORT}');
        * { box-sizing: border-box; }
        .as-nav { transition: all 0.18s; }
        .as-nav:hover { background: ${isDarkMode ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.08)'} !important; }
        .as-card { transition: transform 0.2s, box-shadow 0.2s; }
        .as-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.10) !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${isDarkMode ? '#2a2d40' : '#ffd0a8'}; border-radius: 10px; }
      `}</style>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 224, flexShrink: 0,
        background: col.sidebar,
        borderRight: `2px solid ${col.border}`,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', overflowX: 'hidden',
        zIndex: 100,
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 16px 14px', borderBottom: `2px solid ${col.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: ACCENT_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: `0 4px 12px ${TAB_SHADOW}`, flexShrink: 0 }}>
              🛡️
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: col.heading, lineHeight: 1.2 }}>{centerName}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: col.muted }}>Admin Panel</div>
            </div>
          </div>
        </div>

        {/* Admin info card */}
        <div style={{ margin: '12px 10px', background: isDarkMode ? 'rgba(249,115,22,0.1)' : '#fff7ed', border: `2px solid ${isDarkMode ? 'rgba(249,115,22,0.2)' : '#fed7aa'}`, borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: ACCENT_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
            {(adminInfo?.firstName?.[0] || 'A').toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: col.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {adminInfo?.firstName || 'Admin'}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: col.muted }}>{teachers.length} teachers</div>
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
                const isActive = activeTab === item.key;
                const msgBadge = (unreadMessages || 0) + missedCallCount;
                const badge = item.key === 'messages' ? (msgBadge || null)
                            : item.key === 'notifications' ? (unreadNotif || null)
                            : null;
                return (
                  <button key={item.key} className="as-nav"
                    onClick={() => setActiveTab(item.key)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer',
                      background: isActive ? (isDarkMode ? 'rgba(249,115,22,0.18)' : '#fff7ed') : 'transparent',
                      fontFamily: F, textAlign: 'left',
                      borderLeft: isActive ? `3px solid ${col.accent}` : '3px solid transparent',
                      marginBottom: 1,
                    }}>
                    {(() => { const LI = item.lucide; return <LI size={17} strokeWidth={1.8} color={isActive ? col.accent : col.body} style={{ flexShrink: 0 }} />; })()}
                    <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? col.accent : col.body }}>
                      {item.label}
                    </span>
                    {badge != null && (
                      <span style={{ background: isActive ? col.accent : (isDarkMode ? 'rgba(249,115,22,0.3)' : '#fff7ed'), color: isActive ? '#fff' : col.accent, borderRadius: 999, fontSize: 10, fontWeight: 900, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom controls */}
        <div style={{ padding: '8px 8px 16px', borderTop: `2px solid ${col.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: col.muted }}>{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
            <button onClick={toggleDarkMode}
              style={{ width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: isDarkMode ? col.accent : col.border, position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: isDarkMode ? 21 : 3, transition: 'left .2s' }} />
            </button>
          </div>
          <button className="as-nav" onClick={() => setShowSettingsSidebar(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F, marginBottom: 1 }}>
            <Settings size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>Settings</span>
          </button>
          <button className="as-nav" onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F }}>
            <LogOut size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{ height: 64, background: col.sidebar, borderBottom: `2px solid ${col.border}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col.heading, flex: 1, fontFamily: F }}>
            {PAGE_LABEL[activeTab] || 'Overview'}
          </h1>

          {/* Notification bell */}
          <button onClick={() => setActiveTab('notifications')}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: col.muted, padding: 6, borderRadius: 10, display: 'flex', alignItems: 'center' }}>
            <Bell size={19} color={col.muted} />
            {unreadNotif > 0 && (
              <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
            )}
          </button>

          {/* Messages pill */}
          {unreadMessages > 0 && (
            <div onClick={() => setActiveTab('messages')} style={{ background: isDarkMode ? 'rgba(249,115,22,0.1)' : '#fff7ed', border: `2px solid ${isDarkMode ? 'rgba(249,115,22,0.25)' : '#fed7aa'}`, borderRadius: 999, padding: '5px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>💬</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: col.accent }}>{unreadMessages} new</span>
            </div>
          )}

          {/* Avatar */}
          <div onClick={() => setShowSettingsSidebar(true)}
            style={{ width: 36, height: 36, borderRadius: 12, background: ACCENT_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', flexShrink: 0 }}>
            {(adminInfo?.firstName?.[0] || 'A').toUpperCase()}
          </div>
        </header>

        {/* Scroll area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* Toast */}
          {toast && (
            <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, padding: '12px 22px', borderRadius: 20, fontWeight: 700, fontSize: 14, background: '#10b981', color: '#fff', fontFamily: F, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
              ✅ {toast}
            </div>
          )}

          {/* Hero — only on overview */}
          {showHero && (
            <div style={{ position: 'relative', borderRadius: 28, overflow: 'hidden', marginBottom: 28, padding: '32px 36px', background: ACCENT_GRADIENT }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
              <div style={{ position: 'absolute', bottom: -30, right: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <p style={{ margin: '0 0 4px', color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {centerName}
                </p>
                <h2 style={{ margin: '0 0 20px', color: '#fff', fontWeight: 900, fontSize: 26, fontFamily: F }}>
                  Welcome back, {adminInfo?.firstName || 'Admin'} 👋
                </h2>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {STATS.map(({ label, value, icon: Icon, g }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', borderRadius: 16, padding: '10px 18px' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={16} color="#fff" strokeWidth={2} />
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Missed calls alert — visible on overview */}
          {showHero && missedCallCount > 0 && (
            <div style={{ background: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fff5f5', border: `2px solid ${isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca'}`, borderRadius: 20, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#ef4444,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(239,68,68,0.35)' }}>
                <AlertTriangle size={20} color='#fff' />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: isDarkMode ? '#fca5a5' : '#dc2626', fontFamily: F }}>
                    {missedCallCount} Missed Call{missedCallCount > 1 ? 's' : ''}
                  </h3>
                  <span style={{ fontSize: 11, color: col.muted, fontWeight: 600 }}>while you were away</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {missedCalls.map((mc, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: isDarkMode ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.2)' : '#fecaca'}`, borderRadius: 12, padding: '7px 12px' }}>
                      <div style={{ width: 30, height: 30, borderRadius: 10, background: 'linear-gradient(135deg,#ef4444,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                        {(mc.callerName?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: col.heading, lineHeight: 1.2 }}>{mc.callerName}</p>
                        <p style={{ margin: 0, fontSize: 10, color: col.muted, fontWeight: 600 }}>
                          {mc.callerRole === 'teacher' ? 'Teacher' : mc.callerRole === 'student' ? 'Student' : mc.callerRole} · {new Date(mc.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={clearMissedCalls} style={{ background: isDarkMode ? 'rgba(255,255,255,0.08)' : '#fff', border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.12)' : '#fecaca'}`, borderRadius: 10, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: col.muted, flexShrink: 0, fontFamily: F }}>
                ✓ Mark seen
              </button>
            </div>
          )}

          {/* Tab content */}
          <Suspense fallback={<TabLoader />}>
            <TabErrorBoundary key={activeTab}>
              {tabContent}
            </TabErrorBoundary>
          </Suspense>
        </main>
      </div>

      {/* Overlays */}
      <SettingsSidebar
        isOpen={showSettingsSidebar}
        onClose={() => setShowSettingsSidebar(false)}
        onChangePassword={() => { setShowSettingsSidebar(false); }}
        onManageSessions={() => { setShowSettingsSidebar(false); setShowSessionMgmt(true); }}
        onManage2FA={() => { setShowSettingsSidebar(false); setShowSettingsModal(true); }}
        userInfo={{
          firstName: adminInfo?.firstName || 'Admin',
          lastName:  adminInfo?.lastName  || 'User',
          email:     adminInfo?.email     || 'admin@example.com',
        }}
      />
      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} userType="admin" />
      {showSessionMgmt && (
        <SessionManagement isOpen={showSessionMgmt} onClose={() => setShowSessionMgmt(false)} userType="admin" />
      )}
    </div>
  );
}
