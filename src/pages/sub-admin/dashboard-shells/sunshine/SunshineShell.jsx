// src/pages/sub-admin/dashboard-shells/sunshine/SunshineShell.jsx
// Sub-admin dashboard — Sunshine Explorer design.
// Warm amber/orange palette · permission-gated sidebar nav · Nunito font · dark mode support.

import React, { useState, useMemo } from 'react';
import {
  TrendingUp, Video, Users, Calendar,
  DollarSign, Film, BarChart2, Star, CheckSquare,
  MessageCircle, Shield, LogOut, Moon, Sun,
} from 'lucide-react';
import { useNavigate }      from 'react-router-dom';
import { useAuth }          from '../../../../context/AuthContext.jsx';
import { useDarkMode }      from '../../../../hooks/useDarkMode';
import { TabErrorBoundary } from '../../../../components/ErrorBoundary';
import { getCachedCenter }  from '../../../../utils/branding';
import { clearAuth }        from '../../../../utils/authStorage.js';
import {
  OverviewPanel, TeachersPanel, StudentsPanel, LiveClassesPanel,
  ClassesPanel, PaymentsPanel, RecordingsPanel, ReportsPanel,
  ReviewsPanel, MessagesTab,
} from '../../SubAdminPanels.jsx';

// ── Design tokens ──────────────────────────────────────────────────────────────
const palette = (dark) => ({
  bg:      dark ? '#0f1117' : '#fff8f0',
  card:    dark ? '#1a1d2e' : '#ffffff',
  border:  dark ? '#2a2d40' : '#ffe8cc',
  heading: dark ? '#f0f4ff' : '#3d2e20',
  body:    dark ? '#c8cce0' : '#5a4a3a',
  muted:   dark ? '#6b7090' : '#a89480',
  accent:  dark ? '#fbbf24' : '#f97316',
  sidebar: dark ? '#13111a' : '#ffffff',
});

const F              = "'Nunito','Inter',sans-serif";
const FONT_IMPORT    = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap';
const ACCENT_G       = 'linear-gradient(135deg,#f97316 0%,#f43f5e 100%)';
const TAB_SHADOW     = 'rgba(249,115,22,0.35)';

