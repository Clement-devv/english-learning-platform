// src/pages/student/dashboard-shells/sunshine/SunshineShell.jsx
// Sunshine Explorer — warm orange palette, bubbly Nunito font, vertical sidebar nav.

import { useState, useEffect, lazy, Suspense } from "react";
import { useViewMode } from "../../../../hooks/useViewMode";
const GroupClassTab        = lazy(() => import('../../tabs/GroupClassTab'));
const BookingCalendarTab   = lazy(() => import('../../tabs/BookingCalendarTab'));
const CertificatesTab      = lazy(() => import('../../tabs/CertificatesTab'));
import Confetti from "react-confetti";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Home, BookOpen, FileText, Layers, Mic2, MessageSquare, MessageCircle,
  CheckCircle2, CalendarDays, TrendingUp, Award, Users,
  Video, Star, Gift, Settings, LogOut, Bell, ChevronDown, ChevronRight,
  Moon, Sun, Shield, KeyRound, PhoneMissed, X,
} from "lucide-react";
import { useTranslation }        from "react-i18next";
import { useBranding }           from "../../../../context/BrandingContext";
import { getDashboardThemeById } from "../../../../data/dashboardThemes";
import { useRing }               from "../../../../context/RingContext";
import LanguageSwitcher          from "../../../../components/LanguageSwitcher";
import ActiveClasses     from "../../components/ActiveClasses";
import UpcomingClasses   from "../../components/UpcomingClasses";
import ProgressCard      from "../../components/ProgressCard";
import NotificationsCard from "../../components/NotificationsCard";
import ChangePassword    from "../../../../components/student/auth/ChangePassword";
import SessionManagement from "../../../../components/SessionManagement";
import SettingsSidebar   from "../../../../components/SettingsSidebar";
import SettingsModal     from "../../../../components/SettingsModal";
import Classroom         from "../../../Classroom";
import MessagesTab       from "../../../../components/chat/MessagesTab";
import ClassConfirmation from "../../../../components/student/ClassConfirmation";
import StudentCompletedTab from "../../tabs/StudentCompletedTab";
import StudentScheduleTab  from "../../tabs/StudentScheduleTab";
import StudentHomeworkTab  from "../../tabs/HomeworkTab";
import StudentQuizTab      from "../../tabs/QuizTab";
import PronunciationTab    from "../../tabs/PronunciationTab";
import ConversationTab     from "../../tabs/ConversationTab";
import FlashcardsTab       from "../../tabs/FlashcardsTab";
import RecordingsTab       from "../../tabs/RecordingsTab";
import ReviewsTab          from "../../tabs/ReviewsTab";
import ReferralTab         from "../../tabs/ReferralTab";
import LeaderboardTab      from "../../tabs/LeaderboardTab";
import StreakWidget        from "../../components/StreakWidget";
import { useDashboardData, BADGE_DEFINITIONS } from "../useDashboardData";

// ── Sidebar nav groups ────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    labelKey: null,
    items: [{ key: "dashboard", icon: "🏠", labelKey: "nav.home", lucide: Home }],
  },
  {
    labelKey: "nav.learning",
    items: [
      { key: "homework",      icon: "📚", labelKey: "nav.homework",   lucide: BookOpen  },
      { key: "quiz",          icon: "📝", labelKey: "nav.quizzes",    lucide: FileText  },
      { key: "flashcards",    icon: "📖", labelKey: "nav.flashcards", lucide: Layers    },
    ],
  },
  {
    labelKey: "nav.practice",
    items: [
      { key: "pronunciation", icon: "🎤", labelKey: "nav.speaking", lucide: Mic2          },
      { key: "conversation",  icon: "🤖", labelKey: "nav.aiChat",   lucide: MessageSquare },
    ],
  },
  {
    labelKey: "nav.classes",
    items: [
      { key: "book-class",        icon: "📆", labelKey: "nav.bookClass",     lucide: CalendarDays  },
      { key: "group-classes",     icon: "👥", labelKey: "nav.groupClasses",  lucide: Users         },
      { key: "messages",          icon: "💬", labelKey: "nav.messages",      lucide: MessageCircle },
      { key: "completed-classes", icon: "✅", labelKey: "nav.completed",     lucide: CheckCircle2  },
      { key: "schedule",          icon: "📅", labelKey: "nav.schedule",      lucide: CalendarDays  },
    ],
  },
  {
    labelKey: "nav.progress",
    items: [
      { key: "charts",       icon: "📊", labelKey: "nav.charts",       lucide: TrendingUp },
      { key: "badges",       icon: "🏅", labelKey: "nav.badges",       lucide: Award      },
      { key: "certificates", icon: "🎓", labelKey: "nav.certificates", lucide: Award      },
      { key: "leaderboard",  icon: "🏆", labelKey: "nav.leaderboard",  lucide: Award      },
    ],
  },
  {
    labelKey: "nav.more",
    items: [
      { key: "recordings", icon: "🎬", labelKey: "nav.recordings", lucide: Video },
      { key: "reviews",    icon: "⭐", labelKey: "nav.reviews",    lucide: Star  },
      { key: "referral",   icon: "🎁", labelKey: "nav.invite",     lucide: Gift  },
    ],
  },
];

