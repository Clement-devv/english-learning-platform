// src/pages/student/dashboard-shells/useDashboardData.js
// Shared logic hook — all state, effects, and handlers extracted from StudentDashboard.
// Both SunshineShell and CRMShell (and any future shells) consume this hook.

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import api from "../../../api";
import { getUserTimezone } from "../../../utils/timezone";
import { pushSupported, enablePush, disablePush, getPushStatus } from "../../../utils/pushNotifications";
import { getStudentBookings } from "../../../services/bookingService";

// Heartbeat intervals
const TICK_MS      = 30_000;  // base tick — client-side class status runs every tick
const TICK_REFRESH = 2;       // every 60s — API: credits, fresh accepted list, confirmations

// Classify a single accepted booking into active/upcoming buckets (matches fetchStudentData logic)
function classifyBooking(booking, now = Date.now()) {
  const sd   = new Date(booking.scheduledTime);
  const diff = sd - now;
  const data = {
    id: booking._id || booking.id,
    bookingId: booking._id || booking.id,
    title: booking.classTitle || booking.title,
    teacher: booking.teacherId
      ? `${booking.teacherId.firstName} ${booking.teacherId.lastName}`
      : booking.teacher || "",
    teacherId: booking.teacherId?._id || booking.teacherId,
    topic: booking.topic || "English Lesson",
    scheduledTime: booking.scheduledTime,
    scheduledDate: sd,
    duration: booking.duration || 30,
    notes: booking.notes || "",
    teacherTimezone: booking.teacherTimezone || "",
    studentTimezone: booking.studentTimezone || "",
  };
  const durationMs = (booking.duration || 30) * 60_000;
  if (diff < 900_000 && diff > -durationMs) {
    return { bucket: "active", item: { ...data, time: sd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }), status: diff < 0 ? "live" : "starting-soon", participants: 1, maxParticipants: 12 } };
  }
  if (diff > 0 && diff < 7_200_000) {
    return { bucket: "active", item: { ...data, time: sd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }), status: "starting-soon", participants: 1, maxParticipants: 12 } };
  }
  if (diff > 0) {
    return { bucket: "upcoming", item: { ...data, time: sd.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }), enrolled: true } };
  }
  return { bucket: "past", item: null };
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";

export const getStudentToken = () =>
  sessionStorage.getItem("studentToken") || localStorage.getItem("studentToken");

// ── Badge definitions ─────────────────────────────────────────────────────────
export const BADGE_DEFINITIONS = [
  { id:"first_class", name:"First Step",      icon:"🚀", requirement:1,   type:"total",   category:"journey",      desc:"Showed up for your very first class!",          grad:["#f97316","#fb923c"] },
  { id:"total_5",     name:"Finding Rhythm",  icon:"🎵", requirement:5,   type:"total",   category:"journey",      desc:"5 classes done — you're building a habit!",     grad:["#f59e0b","#fbbf24"] },
  { id:"total_10",    name:"In The Groove",   icon:"🌊", requirement:10,  type:"total",   category:"journey",      desc:"10 classes — things are really clicking!",      grad:["#10b981","#34d399"] },
  { id:"total_20",    name:"On A Roll",       icon:"🎯", requirement:20,  type:"total",   category:"journey",      desc:"20 classes and going strong!",                  grad:["#3b82f6","#60a5fa"] },
  { id:"total_30",    name:"Committed",       icon:"💪", requirement:30,  type:"total",   category:"journey",      desc:"30 classes — truly committed to English!",      grad:["#8b5cf6","#a78bfa"] },
  { id:"total_50",    name:"Half Century",    icon:"🏆", requirement:50,  type:"total",   category:"journey",      desc:"50 classes — absolute dedication!",             grad:["#ec4899","#f472b6"] },
  { id:"total_100",   name:"English Legend",  icon:"👑", requirement:100, type:"total",   category:"journey",      desc:"100 classes — you are a legend!",               grad:["#fbbf24","#fcd34d"] },
  { id:"streak_3",    name:"Getting Warm",    icon:"🌱", requirement:3,   type:"streak",  category:"consistency",  desc:"3 active learning days — great start!",         grad:["#22c55e","#4ade80"] },
  { id:"streak_7",    name:"Full Week",       icon:"🔥", requirement:7,   type:"streak",  category:"consistency",  desc:"7 active learning days — on fire!",             grad:["#f97316","#fb923c"] },
  { id:"streak_14",   name:"Two Weeks!",      icon:"⚡", requirement:14,  type:"streak",  category:"consistency",  desc:"14 active learning days — phenomenal!",         grad:["#eab308","#fbbf24"] },
  { id:"streak_30",   name:"Monthly Pro",     icon:"🌟", requirement:30,  type:"streak",  category:"consistency",  desc:"30 active learning days — truly incredible!",   grad:["#a855f7","#c084fc"] },
  { id:"weekly_2",    name:"Busy Bee",        icon:"🐝", requirement:2,   type:"weekly",  category:"weekly",       desc:"2 classes in one week — buzzing!",              grad:["#f59e0b","#fbbf24"] },
  { id:"weekly_3",    name:"Triple Boost",    icon:"🎖️", requirement:3,  type:"weekly",  category:"weekly",       desc:"3 classes in one week — amazing effort!",       grad:["#10b981","#34d399"] },
  { id:"weekly_5",    name:"Week Champion",   icon:"🦸", requirement:5,   type:"weekly",  category:"weekly",       desc:"5 classes in one week — unstoppable!",          grad:["#6366f1","#818cf8"] },
  { id:"early_bird",  name:"Early Bird",      icon:"🌅", requirement:1,   type:"special", category:"special",      desc:"Attended a class before 9 AM!",                 grad:["#f97316","#fbbf24"] },
  { id:"night_owl",   name:"Night Owl",       icon:"🦉", requirement:1,   type:"special", category:"special",      desc:"Attended a class after 8 PM!",                  grad:["#7c3aed","#a855f7"] },
];

