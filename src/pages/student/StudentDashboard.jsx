// src/pages/student/StudentDashboard.jsx
// Kid-friendly redesign — same logic, same API calls, same state as original.
// Aesthetic: warm sunshine palette, bubbly rounded cards, playful Nunito font,
// bouncy animations, stars/emojis throughout. Full dark-mode support.

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings, Search, Download, Calendar, Clock, User,
  Award, Trophy, Star, TrendingUp, Share2, Bell,
  Sun, MessageCircle, Moon, X, Check, AlertTriangle,
  Rocket, BookOpen, Sparkles, Heart, Zap, ChevronLeft, ChevronRight
} from "lucide-react";
import Confetti from "react-confetti";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import api from "../../api";
import Header from "./components/Header";
import WelcomeSection from "./components/WelcomeSection";
import ActiveClasses from "./components/ActiveClasses";
import UpcomingClasses from "./components/UpcomingClasses";
import ProgressCard from "./components/ProgressCard";
import QuickActions from "./components/QuickActions";
import NotificationsCard from "./components/NotificationsCard";
import ChangePassword from "../../components/student/auth/ChangePassword";
import SessionManagement from "../../components/SessionManagement";
import SettingsSidebar from "../../components/SettingsSidebar";
import SettingsModal from "../../components/SettingsModal";
import Classroom from "../Classroom";
import MessagesTab from "../../components/chat/MessagesTab";
import ClassConfirmation from "../../components/student/ClassConfirmation";
import jsPDF from "jspdf";
import "jspdf-autotable";
import StudentCompletedTab from "./tabs/StudentCompletedTab";
import { getStudentBookings } from "../../services/bookingService";

// ── Badge definitions (unchanged) ────────────────────────────────────────────
const BADGE_DEFINITIONS = [
  { id: "first_class",  name: "First Steps",      icon: "🎯", requirement: 1,   description: "Complete your first class" },
  { id: "streak_5",     name: "5-Day Warrior",     icon: "🔥", requirement: 5,   description: "5 consecutive days of learning",  type: "streak" },
  { id: "streak_10",    name: "10-Day Champion",   icon: "⚡", requirement: 10,  description: "10 consecutive days of learning", type: "streak" },
  { id: "streak_30",    name: "30-Day Legend",     icon: "👑", requirement: 30,  description: "30 consecutive days of learning", type: "streak" },
  { id: "total_5",      name: "Getting Started",   icon: "🌟", requirement: 5,   description: "Complete 5 total classes",        type: "total"  },
  { id: "total_10",     name: "Dedicated Learner", icon: "📚", requirement: 10,  description: "Complete 10 total classes",       type: "total"  },
  { id: "total_25",     name: "Expert Student",    icon: "🎓", requirement: 25,  description: "Complete 25 total classes",       type: "total"  },
  { id: "total_50",     name: "Master Scholar",    icon: "🏆", requirement: 50,  description: "Complete 50 total classes",       type: "total"  },
  { id: "total_100",    name: "Century Club",      icon: "💯", requirement: 100, description: "Complete 100 total classes",      type: "total"  },
  { id: "weekly_5",     name: "Weekly Hero",       icon: "⭐", requirement: 5,   description: "5 classes in one week",           type: "weekly" },
  { id: "early_bird",   name: "Early Bird",        icon: "🌅", requirement: 1,   description: "Attend a morning class (before 9 AM)", type: "special" },
  { id: "night_owl",    name: "Night Owl",         icon: "🦉", requirement: 1,   description: "Attend an evening class (after 8 PM)", type: "special" },
];

// ── Colour palette helper ─────────────────────────────────────────────────────
const c = (dark) => ({
  bg:       dark ? "#0f1117" : "#fff8f0",
  card:     dark ? "#1a1d2e" : "#ffffff",
  cardAlt:  dark ? "#1f2235" : "#fffbf5",
  border:   dark ? "#2a2d40" : "#ffe8cc",
  heading:  dark ? "#f0f4ff" : "#2d1f6e",
  body:     dark ? "#c8cce0" : "#4a4060",
  muted:    dark ? "#6b7090" : "#9b8ab0",
  accent:   dark ? "#fbbf24" : "#f97316",
  accentBg: dark ? "rgba(251,191,36,0.12)" : "#fff7ed",
  blue:     dark ? "#60a5fa" : "#3b82f6",
  green:    dark ? "#34d399" : "#10b981",
  pink:     dark ? "#f472b6" : "#ec4899",
  purple:   dark ? "#a78bfa" : "#7c3aed",
});

// ── Nav tab config ────────────────────────────────────────────────────────────
const TABS = [
  { key: "dashboard",         label: "🏠 Home",       emoji: "🏠" },
  { key: "completed-classes", label: "✅ Completed",   emoji: "✅" },
  { key: "badges",            label: "🏅 Badges",      emoji: "🏅" },
  { key: "charts",            label: "📊 Progress",    emoji: "📊" },
  { key: "messages",          label: "💬 Messages",    emoji: "💬" },
  
];