// ── BadgesTab (unchanged logic, same as before) ───────────────────────────────
function BadgesTab({ badges, progress, completedClasses, col, isDarkMode, shareAchievement, accentGradient, tabShadow, fontFamily }) {
  const [badgeFilter, setBadgeFilter] = useState("all");
  const categories = [
    { key: "all",         label: "🏅 All"        },
    { key: "journey",     label: "🚀 Journey"     },
    { key: "consistency", label: "🔥 Consistency" },
    { key: "weekly",      label: "📅 Weekly"      },
    { key: "special",     label: "⭐ Special"     },
  ];
  const shown  = BADGE_DEFINITIONS.filter(b => badgeFilter === "all" || b.category === badgeFilter);
  const pct    = Math.round((badges.length / BADGE_DEFINITIONS.length) * 100);
  const nextUp = BADGE_DEFINITIONS.filter(b => !badges.some(e => e.id === b.id) && b.type !== "special").slice(0, 3);

  const getCur = (badge) => {
    if (badge.type === "streak")  return progress.streakDays;
    if (badge.type === "total")   return completedClasses.length;
    if (badge.type === "weekly")  return progress.weeklyCompleted;
    return 0;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <style>{`
        @keyframes badge-shine  { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes badge-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        .badge-earned { transition: all 0.25s; }
        .badge-earned:hover { transform: translateY(-4px) scale(1.03); }
        .badge-locked { filter: grayscale(1); opacity: 0.42; }
      `}</style>

      <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 900, color: col.heading }}>🏅 Achievement Badges</h2>
            <p style={{ margin: 0, color: col.muted, fontSize: "14px", fontWeight: 600 }}>
              {badges.length === 0 ? "Complete classes to start earning!" : `${badges.length} of ${BADGE_DEFINITIONS.length} earned · ${pct}%`}
            </p>
          </div>
          {badges.length > 0 && (
            <button onClick={() => shareAchievement("badge")}
              style={{ background: accentGradient, color: "#fff", border: "none", borderRadius: "14px", padding: "10px 20px", fontWeight: 800, cursor: "pointer", fontFamily: `${fontFamily},sans-serif`, fontSize: "14px", boxShadow: `0 4px 14px ${tabShadow}` }}>
              🎉 Share All
            </button>
          )}
        </div>
        <div style={{ background: col.border, borderRadius: "999px", height: "10px", overflow: "hidden", marginBottom: "16px" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: "999px", background: accentGradient, transition: "width 1s ease" }} />
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {categories.map(cat => (
            <button key={cat.key} onClick={() => setBadgeFilter(cat.key)}
              style={{ padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer", fontFamily: `${fontFamily},sans-serif`, fontSize: "12px", fontWeight: 800, background: badgeFilter === cat.key ? accentGradient : (isDarkMode ? "rgba(255,255,255,0.07)" : "#f3f4f6"), color: badgeFilter === cat.key ? "#fff" : col.muted, boxShadow: badgeFilter === cat.key ? `0 3px 10px ${tabShadow}` : "none" }}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: "14px" }}>
        {shown.map(badge => {
          const earned = badges.some(b => b.id === badge.id);
          const cur    = getCur(badge);
          const bPct   = badge.type === "special" ? (earned ? 100 : 0) : Math.min((cur / badge.requirement) * 100, 100);
          return (
            <div key={badge.id} className={earned ? "badge-earned" : "badge-locked"}
              style={{ borderRadius: "22px", padding: "20px 14px 14px", textAlign: "center", border: `2px solid ${earned ? badge.grad[0] + "60" : col.border}`, background: earned ? (isDarkMode ? `linear-gradient(145deg,${badge.grad[0]}18,${badge.grad[1]}10)` : `linear-gradient(145deg,${badge.grad[0]}12,${badge.grad[1]}08)`) : col.cardAlt, position: "relative", overflow: "hidden" }}>
              {earned && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,${badge.grad[0]},${badge.grad[1]})`, borderRadius: "22px 22px 0 0" }} />}
              <div style={{ fontSize: "48px", marginBottom: "10px", animation: earned ? "badge-float 3s ease-in-out infinite" : "none", display: "inline-block" }}>{badge.icon}</div>
              <h3 style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 900, color: col.heading }}>{badge.name}</h3>
              <p style={{ margin: "0 0 10px", fontSize: "11px", color: col.muted, fontWeight: 600, lineHeight: 1.4 }}>{badge.desc}</p>
              {!earned && badge.type !== "special" && (
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ background: col.border, borderRadius: "999px", height: "6px", overflow: "hidden" }}>
                    <div style={{ width: `${bPct}%`, height: "100%", borderRadius: "999px", background: `linear-gradient(90deg,${badge.grad[0]},${badge.grad[1]})` }} />
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "10px", fontWeight: 700, color: col.muted }}>{cur} / {badge.requirement}</p>
                </div>
              )}
              {earned
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, background: `linear-gradient(135deg,${badge.grad[0]},${badge.grad[1]})`, color: "#fff" }}>✓ Earned</span>
                : <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, background: col.border, color: col.muted }}>🔒 Locked</span>
              }
            </div>
          );
        })}
      </div>

      {nextUp.length > 0 && (
        <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "20px", fontWeight: 900, color: col.heading }}>🎯 Almost There!</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {nextUp.map(badge => {
              const cur = getCur(badge);
              const p   = Math.min((cur / badge.requirement) * 100, 100);
              return (
                <div key={badge.id} style={{ borderRadius: "18px", padding: "16px", border: `2px solid ${col.border}`, background: col.cardAlt }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "36px" }}>{badge.icon}</span>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: "0 0 2px", fontWeight: 900, color: col.heading, fontSize: "14px" }}>{badge.name}</h4>
                      <p style={{ margin: 0, fontSize: "12px", color: col.muted, fontWeight: 600 }}>{badge.desc}</p>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: badge.grad[0] }}>{cur}/{badge.requirement}</span>
                  </div>
                  <div style={{ background: col.border, borderRadius: "999px", height: "8px", overflow: "hidden" }}>
                    <div style={{ width: `${p}%`, height: "100%", borderRadius: "999px", background: `linear-gradient(90deg,${badge.grad[0]},${badge.grad[1]})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SunshineShell
// ══════════════════════════════════════════════════════════════════════════════
export default function SunshineShell() {
  const { t } = useTranslation();
  const { branding, center } = useBranding();
  const dashTheme = getDashboardThemeById(branding.dashboardTheme);
  const d   = useDashboardData();
  const { missedCalls, missedCallCount, clearMissedCalls } = useRing();
  const { isMobile, forcedMode, setViewMode } = useViewMode();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const col = dashTheme.palette(d.isDarkMode);
  const F   = `'${dashTheme.font}',sans-serif`;
  const tooltipStyle = { backgroundColor: d.isDarkMode ? "#1a1d2e" : "#fff", border: `1px solid ${col.border}`, color: col.heading, borderRadius: "12px", fontFamily: F };

  // Loading screen
  if (d.loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: col.bg, fontFamily: F }}>
      <style>{`@import url('${dashTheme.fontImport}'); @keyframes bounce{to{transform:translateY(-16px)}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "64px", animation: "bounce 0.8s infinite alternate" }}>{dashTheme.loadingEmoji}</div>
        <p style={{ color: col.accent, fontWeight: 700, fontSize: "18px", marginTop: "16px" }}>{dashTheme.loadingText}</p>
      </div>
    </div>
  );

  // Classroom overlay
  if (d.isClassroomOpen && d.activeClass)
    return <Classroom classData={d.activeClass} userRole="student" onLeave={d.handleLeaveClassroom} />;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: F, background: col.bg }}>
      <style>{`
        @import url('${dashTheme.fontImport}');
        * { box-sizing: border-box; }
        .ss-navitem { transition: all 0.18s; }
        .ss-navitem:hover { background: ${d.isDarkMode ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.08)"} !important; }
        .kid-card { transition: transform 0.2s, box-shadow 0.2s; }
        .kid-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.10) !important; }
        .kid-btn { transition: transform 0.15s; }
        .kid-btn:hover { transform: scale(1.05); }
        .kid-btn:active { transform: scale(0.97); }
        .pop-in { animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes popIn { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }
        .wiggle:hover { animation: wiggle 0.4s; }
        @keyframes wiggle { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-5deg)} 75%{transform:rotate(5deg)} }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${dashTheme.scrollbarThumb(d.isDarkMode)}; border-radius: 10px; }
      `}</style>

      {/* Confetti */}
      {d.showCelebration && (
        <>
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={500} gravity={0.3} />
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, pointerEvents: "none" }}>
            <div className="pop-in" style={{ background: dashTheme.welcomeGradient, color: "#fff", padding: "40px 56px", borderRadius: "32px", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.3)", pointerEvents: "auto", maxWidth: "90vw" }}>
              <div style={{ fontSize: "72px", marginBottom: "12px" }}>{d.celebrationEmoji}</div>
              <h2 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 900 }}>{d.celebrationMessage}</h2>
              <p style={{ margin: "0 0 20px", opacity: 0.9, fontSize: "16px" }}>{t('dashboard.keepUpWork')}</p>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {d.toast && (
        <div className="pop-in" style={{ position: "fixed", top: "20px", right: "20px", zIndex: 99999, padding: "14px 24px", borderRadius: "20px", fontWeight: 700, fontSize: "14px", background: d.toast.type === "error" ? "#ef4444" : "#10b981", color: "#fff", fontFamily: F, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {d.toast.type === "error" ? "😬" : "✅"} {d.toast.message}
        </div>
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: d.isDarkMode ? "#13111a" : "#fff",
        borderRight: `2px solid ${col.border}`,
        display: isMobile ? "none" : "flex", flexDirection: "column",
        overflowY: "auto", overflowX: "hidden",
        zIndex: 100,
      }}>
        {/* Brand */}
        <div style={{ padding: "20px 16px 14px", borderBottom: `2px solid ${col.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: dashTheme.tabGradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: `0 4px 12px ${dashTheme.tabShadow}`, flexShrink: 0 }}>
              ☀️
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: col.heading, lineHeight: 1.1 }}>{center?.centerName}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: col.muted }}>{t('sidebar.learningPlatform')}</div>
            </div>
          </div>
        </div>

        {/* Student card */}
        <div style={{ margin: "12px 10px", background: d.isDarkMode ? "rgba(249,115,22,0.1)" : "#fff7ed", border: `2px solid ${d.isDarkMode ? "rgba(249,115,22,0.2)" : "#fed7aa"}`, borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: dashTheme.tabGradient, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
            {(d.student.firstName?.[0] || "S").toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: col.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.student.firstName}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: col.muted }}>{t('sidebar.classesDone', { count: d.progress.completedLessons })}</div>
          </div>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: "4px 8px" }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 4 }}>
              {group.labelKey && (
                <div style={{ fontSize: 10, fontWeight: 800, color: col.muted, letterSpacing: "0.08em", textTransform: "uppercase", padding: "8px 8px 4px" }}>
                  {t(group.labelKey)}
                </div>
              )}
              {group.items.map(item => {
                const isActive = d.activeTab === item.key;
                const badge = item.key === "homework" && d.homeworkPending > 0 ? d.homeworkPending
                            : item.key === "quiz"     && d.quizPending > 0     ? d.quizPending
                            : item.key === "badges"   ? (d.badges.length > 0 ? d.badges.length : null)
                            : item.key === "completed-classes" ? (d.completedClasses.length > 0 ? d.completedClasses.length : null)
                            : item.key === "messages" && missedCallCount > 0   ? missedCallCount
                            : null;
                return (
                  <button key={item.key} className="ss-navitem"
                    onClick={() => d.setActiveTab(item.key)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 14, border: "none", cursor: "pointer",
                      background: isActive ? (d.isDarkMode ? "rgba(249,115,22,0.18)" : "#fff7ed") : "transparent",
                      fontFamily: F, textAlign: "left",
                      borderLeft: isActive ? `3px solid ${col.accent}` : "3px solid transparent",
                      marginBottom: 1,
                    }}>
                    {(() => { const LI = item.lucide; return <LI size={17} strokeWidth={1.8} color={isActive ? col.accent : col.body} style={{ flexShrink: 0 }} />; })()}
                    <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? col.accent : col.body }}>
                      {t(item.labelKey)}
                    </span>
                    {badge != null && (
                      <span style={{ background: isActive ? col.accent : (d.isDarkMode ? "rgba(249,115,22,0.3)" : "#fff7ed"), color: isActive ? "#fff" : col.accent, borderRadius: 999, fontSize: 10, fontWeight: 900, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flexShrink: 0 }}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: "8px 8px 16px", borderTop: `2px solid ${col.border}` }}>
          {/* Dark mode toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: col.muted }}>{d.isDarkMode ? t('sidebar.darkMode') : t('sidebar.lightMode')}</span>
            <button onClick={() => d.setIsDarkMode(v => !v)}
              style={{ width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer", background: d.isDarkMode ? col.accent : col.border, position: "relative", transition: "background .2s", flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: d.isDarkMode ? 21 : 3, transition: "left .2s" }} />
            </button>
          </div>

          <button className="ss-navitem" onClick={() => d.setShowSettingsSidebar(true)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 14, border: "none", cursor: "pointer", background: "transparent", fontFamily: F, marginBottom: 1 }}>
            <Settings size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>{t('sidebar.settings')}</span>
          </button>

          <LanguageSwitcher col={col} fontFamily={dashTheme.font} />

          <button className="ss-navitem" onClick={d.handleLogout}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 14, border: "none", cursor: "pointer", background: "transparent", fontFamily: F }}>
            <LogOut size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>{t('sidebar.signOut')}</span>
          </button>

          {/* Switch back to mobile view (only shown when user forced desktop on a phone) */}
          {forcedMode === "desktop" && (
            <button className="ss-navitem" onClick={() => setViewMode("auto")}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 14, border: "none", cursor: "pointer", background: d.isDarkMode ? "rgba(249,115,22,0.1)" : "#fff7ed", fontFamily: F, marginTop: 4 }}>
              <span style={{ fontSize: 15 }}>📱</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: col.accent }}>Mobile View</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── TOP BAR ── */}
        <header style={{ height: 64, background: d.isDarkMode ? "#13111a" : "#fff", borderBottom: `2px solid ${col.border}`, display: "flex", alignItems: "center", padding: isMobile ? "0 12px" : "0 24px", gap: isMobile ? 8 : 16, flexShrink: 0 }}>
          {/* Page title */}
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col.heading, flex: 1 }}>
            {NAV_GROUPS.flatMap(g => g.items).find(i => i.key === d.activeTab)?.icon}{" "}
            {(() => { const it = NAV_GROUPS.flatMap(g => g.items).find(i => i.key === d.activeTab); return it ? t(it.labelKey) : t('nav.home'); })()}
          </h1>

          {/* Streak pill */}
          {d.progress.streakDays > 0 && !isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: d.isDarkMode ? "rgba(249,115,22,0.15)" : "#fff7ed", border: `2px solid ${d.isDarkMode ? "rgba(249,115,22,0.3)" : "#fed7aa"}`, borderRadius: 999, padding: "5px 14px" }}>
              <span style={{ fontSize: 16 }}>🔥</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: col.accent }}>{d.progress.streakDays} day streak</span>
            </div>
          )}

          {/* Notification bell */}
          <button style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: col.muted, display: "flex", padding: 6 }}>
            <Bell size={20} />
            {d.notifications.filter(n => !n.read).length > 0 && (
              <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, background: "#ef4444", borderRadius: "50%", border: `2px solid ${d.isDarkMode ? "#13111a" : "#fff"}` }} />
            )}
          </button>

          {/* Notifications toggle */}
          <button className="kid-btn wiggle" onClick={() => d.notificationsEnabled ? d.disableNotifications() : d.enableNotifications()}
            style={{ width: 38, height: 38, borderRadius: 12, border: `2px solid ${col.border}`, background: d.notificationsEnabled ? "linear-gradient(135deg,#10b981,#059669)" : col.cardAlt, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
            🔔
          </button>

          {/* Desktop mode switch — mobile only */}
          {isMobile && (
            <button className="kid-btn" onClick={() => setViewMode('desktop')} title="Switch to Desktop View"
              style={{ height: 38, borderRadius: 12, border: `2px solid ${col.border}`, background: col.cardAlt, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '0 10px', flexShrink: 0 }}>
              <span style={{ fontSize: 15 }}>🖥️</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: col.muted, fontFamily: F }}>Desktop</span>
            </button>
          )}
        </header>

        {/* ── SCROLL AREA ── */}
        <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? `16px 14px calc(80px + env(safe-area-inset-bottom, 0px))` : 24 }}>

          {/* Pending confirmation banner */}
          {d.pendingConfirmations.length > 0 && d.pendingConfirmations.map(conf => (
            <div key={conf.id} className="kid-card pop-in" style={{ background: d.isDarkMode ? "rgba(251,191,36,0.1)" : "#fffbeb", border: "2px solid #fbbf24", borderRadius: "20px", padding: "16px 20px", marginBottom: "16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "20px" }}>⚠️</span>
                  <strong style={{ color: d.isDarkMode ? "#fbbf24" : "#92400e", fontSize: "14px" }}>{t('dashboard.attendanceNeeded')}</strong>
                </div>
                <p style={{ margin: "0 0 4px", color: d.isDarkMode ? "#fcd34d" : "#b45309", fontSize: "13px" }}>
                  {t('dashboard.attendanceBody', { title: conf.title })}
                </p>
                <p style={{ margin: 0, color: d.isDarkMode ? "#f59e0b" : "#d97706", fontSize: "12px" }}>
                  ⏰ {t('dashboard.autoConfirm', { time: d.getTimeRemaining(conf.autoConfirmAt) })}
                </p>
              </div>
              <button className="kid-btn" onClick={() => { d.setSelectedConfirmation(conf); d.setShowConfirmationModal(true); }}
                style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#fff", border: "none", borderRadius: "14px", padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: F, fontSize: "13px", flexShrink: 0 }}>
                {t('dashboard.review')}
              </button>
            </div>
          ))}

          {/* ══ DASHBOARD ══ */}
          {d.activeTab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: F }}>

              {/* Welcome hero */}
              <div className="kid-card" style={{ background: "linear-gradient(135deg,#f97316 0%,#f43f5e 100%)", borderRadius: 28, padding: "26px 32px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, boxShadow: "0 16px 40px rgba(249,115,22,0.3)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", right: -30, top: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }}/>
                <div style={{ position: "absolute", right: 80, bottom: -50, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }}/>
                <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, opacity: 0.9 }}>{t('dashboard.greeting', { name: d.student.firstName })}</p>
                  <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1.15 }}>{t('dashboard.heroTitle')}</h1>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, opacity: 0.95 }}>
                    {d.homeworkPending > 0 ? t('dashboard.homeworkDue', { count: d.homeworkPending }) : t('dashboard.noPendingHomework')} · {t('dashboard.classesLeft', { count: d.progress.classesRemaining })} 🔥
                  </p>
                </div>
                <div style={{ position: "relative", zIndex: 1, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "16px 22px", textAlign: "center", border: "2px solid rgba(255,255,255,0.25)", flexShrink: 0, display: isMobile ? "none" : "block" }}>
                  <div style={{ fontSize: 34 }}>🔥</div>
                  <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>{d.progress.streakDays}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", opacity: 0.9 }}>{t('dashboard.dayStreak')}</div>
                </div>
              </div>

              {/* Missed calls alert */}
              {missedCallCount > 0 && (
                <div style={{ background: d.isDarkMode ? "rgba(239,68,68,0.1)" : "#fff5f5", border: `2px solid ${d.isDarkMode ? "rgba(239,68,68,0.3)" : "#fecaca"}`, borderRadius: 20, padding: "16px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#ef4444,#dc2626)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(239,68,68,0.35)" }}>
                    <PhoneMissed size={20} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: d.isDarkMode ? "#fca5a5" : "#dc2626", fontFamily: F }}>
                        {missedCallCount} {missedCallCount > 1 ? t('dashboard.missedCalls') : t('dashboard.missedCall')}
                      </h3>
                      <span style={{ fontSize: 11, color: col.muted, fontWeight: 600 }}>{t('dashboard.whileAway')}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {missedCalls.map((mc, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: d.isDarkMode ? "rgba(255,255,255,0.06)" : "#fff", border: `1px solid ${d.isDarkMode ? "rgba(239,68,68,0.2)" : "#fecaca"}`, borderRadius: 12, padding: "7px 12px" }}>
                          <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg,#ef4444,#f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff", flexShrink: 0 }}>
                            {(mc.callerName?.[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: col.heading, lineHeight: 1.2 }}>{mc.callerName}</p>
                            <p style={{ margin: 0, fontSize: 10, color: col.muted, fontWeight: 600 }}>
                              {mc.callerRole === "teacher" ? t('common.teacher') : mc.callerRole === "admin" ? t('common.admin') : mc.callerRole} · {new Date(mc.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={clearMissedCalls} title="Mark all as seen" style={{ background: d.isDarkMode ? "rgba(255,255,255,0.08)" : "#fff", border: `1px solid ${d.isDarkMode ? "rgba(255,255,255,0.12)" : "#fecaca"}`, borderRadius: 10, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: col.muted, flexShrink: 0, fontFamily: F }}>
                    <X size={12} /> {t('dashboard.markSeen')}
                  </button>
                </div>
              )}

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                {[
                  { Icon: BookOpen,     n: d.progress.completedLessons, l: t('dashboard.stats.classesDone'),  grad: "linear-gradient(135deg,#f97316,#fb923c)", shadow: "rgba(249,115,22,0.3)"  },
                  { Icon: CalendarDays, n: d.progress.classesRemaining, l: t('dashboard.stats.classesLeft'),  grad: "linear-gradient(135deg,#3b82f6,#60a5fa)", shadow: "rgba(59,130,246,0.3)"  },
                  { Icon: Award,        n: d.badges.length,             l: t('dashboard.stats.badgesEarned'), grad: "linear-gradient(135deg,#f43f5e,#fb7185)", shadow: "rgba(244,63,94,0.3)"   },
                  { Icon: Star,         n: d.progress.weeklyCompleted,  l: t('dashboard.stats.thisWeek'),     grad: "linear-gradient(135deg,#f59e0b,#fbbf24)", shadow: "rgba(245,158,11,0.3)"  },
                ].slice(0, isMobile ? 2 : 4).map((s, i) => (
                  <div key={i} className="kid-card" style={{ background: col.card, borderRadius: 22, padding: "18px 20px", border: `2px solid ${col.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: s.grad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${s.shadow}` }}>
                      <s.Icon size={20} color="#fff" strokeWidth={2} />
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: col.heading, letterSpacing: "-0.5px" }}>{s.n}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: col.muted }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Classes + sidebar */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr", gap: 18 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Live classes */}
                  {d.activeClasses.length > 0 && (
                    <div className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 24, padding: 20 }}>
                      <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: 8 }}>
                        🚀 {t('dashboard.liveAndSoon')}
                        <span style={{ background: "#ef4444", color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 900 }}>{d.activeClasses.length}</span>
                      </h2>
                      <ActiveClasses activeClasses={d.activeClasses} onJoin={d.handleJoinClass} />
                    </div>
                  )}

                  {/* Upcoming */}
                  <div className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 24, padding: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: 8 }}>
                        📅 {t('dashboard.upcomingClasses')}
                      </h2>
                      <button className="kid-btn" onClick={() => d.setActiveTab("schedule")} style={{ background: "transparent", border: "none", color: col.accent, fontWeight: 800, cursor: "pointer", fontFamily: F, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                        {t('dashboard.viewAll')}
                      </button>
                    </div>
                    <UpcomingClasses upcomingClasses={d.upcomingClasses} onEnroll={() => d.showToast("Coming soon!")} />
                  </div>
                </div>

                {/* Right column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Today's goal / progress */}
                  <div className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 24, padding: 22 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: 8 }}>
                      🎯 {t('dashboard.myProgress')}
                    </h3>
                    <ProgressCard progress={d.progress} />
                  </div>

                  <StreakWidget isDarkMode={d.isDarkMode} onLoad={d.handleStreakLoaded} />

                  {/* Badges callout */}
                  <div className="kid-card" style={{ background: d.isDarkMode ? "rgba(249,115,22,0.1)" : "linear-gradient(145deg,#fff7ed,#fef3c7)", border: `2px solid ${d.isDarkMode ? "rgba(249,115,22,0.25)" : "#fed7aa"}`, borderRadius: 24, padding: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: 8 }}>🏅 {t('dashboard.badges')}</h3>
                      <button className="kid-btn" onClick={() => d.setActiveTab("badges")} style={{ background: "transparent", border: "none", color: col.accent, fontWeight: 800, borderRadius: 10, cursor: "pointer", fontFamily: F, fontSize: 12 }}>{t('dashboard.seeAll')}</button>
                    </div>
                    {d.badges.length === 0 ? (
                      <p style={{ textAlign: "center", color: col.muted, fontSize: 13, fontWeight: 600, margin: 0 }}>{t('dashboard.noBadges')}</p>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {d.badges.slice(-4).map(b => (
                          <div key={b.id} title={b.name} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 34 }}>{b.icon}</div>
                            <p style={{ margin: "3px 0 0", fontSize: 10, fontWeight: 700, color: col.muted, maxWidth: 52 }}>{b.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {d.badges.length > 0 && (
                      <button className="kid-btn" onClick={() => d.shareAchievement("badge")} style={{ marginTop: 14, width: "100%", background: dashTheme.accentGradient, color: "#fff", border: "none", borderRadius: 14, padding: "10px 16px", fontWeight: 900, fontSize: 13, fontFamily: F, cursor: "pointer", boxShadow: `0 6px 14px ${dashTheme.tabShadow}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        {t('dashboard.shareAchievement')}
                      </button>
                    )}
                  </div>

                  <div className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 24, padding: 20 }}>
                    <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 900, color: col.heading }}>🔔 {t('dashboard.notifications')}</h2>
                    <NotificationsCard notifications={d.notifications} onClearAll={() => d.setNotifications([])} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ HOMEWORK ══ */}
          {d.activeTab === "homework" && <StudentHomeworkTab studentInfo={d.student} isDarkMode={d.isDarkMode} />}

          {/* ══ QUIZ ══ */}
          {d.activeTab === "quiz" && <StudentQuizTab studentInfo={d.student} isDarkMode={d.isDarkMode} />}

          {/* ══ FLASHCARDS ══ */}
          {d.activeTab === "flashcards" && <FlashcardsTab isDarkMode={d.isDarkMode} />}

          {/* ══ PRONUNCIATION ══ */}
          {d.activeTab === "pronunciation" && <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}><PronunciationTab isDarkMode={d.isDarkMode} /></div>}

          {/* ══ CONVERSATION ══ */}
          {d.activeTab === "conversation" && <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}><ConversationTab studentInfo={d.student} isDarkMode={d.isDarkMode} /></div>}

          {/* ══ CERTIFICATES ══ */}
          {d.activeTab === "certificates" && (
            <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
              <Suspense fallback={null}>
                <CertificatesTab isDarkMode={d.isDarkMode} />
              </Suspense>
            </div>
          )}

          {/* ══ BOOK A CLASS ══ */}
          {d.activeTab === "book-class" && (
            <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
              <Suspense fallback={null}>
                <BookingCalendarTab isDarkMode={d.isDarkMode} studentInfo={d.student} />
              </Suspense>
            </div>
          )}

          {/* ══ GROUP CLASSES ══ */}
          {d.activeTab === "group-classes" && (
            <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
              <Suspense fallback={null}>
                <GroupClassTab isDarkMode={d.isDarkMode} studentInfo={d.student} />
              </Suspense>
            </div>
          )}

          {/* ══ MESSAGES ══ */}
          {d.activeTab === "messages" && <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", overflow: "hidden" }}><MessagesTab userRole="student" /></div>}

          {/* ══ COMPLETED ══ */}
          {d.activeTab === "completed-classes" && (
            <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "22px", fontWeight: 900, color: col.heading }}>✅ {t('dashboard.completedClasses')}</h2>
              <StudentCompletedTab studentId={d.student.id} isDarkMode={d.isDarkMode} />
            </div>
          )}

          {/* ══ SCHEDULE ══ */}
          {d.activeTab === "schedule" && <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}><StudentScheduleTab studentId={d.student.id} isDarkMode={d.isDarkMode} /></div>}

          {/* ══ CHARTS ══ */}
          {d.activeTab === "charts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: "14px" }}>
                {[
                  { icon: "📚", label: t('charts.totalClasses'), value: d.completedClasses.length,    color: "#f97316" },
                  { icon: "🔥", label: t('charts.dayStreak'),    value: d.progress.streakDays,         color: "#ec4899" },
                  { icon: "⏱️", label: t('charts.totalHours'),   value: d.completedClasses.length > 0 ? Math.round(d.completedClasses.reduce((s,c) => s+c.duration,0)/60) : 0, color: "#8b5cf6" },
                ].map(({ icon, label, value, color }) => (
                  <div key={label} className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px", textAlign: "center" }}>
                    <div style={{ fontSize: "40px", marginBottom: "8px" }}>{icon}</div>
                    <div style={{ fontSize: "34px", fontWeight: 900, color, marginBottom: "4px" }}>{value}</div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: col.muted, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
                  </div>
                ))}
              </div>
              {[{ title: t('charts.last7Days'), data: d.chartData.last7, type: "bar" }, { title: t('charts.last30Days'), data: d.chartData.last30, type: "line" }].map(({ title, data, type }) => (
                <div key={title} className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
                  <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 900, color: col.heading }}>{title}</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    {type === "bar"
                      ? <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={col.border}/><XAxis dataKey="date" stroke={col.muted} style={{ fontFamily: F, fontSize: 11 }}/><YAxis stroke={col.muted} style={{ fontFamily: F, fontSize: 11 }}/><RechartsTooltip contentStyle={tooltipStyle}/><Bar dataKey="classes" fill="#f97316" radius={[8,8,0,0]} name={t('charts.classes')}/></BarChart>
                      : <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={col.border}/><XAxis dataKey="date" stroke={col.muted} style={{ fontFamily: F, fontSize: 11 }}/><YAxis stroke={col.muted} style={{ fontFamily: F, fontSize: 11 }}/><RechartsTooltip contentStyle={tooltipStyle}/><Line type="monotone" dataKey="classes" stroke="#f97316" strokeWidth={3} dot={{ fill:"#f97316", r:5 }} name={t('charts.classes')}/></LineChart>
                    }
                  </ResponsiveContainer>
                </div>
              ))}
              <div className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
                <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 900, color: col.heading }}>{t('charts.byTimeOfDay')}</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart><Pie data={d.chartData.timeDist} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({name,value})=>`${name}: ${value}`} labelLine={false}>{d.chartData.timeDist.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><RechartsTooltip contentStyle={tooltipStyle}/></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ══ BADGES ══ */}
          {d.activeTab === "badges" && (
            <BadgesTab badges={d.badges} progress={d.progress} completedClasses={d.completedClasses} col={col} isDarkMode={d.isDarkMode} shareAchievement={d.shareAchievement} accentGradient={dashTheme.accentGradient} tabShadow={dashTheme.tabShadow} fontFamily={dashTheme.font} />
          )}

          {d.activeTab === "recordings"  && <RecordingsTab  isDarkMode={d.isDarkMode} />}
          {d.activeTab === "reviews"     && <ReviewsTab     isDarkMode={d.isDarkMode} />}
          {d.activeTab === "referral"    && <ReferralTab    isDarkMode={d.isDarkMode} />}
          {d.activeTab === "leaderboard" && (
            <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
              <LeaderboardTab isDarkMode={d.isDarkMode} />
            </div>
          )}
        </main>
      </div>

      {/* Share modal */}
      {d.showShareModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
          <div className="pop-in kid-card" style={{ background: col.card, borderRadius: "28px", padding: "28px", maxWidth: "420px", width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: col.heading }}>{t('share.title')}</h3>
              <button className="kid-btn" onClick={() => d.setShowShareModal(false)} style={{ background: col.border, border: "none", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: col.body }}>✕</button>
            </div>
            <div style={{ background: d.isDarkMode ? "rgba(249,115,22,0.1)" : "#fff7ed", border: `2px solid ${d.isDarkMode ? "rgba(249,115,22,0.3)" : "#fed7aa"}`, borderRadius: "18px", padding: "16px", marginBottom: "18px" }}>
              <h4 style={{ margin: "0 0 6px", fontWeight: 800, color: col.heading }}>{d.shareData?.title}</h4>
              <p style={{ margin: 0, fontSize: "14px", color: col.body, fontWeight: 600 }}>{d.shareData?.message}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button className="kid-btn" onClick={d.copyShareText} style={{ width: "100%", padding: "12px", border: `2px solid ${col.border}`, borderRadius: "16px", background: "transparent", color: col.heading, fontWeight: 800, cursor: "pointer", fontFamily: F, fontSize: "14px" }}>{t('share.copyClipboard')}</button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {[["twitter",t('share.twitter'),"#1DA1F2"],["facebook",t('share.facebook'),"#1877F2"],["whatsapp",t('share.whatsapp'),"#25D366"],["linkedin",t('share.linkedin'),"#0A66C2"]].map(([p,label,bg])=>(
                  <button key={p} className="kid-btn" onClick={()=>d.shareOnSocial(p)} style={{ padding:"11px", background:bg, color:"#fff", border:"none", borderRadius:"14px", fontWeight:800, cursor:"pointer", fontFamily:F, fontSize:"13px" }}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {d.showChangePassword    && <ChangePassword    onClose={() => d.setShowChangePassword(false)} onSuccess={() => { d.setShowChangePassword(false); d.showToast("Password changed! 🔒"); }} />}
      {d.showSessionManagement && <SessionManagement isOpen onClose={() => d.setShowSessionManagement(false)} userType="student" />}
      {d.showSettingsSidebar   && (
        <SettingsSidebar isOpen onClose={() => d.setShowSettingsSidebar(false)}
          onChangePassword={()=>{ d.setShowSettingsSidebar(false); d.setShowChangePassword(true); }}
          onManageSessions={()=>{ d.setShowSettingsSidebar(false); d.setShowSessionManagement(true); }}
          onManage2FA={()=>{ d.setShowSettingsSidebar(false); d.setShowSettingsModal(true); }}
          userInfo={{ firstName: d.student.firstName, lastName: d.student.lastName, email: d.student.email }} />
      )}
      {d.showSettingsModal && <SettingsModal isOpen onClose={() => d.setShowSettingsModal(false)} userType="student" />}
      {d.showConfirmationModal && d.selectedConfirmation && (
        <ClassConfirmation booking={d.selectedConfirmation} isDarkMode={d.isDarkMode}
          onConfirm={()=>{ d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); d.showToast("Class confirmed! ✅"); d.fetchStudentData(); }}
          onDispute={()=>{ d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); d.showToast("Dispute submitted."); d.fetchStudentData(); }}
          onClose={()=>{ d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); }} />
      )}

      {/* Floating pill to switch back to mobile view — visible when user forced desktop on a phone */}
      {forcedMode === "desktop" && (
        <button onClick={() => setViewMode("auto")}
          style={{ position:'fixed', bottom:16, right:16, zIndex:9999, display:'flex', alignItems:'center', gap:6, padding:'10px 16px', borderRadius:999, background: col.accent, color:'#fff', border:'none', cursor:'pointer', fontFamily:F, fontSize:13, fontWeight:800, boxShadow:'0 4px 18px rgba(249,115,22,0.45)' }}>
          📱 Mobile View
        </button>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <nav style={{ position:'fixed', bottom:0, left:0, right:0, background: d.isDarkMode ? '#13111a' : '#fff', borderTop:`2px solid ${col.border}`, display:'flex', zIndex:200, boxShadow:'0 -4px 20px rgba(0,0,0,0.12)', paddingBottom:'env(safe-area-inset-bottom,0px)' }}>
          {[
            { key:'dashboard', Icon:Home, label:'Home' },
            { key:'homework',  Icon:BookOpen, label:'Study' },
            { key:'messages',  Icon:MessageCircle, label:'Chat' },
            { key:'schedule',  Icon:CalendarDays, label:'Classes' },
          ].map(({ key, Icon, label }) => {
            const isActive = d.activeTab === key;
            return (
              <button key={key} onClick={() => d.setActiveTab(key)}
                style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, border:'none', background:'transparent', cursor:'pointer', fontFamily:F, color: isActive ? col.accent : col.muted, position:'relative', height:62, paddingBottom:6 }}>
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                <span style={{ fontSize:10, fontWeight: isActive ? 800 : 600 }}>{label}</span>
                {isActive && <span style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', width:28, height:3, borderRadius:'3px 3px 0 0', background:col.accent }} />}
              </button>
            );
          })}
          <button onClick={() => setShowMobileMenu(true)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, border:'none', background:'transparent', cursor:'pointer', fontFamily:F, color: col.muted, position:'relative', height:62, paddingBottom:6 }}>
            <Settings size={22} strokeWidth={1.8} />
            <span style={{ fontSize:10, fontWeight:600 }}>More</span>
          </button>
        </nav>
      )}

      {/* ── MOBILE MENU SHEET ── */}
      {isMobile && showMobileMenu && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9500 }} onClick={() => setShowMobileMenu(false)}>
          <div style={{ position:'absolute', bottom:0, left:0, right:0, background: d.isDarkMode ? '#13111a' : '#fff', borderRadius:'20px 20px 0 0', padding:'12px 16px 40px', maxHeight:'75vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, background:col.border, borderRadius:999, margin:'0 auto 16px' }} />
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>

              {/* View mode toggle */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px 14px', marginBottom:2 }}>
                <span style={{ fontSize:13, fontWeight:700, color:col.muted }}>View</span>
                <div style={{ display:'flex', background: d.isDarkMode ? 'rgba(255,255,255,0.06)' : '#f3f4f6', borderRadius:12, padding:3, gap:2 }}>
                  {[{ mode:'auto', label:'📱 Mobile' }, { mode:'desktop', label:'🖥️ Desktop' }].map(({ mode, label }) => {
                    const active = mode === 'desktop' ? forcedMode === 'desktop' : forcedMode !== 'desktop';
                    return (
                      <button key={mode} onClick={() => { setViewMode(mode); if (mode === 'desktop') setShowMobileMenu(false); }}
                        style={{ padding:'6px 14px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:F, fontSize:12, fontWeight:800, transition:'all 0.15s',
                          background: active ? col.accent : 'transparent',
                          color: active ? '#fff' : col.muted }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {NAV_GROUPS.flatMap(g => g.items)
                .filter(item => !['dashboard','homework','messages','schedule'].includes(item.key))
                .map(item => {
                  const LI = item.lucide;
                  const isActive = d.activeTab === item.key;
                  return (
                    <button key={item.key} onClick={() => { d.setActiveTab(item.key); setShowMobileMenu(false); }}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:14, border:'none', background: isActive ? (d.isDarkMode ? 'rgba(249,115,22,0.18)' : '#fff7ed') : 'transparent', color: isActive ? col.accent : col.body, cursor:'pointer', fontFamily:F, width:'100%' }}>
                      <LI size={18} color={isActive ? col.accent : col.muted} strokeWidth={1.8} />
                      <span style={{ fontSize:14, fontWeight: isActive ? 800 : 600 }}>{t(item.labelKey)}</span>
                    </button>
                  );
                })}
              <div style={{ borderTop:`1px solid ${col.border}`, margin:'8px 0 4px' }} />
              <button onClick={() => { setShowMobileMenu(false); d.setShowSettingsSidebar(true); }}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:14, border:'none', background:'transparent', color:col.body, cursor:'pointer', fontFamily:F, width:'100%' }}>
                <Settings size={18} color={col.muted} strokeWidth={1.8} />
                <span style={{ fontSize:14, fontWeight:600 }}>{t('sidebar.settings')}</span>
              </button>
              <button onClick={d.handleLogout}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:14, border:'none', background:'transparent', color:'#ef4444', cursor:'pointer', fontFamily:F, width:'100%' }}>
                <LogOut size={18} color="#ef4444" strokeWidth={1.8} />
                <span style={{ fontSize:14, fontWeight:600 }}>{t('sidebar.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
