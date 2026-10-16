// src/pages/teacher/dashboard-shells/sunshine/SunshineShell.jsx
// Teacher dashboard — Sunshine Explorer design (same look as the admin / sub-admin shells).
// Admin tokens via .as-root (warm neutrals + the center accent) · topic-coloured sidebar ·
// sunrise banner + backdrop + sunset · Nunito font · dark mode · mobile bottom nav.

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useViewMode } from '../../../../hooks/useViewMode';
const GroupClassesTab = lazy(() => import('../../tabs/GroupClassesTab'));
import {
  Home, Calendar, CheckCircle2, Users, BookOpen, MessageCircle, NotebookPen,
  DollarSign, Star, User, CalendarDays, FileText, Layers, ClipboardList,
  Settings, LogOut, Plus, RefreshCw, Video, Bell, BarChart2, PhoneMissed, X, Clock4, Library,
  CheckCircle, AlertCircle, Repeat, Radio, LayoutGrid, Moon, Sun, ChevronRight,
} from 'lucide-react';
import { useBranding }              from '../../../../context/BrandingContext';
import { useTeacherDashboardData }  from '../useTeacherDashboardData';
import { useRing }                  from '../../../../context/RingContext';
import TeacherTabContent            from '../TeacherTabContent';
import { TabErrorBoundary }         from '../../../../components/ErrorBoundary';
import { lazyTab }                  from '../../../../lib/lazyTab';
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
import LanguageSwitcher             from '../../../../components/LanguageSwitcher';
import { useTranslation }           from 'react-i18next';
import DashboardAlertsBar from "../../../../components/DashboardAlertsBar";
import { adminAccent, adminOnAccent } from '../../../../utils/adminAccent';
import { SunriseBackdrop, SunsetGlow, BannerArt } from '../../../../components/dashboard/SunriseArt';

// Only needed once the teacher joins a class — load it then.
const Classroom = lazyTab(() => import('../../../Classroom'));

// Whole-page look: true = liquid glass (frosted translucent panes over colour glows);
// false = solid panels with the thick pink border.
const GLASS_PAGE = true;

// ── Palette ────────────────────────────────────────────────────────────────────
// Values live in src/index.css (.as-root) — same palette as the admin dashboard.
const palette = () => ({
  bg:       'var(--a-bg)',
  card:     GLASS_PAGE ? 'var(--as-glass-card)' : 'var(--a-surface)',
  cardAlt:  'var(--a-raised)',
  border:   'var(--a-line)',
  heading:  'var(--a-ink)',
  body:     'var(--a-ink-2)',
  muted:    'var(--a-muted)',
  accent:   'var(--a-accent)',
  sidebar:  GLASS_PAGE ? 'var(--as-glass-card)' : 'var(--a-surface)',
});

// ── Nav groups (each group has a topic colour, as in the admin) ───────────────
const makeNavGroups = (t) => [
  {
    label: null, cat: 'accent',
    items: [{ key: 'dashboard', icon: '🏠', label: t('teacher.nav.dashboard'), lucide: Home }],
  },
  {
    label: t('teacher.navGroup.teaching'), cat: 'amber',
    items: [
      { key: 'classes',           icon: '📅', label: t('teacher.nav.myClasses'),    lucide: CalendarDays  },
      { key: 'group-classes',     icon: '👥', label: t('teacher.nav.groupClasses'), lucide: Users         },
      { key: 'completed-classes', icon: '✅', label: t('teacher.nav.completed'),    lucide: CheckCircle2  },
      { key: 'class-summaries',   icon: '📝', label: t('teacher.nav.classSummaries'), lucide: NotebookPen },
      { key: 'schedule',          icon: '🗓️', label: t('teacher.nav.schedule'),     lucide: Calendar      },
    ],
  },
  {
    label: t('teacher.navGroup.students'), cat: 'teal',
    items: [
      { key: 'students', icon: '👥', label: t('teacher.nav.students'), lucide: Users         },
      { key: 'bookings', icon: '📖', label: t('teacher.nav.bookings'), lucide: ClipboardList },
    ],
  },
  {
    label: t('teacher.navGroup.content'), cat: 'sky',
    items: [
      { key: 'homework', icon: '📚', label: t('teacher.nav.homework'),   lucide: BookOpen },
      { key: 'quiz',     icon: '📝', label: t('teacher.nav.quizzes'),    lucide: FileText },
      { key: 'vocab',    icon: '📒', label: t('teacher.nav.vocabulary'), lucide: Layers   },
      { key: 'library',  icon: '📚', label: t('teacher.nav.library'),    lucide: Library  },
    ],
  },
  {
    label: t('teacher.navGroup.more'), cat: 'rose',
    items: [
      { key: 'messages',         icon: '💬', label: t('teacher.nav.messages'),        lucide: MessageCircle },
      { key: 'payment',          icon: '💰', label: t('teacher.nav.payment'),         lucide: DollarSign    },
      { key: 'recordings',       icon: '🎬', label: t('teacher.nav.recordings'),      lucide: Video         },
      { key: 'reviews',          icon: '⭐', label: t('teacher.nav.reviews'),         lucide: Star          },
      { key: 'rating-dashboard', icon: '📊', label: t('teacher.nav.ratingInsights'), lucide: BarChart2     },
      { key: 'profile',          icon: '👤', label: t('teacher.nav.profile'),         lucide: User          },
    ],
  },
];
const F = "'Nunito','Inter',sans-serif";
// Font: Nunito is loaded once from index.html (early, parallel to the bundle).
const ACCENT_FILL   = 'var(--a-accent-grad)';
const ON_ACCENT     = 'var(--a-on-accent)';
const ACCENT_SHADOW = '0 4px 14px -4px color-mix(in srgb, var(--a-accent) 55%, transparent)';

