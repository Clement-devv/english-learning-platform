// src/pages/sub-admin/dashboard-shells/sunshine/SunshineShell.jsx
// Sub-admin dashboard — Sunshine Explorer design (same look as the admin shell).
// Admin tokens via .as-root (warm neutrals + the center accent) · topic-coloured,
// permission-gated sidebar nav · sunrise/sunset artwork · Nunito font · dark mode.

import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import {
  TrendingUp, Video, Users, Calendar,
  DollarSign, Film, BarChart2, Star, CheckSquare,
  MessageCircle, LogOut, Moon, Sun,
  ClipboardList, GraduationCap, CalendarPlus, FileCheck, ShieldCheck, Link2,
} from 'lucide-react';
import { useNavigate }      from 'react-router-dom';
import { useTranslation }   from 'react-i18next';
import { useAuth }          from '../../../../context/AuthContext.jsx';
import { useBranding }      from '../../../../context/BrandingContext';
import { useDarkMode }      from '../../../../hooks/useDarkMode';
import { TabErrorBoundary } from '../../../../components/ErrorBoundary';
import { getCachedCenter }  from '../../../../utils/branding';
import { adminAccent, adminOnAccent } from '../../../../utils/adminAccent';
import { SunriseBackdrop, SunsetGlow } from '../../../../components/dashboard/SunriseArt';
import {
  OverviewPanel, TeachersPanel, StudentsPanel, LiveClassesPanel,
  ClassesPanel, PaymentsPanel, RecordingsPanel, ReportsPanel,
  ReviewsPanel, MessagesTab,
} from '../../SubAdminPanels.jsx';
import LanguageSwitcher from '../../../../components/LanguageSwitcher';
import SessionManagement from '../../../../components/SessionManagement';
import { Smartphone } from 'lucide-react';
import api from '../../../../api';

// Admin pages the admin can give this sub-admin (Sub-Admins → permissions). Loaded
// only when opened; the server limits them to this sub-admin's own teachers.
const adminPage = (name) => lazy(() => import('../../SubAdminAdminPages.jsx').then((m) => ({ default: m[name] })));
const ClassReportTab   = adminPage('ClassReportTab');
const GroupClassesPage = adminPage('SubAdminGroupClasses');
const BookingsPage     = adminPage('SubAdminBookings');
const LoggedClassesTab = adminPage('LoggedClassesTab');
const ParentChecksTab  = adminPage('ParentChecksTab');
const ShareLinksTab    = adminPage('ShareLinksTab');

// ── Design tokens ──────────────────────────────────────────────────────────────
// Values live in src/index.css (.as-root) — same palette as the admin dashboard.
// Whole-page look: true = liquid glass (frosted panes over colour glows, gradient
// border — same as the admin / teacher / student shells); false = the original solid layout.
const GLASS_PAGE = true;

const palette = () => ({
  bg:      'var(--a-bg)',
  card:    GLASS_PAGE ? 'var(--as-glass-card)' : 'var(--a-surface)',
  border:  'var(--a-line)',
  heading: 'var(--a-ink)',
  body:    'var(--a-ink-2)',
  muted:   'var(--a-muted)',
  accent:  'var(--a-accent)',
  sidebar: GLASS_PAGE ? 'var(--as-glass-card)' : 'var(--a-surface)',
});

const F           = "'Nunito','Inter',sans-serif";
const FONT_IMPORT = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap';
const ACCENT_FILL = 'var(--a-accent-grad)';
const ON_ACCENT   = 'var(--a-on-accent)';
const ACCENT_SHADOW = '0 4px 14px -4px color-mix(in srgb, var(--a-accent) 55%, transparent)';

