// src/pages/student/dashboard-shells/playful/PlayfulShell.jsx
// Bright & playful kids-first LMS design.
// Dark icon sidebar | full-width hero banner | colorful category tile grid | What's New panel.
// Inspired by: vivid game/learning platform UIs. Poppins font. Round everything.

import { useState, useEffect } from "react";
import {
  Home, BookOpen, Mic2, MessageSquare, CalendarDays, BarChart2,
  MoreHorizontal, Bell, Search, LogOut, Settings, ChevronRight,
  Shield, KeyRound, Copy, Sun, Moon, Play, Award,
} from "lucide-react";
import LanguageSwitcher from "../../../../components/LanguageSwitcher";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useBranding } from "../../../../context/BrandingContext";
import { useDashboardData, BADGE_DEFINITIONS } from "../useDashboardData";
import { useRing }                              from "../../../../context/RingContext";
import SessionManagement from "../../../../components/SessionManagement";
import SettingsModal     from "../../../../components/SettingsModal";
import ClassConfirmation from "../../../../components/student/ClassConfirmation";
import PendingConfirmationBanners from "../PendingConfirmationBanners";
import StreakWidget        from "../../components/StreakWidget";
import ActiveClasses       from "../../components/ActiveClasses";
import UpcomingClasses     from "../../components/UpcomingClasses";
import ProgressCard        from "../../components/ProgressCard";
import DashboardAlertsBar from "../../../../components/DashboardAlertsBar";
// Tabs load on demand (see src/pages/student/tabs/lazyTabs.js)
import { LeaderboardTab, ChangePassword, StudentCompletedTab, BookingCalendarTab, ClassReportsTab, StudentScheduleTab, StudentHomeworkTab, StudentQuizTab, PronunciationTab, ConversationTab, FlashcardsTab, RecordingsTab, ReviewsTab, ReferralTab, MessagesTab, Classroom } from "../../tabs/lazyTabs";
import { useTranslation } from "react-i18next";
import i18n from "../../../../i18n/i18n.js";

// For text in file-level lists: read when rendered, so it follows the chosen language
const ta = (key, opts) => i18n.t(`student:${key}`, opts);


// ── Palette ────────────────────────────────────────────────────────────────────
const LIGHT = {
  sidebar:    "#13131F",
  sideText:   "rgba(255,255,255,0.55)",
  bg:         "#F4F5FF",
  white:      "#FFFFFF",
  card:       "#FFFFFF",
  border:     "#E8EAFF",
  text:       "#13131F",
  textSub:    "#5A5B72",
  textMuted:  "#9899B0",
  inputBg:    "#EDEEFF",
  settingRow: "#F4F5FF",
  // vivid accent set
  pink:   "#FF6B9D",
  coral:  "#FF6B6B",
  orange: "#FF8E53",
  yellow: "#FFD93D",
  green:  "#4ADE80",
  blue:   "#4D96FF",
  teal:   "#06B6D4",
  indigo: "#818CF8",
  red:    "#EF4444",
};
const DARK = {
  bg:         "#0C0D1A",
  white:      "#161728",
  card:       "#1C1D2E",
  border:     "#262740",
  text:       "#F0F2FF",
  textSub:    "#A8AAC8",
  textMuted:  "#606280",
  inputBg:    "#161728",
  settingRow: "#1C1D2E",
};

// ── Sidebar nav ────────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard", Icon:Home,          get label() { return ta("playfulShell.navHome"); },     tabs:["dashboard"],                       dot:"#FF6B9D" },
  { id:"study",     Icon:BookOpen,       get label() { return ta("playfulShell.navStudy"); },    tabs:["homework","quiz","flashcards"],    dot:"#4D96FF" },
  { id:"practice",  Icon:Mic2,           get label() { return ta("playfulShell.navPractice"); }, tabs:["pronunciation","conversation"],    dot:"#FFD93D" },
  { id:"messages",  Icon:MessageSquare,  get label() { return ta("playfulShell.navMessages"); }, tabs:["messages"],                        dot:"#4ADE80" },
  { id:"classes",   Icon:CalendarDays,   get label() { return ta("playfulShell.navClasses"); },  tabs:["completed-classes","schedule","book-class","class-reports"],    dot:"#06B6D4" },
  { id:"progress",  Icon:BarChart2,      get label() { return ta("playfulShell.navProgress"); }, tabs:["charts","badges"],                 dot:"#FF8E53" },
  { id:"more",      Icon:MoreHorizontal, get label() { return ta("playfulShell.navMore"); },     tabs:["recordings","reviews","referral","leaderboard"], dot:"#818CF8" },
];

const SUB_TABS = {
  study:    [{ key:"homework",get label() { return ta("playfulShell.subTabsHomework"); } }, { key:"quiz",get label() { return ta("playfulShell.subTabsQuizzes"); } }, { key:"flashcards",get label() { return ta("playfulShell.subTabsFlashcards"); } }],
  practice: [{ key:"pronunciation",get label() { return ta("playfulShell.subTabsSpeak"); } }, { key:"conversation",get label() { return ta("playfulShell.subTabsAiChat"); } }],
  classes:  [{ key:"completed-classes",get label() { return ta("playfulShell.subTabsCompleted"); } }, { key:"schedule",get label() { return ta("playfulShell.subTabsSchedule"); } }, { key:"book-class",get label() { return ta("playfulShell.subTabsBookAClass"); } }, { key:"class-reports",get label() { return ta("playfulShell.subTabsReports"); } }],
  progress: [{ key:"charts",get label() { return ta("playfulShell.subTabsCharts"); } }, { key:"badges",get label() { return ta("playfulShell.subTabsBadges"); } }],
  more:     [{ key:"recordings",get label() { return ta("playfulShell.subTabsRecordings"); } }, { key:"reviews",get label() { return ta("playfulShell.subTabsReviews"); } }, { key:"referral",get label() { return ta("playfulShell.subTabsInvite"); } }, { key:"leaderboard",get label() { return ta("playfulShell.subTabsLeaderboard"); } }],
};

