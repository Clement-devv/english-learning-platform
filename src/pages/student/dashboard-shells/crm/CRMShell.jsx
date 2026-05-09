// src/pages/student/dashboard-shells/crm/CRMShell.jsx
// "Island Academy" — floating island subject cards, circular progress donut,
// soft green/teal sidebar, illustrated feel. Inspired by kids-friendly LMS UIs.

import { useState, useEffect } from "react";
import Confetti from "react-confetti";
import {
  Home, BookOpen, Mic2, MessageSquare, CalendarDays, BarChart2,
  Bell, LogOut, Settings, Star, ChevronRight, Shield, KeyRound,
  Sun, Moon, Gift, Video, Brain, Flame, CheckSquare, Clock,
} from "lucide-react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import Classroom from "../../../Classroom";
import MessagesTab from "../../../../components/chat/MessagesTab";
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
import ActiveClasses       from "../../components/ActiveClasses";
import UpcomingClasses     from "../../components/UpcomingClasses";
import ChangePassword      from "../../../../components/student/auth/ChangePassword";
import SessionManagement   from "../../../../components/SessionManagement";
import SettingsModal       from "../../../../components/SettingsModal";
import { useBranding }     from "../../../../context/BrandingContext";
import { useDashboardData, BADGE_DEFINITIONS } from "../useDashboardData";

// ── Palette ────────────────────────────────────────────────────────────────────
const LIGHT = {
  bg:         "#F0FBF4",
  card:       "#FFFFFF",
  cardAlt:    "#F6FDF9",
  border:     "#D1EDD9",
  text:       "#1A3328",
  textSub:    "#4A7A5E",
  textMuted:  "#7FAF90",
  inputBg:    "#F0FBF4",
};
const DARK_OVER = {
  bg:         "#0C1810",
  card:       "#132518",
  cardAlt:    "#182E1E",
  border:     "#1E4030",
  text:       "#E0F5E9",
  textSub:    "#7ECFA0",
  textMuted:  "#3D7A58",
  inputBg:    "#132518",
};
// accent colours never change with dark mode
const ACC = {
  green:  "#22C55E",
  teal:   "#0D9488",
  orange: "#F97316",
  purple: "#8B5CF6",
  pink:   "#EC4899",
  yellow: "#EAB308",
  red:    "#EF4444",
  sky:    "#38BDF8",
  sidebar:"#1A7A4A",
};

// ── Subject island tiles ───────────────────────────────────────────────────────
const ISLANDS = [
  { key:"homework",      label:"Homework",   emoji:"📚", grad:["#22C55E","#16A34A"], tab:"homework"      },
  { key:"quiz",          label:"Quizzes",    emoji:"🧠", grad:["#6366F1","#8B5CF6"], tab:"quiz"          },
  { key:"flashcards",    label:"Flashcards", emoji:"🗂️", grad:["#F59E0B","#D97706"], tab:"flashcards"    },
  { key:"pronunciation", label:"Speaking",   emoji:"🎤", grad:["#EC4899","#DB2777"], tab:"pronunciation" },
  { key:"conversation",  label:"AI Chat",    emoji:"🤖", grad:["#0EA5E9","#0284C7"], tab:"conversation"  },
  { key:"recordings",    label:"Recordings", emoji:"🎬", grad:["#F97316","#EA580C"], tab:"recordings"    },
];

// ── Grouped sidebar nav (same pattern as SunshineShell) ───────────────────────
const NAV_GROUPS = [
  {
    label: null,
    items: [{ key:"dashboard", Icon:Home, label:"Home" }],
  },
  {
    label: "Learning",
    items: [
      { key:"homework",   Icon:BookOpen, label:"Homework"   },
      { key:"quiz",       Icon:Brain,    label:"Quizzes"    },
      { key:"flashcards", Icon:BookOpen, label:"Flashcards" },
    ],
  },
  {
    label: "Practice",
    items: [
      { key:"pronunciation", Icon:Mic2,          label:"Speaking" },
      { key:"conversation",  Icon:MessageSquare, label:"AI Chat"  },
    ],
  },
  {
    label: "Classes",
    items: [
      { key:"messages",          Icon:MessageSquare, label:"Messages"  },
      { key:"completed-classes", Icon:CheckSquare,   label:"Completed" },
      { key:"schedule",          Icon:CalendarDays,  label:"Schedule"  },
    ],
  },
  {
    label: "Progress",
    items: [
      { key:"charts", Icon:BarChart2, label:"Progress" },
      { key:"badges", Icon:Star,      label:"Badges"   },
    ],
  },
  {
    label: "More",
    items: [
      { key:"recordings", Icon:Video,         label:"Recordings" },
      { key:"reviews",    Icon:Star,          label:"Reviews"    },
      { key:"referral",   Icon:Gift,          label:"Invite"     },
    ],
  },
];

const PAGE_TITLES = {
  dashboard:"Home", homework:"Homework", quiz:"Quizzes",
  flashcards:"Flashcards", pronunciation:"Speaking", conversation:"AI Chat",
  messages:"Messages", "completed-classes":"Completed Classes",
  schedule:"Schedule", charts:"Progress", badges:"Badges",
  recordings:"Recordings", reviews:"Reviews", referral:"Invite Friends",
};