// ─────────────────────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const navigate = useNavigate();

  // ── Modal / UI state ──────────────────────────────────────────────────────
  const [showChangePassword,   setShowChangePassword]   = useState(false);
  const [showSessionManagement,setShowSessionManagement]= useState(false);
  const [showSettingsSidebar,  setShowSettingsSidebar]  = useState(false);
  const [showSettingsModal,    setShowSettingsModal]    = useState(false);
  const [toast,                setToast]                = useState(null);
  const [loading,              setLoading]              = useState(true);
  const [showCelebration,      setShowCelebration]      = useState(false);
  const [celebrationMessage,   setCelebrationMessage]   = useState("");
  const [celebrationEmoji,     setCelebrationEmoji]     = useState("");
  const [badges,               setBadges]               = useState([]);
  const [newBadge,             setNewBadge]             = useState(null);
  const [showShareModal,       setShowShareModal]       = useState(false);
  const [shareData,            setShareData]            = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [activeTab,            setActiveTab]            = useState("dashboard");
  const [isClassroomOpen,      setIsClassroomOpen]      = useState(false);
  const [activeClass,          setActiveClass]          = useState(null);
  const [pendingConfirmations, setPendingConfirmations] = useState([]);
  const [showConfirmationModal,setShowConfirmationModal]= useState(false);
  const [selectedConfirmation, setSelectedConfirmation] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem("darkMode") === "true"
  );

  // ── Student info ──────────────────────────────────────────────────────────
  const [student, setStudent] = useState(() => {
    const raw = localStorage.getItem("studentInfo");
    if (raw) {
      const p = JSON.parse(raw);
      return {
        id: p._id || p.id,
        firstName: p.firstName || "",
        surname: p.surname || p.lastName || "",
        name: `${p.firstName || ""} ${p.surname || p.lastName || ""}`.trim(),
        email: p.email,
        noOfClasses: p.noOfClasses || 0,
        level: "Intermediate",
      };
    }
    return { name: "Student", firstName: "Student", surname: "", level: "Intermediate" };
  });

  // ── Data state ────────────────────────────────────────────────────────────
  const [activeClasses,    setActiveClasses]    = useState([]);
  const [upcomingClasses,  setUpcomingClasses]  = useState([]);
  const [completedClasses, setCompletedClasses] = useState([]);
  const [progress,         setProgress]         = useState({
    completedLessons: 0, totalLessons: 0, streakDays: 0,
    weeklyGoal: 5, weeklyCompleted: 0, classesRemaining: 0,
  });
  const [notifications,  setNotifications]  = useState([]);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [startDate,      setStartDate]      = useState("");
  const [endDate,        setEndDate]        = useState("");
  const [currentPage,    setCurrentPage]    = useState(1);
  const itemsPerPage = 10;

  const col = c(isDarkMode);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("darkMode", isDarkMode);
  }, [isDarkMode]);

  useEffect(() => { fetchStudentData(); }, []);

  useEffect(() => { checkForCelebrationAndBadges(); }, [completedClasses, progress.streakDays]);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
      if (localStorage.getItem("notificationsEnabled") === "true")
        setNotificationsEnabled(true);
    }
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getTimeRemaining = (autoConfirmAt) => {
    if (!autoConfirmAt) return "Unknown";
    const diff = new Date(autoConfirmAt) - new Date();
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const calculateStreakDays = (completedBookings) => {
    if (!completedBookings.length) return 0;
    const sorted = completedBookings
      .map((b) => new Date(b.scheduledTime))
      .sort((a, b) => b - a);
    const today = new Date(); today.setHours(0,0,0,0);
    const recent = new Date(sorted[0]); recent.setHours(0,0,0,0);
    if (Math.floor((today - recent) / 86400000) > 1) return 0;
    let streak = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = new Date(sorted[i]); a.setHours(0,0,0,0);
      const b = new Date(sorted[i+1]); b.setHours(0,0,0,0);
      const d = Math.floor((a - b) / 86400000);
      if (d === 1) streak++; else if (d > 1) break;
    }
    return streak;
  };

  const calculateWeeklyCompleted = (completedBookings) => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return completedBookings.filter((b) => new Date(b.scheduledTime) >= weekAgo).length;
  };

  // ── Fetch data (unchanged logic) ──────────────────────────────────────────
  const fetchStudentData = async () => {
    try {
      setLoading(true);
      const studentId = student.id;
      if (!studentId) { showToast("Please login again.", "error"); handleLogout(); return; }

      const [accepted, completed, pendingConf] = await Promise.all([
        getStudentBookings(studentId, "accepted"),
        getStudentBookings(studentId, "completed"),
        getStudentBookings(studentId, "pending_confirmation"),
      ]);

      setPendingConfirmations(
        pendingConf.map((b) => ({
          id: b._id, bookingId: b._id,
          title: b.classTitle,
          teacher: `${b.teacherId.firstName} ${b.teacherId.lastName}`,
          scheduledTime: b.scheduledTime, duration: b.duration,
          teacherConfirmedAt: b.teacherConfirmedAt, autoConfirmAt: b.autoConfirmAt,
          topic: b.topic || "English Lesson",
        }))
      );

      const now = new Date();
      const active = [], upcoming = [];

      accepted.forEach((booking) => {
        const sd = new Date(booking.scheduledTime);
        const diff = sd - now;
        const data = {
          id: booking._id, bookingId: booking._id,
          title: booking.classTitle,
          teacher: `${booking.teacherId.firstName} ${booking.teacherId.lastName}`,
          teacherId: booking.teacherId._id,
          topic: booking.topic || "English Lesson",
          scheduledTime: booking.scheduledTime, scheduledDate: sd,
          duration: booking.duration || 30, notes: booking.notes || "",
        };
        if (diff < 900000 && diff > -(booking.duration * 60000)) {
          active.push({ ...data, time: sd.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true}), status: diff < 0 ? "live" : "starting-soon", participants:1, maxParticipants:12 });
        } else if (diff > 0 && diff < 7200000) {
          active.push({ ...data, time: sd.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true}), status:"starting-soon", participants:1, maxParticipants:12 });
        } else if (diff > 0) {
          upcoming.push({ ...data, time: sd.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:true}), enrolled:true });
        }
      });

      const completedList = completed.map((b) => ({
        id: b._id, bookingId: b._id, title: b.classTitle,
        teacher: `${b.teacherId.firstName} ${b.teacherId.lastName}`,
        topic: b.topic || "Completed Lesson",
        scheduledTime: b.scheduledTime, scheduledDate: new Date(b.scheduledTime),
        fullDateTime: new Date(b.scheduledTime).toLocaleString("en-US",{weekday:"short",year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:true}),
        duration: b.duration || 60, notes: b.notes || "", status: "completed",
      }));

      setActiveClasses(active);
      setUpcomingClasses(upcoming);
      setCompletedClasses(completedList);

      const weeklyCompleted = calculateWeeklyCompleted(completedList);

      const streakDays = calculateStreakDays(completedList);

      // ✅ Fetch LIVE student data — localStorage goes stale after classes are deducted
      let classesRemaining = 0;
      try {
        const { data: freshStudent } = await api.get(`/api/students/${studentId}`);
        classesRemaining = freshStudent?.noOfClasses || 0;
        // Keep localStorage in sync
        const stored = JSON.parse(localStorage.getItem("studentInfo") || "{}");
        localStorage.setItem("studentInfo", JSON.stringify({ ...stored, noOfClasses: classesRemaining }));
      } catch {
        classesRemaining = JSON.parse(localStorage.getItem("studentInfo") || "{}").noOfClasses || 0;
      }

      const completedCount = completedList.length;
      const totalPaid = completedCount + classesRemaining;

      setProgress({
        completedLessons: completedCount,
        totalLessons: totalPaid,
        classesRemaining: classesRemaining,
        streakDays,
        weeklyGoal: 5,
        weeklyCompleted,
      });

      

      const notifs = [];
      active.forEach((cls) => {
        if (cls.status === "starting-soon")
          notifs.push({ id:`class-${cls.id}`, type:"class", message:`${cls.title} starts soon!`, time: cls.time, read: false });
      });
      if (notifs.length) setNotifications((prev) => [...notifs, ...prev]);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch student data:", err);
      showToast("Failed to load your classes", "error");
      setLoading(false);
    }
  };

  // ── Badges ────────────────────────────────────────────────────────────────
  const checkEarnedBadges = (count, streak, weekly, list) => {
    return BADGE_DEFINITIONS.filter((b) => {
      if (b.type === "streak") return streak >= b.requirement;
      if (b.type === "total")  return count >= b.requirement;
      if (b.type === "weekly") return weekly >= b.requirement;
      if (b.id === "early_bird") return list.some((c) => new Date(c.scheduledTime).getHours() < 9);
      if (b.id === "night_owl")  return list.some((c) => new Date(c.scheduledTime).getHours() >= 20);
      return count >= b.requirement;
    });
  };

  const checkForCelebrationAndBadges = () => {
    const earned = checkEarnedBadges(completedClasses.length, progress.streakDays, progress.weeklyCompleted, completedClasses);
    const newOnes = earned.filter((b) => !badges.some((x) => x.id === b.id));
    if (newOnes.length) { setNewBadge(newOnes[newOnes.length-1]); triggerCelebration(newOnes[newOnes.length-1].name, newOnes[newOnes.length-1].icon); }
    setBadges(earned);
    const n = completedClasses.length;
    if (progress.streakDays === 5)  triggerCelebration("🔥 Amazing! 5-Day Streak!", "🔥");
    else if (progress.streakDays === 10) triggerCelebration("⚡ 10-Day Streak Master!", "⚡");
    else if (n === 25) triggerCelebration("🎓 25 Classes Done!", "🎓");
    else if (n === 50) triggerCelebration("🏆 50 Classes!", "🏆");
  };

  const triggerCelebration = (msg, emoji) => {
    setCelebrationMessage(msg); setCelebrationEmoji(emoji);
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 8000);
  };

  // ── Chart data ────────────────────────────────────────────────────────────
  const getChartData = () => {
    const last7 = Array.from({length:7},(_,i) => {
      const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
      return { date: d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}),
        classes: completedClasses.filter((c) => { const x=new Date(c.scheduledTime); x.setHours(0,0,0,0); return x.getTime()===d.getTime(); }).length };
    }).reverse();

    const last30 = Array.from({length:30},(_,i) => {
      const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
      return { date: d.toLocaleDateString("en-US",{month:"short",day:"numeric"}),
        classes: completedClasses.filter((c) => { const x=new Date(c.scheduledTime); x.setHours(0,0,0,0); return x.getTime()===d.getTime(); }).length };
    }).reverse();

    const timeDist = [
      { name:"Morning",   value:0, color:"#f97316" },
      { name:"Afternoon", value:0, color:"#3b82f6" },
      { name:"Evening",   value:0, color:"#8b5cf6" },
      { name:"Night",     value:0, color:"#06b6d4" },
    ];
    completedClasses.forEach((c) => {
      const h = new Date(c.scheduledTime).getHours();
      if(h>=6&&h<12) timeDist[0].value++;
      else if(h>=12&&h<18) timeDist[1].value++;
      else if(h>=18&&h<24) timeDist[2].value++;
      else timeDist[3].value++;
    });
    return { last7, last30, timeDist };
  };

  // ── Share ─────────────────────────────────────────────────────────────────
  const shareAchievement = (type) => {
    let title="", message="";
    if(type==="streak")      { title=`${progress.streakDays}-Day Streak!`; message=`I've completed ${progress.streakDays} days of learning! 🔥`; }
    else if(type==="total")  { title=`${progress.completedLessons} Classes!`; message=`I completed ${progress.completedLessons} English classes! 📚`; }
    else if(type==="badge")  { const b=badges[badges.length-1]; title=`${b?.name} Badge!`; message=`I earned the "${b?.name}" badge ${b?.icon}!`; }
    setShareData({title,message}); setShowShareModal(true);
  };

  const copyShareText   = () => { navigator.clipboard.writeText(shareData.message); showToast("Copied!"); };
  const shareOnSocial = (p) => {
    const t=encodeURIComponent(shareData.message), u=encodeURIComponent(window.location.origin);
    const urls={twitter:`https://twitter.com/intent/tweet?text=${t}&url=${u}`, facebook:`https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`, linkedin:`https://www.linkedin.com/sharing/share-offsite/?url=${u}`, whatsapp:`https://wa.me/?text=${t}%20${u}`};
    window.open(urls[p],"_blank","width=600,height=400");
  };

  // ── Filtered completed ────────────────────────────────────────────────────
  const filteredCompleted = useMemo(() => {
    let f = completedClasses;
    if (searchQuery) f = f.filter((c) =>
      [c.title,c.topic,c.teacher].some((s)=>s.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    if (startDate && endDate) {
      const s=new Date(startDate), e=new Date(endDate); e.setHours(23,59,59,999);
      f = f.filter((c)=>{ const d=new Date(c.scheduledTime); return d>=s&&d<=e; });
    }
    return f.sort((a,b)=>new Date(b.scheduledTime)-new Date(a.scheduledTime));
  }, [completedClasses,searchQuery,startDate,endDate]);

  const totalPages = Math.ceil(filteredCompleted.length / itemsPerPage);
  const paged = filteredCompleted.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);
  useEffect(()=>setCurrentPage(1),[searchQuery,startDate,endDate]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleLogout = () => {
    ["studentToken","studentSessionToken","studentInfo"].forEach((k)=>localStorage.removeItem(k));
    navigate("/student/login");
  };

  const handleJoinClass = async (classItem) => {
    try {
      const bookingId = classItem.bookingId || classItem.id;
      if (!bookingId) { showToast("Missing booking ID","error"); return; }
      const { data } = await api.get(`/api/bookings/${bookingId}`);
      navigate("/classroom",{ state:{ classData:{ id:bookingId, bookingId, title:classItem.title||"Class", topic:classItem.topic||"English Lesson", duration:classItem.duration, teacherGoogleMeetLink: data.booking?.teacherId?.googleMeetLink||"" }, userRole:"student" }});
    } catch { showToast("Failed to join class","error"); }
  };

  const handleLeaveClassroom = () => { setIsClassroomOpen(false); setActiveClass(null); fetchStudentData(); };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background: isDarkMode?"#0f1117":"#fff8f0", fontFamily:"'Nunito',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"64px", animation:"bounce 0.8s infinite alternate" }}>🚀</div>
        <p style={{ color: isDarkMode?"#c8cce0":"#7c3aed", fontWeight:700, fontSize:"18px", marginTop:"16px" }}>Loading your adventure...</p>
        <style>{`@keyframes bounce{to{transform:translateY(-16px)}}`}</style>
      </div>
    </div>
  );

  if (isClassroomOpen && activeClass)
    return <Classroom classData={activeClass} userRole="student" onLeave={handleLeaveClassroom} />;

  const chartData = getChartData();
  const tooltipStyle = { backgroundColor: isDarkMode?"#1a1d2e":"#fff", border:`1px solid ${col.border}`, color:col.heading, borderRadius:"12px", fontFamily:"Nunito,sans-serif" };

  return (
    <div style={{ minHeight:"100vh", background:col.bg, fontFamily:"'Nunito',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        .kid-tab-active  { background: linear-gradient(135deg,#f97316,#fb923c) !important; color:#fff !important; transform:translateY(-3px); box-shadow:0 8px 20px rgba(249,115,22,0.4) !important; }
        .kid-tab:hover   { transform:translateY(-2px); }
        .kid-card        { transition: transform 0.2s, box-shadow 0.2s; }
        .kid-card:hover  { transform:translateY(-4px); box-shadow:0 12px 32px rgba(0,0,0,0.12) !important; }
        .kid-btn         { transition: transform 0.15s, box-shadow 0.15s; }
        .kid-btn:hover   { transform:scale(1.05); }
        .kid-btn:active  { transform:scale(0.97); }
        .star-spin       { animation: spin 8s linear infinite; }
        @keyframes spin  { to { transform:rotate(360deg); } }
        .pop-in          { animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes popIn { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }
        .wiggle:hover    { animation: wiggle 0.4s; }
        @keyframes wiggle{ 0%,100%{transform:rotate(0)} 25%{transform:rotate(-6deg)} 75%{transform:rotate(6deg)} }
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${isDarkMode?"#2a2d40":"#ffd0a8"};border-radius:10px}
      `}</style>

      {/* ── Confetti celebration ─────────────────────────────────────────── */}
      {showCelebration && (
        <>
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={500} gravity={0.3} />
          <div style={{ position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,pointerEvents:"none" }}>
            <div className="pop-in" style={{ background:"linear-gradient(135deg,#f97316,#ec4899)",color:"#fff",padding:"40px 56px",borderRadius:"32px",textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,0.3)",pointerEvents:"auto",maxWidth:"90vw" }}>
              <div style={{ fontSize:"72px",marginBottom:"12px" }}>{celebrationEmoji}</div>
              <h2 style={{ margin:"0 0 8px",fontSize:"28px",fontWeight:900 }}>{celebrationMessage}</h2>
              <p style={{ margin:"0 0 20px",opacity:.9,fontSize:"16px" }}>Keep up the amazing work! 🌟</p>
              <button className="kid-btn" onClick={()=>shareAchievement(newBadge?"badge":progress.streakDays>=5?"streak":"total")}
                style={{ background:"rgba(255,255,255,0.25)",border:"2px solid rgba(255,255,255,0.5)",color:"#fff",padding:"10px 24px",borderRadius:"20px",fontWeight:700,cursor:"pointer",fontFamily:"Nunito,sans-serif",fontSize:"15px" }}>
                🎉 Share Achievement
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="pop-in" style={{ position:"fixed",top:"20px",right:"20px",zIndex:9999,padding:"14px 24px",borderRadius:"20px",fontWeight:700,fontSize:"14px",boxShadow:"0 8px 24px rgba(0,0,0,0.15)",background:toast.type==="error"?"#ef4444":"#10b981",color:"#fff",fontFamily:"Nunito,sans-serif" }}>
          {toast.type==="error"?"😬":"✅"} {toast.message}
        </div>
      )}

      {/* ── Header (existing component) ──────────────────────────────────── */}
      <Header student={student} notifications={notifications} onLogout={handleLogout}
        onChangePassword={()=>setShowChangePassword(true)} onManageSessions={()=>setShowSessionManagement(true)} />

      {/* ── Pending confirmation banner ───────────────────────────────────── */}
      {pendingConfirmations.length > 0 && (
        <div style={{ maxWidth:"1280px",margin:"0 auto",padding:"16px 24px 0" }}>
          {pendingConfirmations.map((conf)=>(
            <div key={conf.id} className="kid-card pop-in" style={{ background:isDarkMode?"rgba(251,191,36,0.1)":"#fffbeb",border:"2px solid #fbbf24",borderRadius:"20px",padding:"16px 20px",marginBottom:"12px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px" }}>
                  <span style={{ fontSize:"22px" }}>⚠️</span>
                  <strong style={{ color:isDarkMode?"#fbbf24":"#92400e",fontSize:"15px" }}>Attendance Confirmation Needed!</strong>
                </div>
                <p style={{ margin:"0 0 4px",color:isDarkMode?"#fcd34d":"#b45309",fontSize:"14px" }}>
                  Your teacher marked <strong>"{conf.title}"</strong> complete. Can you confirm you were there?
                </p>
                <p style={{ margin:0,color:isDarkMode?"#f59e0b":"#d97706",fontSize:"12px" }}>
                  ⏰ Auto-confirms in: <strong>{getTimeRemaining(conf.autoConfirmAt)}</strong>
                </p>
              </div>
              <button className="kid-btn" onClick={()=>{setSelectedConfirmation(conf);setShowConfirmationModal(true);}}
                style={{ background:"linear-gradient(135deg,#f59e0b,#fbbf24)",color:"#fff",border:"none",borderRadius:"14px",padding:"10px 20px",fontWeight:800,cursor:"pointer",fontFamily:"Nunito,sans-serif",fontSize:"14px",whiteSpace:"nowrap",flexShrink:0 }}>
                Review 👀
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Navigation tabs ───────────────────────────────────────────────── */}
      <div style={{ maxWidth:"1280px",margin:"0 auto",padding:"20px 24px 0" }}>
        <div style={{ display:"flex",gap:"8px",overflowX:"auto",paddingBottom:"4px" }}>
          {TABS.map((tab)=>{
            const isActive = activeTab===tab.key;
            const countBadge = tab.key==="completed-classes" ? completedClasses.length : tab.key==="badges" ? badges.length : null;
            return (
              <button key={tab.key} onClick={()=>setActiveTab(tab.key)}
                className={`kid-tab kid-btn ${isActive?"kid-tab-active":""}`}
                style={{ display:"flex",alignItems:"center",gap:"6px",padding:"10px 20px",borderRadius:"20px",border:`2px solid ${isActive?"transparent":col.border}`,background:isActive?"linear-gradient(135deg,#f97316,#fb923c)":col.card,color:isActive?"#fff":col.body,fontWeight:800,cursor:"pointer",fontFamily:"Nunito,sans-serif",fontSize:"14px",whiteSpace:"nowrap",transition:"all 0.2s" }}>
                <span>{tab.emoji}</span>
                <span>{tab.label.split(" ").slice(1).join(" ")}</span>
                {countBadge != null && (
                  <span style={{ background:isActive?"rgba(255,255,255,0.3)":"linear-gradient(135deg,#f97316,#ec4899)",color:"#fff",borderRadius:"999px",padding:"2px 8px",fontSize:"11px",fontWeight:900,minWidth:"22px",textAlign:"center" }}>{countBadge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main style={{ maxWidth:"1280px",margin:"0 auto",padding:"20px 24px 80px" }}>

        {/* ══════ DASHBOARD TAB ══════ */}
        {activeTab==="dashboard" && (
          <div style={{ display:"flex",flexDirection:"column",gap:"20px" }}>

            {/* Welcome banner */}
            <div className="kid-card" style={{ background:"linear-gradient(135deg,#f97316,#ec4899,#8b5cf6)",borderRadius:"28px",padding:"28px 32px",color:"#fff",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"20px",boxShadow:"0 12px 40px rgba(249,115,22,0.3)" }}>
              <div>
                <p style={{ margin:"0 0 4px",fontSize:"13px",fontWeight:700,opacity:.85,letterSpacing:".04em",textTransform:"uppercase" }}>Welcome back 🎉</p>
                <h1 style={{ margin:"0 0 8px",fontSize:"28px",fontWeight:900 }}>Hey, {student.firstName}! 👋</h1>
                <p style={{ margin:0,opacity:.9,fontSize:"15px" }}>
                  You have <strong>{progress.classesRemaining}</strong> classes left. Let's learn something amazing today!
                </p>
              </div>
              <div className="star-spin" style={{ fontSize:"64px",flexShrink:0,display:"none" }} />
              <div style={{ fontSize:"80px",flexShrink:0 }}>📚</div>
            </div>

            {/* Stats row */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"14px" }}>
              {[
                { icon:"✅", label:"Completed",  value:progress.completedLessons, color:"#10b981", bg:isDarkMode?"rgba(16,185,129,0.12)":"#f0fdf4" },
                { icon:"📅", label:"Remaining",  value:progress.classesRemaining,  color:"#3b82f6", bg:isDarkMode?"rgba(59,130,246,0.12)":"#eff6ff" },
                { icon:"🔥", label:"Day Streak", value:progress.streakDays,        color:"#f97316", bg:isDarkMode?"rgba(249,115,22,0.12)":"#fff7ed" },
                { icon:"⭐", label:"This Week",  value:progress.weeklyCompleted,   color:"#8b5cf6", bg:isDarkMode?"rgba(139,92,246,0.12)":"#f5f3ff" },
              ].map(({ icon, label, value, color, bg })=>(
                <div key={label} className="kid-card" style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"20px",padding:"18px 16px",textAlign:"center",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
                  <div style={{ width:"44px",height:"44px",borderRadius:"14px",background:bg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px",fontSize:"22px" }}>{icon}</div>
                  <div style={{ fontSize:"26px",fontWeight:900,color,marginBottom:"4px" }}>{value}</div>
                  <div style={{ fontSize:"12px",fontWeight:700,color:col.muted,textTransform:"uppercase",letterSpacing:".04em" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Active + progress */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 340px",gap:"20px" }}>
              <div style={{ display:"flex",flexDirection:"column",gap:"16px" }}>
                {/* Active classes — use existing component */}
                <div style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"24px",padding:"20px",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
                  <h2 style={{ margin:"0 0 16px",fontSize:"18px",fontWeight:900,color:col.heading,display:"flex",alignItems:"center",gap:"8px" }}>
                    🚀 Live & Starting Soon
                    {activeClasses.length > 0 && <span style={{ background:"#ef4444",color:"#fff",borderRadius:"999px",padding:"2px 10px",fontSize:"12px",fontWeight:900 }}>{activeClasses.length}</span>}
                  </h2>
                  <ActiveClasses activeClasses={activeClasses} onJoin={handleJoinClass} />
                </div>

                {/* Upcoming */}
                <div style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"24px",padding:"20px",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
                  <h2 style={{ margin:"0 0 16px",fontSize:"18px",fontWeight:900,color:col.heading,display:"flex",alignItems:"center",gap:"8px" }}>📅 Upcoming Classes</h2>
                  <UpcomingClasses upcomingClasses={upcomingClasses} onEnroll={()=>showToast("Coming soon!")} />
                </div>
              </div>

              {/* Right column */}
              <div style={{ display:"flex",flexDirection:"column",gap:"16px" }}>
                {/* Progress */}
                <div style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"24px",padding:"20px",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
                  <h2 style={{ margin:"0 0 14px",fontSize:"17px",fontWeight:900,color:col.heading }}>📈 My Progress</h2>
                  <ProgressCard progress={progress} />
                </div>

                {/* Recent badges */}
                <div style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"24px",padding:"20px",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px" }}>
                    <h2 style={{ margin:0,fontSize:"17px",fontWeight:900,color:col.heading }}>🏅 My Badges</h2>
                    <button className="kid-btn" onClick={()=>setActiveTab("badges")}
                      style={{ background:isDarkMode?"rgba(249,115,22,0.15)":"#fff7ed",border:"none",color:"#f97316",fontWeight:800,borderRadius:"12px",padding:"5px 12px",cursor:"pointer",fontFamily:"Nunito,sans-serif",fontSize:"12px" }}>
                      See all →
                    </button>
                  </div>
                  {badges.length===0 ? (
                    <p style={{ textAlign:"center",color:col.muted,fontSize:"13px",fontWeight:600 }}>Complete classes to earn badges! 🌟</p>
                  ) : (
                    <div style={{ display:"flex",flexWrap:"wrap",gap:"10px" }}>
                      {badges.slice(-4).map((b)=>(
                        <div key={b.id} title={b.description} style={{ textAlign:"center" }}>
                          <div style={{ fontSize:"36px" }}>{b.icon}</div>
                          <p style={{ margin:"4px 0 0",fontSize:"10px",fontWeight:700,color:col.muted,maxWidth:"56px" }}>{b.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"24px",padding:"20px",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
                  <h2 style={{ margin:"0 0 14px",fontSize:"17px",fontWeight:900,color:col.heading }}>🔔 Notifications</h2>
                  <NotificationsCard notifications={notifications} onClearAll={()=>setNotifications([])} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════ COMPLETED CLASSES TAB ══════ */}
        {activeTab==="completed-classes" && (
          <div style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"24px",padding:"24px",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
            <h2 style={{ margin:"0 0 20px",fontSize:"22px",fontWeight:900,color:col.heading }}>✅ Completed Classes</h2>
            <StudentCompletedTab studentId={student.id} isDarkMode={isDarkMode} />
          </div>
        )}

        {/* ══════ BADGES TAB ══════ */}
        {activeTab==="badges" && (
          <div style={{ display:"flex",flexDirection:"column",gap:"20px" }}>
            <div style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"24px",padding:"24px",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"24px",flexWrap:"wrap",gap:"12px" }}>
                <div>
                  <h2 style={{ margin:"0 0 4px",fontSize:"24px",fontWeight:900,color:col.heading }}>🏅 Achievement Badges</h2>
                  <p style={{ margin:0,color:col.muted,fontSize:"14px",fontWeight:600 }}>Earned {badges.length} of {BADGE_DEFINITIONS.length} badges</p>
                </div>
                <button className="kid-btn" onClick={()=>shareAchievement("badge")} disabled={badges.length===0}
                  style={{ background:"linear-gradient(135deg,#f97316,#ec4899)",color:"#fff",border:"none",borderRadius:"16px",padding:"10px 20px",fontWeight:800,cursor:"pointer",fontFamily:"Nunito,sans-serif",fontSize:"14px",opacity:badges.length===0?.5:1 }}>
                  🎉 Share
                </button>
              </div>

              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:"12px" }}>
                {BADGE_DEFINITIONS.map((badge)=>{
                  const earned = badges.some((b)=>b.id===badge.id);
                  return (
                    <div key={badge.id} className="kid-card" style={{ padding:"20px 12px",borderRadius:"20px",textAlign:"center",border:`2px solid ${earned?(isDarkMode?"#f97316":"#fed7aa"):col.border}`,background:earned?(isDarkMode?"rgba(249,115,22,0.12)":"#fff7ed"):col.cardAlt,opacity:earned?1:.55,transition:"all 0.2s" }}>
                      <div style={{ fontSize:"44px",marginBottom:"8px",filter:earned?"none":"grayscale(1)" }}>{badge.icon}</div>
                      <h3 style={{ margin:"0 0 4px",fontSize:"13px",fontWeight:800,color:col.heading }}>{badge.name}</h3>
                      <p style={{ margin:"0 0 8px",fontSize:"11px",color:col.muted,fontWeight:600 }}>{badge.description}</p>
                      <span style={{ display:"inline-block",padding:"3px 10px",borderRadius:"999px",fontSize:"11px",fontWeight:800,background:earned?"#10b981":col.border,color:earned?"#fff":col.muted }}>
                        {earned?"✓ Earned":"🔒 Locked"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Next badges progress */}
            <div style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"24px",padding:"24px",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin:"0 0 18px",fontSize:"20px",fontWeight:900,color:col.heading }}>🎯 Almost There!</h3>
              <div style={{ display:"flex",flexDirection:"column",gap:"14px" }}>
                {BADGE_DEFINITIONS.filter((b)=>!badges.some((e)=>e.id===b.id)).slice(0,3).map((badge)=>{
                  let cur=0;
                  if(badge.type==="streak") cur=progress.streakDays;
                  else if(badge.type==="total") cur=completedClasses.length;
                  else if(badge.type==="weekly") cur=progress.weeklyCompleted;
                  const pct = Math.min((cur/badge.requirement)*100,100);
                  return (
                    <div key={badge.id} style={{ border:`2px solid ${col.border}`,borderRadius:"18px",padding:"16px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:"14px",marginBottom:"10px" }}>
                        <span style={{ fontSize:"36px" }}>{badge.icon}</span>
                        <div style={{ flex:1 }}>
                          <h4 style={{ margin:"0 0 2px",fontWeight:800,color:col.heading,fontSize:"15px" }}>{badge.name}</h4>
                          <p style={{ margin:0,fontSize:"12px",color:col.muted,fontWeight:600 }}>{badge.description}</p>
                        </div>
                      </div>
                      {badge.type!=="special" && (
                        <>
                          <div style={{ background:col.border,borderRadius:"999px",height:"10px",overflow:"hidden" }}>
                            <div style={{ width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#f97316,#fbbf24)",borderRadius:"999px",transition:"width 0.6s ease" }} />
                          </div>
                          <p style={{ margin:"6px 0 0",fontSize:"12px",fontWeight:700,color:col.muted,textAlign:"right" }}>{cur} / {badge.requirement}</p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════ CHARTS TAB ══════ */}
        {activeTab==="charts" && (
          <div style={{ display:"flex",flexDirection:"column",gap:"20px" }}>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"14px" }}>
              {[
                { icon:"📚",label:"Total Classes",value:completedClasses.length,     color:"#f97316" },
                { icon:"🔥",label:"Day Streak",   value:progress.streakDays,         color:"#ec4899" },
                { icon:"⏱️",label:"Total Hours",  value: completedClasses.length > 0 ? Math.round(completedClasses.reduce((s,c)=>s+c.duration,0)/60):0, color:"#8b5cf6" },
                { icon:"💰", label:"Total Paid",  value:progress.totalLessons,      color:"#f97316", bg:isDarkMode?"rgba(249,115,22,0.12)":"#fff7ed" },
              ].map(({ icon,label,value,color })=>(
                <div key={label} className="kid-card" style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"24px",padding:"24px",textAlign:"center",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize:"40px",marginBottom:"8px" }}>{icon}</div>
                  <div style={{ fontSize:"36px",fontWeight:900,color,marginBottom:"4px" }}>{value}</div>
                  <div style={{ fontSize:"13px",fontWeight:700,color:col.muted,textTransform:"uppercase",letterSpacing:".04em" }}>{label}</div>
                </div>
              ))}
            </div>

            {[
              { title:"📊 Last 7 Days",data:chartData.last7,type:"bar" },
              { title:"📈 Last 30 Days",data:chartData.last30,type:"line" },
            ].map(({ title,data,type })=>(
              <div key={title} className="kid-card" style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"24px",padding:"24px",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin:"0 0 20px",fontSize:"20px",fontWeight:900,color:col.heading }}>{title}</h3>
                <ResponsiveContainer width="100%" height={260}>
                  {type==="bar" ? (
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke={col.border} />
                      <XAxis dataKey="date" stroke={col.muted} style={{fontFamily:"Nunito,sans-serif",fontSize:11}} />
                      <YAxis stroke={col.muted} style={{fontFamily:"Nunito,sans-serif",fontSize:11}} />
                      <RechartsTooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="classes" fill="#f97316" radius={[8,8,0,0]} name="Classes" />
                    </BarChart>
                  ) : (
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke={col.border} />
                      <XAxis dataKey="date" stroke={col.muted} style={{fontFamily:"Nunito,sans-serif",fontSize:11}} />
                      <YAxis stroke={col.muted} style={{fontFamily:"Nunito,sans-serif",fontSize:11}} />
                      <RechartsTooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="classes" stroke="#f97316" strokeWidth={3} dot={{fill:"#f97316",r:5}} name="Classes" />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            ))}

            <div className="kid-card" style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"24px",padding:"24px",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin:"0 0 20px",fontSize:"20px",fontWeight:900,color:col.heading }}>🕐 Classes by Time of Day</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={chartData.timeDist} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({name,value})=>`${name}: ${value}`} labelLine={false}>
                    {chartData.timeDist.map((e,i)=><Cell key={i} fill={e.color} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ══════ MESSAGES TAB ══════ */}
        {activeTab==="messages" && (
          <div style={{ background:col.card,border:`2px solid ${col.border}`,borderRadius:"24px",overflow:"hidden",boxShadow:"0 4px 12px rgba(0,0,0,0.06)" }}>
            <MessagesTab userRole="student" />
          </div>
        )}
      </main>

      {/* ── Floating action buttons ───────────────────────────────────────── */}
      <div style={{ position:"fixed",bottom:"24px",right:"24px",display:"flex",flexDirection:"column",gap:"12px",zIndex:100 }}>
        <button className="kid-btn wiggle" onClick={()=>notificationsEnabled?disableNotifications():enableNotifications()}
          style={{ width:"52px",height:"52px",borderRadius:"18px",border:"none",background:notificationsEnabled?"linear-gradient(135deg,#10b981,#059669)":"linear-gradient(135deg,#6b7280,#4b5563)",color:"#fff",fontSize:"22px",cursor:"pointer",boxShadow:"0 6px 20px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center" }}>
          🔔
        </button>
        <button className="kid-btn wiggle" onClick={()=>{setIsDarkMode(!isDarkMode);showToast(isDarkMode?"☀️ Light mode!":"🌙 Dark mode!");}}
          style={{ width:"52px",height:"52px",borderRadius:"18px",border:"none",background:isDarkMode?"linear-gradient(135deg,#f59e0b,#f97316)":"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontSize:"22px",cursor:"pointer",boxShadow:"0 6px 20px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center" }}>
          {isDarkMode?"☀️":"🌙"}
        </button>
        <button className="kid-btn wiggle" onClick={()=>setShowSettingsSidebar(true)}
          style={{ width:"52px",height:"52px",borderRadius:"18px",border:"none",background:"linear-gradient(135deg,#f97316,#ec4899)",color:"#fff",fontSize:"22px",cursor:"pointer",boxShadow:"0 6px 20px rgba(249,115,22,0.4)",display:"flex",alignItems:"center",justifyContent:"center" }}>
          ⚙️
        </button>
      </div>

      {/* ── Share modal ────────────────────────────────────────────────────── */}
      {showShareModal && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:"16px" }}>
          <div className="pop-in kid-card" style={{ background:col.card,borderRadius:"28px",padding:"28px",maxWidth:"420px",width:"100%",boxShadow:"0 24px 64px rgba(0,0,0,0.3)" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px" }}>
              <h3 style={{ margin:0,fontSize:"22px",fontWeight:900,color:col.heading }}>🎉 Share Your Win!</h3>
              <button className="kid-btn" onClick={()=>setShowShareModal(false)}
                style={{ background:col.border,border:"none",borderRadius:"50%",width:"36px",height:"36px",cursor:"pointer",fontSize:"18px",display:"flex",alignItems:"center",justifyContent:"center",color:col.body }}>✕</button>
            </div>
            <div style={{ background:isDarkMode?"rgba(249,115,22,0.1)":"#fff7ed",border:`2px solid ${isDarkMode?"rgba(249,115,22,0.3)":"#fed7aa"}`,borderRadius:"18px",padding:"16px",marginBottom:"20px" }}>
              <h4 style={{ margin:"0 0 6px",fontWeight:800,color:col.heading,fontSize:"16px" }}>{shareData?.title}</h4>
              <p style={{ margin:0,fontSize:"14px",color:col.body,fontWeight:600 }}>{shareData?.message}</p>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
              <button className="kid-btn" onClick={copyShareText}
                style={{ width:"100%",padding:"12px",border:`2px solid ${col.border}`,borderRadius:"16px",background:"transparent",color:col.heading,fontWeight:800,cursor:"pointer",fontFamily:"Nunito,sans-serif",fontSize:"14px" }}>
                📋 Copy to Clipboard
              </button>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px" }}>
                {[["twitter","🐦 Twitter","#1DA1F2"],["facebook","📘 Facebook","#1877F2"],["whatsapp","💬 WhatsApp","#25D366"],["linkedin","💼 LinkedIn","#0A66C2"]].map(([p,label,bg])=>(
                  <button key={p} className="kid-btn" onClick={()=>shareOnSocial(p)}
                    style={{ padding:"11px",background:bg,color:"#fff",border:"none",borderRadius:"14px",fontWeight:800,cursor:"pointer",fontFamily:"Nunito,sans-serif",fontSize:"13px" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showChangePassword && <ChangePassword onClose={()=>setShowChangePassword(false)} onSuccess={()=>{setShowChangePassword(false);showToast("Password changed! 🔒");}} />}
      {showSessionManagement && <SessionManagement isOpen onClose={()=>setShowSessionManagement(false)} userType="student" />}
      {showSettingsSidebar && (
        <SettingsSidebar isOpen onClose={()=>setShowSettingsSidebar(false)}
          onChangePassword={()=>{setShowSettingsSidebar(false);setShowChangePassword(true);}}
          onManageSessions={()=>{setShowSettingsSidebar(false);setShowSessionManagement(true);}}
          onManage2FA={()=>{setShowSettingsSidebar(false);setShowSettingsModal(true);}}
          userInfo={{ firstName:student.firstName, lastName:student.surname, email:student.email }} />
      )}
      {showSettingsModal && <SettingsModal isOpen onClose={()=>setShowSettingsModal(false)} userType="student" />}
      {showConfirmationModal && selectedConfirmation && (
        <ClassConfirmation booking={selectedConfirmation} isDarkMode={isDarkMode}
          onConfirm={()=>{setShowConfirmationModal(false);setSelectedConfirmation(null);showToast("Class confirmed! ✅");fetchStudentData();}}
          onDispute={()=>{setShowConfirmationModal(false);setSelectedConfirmation(null);showToast("Dispute submitted.");fetchStudentData();}}
          onClose={()=>{setShowConfirmationModal(false);setSelectedConfirmation(null);}} />
      )}
    </div>
  );

  // helpers defined inside to access state
  function disableNotifications() {
    setNotificationsEnabled(false);
    localStorage.setItem("notificationsEnabled","false");
    showToast("Notifications disabled");
  }
}