// ── Lesson category tiles ──────────────────────────────────────────────────────
const TILES = [
  { tab:"homework",      get label() { return ta("playfulShell.tilesHomework"); },   emoji:"📚", g:["#FF6B6B","#FF8E53"], light:"#FFF1EE" },
  { tab:"quiz",          get label() { return ta("playfulShell.tilesQuiz"); },        emoji:"🎯", g:["#4D96FF","#818CF8"], light:"#EEF3FF" },
  { tab:"flashcards",    get label() { return ta("playfulShell.tilesFlashcards"); }, emoji:"🃏", g:["#FFD93D","#FF8E53"], light:"#FFFAEE" },
  { tab:"pronunciation", get label() { return ta("playfulShell.tilesSpeaking"); },   emoji:"🎤", g:["#FF6B9D","#FF6B6B"], light:"#FFF0F6" },
  { tab:"conversation",  get label() { return ta("playfulShell.tilesAiChat"); },    emoji:"🤖", g:["#06B6D4","#4D96FF"], light:"#EEF9FF" },
  { tab:"messages",      get label() { return ta("playfulShell.tilesMessages"); },   emoji:"💬", g:["#4ADE80","#06B6D4"], light:"#EDFFF6" },
  { tab:"charts",        get label() { return ta("playfulShell.tilesProgress"); },   emoji:"📊", g:["#FF8E53","#FFD93D"], light:"#FFF5EE" },
  { tab:"schedule",      get label() { return ta("playfulShell.tilesSchedule"); },   emoji:"📅", g:["#FF6B9D","#818CF8"], light:"#F5F0FF" },
];

const PAGE_TITLE = {
  get dashboard() { return ta("playfulShell.pageTitleHome"); },get homework() { return ta("playfulShell.pageTitleHomework"); },get quiz() { return ta("playfulShell.pageTitleQuizzes"); },get flashcards() { return ta("playfulShell.pageTitleFlashcards"); },
  get pronunciation() { return ta("playfulShell.pageTitleSpeaking"); },get conversation() { return ta("playfulShell.pageTitleAiChat"); },get messages() { return ta("playfulShell.pageTitleMessages"); },
  get "completed-classes"() { return ta("playfulShell.pageTitleCompletedClasses"); },get schedule() { return ta("playfulShell.pageTitleSchedule"); },
  get charts() { return ta("playfulShell.pageTitleProgress"); },get badges() { return ta("playfulShell.pageTitleBadges"); },get recordings() { return ta("playfulShell.pageTitleRecordings"); },
  get reviews() { return ta("playfulShell.pageTitleReviews"); },get referral() { return ta("playfulShell.pageTitleInviteFriends"); },get leaderboard() { return ta("playfulShell.pageTitleLeaderboard"); },
};