// ── Shell ──────────────────────────────────────────────────────────────────────
export default function SunshineShell() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user: subAdminInfo, logout: authLogout, setUser } = useAuth();
  const { branding } = useBranding();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const col        = palette();
  const accent     = adminAccent(branding);
  const centerName = getCachedCenter()?.centerName || t('subAdmin.panelFallback');
  const perms      = subAdminInfo?.permissions || {};

  const [activeTab, setActiveTab] = useState('overview');
  const [showDevices, setShowDevices] = useState(false);

  // Permissions saved at login go stale when the admin changes them — refresh on open
  useEffect(() => {
    api.get('/sub-admin-scope/me')
      .then(({ data }) => { if (data?.subAdmin?.permissions) setUser({ permissions: data.subAdmin.permissions }); })
      .catch(() => {});
  }, [setUser]);

  const handleLogout = () => {
    // authLogout() handles BOTH the server-side /auth/logout-session call AND
    // storage clearing via clearAuth() internally.  Calling clearAuth() first
    // would wipe the sessionToken before authLogout() can read it, so the
    // server-side revocation would be skipped.
    authLogout();
    navigate('/sub-admin/login', { replace: true });
  };

  // ── Permission-gated nav groups (each group has a topic colour, as in the admin) ──
  const NAV_GROUPS = useMemo(() => [
    {
      label: null, cat: 'accent',
      items: [{ key: 'overview', label: t('subAdmin.nav.overview'), icon: TrendingUp }],
    },
    {
      label: t('subAdmin.navGroup.people'), cat: 'teal',
      items: [
        { key: 'teachers', label: t('subAdmin.nav.teachers'), icon: Video  },
        { key: 'students', label: t('subAdmin.nav.students'), icon: Users  },
      ],
    },
    {
      label: t('subAdmin.navGroup.classes'), cat: 'amber',
      items: [
        ...(perms.canViewClasses  !== false ? [{ key: 'classes',     label: t('subAdmin.nav.classes'), icon: CheckSquare }] : []),
        ...(perms.canViewBookings !== false ? [{ key: 'live-classes', label: t('subAdmin.nav.liveClasses'), icon: Calendar    }] : []),
        { key: 'recordings', label: t('subAdmin.nav.recordings'), icon: Film     },
        { key: 'reports',    label: t('subAdmin.nav.reports'), icon: BarChart2 },
        { key: 'reviews',    label: t('subAdmin.nav.reviews'), icon: Star      },
        ...(perms.canViewClassReport    ? [{ key: 'class-report',   label: t('subAdmin.nav.classReport'),   icon: ClipboardList }] : []),
        ...(perms.canManageGroupClasses ? [{ key: 'group-classes',  label: t('subAdmin.nav.groupClasses'),  icon: GraduationCap }] : []),
        ...(perms.canCreateBookings     ? [{ key: 'book-class',     label: t('subAdmin.nav.bookAClass'),    icon: CalendarPlus  }] : []),
        ...(perms.canViewLoggedClasses  ? [{ key: 'logged-classes', label: t('subAdmin.nav.loggedClasses'), icon: FileCheck     }] : []),
      ],
    },
    {
      label: t('subAdmin.navGroup.parents'), cat: 'sky',
      items: [
        ...(perms.canManageParentChecks ? [{ key: 'parent-checks', label: t('subAdmin.nav.parentChecks'), icon: ShieldCheck }] : []),
        ...(perms.canViewParentLinks    ? [{ key: 'parent-links',  label: t('subAdmin.nav.parentLinks'),  icon: Link2       }] : []),
      ],
    },
    {
      label: t('subAdmin.navGroup.finance'), cat: 'green',
      items: [
        ...(perms.canViewPayments ? [{ key: 'payments', label: t('subAdmin.nav.payments'), icon: DollarSign }] : []),
      ],
    },
    {
      label: t('subAdmin.navGroup.communication'), cat: 'rose',
      items: [
        ...(perms.canSendMessages !== false ? [{ key: 'messages', label: t('subAdmin.nav.messages'), icon: MessageCircle }] : []),
      ],
    },
  ].filter(g => g.items.length > 0), [perms, t]);

  const ALL_ITEMS  = NAV_GROUPS.flatMap(g => g.items);
  // A page the admin has just switched off falls back to the overview
  const shownTab = ALL_ITEMS.some(i => i.key === activeTab) ? activeTab : 'overview';
  const activeLabel = ALL_ITEMS.find(i => i.key === shownTab)?.label || t('subAdmin.nav.overview');
  const activeCat   = NAV_GROUPS.find(g => g.items.some(i => i.key === shownTab))?.cat || 'accent';
  const ActiveIcon  = ALL_ITEMS.find(i => i.key === shownTab)?.icon || TrendingUp;

  const tabContent = useMemo(() => {
    switch (shownTab) {
      case 'overview':    return <OverviewPanel    isDarkMode={isDarkMode} />;
      case 'teachers':    return <TeachersPanel    isDarkMode={isDarkMode} />;
      case 'students':    return <StudentsPanel    isDarkMode={isDarkMode} />;
      case 'live-classes': return <LiveClassesPanel isDarkMode={isDarkMode} />;
      case 'classes':     return <ClassesPanel     isDarkMode={isDarkMode} canMark={perms.canMarkLessons} />;
      case 'recordings':  return <RecordingsPanel  isDarkMode={isDarkMode} />;
      case 'reports':     return <ReportsPanel     isDarkMode={isDarkMode} />;
      case 'reviews':     return <ReviewsPanel     isDarkMode={isDarkMode} />;
      case 'payments':    return <PaymentsPanel    isDarkMode={isDarkMode} />;
      case 'messages':    return <MessagesTab userRole="sub-admin" />;
      case 'class-report':   return <ClassReportTab   isDarkMode={isDarkMode} />;
      case 'group-classes':  return <GroupClassesPage isDarkMode={isDarkMode} />;
      case 'book-class':     return <BookingsPage     isDarkMode={isDarkMode} />;
      case 'logged-classes': return <LoggedClassesTab isDarkMode={isDarkMode} canApprove={!!perms.canApproveLoggedClasses} />;
      case 'parent-checks':  return <ParentChecksTab  isDarkMode={isDarkMode} />;
      case 'parent-links':   return <ShareLinksTab    isDarkMode={isDarkMode} />;
      default:            return <OverviewPanel    isDarkMode={isDarkMode} />;
    }
  }, [shownTab, isDarkMode, perms.canMarkLessons, perms.canApproveLoggedClasses]);

  const noPadding = shownTab === 'messages';
  const initial = (subAdminInfo?.firstName?.[0] || 'S').toUpperCase();

  const footerBtn = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F, marginTop: 2 };

  return (
    <div
      className={GLASS_PAGE ? 'as-root as-glass' : 'as-root'}
      data-theme={isDarkMode ? 'dark' : 'light'}
      style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: F, background: col.bg, '--a-accent': accent, '--a-on-accent': adminOnAccent(accent) }}
    >
      <style>{`
        @import url('${FONT_IMPORT}');
        * { box-sizing: border-box; }
        .sa-nav { transition: background-color 150ms ease, color 150ms ease, transform 120ms ease-out; }
        .sa-nav:active { transform: scale(0.98); }
        @media (hover: hover) and (pointer: fine) {
          .sa-nav:not([aria-current="page"]):hover { background: ${GLASS_PAGE ? 'color-mix(in srgb, var(--a-surface) 50%, transparent)' : 'var(--a-raised)'} !important; }
        }
        .as-root button:focus-visible, .as-root input:focus-visible, .as-root textarea:focus-visible {
          outline: 2px solid var(--a-accent); outline-offset: 2px;
        }
        .as-root ::selection { background: var(--a-accent-soft); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--a-line-strong); border-radius: 10px; }
        .sa-navscroll { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--a-pink) 45%, transparent) transparent; }
        .sa-navscroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--a-pink) 45%, transparent); border-radius: 999px; }
        @keyframes as-spin { to { transform: rotate(360deg); } }
        @keyframes db-spin  { to { transform: rotate(360deg); } }
        @keyframes db-ping  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.6)} }
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

      {/* ── SIDEBAR ────────────────────────────────────────────────────────────── */}
      <aside className={GLASS_PAGE ? 'as-glass-ring' : undefined} style={{
        width: 224, flexShrink: 0,
        background: col.sidebar,
        ...(GLASS_PAGE
          ? { margin: '12px 0 12px 12px', borderRadius: 26, position: 'relative', border: 'none', overflow: 'hidden' }
          : { borderRight: `1px solid ${col.border}`, overflowY: 'auto', overflowX: 'hidden' }),
        display: 'flex', flexDirection: 'column',
        zIndex: 100,
      }}>
        {/* Brand header — center logo if it has one, otherwise its initial; small sunrise glow */}
        <div style={{ position: 'relative', overflow: 'hidden', flexShrink: 0, padding: '18px 16px 16px', borderBottom: `1px solid ${col.border}` }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: [
            'radial-gradient(60% 120% at 12% 40%, rgba(249,115,22,0.22) 0%, transparent 70%)',
            'radial-gradient(70% 140% at 100% 0%, color-mix(in srgb, var(--a-accent) 20%, transparent) 0%, transparent 70%)',
          ].join(', ') }} />
          <svg aria-hidden="true" width="120" height="120" viewBox="0 0 120 120" style={{ position: 'absolute', right: -44, top: -52, pointerEvents: 'none' }}>
            <defs>
              <linearGradient id="sa-brand-ring" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="var(--a-accent)" />
              </linearGradient>
            </defs>
            {[30, 50].map((r, i) => (
              <circle key={r} cx="60" cy="60" r={r} fill="none" stroke="url(#sa-brand-ring)" strokeOpacity={0.45 - i * 0.15} strokeWidth="1.5" />
            ))}
          </svg>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
            {branding?.logo ? (
              <img src={branding.logo} alt="" style={{ width: 38, height: 38, borderRadius: 11, objectFit: 'cover', flexShrink: 0, boxShadow: `0 0 0 1px ${col.border}` }} />
            ) : (
              <div style={{ width: 38, height: 38, borderRadius: 11, background: ACCENT_FILL, color: ON_ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, flexShrink: 0, boxShadow: ACCENT_SHADOW }}>
                {(centerName?.[0] || 'S').toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: col.heading, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{centerName}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: col.muted }}>{t('subAdmin.role')}</div>
            </div>
          </div>
        </div>

        {/* Sub-admin info card */}
        <div style={{ flexShrink: 0, margin: '10px 10px 6px', background: GLASS_PAGE ? 'color-mix(in srgb, var(--a-surface) 45%, transparent)' : 'var(--a-raised)', boxShadow: GLASS_PAGE ? 'inset 0 0 0 1px var(--as-glass-edge)' : 'none', borderRadius: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--a-accent-soft)', color: 'var(--a-accent-ink)', boxShadow: 'inset 0 0 0 1px var(--a-accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: col.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subAdminInfo?.firstName || t('subAdmin.role')}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: col.muted }}>
              {subAdminInfo?.assignmentType === 'region'
                ? `🌍 ${subAdminInfo.region}`
                : `👥 ${t('subAdmin.teacherCount', { count: subAdminInfo?.teacherScope?.length || 0 })}`}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sa-navscroll" style={{ flex: 1, minHeight: 0, overflowY: GLASS_PAGE ? 'auto' : 'visible', overflowX: 'hidden', padding: '4px 8px' }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={`cat-${group.cat}`} style={{ marginBottom: 6 }}>
              {group.label && (
                <div style={{ fontSize: 10, fontWeight: 800, color: col.muted, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 10px 4px' }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => {
                const isActive = shownTab === item.key;
                const Icon = item.icon;
                return (
                  <button key={item.key} className="sa-nav"
                    onClick={() => setActiveTab(item.key)}
                    aria-current={isActive ? 'page' : undefined}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: isActive ? (GLASS_PAGE ? `color-mix(in srgb, var(--cat) ${isDarkMode ? 22 : 16}%, rgba(255,255,255,${isDarkMode ? 0.06 : 0.45}))` : 'var(--cat-soft)') : 'transparent',
                      boxShadow: isActive && GLASS_PAGE ? 'inset 0 0 0 1px var(--as-glass-edge)' : 'none',
                      fontFamily: F, textAlign: 'left', marginBottom: 1,
                    }}
                  >
                    <Icon size={17} strokeWidth={isActive ? 2.1 : 1.8} color="var(--cat)" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? 'var(--cat-ink)' : col.body }}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer actions */}
        <div style={{ flexShrink: 0, padding: GLASS_PAGE ? '2px 8px 4px' : '8px 8px 16px', borderTop: `1px solid ${col.border}` }}>
          <button className="sa-nav" onClick={toggleDarkMode} role="switch" aria-checked={isDarkMode} style={footerBtn}>
            {isDarkMode ? <Sun size={17} color={col.muted} /> : <Moon size={17} color={col.muted} />}
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>{isDarkMode ? t('subAdmin.lightMode') : t('subAdmin.darkMode')}</span>
          </button>
          <LanguageSwitcher col={col} fontFamily={F} />
          <button className="sa-nav" onClick={() => setShowDevices(true)} style={footerBtn}>
            <Smartphone size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>{t('subAdmin.myDevices')}</span>
          </button>
          <button className="sa-nav" onClick={handleLogout} style={footerBtn}>
            <LogOut size={17} color="#dc2626" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>{t('subAdmin.logout')}</span>
          </button>
        </div>
      </aside>
      <SessionManagement isOpen={showDevices} onClose={() => setShowDevices(false)} />

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────────── */}
      <div className={GLASS_PAGE ? 'as-glass-ring' : undefined} style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
        ...(GLASS_PAGE ? {
          margin: 12, borderRadius: 26,
          background: 'var(--as-glass-frame)',
          boxShadow: 'inset 0 1px 0 var(--as-glass-edge), 0 24px 48px -24px var(--as-glass-glow)',
        } : null),
      }}>
        {!noPadding && <SunsetGlow />}

        {/* Top bar */}
        <header style={{
          height: 60, flexShrink: 0,
          background: col.sidebar,
          borderBottom: `1px solid ${col.border}`,
          display: 'flex', alignItems: 'center',
          padding: '0 24px', gap: 12, zIndex: GLASS_PAGE ? 2 : 50, position: 'relative',
        }}>
          <div className={`cat-${activeCat}`} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <ActiveIcon size={18} color="var(--cat)" strokeWidth={2.1} />
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: col.heading, letterSpacing: '-0.01em', fontFamily: F }}>{activeLabel}</h1>
          </div>

          {subAdminInfo?.assignmentType && (
            <div style={{ background: 'var(--a-surface)', border: `1px solid ${col.border}`, borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: col.heading }}>
              {subAdminInfo.assignmentType === 'region'
                ? `🌍 ${t('subAdmin.region', { region: subAdminInfo.region?.charAt(0).toUpperCase() + subAdminInfo.region?.slice(1) })}`
                : `👥 ${t('subAdmin.teachersAssigned', { count: subAdminInfo.teacherScope?.length || 0 })}`}
            </div>
          )}
          <div style={{ width: 34, height: 34, borderRadius: 10, background: ACCENT_FILL, boxShadow: ACCENT_SHADOW, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ON_ACCENT, fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
            {initial}
          </div>
        </header>

        {/* Page content — sunrise behind the top, content floats on it */}
        <main style={{ flex: 1, overflowY: 'auto', padding: noPadding ? 0 : '28px 28px 40px', position: 'relative' }}>
          {!noPadding && <SunriseBackdrop />}
          <div style={{ position: 'relative', height: noPadding ? '100%' : undefined }}>
            <TabErrorBoundary key={shownTab}>
              <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: col.muted }}>…</div>}>
                {tabContent}
              </Suspense>
            </TabErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
