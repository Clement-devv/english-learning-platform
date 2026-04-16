// src/pages/student/dashboard-shells/CRMShell.jsx
// SugarCRM-inspired professional design.
// Layout: slim dark icon sidebar + clean white content area + pill tabs.
// Visual language: Inter font, pill-shaped buttons, black active pill, minimal shadows.

import { useState } from "react";
import Confetti from "react-confetti";
import {
  Home, BookOpen, Mic2, MessageSquare, CalendarDays, BarChart2,
  MoreHorizontal, Search, Bell, LogOut, Settings, Sun, Moon,
  CheckSquare, Clock, Flame, Star, ChevronRight, Copy,
  Shield, KeyRound, Layers
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { useBranding } from "../../../context/BrandingContext";
import ChangePassword from "../../../components/student/auth/ChangePassword";
import SessionManagement from "../../../components/SessionManagement";
import SettingsModal from "../../../components/SettingsModal";
import Classroom from "../../Classroom";
import MessagesTab from "../../../components/chat/MessagesTab";
import ClassConfirmation from "../../../components/student/ClassConfirmation";
import StudentCompletedTab from "../tabs/StudentCompletedTab";
import StudentScheduleTab  from "../tabs/StudentScheduleTab";
import StudentHomeworkTab  from "../tabs/HomeworkTab";
import StudentQuizTab      from "../tabs/QuizTab";
import PronunciationTab   from "../tabs/PronunciationTab";
import ConversationTab    from "../tabs/ConversationTab";
import FlashcardsTab      from "../tabs/FlashcardsTab";
import RecordingsTab      from "../tabs/RecordingsTab";
import ReviewsTab        from "../tabs/ReviewsTab";
import ReferralTab      from "../tabs/ReferralTab";
import StreakWidget      from "../components/StreakWidget";
import ActiveClasses from "../components/ActiveClasses";
import UpcomingClasses from "../components/UpcomingClasses";
import ProgressCard from "../components/ProgressCard";
import NotificationsCard from "../components/NotificationsCard";
import { useDashboardData, BADGE_DEFINITIONS } from "./useDashboardData";

// ── Sidebar section definitions ───────────────────────────────────────────────
const SIDEBAR = [
  { id: "dashboard",  Icon: Home,           label: "Home",     tabs: ["dashboard"]                             },
  { id: "study",      Icon: BookOpen,        label: "Study",    tabs: ["homework", "quiz", "flashcards"]        },
  { id: "practice",   Icon: Mic2,            label: "Practice", tabs: ["pronunciation", "conversation"]         },
  { id: "messages",   Icon: MessageSquare,   label: "Messages", tabs: ["messages"]                              },
  { id: "classes",    Icon: CalendarDays,    label: "Classes",  tabs: ["completed-classes", "schedule"]         },
  { id: "progress",   Icon: BarChart2,       label: "Progress", tabs: ["charts", "badges"]                      },
  { id: "more",       Icon: MoreHorizontal,  label: "More",     tabs: ["recordings", "reviews", "referral"]     },
];

// Sub-tab labels per section
const SUB_TABS = {
  study:    [{ key: "homework", label: "Homework" }, { key: "quiz", label: "Quizzes" }, { key: "flashcards", label: "Flashcards" }],
  practice: [{ key: "pronunciation", label: "Speak" }, { key: "conversation", label: "AI Chat" }],
  classes:  [{ key: "completed-classes", label: "Completed" }, { key: "schedule", label: "Schedule" }],
  progress: [{ key: "charts", label: "Charts" }, { key: "badges", label: "Badges" }],
  more:     [{ key: "recordings", label: "Recordings" }, { key: "reviews", label: "Reviews" }, { key: "referral", label: "Invite" }],
};

// ── CRM Badges Panel ──────────────────────────────────────────────────────────
function CRMBadgesPanel({ badges, progress, completedClasses, accent, shareAchievement }) {
  const [filter, setFilter] = useState("all");
  const categories = [
    { key: "all", label: "All" }, { key: "journey", label: "Journey" },
    { key: "consistency", label: "Consistency" }, { key: "weekly", label: "Weekly" }, { key: "special", label: "Special" },
  ];
  const shown  = BADGE_DEFINITIONS.filter(b => filter === "all" || b.category === filter);
  const pct    = Math.round((badges.length / BADGE_DEFINITIONS.length) * 100);
  const nextUp = BADGE_DEFINITIONS.filter(b => !badges.some(e => e.id === b.id) && b.type !== "special").slice(0, 3);

  const getCur = (b) => {
    if (b.type === "streak")  return progress.streakDays;
    if (b.type === "total")   return completedClasses.length;
    if (b.type === "weekly")  return progress.weeklyCompleted;
    return 0;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "#111827" }}>Achievement Badges</h2>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
              {badges.length === 0 ? "Complete classes to start earning!" : `${badges.length} of ${BADGE_DEFINITIONS.length} earned · ${pct}%`}
            </p>
          </div>
          {badges.length > 0 && (
            <button onClick={() => shareAchievement("badge")}
              style={{ background: accent, color: "#fff", border: "none", borderRadius: "999px", padding: "9px 20px", fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: "14px" }}>
              Share All
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#6b7280", marginBottom: "6px" }}>
            <span>Overall Progress</span><span>{pct}%</span>
          </div>
          <div style={{ background: "#f3f4f6", borderRadius: "999px", height: "8px", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: "999px", background: accent, transition: "width 1s ease" }} />
          </div>
        </div>

        {/* Category filters */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {categories.map(cat => (
            <button key={cat.key} onClick={() => setFilter(cat.key)}
              style={{ padding: "6px 16px", borderRadius: "999px", border: "1px solid", cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: "13px", fontWeight: 500, transition: "all 0.15s", background: filter === cat.key ? "#111827" : "transparent", color: filter === cat.key ? "#fff" : "#374151", borderColor: filter === cat.key ? "#111827" : "#d1d5db" }}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Badge grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: "12px" }}>
        {shown.map(badge => {
          const earned = badges.some(b => b.id === badge.id);
          const cur    = getCur(badge);
          const bPct   = badge.type === "special" ? (earned ? 100 : 0) : Math.min((cur / badge.requirement) * 100, 100);
          return (
            <div key={badge.id}
              style={{ background: "#fff", border: `1px solid ${earned ? badge.grad[0] + "40" : "#e5e7eb"}`, borderRadius: "12px", padding: "20px 16px 16px", textAlign: "center", opacity: earned ? 1 : 0.55, transition: "all 0.2s", cursor: "default" }}>
              <div style={{ fontSize: "40px", marginBottom: "8px" }}>{badge.icon}</div>
              <h3 style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "#111827" }}>{badge.name}</h3>
              <p style={{ margin: "0 0 10px", fontSize: "11px", color: "#6b7280", lineHeight: 1.4 }}>{badge.desc}</p>
              {!earned && badge.type !== "special" && (
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ background: "#f3f4f6", borderRadius: "999px", height: "5px", overflow: "hidden" }}>
                    <div style={{ width: `${bPct}%`, height: "100%", borderRadius: "999px", background: `linear-gradient(90deg,${badge.grad[0]},${badge.grad[1]})` }} />
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#6b7280" }}>{cur} / {badge.requirement}</p>
                </div>
              )}
              <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, background: earned ? `${badge.grad[0]}15` : "#f3f4f6", color: earned ? badge.grad[0] : "#9ca3af" }}>
                {earned ? "✓ Earned" : "Locked"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Almost there */}
      {nextUp.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "17px", fontWeight: 700, color: "#111827" }}>Almost There</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {nextUp.map(badge => {
              const cur = getCur(badge);
              const p   = Math.min((cur / badge.requirement) * 100, 100);
              return (
                <div key={badge.id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", border: "1px solid #e5e7eb", borderRadius: "10px" }}>
                  <span style={{ fontSize: "32px" }}>{badge.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 600, color: "#111827", fontSize: "14px" }}>{badge.name}</span>
                      <span style={{ fontSize: "13px", color: "#6b7280" }}>{cur}/{badge.requirement}</span>
                    </div>
                    <div style={{ background: "#f3f4f6", borderRadius: "999px", height: "6px", overflow: "hidden" }}>
                      <div style={{ width: `${p}%`, height: "100%", borderRadius: "999px", background: `linear-gradient(90deg,${badge.grad[0]},${badge.grad[1]})` }} />
                    </div>
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

// ── Main CRM Shell ────────────────────────────────────────────────────────────
export default function CRMShell() {
  const { branding } = useBranding();
  const accent = branding.primaryColor || "#4F46E5";

  const d = useDashboardData();
  // Local UI state not shared with other shells
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [show2FA, setShow2FA] = useState(false);

  // Derive active sidebar section from active tab
  const activeSideSection = SIDEBAR.find(s => s.tabs.includes(d.activeTab))?.id || "dashboard";
  const subTabs = SUB_TABS[activeSideSection] || [];

  const tooltipStyle = { backgroundColor: "#fff", border: "1px solid #e5e7eb", color: "#111827", borderRadius: "8px", fontFamily: "Inter,sans-serif", fontSize: "12px" };

  if (d.loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", fontFamily: "Inter,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "40px", height: "40px", border: `3px solid #e5e7eb`, borderTopColor: accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "#6b7280", fontWeight: 500, fontSize: "15px" }}>Loading your dashboard...</p>
      </div>
    </div>
  );

  if (d.isClassroomOpen && d.activeClass)
    return <Classroom classData={d.activeClass} userRole="student" onLeave={d.handleLeaveClassroom} />;

  const centerName = branding.centerName || "My Academy";

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Inter,sans-serif", background: "#f9fafb" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .crm-nav-item { transition: all 0.15s; }
        .crm-nav-item:hover { background: rgba(255,255,255,0.08) !important; }
        .crm-btn { transition: opacity 0.15s, transform 0.1s; }
        .crm-btn:hover { opacity: 0.88; }
        .crm-btn:active { transform: scale(0.97); }
        .crm-card { transition: box-shadow 0.2s; }
        .crm-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
        .crm-pill-active { background: #111827 !important; color: #fff !important; }
        .crm-pill:hover { color: #111827; }
      `}</style>

      {/* Confetti celebration */}
      {d.showCelebration && (
        <>
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={400} gravity={0.3} />
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, pointerEvents: "none" }}>
            <div style={{ background: accent, color: "#fff", padding: "40px 52px", borderRadius: "20px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", pointerEvents: "auto", maxWidth: "90vw" }}>
              <div style={{ fontSize: "64px", marginBottom: "12px" }}>{d.celebrationEmoji}</div>
              <h2 style={{ margin: "0 0 8px", fontSize: "26px", fontWeight: 700 }}>{d.celebrationMessage}</h2>
              <p style={{ margin: "0 0 20px", opacity: 0.85, fontSize: "15px" }}>Keep up the amazing work!</p>
              <button className="crm-btn" onClick={() => d.shareAchievement(d.newBadge ? "badge" : d.progress.streakDays >= 5 ? "streak" : "total")}
                style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.5)", color: "#fff", padding: "10px 24px", borderRadius: "999px", fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: "14px" }}>
                Share Achievement
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {d.toast && (
        <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, padding: "12px 20px", borderRadius: "10px", fontWeight: 500, fontSize: "14px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", background: d.toast.type === "error" ? "#fee2e2" : "#f0fdf4", color: d.toast.type === "error" ? "#991b1b" : "#166534", border: `1px solid ${d.toast.type === "error" ? "#fca5a5" : "#bbf7d0"}`, fontFamily: "Inter,sans-serif" }}>
          {d.toast.type === "error" ? "✕ " : "✓ "}{d.toast.message}
        </div>
      )}

      {/* ── Left Sidebar ────────────────────────────────────────────────────── */}
      <aside style={{ width: "64px", background: "#111827", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "16px", paddingBottom: "16px", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50 }}>
        {/* Logo / avatar area */}
        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px", flexShrink: 0, fontWeight: 700, fontSize: "16px", color: "#fff" }}>
          {centerName.charAt(0).toUpperCase()}
        </div>

        {/* Nav items */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, width: "100%", padding: "0 8px" }}>
          {SIDEBAR.map(({ id, Icon, label }) => {
            const isActive = activeSideSection === id;
            const totalBadge = id === "study" && (d.homeworkPending + d.quizPending) > 0 ? d.homeworkPending + d.quizPending : null;
            return (
              <button key={id} title={label}
                className="crm-nav-item"
                onClick={() => {
                  const subs = SUB_TABS[id];
                  d.setActiveTab(subs ? subs[0].key : id === "messages" ? "messages" : "dashboard");
                }}
                style={{ width: "100%", height: "44px", border: "none", background: isActive ? "rgba(255,255,255,0.1)" : "transparent", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", borderLeft: isActive ? `3px solid ${accent}` : "3px solid transparent" }}>
                <Icon size={20} color={isActive ? "#fff" : "#9ca3af"} />
                {totalBadge && (
                  <span style={{ position: "absolute", top: "6px", right: "6px", width: "16px", height: "16px", background: "#ef4444", borderRadius: "50%", fontSize: "9px", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{totalBadge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: logout */}
        <button title="Sign out" className="crm-nav-item" onClick={d.handleLogout}
          style={{ width: "44px", height: "44px", border: "none", background: "transparent", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LogOut size={18} color="#9ca3af" />
        </button>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div style={{ marginLeft: "64px", flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Top bar */}
        <header style={{ height: "60px", background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", padding: "0 24px", gap: "16px", position: "sticky", top: 0, zIndex: 40 }}>
          {/* Center name */}
          <span style={{ fontWeight: 700, fontSize: "16px", color: "#111827", marginRight: "8px", whiteSpace: "nowrap" }}>{centerName}</span>

          {/* Search */}
          <div style={{ flex: 1, maxWidth: "400px", position: "relative" }}>
            <Search size={16} color="#9ca3af" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search..." style={{ width: "100%", height: "36px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "999px", paddingLeft: "36px", paddingRight: "14px", fontSize: "14px", color: "#111827", outline: "none", fontFamily: "Inter,sans-serif" }}
              onFocus={e => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}20`; }}
              onBlur={e => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; }} />
          </div>

          <div style={{ flex: 1 }} />

          {/* Dark mode toggle */}
          <button className="crm-btn" onClick={() => { d.setIsDarkMode(!d.isDarkMode); d.showToast(d.isDarkMode ? "Light mode" : "Dark mode"); }}
            style={{ width: "36px", height: "36px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {d.isDarkMode ? <Sun size={16} color="#6b7280" /> : <Moon size={16} color="#6b7280" />}
          </button>

          {/* Notifications */}
          <button className="crm-btn" onClick={() => d.notificationsEnabled ? d.disableNotifications() : d.enableNotifications()}
            style={{ width: "36px", height: "36px", border: "1px solid #e5e7eb", borderRadius: "8px", background: d.notificationsEnabled ? `${accent}10` : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <Bell size={16} color={d.notificationsEnabled ? accent : "#6b7280"} />
            {d.notifications.length > 0 && <span style={{ position: "absolute", top: "-3px", right: "-3px", width: "14px", height: "14px", background: "#ef4444", borderRadius: "50%", fontSize: "8px", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{d.notifications.length}</span>}
          </button>

          {/* Settings */}
          <button className="crm-btn" onClick={() => setShowSettingsPanel(true)}
            style={{ width: "36px", height: "36px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Settings size={16} color="#6b7280" />
          </button>

          {/* User avatar */}
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>
            {(d.student.firstName || "S").charAt(0).toUpperCase()}
          </div>
        </header>

        {/* Pending confirmations */}
        {d.pendingConfirmations.length > 0 && (
          <div style={{ padding: "12px 24px 0" }}>
            {d.pendingConfirmations.map(conf => (
              <div key={conf.id} style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "10px", padding: "12px 16px", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>⚠️</span>
                  <div>
                    <p style={{ margin: 0, color: "#92400e", fontSize: "14px", fontWeight: 600 }}>Attendance confirmation needed for "{conf.title}"</p>
                    <p style={{ margin: "2px 0 0", color: "#b45309", fontSize: "12px" }}>Auto-confirms in {d.getTimeRemaining(conf.autoConfirmAt)}</p>
                  </div>
                </div>
                <button className="crm-btn" onClick={() => { d.setSelectedConfirmation(conf); d.setShowConfirmationModal(true); }}
                  style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: "999px", padding: "7px 16px", fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: "13px", whiteSpace: "nowrap" }}>
                  Review
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Sub-navigation pill tabs */}
        {subTabs.length > 0 && (
          <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", display: "flex", gap: "4px", alignItems: "center" }}>
            {subTabs.map(({ key, label }) => {
              const isActive = d.activeTab === key;
              const hw = key === "homework" && d.homeworkPending > 0 ? d.homeworkPending : key === "quiz" && d.quizPending > 0 ? d.quizPending : null;
              return (
                <button key={key} onClick={() => d.setActiveTab(key)}
                  className={`crm-pill ${isActive ? "crm-pill-active" : ""}`}
                  style={{ padding: "10px 18px", border: "none", borderRadius: "999px", cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: "14px", fontWeight: 500, background: "transparent", color: "#6b7280", display: "flex", alignItems: "center", gap: "6px", margin: "6px 0", transition: "all 0.15s" }}>
                  {label}
                  {hw && <span style={{ background: "#ef4444", color: "#fff", borderRadius: "999px", padding: "1px 7px", fontSize: "11px", fontWeight: 700 }}>{hw}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <main style={{ flex: 1, padding: "24px" }}>

          {/* ══ DASHBOARD ══ */}
          {d.activeTab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Welcome bar */}
              <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#6b7280", fontWeight: 500, textTransform: "uppercase", letterSpacing: ".06em" }}>Welcome back</p>
                  <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700, color: "#111827" }}>{d.student.name || d.student.firstName}</h1>
                  <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>You have <strong style={{ color: accent }}>{d.progress.classesRemaining}</strong> classes remaining.</p>
                </div>
                <button className="crm-btn" onClick={() => d.setActiveTab("completed-classes")}
                  style={{ background: accent, color: "#fff", border: "none", borderRadius: "999px", padding: "10px 22px", fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  View Classes <ChevronRight size={16} />
                </button>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "12px" }}>
                {[
                  { Icon: CheckSquare, label: "Completed",  value: d.progress.completedLessons, color: "#059669", bg: "#f0fdf4" },
                  { Icon: Clock,       label: "Remaining",  value: d.progress.classesRemaining,  color: "#2563eb", bg: "#eff6ff" },
                  { Icon: Flame,       label: "Day Streak", value: d.progress.streakDays,        color: "#ea580c", bg: "#fff7ed" },
                  { Icon: Star,        label: "This Week",  value: d.progress.weeklyCompleted,   color: "#7c3aed", bg: "#f5f3ff" },
                ].map(({ Icon, label, value, color, bg }) => (
                  <div key={label} className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                      <Icon size={20} color={color} />
                    </div>
                    <div style={{ fontSize: "28px", fontWeight: 700, color: "#111827", marginBottom: "2px" }}>{value}</div>
                    <div style={{ fontSize: "13px", color: "#6b7280" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Active + sidebar */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Live classes */}
                  <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                      <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" }}>Live & Starting Soon</h2>
                      {d.activeClasses.length > 0 && <span style={{ background: "#fee2e2", color: "#dc2626", borderRadius: "999px", padding: "2px 10px", fontSize: "12px", fontWeight: 600 }}>{d.activeClasses.length} active</span>}
                    </div>
                    <ActiveClasses activeClasses={d.activeClasses} onJoin={d.handleJoinClass} />
                  </div>

                  {/* Upcoming */}
                  <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                    <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>Upcoming Classes</h2>
                    <UpcomingClasses upcomingClasses={d.upcomingClasses} onEnroll={() => d.showToast("Coming soon!")} />
                  </div>
                </div>

                {/* Right column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Progress */}
                  <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                    <h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 700, color: "#111827" }}>My Progress</h2>
                    <ProgressCard progress={d.progress} />
                  </div>

                  {/* Streak */}
                  <StreakWidget isDarkMode={false} onLoad={d.handleStreakLoaded} />

                  {/* Recent badges */}
                  <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#111827" }}>My Badges</h2>
                      <button className="crm-btn" onClick={() => d.setActiveTab("badges")} style={{ background: "transparent", border: "none", color: accent, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: "13px" }}>See all</button>
                    </div>
                    {d.badges.length === 0 ? (
                      <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Complete classes to earn badges.</p>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {d.badges.slice(-4).map(b => (
                          <div key={b.id} title={b.name} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "32px" }}>{b.icon}</div>
                            <p style={{ margin: "3px 0 0", fontSize: "10px", color: "#6b7280", maxWidth: "52px" }}>{b.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notifications */}
                  <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                    <h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 700, color: "#111827" }}>Notifications</h2>
                    <NotificationsCard notifications={d.notifications} onClearAll={() => d.setNotifications([])} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ HOMEWORK ══ */}
          {d.activeTab === "homework" && (
            <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
              <StudentHomeworkTab studentInfo={d.student} isDarkMode={false} />
            </div>
          )}

          {/* ══ QUIZ ══ */}
          {d.activeTab === "quiz" && (
            <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
              <StudentQuizTab studentInfo={d.student} isDarkMode={false} />
            </div>
          )}

          {/* ══ FLASHCARDS ══ */}
          {d.activeTab === "flashcards" && <FlashcardsTab isDarkMode={false} />}

          {/* ══ PRONUNCIATION ══ */}
          {d.activeTab === "pronunciation" && (
            <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
              <PronunciationTab isDarkMode={false} />
            </div>
          )}

          {/* ══ CONVERSATION ══ */}
          {d.activeTab === "conversation" && (
            <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
              <ConversationTab studentInfo={d.student} isDarkMode={false} />
            </div>
          )}

          {/* ══ MESSAGES ══ */}
          {d.activeTab === "messages" && (
            <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
              <MessagesTab userRole="student" />
            </div>
          )}

          {/* ══ COMPLETED CLASSES ══ */}
          {d.activeTab === "completed-classes" && (
            <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 700, color: "#111827" }}>Completed Classes</h2>
              <StudentCompletedTab studentId={d.student.id} isDarkMode={false} />
            </div>
          )}

          {/* ══ SCHEDULE ══ */}
          {d.activeTab === "schedule" && (
            <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
              <StudentScheduleTab studentId={d.student.id} isDarkMode={false} />
            </div>
          )}

          {/* ══ CHARTS ══ */}
          {d.activeTab === "charts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
                {[
                  { label: "Total Classes", value: d.completedClasses.length, color: "#ea580c" },
                  { label: "Day Streak",    value: d.progress.streakDays,     color: "#db2777" },
                  { label: "Total Hours",   value: d.completedClasses.length > 0 ? Math.round(d.completedClasses.reduce((s, c) => s + c.duration, 0) / 60) : 0, color: "#7c3aed" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                    <div style={{ fontSize: "30px", fontWeight: 700, color, marginBottom: "4px" }}>{value}</div>
                    <div style={{ fontSize: "13px", color: "#6b7280" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              {[{ title: "Last 7 Days", data: d.chartData.last7, type: "bar" }, { title: "Last 30 Days", data: d.chartData.last30, type: "line" }].map(({ title, data, type }) => (
                <div key={title} className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 700, color: "#111827" }}>{title}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    {type === "bar" ? (
                      <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" /><XAxis dataKey="date" stroke="#9ca3af" style={{ fontFamily: "Inter,sans-serif", fontSize: 11 }} /><YAxis stroke="#9ca3af" style={{ fontFamily: "Inter,sans-serif", fontSize: 11 }} /><RechartsTooltip contentStyle={tooltipStyle} /><Bar dataKey="classes" fill={accent} radius={[6, 6, 0, 0]} name="Classes" /></BarChart>
                    ) : (
                      <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" /><XAxis dataKey="date" stroke="#9ca3af" style={{ fontFamily: "Inter,sans-serif", fontSize: 11 }} /><YAxis stroke="#9ca3af" style={{ fontFamily: "Inter,sans-serif", fontSize: 11 }} /><RechartsTooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="classes" stroke={accent} strokeWidth={2} dot={{ fill: accent, r: 4 }} name="Classes" /></LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              ))}

              {/* Pie */}
              <div className="crm-card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 700, color: "#111827" }}>Classes by Time of Day</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart><Pie data={d.chartData.timeDist} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>{d.chartData.timeDist.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><RechartsTooltip contentStyle={tooltipStyle} /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ══ BADGES ══ */}
          {d.activeTab === "badges" && (
            <CRMBadgesPanel badges={d.badges} progress={d.progress} completedClasses={d.completedClasses} accent={accent} shareAchievement={d.shareAchievement} />
          )}

          {/* ══ RECORDINGS ══ */}
          {d.activeTab === "recordings" && <RecordingsTab isDarkMode={false} />}

          {/* ══ REVIEWS ══ */}
          {d.activeTab === "reviews" && <ReviewsTab isDarkMode={false} />}

          {/* ══ REFERRAL ══ */}
          {d.activeTab === "referral" && <ReferralTab isDarkMode={false} />}
        </main>
      </div>

      {/* Share modal */}
      {d.showShareModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "28px", maxWidth: "420px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#111827" }}>Share Your Achievement</h3>
              <button className="crm-btn" onClick={() => d.setShowShareModal(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", fontSize: "16px" }}>✕</button>
            </div>
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
              <h4 style={{ margin: "0 0 4px", fontWeight: 700, color: "#111827", fontSize: "15px" }}>{d.shareData?.title}</h4>
              <p style={{ margin: 0, fontSize: "14px", color: "#4b5563" }}>{d.shareData?.message}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button className="crm-btn" onClick={d.copyShareText} style={{ width: "100%", padding: "11px", border: "1px solid #e5e7eb", borderRadius: "999px", background: "transparent", color: "#374151", fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <Copy size={15} /> Copy to Clipboard
              </button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {[["twitter", "Twitter", "#1DA1F2"], ["facebook", "Facebook", "#1877F2"], ["whatsapp", "WhatsApp", "#25D366"], ["linkedin", "LinkedIn", "#0A66C2"]].map(([p, label, bg]) => (
                  <button key={p} className="crm-btn" onClick={() => d.shareOnSocial(p)} style={{ padding: "10px", background: bg, color: "#fff", border: "none", borderRadius: "999px", fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: "13px" }}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {d.showChangePassword && <ChangePassword onClose={() => d.setShowChangePassword(false)} onSuccess={() => { d.setShowChangePassword(false); d.showToast("Password changed!"); }} />}
      {d.showSessionManagement && <SessionManagement isOpen onClose={() => d.setShowSessionManagement(false)} userType="student" />}
      {show2FA && <SettingsModal isOpen onClose={() => setShow2FA(false)} userType="student" />}
      {showSettingsPanel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", maxWidth: "380px", width: "calc(100% - 32px)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#111827" }}>Settings</h3>
              <button onClick={() => setShowSettingsPanel(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { Icon: KeyRound, label: "Change Password", action: () => { setShowSettingsPanel(false); d.setShowChangePassword(true); } },
                { Icon: Layers,   label: "Manage Sessions", action: () => { setShowSettingsPanel(false); d.setShowSessionManagement(true); } },
                { Icon: Shield,   label: "Two-Factor Auth", action: () => { setShowSettingsPanel(false); setShow2FA(true); } },
              ].map(({ Icon, label, action }) => (
                <button key={label} className="crm-btn" onClick={action}
                  style={{ width: "100%", padding: "12px 16px", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#fff", cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: "14px", fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: "12px", textAlign: "left" }}>
                  <Icon size={17} color="#6b7280" /> {label}
                </button>
              ))}
            </div>
            <button className="crm-btn" onClick={d.handleLogout}
              style={{ width: "100%", marginTop: "12px", padding: "12px 16px", border: "1px solid #fca5a5", borderRadius: "10px", background: "#fff", cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: "14px", fontWeight: 500, color: "#dc2626", display: "flex", alignItems: "center", gap: "12px" }}>
              <LogOut size={17} color="#dc2626" /> Sign Out
            </button>
          </div>
        </div>
      )}
      {d.showConfirmationModal && d.selectedConfirmation && (
        <ClassConfirmation booking={d.selectedConfirmation} isDarkMode={false}
          onConfirm={() => { d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); d.showToast("Class confirmed!"); d.fetchStudentData(); }}
          onDispute={() => { d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); d.showToast("Dispute submitted."); d.fetchStudentData(); }}
          onClose={() => { d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); }} />
      )}
    </div>
  );
}
