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
  Megaphone, Send, X, CheckCircle,
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
import LanguageSwitcher           from '../../../../components/LanguageSwitcher';
import { useTranslation }         from 'react-i18next';
import ChangePassword             from '../../../../components/admin/auth/ChangePassword';
import ChangeEmail               from '../../../../components/admin/auth/ChangeEmail';

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
const makeNavGroups = (t) => [
  {
    label: null,
    items: [
      { key: 'overview',  label: t('admin.nav.overview'),  lucide: TrendingUp },
    ],
  },
  {
    label: t('admin.navGroup.analytics'),
    items: [
      { key: 'analytics',     label: t('admin.nav.analytics'),     lucide: BarChart3       },
      { key: 'notifications', label: t('admin.nav.notifications'), lucide: Bell            },
      { key: 'messages',      label: t('admin.nav.messages'),      lucide: MessageCircle   },
      { key: 'sub-admins',    label: t('admin.nav.subAdmins'),     lucide: Shield          },
    ],
  },
  {
    label: t('admin.navGroup.people'),
    items: [
      { key: 'teachers',          label: t('admin.nav.teachers'),         lucide: Video        },
      { key: 'teacher-schedules', label: t('admin.nav.teacherSchedules'), lucide: CalendarDays },
      { key: 'students',          label: t('admin.nav.students'),         lucide: User         },
      { key: 'parents',           label: t('admin.nav.parents'),          lucide: Users        },
      { key: 'applications',      label: t('admin.nav.applications'),     lucide: Home         },
      { key: 'assign',            label: t('admin.nav.assignStudents'),   lucide: Users        },
    ],
  },
  {
    label: t('admin.navGroup.classes'),
    items: [
      { key: 'classes',       label: t('admin.nav.allClasses'),      lucide: BookOpen     },
      { key: 'group-classes', label: t('admin.nav.groupClasses'),    lucide: Users        },
      { key: 'bookings',      label: t('admin.nav.bookings'),        lucide: ClipboardList},
      { key: 'recordings',    label: t('admin.nav.recordings'),      lucide: Video        },
      { key: 'certificates',  label: t('admin.nav.certificates'),    lucide: Award        },
      { key: 'reports',       label: t('admin.nav.progressReports'), lucide: FileText     },
      { key: 'reviews',       label: t('admin.nav.reviews'),         lucide: Star         },
      { key: 'referrals',     label: t('admin.nav.referrals'),       lucide: Users        },
    ],
  },
  {
    label: t('admin.navGroup.finance'),
    items: [
      { key: 'payments',              label: t('admin.nav.payments'),             lucide: DollarSign    },
      { key: 'class-pricing',         label: t('admin.nav.classPricing'),         lucide: DollarSign    },
      { key: 'chat-credits',          label: t('admin.nav.chatCredits'),          lucide: MessageCircle },
      { key: 'pronunciation-credits', label: t('admin.nav.pronunciationCredits'), lucide: Mic           },
      { key: 'disputes',              label: t('admin.nav.disputes'),             lucide: AlertTriangle },
    ],
  },
  {
    label: t('admin.navGroup.settings'),
    items: [
      { key: 'branding',      label: t('admin.nav.branding'),      lucide: Palette },
      { key: 'domain',        label: t('admin.nav.customDomain'),  lucide: Globe   },
      { key: 'cert-template', label: t('admin.nav.certTemplate'),  lucide: Award   },
    ],
  },
];
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
  const { t } = useTranslation();
  const { user: adminInfo, logout: authLogout } = useAuth();
  const { branding, center } = useBranding();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const col = palette(isDarkMode);
  const centerName = center?.centerName || 'Admin Panel';

  const NAV_GROUPS = makeNavGroups(t);
  const ALL_ITEMS  = NAV_GROUPS.flatMap(g => g.items);
  const PAGE_LABEL = ALL_ITEMS.reduce((m, i) => ({ ...m, [i.key]: i.label }), {});
  const { missedCalls, missedCallCount, clearMissedCalls } = useRing();

  // Admin always renders in desktop layout — force desktop viewport on every mount
  // (covers SPA navigation where index.html startup script doesn't re-run)
  useEffect(() => {
    const vp = document.getElementById('vp');
    if (vp) vp.content = 'width=1280, viewport-fit=cover';
  }, []);

  const [activeTab,       setActiveTab]       = useState('overview');
  const [teachers,        setTeachers]        = useState([]);
  const [students,        setStudents]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [unreadMessages,  setUnreadMessages]  = useState(0);
  const [unreadNotif,     setUnreadNotif]     = useState(0);
  const [showSettingsSidebar,  setShowSettingsSidebar]  = useState(false);
  const [showSettingsModal,    setShowSettingsModal]    = useState(false);
  const [showSessionMgmt,      setShowSessionMgmt]      = useState(false);
  const [showChangePassword,   setShowChangePassword]   = useState(false);
  const [showChangeEmail,      setShowChangeEmail]      = useState(false);
  const [notifications,   setNotifications]   = useState([]);
  const [toast,           setToast]           = useState('');

  // ── Broadcast ──────────────────────────────────────────────────────────────
  const [broadcastModal,   setBroadcastModal]   = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastTargets, setBroadcastTargets] = useState({
    teachers: { enabled: false, mode: 'all', ids: [] },
    students: { enabled: false, mode: 'all', ids: [] },
    parents:  { enabled: false, mode: 'all', ids: [] },
  });
  const [broadcastSearch,  setBroadcastSearch]  = useState({ teachers: '', students: '', parents: '' });
  const [broadcastParents, setBroadcastParents] = useState([]);
  const [broadcasting,     setBroadcasting]     = useState(false);
  const [broadcastResult,  setBroadcastResult]  = useState(null);

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

  // ── Unread messages count — fetch on mount (DMs + group chats) ─────────────
  // Runs once after login so the badge is accurate even for messages that
  // arrived while the admin was offline / logged out.
  useEffect(() => {
    Promise.all([
      api.get('/direct-messages').catch(() => ({ data: {} })),
      api.get('/group-chats').catch(() => ({ data: {} })),
    ]).then(([{ data: dmData }, { data: gcData }]) => {
      const dmTotal = (dmData.dms   || []).reduce((sum, dm)   => sum + (dm.unreadCount?.admin  || 0), 0);
      const gcTotal = (gcData.chats || []).reduce((sum, chat) => sum + (chat.unreadCount?.admin || 0), 0);
      setUnreadMessages(dmTotal + gcTotal);
    });
  }, []);

  // Clear the badge when the user navigates to the messages tab (sidebar click)
  useEffect(() => {
    if (activeTab === 'messages') setUnreadMessages(0);
  }, [activeTab]);

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

  const handleLogout = () => { authLogout(); navigate('/admin/login', { replace: true }); };
  const handleNotify = (note) => {
    const full = typeof note === 'string'
      ? { message: note, date: new Date().toISOString() }
      : { ...note, date: note.date || new Date().toISOString() };
    setNotifications(p => [full, ...p]);
  };

  const toggleGroup = (group) => {
    setBroadcastTargets(prev => ({
      ...prev,
      [group]: { ...prev[group], enabled: !prev[group].enabled, ids: [] },
    }));
  };
  const setGroupMode = (group, mode) => {
    setBroadcastTargets(prev => ({ ...prev, [group]: { ...prev[group], mode, ids: [] } }));
  };
  const togglePersonId = (group, id) => {
    setBroadcastTargets(prev => {
      const ids = prev[group].ids;
      return { ...prev, [group]: { ...prev[group], ids: ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id] } };
    });
  };
  const selectAllInGroup = (group, peopleList) => {
    setBroadcastTargets(prev => ({
      ...prev,
      [group]: { ...prev[group], ids: peopleList.map(p => p._id || p.id) },
    }));
  };

  const handleBroadcast = async () => {
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const targets = Object.fromEntries(
        Object.entries(broadcastTargets)
          .filter(([, t]) => t.enabled)
          .map(([group, t]) => [group, t.mode === 'specific' ? { mode: 'specific', ids: t.ids } : { mode: 'all' }])
      );
      const res = await api.post('/admin/lessons/broadcast', {
        subject: broadcastSubject, message: broadcastMessage, targets,
      });
      if (res.data.success) setBroadcastResult(res.data);
      else throw new Error(res.data.message);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Broadcast failed');
    } finally {
      setBroadcasting(false);
    }
  };

  const openBroadcast = async () => {
    setBroadcastModal(true);
    setBroadcastSubject('');
    setBroadcastMessage('');
    setBroadcastTargets({
      teachers: { enabled: false, mode: 'all', ids: [] },
      students: { enabled: false, mode: 'all', ids: [] },
      parents:  { enabled: false, mode: 'all', ids: [] },
    });
    setBroadcastSearch({ teachers: '', students: '', parents: '' });
    setBroadcastResult(null);
    try {
      const res = await api.get('/parents');
      setBroadcastParents(res.data.parents || res.data || []);
    } catch (_) { setBroadcastParents([]); }
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
              <div style={{ fontSize: 11, fontWeight: 700, color: col.muted }}>{t('admin.sidebar.portal')}</div>
              {branding?.partnershipText && (
                <div style={{ fontSize: 10, color: col.muted, opacity: 0.75, marginTop: 2, fontStyle: 'italic' }}>{branding.partnershipText}</div>
              )}
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
            <span style={{ fontSize: 12, fontWeight: 700, color: col.muted }}>{isDarkMode ? t('admin.sidebar.darkMode') : t('admin.sidebar.lightMode')}</span>
            <button onClick={toggleDarkMode}
              style={{ width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: isDarkMode ? col.accent : col.border, position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: isDarkMode ? 21 : 3, transition: 'left .2s' }} />
            </button>
          </div>
          <button className="as-nav" onClick={openBroadcast}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', background: isDarkMode ? 'rgba(249,115,22,0.1)' : '#fff7ed', fontFamily: F, marginBottom: 1 }}>
            <Megaphone size={17} color={col.accent} />
            <span style={{ fontSize: 13, fontWeight: 700, color: col.accent }}>{t('admin.sidebar.broadcastEmail')}</span>
          </button>
          <button className="as-nav" onClick={() => setShowSettingsSidebar(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F, marginBottom: 1 }}>
            <Settings size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>{t('admin.sidebar.settings')}</span>
          </button>
          <LanguageSwitcher col={col} fontFamily={F} />
          <button className="as-nav" onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F }}>
            <LogOut size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>{t('admin.sidebar.signOut')}</span>
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

          {/* ── Notification chips ── */}
          {unreadMessages > 0 && (
            <button onClick={() => { setActiveTab('messages'); setUnreadMessages(0); }} title="Go to messages"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: isDarkMode ? 'rgba(139,92,246,0.15)' : '#f5f3ff', border: `2px solid ${isDarkMode ? 'rgba(139,92,246,0.3)' : '#ddd6fe'}`, borderRadius: 999, padding: '5px 14px', cursor: 'pointer', fontFamily: F }}>
              <span style={{ fontSize: 13 }}>💬</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: isDarkMode ? '#a78bfa' : '#7c3aed' }}>{unreadMessages} new</span>
            </button>
          )}
          {missedCallCount > 0 && (
            <button onClick={clearMissedCalls} title="Clear missed calls"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: isDarkMode ? 'rgba(239,68,68,0.12)' : '#fff5f5', border: `2px solid ${isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca'}`, borderRadius: 999, padding: '5px 14px', cursor: 'pointer', fontFamily: F }}>
              <span style={{ fontSize: 13 }}>📞</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>{missedCallCount} missed</span>
            </button>
          )}

          {/* Notification bell */}
          <button onClick={() => setActiveTab('notifications')}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: col.muted, padding: 6, borderRadius: 10, display: 'flex', alignItems: 'center' }}>
            <Bell size={19} color={col.muted} />
            {unreadNotif > 0 && (
              <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
            )}
          </button>

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

      {/* ── Broadcast Modal ── */}
      {broadcastModal && (() => {
        const GROUPS = [
          { key: 'teachers', emoji: '👩‍🏫', label: 'Teachers', people: teachers.filter(t => t.active) },
          { key: 'students', emoji: '👨‍🎓', label: 'Students', people: students.filter(s => s.active) },
          { key: 'parents',  emoji: '👪',   label: 'Parents',  people: broadcastParents },
        ];

        const anyEnabled  = Object.values(broadcastTargets).some(t => t.enabled);
        const specificOk  = Object.entries(broadcastTargets)
          .filter(([, t]) => t.enabled && t.mode === 'specific')
          .every(([, t]) => t.ids.length > 0);
        const canSend = broadcastSubject.trim() && broadcastMessage.trim() && anyEnabled && specificOk;

        const summaryParts = Object.entries(broadcastTargets)
          .filter(([, t]) => t.enabled)
          .map(([g, t]) => t.mode === 'all'
            ? `all ${g}`
            : `${t.ids.length} selected ${g}`);
        const recipientSummary = summaryParts.length ? summaryParts.join(', ') : 'nobody selected';

        const enabledLabel = Object.entries(broadcastTargets)
          .filter(([, t]) => t.enabled)
          .map(([g, t]) => t.mode === 'all'
            ? g.charAt(0).toUpperCase() + g.slice(1)
            : `${t.ids.length} ${g}`)
          .join(' & ') || '—';

        const ov  = { position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
        const box = { background: isDarkMode ? '#1a1d2e' : '#ffffff', border: `2px solid ${col.border}`, borderRadius: 24, width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', fontFamily: F };
        const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 13px', background: isDarkMode ? 'rgba(255,255,255,0.05)' : '#fff8f0', border: `2px solid ${col.border}`, borderRadius: 10, color: col.heading, fontSize: 13, fontFamily: F, outline: 'none' };
        const lbl = { display: 'block', fontSize: 11, fontWeight: 800, color: col.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' };

        return (
          <div style={ov} onClick={e => e.target === e.currentTarget && !broadcasting && setBroadcastModal(false)}>
            <div style={box}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `2px solid ${col.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: ACCENT_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Megaphone size={18} color="#fff" />
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 900, color: col.heading }}>Broadcast Email</span>
                </div>
                {!broadcasting && <button onClick={() => setBroadcastModal(false)} style={{ background: 'none', border: 'none', color: col.muted, cursor: 'pointer', padding: 4, display: 'flex' }}><X size={20} /></button>}
              </div>

              <div style={{ padding: 22 }}>
                {broadcastResult ? (
                  /* ── Success ── */
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <CheckCircle size={44} color="#10b981" style={{ marginBottom: 14 }} />
                    <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: col.heading }}>Sent!</p>
                    <p style={{ margin: '0 0 4px', fontSize: 13, color: col.body }}>
                      <strong style={{ color: '#10b981' }}>{broadcastResult.sent}</strong> email{broadcastResult.sent !== 1 ? 's' : ''} delivered
                      {broadcastResult.failed > 0 && <>, <strong style={{ color: '#ef4444' }}>{broadcastResult.failed}</strong> failed</>}
                    </p>
                    <p style={{ margin: '0 0 24px', fontSize: 12, color: col.muted }}>Total: {broadcastResult.total}</p>
                    <button onClick={() => setBroadcastModal(false)} style={{ padding: '10px 32px', borderRadius: 14, border: 'none', background: ACCENT_GRADIENT, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: F }}>Done</button>
                  </div>
                ) : (
                  <>
                    {/* ── Group toggle cards ── */}
                    <p style={{ ...lbl, marginBottom: 8 }}>Who should receive this?</p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      {GROUPS.map(g => {
                        const t = broadcastTargets[g.key];
                        return (
                          <button key={g.key} onClick={() => !broadcasting && toggleGroup(g.key)} style={{
                            flex: 1, padding: '10px 6px', borderRadius: 14, cursor: 'pointer', textAlign: 'center', fontFamily: F,
                            border: t.enabled ? `2px solid ${col.accent}` : `2px solid ${col.border}`,
                            background: t.enabled ? (isDarkMode ? 'rgba(249,115,22,0.15)' : '#fff7ed') : 'transparent',
                            transition: 'all 0.15s',
                          }}>
                            <div style={{ fontSize: 22, marginBottom: 3 }}>{g.emoji}</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: t.enabled ? col.accent : col.body }}>{g.label}</div>
                            <div style={{ fontSize: 10, color: col.muted, marginTop: 2 }}>
                              {t.enabled && t.mode === 'specific' ? `${t.ids.length} selected` : `${g.people.length}`}
                            </div>
                            {t.enabled && (
                              <div style={{ width: 18, height: 18, borderRadius: '50%', background: col.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '5px auto 0' }}>
                                <CheckCircle2 size={11} color="#fff" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* ── Per-group expansion ── */}
                    {GROUPS.filter(g => broadcastTargets[g.key].enabled).map(g => {
                      const t      = broadcastTargets[g.key];
                      const search = broadcastSearch[g.key];
                      const filtered = g.people.filter(p =>
                        `${p.firstName || ''} ${p.lastName || ''} ${p.email || ''}`.toLowerCase().includes(search.toLowerCase())
                      );
                      return (
                        <div key={g.key} style={{ background: isDarkMode ? 'rgba(249,115,22,0.06)' : '#fffbf5', border: `2px solid ${isDarkMode ? 'rgba(249,115,22,0.2)' : '#fed7aa'}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                          {/* Group header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <span style={{ fontSize: 14 }}>{g.emoji}</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: col.accent }}>{g.label}</span>
                          </div>

                          {/* All / Specific toggle */}
                          <div style={{ display: 'flex', gap: 6, marginBottom: t.mode === 'specific' ? 10 : 0 }}>
                            {[
                              { mode: 'all',      label: `All ${g.label}` },
                              { mode: 'specific', label: 'Choose specific' },
                            ].map(opt => (
                              <button key={opt.mode} onClick={() => setGroupMode(g.key, opt.mode)} style={{
                                flex: 1, padding: '7px 10px', borderRadius: 10, cursor: 'pointer', fontFamily: F, fontSize: 12, fontWeight: 700,
                                border: t.mode === opt.mode ? `2px solid ${col.accent}` : `2px solid ${col.border}`,
                                background: t.mode === opt.mode ? (isDarkMode ? 'rgba(249,115,22,0.18)' : '#fff7ed') : 'transparent',
                                color: t.mode === opt.mode ? col.accent : col.muted,
                                transition: 'all 0.12s',
                              }}>{opt.label}</button>
                            ))}
                          </div>

                          {/* Specific picker */}
                          {t.mode === 'specific' && (
                            <>
                              {/* Search + select all row */}
                              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                <input
                                  value={search}
                                  onChange={e => setBroadcastSearch(prev => ({ ...prev, [g.key]: e.target.value }))}
                                  placeholder={`Search ${g.label.toLowerCase()}…`}
                                  style={{ ...inp, flex: 1, padding: '7px 11px', fontSize: 12 }}
                                />
                                <button
                                  onClick={() => selectAllInGroup(g.key, filtered)}
                                  style={{ padding: '7px 11px', borderRadius: 10, border: `2px solid ${col.border}`, background: 'transparent', color: col.accent, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: F, whiteSpace: 'nowrap' }}
                                >Select all</button>
                              </div>

                              {/* Scrollable list */}
                              <div style={{ maxHeight: 170, overflowY: 'auto', borderRadius: 10, border: `2px solid ${col.border}`, background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fff' }}>
                                {filtered.length === 0 ? (
                                  <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: col.muted }}>No results</div>
                                ) : filtered.map(p => {
                                  const id      = p._id || p.id;
                                  const checked = t.ids.includes(id);
                                  return (
                                    <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${col.border}`, background: checked ? (isDarkMode ? 'rgba(249,115,22,0.08)' : '#fff7ed') : 'transparent' }}>
                                      <input type="checkbox" checked={checked} onChange={() => togglePersonId(g.key, id)} style={{ accentColor: col.accent, width: 15, height: 15, flexShrink: 0 }} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: col.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {p.firstName} {p.lastName}
                                        </div>
                                        <div style={{ fontSize: 11, color: col.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                              {t.ids.length > 0 && (
                                <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: col.accent }}>{t.ids.length} selected</div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* ── Recipient summary ── */}
                    {anyEnabled && (
                      <div style={{ background: isDarkMode ? 'rgba(249,115,22,0.07)' : '#fff7ed', border: `2px solid ${isDarkMode ? 'rgba(249,115,22,0.2)' : '#fed7aa'}`, borderRadius: 12, padding: '8px 13px', marginBottom: 14, fontSize: 12, color: col.body }}>
                        This will email <strong style={{ color: col.accent }}>{recipientSummary}</strong>.
                      </div>
                    )}

                    {/* ── Subject ── */}
                    <label style={lbl}>Subject *</label>
                    <input value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} placeholder="e.g. Important update" style={{ ...inp, marginBottom: 12 }} disabled={broadcasting} />

                    {/* ── Message ── */}
                    <label style={lbl}>Message *</label>
                    <textarea value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} placeholder="Write your message here…" rows={5} style={{ ...inp, marginBottom: 18, resize: 'vertical', height: 120 }} disabled={broadcasting} />

                    {/* ── Actions ── */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setBroadcastModal(false)} disabled={broadcasting} style={{ flex: 1, padding: '11px', borderRadius: 14, border: `2px solid ${col.border}`, background: 'transparent', color: col.body, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: F }}>Cancel</button>
                      <button disabled={!canSend || broadcasting} onClick={handleBroadcast} style={{ flex: 2, padding: '11px', borderRadius: 14, border: 'none', background: canSend && !broadcasting ? ACCENT_GRADIENT : (isDarkMode ? '#2a2d40' : '#f5f0ec'), color: canSend && !broadcasting ? '#fff' : col.muted, fontWeight: 800, fontSize: 13, cursor: canSend && !broadcasting ? 'pointer' : 'not-allowed', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: canSend && !broadcasting ? `0 4px 14px ${TAB_SHADOW}` : 'none', transition: 'all 0.15s' }}>
                        <Send size={14} />
                        {broadcasting ? 'Sending…' : `Send to ${enabledLabel}`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Overlays */}
      <SettingsSidebar
        isOpen={showSettingsSidebar}
        onClose={() => setShowSettingsSidebar(false)}
        onChangePassword={() => { setShowSettingsSidebar(false); setShowChangePassword(true); }}
        onChangeEmail={() => { setShowSettingsSidebar(false); setShowChangeEmail(true); }}
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
      {showChangePassword && (
        <ChangePassword
          onClose={() => setShowChangePassword(false)}
          onSuccess={(msg) => { setShowChangePassword(false); setToast(msg); setTimeout(() => setToast(''), 3000); }}
        />
      )}
      {showChangeEmail && (
        <ChangeEmail
          onClose={() => setShowChangeEmail(false)}
          onSuccess={(msg) => { setShowChangeEmail(false); setToast(msg); setTimeout(() => setToast(''), 4000); }}
        />
      )}
    </div>
  );
}
