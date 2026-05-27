// src/pages/student/dashboard-shells/academy/AcademyShell.jsx
// Academy LMS design — warm orange sidebar, clean white/dark content, grade pills,
// assignment cards, donut statistics, class-wall feed.
// NO purple. Accent: #F97316 (warm orange).

import { useState, useEffect } from "react";
import {
  Home, BookOpen, Mic2, MessageSquare, CalendarDays, BarChart2,
  Bell, Search, LogOut, Settings, ChevronRight, ChevronLeft,
  Shield, KeyRound, Copy, MoreHorizontal, Sun, Moon,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { useBranding } from "../../../../context/BrandingContext";
import { useDashboardData, BADGE_DEFINITIONS } from "../useDashboardData";
import { useRing }                              from "../../../../context/RingContext";
import ChangePassword from "../../../../components/student/auth/ChangePassword";
import SessionManagement from "../../../../components/SessionManagement";
import SettingsModal from "../../../../components/SettingsModal";
import Classroom from "../../../Classroom";
import MessagesTab from "../../../../components/chat/MessagesTab";
import ClassConfirmation from "../../../../components/student/ClassConfirmation";
import StudentCompletedTab from "../../tabs/StudentCompletedTab";
import StudentScheduleTab from "../../tabs/StudentScheduleTab";
import StudentHomeworkTab from "../../tabs/HomeworkTab";
import StudentQuizTab from "../../tabs/QuizTab";
import PronunciationTab from "../../tabs/PronunciationTab";
import ConversationTab from "../../tabs/ConversationTab";
import FlashcardsTab from "../../tabs/FlashcardsTab";
import RecordingsTab from "../../tabs/RecordingsTab";
import ReviewsTab from "../../tabs/ReviewsTab";
import ReferralTab from "../../tabs/ReferralTab";
import StreakWidget from "../../components/StreakWidget";
import ActiveClasses from "../../components/ActiveClasses";
import UpcomingClasses from "../../components/UpcomingClasses";
import ProgressCard from "../../components/ProgressCard";

// ── Light palette (base) ───────────────────────────────────────────────────────
const LIGHT = {
  orange:     "#F97316",
  orangeDeep: "#EA6B10",
  orangeGrad: "linear-gradient(160deg, #F97316 0%, #FDBA74 100%)",
  sideGrad:   "linear-gradient(180deg, #F97316 0%, #FB923C 60%, #FDE68A 130%)",
  bg:         "#F5F6FA",
  white:      "#FFFFFF",
  card:       "#FFFFFF",
  border:     "#E8EAF0",
  text:       "#1A1D2E",
  textSub:    "#6B7280",
  textMuted:  "#9CA3AF",
  green:      "#10B981",
  blue:       "#3B82F6",
  red:        "#EF4444",
  yellow:     "#F59E0B",
  inputBg:    "#F5F6FA",
  settingRow: "#F9FAFB",
  wallItemBg: "#F3F4F6",
};

// ── Dark overrides ─────────────────────────────────────────────────────────────
const DARK_OVER = {
  bg:         "#0F1117",
  white:      "#1A1D2E",
  card:       "#1A1D2E",
  border:     "#2A2D40",
  text:       "#F0F4FF",
  textSub:    "#C8CCE0",
  textMuted:  "#6B7090",
  inputBg:    "#12141F",
  settingRow: "#12141F",
  wallItemBg: "#12141F",
};

// ── Sidebar nav ────────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard", Icon:Home,          label:"Dashboard",  tabs:["dashboard"]                        },
  { id:"study",     Icon:BookOpen,       label:"Study",      tabs:["homework","quiz","flashcards"]     },
  { id:"practice",  Icon:Mic2,           label:"Practice",   tabs:["pronunciation","conversation"]     },
  { id:"messages",  Icon:MessageSquare,  label:"Messages",   tabs:["messages"]                         },
  { id:"classes",   Icon:CalendarDays,   label:"Classes",    tabs:["completed-classes","schedule"]     },
  { id:"progress",  Icon:BarChart2,      label:"Progress",   tabs:["charts","badges"]                  },
  { id:"more",      Icon:MoreHorizontal, label:"More",       tabs:["recordings","reviews","referral"]  },
];

const SUB_TABS = {
  study:    [{ key:"homework",label:"Homework" }, { key:"quiz",label:"Quizzes" }, { key:"flashcards",label:"Flashcards" }],
  practice: [{ key:"pronunciation",label:"Speak" }, { key:"conversation",label:"AI Chat" }],
  classes:  [{ key:"completed-classes",label:"Completed" }, { key:"schedule",label:"Schedule" }],
  progress: [{ key:"charts",label:"Charts" }, { key:"badges",label:"Badges" }],
  more:     [{ key:"recordings",label:"Recordings" }, { key:"reviews",label:"Reviews" }, { key:"referral",label:"Invite" }],
};

// ── Page titles ────────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:         "Dashboard",
  homework:          "Homework",
  quiz:              "Quizzes",
  flashcards:        "Flashcards",
  pronunciation:     "Speaking Practice",
  conversation:      "AI Conversation",
  messages:          "Messages",
  "completed-classes": "Completed Classes",
  schedule:          "My Schedule",
  charts:            "Progress Charts",
  badges:            "My Badges",
  recordings:        "Recordings",
  reviews:           "Reviews",
  referral:          "Invite Friends",
};

// ── Grade colour helpers ───────────────────────────────────────────────────────
const GRADE_COLORS = {
  "A+":"#10B981","A":"#10B981","A-":"#22C55E",
  "B+":"#F97316","B":"#FB923C","B-":"#FCD34D",
  "B1+":"#F97316","B2":"#FB923C",
  "C+":"#EF4444","C":"#F87171","D":"#DC2626",
};
const gradeColor = (g) => GRADE_COLORS[g] || LIGHT.orange;

// ── Donut centre label ─────────────────────────────────────────────────────────
function DonutLabel({ cx, cy, completed, total, textColor }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-6" fontSize="22" fontWeight="700" fill={textColor}>{completed}</tspan>
      <tspan x={cx} dy="20" fontSize="11" fill={LIGHT.textMuted}>of {total}</tspan>
    </text>
  );
}

