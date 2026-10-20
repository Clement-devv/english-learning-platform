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
  ShieldCheck, ClipboardCheck, Link2, Library, PhoneMissed,
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
import { useOnDataChanged } from "../../../../hooks/useLiveData";
import { useTabSeen } from "../../../../hooks/useTabSeen";
import { getTeachers }            from '../../../../services/teacherService';
import { getStudents }            from '../../../../services/studentService';
import LanguageSwitcher           from '../../../../components/LanguageSwitcher';
import { useTranslation }         from 'react-i18next';
import ChangePassword             from '../../../../components/admin/auth/ChangePassword';
import ChangeEmail               from '../../../../components/admin/auth/ChangeEmail';
import AnalyticsPinSettings      from '../../../../components/admin/auth/AnalyticsPinSettings';
import { dateLocale } from "../../../../i18n/dateLocale.js";
import { adminAccent, adminOnAccent } from "../../../../utils/adminAccent";
import { SunriseBackdrop, SunsetGlow } from "../../../../components/dashboard/SunriseArt";
import FlipBoard from "../../../../components/dashboard/FlipBoard";

// Tab components — lazy loaded
const OverviewTab        = lazy(() => import('../../tabs/OverviewTab'));
const TeachersTab        = lazy(() => import('../../tabs/TeachersTab'));
const StudentsTab        = lazy(() => import('../../tabs/StudentsTab'));
const ClassesTab         = lazy(() => import('../../tabs/ClassesTab'));
const ApplicationsTab    = lazy(() => import('../../tabs/ApplicationsTab'));
const NotificationsTab   = lazy(() => import('../../tabs/NotificationsTab'));
const AssignStudentsTab  = lazy(() => import('../../tabs/AssignStudentsTab'));
const BookingsTab        = lazy(() => import('../../tabs/BookingsTab'));
const ParentChecksTab    = lazy(() => import('../../tabs/ParentChecksTab'));
const ShareLinksTab      = lazy(() => import('../../tabs/ShareLinksTab'));
const TeachingLibrary    = lazy(() => import('../../../../components/library/TeachingLibrary'));
const LoggedClassesTab   = lazy(() => import('../../tabs/LoggedClassesTab'));
const ClassSummariesTab  = lazy(() => import('../../tabs/ClassSummariesTab'));
const ClassReportTab     = lazy(() => import('../../tabs/ClassReportTab'));
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
// Values live in src/index.css (.as-root) — warm neutrals + one accent taken from
// the center's brand colour — so light/dark and brand changes need no JS here.
// Whole-page look: true = liquid glass (frosted panes over colour glows, gradient
// border — same as the teacher / student shells); false = the original solid layout.
const GLASS_PAGE = true;

const palette = () => ({
  bg:      'var(--a-bg)',
  card:    GLASS_PAGE ? 'var(--as-glass-card)' : 'var(--a-surface)',
  cardAlt: 'var(--a-raised)',
  border:  'var(--a-line)',
  heading: 'var(--a-ink)',
  body:    'var(--a-ink-2)',
  muted:   'var(--a-muted)',
  accent:  'var(--a-accent)',
  sidebar: GLASS_PAGE ? 'var(--as-glass-card)' : 'var(--a-surface)',
});

// ── Nav groups ────────────────────────────────────────────────────────────────
const makeNavGroups = (t) => [
  {
    label: null, cat: 'accent',
    items: [
      { key: 'overview',  label: t('admin.nav.overview'),  lucide: TrendingUp },
    ],
  },
  {
    label: t('admin.navGroup.analytics'), cat: 'rose',
    items: [
      { key: 'analytics',     label: t('admin.nav.analytics'),     lucide: BarChart3       },
      { key: 'notifications', label: t('admin.nav.notifications'), lucide: Bell            },
      { key: 'messages',      label: t('admin.nav.messages'),      lucide: MessageCircle   },
      { key: 'sub-admins',    label: t('admin.nav.subAdmins'),     lucide: Shield          },
    ],
  },
  {
    label: t('admin.navGroup.people'), cat: 'teal',
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
    label: t('admin.navGroup.classes'), cat: 'amber',
    items: [
      { key: 'classes',       label: t('admin.nav.allClasses'),      lucide: BookOpen     },
      { key: 'class-report',  label: t('admin.nav.classReport'),     lucide: ClipboardCheck },
      { key: 'class-summaries', label: t('admin.nav.classSummaries', 'Class Summaries'), lucide: FileText },
      { key: 'group-classes', label: t('admin.nav.groupClasses'),    lucide: Users        },
      { key: 'bookings',      label: t('admin.nav.bookings'),        lucide: ClipboardList},
      { key: 'parent-checks', label: t('admin.nav.parentChecks'),    lucide: ShieldCheck  },
      { key: 'share-links',   label: t('admin.nav.shareLinks'),      lucide: Link2        },
      { key: 'library',       label: t('admin.nav.library'),         lucide: Library      },
      { key: 'logged-classes', label: t('admin.nav.loggedClasses'), lucide: ClipboardCheck },
      { key: 'recordings',    label: t('admin.nav.recordings'),      lucide: Video        },
      { key: 'certificates',  label: t('admin.nav.certificates'),    lucide: Award        },
      { key: 'reports',       label: t('admin.nav.progressReports'), lucide: FileText     },
      { key: 'reviews',       label: t('admin.nav.reviews'),         lucide: Star         },
      { key: 'referrals',     label: t('admin.nav.referrals'),       lucide: Users        },
    ],
  },
  {
    label: t('admin.navGroup.finance'), cat: 'green',
    items: [
      { key: 'payments',              label: t('admin.nav.payments'),             lucide: DollarSign    },
      { key: 'class-pricing',         label: t('admin.nav.classPricing'),         lucide: DollarSign    },
      { key: 'chat-credits',          label: t('admin.nav.chatCredits'),          lucide: MessageCircle },
      { key: 'pronunciation-credits', label: t('admin.nav.pronunciationCredits'), lucide: Mic           },
      { key: 'disputes',              label: t('admin.nav.disputes'),             lucide: AlertTriangle },
    ],
  },
  {
    label: t('admin.navGroup.settings'), cat: 'stone',
    items: [
      { key: 'branding',      label: t('admin.nav.branding'),      lucide: Palette },
      { key: 'domain',        label: t('admin.nav.customDomain'),  lucide: Globe   },
      { key: 'cert-template', label: t('admin.nav.certTemplate'),  lucide: Award   },
    ],
  },
];
const F = "'Nunito','Inter',sans-serif";
// Font: Nunito is loaded once from index.html (early, parallel to the bundle).
const ACCENT = 'var(--a-accent)';
// Large accent fills use the orange→pink sunset gradient (background shorthand)
const ACCENT_FILL = 'var(--a-accent-grad)';
const ON_ACCENT = 'var(--a-on-accent)';
const ACCENT_SHADOW = '0 4px 14px -4px color-mix(in srgb, var(--a-accent) 55%, transparent)';

function TabLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', fontFamily: F }}>
      <style>{`@keyframes as-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--a-line)', borderTopColor: 'var(--a-accent)', animation: 'as-spin .7s linear infinite' }} />
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
export default function SunshineShell() {
  const { t: tr } = useTranslation("admin");
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user: adminInfo, logout: authLogout } = useAuth();
  const { branding, center } = useBranding();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const col = palette();
  const accent = adminAccent(branding);
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
  const [notifLoaded,     setNotifLoaded]     = useState(false);
  // Items waiting for the admin (welcome banner): logged classes, parent checks, disputes
  const [attention,       setAttention]       = useState({ loggedClasses: 0, parentChecks: 0, disputes: 0 });
  const [showSettingsSidebar,  setShowSettingsSidebar]  = useState(false);
  const [showSettingsModal,    setShowSettingsModal]    = useState(false);
  const [showSessionMgmt,      setShowSessionMgmt]      = useState(false);
  const [showChangePassword,   setShowChangePassword]   = useState(false);
  const [showChangeEmail,      setShowChangeEmail]      = useState(false);
  const [showAnalyticsPin,     setShowAnalyticsPin]     = useState(false);
  // Bumped when the PIN changes so Overview/Analytics re-check their lock state
  const [analyticsPinVersion,  setAnalyticsPinVersion]  = useState(0);  const [toast,           setToast]           = useState('');

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

  const refreshAttention = useCallback(async () => {
    if (!sessionStorage.getItem('adminToken')) return;
    try {
      const res = await api.get('/admin/attention');
      if (res.data.success) setAttention(res.data.data);
    } catch { /* keep the last counts */ }
  }, []);

  const refreshNotif = useCallback(async () => {
    // Skip if the token is missing entirely — avoids a guaranteed 401 when
    // sessionStorage was cleared (tab restore after browser restart, etc.)
    if (!sessionStorage.getItem('adminToken')) return;
    try {
      const res = await api.get('/notifications/unread-count');
      if (res.data.success) { setUnreadNotif(res.data.count); setNotifLoaded(true); }
    } catch (_) {}
  }, []);

  const refreshPeople = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([getTeachers(), getStudents()]);
      setTeachers(t);
      setStudents(s);
    } catch (_) {}
  }, []);

  // ── Live updates (no polling) ─────────────────────────────────────────────
  // Notification badge and the teacher/student directory refresh when the server
  // says they changed (the directory is served from a shared server snapshot),
  // plus a 5-minute safety refresh while the tab is visible.
  useEffect(() => {
    refreshNotif(); refreshAttention();
    const id = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      refreshNotif(); refreshPeople(); refreshAttention();
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, [refreshNotif, refreshPeople, refreshAttention]);
  useOnDataChanged(['notifications'], refreshNotif);
  // Logged classes, parent checks and disputes all live on bookings
  useOnDataChanged(['bookings'], refreshAttention);
  useOnDataChanged(['teachers', 'students'], refreshPeople);

  const handleLogout = () => { authLogout(); navigate('/admin/login', { replace: true }); };
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
      alert(err.response?.data?.message || err.message || tr("sunshineShell.broadcastFailed"));
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
      case 'overview':          return <OverviewTab key={analyticsPinVersion} isDarkMode={isDarkMode} />;
      case 'analytics':         return <AnalyticsDashboard key={analyticsPinVersion} isDarkMode={isDarkMode} />;
      case 'teachers':          return <TeachersTab isDarkMode={isDarkMode} />;
      case 'teacher-schedules': return <TeacherScheduleTab teachers={activeTeachers} isDarkMode={isDarkMode} />;
      case 'students':          return <StudentsTab isDarkMode={isDarkMode} />;
      case 'classes':           return <ClassesTab isDarkMode={isDarkMode} />;
      case 'group-classes':     return <GroupClassesTab  isDarkMode={isDarkMode} />;
      case 'certificates':      return <CertificatesTab  isDarkMode={isDarkMode} />;
      case 'parents':           return <ParentsTab        isDarkMode={isDarkMode} />;
      case 'applications':      return <ApplicationsTab isDarkMode={isDarkMode} />;
      case 'notifications':     return <NotificationsTab isDarkMode={isDarkMode} onUnreadCount={setUnreadNotif} />;
      case 'assign':            return <AssignStudentsTab teachers={activeTeachers} students={students} isDarkMode={isDarkMode} />;
      case 'bookings':          return <BookingsTab teachers={activeTeachers} students={students} isDarkMode={isDarkMode} />;
      case 'messages':          return <MessagesTab userRole="admin" onUnreadCount={setUnreadMessages} />;
      case 'payments':          return <PaymentsTab isDarkMode={isDarkMode} />;
      case 'class-pricing':     return <ClassPricingTab isDarkMode={isDarkMode} />;
      case 'chat-credits':          return <ChatCreditsTab isDarkMode={isDarkMode} />;
      case 'pronunciation-credits': return <PronunciationCreditsTab isDarkMode={isDarkMode} />;
      case 'disputes':          return <DisputeReview isDarkMode={isDarkMode} />;
      case 'parent-checks':     return <ParentChecksTab isDarkMode={isDarkMode} />;
      case 'share-links':       return <ShareLinksTab isDarkMode={isDarkMode} />;
      case 'library':           return <TeachingLibrary isDarkMode={isDarkMode} canManage />;
      case 'logged-classes':    return <LoggedClassesTab isDarkMode={isDarkMode} />;
      case 'class-summaries':   return <ClassSummariesTab teachers={teachers} isDarkMode={isDarkMode} />;
      case 'class-report':      return <ClassReportTab isDarkMode={isDarkMode} />;
      case 'recordings':        return <RecordingsTab teachers={teachers} isDarkMode={isDarkMode} />;
      case 'reports':           return <ReportsTab students={students} isDarkMode={isDarkMode} />;
      case 'reviews':           return <ReviewsTab isDarkMode={isDarkMode} />;
      case 'referrals':         return <ReferralsTab isDarkMode={isDarkMode} />;
      case 'sub-admins':        return <SubAdminsTab isDarkMode={isDarkMode} teachers={teachers} />;
      case 'branding':          return <BrandingTab isDarkMode={isDarkMode} />;
      case 'domain':            return <DomainTab isDarkMode={isDarkMode} />;
      case 'cert-template':     return <CertificateTemplateSettingsTab isDarkMode={isDarkMode} />;
      default:                  return <OverviewTab key={analyticsPinVersion} isDarkMode={isDarkMode} />;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isDarkMode, loading, teachers, students, analyticsPinVersion]);

  const STATS = [
    { label: tr("sunshineShell.teachers"),  value: teachers.length,       icon: Video, cat: 'teal' },
    { label: tr("sunshineShell.students"),  value: students.length,       icon: Users, cat: 'sky' },
    { label: tr("sunshineShell.messages"),  value: unreadMessages || 0,   icon: MessageCircle, cat: 'sky' },
    { label: tr("sunshineShell.alerts"),    value: unreadNotif || 0,      icon: Bell, cat: 'rose' },
    // Waiting for the admin — click to open the tab
    { label: tr("sunshineShell.loggedClasses", "Logged classes"), value: attention.loggedClasses, icon: ClipboardCheck, cat: 'amber', tab: 'logged-classes' },
    { label: tr("sunshineShell.parentChecks", "Parent checks"),   value: attention.parentChecks,  icon: ShieldCheck,    cat: 'teal',  tab: 'parent-checks' },
    { label: tr("sunshineShell.disputes", "Disputes"),            value: attention.disputes,      icon: AlertTriangle,  cat: 'rose',  tab: 'disputes' },
  ];

  // Notifications tab badge: only what's new since the tab was last opened (hooks/useTabSeen.js).
  // The banner's Alerts number stays the real unread count.
  const adminKey = adminInfo?._id || adminInfo?.id;
  const tabBadge = useTabSeen(adminKey ? `admin:${adminKey}` : null, activeTab,
    { notifications: unreadNotif }, { notifications: notifLoaded });

  const showHero = activeTab === 'overview';

  // Escape closes the broadcast modal (unless a send is in flight)
  useEffect(() => {
    if (!broadcastModal) return;
    const onKey = (e) => { if (e.key === 'Escape' && !broadcasting) setBroadcastModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [broadcastModal, broadcasting]);

  return (
    <div
      className={GLASS_PAGE ? 'as-root as-glass as-shine' : 'as-root'}
      data-theme={isDarkMode ? 'dark' : 'light'}
      style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: F, background: col.bg, '--a-accent': accent, '--a-on-accent': adminOnAccent(accent) }}
    >
      <style>{`
        * { box-sizing: border-box; }
        .as-nav { transition: background-color 150ms ease, color 150ms ease, transform 120ms ease-out; }
        .as-nav:active { transform: scale(0.98); }
        .as-press { transition: transform 120ms ease-out, background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease; }
        .as-press:not(:disabled):active { transform: scale(0.97); }
        .as-card { transition: transform 0.2s, box-shadow 0.2s; }
        @media (hover: hover) and (pointer: fine) {
          .as-nav:not([aria-current="page"]):hover { background: ${GLASS_PAGE ? 'color-mix(in srgb, var(--a-surface) 50%, transparent)' : 'var(--a-raised)'} !important; }
          .as-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.10) !important; }
          .as-accent-btn:not(:disabled):hover { background: var(--a-accent-hover) !important; }
        }
        .as-root button:focus-visible, .as-root [role="button"]:focus-visible, .as-root input:focus-visible, .as-root textarea:focus-visible {
          outline: 2px solid var(--a-accent); outline-offset: 2px;
        }
        .as-root ::selection { background: var(--a-accent-soft); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--a-line-strong); border-radius: 10px; }
        .as-navscroll { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--a-pink) 45%, transparent) transparent; }
        .as-navscroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--a-pink) 45%, transparent); border-radius: 999px; }
      `}</style>

      {/* Colour glows across the page — what the glass panes blur */}
      {GLASS_PAGE && (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden', opacity: isDarkMode ? 0.5 : 1 }}>
          {[
            { l: '-6%',  t: '-12%', s: 420, c: 'color-mix(in srgb, var(--a-pink) 55%, transparent)' },
            { l: '8%',   t: '45%',  s: 380, c: 'rgba(56,189,248,0.40)' },
            { l: '38%',  t: '-18%', s: 520, c: 'color-mix(in srgb, var(--a-accent) 42%, transparent)' },
            { l: '72%',  t: '8%',   s: 440, c: 'rgba(251,191,36,0.45)' },
            { l: '55%',  t: '60%',  s: 480, c: 'rgba(45,212,191,0.32)' },
            { l: '-4%',  t: '78%',  s: 360, c: 'rgba(251,191,36,0.40)' },
            { l: '85%',  t: '70%',  s: 380, c: 'color-mix(in srgb, var(--a-pink) 45%, transparent)' },
          ].map((g, i) => (
            <div key={i} style={{ position: 'absolute', left: g.l, top: g.t, width: g.s, height: g.s, borderRadius: '50%', background: `radial-gradient(circle, ${g.c} 0%, transparent 68%)` }} />
          ))}
        </div>
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside className={GLASS_PAGE ? 'as-glass-ring' : undefined} style={{
        width: 224, flexShrink: 0,
        background: col.sidebar,
        ...(GLASS_PAGE
          ? { margin: '12px 0 12px 12px', borderRadius: 26, position: 'relative', border: 'none', overflow: 'hidden' }
          : { borderRight: `1px solid ${col.border}`, overflowY: 'auto', overflowX: 'hidden' }),
        display: 'flex', flexDirection: 'column',
        zIndex: 100,
      }}>
        {/* Brand — center logo if it has one, otherwise its initial on the accent */}
        <div style={{ position: 'relative', overflow: 'hidden', flexShrink: 0, padding: '18px 16px 16px', borderBottom: `1px solid ${col.border}` }}>
          {/* same sunrise, small: glow behind the logo + one gradient ring */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: [
            'radial-gradient(60% 120% at 12% 40%, rgba(249,115,22,0.22) 0%, transparent 70%)',
            'radial-gradient(70% 140% at 100% 0%, color-mix(in srgb, var(--a-accent) 20%, transparent) 0%, transparent 70%)',
          ].join(', ') }} />
          <svg aria-hidden="true" width="120" height="120" viewBox="0 0 120 120" style={{ position: 'absolute', right: -44, top: -52, pointerEvents: 'none' }}>
            {[30, 50].map((r, i) => (
              <circle key={r} cx="60" cy="60" r={r} fill="none" stroke="url(#as-bg-ring)" strokeOpacity={0.45 - i * 0.15} strokeWidth="1.5" />
            ))}
          </svg>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
            {branding?.logo ? (
              <img src={branding.logo} alt="" style={{ width: 38, height: 38, borderRadius: 11, objectFit: 'cover', flexShrink: 0, boxShadow: `0 0 0 1px ${col.border}` }} />
            ) : (
              <div style={{ width: 38, height: 38, borderRadius: 11, background: ACCENT_FILL, color: ON_ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, flexShrink: 0, boxShadow: ACCENT_SHADOW }}>
                {(centerName?.[0] || 'A').toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: col.heading, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{centerName}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: col.muted }}>{t('admin.sidebar.portal')}</div>
              {branding?.partnershipText && (
                <div style={{ fontSize: 10, color: col.muted, marginTop: 2, fontStyle: 'italic' }}>{branding.partnershipText}</div>
              )}
            </div>
          </div>
        </div>

        {/* Admin info card */}
        <div style={{ flexShrink: 0, margin: '10px 10px 6px', background: GLASS_PAGE ? 'color-mix(in srgb, var(--a-surface) 45%, transparent)' : 'var(--a-raised)', boxShadow: GLASS_PAGE ? 'inset 0 0 0 1px var(--as-glass-edge)' : 'none', borderRadius: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--a-accent-soft)', color: 'var(--a-accent-ink)', boxShadow: 'inset 0 0 0 1px var(--a-accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
            {(adminInfo?.firstName?.[0] || 'A').toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: col.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {adminInfo?.firstName || tr("sunshineShell.admin")}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: col.muted }}>{tr("sunshineShell.teachers2", { teachersCount: teachers.length })}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="as-navscroll" style={{ flex: 1, minHeight: 0, overflowY: GLASS_PAGE ? 'auto' : 'visible', overflowX: 'hidden', padding: '4px 8px' }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={`cat-${group.cat}`} style={{ marginBottom: 6 }}>
              {group.label && (
                <div style={{ fontSize: 10, fontWeight: 800, color: col.muted, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 10px 4px' }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => {
                const isActive = activeTab === item.key;
                const msgBadge = (unreadMessages || 0) + missedCallCount;
                const badge = item.key === 'messages' ? (msgBadge || null)
                            : item.key === 'notifications' ? tabBadge('notifications')
                            : null;
                return (
                  <button key={item.key} className="as-nav"
                    onClick={() => setActiveTab(item.key)}
                    aria-current={isActive ? 'page' : undefined}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: isActive ? (GLASS_PAGE ? `color-mix(in srgb, var(--cat) ${isDarkMode ? 22 : 16}%, rgba(255,255,255,${isDarkMode ? 0.06 : 0.45}))` : 'var(--cat-soft)') : 'transparent',
                      boxShadow: isActive && GLASS_PAGE ? 'inset 0 0 0 1px var(--as-glass-edge)' : 'none',
                      fontFamily: F, textAlign: 'left',
                      marginBottom: 1,
                    }}>
                    {(() => { const LI = item.lucide; return <LI size={17} strokeWidth={isActive ? 2.1 : 1.8} color='var(--cat)' style={{ flexShrink: 0 }} />; })()}
                    <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? 'var(--cat-ink)' : col.body }}>
                      {item.label}
                    </span>
                    {badge != null && (
                      <span style={{ background: ACCENT_FILL, color: ON_ACCENT, borderRadius: 999, fontSize: 10, fontWeight: 800, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
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
        <div style={{ flexShrink: 0, padding: GLASS_PAGE ? '2px 8px 4px' : '8px 8px 16px', borderTop: `1px solid ${col.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: GLASS_PAGE ? '6px 10px' : '8px 10px', marginBottom: GLASS_PAGE ? 0 : 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: col.muted }}>{isDarkMode ? t('admin.sidebar.darkMode') : t('admin.sidebar.lightMode')}</span>
            <button onClick={toggleDarkMode} role="switch" aria-checked={isDarkMode} aria-label={t('admin.sidebar.darkMode')}
              style={{ width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: isDarkMode ? ACCENT : 'var(--a-line-strong)', position: 'relative', transition: 'background-color 200ms ease', flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: 3, transform: `translateX(${isDarkMode ? 18 : 0}px)`, transition: 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1)', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
          <button className="as-nav" onClick={openBroadcast}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F, marginBottom: 1 }}>
            <Megaphone size={17} color="var(--a-accent)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--a-accent-ink)' }}>{t('admin.sidebar.broadcastEmail')}</span>
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
      <div className={GLASS_PAGE ? 'as-glass-ring' : undefined} style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
        ...(GLASS_PAGE ? {
          margin: 12, borderRadius: 26,
          background: 'var(--as-glass-frame)',
          boxShadow: 'inset 0 1px 0 var(--as-glass-edge), 0 24px 48px -24px var(--as-glass-glow)',
        } : null),
      }}>
        <SunsetGlow />

        {/* Top bar */}
        <header style={{ height: 60, background: col.sidebar, borderBottom: `1px solid ${col.border}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: col.heading, flex: 1, fontFamily: F, letterSpacing: '-0.01em' }}>
            {PAGE_LABEL[activeTab] || tr("sunshineShell.overview")}
          </h1>

          {/* ── Notification chips ── */}
          {unreadMessages > 0 && (
            <button className="as-press" onClick={() => { setActiveTab('messages'); setUnreadMessages(0); }} title={tr("sunshineShell.goToMessages")}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--a-surface)', border: `1px solid ${col.border}`, borderRadius: 999, padding: '5px 12px 5px 10px', cursor: 'pointer', fontFamily: F }}>
              <MessageCircle size={14} color="var(--a-accent)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: col.heading }}>{tr("sunshineShell.new", { unreadMessages })}</span>
            </button>
          )}
          {missedCallCount > 0 && (
            <button className="as-press" onClick={clearMissedCalls} title={tr("sunshineShell.clearMissedCalls")}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: isDarkMode ? 'rgba(239,68,68,0.12)' : '#fef2f2', border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca'}`, borderRadius: 999, padding: '5px 12px 5px 10px', cursor: 'pointer', fontFamily: F }}>
              <PhoneMissed size={14} color={isDarkMode ? '#fca5a5' : '#dc2626'} />
              <span style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#fca5a5' : '#b91c1c' }}>{tr("sunshineShell.missed", { missedCallCount })}</span>
            </button>
          )}

          {/* Notification bell */}
          <button className="as-nav" onClick={() => setActiveTab('notifications')} aria-label={t('admin.nav.notifications')}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: col.muted, padding: 7, borderRadius: 10, display: 'flex', alignItems: 'center' }}>
            <Bell size={19} color={col.body} strokeWidth={1.8} />
            {tabBadge('notifications') && (
              <span style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 0 2px ${col.sidebar}` }} />
            )}
          </button>

          {/* Avatar */}
          <button className="as-press" onClick={() => setShowSettingsSidebar(true)} aria-label={t('admin.sidebar.settings')}
            style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: ACCENT_FILL, boxShadow: ACCENT_SHADOW, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ON_ACCENT, fontWeight: 800, fontSize: 14, fontFamily: F, cursor: 'pointer', flexShrink: 0 }}>
            {(adminInfo?.firstName?.[0] || 'A').toUpperCase()}
          </button>
        </header>

        {/* Scroll area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24, position: 'relative' }}>
          <SunriseBackdrop />
          <div style={{ position: 'relative' }}>

          {/* Toast */}
          {toast && (
            <div className="ui-toast-in" role="status" style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, padding: '11px 16px 11px 14px', borderRadius: 14, fontWeight: 700, fontSize: 13, background: 'var(--a-surface)', color: col.heading, border: `1px solid ${col.border}`, fontFamily: F, boxShadow: 'var(--a-shadow-pop)', display: 'flex', alignItems: 'center', gap: 9 }}>
              <CheckCircle size={17} color="#16a34a" />
              {toast}
            </div>
          )}

          {/* Hero — only on overview. Bright orange sunrise glow between the greeting and the
              stats, pink on the right, amber underneath; rings drawn in an orange→pink line. */}
          {showHero && (
            <FlipBoard role="admin" radius={20} style={{ marginBottom: 24 }}>
            <section style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', padding: '26px 28px', background: col.card, border: `1px solid ${col.border}`, boxShadow: 'var(--a-shadow)' }}>
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: [
                // golden-hot core inside the orange so it reads as light, not paint
                'radial-gradient(14% 70% at 50% -5%, rgba(255,214,102,0.85) 0%, rgba(253,186,116,0.4) 55%, transparent 100%)',
                'radial-gradient(36% 160% at 50% -20%, rgba(249,115,22,0.88) 0%, rgba(251,146,60,0.48) 40%, rgba(253,186,116,0.15) 62%, transparent 76%)',
                'radial-gradient(44% 160% at 100% 0%, color-mix(in srgb, var(--a-accent) 52%, transparent) 0%, color-mix(in srgb, var(--a-pink) 26%, transparent) 45%, transparent 76%)',
                'radial-gradient(32% 130% at 68% 130%, rgba(251,191,36,0.45) 0%, transparent 70%)',
                'radial-gradient(28% 120% at 0% 120%, color-mix(in srgb, var(--a-pink) 30%, transparent) 0%, transparent 70%)',
              ].join(', ') }} />
              {/* one-time light sweep when the overview opens */}
              <div aria-hidden="true" className="as-hero-shine" />
              {/* decorative rings — orange→pink gradient line, clearly visible */}
              <svg aria-hidden="true" width="320" height="320" viewBox="0 0 320 320" style={{ position: 'absolute', right: -90, top: -120, pointerEvents: 'none', filter: 'drop-shadow(0 0 6px rgba(249,115,22,0.45))' }}>
                <defs>
                  <linearGradient id="as-hero-ring" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="var(--a-accent)" />
                  </linearGradient>
                </defs>
                {[50, 90, 130].map((r, i) => (
                  <circle key={r} cx="160" cy="160" r={r} fill="none" stroke="url(#as-hero-ring)" strokeOpacity={0.8 - i * 0.16} strokeWidth={i === 0 ? 3 : 2} />
                ))}
              </svg>
              <svg aria-hidden="true" width="140" height="140" viewBox="0 0 140 140" style={{ position: 'absolute', left: '44%', bottom: -70, pointerEvents: 'none', filter: 'drop-shadow(0 0 5px rgba(249,115,22,0.5))' }}>
                {[30, 55].map((r, i) => (
                  <circle key={r} cx="70" cy="70" r={r} fill="none" stroke="#f97316" strokeOpacity={0.65 - i * 0.18} strokeWidth="2" />
                ))}
              </svg>
              {/* a few small floating accents */}
              {[
                { left: '38%', top: 18, size: 9, color: '#f97316', delay: '0s' },
                { left: '56%', top: 46, size: 6, color: 'var(--a-accent)', delay: '1.1s' },
                { left: '48%', bottom: 22, size: 7, color: '#fbbf24', delay: '2.2s' },
                { left: '63%', top: 14, size: 5, color: '#fb923c', delay: '0.6s' },
              ].map((d, i) => (
                <span key={i} aria-hidden="true" className="as-sparkle" style={{ position: 'absolute', left: d.left, top: d.top, bottom: d.bottom, width: d.size, height: d.size, borderRadius: '50%', background: d.color, boxShadow: `0 0 10px 2px ${d.color}`, animationDelay: d.delay }} />
              ))}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: '0 0 6px', background: ACCENT_FILL, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', display: 'inline-block', fontWeight: 800, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {new Date().toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <h2 style={{ margin: '0 0 4px', color: col.heading, fontWeight: 900, fontSize: 24, fontFamily: F, letterSpacing: '-0.015em' }}>
                    {tr("sunshineShell.welcomeBack")} {adminInfo?.firstName || tr("sunshineShell.admin")}
                  </h2>
                  <p style={{ margin: 0, color: col.body, fontSize: 13, fontWeight: 600 }}>{centerName}</p>
                </div>
                <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', background: 'color-mix(in srgb, var(--a-surface) 82%, transparent)', backdropFilter: 'blur(6px)', border: `1px solid ${col.border}`, borderRadius: 14, boxShadow: 'var(--a-shadow)', overflow: 'hidden' }}>
                  {STATS.map(({ label, value, icon: Icon, cat, tab }, i) => {
                    const Tag = tab ? 'button' : 'div';
                    return (
                    <Tag key={label} className={`cat-${cat}${tab ? ' as-press' : ''}`}
                      {...(tab ? { type: 'button', onClick: () => setActiveTab(tab), title: label, 'aria-label': `${label}: ${value}` } : {})}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderLeft: i ? `1px solid ${col.border}` : 'none', ...(tab ? { background: 'none', border: 'none', borderLeft: `1px solid ${col.border}`, cursor: 'pointer', textAlign: 'left', font: 'inherit' } : {}) }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--cat-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={16} color="var(--cat)" strokeWidth={2} />
                      </div>
                      <div>
                        <div style={{ fontSize: 19, fontWeight: 800, color: col.heading, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: col.muted }}>{label}</div>
                      </div>
                    </Tag>
                    );
                  })}
                </div>
              </div>
            </section>
            </FlipBoard>
          )}

          {/* Missed calls alert — visible on overview */}
          {showHero && missedCallCount > 0 && (
            <div style={{ background: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca'}`, borderRadius: 16, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 24 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PhoneMissed size={18} color='#fff' />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: isDarkMode ? '#fca5a5' : '#dc2626', fontFamily: F }}>
                    {tr("sunshineShell.missedCall", { missedCallCount, value: missedCallCount > 1 ? 's' : '' })}
                  </h3>
                  <span style={{ fontSize: 11, color: col.muted, fontWeight: 600 }}>{tr("sunshineShell.whileYouWereAway")}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {missedCalls.map((mc, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: isDarkMode ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.2)' : '#fecaca'}`, borderRadius: 12, padding: '7px 12px' }}>
                      <div style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--a-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: col.heading, flexShrink: 0 }}>
                        {(mc.callerName?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: col.heading, lineHeight: 1.2 }}>{mc.callerName}</p>
                        <p style={{ margin: 0, fontSize: 10, color: col.muted, fontWeight: 600 }}>
                          {mc.callerRole === 'teacher' ? tr("sunshineShell.teacher") : mc.callerRole === 'student' ? tr("sunshineShell.student") : mc.callerRole} · {new Date(mc.at).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={clearMissedCalls} style={{ background: isDarkMode ? 'rgba(255,255,255,0.08)' : '#fff', border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.12)' : '#fecaca'}`, borderRadius: 10, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: col.muted, flexShrink: 0, fontFamily: F }}>
                {tr("sunshineShell.markSeen")}
              </button>
            </div>
          )}

          {/* Tab content */}
          <Suspense fallback={<TabLoader />}>
            <TabErrorBoundary key={activeTab}>
              {tabContent}
            </TabErrorBoundary>
          </Suspense>
          </div>
        </main>
      </div>

      {/* ── Broadcast Modal ── */}
      {broadcastModal && (() => {
        const GROUPS = [
          { key: 'teachers', emoji: '👩‍🏫', label: tr("sunshineShell.teachers"), people: teachers.filter(t => t.active) },
          { key: 'students', emoji: '👨‍🎓', label: tr("sunshineShell.students"), people: students.filter(s => s.active) },
          { key: 'parents',  emoji: '👪',   label: tr("sunshineShell.parents"),  people: broadcastParents },
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
        const box = { background: 'var(--a-surface)', border: `1px solid ${col.border}`, borderRadius: 20, width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--a-shadow-pop)', fontFamily: F };
        const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 13px', background: 'var(--a-raised)', border: `1px solid ${col.border}`, borderRadius: 10, color: col.heading, fontSize: 13, fontFamily: F, outline: 'none' };
        const lbl = { display: 'block', fontSize: 11, fontWeight: 800, color: col.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' };

        return (
          <div className="ui-fade-in" style={ov} onClick={e => e.target === e.currentTarget && !broadcasting && setBroadcastModal(false)}>
            <div className="ui-pop-in" role="dialog" aria-modal="true" aria-label={tr("sunshineShell.broadcastEmail")} style={box}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${col.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--a-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Megaphone size={18} color="var(--a-accent)" />
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 900, color: col.heading }}>{tr("sunshineShell.broadcastEmail")}</span>
                </div>
                {!broadcasting && <button onClick={() => setBroadcastModal(false)} style={{ background: 'none', border: 'none', color: col.muted, cursor: 'pointer', padding: 4, display: 'flex' }}><X size={20} /></button>}
              </div>

              <div style={{ padding: 22 }}>
                {broadcastResult ? (
                  /* ── Success ── */
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <CheckCircle size={44} color="#10b981" style={{ margin: '0 auto 14px' }} />
                    <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: col.heading }}>{tr("sunshineShell.sent")}</p>
                    <p style={{ margin: '0 0 4px', fontSize: 13, color: col.body }}>
                      <strong style={{ color: '#10b981' }}>{broadcastResult.sent}</strong> {tr("sunshineShell.email")}{broadcastResult.sent !== 1 ? 's' : ''} {tr("sunshineShell.delivered")}
                      {broadcastResult.failed > 0 && <>, <strong style={{ color: '#ef4444' }}>{broadcastResult.failed}</strong> failed</>}
                    </p>
                    <p style={{ margin: '0 0 24px', fontSize: 12, color: col.muted }}>{tr("sunshineShell.total", { total: broadcastResult.total })}</p>
                    <button onClick={() => setBroadcastModal(false)} style={{ padding: '10px 32px', borderRadius: 14, border: 'none', background: ACCENT_FILL, color: ON_ACCENT, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: F }}>{tr("sunshineShell.done")}</button>
                  </div>
                ) : (
                  <>
                    {/* ── Group toggle cards ── */}
                    <p style={{ ...lbl, marginBottom: 8 }}>{tr("sunshineShell.whoShouldReceiveThis")}</p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      {GROUPS.map(g => {
                        const t = broadcastTargets[g.key];
                        return (
                          <button key={g.key} onClick={() => !broadcasting && toggleGroup(g.key)} style={{
                            flex: 1, padding: '10px 6px', borderRadius: 14, cursor: 'pointer', textAlign: 'center', fontFamily: F,
                            border: t.enabled ? `1px solid ${col.accent}` : `1px solid ${col.border}`,
                            background: t.enabled ? 'var(--a-accent-soft)' : 'transparent',
                            transition: 'border-color 150ms ease, background-color 150ms ease, transform 120ms ease-out',
                          }} className="as-press">
                            <div style={{ fontSize: 22, marginBottom: 3 }}>{g.emoji}</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: t.enabled ? col.accent : col.body }}>{g.label}</div>
                            <div style={{ fontSize: 10, color: col.muted, marginTop: 2 }}>
                              {t.enabled && t.mode === 'specific' ? tr("sunshineShell.selected", { idsCount: t.ids.length }) : `${g.people.length}`}
                            </div>
                            {t.enabled && (
                              <div style={{ width: 18, height: 18, borderRadius: '50%', background: col.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '5px auto 0' }}>
                                <CheckCircle2 size={11} color="var(--a-on-accent)" />
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
                        <div key={g.key} style={{ background: 'var(--a-raised)', border: `1px solid ${col.border}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                          {/* Group header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <span style={{ fontSize: 14 }}>{g.emoji}</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: col.accent }}>{g.label}</span>
                          </div>

                          {/* All / Specific toggle */}
                          <div style={{ display: 'flex', gap: 6, marginBottom: t.mode === 'specific' ? 10 : 0 }}>
                            {[
                              { mode: 'all',      label: tr("sunshineShell.all", { label: g.label }) },
                              { mode: 'specific', label: tr("sunshineShell.chooseSpecific") },
                            ].map(opt => (
                              <button key={opt.mode} onClick={() => setGroupMode(g.key, opt.mode)} style={{
                                flex: 1, padding: '7px 10px', borderRadius: 10, cursor: 'pointer', fontFamily: F, fontSize: 12, fontWeight: 700,
                                border: t.mode === opt.mode ? `1px solid ${col.accent}` : `1px solid ${col.border}`,
                                background: t.mode === opt.mode ? 'var(--a-accent-soft)' : 'transparent',
                                color: t.mode === opt.mode ? col.accent : col.muted,
                                transition: 'border-color 150ms ease, background-color 150ms ease, color 150ms ease',
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
                                  placeholder={tr("sunshineShell.search", { value: g.label.toLowerCase() })}
                                  style={{ ...inp, flex: 1, padding: '7px 11px', fontSize: 12 }}
                                />
                                <button
                                  onClick={() => selectAllInGroup(g.key, filtered)}
                                  style={{ padding: '7px 11px', borderRadius: 10, border: `1px solid ${col.border}`, background: 'transparent', color: col.accent, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: F, whiteSpace: 'nowrap' }}
                                >{tr("sunshineShell.selectAll")}</button>
                              </div>

                              {/* Scrollable list */}
                              <div style={{ maxHeight: 170, overflowY: 'auto', borderRadius: 10, border: `1px solid ${col.border}`, background: 'var(--a-surface)' }}>
                                {filtered.length === 0 ? (
                                  <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: col.muted }}>{tr("sunshineShell.noResults")}</div>
                                ) : filtered.map(p => {
                                  const id      = p._id || p.id;
                                  const checked = t.ids.includes(id);
                                  return (
                                    <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${col.border}`, background: checked ? 'var(--a-accent-soft)' : 'transparent' }}>
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
                                <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: col.accent }}>{tr("sunshineShell.selected", { idsCount: t.ids.length })}</div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* ── Recipient summary ── */}
                    {anyEnabled && (
                      <div style={{ background: 'var(--a-accent-soft)', border: `1px solid var(--a-accent-line)`, borderRadius: 12, padding: '8px 13px', marginBottom: 14, fontSize: 12, color: col.body }}>
                        {tr("sunshineShell.thisWillEmail")} <strong style={{ color: col.accent }}>{recipientSummary}</strong>.
                      </div>
                    )}

                    {/* ── Subject ── */}
                    <label style={lbl}>{tr("sunshineShell.subject")}</label>
                    <input value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} placeholder={tr("sunshineShell.eGImportantUpdate")} style={{ ...inp, marginBottom: 12 }} disabled={broadcasting} />

                    {/* ── Message ── */}
                    <label style={lbl}>{tr("sunshineShell.message")}</label>
                    <textarea value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} placeholder={tr("sunshineShell.writeYourMessageHere")} rows={5} style={{ ...inp, marginBottom: 18, resize: 'vertical', height: 120 }} disabled={broadcasting} />

                    {/* ── Actions ── */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="as-press" onClick={() => setBroadcastModal(false)} disabled={broadcasting} style={{ flex: 1, padding: '11px', borderRadius: 14, border: `1px solid ${col.border}`, background: 'transparent', color: col.body, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: F }}>{tr("sunshineShell.cancel")}</button>
                      <button className="as-press as-accent-btn" disabled={!canSend || broadcasting} onClick={handleBroadcast} style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: canSend && !broadcasting ? ACCENT_FILL : 'var(--a-raised)', color: canSend && !broadcasting ? ON_ACCENT : col.muted, fontWeight: 800, fontSize: 13, cursor: canSend && !broadcasting ? 'pointer' : 'not-allowed', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: canSend && !broadcasting ? ACCENT_SHADOW : 'none' }}>
                        <Send size={14} />
                        {broadcasting ? tr("sunshineShell.sending") : tr("sunshineShell.sendTo", { enabledLabel })}
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
        onManageAnalyticsPin={() => { setShowSettingsSidebar(false); setShowAnalyticsPin(true); }}
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
      {showAnalyticsPin && (
        <AnalyticsPinSettings
          onClose={() => setShowAnalyticsPin(false)}
          onSuccess={(msg) => {
            setShowAnalyticsPin(false);
            setAnalyticsPinVersion(v => v + 1);
            setToast(msg); setTimeout(() => setToast(''), 3000);
          }}
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