// ── Floating island SVG card ───────────────────────────────────────────────────
function IslandCard({ island, pending, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: `linear-gradient(145deg,${island.grad[0]},${island.grad[1]})`,
        border: "none", borderRadius: "24px", padding: "20px 14px 14px",
        cursor: "pointer", textAlign: "center", position: "relative",
        transform: hover ? "translateY(-6px) scale(1.03)" : "translateY(0) scale(1)",
        transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s",
        boxShadow: hover
          ? `0 20px 40px ${island.grad[0]}55`
          : `0 8px 20px ${island.grad[0]}30`,
        minWidth: 0,
      }}
    >
      {/* floating island platform */}
      <div style={{
        width: "72px", height: "72px", borderRadius: "50%",
        background: "rgba(255,255,255,0.25)", margin: "0 auto 10px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "34px", backdropFilter: "blur(4px)",
        border: "3px solid rgba(255,255,255,0.35)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12) inset",
      }}>
        {island.emoji}
      </div>
      {/* shadow under island */}
      <div style={{
        width: "56px", height: "10px", background: "rgba(0,0,0,0.12)",
        borderRadius: "50%", margin: "-6px auto 8px", filter: "blur(4px)",
      }} />
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", letterSpacing: ".01em" }}>
        {island.label}
      </div>
      {pending > 0 && (
        <span style={{
          position: "absolute", top: "10px", right: "10px",
          background: "#fff", color: island.grad[0],
          borderRadius: "999px", fontSize: "11px", fontWeight: 900,
          padding: "2px 8px", minWidth: "22px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        }}>
          {pending}
        </span>
      )}
    </button>
  );
}