// ── Shell ──────────────────────────────────────────────────────────────────────
export default function SunshineShell() {
  const navigate = useNavigate();
  const { user: subAdminInfo, logout: authLogout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const col        = palette(isDarkMode);
  const centerName = getCachedCenter()?.centerName || 'Sub-Admin Panel';
  const perms      = subAdminInfo?.permissions || {};

  const [activeTab, setActiveTab] = useState('overview');

  const handleLogout = () => {
    clearAuth('sub-admin'); // always wipe tokens — don't rely on AuthContext.role
    authLogout();
    navigate('/sub-admin/login');
  };

  // ── Permission-gated nav groups ──────────────────────────────────────────────
  const NAV_GROUPS = useMemo(() => [
    {
      label: null,
      items: [{ key: 'overview', label: 'Overview', icon: TrendingUp }],
    },
    {
      label: 'People',
      items: [
        { key: 'teachers', label: 'Teachers', icon: Video  },
        { key: 'students', label: 'Students', icon: Users  },
      ],
    },
    {
      label: 'Classes',
      items: [
        ...(perms.canViewClasses  !== false ? [{ key: 'classes',     label: 'Classes',      icon: CheckSquare }] : []),
        ...(perms.canViewBookings !== false ? [{ key: 'live-classes', label: 'Live Classes', icon: Calendar    }] : []),
        { key: 'recordings', label: 'Recordings', icon: Film     },
        { key: 'reports',    label: 'Reports',    icon: BarChart2 },
        { key: 'reviews',    label: 'Reviews',    icon: Star      },
      ],
    },
    {
      label: 'Finance',
      items: [
        ...(perms.canViewPayments ? [{ key: 'payments', label: 'Payments', icon: DollarSign }] : []),
      ],
    },
    {
      label: 'Communication',
      items: [
        ...(perms.canSendMessages !== false ? [{ key: 'messages', label: 'Messages', icon: MessageCircle }] : []),
      ],
    },
  ].filter(g => g.items.length > 0), [perms]);

  const ALL_ITEMS  = NAV_GROUPS.flatMap(g => g.items);
  const activeLabel = ALL_ITEMS.find(i => i.key === activeTab)?.label || 'Overview';

  const tabContent = useMemo(() => {
    switch (activeTab) {
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
      default:            return <OverviewPanel    isDarkMode={isDarkMode} />;
    }
  }, [activeTab, isDarkMode, perms.canMarkLessons]);

  const noPadding = activeTab === 'messages';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: F, background: col.bg }}>
      <style>{`
        @import url('${FONT_IMPORT}');
        * { box-sizing: border-box; }
        .sa-nav { transition: background 0.15s; }
        .sa-nav:hover { background: ${isDarkMode ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.08)'} !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${isDarkMode ? '#2a2d40' : '#ffd0a8'}; border-radius: 10px; }
        @keyframes as-spin { to { transform: rotate(360deg); } }
        @keyframes db-spin  { to { transform: rotate(360deg); } }
        @keyframes db-ping  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.6)} }
      `}</style>

      {/* ── SIDEBAR ────────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 224, flexShrink: 0,
        background: col.sidebar,
        borderRight: `2px solid ${col.border}`,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', overflowX: 'hidden',
        zIndex: 100,
      }}>
        {/* Brand header */}
        <div style={{ padding: '20px 16px 14px', borderBottom: `2px solid ${col.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: ACCENT_G, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: `0 4px 12px ${TAB_SHADOW}`, flexShrink: 0 }}>
              🔰
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: col.heading, lineHeight: 1.2 }}>{centerName}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: col.muted }}>Sub-Admin</div>
            </div>
          </div>
        </div>

        {/* Sub-admin info card */}
        <div style={{ margin: '12px 10px', background: isDarkMode ? 'rgba(249,115,22,0.1)' : '#fff7ed', border: `2px solid ${isDarkMode ? 'rgba(249,115,22,0.2)' : '#fed7aa'}`, borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: ACCENT_G, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
            {(subAdminInfo?.firstName?.[0] || 'S').toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: col.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subAdminInfo?.firstName || 'Sub-Admin'}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: col.muted }}>
              {subAdminInfo?.assignmentType === 'region'
                ? `🌍 ${subAdminInfo.region}`
                : `👥 ${subAdminInfo?.teacherScope?.length || 0} teachers`}
            </div>
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
                const Icon = item.icon;
                return (
                  <button key={item.key} className="sa-nav"
                    onClick={() => setActiveTab(item.key)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer',
                      background: isActive ? (isDarkMode ? 'rgba(249,115,22,0.18)' : '#fff7ed') : 'transparent',
                      fontFamily: F, transition: 'background 0.15s',
                    }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: 10, flexShrink: 0,
                      background: isActive ? ACCENT_G : (isDarkMode ? 'rgba(255,255,255,0.04)' : '#f5f0ec'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isActive ? `0 3px 8px ${TAB_SHADOW}` : 'none',
                    }}>
                      {(() => { const I = Icon; return <I size={15} color={isActive ? '#fff' : col.muted} strokeWidth={isActive ? 2.5 : 2} />; })()}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? col.accent : col.body, flex: 1, textAlign: 'left' }}>
                      {item.label}
                    </span>
                    {isActive && <div style={{ width: 4, height: 4, borderRadius: '50%', background: col.accent, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer actions */}
        <div style={{ padding: '10px 8px 16px', borderTop: `2px solid ${col.border}` }}>
          <button className="sa-nav" onClick={toggleDarkMode}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#f5f0ec', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isDarkMode ? <Sun size={15} color={col.muted} /> : <Moon size={15} color={col.muted} />}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button className="sa-nav" onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F, marginTop: 2 }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, background: isDarkMode ? 'rgba(239,68,68,0.08)' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogOut size={15} color="#ef4444" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{
          height: 60, flexShrink: 0,
          background: col.sidebar,
          borderBottom: `2px solid ${col.border}`,
          display: 'flex', alignItems: 'center',
          padding: '0 24px', gap: 16, zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={18} color={col.accent} />
            <span style={{ fontSize: 15, fontWeight: 800, color: col.heading }}>{activeLabel}</span>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {subAdminInfo?.assignmentType && (
              <div style={{ background: isDarkMode ? 'rgba(249,115,22,0.12)' : '#fff7ed', border: `1.5px solid ${isDarkMode ? 'rgba(249,115,22,0.25)' : '#fed7aa'}`, borderRadius: 20, padding: '4px 12px', fontSize: 11.5, fontWeight: 700, color: col.accent }}>
                {subAdminInfo.assignmentType === 'region'
                  ? `🌍 ${subAdminInfo.region?.charAt(0).toUpperCase() + subAdminInfo.region?.slice(1)} Region`
                  : `👥 ${subAdminInfo.teacherScope?.length || 0} Teachers Assigned`}
              </div>
            )}
            <div style={{ width: 34, height: 34, borderRadius: 12, background: ACCENT_G, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 14, boxShadow: `0 3px 8px ${TAB_SHADOW}` }}>
              {(subAdminInfo?.firstName?.[0] || 'S').toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: noPadding ? 0 : '28px 28px 40px', background: col.bg }}>
          <TabErrorBoundary key={activeTab}>
            {tabContent}
          </TabErrorBoundary>
        </main>
      </div>
    </div>
  );
}