// Topic tile (same as the admin stat tiles): solid icon in the topic colour + corner wash
function TopicTile({ cat, icon: Icon, value, label, sub }) {
  return (
    <div className={`cat-${cat}`} style={{ position: 'relative', overflow: 'hidden', background: 'radial-gradient(120% 90% at 100% 0%, var(--cat-soft) 0%, transparent 55%), var(--a-surface)', border: '1px solid var(--a-line)', borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--a-shadow)' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--cat)', boxShadow: '0 6px 14px -6px var(--cat)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color="#fff" strokeWidth={2.2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--a-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--a-ink)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', fontFamily: F }}>{value}</div>
        {sub && <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--a-ink-2)' }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Missed Calls Banner ────────────────────────────────────────────────────────
const ROLE_LABEL = { teacher: 'Teacher', student: 'Student', admin: 'Admin', subAdmin: 'Sub-Admin' };

function MissedCallsBanner({ missedCalls, clearMissedCalls, col, isDarkMode }) {
  const { t } = useTranslation();
  const formatTime = (ms) => {
    const d = new Date(ms);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      background: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2',
      border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca'}`,
      borderRadius: 16,
      padding: '14px 18px',
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <PhoneMissed size={18} color='#fff' />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: isDarkMode ? '#fca5a5' : '#dc2626', fontFamily: F }}>
            {t(missedCalls.length > 1 ? 'teacher.missedCalls.title_plural' : 'teacher.missedCalls.title', { count: missedCalls.length })}
          </h3>
          <span style={{ fontSize: 11, color: col.muted, fontWeight: 600 }}>{t('teacher.missedCalls.whileAway')}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {missedCalls.map((mc, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--a-surface)',
              border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.2)' : '#fecaca'}`,
              borderRadius: 12, padding: '7px 12px',
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--a-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: col.heading, flexShrink: 0 }}>
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

      <button
        onClick={clearMissedCalls}
        title='Mark all as seen'
        style={{ background: 'var(--a-surface)', border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.12)' : '#fecaca'}`, borderRadius: 10, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: col.muted, flexShrink: 0, fontFamily: F }}
      >
        <X size={12} /> {t('teacher.missedCalls.markSeen')}
      </button>
    </div>
  );
}