// ── Badges panel ───────────────────────────────────────────────────────────────
function PlayfulBadgesPanel({ badges, progress, completedClasses, shareAchievement, P }) {
  const { t: tr } = useTranslation("student");
  const [filter, setFilter] = useState("all");
  const cats = [
    {key:"all",label:tr("playfulShell.all")},{key:"journey",label:tr("playfulShell.journey")},
    {key:"consistency",label:tr("playfulShell.streak")},{key:"weekly",label:tr("playfulShell.weekly")},{key:"special",label:tr("playfulShell.special")},
  ];
  const shown = BADGE_DEFINITIONS.filter(b => filter==="all" || b.category===filter);
  const pct = Math.round((badges.length/BADGE_DEFINITIONS.length)*100);
  const getCur = b => b.type==="streak" ? progress.streakDays : b.type==="total" ? completedClasses.length : b.type==="weekly" ? progress.weeklyCompleted : 0;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{background:P.card,borderRadius:20,padding:24,border:`1px solid ${P.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800,color:P.text}}>{tr("playfulShell.myBadges")}</h2>
            <p style={{margin:0,color:P.textSub,fontSize:14}}>{badges.length===0?tr("playfulShell.completeClassesToEarnYour"): tr("playfulShell.ofEarned", { badgesCount: badges.length, BADGEDEFINITIONSCount: BADGE_DEFINITIONS.length, pct })}</p>
          </div>
          {badges.length>0&&<button onClick={()=>shareAchievement("badge")} style={{background:`linear-gradient(135deg,${P.pink},${P.coral})`,color:"#fff",border:"none",borderRadius:999,padding:"9px 20px",fontWeight:700,cursor:"pointer",fontSize:14}}>{tr("playfulShell.share")}</button>}
        </div>
        <div style={{height:10,background:P.border,borderRadius:999,overflow:"hidden",marginBottom:16}}>
          <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${P.pink},${P.orange},${P.yellow})`,borderRadius:999,transition:"width .4s"}}/>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {cats.map(c=>(
            <button key={c.key} onClick={()=>setFilter(c.key)}
              style={{padding:"5px 16px",borderRadius:999,border:`1.5px solid ${filter===c.key?P.pink:P.border}`,background:filter===c.key?`linear-gradient(135deg,${P.pink},${P.coral})`:"transparent",color:filter===c.key?"#fff":P.textSub,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Poppins,sans-serif"}}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(148px,1fr))",gap:12}}>
        {shown.map(b=>{
          const earned=badges.some(e=>e.id===b.id);
          const cur=getCur(b);
          const pctB=b.type!=="special"?Math.min(100,Math.round((cur/b.requirement)*100)):(earned?100:0);
          return(
            <div key={b.id} style={{background:P.card,border:`1.5px solid ${earned?"#FF6B9D44":P.border}`,borderRadius:20,padding:16,textAlign:"center",opacity:earned?1:0.5,transition:"transform .15s"}}>
              <div style={{fontSize:36,marginBottom:8,filter:earned?"none":"grayscale(1)"}}>{b.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:P.text,marginBottom:4}}>{b.name}</div>
              <div style={{fontSize:11,color:P.textMuted,marginBottom:8,lineHeight:1.4}}>{b.desc}</div>
              {!earned&&b.type!=="special"&&(
                <>
                  <div style={{fontSize:11,color:P.pink,fontWeight:700,marginBottom:4}}>{cur}/{b.requirement}</div>
                  <div style={{height:4,background:P.border,borderRadius:999}}>
                    <div style={{height:"100%",width:`${pctB}%`,background:P.pink,borderRadius:999}}/>
                  </div>
                </>
              )}
              {earned&&<div style={{fontSize:11,color:P.green,fontWeight:700}}>{tr("playfulShell.earned")}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PlayfulShell
// ══════════════════════════════════════════════════════════════════════════════
export default function PlayfulShell() {
  const { t: tr } = useTranslation("student");
  const { center } = useBranding();
  const d = useDashboardData();
  const { missedCallCount, clearMissedCalls } = useRing();
  const P = d.isDarkMode ? { ...LIGHT, ...DARK } : LIGHT;
  const tipStyle = { background:P.card, border:`1px solid ${P.border}`, borderRadius:12, fontSize:13, fontFamily:"Poppins,sans-serif", color:P.text };

  const [showSettings, setShowSettings] = useState(false);
  const [show2FA,      setShow2FA]      = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const activeSection = NAV.find(n => n.tabs.includes(d.activeTab))?.id || "dashboard";
  const subTabs = SUB_TABS[activeSection] || [];

  // Classroom overlay
  if (d.isClassroomOpen && d.activeClass) {
    return <Classroom classData={d.activeClass} userRole="student" onLeave={d.handleLeaveClassroom}/>;
  }

  // ── Hero content logic ────────────────────────────────────────────────────────
  const hasLive = d.activeClasses.length > 0;
  const nextClass = d.upcomingClasses[0];
  const heroTitle  = hasLive
    ? `Your class is LIVE right now!`
    : d.homeworkPending > 0
      ? `You have ${d.homeworkPending} homework assignment${d.homeworkPending>1?"s":""}!`
      : nextClass
        ? `Next class: ${nextClass.title}`
        : `Keep up the great work, ${d.student.firstName||"there"}!`;
  const heroSub = hasLive
    ? `Tap Join to enter your lesson with ${d.activeClasses[0]?.teacher}`
    : d.homeworkPending > 0
      ? "Your teacher is waiting for your answers. Let's go!"
      : nextClass
        ? `With ${nextClass.teacher} · ${nextClass.time}`
        : `You've completed ${d.progress.completedLessons} classes. Keep going 🚀`;
  const heroGrad = hasLive
    ? "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)"
    : d.homeworkPending > 0
      ? "linear-gradient(135deg, #4D96FF 0%, #818CF8 100%)"
      : "linear-gradient(135deg, #FF6B9D 0%, #FF8E53 100%)";
  const heroEmojis = hasLive ? ["🔴","📡","🎉"] : d.homeworkPending>0 ? ["📚","✏️","🎒"] : ["🌟","📖","🎓"];
  const heroBtn = hasLive
    ? { label:tr("playfulShell.joinClass"), action:()=>d.handleJoinClass(d.activeClasses[0]) }
    : d.homeworkPending > 0
      ? { label:tr("playfulShell.startHomework"), action:()=>d.setActiveTab("homework") }
      : { label:tr("playfulShell.viewSchedule"), action:()=>d.setActiveTab("schedule") };

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",fontFamily:"'Poppins','Inter',sans-serif",background:P.bg}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${P.border};border-radius:99px;}
        .pf-nav:hover{background:rgba(255,255,255,0.08)!important;}
        .pf-tile{transition:transform .18s,box-shadow .18s;cursor:pointer;}
        .pf-tile:hover{transform:translateY(-4px) scale(1.03);box-shadow:0 12px 32px rgba(0,0,0,0.18)!important;}
        .pf-btn{transition:transform .12s,filter .12s;}
        .pf-btn:hover{transform:translateY(-2px);filter:brightness(1.08);}
        .pf-card{transition:box-shadow .15s;}
        .pf-card:hover{box-shadow:0 6px 24px rgba(77,150,255,0.10)!important;}
      `}</style>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside style={{
        width:72, flexShrink:0, background:P.sidebar,
        display: isMobile ? "none" : "flex", flexDirection:"column", alignItems:"center",
        padding:"18px 0", gap:2, zIndex:100,
        boxShadow:"3px 0 20px rgba(0,0,0,0.25)",
      }}>
        {/* Logo */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,marginBottom:14}}>
          <div style={{
            width:42, height:42, borderRadius:14,
            background:"linear-gradient(135deg,#FF6B9D,#FF8E53)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:20,
            boxShadow:"0 4px 12px rgba(255,107,157,0.5)",
          }}>🎓</div>
          <div style={{fontSize:8,fontWeight:800,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:".04em",maxWidth:60,textAlign:"center",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {center?.centerName}
          </div>
        </div>

        {NAV.map(({id,Icon,label,tabs,dot})=>{
          const isActive = id===activeSection;
          return (
            <button key={id} className="pf-nav" title={label}
              onClick={()=>d.setActiveTab(tabs[0])}
              style={{
                width:52, height:52, borderRadius:16, border:"none", cursor:"pointer",
                background: isActive ? dot+"22" : "transparent",
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:3, position:"relative",
                outline: isActive ? `2px solid ${dot}44` : "none",
              }}>
              <Icon size={20} color={isActive ? dot : P.sideText} strokeWidth={isActive?2.5:1.8}/>
              {isActive && <div style={{width:4,height:4,borderRadius:"50%",background:dot}}/>}
              {/* New homework + quizzes since those tabs were last opened */}
              {id==="study" && ((d.tabBadge?.("homework") || 0) + (d.tabBadge?.("quiz") || 0))>0 && (
                <span style={{position:"absolute",top:4,right:4,background:P.coral,color:"#fff",borderRadius:999,fontSize:8,fontWeight:800,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>
                  {((d.tabBadge?.("homework") || 0) + (d.tabBadge?.("quiz") || 0))}
                </span>
              )}
            </button>
          );
        })}

        <div style={{flex:1}}/>

        <button className="pf-nav" title={tr("playfulShell.settings")} onClick={()=>setShowSettings(true)}
          style={{width:52,height:52,borderRadius:16,border:"none",cursor:"pointer",background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:P.sideText}}>
          <Settings size={20} strokeWidth={1.8}/>
        </button>
        <button className="pf-nav" title={tr("playfulShell.signOut")} onClick={d.handleLogout}
          style={{width:52,height:52,borderRadius:16,border:"none",cursor:"pointer",background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:P.sideText,marginBottom:4}}>
          <LogOut size={20} strokeWidth={1.8}/>
        </button>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* ── TOP BAR ── */}
        <header style={{
          height:64, background:P.white, borderBottom:`1px solid ${P.border}`,
          display:"flex", alignItems:"center", padding:"0 24px", gap:14, flexShrink:0,
        }}>
          <h1 style={{margin:0,fontSize:17,fontWeight:800,color:P.text,whiteSpace:"nowrap"}}>
            {PAGE_TITLE[d.activeTab] || tr("playfulShell.home")}
          </h1>

          {/* Sub-tab pills */}
          {subTabs.length>0 && (
            <div style={{display:"flex",gap:6,overflowX:"auto",flexShrink:1,minWidth:0}}>
              {subTabs.map(st=>(
                <button key={st.key} onClick={()=>d.setActiveTab(st.key)}
                  style={{padding:"5px 14px",borderRadius:999,fontSize:12,fontWeight:700,border:"none",cursor:"pointer",fontFamily:"Poppins,sans-serif",
                    background:d.activeTab===st.key ? `linear-gradient(135deg,${P.pink},${P.coral})` : P.inputBg,
                    color:d.activeTab===st.key?"#fff":P.textSub,
                  }}>
                  {st.label}
                </button>
              ))}
            </div>
          )}

          <div style={{flex:1}}/>

          {/* Search */}
          {!isMobile && (
          <div style={{position:"relative"}}>
            <Search size={14} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:P.textMuted}}/>
            <input placeholder={tr("playfulShell.searchAnything")}
              style={{width:200,height:36,background:P.inputBg,border:"none",borderRadius:12,padding:"0 10px 0 30px",fontSize:13,color:P.text,outline:"none",fontFamily:"Poppins,sans-serif"}}/>
          </div>
          )}

          <LanguageSwitcher compact col={{ border: P.border, body: P.text }} />

          {/* Dark mode */}
          <button onClick={()=>d.setIsDarkMode(v=>!v)}
            style={{width:36,height:36,borderRadius:12,border:`1px solid ${P.border}`,background:P.inputBg,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:P.textSub}}>
            {d.isDarkMode ? <Sun size={15}/> : <Moon size={15}/>}
          </button>

          {/* ── Notification chips — desktop only ── */}
          {!isMobile && d.unreadMessages > 0 && (
            <button onClick={()=>{ d.setActiveTab("messages"); d.setUnreadMessages(0); }} title={tr("playfulShell.goToMessages")}
              style={{display:"flex",alignItems:"center",gap:5,background:d.isDarkMode?"rgba(139,92,246,0.15)":"#f5f3ff",border:`1.5px solid ${d.isDarkMode?"rgba(139,92,246,0.3)":"#ddd6fe"}`,borderRadius:999,padding:"5px 13px",cursor:"pointer",fontFamily:"Poppins,sans-serif"}}>
              <span style={{fontSize:13}}>💬</span>
              <span style={{fontSize:12,fontWeight:700,color:d.isDarkMode?"#a78bfa":"#7c3aed"}}>{tr("playfulShell.new", { unreadMessages: d.unreadMessages })}</span>
            </button>
          )}
          {!isMobile && missedCallCount > 0 && (
            <button onClick={clearMissedCalls} title={tr("playfulShell.clearMissedCalls")}
              style={{display:"flex",alignItems:"center",gap:5,background:d.isDarkMode?"rgba(239,68,68,0.12)":"#fff5f5",border:`1.5px solid ${d.isDarkMode?"rgba(239,68,68,0.3)":"#fecaca"}`,borderRadius:999,padding:"5px 13px",cursor:"pointer",fontFamily:"Poppins,sans-serif"}}>
              <span style={{fontSize:13}}>📞</span>
              <span style={{fontSize:12,fontWeight:700,color:"#ef4444"}}>{tr("playfulShell.missed", { missedCallCount })}</span>
            </button>
          )}

          {/* Bell */}
          <button style={{position:"relative",background:"none",border:"none",cursor:"pointer",color:P.textSub,padding:6,display:"flex"}}>
            <Bell size={19}/>
            {d.notifications.filter(n=>!n.read).length>0 && (
              <span style={{position:"absolute",top:4,right:4,width:8,height:8,background:P.coral,borderRadius:"50%",border:`2px solid ${P.white}`}}/>
            )}
          </button>

          {/* Avatar */}
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:36,height:36,borderRadius:12,background:`linear-gradient(135deg,${P.pink},${P.orange})`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:15,boxShadow:`0 3px 10px ${P.pink}55`}}>
              {(d.student.firstName?.[0]||"S").toUpperCase()}
            </div>
            <div style={{lineHeight:1.2}}>
              <div style={{fontSize:13,fontWeight:700,color:P.text}}>{d.student.firstName||tr("playfulShell.student")}</div>
              <div style={{fontSize:11,color:P.textMuted}}>{tr("playfulShell.student")}</div>
            </div>
          </div>
        </header>

        {/* ── SCROLL AREA ── */}
        <main style={{flex:1,overflowY:"auto",padding: isMobile ? "16px 14px 80px" : 24}}>
          {/* Missed calls & new messages while away */}
          <DashboardAlertsBar isDark={d.isDarkMode} onOpenMessages={() => d.setActiveTab("messages")} />
          <PendingConfirmationBanners d={d} />

          {/* ════════════════ DASHBOARD HOME ════════════════ */}
          {d.activeTab==="dashboard" && (
            <div style={{display:"flex",flexDirection: isMobile ? "column" : "row",gap:20,alignItems:"flex-start"}}>

              {/* LEFT */}
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:20,minWidth:0}}>

                {/* ── HERO BANNER ── */}
                <div style={{
                  background:heroGrad, borderRadius:24, padding:"28px 32px",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  position:"relative", overflow:"hidden", minHeight:160,
                  boxShadow:`0 12px 40px rgba(255,107,157,0.3)`,
                }}>
                  {/* Decorative blobs */}
                  <div style={{position:"absolute",top:-30,right:240,width:130,height:130,borderRadius:"50%",background:"rgba(255,255,255,0.10)",pointerEvents:"none"}}/>
                  <div style={{position:"absolute",bottom:-40,right:120,width:180,height:180,borderRadius:"50%",background:"rgba(255,255,255,0.08)",pointerEvents:"none"}}/>
                  <div style={{position:"absolute",top:10,right:20,width:60,height:60,borderRadius:"50%",background:"rgba(255,255,255,0.12)",pointerEvents:"none"}}/>

                  {/* Text */}
                  <div style={{zIndex:1,maxWidth: isMobile ? "100%" : "58%"}}>
                    <div style={{display:"inline-block",background:"rgba(255,255,255,0.25)",borderRadius:999,padding:"3px 14px",fontSize:11,fontWeight:700,color:"#fff",letterSpacing:1,marginBottom:10,backdropFilter:"blur(6px)"}}>
                      {hasLive ? tr("playfulShell.liveNow") : d.homeworkPending>0 ? tr("playfulShell.dueToday") : tr("playfulShell.dailyGoal")}
                    </div>
                    <h2 style={{margin:"0 0 8px",fontSize:22,fontWeight:900,color:"#fff",lineHeight:1.25,letterSpacing:"-0.3px"}}>
                      {heroTitle}
                    </h2>
                    <p style={{margin:"0 0 18px",fontSize:13,color:"rgba(255,255,255,0.85)",lineHeight:1.5}}>
                      {heroSub}
                    </p>
                    <button className="pf-btn" onClick={heroBtn.action}
                      style={{background:"rgba(255,255,255,0.95)",color:hasLive?"#FF6B6B":d.homeworkPending>0?"#4D96FF":"#FF6B9D",border:"none",borderRadius:999,padding:"10px 24px",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"Poppins,sans-serif",display:"inline-flex",alignItems:"center",gap:6,boxShadow:"0 4px 14px rgba(0,0,0,0.15)"}}>
                      <Play size={14} fill="currentColor"/> {heroBtn.label}
                    </button>
                  </div>

                  {/* Emoji characters */}
                  {!isMobile && <div style={{zIndex:1,display:"flex",gap:8,alignItems:"flex-end",paddingRight:8}}>
                    {heroEmojis.map((e,i)=>(
                      <div key={i} style={{
                        fontSize:i===1?56:40, lineHeight:1,
                        transform:i===0?"rotate(-12deg)":i===2?"rotate(10deg)":"none",
                        filter:"drop-shadow(0 6px 12px rgba(0,0,0,0.2))",
                        marginBottom:i===1?0:8,
                        animation:`float${i} 3s ease-in-out infinite`,
                      }}>{e}</div>
                    ))}
                  </div>}
                  <style>{`
                    @keyframes float0{0%,100%{transform:translateY(0) rotate(-12deg)}50%{transform:translateY(-8px) rotate(-12deg)}}
                    @keyframes float1{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
                    @keyframes float2{0%,100%{transform:translateY(0) rotate(10deg)}50%{transform:translateY(-6px) rotate(10deg)}}
                  `}</style>
                </div>

                {/* ── CATEGORY TILES ── */}
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                    <h2 style={{margin:0,fontSize:16,fontWeight:800,color:P.text}}>{tr("playfulShell.lessonCategories")}</h2>
                    <span style={{fontSize:13,color:P.textMuted}}>{tr("playfulShell.pickWhereToContinue")}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",gap:12}}>
                    {TILES.map(tile=>{
                      const badge = tile.tab==="homework" ? d.homeworkPending : tile.tab==="quiz" ? d.quizPending : 0;
                      return (
                        <div key={tile.tab} className="pf-tile"
                          onClick={()=>d.setActiveTab(tile.tab)}
                          style={{
                            background:`linear-gradient(135deg,${tile.g[0]},${tile.g[1]})`,
                            borderRadius:20, padding:"20px 16px",
                            display:"flex", flexDirection:"column", alignItems:"center",
                            textAlign:"center", gap:8, position:"relative",
                            boxShadow:`0 4px 16px ${tile.g[0]}44`,
                            minHeight:110,
                          }}>
                          {/* Badge */}
                          {badge>0 && (
                            <span style={{position:"absolute",top:10,right:10,background:"rgba(255,255,255,0.95)",color:tile.g[0],borderRadius:999,fontSize:10,fontWeight:800,minWidth:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 6px rgba(0,0,0,0.15)"}}>
                              {badge}
                            </span>
                          )}
                          {/* Icon circle */}
                          <div style={{width:50,height:50,borderRadius:16,background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,backdropFilter:"blur(4px)"}}>
                            {tile.emoji}
                          </div>
                          <span style={{fontSize:12,fontWeight:700,color:"#fff",letterSpacing:"0.2px"}}>{tile.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── ACTIVE CLASSES ── */}
                <div className="pf-card" style={{background:P.card,borderRadius:20,padding:20,border:`1px solid ${P.border}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                    <h2 style={{margin:0,fontSize:15,fontWeight:800,color:P.text}}>{tr("playfulShell.activeClasses")}</h2>
                    {d.activeClasses.length>0&&<span style={{background:"#FEE2E2",color:P.red,borderRadius:999,padding:"2px 10px",fontSize:11,fontWeight:700}}>{tr("playfulShell.live", { activeClassesCount: d.activeClasses.length })}</span>}
                  </div>
                  {d.activeClasses.length===0
                    ? <div style={{textAlign:"center",padding:"16px 0",color:P.textMuted}}><div style={{fontSize:28,marginBottom:6}}>📡</div><p style={{margin:0,fontSize:13}}>{tr("playfulShell.noLiveClassesRightNow")}</p></div>
                    : <ActiveClasses activeClasses={d.activeClasses} onJoin={d.handleJoinClass}/>
                  }
                </div>
              </div>

              {/* RIGHT PANEL */}
              <div style={{width: isMobile ? "100%" : 290,flexShrink:0,display:"flex",flexDirection:"column",gap:16}}>

                {/* Stats row */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[
                    {label:tr("playfulShell.classesDone"), value:d.progress.completedLessons, emoji:"🎓", g:[P.blue,P.teal]},
                    {label:tr("playfulShell.dayStreak"),   value:d.progress.streakDays,       emoji:"🔥", g:[P.coral,P.orange]},
                    {label:tr("playfulShell.remaining"),    value:d.progress.classesRemaining, emoji:"📅", g:[P.pink,P.indigo]},
                    {label:tr("playfulShell.thisWeek"),    value:d.progress.weeklyCompleted,  emoji:"⚡", g:[P.green,P.teal]},
                  ].map(s=>(
                    <div key={s.label} style={{background:`linear-gradient(135deg,${s.g[0]},${s.g[1]})`,borderRadius:16,padding:"14px 12px",textAlign:"center",boxShadow:`0 4px 14px ${s.g[0]}44`}}>
                      <div style={{fontSize:22,marginBottom:4}}>{s.emoji}</div>
                      <div style={{fontSize:22,fontWeight:900,color:"#fff",lineHeight:1}}>{s.value}</div>
                      <div style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.8)",marginTop:2}}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* What's New */}
                <div className="pf-card" style={{background:P.card,borderRadius:20,border:`1px solid ${P.border}`,overflow:"hidden"}}>
                  <div style={{padding:"16px 18px 12px",borderBottom:`1px solid ${P.border}`}}>
                    <h3 style={{margin:0,fontSize:14,fontWeight:800,color:P.text}}>{tr("playfulShell.whatSNew")}</h3>
                    <p style={{margin:"2px 0 0",fontSize:12,color:P.textMuted}}>{tr("playfulShell.latestUpdatesForYou")}</p>
                  </div>
                  <div style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:10,maxHeight:280,overflowY:"auto"}}>
                    {/* Upcoming classes */}
                    {d.upcomingClasses.length===0 && d.notifications.length===0 && d.homeworkPending===0 ? (
                      <div style={{textAlign:"center",padding:16,color:P.textMuted}}>
                        <div style={{fontSize:28,marginBottom:6}}>🎉</div>
                        <p style={{margin:0,fontSize:12}}>{tr("playfulShell.allClearNothingNewRight")}</p>
                      </div>
                    ) : (
                      <>
                        {d.homeworkPending>0 && (
                          <WhatsNewItem emoji="📚" title={tr("playfulShell.homeworkAssignment", { homeworkPending: d.homeworkPending, value: d.homeworkPending>1?"s":"" })} sub={tr("playfulShell.dueSoonYourTeacherIs")} bg="#FFF1EE" onClick={()=>d.setActiveTab("homework")} P={P}/>
                        )}
                        {d.quizPending>0 && (
                          <WhatsNewItem emoji="🎯" title={tr("playfulShell.newQuiz", { quizPending: d.quizPending, value: d.quizPending>1?"zes":"" })} sub={tr("playfulShell.testYourKnowledge")} bg="#EEF3FF" onClick={()=>d.setActiveTab("quiz")} P={P}/>
                        )}
                        {d.upcomingClasses.slice(0,3).map((cls,i)=>(
                          <WhatsNewItem key={cls.id||i} emoji="📅" title={cls.title} sub={`${cls.teacher} · ${cls.time}`} bg="#EDFFF6" P={P}/>
                        ))}
                        {d.notifications.slice(0,3).map(n=>(
                          <WhatsNewItem key={n.id} emoji="🔔" title={n.message} sub={n.time||""} bg="#F4F5FF" P={P}/>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Upcoming classes full card */}
                <div className="pf-card" style={{background:P.card,borderRadius:20,padding:18,border:`1px solid ${P.border}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <h3 style={{margin:0,fontSize:14,fontWeight:800,color:P.text}}>{tr("playfulShell.upcoming")}</h3>
                    <button onClick={()=>d.setActiveTab("schedule")} style={{background:"none",border:"none",color:P.blue,fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>
                      {tr("playfulShell.all")} <ChevronRight size={13}/>
                    </button>
                  </div>
                  {d.upcomingClasses.length===0
                    ? <div style={{textAlign:"center",padding:"12px 0",color:P.textMuted,fontSize:12}}>{tr("playfulShell.noUpcomingClassesScheduled")}</div>
                    : <UpcomingClasses upcomingClasses={d.upcomingClasses.slice(0,3)} onEnroll={()=>d.showToast("Coming soon!")}/>
                  }
                </div>

                {/* Streak */}
                <StreakWidget isDarkMode={d.isDarkMode} onLoad={d.handleStreakLoaded}/>

                {/* Recent badges */}
                {d.badges.length>0&&(
                  <div className="pf-card" style={{background:P.card,borderRadius:20,padding:16,border:`1px solid ${P.border}`}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <h3 style={{margin:0,fontSize:14,fontWeight:800,color:P.text}}>{tr("playfulShell.badges2")}</h3>
                      <button onClick={()=>d.setActiveTab("badges")} style={{background:"none",border:"none",color:P.pink,fontWeight:700,fontSize:12,cursor:"pointer"}}>{tr("playfulShell.seeAll")}</button>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {d.badges.slice(-6).map(b=>(
                        <div key={b.id} title={b.name} style={{textAlign:"center"}}>
                          <div style={{fontSize:26}}>{b.icon}</div>
                          <p style={{margin:"2px 0 0",fontSize:9,color:P.textMuted,maxWidth:40}}>{b.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ HOMEWORK ════ */}
          {d.activeTab==="homework"&&<div style={{background:P.card,borderRadius:20,padding:24,border:`1px solid ${P.border}`}}><StudentHomeworkTab studentInfo={d.student} isDarkMode={d.isDarkMode}/></div>}

          {/* ════ QUIZ ════ */}
          {d.activeTab==="quiz"&&<div style={{background:P.card,borderRadius:20,padding:24,border:`1px solid ${P.border}`}}><StudentQuizTab studentInfo={d.student} isDarkMode={d.isDarkMode}/></div>}

          {/* ════ FLASHCARDS ════ */}
          {d.activeTab==="flashcards"&&<FlashcardsTab isDarkMode={d.isDarkMode}/>}

          {/* ════ PRONUNCIATION ════ */}
          {d.activeTab==="pronunciation"&&<div style={{background:P.card,borderRadius:20,padding:24,border:`1px solid ${P.border}`}}><PronunciationTab isDarkMode={d.isDarkMode}/></div>}

          {/* ════ CONVERSATION ════ */}
          {d.activeTab==="conversation"&&<div style={{background:P.card,borderRadius:20,padding:24,border:`1px solid ${P.border}`}}><ConversationTab studentInfo={d.student} isDarkMode={d.isDarkMode}/></div>}

          {/* ════ MESSAGES ════ */}
          {d.activeTab==="messages"&&<div style={{background:P.card,borderRadius:20,border:`1px solid ${P.border}`,overflow:"hidden"}}><MessagesTab userRole="student" onUnreadCount={d.setUnreadMessages}/></div>}

          {/* ════ COMPLETED ════ */}
          {d.activeTab==="completed-classes"&&<div style={{background:P.card,borderRadius:20,padding:24,border:`1px solid ${P.border}`}}><StudentCompletedTab studentId={d.student.id} isDarkMode={d.isDarkMode}/></div>}

          {/* ════ SCHEDULE ════ */}
          {d.activeTab==="schedule"&&<div style={{background:P.card,borderRadius:20,padding:24,border:`1px solid ${P.border}`}}><StudentScheduleTab studentId={d.student.id} isDarkMode={d.isDarkMode}/></div>}
          {/* ════ CLASS REPORTS ════ */}
          {d.activeTab==="class-reports"&&<div style={{background:P.card,borderRadius:20,padding:24,border:`1px solid ${P.border}`}}><ClassReportsTab isDarkMode={d.isDarkMode}/></div>}
          {/* ════ BOOK A CLASS ════ */}
          {d.activeTab==="book-class"&&<div style={{background:P.card,borderRadius:20,padding:24,border:`1px solid ${P.border}`}}><BookingCalendarTab isDarkMode={d.isDarkMode} studentInfo={d.student}/></div>}

          {/* ════ CHARTS ════ */}
          {d.activeTab==="charts"&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",gap:12}}>
                {[
                  {label:tr("playfulShell.totalClasses"),value:d.completedClasses.length,g:[P.blue,P.teal],emoji:"🎓"},
                  {label:tr("playfulShell.dayStreak"),   value:d.progress.streakDays,    g:[P.coral,P.orange],emoji:"🔥"},
                  {label:tr("playfulShell.totalHours"),  value:d.completedClasses.length>0?Math.round(d.completedClasses.reduce((s,c)=>s+c.duration,0)/60):0, g:[P.pink,P.indigo],emoji:"⏱️"},
                ].map(({label,value,g,emoji})=>(
                  <div key={label} style={{background:`linear-gradient(135deg,${g[0]},${g[1]})`,borderRadius:20,padding:20,textAlign:"center",boxShadow:`0 6px 20px ${g[0]}44`}}>
                    <div style={{fontSize:28,marginBottom:8}}>{emoji}</div>
                    <div style={{fontSize:32,fontWeight:900,color:"#fff",marginBottom:4}}>{value}</div>
                    <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.85)"}}>{label}</div>
                  </div>
                ))}
              </div>
              {[{title:tr("playfulShell.last7Days"),data:d.chartData.last7,type:"bar"},{title:tr("playfulShell.last30Days"),data:d.chartData.last30,type:"line"}].map(({title,data,type})=>(
                <div key={title} style={{background:P.card,borderRadius:20,padding:20,border:`1px solid ${P.border}`}}>
                  <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:800,color:P.text}}>{title}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    {type==="bar"
                      ? <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={P.border}/><XAxis dataKey="date" stroke={P.textMuted} style={{fontSize:11}}/><YAxis stroke={P.textMuted} style={{fontSize:11}}/><RechartsTip contentStyle={tipStyle}/><Bar dataKey="classes" radius={[8,8,0,0]} name="Classes"><Cell fill={`url(#barGrad)`}/>{data.map((_,i)=><Cell key={i} fill={[P.pink,P.blue,P.orange,P.green,P.teal,P.indigo,P.coral][i%7]}/>)}</Bar></BarChart>
                      : <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={P.border}/><XAxis dataKey="date" stroke={P.textMuted} style={{fontSize:11}}/><YAxis stroke={P.textMuted} style={{fontSize:11}}/><RechartsTip contentStyle={tipStyle}/><Line type="monotone" dataKey="classes" stroke={P.pink} strokeWidth={3} dot={{fill:P.pink,r:5}} name="Classes"/></LineChart>
                    }
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}

          {/* ════ BADGES ════ */}
          {d.activeTab==="badges"&&<PlayfulBadgesPanel badges={d.badges} progress={d.progress} completedClasses={d.completedClasses} shareAchievement={d.shareAchievement} P={P}/>}

          {/* ════ RECORDINGS ════ */}
          {d.activeTab==="recordings"&&<RecordingsTab isDarkMode={d.isDarkMode}/>}

          {/* ════ REVIEWS ════ */}
          {d.activeTab==="reviews"&&<ReviewsTab isDarkMode={d.isDarkMode}/>}

          {/* ════ REFERRAL ════ */}
          {d.activeTab==="referral"&&<ReferralTab isDarkMode={d.isDarkMode}/>}
          {d.activeTab==="leaderboard"&&<LeaderboardTab isDarkMode={d.isDarkMode}/>}
        </main>
      </div>

      {/* ── SETTINGS DRAWER ── */}
      {showSettings&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:9000,display:"flex",justifyContent:"flex-end"}} onClick={()=>setShowSettings(false)}>
          <div style={{width:320,background:P.white,height:"100%",padding:28,overflowY:"auto",boxShadow:"-6px 0 32px rgba(0,0,0,0.15)"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
              <h2 style={{margin:0,fontSize:18,fontWeight:800,color:P.text}}>{tr("playfulShell.settings")}</h2>
              <button onClick={()=>setShowSettings(false)} style={{background:P.inputBg,border:"none",borderRadius:10,width:32,height:32,cursor:"pointer",fontSize:16,color:P.text}}>✕</button>
            </div>

            {/* Profile card */}
            <div style={{background:`linear-gradient(135deg,${P.pink},${P.orange})`,borderRadius:16,padding:18,marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:46,height:46,borderRadius:14,background:"rgba(255,255,255,0.3)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:20}}>
                {(d.student.firstName?.[0]||"S").toUpperCase()}
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{d.student.name}</div>
                {d.student.studentId && (
                  <div style={{fontSize:10,fontFamily:"monospace",fontWeight:700,color:"rgba(255,255,255,0.7)",letterSpacing:"0.05em"}}>{d.student.studentId}</div>
                )}
                <div style={{fontSize:12,color:"rgba(255,255,255,0.8)"}}>{d.student.email||tr("playfulShell.student")}</div>
              </div>
            </div>

            {/* Dark mode toggle */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:P.settingRow,borderRadius:12,marginBottom:8,border:`1px solid ${P.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {d.isDarkMode?<Moon size={15} color={P.pink}/>:<Sun size={15} color={P.orange}/>}
                <span style={{fontSize:14,color:P.text,fontWeight:600}}>{d.isDarkMode?tr("playfulShell.darkMode"):tr("playfulShell.lightMode")}</span>
              </div>
              <button onClick={()=>d.setIsDarkMode(v=>!v)}
                style={{width:44,height:24,borderRadius:999,border:"none",cursor:"pointer",background:d.isDarkMode?P.pink:P.border,position:"relative",transition:"background .2s"}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:d.isDarkMode?23:3,transition:"left .2s"}}/>
              </button>
            </div>

            {[
              {Icon:KeyRound,label:tr("playfulShell.changePassword"),action:()=>{setShowSettings(false);d.setShowChangePassword(true);}},
              {Icon:Shield,  label:tr("playfulShell.sessionManagement"),action:()=>{setShowSettings(false);d.setShowSessionManagement(true);}},
              {Icon:Settings,label:tr("playfulShell.security2fa"),action:()=>{setShowSettings(false);setShow2FA(true);}},
            ].map(({Icon,label,action})=>(
              <button key={label} onClick={action}
                style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:P.settingRow,border:`1px solid ${P.border}`,borderRadius:12,marginBottom:8,cursor:"pointer",fontFamily:"Poppins,sans-serif",fontSize:14,color:P.text,fontWeight:500}}>
                <Icon size={16} color={P.pink}/>{label}<ChevronRight size={14} style={{marginLeft:"auto",color:P.textMuted}}/>
              </button>
            ))}

            <button onClick={d.handleLogout}
              style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:13,background:`linear-gradient(135deg,${P.coral},${P.orange})`,border:"none",borderRadius:12,cursor:"pointer",color:"#fff",fontWeight:800,fontSize:14,marginTop:16,fontFamily:"Poppins,sans-serif",boxShadow:`0 4px 16px ${P.coral}55`}}>
              <LogOut size={16}/> {tr("playfulShell.signOut2")}
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
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
        <nav style={{ position:'fixed', bottom:0, left:0, right:0, height:60, background:P.sidebar, borderTop:'1px solid rgba(255,255,255,0.1)', display:'flex', zIndex:200, boxShadow:'0 -4px 20px rgba(0,0,0,0.3)' }}>
          {[
            { key:'dashboard', Icon:Home,          label:tr("playfulShell.home"),    dot:P.pink   },
            { key:'homework',  Icon:BookOpen,       label:tr("playfulShell.study"),   dot:P.blue   },
            { key:'messages',  Icon:MessageSquare,  label:tr("playfulShell.chat"),    dot:P.green  },
            { key:'schedule',  Icon:CalendarDays,   label:tr("playfulShell.classes"), dot:P.teal   },
          ].map(({ key, Icon, label, dot }) => {
            const isActive = d.activeTab === key || (key==='homework' && ['homework','quiz','flashcards'].includes(d.activeTab));
            return (
              <button key={key} onClick={() => d.setActiveTab(key)}
                style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, border:'none', background:'transparent', cursor:'pointer', fontFamily:"'Poppins',sans-serif", color: isActive ? dot : 'rgba(255,255,255,0.5)', borderTop: isActive ? `3px solid ${dot}` : '3px solid transparent' }}>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                <span style={{ fontSize:10, fontWeight: isActive ? 700 : 500 }}>{label}</span>
              </button>
            );
          })}
          <button onClick={() => setShowMobileMenu(true)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, border:'none', background:'transparent', cursor:'pointer', fontFamily:"'Poppins',sans-serif", color:'rgba(255,255,255,0.5)', borderTop:'3px solid transparent' }}>
            <MoreHorizontal size={20} strokeWidth={1.8} />
            <span style={{ fontSize:10, fontWeight:500 }}>{tr("playfulShell.more")}</span>
          </button>
        </nav>
      )}

      {/* ── MOBILE MENU SHEET ── */}
      {isMobile && showMobileMenu && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9500 }} onClick={() => setShowMobileMenu(false)}>
          <div style={{ position:'absolute', bottom:0, left:0, right:0, background:P.white, borderRadius:'20px 20px 0 0', padding:'12px 16px 44px', maxHeight:'78vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, background:P.border, borderRadius:999, margin:'0 auto 16px' }} />
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {NAV.filter(n => !['dashboard','messages','classes'].includes(n.id)).flatMap(n => n.tabs).map(tab => {
                const navItem = NAV.find(n => n.tabs.includes(tab));
                const isActive = d.activeTab === tab;
                const label = {homework:'Homework',quiz:'Quizzes',flashcards:'Flashcards',pronunciation:'Speaking',conversation:'AI Chat','completed-classes':'Completed',charts:'Charts',badges:'Badges',recordings:'Recordings',reviews:'Reviews',referral:'Invite',leaderboard:'Leaderboard'}[tab] || tab;
                if (!navItem) return null;
                const Icon = navItem.Icon;
                return (
                  <button key={tab} onClick={() => { d.setActiveTab(tab); setShowMobileMenu(false); }}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:14, border:'none', background: isActive ? P.inputBg : 'transparent', color: isActive ? P.pink : P.text, cursor:'pointer', fontFamily:"'Poppins',sans-serif", width:'100%', fontSize:14, fontWeight: isActive ? 700 : 500 }}>
                    <Icon size={18} color={isActive ? P.pink : P.textMuted} strokeWidth={1.8} />
                    {label}
                  </button>
                );
              })}
              <div style={{ borderTop:`1px solid ${P.border}`, margin:'8px 0 4px' }} />
              <button onClick={() => { setShowMobileMenu(false); setShowSettings(true); }}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:14, border:'none', background:'transparent', color:P.text, cursor:'pointer', fontFamily:"'Poppins',sans-serif", width:'100%', fontSize:14, fontWeight:500 }}>
                <Settings size={18} color={P.textMuted} strokeWidth={1.8} />
                {tr("playfulShell.settings")}
              </button>
              <button onClick={d.handleLogout}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:14, border:'none', background:'transparent', color:P.coral, cursor:'pointer', fontFamily:"'Poppins',sans-serif", width:'100%', fontSize:14, fontWeight:600 }}>
                <LogOut size={18} color={P.coral} strokeWidth={1.8} />
                {tr("playfulShell.signOut2")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {d.toast&&(
        <div style={{position:"fixed",bottom:24,right:24,zIndex:99999,background:d.toast.type==="error"?P.coral:P.green,color:"#fff",borderRadius:16,padding:"12px 20px",fontSize:14,fontWeight:700,boxShadow:"0 6px 24px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",gap:8,fontFamily:"Poppins,sans-serif"}}>
          {d.toast.type==="error"?"✕":"✓"} {d.toast.message}
        </div>
      )}

      {/* Share modal */}
      {d.showShareModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
          <div style={{background:P.white,borderRadius:24,padding:28,maxWidth:400,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.25)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{margin:0,fontSize:18,fontWeight:800,color:P.text}}>{tr("playfulShell.shareAchievement")}</h3>
              <button onClick={()=>d.setShowShareModal(false)} style={{background:P.inputBg,border:"none",borderRadius:10,width:32,height:32,cursor:"pointer",fontSize:16,color:P.text}}>✕</button>
            </div>
            <div style={{background:`linear-gradient(135deg,${P.pink}22,${P.orange}22)`,border:`1px solid ${P.pink}33`,borderRadius:14,padding:16,marginBottom:16}}>
              <h4 style={{margin:"0 0 4px",fontWeight:800,color:P.text}}>{d.shareData?.title}</h4>
              <p style={{margin:0,fontSize:14,color:P.textSub}}>{d.shareData?.message}</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={d.copyShareText} style={{width:"100%",padding:11,border:`1.5px solid ${P.border}`,borderRadius:999,background:"transparent",color:P.text,fontWeight:700,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"Poppins,sans-serif"}}>
                <Copy size={14}/> {tr("playfulShell.copyToClipboard")}
              </button>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["twitter","Twitter","#1DA1F2"],["facebook","Facebook","#1877F2"],["whatsapp","WhatsApp","#25D366"],["linkedin","LinkedIn","#0A66C2"]].map(([p,label,bg])=>(
                  <button key={p} onClick={()=>d.shareOnSocial(p)} style={{padding:10,background:bg,color:"#fff",border:"none",borderRadius:999,fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"Poppins,sans-serif"}}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── What's New list item ───────────────────────────────────────────────────────
function WhatsNewItem({ emoji, title, sub, bg, onClick, P }) {
  return (
    <div onClick={onClick}
      style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:12,background:bg,cursor:onClick?"pointer":"default",transition:"transform .1s"}}
      onMouseEnter={e=>onClick&&(e.currentTarget.style.transform="scale(1.01)")}
      onMouseLeave={e=>onClick&&(e.currentTarget.style.transform="scale(1)")}>
      <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
        {emoji}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:700,color:P.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
        {sub&&<div style={{fontSize:11,color:P.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</div>}
      </div>
      {onClick&&<ChevronRight size={13} color={P.textMuted}/>}
    </div>
  );
}