// ── Badges tab (receives P palette) ──────────────────────────────────────────
function BadgesTab({ badges, progress, completedClasses, shareAchievement, P }) {
  const [filter, setFilter] = useState("all");
  const cats = [
    {key:"all",label:"All"},{key:"journey",label:"Journey"},
    {key:"consistency",label:"Consistency"},{key:"weekly",label:"Weekly"},{key:"special",label:"Special"},
  ];
  const shown  = BADGE_DEFINITIONS.filter(b => filter==="all" || b.category===filter);
  const pct    = Math.round((badges.length/BADGE_DEFINITIONS.length)*100);
  const nextUp = BADGE_DEFINITIONS.filter(b => !badges.some(e=>e.id===b.id) && b.type!=="special").slice(0,3);
  const getCur = b => b.type==="streak"?progress.streakDays:b.type==="total"?completedClasses.length:b.type==="weekly"?progress.weeklyCompleted:0;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
      <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:"20px",padding:"24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
          <div>
            <h2 style={{margin:"0 0 4px",fontSize:"20px",fontWeight:800,color:P.text}}>🏅 Achievement Badges</h2>
            <p style={{margin:0,color:P.textMuted,fontSize:"14px"}}>{badges.length===0?"Complete classes to start earning!":`${badges.length} of ${BADGE_DEFINITIONS.length} earned · ${pct}%`}</p>
          </div>
          {badges.length>0&&<button onClick={()=>shareAchievement("badge")} style={{background:`linear-gradient(135deg,${ACC.green},${ACC.teal})`,color:"#fff",border:"none",borderRadius:"999px",padding:"9px 20px",fontWeight:700,cursor:"pointer",fontSize:"14px"}}>Share All</button>}
        </div>
        <div style={{background:P.border,borderRadius:"999px",height:"8px",overflow:"hidden",marginBottom:"16px"}}>
          <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${ACC.green},${ACC.teal})`,borderRadius:"999px",transition:"width 1s ease"}}/>
        </div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {cats.map(c=>(
            <button key={c.key} onClick={()=>setFilter(c.key)} style={{padding:"6px 16px",borderRadius:"999px",border:"none",cursor:"pointer",fontSize:"13px",fontWeight:600,background:filter===c.key?`linear-gradient(135deg,${ACC.green},${ACC.teal})`:P.cardAlt,color:filter===c.key?"#fff":P.textSub}}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:"14px"}}>
        {shown.map(badge=>{
          const earned=badges.some(b=>b.id===badge.id);
          const cur=getCur(badge);
          const bp=badge.type==="special"?(earned?100:0):Math.min((cur/badge.requirement)*100,100);
          return(
            <div key={badge.id} style={{background:earned?`linear-gradient(145deg,${badge.grad[0]}18,${badge.grad[1]}10)`:P.cardAlt,border:`1px solid ${earned?badge.grad[0]+"40":P.border}`,borderRadius:"16px",padding:"18px 14px 14px",textAlign:"center",opacity:earned?1:0.5,transition:"all 0.2s"}}>
              <div style={{fontSize:"40px",marginBottom:"8px"}}>{badge.icon}</div>
              <h3 style={{margin:"0 0 4px",fontSize:"13px",fontWeight:700,color:P.text}}>{badge.name}</h3>
              <p style={{margin:"0 0 10px",fontSize:"11px",color:P.textMuted,lineHeight:1.4}}>{badge.desc}</p>
              {!earned&&badge.type!=="special"&&(
                <div style={{marginBottom:"8px"}}>
                  <div style={{background:P.border,borderRadius:"999px",height:"5px",overflow:"hidden"}}>
                    <div style={{width:`${bp}%`,height:"100%",background:`linear-gradient(90deg,${badge.grad[0]},${badge.grad[1]})`}}/>
                  </div>
                  <p style={{margin:"4px 0 0",fontSize:"11px",color:P.textMuted}}>{cur}/{badge.requirement}</p>
                </div>
              )}
              <span style={{display:"inline-block",padding:"3px 12px",borderRadius:"999px",fontSize:"11px",fontWeight:700,background:earned?`${badge.grad[0]}25`:P.border,color:earned?badge.grad[0]:P.textMuted}}>
                {earned?"✓ Earned":"🔒 Locked"}
              </span>
            </div>
          );
        })}
      </div>
      {nextUp.length>0&&(
        <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:"20px",padding:"24px"}}>
          <h3 style={{margin:"0 0 16px",fontSize:"18px",fontWeight:800,color:P.text}}>🎯 Almost There!</h3>
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            {nextUp.map(badge=>{
              const cur=getCur(badge);
              const p=Math.min((cur/badge.requirement)*100,100);
              return(
                <div key={badge.id} style={{display:"flex",alignItems:"center",gap:"14px",padding:"14px",border:`1px solid ${P.border}`,borderRadius:"14px",background:P.cardAlt}}>
                  <span style={{fontSize:"32px"}}>{badge.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                      <span style={{fontWeight:700,color:P.text,fontSize:"14px"}}>{badge.name}</span>
                      <span style={{fontSize:"13px",color:P.textMuted}}>{cur}/{badge.requirement}</span>
                    </div>
                    <div style={{background:P.border,borderRadius:"999px",height:"6px",overflow:"hidden"}}>
                      <div style={{width:`${p}%`,height:"100%",background:`linear-gradient(90deg,${badge.grad[0]},${badge.grad[1]})`}}/>
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

// ══════════════════════════════════════════════════════════════════════════════
// Main Shell
// ══════════════════════════════════════════════════════════════════════════════
export default function CRMShell() {
  const { branding, center } = useBranding();
  const d = useDashboardData();
  const [showSettings, setShowSettings] = useState(false);
  const [show2FA,       setShow2FA]       = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const F = "'Nunito',sans-serif";

  // Dynamic palette — switches on d.isDarkMode
  const P = { ...LIGHT, ...(d.isDarkMode ? DARK_OVER : {}) };

  const tooltipStyle = {
    backgroundColor: P.card, border: `1px solid ${P.border}`,
    color: P.text, borderRadius: "10px", fontFamily: F, fontSize: "12px",
  };

  if (d.loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:P.bg, fontFamily:F }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap'); @keyframes bounce{to{transform:translateY(-14px)}}`}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"60px", animation:"bounce 0.7s infinite alternate" }}>🌿</div>
        <p style={{ color:ACC.green, fontWeight:800, fontSize:"17px", marginTop:"14px" }}>Loading your academy...</p>
      </div>
    </div>
  );

  if (d.isClassroomOpen && d.activeClass)
    return <Classroom classData={d.activeClass} userRole="student" onLeave={d.handleLeaveClassroom} />;

  const donutData = [
    { name:"Completed", value: d.progress.completedLessons || 0 },
    { name:"Remaining", value: d.progress.classesRemaining || 0 },
  ];
  const donutColors = [ACC.green, P.border];

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", fontFamily:F, background:P.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        .ia-nav { transition: all 0.18s; }
        .ia-nav:hover { background: rgba(255,255,255,0.15) !important; }
        .ia-btn { transition: transform 0.15s, opacity 0.15s; }
        .ia-btn:hover { opacity: 0.88; transform: scale(1.04); }
        .ia-btn:active { transform: scale(0.96); }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${P.border}; border-radius: 10px; }
      `}</style>

      {/* ── Confetti ── */}
      {d.showCelebration && (
        <>
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={450} gravity={0.3} />
          <div style={{ position:"fixed", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, pointerEvents:"none" }}>
            <div style={{ background:`linear-gradient(135deg,${ACC.green},${ACC.teal})`, color:"#fff", padding:"40px 52px", borderRadius:"28px", textAlign:"center", boxShadow:"0 24px 64px rgba(0,0,0,0.25)", pointerEvents:"auto", maxWidth:"90vw" }}>
              <div style={{ fontSize:"68px", marginBottom:"12px" }}>{d.celebrationEmoji}</div>
              <h2 style={{ margin:"0 0 8px", fontSize:"26px", fontWeight:900 }}>{d.celebrationMessage}</h2>
              <p style={{ margin:"0 0 20px", opacity:0.9, fontSize:"15px" }}>Keep up the amazing work! 🌟</p>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ── */}
      {d.toast && (
        <div style={{ position:"fixed", top:"20px", right:"20px", zIndex:99999, padding:"12px 22px", borderRadius:"16px", fontWeight:700, fontSize:"14px", background: d.toast.type==="error"?"#fee2e2":"#f0fdf4", color: d.toast.type==="error"?"#991b1b":"#166534", border:`1px solid ${d.toast.type==="error"?"#fca5a5":"#bbf7d0"}`, boxShadow:"0 6px 20px rgba(0,0,0,0.1)" }}>
          {d.toast.type==="error"?"✕ ":"✓ "}{d.toast.message}
        </div>
      )}

      {/* ══ SIDEBAR ══ */}
      <aside style={{
        width: 230, flexShrink: 0,
        background: `linear-gradient(180deg,${ACC.sidebar} 0%,#0F5C34 100%)`,
        display: isMobile ? "none" : "flex", flexDirection: "column",
        overflowY: "auto", overflowX: "hidden", zIndex: 100,
      }}>
        {/* Brand */}
        <div style={{ padding:"22px 18px 16px", borderBottom:"1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:42, height:42, borderRadius:14, background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, backdropFilter:"blur(4px)", border:"2px solid rgba(255,255,255,0.25)", flexShrink:0 }}>
              🌿
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:900, color:"#fff", lineHeight:1.1 }}>
                {center?.centerName}
              </div>
              <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.6)" }}>Learning Platform</div>
            </div>
          </div>
        </div>

        {/* Student card */}
        <div style={{ margin:"14px 12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:16, padding:"12px 14px", display:"flex", alignItems:"center", gap:10, backdropFilter:"blur(4px)" }}>
          <div style={{ width:38, height:38, borderRadius:12, background:`linear-gradient(135deg,${ACC.green},${ACC.teal})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:17, flexShrink:0 }}>
            {(d.student.firstName?.[0]||"S").toUpperCase()}
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.student.firstName}</div>
            <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.6)" }}>{d.progress.completedLessons} classes done</div>
          </div>
          {d.progress.streakDays > 0 && (
            <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:3, background:"rgba(255,255,255,0.15)", borderRadius:999, padding:"3px 8px" }}>
              <span style={{ fontSize:13 }}>🔥</span>
              <span style={{ fontSize:11, fontWeight:800, color:"#FCD34D" }}>{d.progress.streakDays}</span>
            </div>
          )}
        </div>

        {/* Nav — grouped sections */}
        <nav style={{ flex:1, padding:"4px 10px" }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} style={{ marginBottom:6 }}>
              {group.label && (
                <div style={{ padding:"8px 12px 4px", fontSize:10, fontWeight:800, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:".08em" }}>
                  {group.label}
                </div>
              )}
              {group.items.map(({ key, Icon, label }) => {
                const isActive = d.activeTab === key;
                const badge = key==="homework"&&d.homeworkPending>0?d.homeworkPending
                            : key==="quiz"&&d.quizPending>0?d.quizPending : null;
                return (
                  <button key={key} className="ia-nav"
                    onClick={() => d.setActiveTab(key)}
                    style={{
                      width:"100%", display:"flex", alignItems:"center", gap:10,
                      padding:"9px 12px", borderRadius:12, border:"none", cursor:"pointer",
                      background: isActive ? "rgba(255,255,255,0.18)" : "transparent",
                      borderLeft: isActive ? "3px solid rgba(255,255,255,0.8)" : "3px solid transparent",
                      marginBottom:1, fontFamily:F,
                    }}>
                    <Icon size={16} color={isActive?"#fff":"rgba(255,255,255,0.55)"} />
                    <span style={{ flex:1, fontSize:13, fontWeight:isActive?800:600, color:isActive?"#fff":"rgba(255,255,255,0.65)", textAlign:"left" }}>
                      {label}
                    </span>
                    {badge!=null && (
                      <span style={{ background:"#ef4444", color:"#fff", borderRadius:999, fontSize:10, fontWeight:900, minWidth:18, height:18, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 5px" }}>
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
        <div style={{ padding:"8px 10px 16px", borderTop:"1px solid rgba(255,255,255,0.12)" }}>
          {/* Dark mode toggle */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", marginBottom:4 }}>
            <span style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.55)" }}>{d.isDarkMode?"Dark":"Light"}</span>
            <button onClick={() => d.setIsDarkMode(v=>!v)}
              style={{ width:38, height:20, borderRadius:999, border:"none", cursor:"pointer", background:d.isDarkMode?ACC.green:"rgba(255,255,255,0.25)", position:"relative", transition:"background .2s" }}>
              <div style={{ width:14, height:14, borderRadius:"50%", background:"#fff", position:"absolute", top:3, transition:"left .2s", left:d.isDarkMode?"21px":"3px" }}/>
            </button>
          </div>
          <button className="ia-nav" onClick={() => setShowSettings(true)}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"transparent", marginBottom:1 }}>
            <Settings size={16} color="rgba(255,255,255,0.55)" />
            <span style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.65)" }}>Settings</span>
          </button>
          <button className="ia-nav" onClick={d.handleLogout}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"transparent" }}>
            <LogOut size={16} color="rgba(255,255,255,0.55)" />
            <span style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.65)" }}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Top bar */}
        <header style={{ height:62, background:P.card, borderBottom:`1px solid ${P.border}`, display:"flex", alignItems:"center", padding: isMobile ? "0 12px" : "0 24px", gap: isMobile ? 8 : 14, flexShrink:0 }}>
          <h1 style={{ margin:0, fontSize:18, fontWeight:900, color:P.text, flex:1 }}>
            {PAGE_TITLES[d.activeTab] || "Dashboard"}
          </h1>
          {d.progress.streakDays > 0 && !isMobile && (
            <div style={{ display:"flex", alignItems:"center", gap:5, background: d.isDarkMode?"rgba(249,115,22,0.15)":"#FFF7ED", border:`1px solid ${d.isDarkMode?"rgba(249,115,22,0.3)":"#FED7AA"}`, borderRadius:999, padding:"5px 12px" }}>
              <span style={{ fontSize:15 }}>🔥</span>
              <span style={{ fontSize:13, fontWeight:800, color:ACC.orange }}>{d.progress.streakDays} day streak</span>
            </div>
          )}
          <button style={{ position:"relative", background:"none", border:"none", cursor:"pointer", display:"flex", padding:6 }}>
            <Bell size={20} color={P.textMuted} />
            {d.notifications.filter(n=>!n.read).length > 0 && (
              <span style={{ position:"absolute", top:4, right:4, width:8, height:8, background:"#ef4444", borderRadius:"50%" }}/>
            )}
          </button>
          <button className="ia-btn" onClick={()=>d.notificationsEnabled?d.disableNotifications():d.enableNotifications()}
            style={{ width:36, height:36, borderRadius:10, border:`1px solid ${P.border}`, background:d.notificationsEnabled?`${ACC.green}20`:P.card, cursor:"pointer", fontSize:17, display:"flex", alignItems:"center", justifyContent:"center" }}>
            🔔
          </button>
        </header>

        {/* Scroll area */}
        <main style={{ flex:1, overflowY:"auto", padding: isMobile ? "16px 14px 80px" : 24 }}>

          {/* Pending confirmation banners */}
          {d.pendingConfirmations.map(conf => (
            <div key={conf.id} style={{ background: d.isDarkMode?"rgba(234,179,8,0.1)":"#fffbeb", border:`1px solid ${d.isDarkMode?"rgba(234,179,8,0.3)":"#fcd34d"}`, borderRadius:16, padding:"14px 18px", marginBottom:14, display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:18 }}>⚠️</span>
                  <strong style={{ color: d.isDarkMode?"#FCD34D":"#92400e", fontSize:14 }}>Attendance Confirmation Needed!</strong>
                </div>
                <p style={{ margin:"0 0 3px", color: d.isDarkMode?"#FDE68A":"#b45309", fontSize:13 }}>Teacher marked <strong>"{conf.title}"</strong> complete.</p>
                <p style={{ margin:0, color: d.isDarkMode?"#F59E0B":"#d97706", fontSize:12 }}>⏰ Auto-confirms in: <strong>{d.getTimeRemaining(conf.autoConfirmAt)}</strong></p>
              </div>
              <button className="ia-btn" onClick={()=>{ d.setSelectedConfirmation(conf); d.setShowConfirmationModal(true); }}
                style={{ background:`linear-gradient(135deg,#f59e0b,#fbbf24)`, color:"#fff", border:"none", borderRadius:12, padding:"9px 16px", fontWeight:800, cursor:"pointer", fontSize:13, flexShrink:0 }}>
                Review 👀
              </button>
            </div>
          ))}

          {/* ═══ DASHBOARD HOME ═══ */}
          {d.activeTab === "dashboard" && (
            <div style={{ display:"flex", flexDirection:"column", gap:22 }}>

              {/* Welcome banner */}
              <div style={{
                background:`linear-gradient(135deg,${ACC.sidebar},${ACC.teal})`,
                borderRadius:24, padding:"26px 30px", color:"#fff",
                display:"flex", alignItems:"center", justifyContent:"space-between", gap:20,
                boxShadow:"0 12px 36px rgba(26,122,74,0.3)",
              }}>
                <div>
                  <p style={{ margin:"0 0 4px", fontSize:12, fontWeight:700, opacity:0.8, textTransform:"uppercase", letterSpacing:".06em" }}>Welcome back 🌿</p>
                  <h1 style={{ margin:"0 0 8px", fontSize:26, fontWeight:900 }}>Hey, {d.student.firstName}! 👋</h1>
                  <p style={{ margin:0, opacity:0.9, fontSize:15 }}>
                    You have <strong>{d.progress.classesRemaining}</strong> classes left. Let's grow today!
                  </p>
                </div>
                {!isMobile && <div style={{ fontSize:72, flexShrink:0, filter:"drop-shadow(0 6px 12px rgba(0,0,0,0.2))" }}>🌳</div>}
              </div>

              {/* Stats row */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
                {[
                  { icon:"✅", label:"Completed",  value:d.progress.completedLessons, color:ACC.green,  bg: d.isDarkMode?"rgba(34,197,94,0.12)":"#f0fdf4" },
                  { icon:"📅", label:"Remaining",  value:d.progress.classesRemaining,  color:"#60A5FA",  bg: d.isDarkMode?"rgba(96,165,250,0.12)":"#eff6ff" },
                  { icon:"🔥", label:"Day Streak", value:d.progress.streakDays,        color:ACC.orange, bg: d.isDarkMode?"rgba(249,115,22,0.12)":"#fff7ed" },
                  { icon:"⭐", label:"This Week",  value:d.progress.weeklyCompleted,   color:ACC.purple, bg: d.isDarkMode?"rgba(139,92,246,0.12)":"#f5f3ff" },
                ].map(({icon,label,value,color,bg})=>(
                  <div key={label} style={{ background:P.card, border:`1px solid ${P.border}`, borderRadius:20, padding:"18px 16px", textAlign:"center" }}>
                    <div style={{ width:44, height:44, borderRadius:14, background:bg, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px", fontSize:22 }}>{icon}</div>
                    <div style={{ fontSize:26, fontWeight:900, color, marginBottom:4 }}>{value}</div>
                    <div style={{ fontSize:11, fontWeight:700, color:P.textMuted, textTransform:"uppercase", letterSpacing:".04em" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Middle: donut + live classes + upcoming */}
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "200px 1fr 1fr", gap:16 }}>

                {/* Donut progress */}
                <div style={{ background:P.card, border:`1px solid ${P.border}`, borderRadius:20, padding:"20px 16px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                  <div style={{ position:"relative", marginBottom:10 }}>
                    <PieChart width={120} height={120}>
                      <Pie data={donutData} cx={55} cy={55} innerRadius={38} outerRadius={54} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                        {donutData.map((_,i)=><Cell key={i} fill={donutColors[i]}/>)}
                      </Pie>
                    </PieChart>
                    <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ fontSize:20, fontWeight:900, color:P.text }}>{d.progress.completedLessons}</div>
                      <div style={{ fontSize:9, fontWeight:700, color:P.textMuted, textTransform:"uppercase" }}>Done</div>
                    </div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:800, color:P.text, textAlign:"center" }}>Class Progress</div>
                  <div style={{ fontSize:11, color:P.textMuted, textAlign:"center", marginTop:4 }}>
                    {d.progress.classesRemaining} remaining
                  </div>
                </div>

                {/* Live classes */}
                <div style={{ background:P.card, border:`1px solid ${P.border}`, borderRadius:20, padding:18 }}>
                  <h2 style={{ margin:"0 0 14px", fontSize:15, fontWeight:900, color:P.text, display:"flex", alignItems:"center", gap:8 }}>
                    🚀 Live & Starting Soon
                    {d.activeClasses.length>0&&<span style={{ background:"#ef4444", color:"#fff", borderRadius:999, padding:"2px 8px", fontSize:11, fontWeight:900 }}>{d.activeClasses.length}</span>}
                  </h2>
                  <ActiveClasses activeClasses={d.activeClasses} onJoin={d.handleJoinClass} />
                </div>

                {/* Upcoming */}
                <div style={{ background:P.card, border:`1px solid ${P.border}`, borderRadius:20, padding:18 }}>
                  <h2 style={{ margin:"0 0 14px", fontSize:15, fontWeight:900, color:P.text }}>📅 Upcoming</h2>
                  <UpcomingClasses upcomingClasses={d.upcomingClasses} onEnroll={()=>d.showToast("Coming soon!")} />
                </div>
              </div>

              {/* Island subject cards */}
              <div>
                <h2 style={{ margin:"0 0 16px", fontSize:17, fontWeight:900, color:P.text }}>🏝️ Your Learning Islands</h2>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:14 }}>
                  {ISLANDS.map(island => (
                    <IslandCard
                      key={island.key}
                      island={island}
                      pending={island.key==="homework"?d.homeworkPending:island.key==="quiz"?d.quizPending:0}
                      onClick={()=>d.setActiveTab(island.tab)}
                    />
                  ))}
                </div>
              </div>

              {/* Streak + recent badges */}
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:16 }}>
                <StreakWidget isDarkMode={d.isDarkMode} onLoad={d.handleStreakLoaded} />
                <div style={{ background:P.card, border:`1px solid ${P.border}`, borderRadius:20, padding:18 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <h2 style={{ margin:0, fontSize:15, fontWeight:900, color:P.text }}>🏅 My Badges</h2>
                    <button className="ia-btn" onClick={()=>d.setActiveTab("badges")}
                      style={{ background: d.isDarkMode?"rgba(34,197,94,0.15)":"#f0fdf4", border:"none", color:ACC.green, fontWeight:700, borderRadius:10, padding:"4px 12px", cursor:"pointer", fontSize:12 }}>See all →</button>
                  </div>
                  {d.badges.length===0
                    ? <p style={{ textAlign:"center", color:P.textMuted, fontSize:13 }}>Complete classes to earn badges! 🌟</p>
                    : <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                        {d.badges.slice(-4).map(b=>(
                          <div key={b.id} title={b.name} style={{ textAlign:"center" }}>
                            <div style={{ fontSize:32 }}>{b.icon}</div>
                            <p style={{ margin:"3px 0 0", fontSize:10, fontWeight:700, color:P.textMuted, maxWidth:48 }}>{b.name}</p>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              </div>

            </div>
          )}

          {/* ═══ TABS ═══ */}
          {d.activeTab==="homework"          && <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:20,padding:24}}><StudentHomeworkTab studentInfo={d.student} isDarkMode={d.isDarkMode}/></div>}
          {d.activeTab==="quiz"              && <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:20,padding:24}}><StudentQuizTab studentInfo={d.student} isDarkMode={d.isDarkMode}/></div>}
          {d.activeTab==="flashcards"        && <FlashcardsTab isDarkMode={d.isDarkMode}/>}
          {d.activeTab==="pronunciation"     && <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:20,padding:24}}><PronunciationTab isDarkMode={d.isDarkMode}/></div>}
          {d.activeTab==="conversation"      && <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:20,padding:24}}><ConversationTab studentInfo={d.student} isDarkMode={d.isDarkMode}/></div>}
          {d.activeTab==="messages"          && <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:20,overflow:"hidden"}}><MessagesTab userRole="student"/></div>}
          {d.activeTab==="completed-classes" && <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:20,padding:24}}><h2 style={{margin:"0 0 20px",fontSize:20,fontWeight:900,color:P.text}}>✅ Completed Classes</h2><StudentCompletedTab studentId={d.student.id} isDarkMode={d.isDarkMode}/></div>}
          {d.activeTab==="schedule"          && <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:20,padding:24}}><StudentScheduleTab studentId={d.student.id} isDarkMode={d.isDarkMode}/></div>}
          {d.activeTab==="recordings"        && <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:20,padding:24}}><RecordingsTab isDarkMode={d.isDarkMode}/></div>}
          {d.activeTab==="reviews"           && <ReviewsTab isDarkMode={d.isDarkMode}/>}
          {d.activeTab==="referral"          && <ReferralTab isDarkMode={d.isDarkMode}/>}
          {d.activeTab==="badges"            && <BadgesTab badges={d.badges} progress={d.progress} completedClasses={d.completedClasses} shareAchievement={d.shareAchievement} P={P}/>}

          {/* ═══ CHARTS ═══ */}
          {d.activeTab==="charts" && (
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",gap:14}}>
                {[
                  {icon:"📚",label:"Total Classes",value:d.completedClasses.length,color:ACC.green},
                  {icon:"🔥",label:"Day Streak",value:d.progress.streakDays,color:ACC.orange},
                  {icon:"⏱️",label:"Total Hours",value:d.completedClasses.length>0?Math.round(d.completedClasses.reduce((s,c)=>s+c.duration,0)/60):0,color:ACC.teal},
                ].map(({icon,label,value,color})=>(
                  <div key={label} style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:20,padding:24,textAlign:"center"}}>
                    <div style={{fontSize:36,marginBottom:8}}>{icon}</div>
                    <div style={{fontSize:32,fontWeight:900,color,marginBottom:4}}>{value}</div>
                    <div style={{fontSize:12,fontWeight:700,color:P.textMuted,textTransform:"uppercase",letterSpacing:".04em"}}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",gap:16}}>
                <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:20,padding:24}}>
                  <h3 style={{margin:"0 0 16px",fontSize:16,fontWeight:800,color:P.text}}>Classes Per Month</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={d.completedClasses.slice(-12).reduce((acc,c)=>{const m=new Date(c.scheduledTime).toLocaleString("en",{month:"short"});const ex=acc.find(a=>a.month===m);if(ex)ex.count++;else acc.push({month:m,count:1});return acc;},[])} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke={P.border}/>
                      <XAxis dataKey="month" tick={{fontSize:11,fill:P.textMuted}}/>
                      <YAxis tick={{fontSize:11,fill:P.textMuted}}/>
                      <RechartsTooltip contentStyle={tooltipStyle}/>
                      <Bar dataKey="count" fill={ACC.green} radius={[6,6,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:20,padding:24}}>
                  <h3 style={{margin:"0 0 16px",fontSize:16,fontWeight:800,color:P.text}}>Learning Trend</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={d.completedClasses.map((c,i)=>({i:i+1,total:i+1}))}>
                      <CartesianGrid strokeDasharray="3 3" stroke={P.border}/>
                      <XAxis dataKey="i" tick={{fontSize:11,fill:P.textMuted}}/>
                      <YAxis tick={{fontSize:11,fill:P.textMuted}}/>
                      <RechartsTooltip contentStyle={tooltipStyle}/>
                      <Line type="monotone" dataKey="total" stroke={ACC.teal} strokeWidth={2} dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ══ SETTINGS PANEL ══ */}
      {showSettings && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9000, display:"flex", justifyContent:"flex-end" }}
          onClick={()=>setShowSettings(false)}>
          <div style={{ width:300, background:P.card, height:"100%", padding:26, overflowY:"auto", boxShadow:"-4px 0 24px rgba(0,0,0,0.2)" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <h2 style={{ margin:0, fontSize:17, fontWeight:800, color:P.text }}>Settings</h2>
              <button onClick={()=>setShowSettings(false)} style={{ background:P.bg, border:"none", borderRadius:8, width:30, height:30, cursor:"pointer", fontSize:15, color:P.text }}>✕</button>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:14, background:P.bg, borderRadius:14, marginBottom:18, border:`1px solid ${P.border}` }}>
              <div style={{ width:42, height:42, borderRadius:"50%", background:`linear-gradient(135deg,${ACC.green},${ACC.teal})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:18 }}>
                {(d.student.firstName?.[0]||"S").toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:P.text }}>{d.student.name}</div>
                <div style={{ fontSize:12, color:P.textMuted }}>{d.student.email||"Student"}</div>
              </div>
            </div>

            {/* Dark mode toggle */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 14px", background:P.bg, border:`1px solid ${P.border}`, borderRadius:12, marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {d.isDarkMode?<Moon size={15} color={ACC.green}/>:<Sun size={15} color={ACC.green}/>}
                <span style={{ fontSize:13, color:P.text, fontWeight:600 }}>{d.isDarkMode?"Dark Mode":"Light Mode"}</span>
              </div>
              <button onClick={()=>d.setIsDarkMode(v=>!v)}
                style={{ width:40, height:22, borderRadius:999, border:"none", cursor:"pointer", background:d.isDarkMode?ACC.green:P.border, position:"relative", transition:"background .2s" }}>
                <div style={{ width:16, height:16, borderRadius:"50%", background:"#fff", position:"absolute", top:3, transition:"left .2s", left:d.isDarkMode?"21px":"3px" }}/>
              </button>
            </div>

            {[
              {Icon:KeyRound, label:"Change Password",    action:()=>{setShowSettings(false);d.setShowChangePassword(true);}},
              {Icon:Shield,   label:"Session Management", action:()=>{setShowSettings(false);d.setShowSessionManagement(true);}},
              {Icon:Settings, label:"Security & 2FA",     action:()=>{setShowSettings(false);setShow2FA(true);}},
            ].map(({Icon,label,action})=>(
              <button key={label} onClick={action}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:P.bg, border:`1px solid ${P.border}`, borderRadius:12, marginBottom:8, cursor:"pointer", fontFamily:F, fontSize:13, color:P.text, fontWeight:600 }}>
                <Icon size={15} color={ACC.green}/>
                {label}
                <ChevronRight size={13} style={{ marginLeft:"auto", color:P.textMuted }}/>
              </button>
            ))}

            <button onClick={d.handleLogout}
              style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:12, background:`linear-gradient(135deg,${ACC.green},${ACC.teal})`, border:"none", borderRadius:12, cursor:"pointer", color:"#fff", fontWeight:800, fontSize:14, marginTop:12 }}>
              <LogOut size={15}/> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* ══ MODALS ══ */}
      {d.showChangePassword    && <ChangePassword    onClose={()=>d.setShowChangePassword(false)}/>}
      {d.showSessionManagement && <SessionManagement isOpen onClose={()=>d.setShowSessionManagement(false)} userType="student"/>}
      {show2FA                 && <SettingsModal     isOpen onClose={()=>setShow2FA(false)} userType="student"/>}

      {d.showConfirmationModal && d.selectedConfirmation && (
        <ClassConfirmation
          confirmation={d.selectedConfirmation}
          onClose={()=>{d.setShowConfirmationModal(false);d.setSelectedConfirmation(null);}}
          onConfirmed={()=>{d.setShowConfirmationModal(false);d.setSelectedConfirmation(null);d.fetchStudentData();}}
        />
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <nav style={{ position:'fixed', bottom:0, left:0, right:0, height:60, background:`linear-gradient(90deg,${ACC.sidebar},#0F5C34)`, borderTop:'1px solid rgba(255,255,255,0.12)', display:'flex', zIndex:200, boxShadow:'0 -4px 20px rgba(0,0,0,0.25)' }}>
          {[
            { key:'dashboard', Icon:Home,          label:'Home'    },
            { key:'homework',  Icon:BookOpen,       label:'Learn'   },
            { key:'messages',  Icon:MessageSquare,  label:'Chat'    },
            { key:'schedule',  Icon:CalendarDays,   label:'Classes' },
          ].map(({ key, Icon, label }) => {
            const isActive = d.activeTab === key;
            return (
              <button key={key} onClick={() => d.setActiveTab(key)}
                style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, border:'none', background:'transparent', cursor:'pointer', fontFamily:F, color: isActive ? '#fff' : 'rgba(255,255,255,0.5)', borderTop: isActive ? `3px solid ${ACC.green}` : '3px solid transparent' }}>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                <span style={{ fontSize:10, fontWeight: isActive ? 800 : 600 }}>{label}</span>
              </button>
            );
          })}
          <button onClick={() => setShowMobileMenu(true)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, border:'none', background:'transparent', cursor:'pointer', fontFamily:F, color:'rgba(255,255,255,0.5)', borderTop:'3px solid transparent' }}>
            <Settings size={20} strokeWidth={1.8} />
            <span style={{ fontSize:10, fontWeight:600 }}>More</span>
          </button>
        </nav>
      )}

      {/* ── MOBILE MENU SHEET ── */}
      {isMobile && showMobileMenu && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9500 }} onClick={() => setShowMobileMenu(false)}>
          <div style={{ position:'absolute', bottom:0, left:0, right:0, background:P.card, borderRadius:'20px 20px 0 0', padding:'12px 16px 44px', maxHeight:'78vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, background:P.border, borderRadius:999, margin:'0 auto 16px' }} />
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {NAV_GROUPS.flatMap(g => g.items)
                .filter(item => !['dashboard','homework','messages','schedule'].includes(item.key))
                .map(item => {
                  const isActive = d.activeTab === item.key;
                  return (
                    <button key={item.key} onClick={() => { d.setActiveTab(item.key); setShowMobileMenu(false); }}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:14, border:'none', background: isActive ? `${ACC.green}18` : 'transparent', color: isActive ? ACC.green : P.text, cursor:'pointer', fontFamily:F, width:'100%', fontSize:14, fontWeight: isActive ? 800 : 600 }}>
                      <item.Icon size={18} color={isActive ? ACC.green : P.textMuted} strokeWidth={1.8} />
                      {item.label}
                    </button>
                  );
                })}
              <div style={{ borderTop:`1px solid ${P.border}`, margin:'8px 0 4px' }} />
              <button onClick={() => { setShowMobileMenu(false); setShowSettings(true); }}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:14, border:'none', background:'transparent', color:P.text, cursor:'pointer', fontFamily:F, width:'100%', fontSize:14, fontWeight:600 }}>
                <Settings size={18} color={P.textMuted} />
                Settings
              </button>
              <button onClick={d.handleLogout}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:14, border:'none', background:'transparent', color:'#ef4444', cursor:'pointer', fontFamily:F, width:'100%', fontSize:14, fontWeight:600 }}>
                <LogOut size={18} color="#ef4444" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