// ── Navigation tabs ───────────────────────────────────────────────────────────
export const TABS = [
  { key: "dashboard",         label: "🏠 Home",       emoji: "🏠" },
  { key: "homework",          label: "📚 Homework",    emoji: "📚" },
  { key: "quiz",              label: "📝 Quizzes",     emoji: "📝" },
  { key: "flashcards",        label: "📖 Flashcards",  emoji: "📖" },
  { key: "pronunciation",     label: "🎤 Speak",       emoji: "🎤" },
  { key: "conversation",      label: "🤖 AI Chat",     emoji: "🤖" },
  { key: "messages",          label: "💬 Messages",    emoji: "💬" },
  { key: "recordings",        label: "🎬 Recordings",  emoji: "🎬" },
  { key: "reviews",           label: "⭐ Reviews",     emoji: "⭐" },
  { key: "referral",          label: "🎁 Invite",      emoji: "🎁" },
  { key: "completed-classes", label: "✅ Completed",   emoji: "✅" },
  { key: "badges",            label: "🏅 Badges",      emoji: "🏅" },
  { key: "charts",            label: "📊 Progress",    emoji: "📊" },
  { key: "schedule",          label: "📅 Schedule",    emoji: "📅" },
];

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useDashboardData() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, setUser: setAuthUser } = useAuth();

  // ── Modal / UI state ───────────────────────────────────────────────────────
  const [showChangePassword,    setShowChangePassword]    = useState(false);
  const [showSessionManagement, setShowSessionManagement] = useState(false);
  const [showSettingsSidebar,   setShowSettingsSidebar]   = useState(false);
  const [showSettingsModal,     setShowSettingsModal]     = useState(false);
  const [toast,                 setToast]                 = useState(null);
  const [loading,               setLoading]               = useState(true);
  const [showCelebration,       setShowCelebration]       = useState(false);
  const [celebrationMessage,    setCelebrationMessage]    = useState("");
  const [celebrationEmoji,      setCelebrationEmoji]      = useState("");
  const [badges,                setBadges]                = useState([]);
  const [newBadge,              setNewBadge]              = useState(null);
  const [showShareModal,        setShowShareModal]        = useState(false);
  const [shareData,             setShareData]             = useState(null);
  const [notificationsEnabled,  setNotificationsEnabled]  = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [activeTab,             setActiveTab]             = useState("dashboard");
  const [unreadMessages,        setUnreadMessages]        = useState(0);
  const [homeworkPending,       setHomeworkPending]       = useState(0);
  const prevHomeworkRef = useRef(null);
  const [quizPending,           setQuizPending]           = useState(0);
  const prevQuizRef = useRef(null);

  // ── Classroom state ────────────────────────────────────────────────────────
  const [isClassroomOpen,       setIsClassroomOpen]       = useState(false);
  const [activeClass,           setActiveClass]           = useState(null);
  const [pendingConfirmations,  setPendingConfirmations]  = useState([]);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [selectedConfirmation,  setSelectedConfirmation]  = useState(null);

  // ── Theme / display ────────────────────────────────────────────────────────
  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem("darkMode") === "true"
  );

  // ── Student info ───────────────────────────────────────────────────────────
  const [student] = useState(() => {
    // Prefer auth context (avoids repeated localStorage reads); fall back to
    // localStorage in case the context hasn't propagated yet (e.g. Vite HMR).
    const p = authUser || (() => {
      try {
        const raw = sessionStorage.getItem("studentInfo") || localStorage.getItem("studentInfo");
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    })() || {};

    if (p._id || p.id) {
      return {
        id: p._id || p.id,
        firstName: p.firstName || "",
        lastName: p.lastName || p.surname || "",
        name: `${p.firstName || ""} ${p.lastName || p.surname || ""}`.trim(),
        email: p.email,
        classCredits: p.classCredits || p.noOfClasses || 0,
        level: "Intermediate",
        studentId: p.studentId || "",
      };
    }
    return { name: "Student", firstName: "Student", lastName: "", level: "Intermediate" };
  });

  // ── Data state ─────────────────────────────────────────────────────────────
  const [activeClasses,    setActiveClasses]    = useState([]);
  const [upcomingClasses,  setUpcomingClasses]  = useState([]);
  const [completedClasses, setCompletedClasses] = useState([]);
  const [progress, setProgress] = useState({
    completedLessons: 0, totalLessons: 0, streakDays: 0,
    weeklyGoal: 5, weeklyCompleted: 0, classesRemaining: 0,
  });
  const [notifications,        setNotifications]        = useState([]);
  const [seenStreakMilestones,  setSeenStreakMilestones] = useState(
    () => new Set(JSON.parse(localStorage.getItem("seenStreakMilestones") || "[]"))
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate,   setStartDate]   = useState("");
  const [endDate,     setEndDate]     = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ── Location state → tab redirect ──────────────────────────────────────────
  useEffect(() => {
    if (location.state?.classCompleted) {
      setActiveTab("completed-classes");
      navigate(location.pathname, { replace: true, state: {} });
    } else if (location.state?.classMissed) {
      setActiveTab("dashboard");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.classCompleted, location.state?.classMissed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dark mode sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("darkMode", isDarkMode);
  }, [isDarkMode]);

  // ── Push notifications — auto-subscribe on first login ────────────────────
  useEffect(() => {
    if (!pushSupported()) return;
    setNotificationPermission(Notification.permission);
    getPushStatus().then(async subscribed => {
      if (subscribed) {
        setNotificationsEnabled(true);
        localStorage.setItem("notificationsEnabled", "true");
      } else if (Notification.permission !== "denied") {
        // Auto-request permission and subscribe — user doesn't need to opt-in manually
        const { ok } = await enablePush();
        setNotificationsEnabled(ok);
        setNotificationPermission(ok ? "granted" : Notification.permission);
        localStorage.setItem("notificationsEnabled", ok ? "true" : "false");
      }
    });
  }, []);

  // ── Session guard: re-verify when tab becomes visible (catches force-logout from another device) ──
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        // A lightweight call — if the JWT was blacklisted, the api interceptor
        // will get a 401, fail the refresh (session.isActive = false), and redirect to login.
        api.get('/auth/student/verify').catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // ── Unread messages — fetch count on mount (DMs + group chats) ─────────────
  // Both fetches run in parallel so the badge is accurate on first paint even
  // when the user was offline and messages arrived while they were logged out.
  useEffect(() => {
    Promise.all([
      api.get("/direct-messages").catch(() => ({ data: {} })),
      api.get("/group-chats").catch(() => ({ data: {} })),
    ]).then(([{ data: dmData }, { data: gcData }]) => {
      const dmTotal = (dmData.dms   || []).reduce((sum, dm)   => sum + (dm.unreadCount?.student   || 0), 0);
      const gcTotal = (gcData.chats || []).reduce((sum, chat) => sum + (chat.unreadCount?.student  || 0), 0);
      setUnreadMessages(dmTotal + gcTotal);
    });
  }, []);

  useEffect(() => {
    if (activeTab === "messages") setUnreadMessages(0);
  }, [activeTab]);

  // ── Homework count polling ─────────────────────────────────────────────────
  useEffect(() => {
    const checkHomework = async () => {
      try {
        const { data } = await api.get("/homework/assigned");
        const pending = (data.homework || []).filter(h => h.status === "assigned").length;
        setHomeworkPending(pending);
        if (prevHomeworkRef.current !== null && pending > prevHomeworkRef.current) {
          const diff = pending - prevHomeworkRef.current;
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("📚 New Homework!", { body: `You have ${diff} new homework assignment${diff > 1 ? "s" : ""} from your teacher.`, icon: "/favicon.ico" });
          }
        }
        prevHomeworkRef.current = pending;
      } catch { /* silent */ }
    };
    checkHomework();
    const interval = setInterval(checkHomework, 90 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Quiz count polling ─────────────────────────────────────────────────────
  useEffect(() => {
    const checkQuizzes = async () => {
      try {
        const { data } = await api.get("/quiz/assigned");
        const pending = (data.quizzes || []).filter(q => q.status === "assigned").length;
        setQuizPending(pending);
        if (prevQuizRef.current !== null && pending > prevQuizRef.current) {
          const diff = pending - prevQuizRef.current;
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("📝 New Quiz!", { body: `You have ${diff} new quiz${diff > 1 ? "zes" : ""} assigned by your teacher.`, icon: "/favicon.ico" });
          }
        }
        prevQuizRef.current = pending;
      } catch { /* silent */ }
    };
    checkQuizzes();
    const interval = setInterval(checkQuizzes, 90 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
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
    const sorted = completedBookings.map(b => new Date(b.scheduledTime)).sort((a, b) => b - a);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const recent = new Date(sorted[0]); recent.setHours(0, 0, 0, 0);
    if (Math.floor((today - recent) / 86400000) > 1) return 0;
    let streak = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = new Date(sorted[i]); a.setHours(0, 0, 0, 0);
      const b = new Date(sorted[i + 1]); b.setHours(0, 0, 0, 0);
      const d = Math.floor((a - b) / 86400000);
      if (d === 1) streak++; else if (d > 1) break;
    }
    return streak;
  };

  const calculateWeeklyCompleted = (completedBookings) => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return completedBookings.filter(b => new Date(b.scheduledTime) >= weekAgo).length;
  };

  // ── handleLogout must be defined before fetchStudentData ──────────────────
  const handleLogout = () => {
    // Blacklist the JWT server-side so it can't be reused (fire and forget)
    const token        = sessionStorage.getItem('studentToken') || localStorage.getItem('studentToken');
    const sessionToken = sessionStorage.getItem('studentSessionToken') || localStorage.getItem('studentSessionToken');
    if (token && sessionToken) {
      // Pass Authorization explicitly — the async request interceptor runs AFTER
      // the synchronous removeItem calls below, so it would find empty storage
      // and send no header, causing a 401 (race condition fix).
      api.post('/auth/logout-session', { sessionToken }, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    // Wipe both storage tiers so the back button can't restore the session
    ['studentToken', 'studentSessionToken', 'studentInfo'].forEach(k => {
      sessionStorage.removeItem(k);
      localStorage.removeItem(k);
    });
    localStorage.removeItem('pwa-last-role');
    // replace: true removes this entry from history so back button can't return to dashboard
    navigate('/student/login', { replace: true });
  };

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchStudentData = async () => {
    try {
      setLoading(true);
      const studentId = student.id;
      if (!studentId) { showToast("Please login again.", "error"); handleLogout(); return; }

      api.patch(`/students/${studentId}/timezone`, { timezone: getUserTimezone() }).catch(() => {});

      const [accepted, completed, pendingConf] = await Promise.all([
        getStudentBookings(studentId, "accepted"),
        getStudentBookings(studentId, "completed"),
        getStudentBookings(studentId, "pending_confirmation"),
      ]);
      rawAcceptedRef.current = accepted;

      setPendingConfirmations(pendingConf.map(b => ({
        id: b._id, bookingId: b._id, title: b.classTitle,
        teacher: `${b.teacherId.firstName} ${b.teacherId.lastName}`,
        scheduledTime: b.scheduledTime, duration: b.duration,
        teacherConfirmedAt: b.teacherConfirmedAt, autoConfirmAt: b.autoConfirmAt,
        topic: b.topic || "English Lesson",
      })));

      const now = new Date();
      const active = [], upcoming = [];

      accepted.forEach(booking => {
        const sd = new Date(booking.scheduledTime);
        const diff = sd - now;
        const data = {
          id: booking._id, bookingId: booking._id, title: booking.classTitle,
          teacher: `${booking.teacherId.firstName} ${booking.teacherId.lastName}`,
          teacherId: booking.teacherId._id, topic: booking.topic || "English Lesson",
          scheduledTime: booking.scheduledTime, scheduledDate: sd,
          duration: booking.duration || 30, notes: booking.notes || "",
          teacherTimezone: booking.teacherTimezone || "", studentTimezone: booking.studentTimezone || "",
        };
        if (diff < 900000 && diff > -(booking.duration * 60000)) {
          active.push({ ...data, time: sd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }), status: diff < 0 ? "live" : "starting-soon", participants: 1, maxParticipants: 12 });
        } else if (diff > 0 && diff < 7200000) {
          active.push({ ...data, time: sd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }), status: "starting-soon", participants: 1, maxParticipants: 12 });
        } else if (diff > 0) {
          upcoming.push({ ...data, time: sd.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }), enrolled: true });
        }
      });

      const completedList = completed
        .filter(b => b.status === "completed")
        .map(b => ({
          id: b._id, bookingId: b._id, title: b.classTitle,
          teacher: `${b.teacherId.firstName} ${b.teacherId.lastName}`,
          topic: b.topic || "Completed Lesson", scheduledTime: b.scheduledTime,
          scheduledDate: new Date(b.scheduledTime),
          fullDateTime: new Date(b.scheduledTime).toLocaleString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
          duration: b.duration || 60, notes: b.notes || "", status: "completed",
        }));

      setActiveClasses(active);
      setUpcomingClasses(upcoming);
      setCompletedClasses(completedList);

      const weeklyCompleted = calculateWeeklyCompleted(completedList);
      const streakDays = calculateStreakDays(completedList);

      let classesRemaining = 0;
      try {
        const { data: freshStudent } = await api.get(`/students/${studentId}`);
        classesRemaining = freshStudent?.classCredits || 0;
        // Sync into auth context (no-op if context unavailable) + localStorage fallback
        setAuthUser({ classCredits: classesRemaining });
        try {
          const key = sessionStorage.getItem("studentInfo") ? "studentInfo" : null;
          if (key) {
            const stored = JSON.parse(sessionStorage.getItem(key) || "{}");
            sessionStorage.setItem(key, JSON.stringify({ ...stored, classCredits: classesRemaining }));
          } else {
            const stored = JSON.parse(localStorage.getItem("studentInfo") || "{}");
            localStorage.setItem("studentInfo", JSON.stringify({ ...stored, classCredits: classesRemaining }));
          }
        } catch { /* silent */ }
      } catch {
        classesRemaining = authUser?.classCredits || 0;
      }

      const completedCount = completedList.length;
      setProgress({
        completedLessons: completedCount, totalLessons: completedCount + classesRemaining,
        classesRemaining, streakDays, weeklyGoal: 5, weeklyCompleted,
      });

      const notifs = [];
      active.forEach(cls => {
        if (cls.status === "starting-soon")
          notifs.push({ id: `class-${cls.id}`, type: "class", message: `${cls.title} starts soon!`, time: cls.time, read: false });
      });
      if (notifs.length) setNotifications(prev => [...notifs, ...prev]);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch student data:", err);
      showToast("Failed to load your classes", "error");
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudentData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── fetchStudentDataRef — keeps socket handler pointing at latest fn ───────
  const fetchStudentDataRef = useRef(null);
  useEffect(() => { fetchStudentDataRef.current = fetchStudentData; });

  // ── rawAcceptedRef — raw accepted bookings for client-side reclassification ─
  const rawAcceptedRef = useRef([]);

  // ── Socket.IO real-time updates ────────────────────────────────────────────
  useEffect(() => {
    const token = getStudentToken();
    if (!token) return;

    let socket = null;
    let cancelled = false;

    // Defer connection by one tick — React 18 StrictMode fires the cleanup
    // synchronously before this runs, so `cancelled` will be true on the
    // first (discarded) mount and we never open a WebSocket that immediately closes.
    const tid = setTimeout(() => {
      if (cancelled) return;

      socket = io(SOCKET_URL, { transports: ["websocket"], auth: { token } });

      socket.on("connect", () => { socket.emit("join-student-room"); });
      socket.on("new-direct-message", ({ senderName, message }) => {
        setUnreadMessages(prev => prev + 1);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`💬 Message from ${senderName}`, { body: message, icon: "/favicon.ico" });
        }
      });
      socket.on("new-group-message", ({ senderName }) => {
        setUnreadMessages(prev => prev + 1);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`💬 Group message from ${senderName || "Someone"}`, { icon: "/favicon.ico" });
        }
      });
      socket.on("booking-update", ({ title, message, type }) => {
        showToast(message, type === "rejected" ? "error" : "success");
        if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body: message, icon: "/favicon.ico" });
        fetchStudentDataRef.current?.();
      });
      socket.on("homework-assigned", ({ title, message }) => {
        showToast(message, "success");
        if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body: message, icon: "/favicon.ico" });
        setHomeworkPending(prev => prev + 1);
      });
      socket.on("quiz-assigned", ({ title, message }) => {
        showToast(message, "success");
        if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body: message, icon: "/favicon.ico" });
        setQuizPending(prev => prev + 1);
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(tid);
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── refreshCreditsAndConfirmations — silent background poll ──────────────
  const refreshCreditsAndConfirmations = useCallback(async () => {
    const studentId = student.id;
    if (!studentId) return;
    try {
      const [acceptedRaw, { data: freshStudent }, pendingConf] = await Promise.all([
        getStudentBookings(studentId, "accepted"),
        api.get(`/students/${studentId}`),
        getStudentBookings(studentId, "pending_confirmation"),
      ]);
      rawAcceptedRef.current = acceptedRaw;
      const classesRemaining = freshStudent?.classCredits || 0;
      setProgress(prev => ({ ...prev, classesRemaining, totalLessons: prev.completedLessons + classesRemaining }));
      setPendingConfirmations(prev => {
        const newConfs = pendingConf.map(b => ({
          id: b._id, bookingId: b._id, title: b.classTitle,
          teacher: `${b.teacherId.firstName} ${b.teacherId.lastName}`,
          scheduledTime: b.scheduledTime, duration: b.duration,
          teacherConfirmedAt: b.teacherConfirmedAt, autoConfirmAt: b.autoConfirmAt,
          topic: b.topic || "English Lesson",
        }));
        if (newConfs.length > prev.length && "Notification" in window && Notification.permission === "granted") {
          new Notification("✅ Class Confirmation", {
            body: `Please confirm attendance for "${newConfs[0]?.title}"`,
            icon: "/favicon.ico",
          });
        }
        return newConfs;
      });
    } catch { /* silent */ }
  }, [student.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Heartbeat tick counter ─────────────────────────────────────────────────
  useEffect(() => {
    const tickRef = { current: 0 };
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      tickRef.current += 1;
      if (tickRef.current % TICK_REFRESH === 0) refreshCreditsAndConfirmations();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [refreshCreditsAndConfirmations]);

  // ── Client-side class-status ticker (zero API calls) ──────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const raw = rawAcceptedRef.current;
      if (!raw.length) return;
      const now = Date.now();
      const active = [], upcoming = [];
      raw.forEach(booking => {
        const result = classifyBooking(booking, now);
        if (result.bucket === "active") active.push(result.item);
        else if (result.bucket === "upcoming") upcoming.push(result.item);
      });
      setActiveClasses(prev => {
        const changed = active.length !== prev.length || active.some((a, i) => a.status !== prev[i]?.status);
        return changed ? active : prev;
      });
      setUpcomingClasses(prev => (upcoming.length !== prev.length ? upcoming : prev));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // ── Badges ─────────────────────────────────────────────────────────────────
  const triggerCelebration = (msg, emoji) => {
    setCelebrationMessage(msg); setCelebrationEmoji(emoji);
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 8000);
  };

  const checkEarnedBadges = (count, streak, weekly, list) =>
    BADGE_DEFINITIONS.filter(b => {
      if (b.type === "streak") return streak >= b.requirement;
      if (b.type === "total")  return count >= b.requirement;
      if (b.type === "weekly") return weekly >= b.requirement;
      if (b.id === "early_bird") return list.some(c => new Date(c.scheduledTime).getHours() < 9);
      if (b.id === "night_owl")  return list.some(c => new Date(c.scheduledTime).getHours() >= 20);
      return count >= b.requirement;
    });

  const checkForCelebrationAndBadges = () => {
    const earned = checkEarnedBadges(completedClasses.length, progress.streakDays, progress.weeklyCompleted, completedClasses);
    const newOnes = earned.filter(b => !badges.some(x => x.id === b.id));
    if (newOnes.length) { setNewBadge(newOnes[newOnes.length - 1]); triggerCelebration(newOnes[newOnes.length - 1].name, newOnes[newOnes.length - 1].icon); }
    setBadges(earned);
    const n = completedClasses.length;
    if (progress.streakDays === 5)  triggerCelebration("🔥 Amazing! 5-Day Streak!", "🔥");
    else if (progress.streakDays === 10) triggerCelebration("⚡ 10-Day Streak Master!", "⚡");
    else if (n === 25) triggerCelebration("🎓 25 Classes Done!", "🎓");
    else if (n === 50) triggerCelebration("🏆 50 Classes!", "🏆");
  };

  useEffect(() => { checkForCelebrationAndBadges(); }, [completedClasses, progress.streakDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];
  const handleStreakLoaded = (currentStreak) => {
    const hit = STREAK_MILESTONES.find(m => currentStreak === m && !seenStreakMilestones.has(m));
    if (!hit) return;
    const msgs = { 3: ["🌱 3-Day Streak!", "🌱"], 7: ["🔥 One Full Week!", "🔥"], 14: ["⚡ Two Weeks Strong!", "⚡"], 30: ["🌟 30-Day Legend!", "🌟"], 50: ["💎 50 Days! Incredible!", "💎"], 100: ["🏆 100-Day Master!", "🏆"] };
    triggerCelebration(msgs[hit][0], msgs[hit][1]);
    const next = new Set(seenStreakMilestones).add(hit);
    setSeenStreakMilestones(next);
    localStorage.setItem("seenStreakMilestones", JSON.stringify([...next]));
  };

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      return { date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), classes: completedClasses.filter(c => { const x = new Date(c.scheduledTime); x.setHours(0, 0, 0, 0); return x.getTime() === d.getTime(); }).length };
    }).reverse();
    const last30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      return { date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), classes: completedClasses.filter(c => { const x = new Date(c.scheduledTime); x.setHours(0, 0, 0, 0); return x.getTime() === d.getTime(); }).length };
    }).reverse();
    const timeDist = [
      { name: "Morning",   value: 0, color: "#f97316" },
      { name: "Afternoon", value: 0, color: "#3b82f6" },
      { name: "Evening",   value: 0, color: "#8b5cf6" },
      { name: "Night",     value: 0, color: "#06b6d4" },
    ];
    completedClasses.forEach(c => {
      const h = new Date(c.scheduledTime).getHours();
      if (h >= 6 && h < 12) timeDist[0].value++;
      else if (h >= 12 && h < 18) timeDist[1].value++;
      else if (h >= 18 && h < 24) timeDist[2].value++;
      else timeDist[3].value++;
    });
    return { last7, last30, timeDist };
  }, [completedClasses]);

  // ── Share ──────────────────────────────────────────────────────────────────
  const shareAchievement = (type) => {
    let title = "", message = "";
    if (type === "streak")     { title = `${progress.streakDays}-Day Streak!`;    message = `I've completed ${progress.streakDays} days of learning! 🔥`; }
    else if (type === "total") { title = `${progress.completedLessons} Classes!`; message = `I completed ${progress.completedLessons} English classes! 📚`; }
    else if (type === "badge") { const b = badges[badges.length - 1]; title = `${b?.name} Badge!`; message = `I earned the "${b?.name}" badge ${b?.icon}!`; }
    setShareData({ title, message }); setShowShareModal(true);
  };

  const copyShareText = () => { navigator.clipboard.writeText(shareData.message); showToast("Copied!"); };
  const shareOnSocial = (p) => {
    const t = encodeURIComponent(shareData.message), u = encodeURIComponent(window.location.origin);
    const urls = { twitter: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`, linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, whatsapp: `https://wa.me/?text=${t}%20${u}` };
    window.open(urls[p], "_blank", "width=600,height=400");
  };

  // ── Filtered completed ─────────────────────────────────────────────────────
  const filteredCompleted = useMemo(() => {
    let f = completedClasses;
    if (searchQuery) f = f.filter(c => [c.title, c.topic, c.teacher].some(s => s.toLowerCase().includes(searchQuery.toLowerCase())));
    if (startDate && endDate) {
      const s = new Date(startDate), e = new Date(endDate); e.setHours(23, 59, 59, 999);
      f = f.filter(c => { const d = new Date(c.scheduledTime); return d >= s && d <= e; });
    }
    return f.sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));
  }, [completedClasses, searchQuery, startDate, endDate]);

  const totalPages = Math.ceil(filteredCompleted.length / itemsPerPage);
  const paged = filteredCompleted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  useEffect(() => setCurrentPage(1), [searchQuery, startDate, endDate]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleJoinClass = async (classItem) => {
    try {
      const bookingId = classItem.bookingId || classItem.id;
      if (!bookingId) { showToast("Missing booking ID", "error"); return; }
      const { data } = await api.get(`/bookings/${bookingId}`);
      navigate("/classroom", { state: { classData: { id: bookingId, bookingId, title: classItem.title || "Class", topic: classItem.topic || "English Lesson", duration: classItem.duration, teacherGoogleMeetLink: data.booking?.teacherId?.googleMeetLink || "" }, userRole: "student" } });
    } catch { showToast("Failed to join class", "error"); }
  };

  const handleLeaveClassroom = () => { setIsClassroomOpen(false); setActiveClass(null); fetchStudentData(); };

  // ── Push notification handlers ─────────────────────────────────────────────
  const enableNotifications = async () => {
    if (!pushSupported()) { showToast("Your browser doesn't support push notifications"); return; }
    const { ok, reason } = await enablePush();
    if (ok) {
      setNotificationsEnabled(true); setNotificationPermission("granted");
      localStorage.setItem("notificationsEnabled", "true");
      showToast("🔔 Notifications enabled! You'll be reminded before class.");
    } else if (reason === "denied") {
      showToast("Notifications blocked. Please allow them in your browser settings.");
    } else {
      showToast("Could not enable notifications. Try again later.");
    }
  };

  const disableNotifications = async () => {
    await disablePush();
    setNotificationsEnabled(false);
    localStorage.setItem("notificationsEnabled", "false");
    showToast("Notifications disabled");
  };

  // ── Return everything shells need ──────────────────────────────────────────
  return {
    student, activeTab, setActiveTab,
    unreadMessages, setUnreadMessages,
    loading, isDarkMode, setIsDarkMode,
    toast, showToast,
    showCelebration, celebrationMessage, celebrationEmoji, newBadge,
    badges,
    showShareModal, setShowShareModal, shareData,
    notificationsEnabled, notificationPermission,
    enableNotifications, disableNotifications,
    activeClasses, upcomingClasses, completedClasses,
    progress, notifications, setNotifications,
    searchQuery, setSearchQuery, startDate, setStartDate, endDate, setEndDate,
    currentPage, setCurrentPage, filteredCompleted, paged, totalPages,
    isClassroomOpen, setIsClassroomOpen, activeClass, setActiveClass,
    pendingConfirmations,
    showConfirmationModal, setShowConfirmationModal, selectedConfirmation, setSelectedConfirmation,
    homeworkPending, quizPending,
    showChangePassword, setShowChangePassword,
    showSessionManagement, setShowSessionManagement,
    showSettingsSidebar, setShowSettingsSidebar,
    showSettingsModal, setShowSettingsModal,
    chartData,
    handleLogout, handleJoinClass, handleLeaveClassroom, fetchStudentData,
    getTimeRemaining, shareAchievement, copyShareText, shareOnSocial,
    handleStreakLoaded, triggerCelebration,
  };
}