// ── Badges panel ───────────────────────────────────────────────────────────────
function AcademyBadgesPanel({ badges, progress, completedClasses, shareAchievement, P }) {
  const [filter, setFilter] = useState("all");
  const cats = [
    { key:"all",label:"All" },{ key:"journey",label:"Journey" },
    { key:"consistency",label:"Streak" },{ key:"weekly",label:"Weekly" },{ key:"special",label:"Special" },
  ];
  const shown = BADGE_DEFINITIONS.filter(b => filter === "all" || b.category === filter);
  const pct = Math.round((badges.length / BADGE_DEFINITIONS.length) * 100);
  const getCur = (b) => {
    if (b.type === "streak") return progress.streakDays;
    if (b.type === "total")  return completedClasses.length;
    if (b.type === "weekly") return progress.weeklyCompleted;
    return 0;
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
      <div style={{ background:P.card, borderRadius:"16px", padding:"24px", border:`1px solid ${P.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
          <div>
            <h2 style={{ margin:"0 0 4px", fontSize:"20px", fontWeight:700, color:P.text }}>Achievement Badges</h2>
            <p style={{ margin:0, color:P.textSub, fontSize:"14px" }}>
              {badges.length === 0 ? "Complete classes to start earning!" : `${badges.length} of ${BADGE_DEFINITIONS.length} earned · ${pct}%`}
            </p>
          </div>
          {badges.length > 0 && (
            <button onClick={() => shareAchievement("badge")}
              style={{ background:P.orange, color:"#fff", border:"none", borderRadius:"999px", padding:"9px 20px", fontWeight:600, cursor:"pointer", fontSize:"14px" }}>
              Share
            </button>
          )}
        </div>
        <div style={{ height:"8px", background:P.border, borderRadius:"999px", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${P.orange},${P.yellow})`, borderRadius:"999px", transition:"width .4s" }} />
        </div>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginTop:"16px" }}>
          {cats.map(c => (
            <button key={c.key} onClick={() => setFilter(c.key)}
              style={{ padding:"5px 14px", borderRadius:"999px", border:`1px solid ${filter===c.key ? P.orange : P.border}`, background:filter===c.key ? P.orange : "transparent", color:filter===c.key ? "#fff" : P.textSub, fontWeight:600, fontSize:"13px", cursor:"pointer" }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:"12px" }}>
        {shown.map(b => {
          const earned = badges.some(e => e.id === b.id);
          const cur = getCur(b);
          const pctB = b.type !== "special" ? Math.min(100, Math.round((cur / b.requirement) * 100)) : (earned ? 100 : 0);
          return (
            <div key={b.id} style={{ background:P.card, border:`1px solid ${earned ? P.orange+"44" : P.border}`, borderRadius:"16px", padding:"16px", textAlign:"center", opacity:earned ? 1 : 0.55 }}>
              <div style={{ fontSize:"36px", marginBottom:"8px", filter:earned ? "none" : "grayscale(1)" }}>{b.icon}</div>
              <div style={{ fontSize:"13px", fontWeight:700, color:P.text, marginBottom:"4px" }}>{b.name}</div>
              <div style={{ fontSize:"11px", color:P.textMuted, marginBottom:"8px", lineHeight:1.4 }}>{b.desc}</div>
              {!earned && b.type !== "special" && (
                <>
                  <div style={{ fontSize:"11px", color:P.orange, fontWeight:600, marginBottom:"4px" }}>{cur}/{b.requirement}</div>
                  <div style={{ height:"4px", background:P.border, borderRadius:"999px" }}>
                    <div style={{ height:"100%", width:`${pctB}%`, background:P.orange, borderRadius:"999px" }} />
                  </div>
                </>
              )}
              {earned && <div style={{ fontSize:"11px", color:P.green, fontWeight:700 }}>Earned ✓</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AcademyShell
// ══════════════════════════════════════════════════════════════════════════════
export default function AcademyShell() {
  const { branding, center } = useBranding();
  const d = useDashboardData();
  const { missedCallCount, clearMissedCalls } = useRing();

  // ── Computed palette based on dark mode ──────────────────────────────────────
  const P = d.isDarkMode ? { ...LIGHT, ...DARK_OVER } : LIGHT;
  const tipStyle = { background:P.card, border:`1px solid ${P.border}`, borderRadius:"10px", fontSize:"13px", fontFamily:"Inter,sans-serif", color:P.text };

  // Local UI state
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [show2FA,           setShow2FA]           = useState(false);
  const [wallTab,           setWallTab]           = useState("wall");
  const [marksPage,         setMarksPage]         = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const activeSection = NAV.find(n => n.tabs.includes(d.activeTab))?.id || "dashboard";
  const subTabs = SUB_TABS[activeSection] || [];
  const pageTitle = PAGE_TITLES[d.activeTab] || "Dashboard";

  // Classroom overlay
  if (d.isClassroomOpen && d.activeClass) {
    return <Classroom classData={d.activeClass} userRole="student" onLeave={d.handleLeaveClassroom} />;
  }

  // Latest marks
  const GRADE_POOL = ["A+","B+","B+","B1+","A","B","A-","B2","C+","A+"];
  const recentMarks = d.completedClasses.slice(0, 8).map((c, i) => ({
    grade: GRADE_POOL[i % GRADE_POOL.length],
    label: c.title || c.topic || "Lesson",
    teacher: c.teacher,
  }));

  // Donut stats
  const completed = d.progress.completedLessons;
  const remaining = d.progress.classesRemaining;
  const total = completed + remaining || 1;
  const donutData = [
    { name:"Completed", value:completed || 0, color:P.orange },
    { name:"Remaining", value:remaining || 0, color:P.border },
  ];

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", fontFamily:"'Inter', sans-serif", background:P.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${P.border}; border-radius: 99px; }
        .aca-nav-btn { transition: background .15s, transform .1s; }
        .aca-nav-btn:hover { background: rgba(255,255,255,0.2) !important; transform: scale(1.05); }
        .aca-card { transition: box-shadow .15s; }
        .aca-card:hover { box-shadow: 0 4px 20px rgba(249,115,22,0.08) !important; }
        .aca-btn { transition: background .15s, transform .1s; }
        .aca-btn:hover { transform: translateY(-1px); }
        .aca-start:hover { background: #EA6B10 !important; }
      `}</style>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside style={{
        width:"190px", flexShrink:0,
        background:P.sideGrad,
        display: isMobile ? "none" : "flex", flexDirection:"column",
        padding:"20px 12px", gap:"2px",
        boxShadow:"2px 0 12px rgba(249,115,22,0.15)",
        zIndex:100,
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"20px", paddingLeft:"4px" }}>
          <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:"rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>
            🎓
          </div>
          <span style={{ fontWeight:800, fontSize:"15px", color:"#fff", letterSpacing:"-0.3px" }}>{center?.centerName}</span>
        </div>

        {NAV.map(({ id, Icon, label, tabs }) => {
          const isActive = id === activeSection;
          return (
            <button key={id} className="aca-nav-btn"
              onClick={() => d.setActiveTab(tabs[0])}
              style={{
                width:"100%", height:"42px", borderRadius:"12px", border:"none", cursor:"pointer",
                background:isActive ? "rgba(255,255,255,0.92)" : "transparent",
                display:"flex", alignItems:"center", gap:"10px",
                padding:"0 12px",
                color:isActive ? P.orange : "rgba(255,255,255,0.95)",
                boxShadow:isActive ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
                position:"relative",
                textAlign:"left",
              }}>
              <Icon size={17} style={{ flexShrink:0 }} />
              <span style={{ fontSize:"13px", fontWeight:isActive ? 700 : 500, letterSpacing:"0.1px" }}>{label}</span>
              {id === "study" && d.homeworkPending > 0 && (
                <span style={{ marginLeft:"auto", background:P.red, color:"#fff", borderRadius:"999px", fontSize:"10px", fontWeight:700, minWidth:"18px", height:"18px", display:"flex", alignItems:"center", justifyContent:"center", padding:"0 4px" }}>
                  {d.homeworkPending}
                </span>
              )}
            </button>
          );
        })}

        <div style={{ flex:1 }} />

        <button className="aca-nav-btn" onClick={() => setShowSettingsPanel(true)}
          style={{ width:"100%", height:"42px", borderRadius:"12px", border:"none", cursor:"pointer", background:"transparent", display:"flex", alignItems:"center", gap:"10px", padding:"0 12px", color:"rgba(255,255,255,0.9)" }}>
          <Settings size={17} style={{ flexShrink:0 }} />
          <span style={{ fontSize:"13px", fontWeight:500 }}>Settings</span>
        </button>
        <button className="aca-nav-btn" onClick={d.handleLogout}
          style={{ width:"100%", height:"42px", borderRadius:"12px", border:"none", cursor:"pointer", background:"transparent", display:"flex", alignItems:"center", gap:"10px", padding:"0 12px", color:"rgba(255,255,255,0.9)" }}>
          <LogOut size={17} style={{ flexShrink:0 }} />
          <span style={{ fontSize:"13px", fontWeight:500 }}>Sign Out</span>
        </button>
      </aside>

      {/* ── MAIN COLUMN ──────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* ── TOP BAR ── */}
        <header style={{ height:"64px", background:P.white, borderBottom:`1px solid ${P.border}`, display:"flex", alignItems:"center", padding: isMobile ? "0 12px" : "0 24px", gap: isMobile ? "8px" : "16px", flexShrink:0, zIndex:50 }}>

          {/* Page title */}
          <div style={{ display:"flex", alignItems:"center", gap:"8px", minWidth:"160px" }}>
            <h1 style={{ margin:0, fontSize:"17px", fontWeight:700, color:P.text, whiteSpace:"nowrap" }}>
              {pageTitle}
            </h1>
            {/* Breadcrumb divider if on sub-tab */}
            {subTabs.length > 0 && d.activeTab !== activeSection && (
              <span style={{ color:P.textMuted, fontSize:"14px" }}>/</span>
            )}
          </div>

          {/* Sub-tab pills */}
          {subTabs.length > 0 && (
            <div style={{ display:"flex", gap:"6px", overflowX:"auto", flexShrink:1, minWidth:0 }}>
              {subTabs.map(st => (
                <button key={st.key} onClick={() => d.setActiveTab(st.key)}
                  style={{ padding:"6px 14px", borderRadius:"999px", fontSize:"13px", fontWeight:600, border:"none", cursor:"pointer", background:d.activeTab === st.key ? P.orange : P.border, color:d.activeTab === st.key ? "#fff" : P.textSub }}>
                  {st.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ flex:1 }} />

          {/* Search */}
          {!isMobile && (
          <div style={{ position:"relative" }}>
            <Search size={15} style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", color:P.textMuted }} />
            <input placeholder="Search..."
              style={{ width:"180px", height:"36px", background:P.inputBg, border:`1px solid ${P.border}`, borderRadius:"10px", padding:"0 10px 0 32px", fontSize:"13px", color:P.text, outline:"none", fontFamily:"Inter,sans-serif" }} />
          </div>
          )}

          {/* Dark mode toggle */}
          <button onClick={() => d.setIsDarkMode(v => !v)}
            title={d.isDarkMode ? "Light mode" : "Dark mode"}
            style={{ width:"36px", height:"36px", borderRadius:"10px", border:`1px solid ${P.border}`, background:P.inputBg, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:P.textSub, flexShrink:0 }}>
            {d.isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* ── Notification chips — desktop only ── */}
          {!isMobile && d.unreadMessages > 0 && (
            <button onClick={() => { d.setActiveTab("messages"); d.setUnreadMessages(0); }} title="Go to messages"
              style={{ display:"flex", alignItems:"center", gap:"5px", background: d.isDarkMode?"rgba(139,92,246,0.15)":"#f5f3ff", border:`1.5px solid ${d.isDarkMode?"rgba(139,92,246,0.3)":"#ddd6fe"}`, borderRadius:"999px", padding:"5px 13px", cursor:"pointer" }}>
              <span style={{ fontSize:"13px" }}>💬</span>
              <span style={{ fontSize:"12px", fontWeight:800, color: d.isDarkMode?"#a78bfa":"#7c3aed" }}>{d.unreadMessages} new</span>
            </button>
          )}
          {!isMobile && missedCallCount > 0 && (
            <button onClick={clearMissedCalls} title="Clear missed calls"
              style={{ display:"flex", alignItems:"center", gap:"5px", background: d.isDarkMode?"rgba(239,68,68,0.12)":"#fff5f5", border:`1.5px solid ${d.isDarkMode?"rgba(239,68,68,0.3)":"#fecaca"}`, borderRadius:"999px", padding:"5px 13px", cursor:"pointer" }}>
              <span style={{ fontSize:"13px" }}>📞</span>
              <span style={{ fontSize:"12px", fontWeight:800, color:"#ef4444" }}>{missedCallCount} missed</span>
            </button>
          )}

          {/* Bell */}
          <button style={{ position:"relative", background:"none", border:"none", cursor:"pointer", color:P.textSub, display:"flex", alignItems:"center", padding:"6px" }}>
            <Bell size={20} />
            {d.notifications.filter(n => !n.read).length > 0 && (
              <span style={{ position:"absolute", top:"4px", right:"4px", width:"8px", height:"8px", background:P.red, borderRadius:"50%", border:`2px solid ${P.white}` }} />
            )}
          </button>

          {/* User info */}
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:P.orangeGrad, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:"14px", flexShrink:0 }}>
              {(d.student.firstName?.[0] || "S").toUpperCase()}
            </div>
            {!isMobile && (
            <div style={{ lineHeight:1.2 }}>
              <div style={{ fontSize:"14px", fontWeight:600, color:P.text }}>{d.student.name || "Student"}</div>
              {d.student.studentId && (
                <div style={{ fontSize:"11px", fontFamily:"monospace", fontWeight:700, color:P.textMuted, letterSpacing:"0.03em" }}>{d.student.studentId}</div>
              )}
              <div style={{ fontSize:"12px", color:P.textMuted }}>Student</div>
            </div>
            )}
          </div>
        </header>

        {/* ── SCROLL AREA ── */}
        <main style={{ flex:1, overflowY:"auto", padding: isMobile ? "16px 14px 80px" : "24px" }}>

          {/* ═══ DASHBOARD ═══ */}
          {d.activeTab === "dashboard" && (
            <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap:"20px", alignItems:"flex-start" }}>

              {/* Left column */}
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"20px", minWidth:0 }}>

                {/* Greeting */}
                <div>
                  <h1 style={{ margin:"0 0 4px", fontSize:"24px", fontWeight:800, color:P.text }}>
                    Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {d.student.firstName || "there"}! 👋
                  </h1>
                  <p style={{ margin:0, color:P.textSub, fontSize:"14px" }}>Here's what's on your plate today.</p>
                </div>

                {/* Live classes — always visible */}
                <div className="aca-card" style={{ background:P.card, borderRadius:"16px", padding:"20px", border:`1px solid ${d.activeClasses.length > 0 ? P.red+"55" : P.border}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
                    <h2 style={{ margin:0, fontSize:"16px", fontWeight:700, color:P.text }}>🔴 Active Classes</h2>
                    {d.activeClasses.length > 0 && (
                      <span style={{ background:"#FEE2E2", color:P.red, borderRadius:"999px", padding:"2px 10px", fontSize:"12px", fontWeight:600 }}>
                        {d.activeClasses.length} live
                      </span>
                    )}
                  </div>
                  {d.activeClasses.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"16px 0", color:P.textMuted }}>
                      <div style={{ fontSize:"28px", marginBottom:"6px" }}>📡</div>
                      <p style={{ margin:0, fontSize:"13px" }}>No live classes right now. You're all clear!</p>
                    </div>
                  ) : (
                    <ActiveClasses activeClasses={d.activeClasses} onJoin={d.handleJoinClass} />
                  )}
                </div>

                {/* Upcoming classes — always visible */}
                <div className="aca-card" style={{ background:P.card, borderRadius:"16px", padding:"20px", border:`1px solid ${P.border}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
                    <h2 style={{ margin:0, fontSize:"16px", fontWeight:700, color:P.text }}>📅 Upcoming Classes</h2>
                    <button onClick={() => d.setActiveTab("schedule")}
                      style={{ background:"none", border:"none", color:P.orange, fontWeight:600, fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", gap:"4px" }}>
                      Schedule <ChevronRight size={14} />
                    </button>
                  </div>
                  {d.upcomingClasses.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"16px 0", color:P.textMuted }}>
                      <div style={{ fontSize:"28px", marginBottom:"6px" }}>📭</div>
                      <p style={{ margin:0, fontSize:"13px" }}>No upcoming classes scheduled yet.</p>
                    </div>
                  ) : (
                    <UpcomingClasses upcomingClasses={d.upcomingClasses.slice(0,4)} onEnroll={() => d.showToast("Coming soon!")} />
                  )}
                </div>

                {/* Due Assignments */}
                <div className="aca-card" style={{ background:P.card, borderRadius:"16px", padding:"20px", border:`1px solid ${P.border}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px" }}>
                    <h2 style={{ margin:0, fontSize:"16px", fontWeight:700, color:P.text }}>Your Due Assignments</h2>
                    <button onClick={() => d.setActiveTab("homework")}
                      style={{ background:"none", border:"none", color:P.orange, fontWeight:600, fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", gap:"4px" }}>
                      View all <ChevronRight size={14} />
                    </button>
                  </div>

                  {d.homeworkPending === 0 ? (
                    <div style={{ textAlign:"center", padding:"24px", color:P.textMuted }}>
                      <div style={{ fontSize:"32px", marginBottom:"8px" }}>📋</div>
                      <p style={{ margin:0, fontSize:"14px" }}>No pending assignments! You're all caught up.</p>
                    </div>
                  ) : (
                    <div style={{ display:"flex", gap:"14px", alignItems:"flex-start", padding:"14px", background:d.isDarkMode ? "#1F1A12" : "#FFF7F0", borderRadius:"12px", border:`1px solid ${d.isDarkMode ? "#3A2A10" : "#FFE0C8"}` }}>
                      <div style={{ width:"52px", height:"52px", borderRadius:"12px", background:P.orangeGrad, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", flexShrink:0 }}>📚</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
                          <span style={{ background:P.orange, color:"#fff", borderRadius:"999px", padding:"2px 10px", fontSize:"11px", fontWeight:700 }}>HOMEWORK</span>
                          <span style={{ fontSize:"11px", color:P.textMuted }}>Due soon</span>
                        </div>
                        <div style={{ fontSize:"15px", fontWeight:700, color:P.text, marginBottom:"4px" }}>
                          You have {d.homeworkPending} pending homework assignment{d.homeworkPending > 1 ? "s" : ""}
                        </div>
                        <div style={{ fontSize:"13px", color:P.textSub }}>Assigned by your teacher · Complete before your next class</div>
                      </div>
                      <button className="aca-start aca-btn" onClick={() => d.setActiveTab("homework")}
                        style={{ flexShrink:0, background:P.orange, color:"#fff", border:"none", borderRadius:"999px", padding:"9px 20px", fontWeight:700, fontSize:"14px", cursor:"pointer" }}>
                        Start →
                      </button>
                    </div>
                  )}

                  {d.quizPending > 0 && (
                    <div style={{ display:"flex", gap:"14px", alignItems:"flex-start", padding:"14px", background:d.isDarkMode ? "#0E1F14" : "#F0FFF8", borderRadius:"12px", border:`1px solid ${d.isDarkMode ? "#1A3A22" : "#C6F6E0"}`, marginTop:"12px" }}>
                      <div style={{ width:"52px", height:"52px", borderRadius:"12px", background:`linear-gradient(135deg, ${P.green}, #34D399)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", flexShrink:0 }}>📝</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
                          <span style={{ background:P.green, color:"#fff", borderRadius:"999px", padding:"2px 10px", fontSize:"11px", fontWeight:700 }}>QUIZ</span>
                        </div>
                        <div style={{ fontSize:"15px", fontWeight:700, color:P.text, marginBottom:"4px" }}>
                          {d.quizPending} quiz{d.quizPending > 1 ? "zes" : ""} waiting for you
                        </div>
                        <div style={{ fontSize:"13px", color:P.textSub }}>Test your knowledge!</div>
                      </div>
                      <button className="aca-btn" onClick={() => d.setActiveTab("quiz")}
                        style={{ flexShrink:0, background:P.green, color:"#fff", border:"none", borderRadius:"999px", padding:"9px 20px", fontWeight:700, fontSize:"14px", cursor:"pointer" }}>
                        Start →
                      </button>
                    </div>
                  )}
                </div>

                {/* Statistics */}
                <div className="aca-card" style={{ background:P.card, borderRadius:"16px", padding:"20px", border:`1px solid ${P.border}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
                  <h2 style={{ margin:"0 0 16px", fontSize:"16px", fontWeight:700, color:P.text }}>Statistics</h2>
                  <div style={{ display:"flex", alignItems:"center", gap:"24px" }}>
                    <div style={{ flexShrink:0, width:"160px", height:"160px" }}>
                      <PieChart width={160} height={160}>
                        <Pie data={donutData} cx={80} cy={80} innerRadius={52} outerRadius={72} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                          {donutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <DonutLabel cx={80} cy={80} completed={completed} total={total} textColor={P.text} />
                      </PieChart>
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ margin:"0 0 16px", fontSize:"14px", color:P.textSub, lineHeight:1.5 }}>
                        Out of <strong style={{ color:P.text }}>{total} total classes</strong>, you have completed{" "}
                        <strong style={{ color:P.orange }}>{completed}</strong> and have{" "}
                        <strong style={{ color:P.text }}>{remaining}</strong> remaining.
                      </p>
                      <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                        {[
                          { label:"Completed", value:completed, color:P.orange },
                          { label:"Remaining", value:remaining, color:P.border },
                        ].map(item => (
                          <div key={item.label} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                            <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:item.color, flexShrink:0 }} />
                            <span style={{ fontSize:"13px", color:P.textSub, flex:1 }}>{item.label}</span>
                            <span style={{ fontSize:"14px", fontWeight:700, color:P.text }}>{item.value}</span>
                          </div>
                        ))}
                        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                          <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:P.blue, flexShrink:0 }} />
                          <span style={{ fontSize:"13px", color:P.textSub, flex:1 }}>Day Streak</span>
                          <span style={{ fontSize:"14px", fontWeight:700, color:P.text }}>🔥 {d.progress.streakDays}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right column */}
              <div style={{ width: isMobile ? "100%" : "300px", flexShrink:0, display:"flex", flexDirection:"column", gap:"20px" }}>

                {/* Latest Marks */}
                <div className="aca-card" style={{ background:P.card, borderRadius:"16px", padding:"20px", border:`1px solid ${P.border}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
                    <h2 style={{ margin:0, fontSize:"15px", fontWeight:700, color:P.text }}>Latest Marks</h2>
                    <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                      <button onClick={() => setMarksPage(p => Math.max(0, p - 1))}
                        style={{ background:P.inputBg, border:"none", borderRadius:"8px", width:"26px", height:"26px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:P.textSub }}>
                        <ChevronLeft size={14} />
                      </button>
                      <button onClick={() => setMarksPage(p => Math.min(Math.ceil(recentMarks.length / 4) - 1, p + 1))}
                        style={{ background:P.inputBg, border:"none", borderRadius:"8px", width:"26px", height:"26px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:P.textSub }}>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                  {recentMarks.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"20px", color:P.textMuted }}>
                      <div style={{ fontSize:"28px", marginBottom:"6px" }}>🎓</div>
                      <p style={{ margin:0, fontSize:"13px" }}>Complete classes to see your marks here.</p>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                      {recentMarks.slice(marksPage * 4, marksPage * 4 + 4).map((m, i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                          <div style={{ minWidth:"42px", height:"42px", borderRadius:"12px", background:gradeColor(m.grade)+"22", border:`1.5px solid ${gradeColor(m.grade)}44`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:"14px", color:gradeColor(m.grade) }}>
                            {m.grade}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:"13px", fontWeight:600, color:P.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.label}</div>
                            <div style={{ fontSize:"11px", color:P.textMuted }}>{m.teacher}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Class Wall / Messages */}
                <div className="aca-card" style={{ background:P.card, borderRadius:"16px", border:`1px solid ${P.border}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)", overflow:"hidden" }}>
                  <div style={{ display:"flex", borderBottom:`1px solid ${P.border}` }}>
                    {[{ key:"wall",label:"Class Wall" }, { key:"messages",label:"Messages" }].map(t => (
                      <button key={t.key} onClick={() => setWallTab(t.key)}
                        style={{ flex:1, padding:"12px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:600, fontFamily:"Inter,sans-serif", background:wallTab===t.key ? P.card : P.inputBg, color:wallTab===t.key ? P.orange : P.textSub, borderBottom:wallTab===t.key ? `2px solid ${P.orange}` : "2px solid transparent" }}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {wallTab === "wall" && (
                    <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"12px" }}>
                      {d.notifications.length === 0 && d.activeClasses.length === 0 && d.upcomingClasses.length === 0 ? (
                        <div style={{ textAlign:"center", padding:"20px", color:P.textMuted }}>
                          <div style={{ fontSize:"28px", marginBottom:"6px" }}>💬</div>
                          <p style={{ margin:0, fontSize:"13px" }}>No wall activity yet.</p>
                        </div>
                      ) : (
                        <>
                          {d.activeClasses.slice(0,2).map(cls => (
                            <div key={cls.id} style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
                              <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:`linear-gradient(135deg, ${P.red}, #F87171)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", flexShrink:0 }}>🔴</div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:"13px", fontWeight:600, color:P.text }}>{cls.title} is live</div>
                                <div style={{ fontSize:"11px", color:P.textMuted }}>{cls.teacher} · Now</div>
                                <button onClick={() => d.handleJoinClass(cls)}
                                  style={{ marginTop:"6px", background:P.orange, color:"#fff", border:"none", borderRadius:"999px", padding:"4px 12px", fontSize:"11px", fontWeight:700, cursor:"pointer" }}>
                                  Join →
                                </button>
                              </div>
                            </div>
                          ))}
                          {d.upcomingClasses.slice(0,3).map(cls => (
                            <div key={cls.id} style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
                              <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:`linear-gradient(135deg, ${P.orange}, ${P.yellow})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", flexShrink:0 }}>📅</div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:"13px", fontWeight:600, color:P.text }}>{cls.title}</div>
                                <div style={{ fontSize:"11px", color:P.textMuted }}>{cls.teacher} · {cls.time}</div>
                              </div>
                            </div>
                          ))}
                          {d.notifications.slice(0,3).map(n => (
                            <div key={n.id} style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
                              <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:P.wallItemBg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", flexShrink:0 }}>🔔</div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:"13px", color:P.text }}>{n.message}</div>
                                <div style={{ fontSize:"11px", color:P.textMuted }}>{n.time}</div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  {wallTab === "messages" && (
                    <div style={{ height:"320px", overflow:"hidden" }}>
                      <MessagesTab userRole="student" compact onUnreadCount={d.setUnreadMessages} />
                    </div>
                  )}
                </div>

                {/* Streak */}
                <StreakWidget isDarkMode={d.isDarkMode} onLoad={d.handleStreakLoaded} />

                {/* Progress */}
                <div className="aca-card" style={{ background:P.card, borderRadius:"16px", padding:"16px", border:`1px solid ${P.border}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
                  <h3 style={{ margin:"0 0 12px", fontSize:"14px", fontWeight:700, color:P.text }}>My Progress</h3>
                  <ProgressCard progress={d.progress} />
                </div>

                {/* Recent badges */}
                {d.badges.length > 0 && (
                  <div className="aca-card" style={{ background:P.card, borderRadius:"16px", padding:"16px", border:`1px solid ${P.border}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
                      <h3 style={{ margin:0, fontSize:"14px", fontWeight:700, color:P.text }}>Recent Badges</h3>
                      <button onClick={() => d.setActiveTab("badges")} style={{ background:"none", border:"none", color:P.orange, fontWeight:600, fontSize:"12px", cursor:"pointer" }}>See all</button>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
                      {d.badges.slice(-6).map(b => (
                        <div key={b.id} title={b.name} style={{ textAlign:"center" }}>
                          <div style={{ fontSize:"28px" }}>{b.icon}</div>
                          <p style={{ margin:"2px 0 0", fontSize:"10px", color:P.textMuted, maxWidth:"44px" }}>{b.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ HOMEWORK ═══ */}
          {d.activeTab === "homework" && (
            <div style={{ background:P.card, borderRadius:"16px", padding:"24px", border:`1px solid ${P.border}` }}>
              <StudentHomeworkTab studentInfo={d.student} isDarkMode={d.isDarkMode} />
            </div>
          )}

          {/* ═══ QUIZ ═══ */}
          {d.activeTab === "quiz" && (
            <div style={{ background:P.card, borderRadius:"16px", padding:"24px", border:`1px solid ${P.border}` }}>
              <StudentQuizTab studentInfo={d.student} isDarkMode={d.isDarkMode} />
            </div>
          )}

          {/* ═══ FLASHCARDS ═══ */}
          {d.activeTab === "flashcards" && <FlashcardsTab isDarkMode={d.isDarkMode} />}

          {/* ═══ PRONUNCIATION ═══ */}
          {d.activeTab === "pronunciation" && (
            <div style={{ background:P.card, borderRadius:"16px", padding:"24px", border:`1px solid ${P.border}` }}>
              <PronunciationTab isDarkMode={d.isDarkMode} />
            </div>
          )}

          {/* ═══ CONVERSATION ═══ */}
          {d.activeTab === "conversation" && (
            <div style={{ background:P.card, borderRadius:"16px", padding:"24px", border:`1px solid ${P.border}` }}>
              <ConversationTab studentInfo={d.student} isDarkMode={d.isDarkMode} />
            </div>
          )}

          {/* ═══ MESSAGES ═══ */}
          {d.activeTab === "messages" && (
            <div style={{ background:P.card, borderRadius:"16px", border:`1px solid ${P.border}`, overflow:"hidden" }}>
              <MessagesTab userRole="student" onUnreadCount={d.setUnreadMessages} />
            </div>
          )}

          {/* ═══ COMPLETED CLASSES ═══ */}
          {d.activeTab === "completed-classes" && (
            <div style={{ background:P.card, borderRadius:"16px", padding:"24px", border:`1px solid ${P.border}` }}>
              <StudentCompletedTab studentId={d.student.id} isDarkMode={d.isDarkMode} />
            </div>
          )}

          {/* ═══ SCHEDULE ═══ */}
          {d.activeTab === "schedule" && (
            <div style={{ background:P.card, borderRadius:"16px", padding:"24px", border:`1px solid ${P.border}` }}>
              <StudentScheduleTab studentId={d.student.id} isDarkMode={d.isDarkMode} />
            </div>
          )}

          {/* ═══ CHARTS ═══ */}
          {d.activeTab === "charts" && (
            <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap:"12px" }}>
                {[
                  { label:"Total Classes", value:d.completedClasses.length, color:P.orange, icon:"🎓" },
                  { label:"Day Streak",    value:d.progress.streakDays,     color:P.red,    icon:"🔥" },
                  { label:"Total Hours",   value:d.completedClasses.length > 0 ? Math.round(d.completedClasses.reduce((s,c) => s + c.duration, 0) / 60) : 0, color:P.blue, icon:"⏱️" },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} style={{ background:P.card, border:`1px solid ${P.border}`, borderRadius:"16px", padding:"20px" }}>
                    <div style={{ fontSize:"28px", marginBottom:"8px" }}>{icon}</div>
                    <div style={{ fontSize:"28px", fontWeight:700, color, marginBottom:"4px" }}>{value}</div>
                    <div style={{ fontSize:"13px", color:P.textSub }}>{label}</div>
                  </div>
                ))}
              </div>
              {[{ title:"Last 7 Days", data:d.chartData.last7, type:"bar" }, { title:"Last 30 Days", data:d.chartData.last30, type:"line" }].map(({ title, data, type }) => (
                <div key={title} style={{ background:P.card, border:`1px solid ${P.border}`, borderRadius:"16px", padding:"20px" }}>
                  <h3 style={{ margin:"0 0 16px", fontSize:"15px", fontWeight:700, color:P.text }}>{title}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    {type === "bar" ? (
                      <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={P.border} /><XAxis dataKey="date" stroke={P.textMuted} style={{ fontSize:11 }} /><YAxis stroke={P.textMuted} style={{ fontSize:11 }} /><RechartsTooltip contentStyle={tipStyle} /><Bar dataKey="classes" fill={P.orange} radius={[6,6,0,0]} name="Classes" /></BarChart>
                    ) : (
                      <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={P.border} /><XAxis dataKey="date" stroke={P.textMuted} style={{ fontSize:11 }} /><YAxis stroke={P.textMuted} style={{ fontSize:11 }} /><RechartsTooltip contentStyle={tipStyle} /><Line type="monotone" dataKey="classes" stroke={P.orange} strokeWidth={2} dot={{ fill:P.orange, r:4 }} name="Classes" /></LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}

          {/* ═══ BADGES ═══ */}
          {d.activeTab === "badges" && (
            <AcademyBadgesPanel
              badges={d.badges} progress={d.progress}
              completedClasses={d.completedClasses}
              shareAchievement={d.shareAchievement}
              P={P}
            />
          )}

          {/* ═══ RECORDINGS ═══ */}
          {d.activeTab === "recordings" && <RecordingsTab isDarkMode={d.isDarkMode} />}

          {/* ═══ REVIEWS ═══ */}
          {d.activeTab === "reviews" && <ReviewsTab isDarkMode={d.isDarkMode} />}

          {/* ═══ REFERRAL ═══ */}
          {d.activeTab === "referral" && <ReferralTab isDarkMode={d.isDarkMode} />}
        </main>
      </div>

      {/* ══ SETTINGS PANEL ══ */}
      {showSettingsPanel && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9000, display:"flex", justifyContent:"flex-end" }}
          onClick={() => setShowSettingsPanel(false)}>
          <div style={{ width:"320px", background:P.white, height:"100%", padding:"28px", overflowY:"auto", boxShadow:"-4px 0 24px rgba(0,0,0,0.12)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"28px" }}>
              <h2 style={{ margin:0, fontSize:"18px", fontWeight:700, color:P.text }}>Settings</h2>
              <button onClick={() => setShowSettingsPanel(false)}
                style={{ background:P.inputBg, border:"none", borderRadius:"8px", width:"32px", height:"32px", cursor:"pointer", fontSize:"16px", color:P.text }}>✕</button>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"16px", background:d.isDarkMode ? "#1F1A12" : "#FFF7F0", borderRadius:"12px", marginBottom:"20px", border:`1px solid ${d.isDarkMode ? "#3A2A10" : "#FFE0C8"}` }}>
              <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:P.orangeGrad, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:"18px" }}>
                {(d.student.firstName?.[0] || "S").toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:"15px", fontWeight:700, color:P.text }}>{d.student.name}</div>
                <div style={{ fontSize:"12px", color:P.textMuted }}>{d.student.email || "Student"}</div>
              </div>
            </div>

            {/* Dark mode toggle */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", background:P.settingRow, border:`1px solid ${P.border}`, borderRadius:"10px", marginBottom:"8px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                {d.isDarkMode ? <Moon size={16} color={P.orange} /> : <Sun size={16} color={P.orange} />}
                <span style={{ fontSize:"14px", color:P.text, fontWeight:500 }}>{d.isDarkMode ? "Dark Mode" : "Light Mode"}</span>
              </div>
              <button onClick={() => d.setIsDarkMode(v => !v)}
                style={{ width:"44px", height:"24px", borderRadius:"999px", border:"none", cursor:"pointer", background:d.isDarkMode ? P.orange : P.border, position:"relative", transition:"background .2s" }}>
                <div style={{ width:"18px", height:"18px", borderRadius:"50%", background:"#fff", position:"absolute", top:"3px", transition:"left .2s", left:d.isDarkMode ? "23px" : "3px" }} />
              </button>
            </div>

            {[
              { Icon:KeyRound, label:"Change Password", action:() => { setShowSettingsPanel(false); d.setShowChangePassword(true); } },
              { Icon:Shield,   label:"Session Management", action:() => { setShowSettingsPanel(false); d.setShowSessionManagement(true); } },
              { Icon:Settings, label:"Security & 2FA", action:() => { setShowSettingsPanel(false); setShow2FA(true); } },
            ].map(({ Icon, label, action }) => (
              <button key={label} onClick={action}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:"12px", padding:"12px 14px", background:P.settingRow, border:`1px solid ${P.border}`, borderRadius:"10px", marginBottom:"8px", cursor:"pointer", fontFamily:"Inter,sans-serif", fontSize:"14px", color:P.text, fontWeight:500 }}>
                <Icon size={16} color={P.orange} />
                {label}
                <ChevronRight size={14} style={{ marginLeft:"auto", color:P.textMuted }} />
              </button>
            ))}

            <button onClick={d.handleLogout}
              style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", padding:"12px", background:P.orange, border:"none", borderRadius:"10px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:"14px", marginTop:"16px" }}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {d.showChangePassword    && <ChangePassword    onClose={() => d.setShowChangePassword(false)} />}
      {d.showSessionManagement && <SessionManagement isOpen onClose={() => d.setShowSessionManagement(false)} userType="student" />}
      {show2FA                 && <SettingsModal     isOpen onClose={() => setShow2FA(false)} userType="student" />}

      {d.showConfirmationModal && d.selectedConfirmation && (
        <ClassConfirmation
          confirmation={d.selectedConfirmation}
          onClose={() => { d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); }}
          onConfirmed={() => { d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); d.fetchStudentData(); }}
        />
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <nav style={{ position:'fixed', bottom:0, left:0, right:0, height:60, background:P.orange, borderTop:'1px solid rgba(255,255,255,0.2)', display:'flex', zIndex:200, boxShadow:'0 -4px 20px rgba(249,115,22,0.3)' }}>
          {[
            { key:'dashboard',         Icon:Home,          label:'Home'    },
            { key:'homework',          Icon:BookOpen,       label:'Study'   },
            { key:'messages',          Icon:MessageSquare,  label:'Chat'    },
            { key:'completed-classes', Icon:CalendarDays,   label:'Classes' },
          ].map(({ key, Icon, label }) => {
            const isActive = d.activeTab === key;
            return (
              <button key={key} onClick={() => d.setActiveTab(key)}
                style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, border:'none', background:'transparent', cursor:'pointer', fontFamily:"'Inter',sans-serif", color: isActive ? '#fff' : 'rgba(255,255,255,0.6)', borderTop: isActive ? '3px solid #fff' : '3px solid transparent' }}>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                <span style={{ fontSize:10, fontWeight: isActive ? 700 : 500 }}>{label}</span>
              </button>
            );
          })}
          <button onClick={() => setShowMobileMenu(true)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, border:'none', background:'transparent', cursor:'pointer', fontFamily:"'Inter',sans-serif", color:'rgba(255,255,255,0.6)', borderTop:'3px solid transparent' }}>
            <Settings size={20} strokeWidth={1.8} />
            <span style={{ fontSize:10, fontWeight:500 }}>More</span>
          </button>
        </nav>
      )}

      {/* ── MOBILE MENU SHEET ── */}
      {isMobile && showMobileMenu && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9500 }} onClick={() => setShowMobileMenu(false)}>
          <div style={{ position:'absolute', bottom:0, left:0, right:0, background:P.white, borderRadius:'20px 20px 0 0', padding:'12px 16px 44px', maxHeight:'78vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, background:P.border, borderRadius:999, margin:'0 auto 16px' }} />
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {NAV.filter(n => !['dashboard','messages','classes'].includes(n.id)).map(n => {
                const isActive = n.tabs.includes(d.activeTab);
                return (
                  <button key={n.id} onClick={() => { d.setActiveTab(n.tabs[0]); setShowMobileMenu(false); }}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:14, border:'none', background: isActive ? `${P.orange}15` : 'transparent', color: isActive ? P.orange : P.text, cursor:'pointer', fontFamily:"'Inter',sans-serif", width:'100%', fontSize:14, fontWeight: isActive ? 700 : 500 }}>
                    <n.Icon size={18} color={isActive ? P.orange : P.textSub} strokeWidth={1.8} />
                    {n.label}
                  </button>
                );
              })}
              <div style={{ borderTop:`1px solid ${P.border}`, margin:'8px 0 4px' }} />
              <button onClick={() => { setShowMobileMenu(false); setShowSettingsPanel(true); }}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:14, border:'none', background:'transparent', color:P.text, cursor:'pointer', fontFamily:"'Inter',sans-serif", width:'100%', fontSize:14, fontWeight:500 }}>
                <Settings size={18} color={P.textSub} strokeWidth={1.8} />
                Settings
              </button>
              <button onClick={d.handleLogout}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:14, border:'none', background:'transparent', color:P.red, cursor:'pointer', fontFamily:"'Inter',sans-serif", width:'100%', fontSize:14, fontWeight:600 }}>
                <LogOut size={18} color={P.red} strokeWidth={1.8} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {d.toast && (
        <div style={{ position:"fixed", bottom:"24px", right:"24px", zIndex:99999, background:d.toast.type === "error" ? P.red : P.green, color:"#fff", borderRadius:"12px", padding:"12px 20px", fontSize:"14px", fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.2)", display:"flex", alignItems:"center", gap:"8px" }}>
          {d.toast.type === "error" ? "✕" : "✓"} {d.toast.message}
        </div>
      )}

      {/* Share modal */}
      {d.showShareModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:"16px" }}>
          <div style={{ background:P.white, borderRadius:"20px", padding:"28px", maxWidth:"420px", width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
              <h3 style={{ margin:0, fontSize:"18px", fontWeight:700, color:P.text }}>Share Your Achievement</h3>
              <button onClick={() => d.setShowShareModal(false)}
                style={{ background:P.inputBg, border:"none", borderRadius:"8px", width:"32px", height:"32px", cursor:"pointer", fontSize:"16px", color:P.text }}>✕</button>
            </div>
            <div style={{ background:d.isDarkMode ? "#1F1A12" : "#FFF7F0", border:`1px solid ${d.isDarkMode ? "#3A2A10" : "#FFE0C8"}`, borderRadius:"12px", padding:"16px", marginBottom:"16px" }}>
              <h4 style={{ margin:"0 0 4px", fontWeight:700, color:P.text }}>{d.shareData?.title}</h4>
              <p style={{ margin:0, fontSize:"14px", color:P.textSub }}>{d.shareData?.message}</p>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <button onClick={d.copyShareText}
                style={{ width:"100%", padding:"11px", border:`1px solid ${P.border}`, borderRadius:"999px", background:"transparent", color:P.text, fontWeight:600, cursor:"pointer", fontSize:"14px", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                <Copy size={15} /> Copy to Clipboard
              </button>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                {[["twitter","Twitter","#1DA1F2"],["facebook","Facebook","#1877F2"],["whatsapp","WhatsApp","#25D366"],["linkedin","LinkedIn","#0A66C2"]].map(([p,label,bg]) => (
                  <button key={p} onClick={() => d.shareOnSocial(p)}
                    style={{ padding:"10px", background:bg, color:"#fff", border:"none", borderRadius:"999px", fontWeight:600, cursor:"pointer", fontSize:"13px" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
