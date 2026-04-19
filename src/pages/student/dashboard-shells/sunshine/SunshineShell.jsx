// src/pages/student/dashboard-shells/sunshine/SunshineShell.jsx
// Sunshine Explorer — warm orange palette, bubbly Nunito font, vertical sidebar nav.

import { useState } from "react";
import Confetti from "react-confetti";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Home, BookOpen, Brain, Mic2, MessageSquare, CalendarDays, BarChart2,
  Video, Star, Gift, Settings, LogOut, Bell, ChevronDown, ChevronRight,
  Moon, Sun, Shield, KeyRound,
} from "lucide-react";
import { useBranding }           from "../../../../context/BrandingContext";
import { getDashboardThemeById } from "../../../../data/dashboardThemes";
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
import StreakWidget        from "../../components/StreakWidget";
import { useDashboardData, BADGE_DEFINITIONS } from "../useDashboardData";

// ── Sidebar nav groups ────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: null,
    items: [{ key: "dashboard", icon: "🏠", label: "Home", lucide: Home }],
  },
  {
    label: "Learning",
    items: [
      { key: "homework",      icon: "📚", label: "Homework",   lucide: BookOpen },
      { key: "quiz",          icon: "📝", label: "Quizzes",    lucide: Brain    },
      { key: "flashcards",    icon: "📖", label: "Flashcards", lucide: BookOpen },
    ],
  },
  {
    label: "Practice",
    items: [
      { key: "pronunciation", icon: "🎤", label: "Speaking",   lucide: Mic2          },
      { key: "conversation",  icon: "🤖", label: "AI Chat",    lucide: MessageSquare },
    ],
  },
  {
    label: "Classes",
    items: [
      { key: "messages",          icon: "💬", label: "Messages",   lucide: MessageSquare },
      { key: "completed-classes", icon: "✅", label: "Completed",  lucide: CalendarDays  },
      { key: "schedule",          icon: "📅", label: "Schedule",   lucide: CalendarDays  },
    ],
  },
  {
    label: "Progress",
    items: [
      { key: "charts", icon: "📊", label: "Charts",  lucide: BarChart2 },
      { key: "badges", icon: "🏅", label: "Badges",  lucide: Star      },
    ],
  },
  {
    label: "More",
    items: [
      { key: "recordings", icon: "🎬", label: "Recordings", lucide: Video   },
      { key: "reviews",    icon: "⭐", label: "Reviews",    lucide: Star    },
      { key: "referral",   icon: "🎁", label: "Invite",     lucide: Gift    },
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
  const { branding, center } = useBranding();
  const dashTheme = getDashboardThemeById(branding.dashboardTheme);
  const d   = useDashboardData();
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
              <p style={{ margin: "0 0 20px", opacity: 0.9, fontSize: "16px" }}>Keep up the amazing work! 🌟</p>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {d.toast && (
        <div className="pop-in" style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, padding: "14px 24px", borderRadius: "20px", fontWeight: 700, fontSize: "14px", background: d.toast.type === "error" ? "#ef4444" : "#10b981", color: "#fff", fontFamily: F, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 99999 }}>
          {d.toast.type === "error" ? "😬" : "✅"} {d.toast.message}
        </div>
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: d.isDarkMode ? "#13111a" : "#fff",
        borderRight: `2px solid ${col.border}`,
        display: "flex", flexDirection: "column",
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
              <div style={{ fontSize: 11, fontWeight: 700, color: col.muted }}>Learning Platform</div>
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
            <div style={{ fontSize: 11, fontWeight: 600, color: col.muted }}>{d.progress.completedLessons} classes done</div>
          </div>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: "4px 8px" }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 4 }}>
              {group.label && (
                <div style={{ fontSize: 10, fontWeight: 800, color: col.muted, letterSpacing: "0.08em", textTransform: "uppercase", padding: "8px 8px 4px" }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => {
                const isActive = d.activeTab === item.key;
                const badge = item.key === "homework" && d.homeworkPending > 0 ? d.homeworkPending
                            : item.key === "quiz"     && d.quizPending > 0     ? d.quizPending
                            : item.key === "badges"   ? (d.badges.length > 0 ? d.badges.length : null)
                            : item.key === "completed-classes" ? (d.completedClasses.length > 0 ? d.completedClasses.length : null)
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
                    <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? col.accent : col.body }}>
                      {item.label}
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
            <span style={{ fontSize: 12, fontWeight: 700, color: col.muted }}>{d.isDarkMode ? "Dark Mode" : "Light Mode"}</span>
            <button onClick={() => d.setIsDarkMode(v => !v)}
              style={{ width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer", background: d.isDarkMode ? col.accent : col.border, position: "relative", transition: "background .2s", flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: d.isDarkMode ? 21 : 3, transition: "left .2s" }} />
            </button>
          </div>

          <button className="ss-navitem" onClick={() => d.setShowSettingsSidebar(true)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 14, border: "none", cursor: "pointer", background: "transparent", fontFamily: F, marginBottom: 1 }}>
            <Settings size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>Settings</span>
          </button>

          <button className="ss-navitem" onClick={d.handleLogout}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 14, border: "none", cursor: "pointer", background: "transparent", fontFamily: F }}>
            <LogOut size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── TOP BAR ── */}
        <header style={{ height: 64, background: d.isDarkMode ? "#13111a" : "#fff", borderBottom: `2px solid ${col.border}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, flexShrink: 0 }}>
          {/* Page title */}
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col.heading, flex: 1 }}>
            {NAV_GROUPS.flatMap(g => g.items).find(i => i.key === d.activeTab)?.icon}{" "}
            {NAV_GROUPS.flatMap(g => g.items).find(i => i.key === d.activeTab)?.label || "Dashboard"}
          </h1>

          {/* Streak pill */}
          {d.progress.streakDays > 0 && (
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
        </header>

        {/* ── SCROLL AREA ── */}
        <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>

          {/* Pending confirmation banner */}
          {d.pendingConfirmations.length > 0 && d.pendingConfirmations.map(conf => (
            <div key={conf.id} className="kid-card pop-in" style={{ background: d.isDarkMode ? "rgba(251,191,36,0.1)" : "#fffbeb", border: "2px solid #fbbf24", borderRadius: "20px", padding: "16px 20px", marginBottom: "16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "20px" }}>⚠️</span>
                  <strong style={{ color: d.isDarkMode ? "#fbbf24" : "#92400e", fontSize: "14px" }}>Attendance Confirmation Needed!</strong>
                </div>
                <p style={{ margin: "0 0 4px", color: d.isDarkMode ? "#fcd34d" : "#b45309", fontSize: "13px" }}>
                  Your teacher marked <strong>"{conf.title}"</strong> complete. Can you confirm?
                </p>
                <p style={{ margin: 0, color: d.isDarkMode ? "#f59e0b" : "#d97706", fontSize: "12px" }}>
                  ⏰ Auto-confirms in: <strong>{d.getTimeRemaining(conf.autoConfirmAt)}</strong>
                </p>
              </div>
              <button className="kid-btn" onClick={() => { d.setSelectedConfirmation(conf); d.setShowConfirmationModal(true); }}
                style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#fff", border: "none", borderRadius: "14px", padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: F, fontSize: "13px", flexShrink: 0 }}>
                Review 👀
              </button>
            </div>
          ))}

          {/* ══ DASHBOARD ══ */}
          {d.activeTab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* Welcome banner */}
              <div className="kid-card" style={{ background: dashTheme.welcomeGradient, borderRadius: "28px", padding: "28px 32px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", boxShadow: `0 12px 40px ${dashTheme.welcomeShadow}` }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 700, opacity: 0.85, letterSpacing: ".06em", textTransform: "uppercase" }}>Welcome back 🎉</p>
                  <h1 style={{ margin: "0 0 8px", fontSize: "26px", fontWeight: 900 }}>Hey, {d.student.firstName}! 👋</h1>
                  <p style={{ margin: 0, opacity: 0.9, fontSize: "15px" }}>
                    You have <strong>{d.progress.classesRemaining}</strong> classes left. Let's learn something amazing today!
                  </p>
                </div>
                <div style={{ fontSize: "72px", flexShrink: 0 }}>📚</div>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))", gap: "12px" }}>
                {[
                  { icon: "✅", label: "Completed",  value: d.progress.completedLessons,  color: "#10b981", bg: d.isDarkMode ? "rgba(16,185,129,0.12)" : "#f0fdf4"  },
                  { icon: "📅", label: "Remaining",  value: d.progress.classesRemaining,   color: "#3b82f6", bg: d.isDarkMode ? "rgba(59,130,246,0.12)"  : "#eff6ff"  },
                  { icon: "🔥", label: "Day Streak", value: d.progress.streakDays,         color: "#f97316", bg: d.isDarkMode ? "rgba(249,115,22,0.12)"  : "#fff7ed"  },
                  { icon: "⭐", label: "This Week",  value: d.progress.weeklyCompleted,    color: "#8b5cf6", bg: d.isDarkMode ? "rgba(139,92,246,0.12)"  : "#f5f3ff"  },
                ].map(({ icon, label, value, color, bg }) => (
                  <div key={label} className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "20px", padding: "18px 16px", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: "22px" }}>{icon}</div>
                    <div style={{ fontSize: "26px", fontWeight: 900, color, marginBottom: "4px" }}>{value}</div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: col.muted, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Classes + sidebar */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "18px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                  {/* Live classes */}
                  <div className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                    <h2 style={{ margin: "0 0 14px", fontSize: "17px", fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: "8px" }}>
                      🚀 Live & Starting Soon
                      {d.activeClasses.length > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: "999px", padding: "2px 10px", fontSize: "12px", fontWeight: 900 }}>{d.activeClasses.length}</span>}
                    </h2>
                    <ActiveClasses activeClasses={d.activeClasses} onJoin={d.handleJoinClass} />
                  </div>

                  {/* Upcoming */}
                  <div className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                    <h2 style={{ margin: "0 0 14px", fontSize: "17px", fontWeight: 900, color: col.heading }}>📅 Upcoming Classes</h2>
                    <UpcomingClasses upcomingClasses={d.upcomingClasses} onEnroll={() => d.showToast("Coming soon!")} />
                  </div>
                </div>

                {/* Right column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                    <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 900, color: col.heading }}>📈 My Progress</h2>
                    <ProgressCard progress={d.progress} />
                  </div>

                  <StreakWidget isDarkMode={d.isDarkMode} onLoad={d.handleStreakLoaded} />

                  <div className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 900, color: col.heading }}>🏅 My Badges</h2>
                      <button className="kid-btn" onClick={() => d.setActiveTab("badges")} style={{ background: d.isDarkMode ? "rgba(249,115,22,0.15)" : "#fff7ed", border: "none", color: col.accent, fontWeight: 800, borderRadius: "10px", padding: "4px 12px", cursor: "pointer", fontFamily: F, fontSize: "12px" }}>See all →</button>
                    </div>
                    {d.badges.length === 0
                      ? <p style={{ textAlign: "center", color: col.muted, fontSize: "13px", fontWeight: 600 }}>Complete classes to earn badges! 🌟</p>
                      : <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                          {d.badges.slice(-4).map(b => (
                            <div key={b.id} title={b.name} style={{ textAlign: "center" }}>
                              <div style={{ fontSize: "34px" }}>{b.icon}</div>
                              <p style={{ margin: "3px 0 0", fontSize: "10px", fontWeight: 700, color: col.muted, maxWidth: "52px" }}>{b.name}</p>
                            </div>
                          ))}
                        </div>
                    }
                  </div>

                  <div className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                    <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 900, color: col.heading }}>🔔 Notifications</h2>
                    <NotificationsCard notifications={d.notifications} onClearAll={() => d.setNotifications([])} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ HOMEWORK ══ */}
          {d.activeTab === "homework" && <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}><StudentHomeworkTab studentInfo={d.student} isDarkMode={d.isDarkMode} /></div>}

          {/* ══ QUIZ ══ */}
          {d.activeTab === "quiz" && <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}><StudentQuizTab studentInfo={d.student} isDarkMode={d.isDarkMode} /></div>}

          {/* ══ FLASHCARDS ══ */}
          {d.activeTab === "flashcards" && <FlashcardsTab isDarkMode={d.isDarkMode} />}

          {/* ══ PRONUNCIATION ══ */}
          {d.activeTab === "pronunciation" && <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}><PronunciationTab isDarkMode={d.isDarkMode} /></div>}

          {/* ══ CONVERSATION ══ */}
          {d.activeTab === "conversation" && <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}><ConversationTab studentInfo={d.student} isDarkMode={d.isDarkMode} /></div>}

          {/* ══ MESSAGES ══ */}
          {d.activeTab === "messages" && <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", overflow: "hidden" }}><MessagesTab userRole="student" /></div>}

          {/* ══ COMPLETED ══ */}
          {d.activeTab === "completed-classes" && (
            <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "22px", fontWeight: 900, color: col.heading }}>✅ Completed Classes</h2>
              <StudentCompletedTab studentId={d.student.id} isDarkMode={d.isDarkMode} />
            </div>
          )}

          {/* ══ SCHEDULE ══ */}
          {d.activeTab === "schedule" && <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}><StudentScheduleTab studentId={d.student.id} isDarkMode={d.isDarkMode} /></div>}

          {/* ══ CHARTS ══ */}
          {d.activeTab === "charts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px" }}>
                {[
                  { icon: "📚", label: "Total Classes", value: d.completedClasses.length,    color: "#f97316" },
                  { icon: "🔥", label: "Day Streak",    value: d.progress.streakDays,         color: "#ec4899" },
                  { icon: "⏱️", label: "Total Hours",   value: d.completedClasses.length > 0 ? Math.round(d.completedClasses.reduce((s,c) => s+c.duration,0)/60) : 0, color: "#8b5cf6" },
                ].map(({ icon, label, value, color }) => (
                  <div key={label} className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px", textAlign: "center" }}>
                    <div style={{ fontSize: "40px", marginBottom: "8px" }}>{icon}</div>
                    <div style={{ fontSize: "34px", fontWeight: 900, color, marginBottom: "4px" }}>{value}</div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: col.muted, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
                  </div>
                ))}
              </div>
              {[{ title: "📊 Last 7 Days", data: d.chartData.last7, type: "bar" }, { title: "📈 Last 30 Days", data: d.chartData.last30, type: "line" }].map(({ title, data, type }) => (
                <div key={title} className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
                  <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 900, color: col.heading }}>{title}</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    {type === "bar"
                      ? <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={col.border}/><XAxis dataKey="date" stroke={col.muted} style={{ fontFamily: F, fontSize: 11 }}/><YAxis stroke={col.muted} style={{ fontFamily: F, fontSize: 11 }}/><RechartsTooltip contentStyle={tooltipStyle}/><Bar dataKey="classes" fill="#f97316" radius={[8,8,0,0]} name="Classes"/></BarChart>
                      : <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={col.border}/><XAxis dataKey="date" stroke={col.muted} style={{ fontFamily: F, fontSize: 11 }}/><YAxis stroke={col.muted} style={{ fontFamily: F, fontSize: 11 }}/><RechartsTooltip contentStyle={tooltipStyle}/><Line type="monotone" dataKey="classes" stroke="#f97316" strokeWidth={3} dot={{ fill:"#f97316", r:5 }} name="Classes"/></LineChart>
                    }
                  </ResponsiveContainer>
                </div>
              ))}
              <div className="kid-card" style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
                <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 900, color: col.heading }}>🕐 Classes by Time of Day</h3>
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

          {d.activeTab === "recordings" && <RecordingsTab isDarkMode={d.isDarkMode} />}
          {d.activeTab === "reviews"    && <ReviewsTab    isDarkMode={d.isDarkMode} />}
          {d.activeTab === "referral"   && <ReferralTab   isDarkMode={d.isDarkMode} />}
        </main>
      </div>

      {/* Share modal */}
      {d.showShareModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
          <div className="pop-in kid-card" style={{ background: col.card, borderRadius: "28px", padding: "28px", maxWidth: "420px", width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: col.heading }}>🎉 Share Your Win!</h3>
              <button className="kid-btn" onClick={() => d.setShowShareModal(false)} style={{ background: col.border, border: "none", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: col.body }}>✕</button>
            </div>
            <div style={{ background: d.isDarkMode ? "rgba(249,115,22,0.1)" : "#fff7ed", border: `2px solid ${d.isDarkMode ? "rgba(249,115,22,0.3)" : "#fed7aa"}`, borderRadius: "18px", padding: "16px", marginBottom: "18px" }}>
              <h4 style={{ margin: "0 0 6px", fontWeight: 800, color: col.heading }}>{d.shareData?.title}</h4>
              <p style={{ margin: 0, fontSize: "14px", color: col.body, fontWeight: 600 }}>{d.shareData?.message}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button className="kid-btn" onClick={d.copyShareText} style={{ width: "100%", padding: "12px", border: `2px solid ${col.border}`, borderRadius: "16px", background: "transparent", color: col.heading, fontWeight: 800, cursor: "pointer", fontFamily: F, fontSize: "14px" }}>📋 Copy to Clipboard</button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {[["twitter","🐦 Twitter","#1DA1F2"],["facebook","📘 Facebook","#1877F2"],["whatsapp","💬 WhatsApp","#25D366"],["linkedin","💼 LinkedIn","#0A66C2"]].map(([p,label,bg])=>(
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
    </div>
  );
}