// ── Shell ──────────────────────────────────────────────────────────────────────
export default function SunshineShell() {
  const { t } = useTranslation();
  const { branding, center } = useBranding();
  const d   = useTeacherDashboardData();
  const col = palette();
  const accent = adminAccent(branding);
  const { missedCalls, missedCallCount, clearMissedCalls } = useRing();
  const centerName = center?.centerName || t('teacher.sidebar.portal');
  const NAV_GROUPS = makeNavGroups(t);
  const PAGE_LABEL = NAV_GROUPS.flatMap(g => g.items).reduce((m, i) => ({ ...m, [i.key]: i.label }), {});

  const [showRecurringLocal, setShowRecurringLocal] = useState(false);
  // Phones + iPad portrait open in the touch layout; the layout is changed only in
  // Settings → Display Mode (no shortcut buttons on the dashboard).
  const { isMobile, setViewMode, viewportWidth } = useViewMode({ phoneDefault: true });
  const wideTouch = isMobile && viewportWidth >= 700;   // iPad portrait: touch layout, more room
  const compact   = isMobile && !wideTouch;              // phone-sized
  const chatFill  = isMobile && d.activeTab === 'messages';
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  useEffect(() => {
    if (!showMobileMenu) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowMobileMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showMobileMenu]);

  // Theme root: admin tokens (.as-root) + this center's accent; data-theme flips the tokens
  const rootProps = {
    className: GLASS_PAGE ? 'as-root as-glass as-shine' : 'as-root',
    'data-theme': d.isDarkMode ? 'dark' : 'light',
  };
  const rootVars = { '--a-accent': accent, '--a-on-accent': adminOnAccent(accent) };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (d.loading) {
    return (
      <div {...rootProps} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: col.bg, fontFamily: F, ...rootVars }}>
        <style>{`@keyframes bounce{to{transform:translateY(-16px)}}`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', animation: 'bounce 0.8s infinite alternate' }}>👨‍🏫</div>
          <p style={{ color: 'var(--a-accent-ink)', fontWeight: 700, fontSize: '18px', marginTop: '16px', fontFamily: F }}>Loading your classes...</p>
        </div>
      </div>
    );
  }

  // ── Classroom overlay ────────────────────────────────────────────────────
  if (d.isClassroomOpen && d.activeClass)
    return <Classroom classData={d.activeClass} userRole="teacher" onLeave={d.handleLeaveClassroom} />;

  // Badge helper
  const getBadge = (key) => {
    if (key === 'bookings')  return d.pendingBookings > 0 ? d.pendingBookings : null;
    if (key === 'homework')  return d.homeworkToGrade > 0 ? d.homeworkToGrade : null;
    if (key === 'quiz')      return d.quizAttempted  > 0 ? d.quizAttempted  : null;
    if (key === 'messages')  return d.unreadMessages > 0 ? d.unreadMessages : null;
    return null;
  };

  const initial = (d.teacherInfo?.firstName?.[0] || 'T').toUpperCase();
  const card = { background: col.card, border: `1px solid ${col.border}`, borderRadius: 20, boxShadow: 'var(--a-shadow)' };
  const sectionTitle = { margin: '0 0 14px', fontSize: 16, fontWeight: 900, color: col.heading, fontFamily: F, display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <div {...rootProps} style={{ display: 'flex', height: '100dvh', overflow: 'hidden', position: 'relative', fontFamily: F, background: col.bg, ...rootVars }}>
      <style>{`
        * { box-sizing: border-box; }
        .ts-nav { transition: background-color 150ms ease, color 150ms ease, transform 120ms ease-out; }
        .ts-nav:active { transform: scale(0.98); }
        .ts-btn { transition: transform 120ms ease-out, background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease; }
        .ts-btn:not(:disabled):active { transform: scale(0.97); }
        @media (hover: hover) and (pointer: fine) {
          .ts-nav:not([aria-current="page"]):hover { background: ${GLASS_PAGE ? 'color-mix(in srgb, var(--a-surface) 50%, transparent)' : 'var(--a-raised)'} !important; }
          .ts-quick:hover { border-color: var(--a-accent-line) !important; background: var(--a-accent-soft) !important; }
        }
        .as-root button:focus-visible, .as-root input:focus-visible, .as-root textarea:focus-visible {
          outline: 2px solid var(--a-accent); outline-offset: 2px;
        }
        .as-root ::selection { background: var(--a-accent-soft); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--a-line-strong); border-radius: 10px; }
        .ts-navscroll { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--a-pink) 45%, transparent) transparent; }
        .ts-navscroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--a-pink) 45%, transparent); border-radius: 999px; }
      `}</style>

      {/* Colour glows across the page — what the glass panes blur */}
      {GLASS_PAGE && (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden', opacity: d.isDarkMode ? 0.5 : 1 }}>
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

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside className={GLASS_PAGE ? 'as-glass-ring' : undefined} style={{
        width: 220, flexShrink: 0,
        // Floating rounded panel with a thick pink border (same as the student shell)
        margin: '12px 0 12px 12px',
        borderRadius: 26,
        position: 'relative',
        ...(GLASS_PAGE ? {
          background: 'var(--as-glass-card)', border: 'none',
        } : {
          background: 'color-mix(in srgb, var(--a-pink) 7%, var(--a-surface))',
          border: '3px solid color-mix(in srgb, var(--a-pink) 70%, var(--a-surface))',
          boxShadow: '0 10px 30px -12px color-mix(in srgb, var(--a-pink) 45%, transparent)',
        }),
        display: isMobile ? 'none' : 'flex', flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 100,
      }}>
        {/* Brand — center logo if it has one, otherwise its initial; small sunrise glow */}
        <div style={{ position: 'relative', overflow: 'hidden', flexShrink: 0, padding: '16px 16px 12px', borderBottom: `2px solid ${col.border}` }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: [
            'radial-gradient(60% 120% at 12% 40%, rgba(249,115,22,0.22) 0%, transparent 70%)',
            'radial-gradient(70% 140% at 100% 0%, color-mix(in srgb, var(--a-accent) 20%, transparent) 0%, transparent 70%)',
          ].join(', ') }} />
          <svg aria-hidden="true" width="120" height="120" viewBox="0 0 120 120" style={{ position: 'absolute', right: -44, top: -52, pointerEvents: 'none' }}>
            <defs>
              <linearGradient id="ts-brand-ring" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="var(--a-accent)" />
              </linearGradient>
            </defs>
            {[30, 50].map((r, i) => (
              <circle key={r} cx="60" cy="60" r={r} fill="none" stroke="url(#ts-brand-ring)" strokeOpacity={0.45 - i * 0.15} strokeWidth="1.5" />
            ))}
          </svg>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
            {branding?.logo ? (
              <img src={branding.logo} alt="" style={{ width: 38, height: 38, borderRadius: 11, objectFit: 'cover', flexShrink: 0, boxShadow: `0 0 0 1px ${col.border}` }} />
            ) : (
              <div style={{ width: 38, height: 38, borderRadius: 11, background: ACCENT_FILL, color: ON_ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, flexShrink: 0, boxShadow: ACCENT_SHADOW }}>
                {(centerName?.[0] || 'T').toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: col.heading, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{centerName}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: col.muted }}>{t('teacher.sidebar.portal')}</div>
              {branding?.partnershipText && (
                <div style={{ fontSize: 10, color: col.muted, marginTop: 2, fontStyle: 'italic' }}>{branding.partnershipText}</div>
              )}
            </div>
          </div>
        </div>

        {/* Teacher card */}
        <div style={{ flexShrink: 0, margin: '10px 10px 6px', background: GLASS_PAGE ? 'color-mix(in srgb, var(--a-surface) 45%, transparent)' : 'var(--a-raised)', boxShadow: GLASS_PAGE ? 'inset 0 0 0 1px var(--as-glass-edge)' : 'none', borderRadius: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          {d.teacherInfo?.photo ? (
            <img src={d.teacherInfo.photo} alt="" style={{ width: 32, height: 32, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--a-accent-soft)', color: 'var(--a-accent-ink)', boxShadow: 'inset 0 0 0 1px var(--a-accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
              {initial}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: col.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.teacherInfo?.firstName}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: col.muted }}>{d.students.length} students</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="ts-navscroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px' }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={`cat-${group.cat}`} style={{ marginBottom: 6 }}>
              {group.label && (
                <div style={{ fontSize: 10, fontWeight: 800, color: col.muted, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 10px 4px' }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => {
                const isActive = d.activeTab === item.key;
                const badge    = getBadge(item.key);
                const LI = item.lucide;
                return (
                  <button key={item.key} className="ts-nav"
                    onClick={() => d.setActiveTab(item.key)}
                    aria-current={isActive ? 'page' : undefined}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: isActive ? (GLASS_PAGE ? `color-mix(in srgb, var(--cat) ${d.isDarkMode ? 22 : 16}%, rgba(255,255,255,${d.isDarkMode ? 0.06 : 0.45}))` : 'var(--cat-soft)') : 'transparent',
                      boxShadow: isActive && GLASS_PAGE ? 'inset 0 0 0 1px var(--as-glass-edge)' : 'none',
                      fontFamily: F, textAlign: 'left', marginBottom: 1,
                    }}>
                    <LI size={17} strokeWidth={isActive ? 2.1 : 1.8} color="var(--cat)" style={{ flexShrink: 0 }} />
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

        {/* Bottom */}
        <div style={{ flexShrink: 0, padding: '2px 8px 4px', borderTop: `2px solid ${col.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', marginBottom: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: col.muted }}>{d.isDarkMode ? t('teacher.sidebar.darkMode') : t('teacher.sidebar.lightMode')}</span>
            <button onClick={d.toggleDarkMode} role="switch" aria-checked={d.isDarkMode} aria-label={t('teacher.sidebar.darkMode')}
              style={{ width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: d.isDarkMode ? 'var(--a-accent)' : 'var(--a-line-strong)', position: 'relative', transition: 'background-color 200ms ease', flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: 3, transform: `translateX(${d.isDarkMode ? 18 : 0}px)`, transition: 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1)', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
          <button className="ts-nav" onClick={() => d.setShowSettingsSidebar(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F, marginBottom: 1 }}>
            <Settings size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>{t('teacher.sidebar.settings')}</span>
          </button>
          <LanguageSwitcher col={col} fontFamily={F} />
          <button className="ts-nav" onClick={d.handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F }}>
            <LogOut size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>{t('teacher.sidebar.signOut')}</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <div className={GLASS_PAGE && !isMobile ? 'as-glass-ring' : undefined} style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
        // Desktop: rounded panel matching the sidebar
        ...(isMobile ? null : {
          margin: 12, borderRadius: 26,
          ...(GLASS_PAGE ? {
            background: 'var(--as-glass-frame)',
            border: 'none',
            boxShadow: 'inset 0 1px 0 var(--as-glass-edge), 0 24px 48px -24px var(--as-glass-glow)',
          } : {
            background: col.bg,
            border: '3px solid color-mix(in srgb, var(--a-pink) 70%, var(--a-surface))',
            boxShadow: '0 10px 30px -12px color-mix(in srgb, var(--a-pink) 45%, transparent)',
          }),
        }),
      }}>
        {!isMobile && d.activeTab !== 'messages' && <SunsetGlow />}

        {/* ── TOP BAR ── */}
        <header style={{ height: 60, background: col.sidebar, borderBottom: `1px solid ${col.border}`, display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 24px', gap: isMobile ? 8 : 12, flexShrink: 0, position: 'relative', zIndex: 2 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: col.heading, flex: 1, fontFamily: F, letterSpacing: '-0.01em' }}>
            {PAGE_LABEL[d.activeTab] || t('teacher.nav.dashboard')}
          </h1>

          {/* ── Notification chips — desktop only ── */}
          {!isMobile && d.unreadMessages > 0 && (
            <button className="ts-btn" onClick={() => { d.setActiveTab('messages'); d.setUnreadMessages(0); }} title="Go to messages"
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--a-surface)', border: `1px solid ${col.border}`, borderRadius: 999, padding: '5px 12px 5px 10px', cursor: 'pointer', fontFamily: F }}>
              <MessageCircle size={14} color="var(--a-accent)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: col.heading }}>{d.unreadMessages} new</span>
            </button>
          )}
          {!isMobile && missedCallCount > 0 && (
            <button className="ts-btn" onClick={clearMissedCalls} title="Clear missed calls"
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: d.isDarkMode ? 'rgba(239,68,68,0.12)' : '#fef2f2', border: `1px solid ${d.isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca'}`, borderRadius: 999, padding: '5px 12px 5px 10px', cursor: 'pointer', fontFamily: F }}>
              <PhoneMissed size={14} color={d.isDarkMode ? '#fca5a5' : '#dc2626'} />
              <span style={{ fontSize: 12, fontWeight: 700, color: d.isDarkMode ? '#fca5a5' : '#b91c1c' }}>{missedCallCount} missed</span>
            </button>
          )}

          {/* Student count pill — desktop only */}
          {!isMobile && (
            <div className="cat-teal" style={{ background: 'var(--a-surface)', border: `1px solid ${col.border}`, borderRadius: 999, padding: '5px 12px 5px 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Users size={14} color="var(--cat)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: col.heading }}>{d.students.length} students</span>
            </div>
          )}

          {/* Pending bookings pill — desktop only */}
          {!isMobile && d.pendingBookings > 0 && (
            <button className="ts-btn" onClick={() => d.setActiveTab('bookings')} style={{ background: d.isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: `1px solid ${d.isDarkMode ? 'rgba(239,68,68,0.25)' : '#fecaca'}`, borderRadius: 999, padding: '5px 12px 5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontFamily: F }}>
              <Bell size={14} color={d.isDarkMode ? '#fca5a5' : '#dc2626'} />
              <span style={{ fontSize: 12, fontWeight: 700, color: d.isDarkMode ? '#fca5a5' : '#b91c1c' }}>{d.pendingBookings} pending</span>
            </button>
          )}

          {/* Push toggle — desktop only */}
          {!isMobile && d.pushSupported() && (
            <button className="ts-btn" onClick={d.togglePush} title={d.pushEnabled ? 'Disable push notifications' : 'Enable push notifications'}
              style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${col.border}`, background: d.pushEnabled ? '#16a34a' : col.cardAlt, cursor: 'pointer', color: d.pushEnabled ? '#fff' : col.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={16} fill={d.pushEnabled ? 'currentColor' : 'none'} />
            </button>
          )}

          {/* New Class button */}
          <button className="ts-btn" onClick={() => d.setIsModalOpen(true)}
            style={{ background: ACCENT_FILL, color: ON_ACCENT, border: 'none', borderRadius: 12, padding: isMobile ? '8px 12px' : '9px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 6, boxShadow: ACCENT_SHADOW }}>
            <Plus size={14} />{isMobile ? '' : ' New Class'}
          </button>
        </header>

        {/* ── SCROLL AREA ── sunrise behind the top, content floats on it */}
        <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden', overscrollBehavior: 'contain', position: 'relative',
          overflowY: chatFill ? 'hidden' : 'auto', display: chatFill ? 'flex' : undefined, flexDirection: chatFill ? 'column' : undefined,
          padding: chatFill ? `10px ${wideTouch ? 20 : 10}px calc(74px + env(safe-area-inset-bottom, 0px))`
                 : isMobile ? `14px ${wideTouch ? 20 : 12}px calc(86px + env(safe-area-inset-bottom, 0px))` : 24 }}>
          {d.activeTab !== 'messages' && <SunriseBackdrop />}
          <div style={chatFill ? { position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : { position: 'relative' }}>
          {/* Missed calls & new messages while away */}
          {!chatFill && <DashboardAlertsBar isDark={d.isDarkMode} onOpenMessages={() => d.setActiveTab("messages")} />}

          {/* Toast */}
          {d.toast && (
            <div className="ui-toast-in" role="status" style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, padding: '11px 16px 11px 14px', borderRadius: 14, fontWeight: 700, fontSize: 13, background: 'var(--a-surface)', color: col.heading, border: `1px solid ${col.border}`, fontFamily: F, boxShadow: 'var(--a-shadow-pop)', display: 'flex', alignItems: 'center', gap: 9 }}>
              {d.toast.type === 'error' ? <AlertCircle size={17} color="#dc2626" /> : <CheckCircle size={17} color="#16a34a" />}
              {d.toast.message}
            </div>
          )}

          {/* ══ DASHBOARD ══ */}
          {d.activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Welcome banner — same sunrise art as the admin overview */}
              <section style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: isMobile ? '18px 20px' : '26px 28px', background: 'var(--a-surface)', border: `1px solid ${col.border}`, boxShadow: 'var(--a-shadow)' }}>
                <BannerArt ringId="ts-banner-ring" />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: '0 0 6px', background: ACCENT_FILL, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', display: 'inline-block', fontWeight: 800, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    <h2 style={{ margin: '0 0 10px', fontSize: isMobile ? 21 : 24, fontWeight: 900, color: col.heading, fontFamily: F, letterSpacing: '-0.015em' }}>Hey, {d.teacherInfo?.firstName}! 👋</h2>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        { cat: 'teal',  Icon: Users,        text: `${d.students.length} students` },
                        { cat: 'amber', Icon: CalendarDays, text: `${d.classes.length} classes` },
                        ...(d.pendingBookings > 0 ? [{ cat: 'rose', Icon: Bell, text: `${d.pendingBookings} pending` }] : []),
                      ].map(({ cat, Icon, text }) => (
                        <span key={text} className={`cat-${cat}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'color-mix(in srgb, var(--a-surface) 82%, transparent)', backdropFilter: 'blur(6px)', border: `1px solid ${col.border}`, borderRadius: 999, padding: '5px 12px 5px 9px', fontSize: 12.5, fontWeight: 700, color: col.heading }}>
                          <Icon size={14} color="var(--cat)" /> {text}
                        </span>
                      ))}
                    </div>
                  </div>
                  {d.teacherInfo?.photo ? (
                    <img
                      src={d.teacherInfo.photo}
                      alt={d.teacherInfo.firstName}
                      style={{ width: isMobile ? 60 : 76, height: isMobile ? 60 : 76, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '3px solid var(--a-surface)', boxShadow: '0 0 0 2px var(--a-accent-line), var(--a-shadow-pop)' }}
                    />
                  ) : (
                    <div style={{ width: isMobile ? 60 : 76, height: isMobile ? 60 : 76, borderRadius: '50%', flexShrink: 0, background: ACCENT_FILL, border: '3px solid var(--a-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 26 : 32, fontWeight: 900, color: ON_ACCENT, boxShadow: '0 0 0 2px var(--a-accent-line), var(--a-shadow-pop)' }}>
                      {initial}
                    </div>
                  )}
                </div>
              </section>

              {/* Missed calls alert */}
              {missedCallCount > 0 && (
                <MissedCallsBanner missedCalls={missedCalls} clearMissedCalls={clearMissedCalls} col={col} isDarkMode={d.isDarkMode} />
              )}

              {/* 4-stat strip — topic tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))', gap: 12 }}>
                <TopicTile cat="teal"  icon={Users}        value={d.students.length} label="Students" />
                <TopicTile cat="amber" icon={CalendarDays} value={d.classes.length}  label="Classes" />
                <TopicTile cat="green" icon={CheckCircle2} value={d.completedCount}  label="Completed" />
                <TopicTile cat="rose"  icon={BookOpen}     value={d.homeworkToGrade} label="To Grade" />
              </div>

              {/* Class video links — Google Meet + Zoom in one collapsible */}
              {d.teacherInfo?._id && (
                <div style={{ ...card, overflow: 'hidden' }}>
                  <button onClick={() => d.setShowGoogleMeetSettings(!d.showGoogleMeetSettings)}
                    style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: F }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Stacked icons: green Meet + blue Zoom */}
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}>
                          <Video size={14} color="white" />
                        </div>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -10, boxShadow: '0 2px 6px rgba(0,0,0,0.12)', border: `2px solid ${col.card}` }}>
                          <Video size={14} color="white" />
                        </div>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: col.heading }}>Class Video Links</p>
                        <p style={{ margin: 0, fontSize: 12, color: col.muted }}>
                          {`Meet: ${d.googleMeetLink ? '✓' : '—'}  ·  Zoom: ${d.zoomLink ? '✓' : '—'}`}
                        </p>
                      </div>
                    </div>
                    <div style={{ transform: d.showGoogleMeetSettings ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <svg style={{ width: 18, height: 18 }} fill="none" stroke="var(--a-muted)" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {d.showGoogleMeetSettings && (
                    <div style={{ padding: '16px 20px 20px', borderTop: `1px solid ${col.border}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <GoogleMeetSettings
                        platform="google-meet"
                        teacherId={d.teacherInfo._id}
                        initialLink={d.googleMeetLink || ''}
                        onUpdate={d.setGoogleMeetLink}
                        isDarkMode={d.isDarkMode}
                      />
                      <GoogleMeetSettings
                        platform="zoom"
                        teacherId={d.teacherInfo._id}
                        initialLink={d.zoomLink || ''}
                        onUpdate={d.setZoomLink}
                        isDarkMode={d.isDarkMode}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Classes area */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 18, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {d.liveClasses.length > 0 && <div style={{ ...card, padding: compact ? 14 : 20 }}>
                    <h2 style={sectionTitle}>
                      <Radio size={16} color="#dc2626" /> Live Classes
                      {d.liveClasses.length > 0 && <span style={{ background: '#dc2626', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 900 }}>{d.liveClasses.length}</span>}
                    </h2>
                    <LiveClasses classes={d.liveClasses} onJoin={d.handleJoinClass} isDarkMode={d.isDarkMode} />
                  </div>}
                  <div style={{ ...card, padding: compact ? 14 : 20 }}>
                    <h2 style={sectionTitle}><CalendarDays size={16} color="#d97706" /> Upcoming Classes
                      {compact && d.upcomingClasses?.length > 0 && <span style={{ background: 'var(--a-accent-soft)', color: 'var(--a-accent-ink)', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 900 }}>{d.upcomingClasses.length}</span>}
                    </h2>
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
                  <div style={{ ...card, padding: 20 }}>
                    <h2 style={sectionTitle}>⚡ Quick Actions</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { cat: 'accent', Icon: Plus,          label: 'New Class',         action: () => d.setIsModalOpen(true)       },
                        { cat: 'amber',  Icon: Repeat,        label: 'Recurring Classes', action: () => setShowRecurringLocal(true)  },
                        { cat: 'teal',   Icon: ClipboardList, label: 'View Bookings',     action: () => d.setActiveTab('bookings')  },
                        { cat: 'sky',    Icon: Users,         label: 'View Students',     action: () => d.setActiveTab('students')  },
                        { cat: 'stone',  Icon: RefreshCw,     label: 'Refresh Data',      action: d.fetchTeacherData                },
                      ].map(({ cat, Icon, label, action }) => (
                        <button key={label} className={`ts-btn ts-quick cat-${cat}`} onClick={action}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, border: `1px solid ${col.border}`, background: col.cardAlt, cursor: 'pointer', fontFamily: F, textAlign: 'left' }}>
                          <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--cat-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={15} color="var(--cat)" strokeWidth={2.2} />
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: col.body }}>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Homework / Quiz badges */}
                  {(d.homeworkToGrade > 0 || d.quizAttempted > 0) && (
                    <div style={{ ...card, padding: 20 }}>
                      <h2 style={sectionTitle}>📬 Needs Attention</h2>
                      {d.homeworkToGrade > 0 && (
                        <div className="cat-rose" onClick={() => d.setActiveTab('homework')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'var(--cat-soft)', border: '1px solid var(--cat-line)', cursor: 'pointer', marginBottom: 8 }}>
                          <BookOpen size={18} color="var(--cat)" />
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--cat-ink)' }}>{d.homeworkToGrade} homework to grade</p>
                          </div>
                        </div>
                      )}
                      {d.quizAttempted > 0 && (
                        <div className="cat-amber" onClick={() => d.setActiveTab('quiz')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'var(--cat-soft)', border: '1px solid var(--cat-line)', cursor: 'pointer' }}>
                          <FileText size={18} color="var(--cat)" />
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--cat-ink)' }}>{d.quizAttempted} quiz attempts to review</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>

              {/* Summary stats — topic tiles (no top stripes) */}
              <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))', gap: 14 }}>
                <TopicTile cat="teal"  icon={Users}        value={d.students.length}  label="Total Students"    sub="+2 this month" />
                <TopicTile cat="sky"   icon={CalendarDays} value={d.classes.length}   label="Scheduled Classes" sub="Next 7 days" />
                <TopicTile cat="amber" icon={Clock4}       value={d.pendingBookings}  label="Pending Requests"  sub="Needs attention" />
                <TopicTile cat="green" icon={CheckCircle2} value={d.completedCount}   label="Completed Today"   sub="Great progress!" />
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
                wrapStyle={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: 20, padding: compact ? 14 : 24, boxShadow: 'var(--a-shadow)', minWidth: 0 }}
                msgStyle={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: 20, overflow: 'hidden', ...(chatFill ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : null) }}
                msgClassName="as-pink"
                msgFill={chatFill}
                onUnreadCount={d.setUnreadMessages}
              />
            </TabErrorBoundary>
          )}
          </div>
        </main>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}
      <ClassModal
        isOpen={d.isModalOpen}
        onClose={() => d.setIsModalOpen(false)}
        onSave={d.handleAddClass}
        students={d.students}
        isDarkMode={d.isDarkMode}
        theme={{
          accent:         'var(--a-accent)',
          accentGradient: 'var(--a-accent-grad)',
          softBg:         'var(--a-accent-soft)',
          softBorder:     'var(--a-accent-line)',
          softText:       'var(--a-accent-ink)',
          softBgDark:     'var(--a-accent-soft)',
          softBorderDark: 'var(--a-accent-line)',
          softTextDark:   'var(--a-accent-ink)',
        }}
      />

      {(d.showRecurringForm || showRecurringLocal) && (
        <div className="ui-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(28,20,15,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div className="ui-pop-in" style={{ background: 'var(--a-surface)', borderRadius: 20, maxWidth: 900, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--a-shadow-pop)' }}>
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
          isMobile={isMobile} onSetViewMode={setViewMode} tabletLayout
        />
      )}

      {d.showSettingsModal && (
        <SettingsModal isOpen={d.showSettingsModal} onClose={() => d.setShowSettingsModal(false)} userType="teacher" />
      )}

      {/* Layout (mobile / desktop) is changed only in Settings → Display Mode. */}

      {/* ── MOBILE: floating glass tab bar (shared styles: .ss-tabbar in index.css) ── */}
      {isMobile && (
        <nav className="ss-tabbar" aria-label="Main menu">
          {[
            { key: 'dashboard', Icon: Home,          label: t('teacher.nav.dashboard'), cat: 'accent' },
            { key: 'classes',   Icon: CalendarDays,  label: t('teacher.nav.myClasses'), cat: 'amber' },
            { key: 'students',  Icon: Users,         label: t('teacher.nav.students'),  cat: 'teal' },
            { key: 'messages',  Icon: MessageCircle, label: t('teacher.nav.messages'),  cat: 'pink' },
          ].map(({ key, Icon, label, cat }) => {
            const isActive = d.activeTab === key;
            const badge = key === 'messages' ? (d.unreadMessages || 0) + (missedCallCount || 0) : 0;
            return (
              <button key={key} type="button" className={`ss-tab cat-${cat}`} aria-current={isActive ? 'page' : undefined}
                onClick={() => d.setActiveTab(key)}>
                <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                <span>{label}</span>
                {badge > 0 && <span className="ss-tab-badge">{badge > 99 ? '99+' : badge}</span>}
              </button>
            );
          })}
          <button type="button" className="ss-tab cat-stone" aria-haspopup="dialog" aria-expanded={showMobileMenu}
            onClick={() => setShowMobileMenu(true)}>
            <LayoutGrid size={21} strokeWidth={1.9} aria-hidden="true" />
            <span>More</span>
          </button>
        </nav>
      )}

      {/* ── MOBILE: "More" sheet — every page as a tile + theme / account ── */}
      {isMobile && showMobileMenu && (
        <div className="ss-sheet-wrap" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" className="ss-sheet-backdrop" aria-label="Close menu" onClick={() => setShowMobileMenu(false)} />
          <div className="ss-sheet">
            <div className="ss-sheet-handle" aria-hidden="true" />

            <div className="ss-sheet-top">
              {d.teacherInfo?.photo
                ? <img src={d.teacherInfo.photo} alt="" className="ss-sheet-avatar" style={{ objectFit: 'cover' }} />
                : <div className="ss-sheet-avatar" aria-hidden="true">{initial}</div>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: col.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.teacherInfo?.firstName} {d.teacherInfo?.lastName}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: col.muted }}>{t('teacher.sidebar.portal')} · {d.students.length} students</div>
              </div>
              <button type="button" className="ss-sheet-close" aria-label="Close menu" onClick={() => setShowMobileMenu(false)}>
                <X size={18} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>

            {NAV_GROUPS.map((group, gi) => {
              const items = group.items.filter(item => !['dashboard', 'classes', 'students', 'messages'].includes(item.key));
              if (!items.length) return null;
              return (
                <section key={gi} aria-label={group.label || undefined}>
                  {group.label && <p className="ss-sheet-label">{group.label}</p>}
                  <div className={`ss-sheet-grid cat-${group.cat}`}>
                    {items.map(item => {
                      const LI = item.lucide;
                      const isActive = d.activeTab === item.key;
                      const badge = getBadge(item.key);
                      return (
                        <button key={item.key} type="button" className="ss-sheet-tile" aria-current={isActive ? 'page' : undefined}
                          onClick={() => { d.setActiveTab(item.key); setShowMobileMenu(false); }} style={{ position: 'relative' }}>
                          <span className="ss-sheet-chip"><LI size={19} strokeWidth={2.1} aria-hidden="true" /></span>
                          <span>{item.label}</span>
                          {badge != null && <span className="ss-tab-badge" style={{ top: 6, left: 'auto', right: 8 }}>{badge}</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            <p className="ss-sheet-label">Preferences</p>
            <div className="ss-sheet-card">
              <button type="button" className="ss-sheet-row" role="switch" aria-checked={d.isDarkMode} onClick={d.toggleDarkMode}>
                {d.isDarkMode ? <Moon size={18} color={col.muted} aria-hidden="true" /> : <Sun size={18} color={col.muted} aria-hidden="true" />}
                <span>{t('teacher.sidebar.darkMode')}</span>
                <span className="ss-switch" aria-hidden="true" style={{ background: d.isDarkMode ? 'var(--a-accent)' : 'var(--a-line-strong)' }}>
                  <i style={{ transform: `translateX(${d.isDarkMode ? 18 : 0}px)` }} />
                </span>
              </button>
              <div style={{ padding: '0 2px' }}><LanguageSwitcher col={col} fontFamily={F} /></div>
              <button type="button" className="ss-sheet-row" onClick={() => { setShowMobileMenu(false); d.setShowSettingsSidebar(true); }}>
                <Settings size={18} color={col.muted} aria-hidden="true" />
                <span>{t('teacher.sidebar.settings')}</span>
                <ChevronRight size={16} color={col.muted} style={{ marginLeft: 'auto' }} aria-hidden="true" />
              </button>
              <button type="button" className="ss-sheet-row" style={{ color: '#dc2626' }} onClick={d.handleLogout}>
                <LogOut size={18} aria-hidden="true" />
                <span>{t('teacher.sidebar.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
