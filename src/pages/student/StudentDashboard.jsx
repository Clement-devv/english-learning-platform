// src/pages/student/StudentDashboard.jsx - WITH WORKING LIGHT/DARK MODE
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Settings, Search, Download, ChevronLeft, ChevronRight, Calendar, Clock, User,
  Award, Trophy, Star, TrendingUp, Share2, Bell, Sun, MessageCircle, Moon, X, Check, AlertTriangle
} from "lucide-react";
import Confetti from 'react-confetti';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
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
import ClassConfirmation from '../../components/student/ClassConfirmation';
import jsPDF from "jspdf";
import "jspdf-autotable";


// Import booking service to fetch real data
import { getStudentBookings } from "../../services/bookingService";

// FEATURE #2: Badge definitions
const BADGE_DEFINITIONS = [
  { id: 'first_class', name: 'First Steps', icon: '🎯', requirement: 1, description: 'Complete your first class' },
  { id: 'streak_5', name: '5-Day Warrior', icon: '🔥', requirement: 5, description: '5 consecutive days of learning', type: 'streak' },
  { id: 'streak_10', name: '10-Day Champion', icon: '⚡', requirement: 10, description: '10 consecutive days of learning', type: 'streak' },
  { id: 'streak_30', name: '30-Day Legend', icon: '👑', requirement: 30, description: '30 consecutive days of learning', type: 'streak' },
  { id: 'total_5', name: 'Getting Started', icon: '🌟', requirement: 5, description: 'Complete 5 total classes', type: 'total' },
  { id: 'total_10', name: 'Dedicated Learner', icon: '📚', requirement: 10, description: 'Complete 10 total classes', type: 'total' },
  { id: 'total_25', name: 'Expert Student', icon: '🎓', requirement: 25, description: 'Complete 25 total classes', type: 'total' },
  { id: 'total_50', name: 'Master Scholar', icon: '🏆', requirement: 50, description: 'Complete 50 total classes', type: 'total' },
  { id: 'total_100', name: 'Century Club', icon: '💯', requirement: 100, description: 'Complete 100 total classes', type: 'total' },
  { id: 'weekly_5', name: 'Weekly Hero', icon: '⭐', requirement: 5, description: '5 classes in one week', type: 'weekly' },
  { id: 'early_bird', name: 'Early Bird', icon: '🌅', requirement: 1, description: 'Attend a morning class (before 9 AM)', type: 'special' },
  { id: 'night_owl', name: 'Night Owl', icon: '🦉', requirement: 1, description: 'Attend an evening class (after 8 PM)', type: 'special' },
];

export default function StudentDashboard() {
  const navigate = useNavigate();
  
  // Modal States
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSessionManagement, setShowSessionManagement] = useState(false);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // FEATURE #1: Enhanced celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");
  const [celebrationEmoji, setCelebrationEmoji] = useState("");
  
  // FEATURE #2: Badges state
  const [badges, setBadges] = useState([]);
  const [newBadge, setNewBadge] = useState(null);
  
  // FEATURE #4: Share modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareData, setShareData] = useState(null);
  
  // FEATURE #5: Dark Mode (FIXED!)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  
  // FEATURE #6: Notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  
  // Tab state
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Classroom state
  //const [activeClassroom, setActiveClassroom] = useState(null);
  const [isClassroomOpen, setIsClassroomOpen] = useState(false);
  const [activeClass, setActiveClass] = useState(null);

  //Student class confirmation
const [pendingConfirmations, setPendingConfirmations] = useState([]);
const [showConfirmationModal, setShowConfirmationModal] = useState(false);
const [selectedConfirmation, setSelectedConfirmation] = useState(null);
  
  // Get student info with proper full name
  const [student, setStudent] = useState(() => {
    const studentInfo = localStorage.getItem('studentInfo');
    if (studentInfo) {
      const parsed = JSON.parse(studentInfo);
      return {
        id: parsed._id || parsed.id,
        firstName: parsed.firstName || "",
        surname: parsed.surname || parsed.lastName || "",
        name: `${parsed.firstName || ""} ${parsed.surname || parsed.lastName || ""}`.trim(),
        email: parsed.email,
        continent: parsed.continent || "",
        noOfClasses: parsed.noOfClasses || 0,
        level: "Intermediate"
      };
    }
    return { 
      name: "Student", 
      firstName: "Student",
      surname: "",
      level: "Intermediate" 
    };
  });

  // Real data from backend
  const [activeClasses, setActiveClasses] = useState([]);
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [completedClasses, setCompletedClasses] = useState([]);
  const [progress, setProgress] = useState({
    completedLessons: 0,
    totalLessons: 0,
    streakDays: 0,
    weeklyGoal: 5,
    weeklyCompleted: 0,
  });
  const [notifications, setNotifications] = useState([]);

  // Completed Classes Search and Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // FEATURE #5: Apply dark mode to body
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    showToast(isDarkMode ? 'Light mode enabled' : 'Dark mode enabled');
  };

  // Fetch student data on component mount
  useEffect(() => {
    fetchStudentData();
  }, []);

  // FEATURE #1 & #2: Check for celebrations and badges
  useEffect(() => {
    checkForCelebrationAndBadges();
  }, [completedClasses, progress.streakDays]);

  // FEATURE #6: Request notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      if (localStorage.getItem('notificationsEnabled') === 'true') {
        setNotificationsEnabled(true);
      }
    }
  }, []);

  // FEATURE #6: Check for upcoming classes and send notifications
  useEffect(() => {
    if (notificationsEnabled && notificationPermission === 'granted') {
      const interval = setInterval(checkUpcomingClassNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [notificationsEnabled, notificationPermission, upcomingClasses]);

  const getTimeRemaining = (autoConfirmAt) => {
    if (!autoConfirmAt) return "Unknown";
    const now = new Date();
    const confirmTime = new Date(autoConfirmAt);
    const diff = confirmTime - now;
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };


// This ensures bookingId is ALWAYS present when joining a class

const fetchStudentData = async () => {
  try {
    setLoading(true);
    const studentId = student.id;

    if (!studentId) {
      showToast("Student information not found. Please login again.", "error");
      handleLogout();
      return;
    }

    // ✅ FETCH ALL BOOKING TYPES (DO THIS ONCE!)
    const [acceptedBookings, completedBookings, pendingConfirmationBookings] = await Promise.all([
      getStudentBookings(studentId, "accepted"),
      getStudentBookings(studentId, "completed"),
      getStudentBookings(studentId, "pending_confirmation")
    ]);

    console.log(`📊 Fetched bookings:`, {
      accepted: acceptedBookings.length,
      completed: completedBookings.length,
      pendingConfirmation: pendingConfirmationBookings.length
    });

    const now = new Date();
    const active = [];
    const upcoming = [];

    // ✅ PROCESS PENDING CONFIRMATIONS (use pendingConfirmationBookings from Promise.all)
    const formattedPendingConfirmations = pendingConfirmationBookings.map(booking => ({
      id: booking._id,
      bookingId: booking._id,
      title: booking.classTitle,
      teacher: `${booking.teacherId.firstName} ${booking.teacherId.lastName}`,
      teacherId: booking.teacherId._id,
      scheduledTime: booking.scheduledTime,
      duration: booking.duration,
      teacherConfirmedAt: booking.teacherConfirmedAt,
      autoConfirmAt: booking.autoConfirmAt,
      topic: booking.topic || "English Lesson"
    }));

    setPendingConfirmations(formattedPendingConfirmations);
    console.log('📋 Pending confirmations set:', formattedPendingConfirmations.length);

    // Process accepted bookings
    acceptedBookings.forEach((booking) => {
      const scheduledDate = new Date(booking.scheduledTime);
      const timeDiff = scheduledDate - now;

      const completeClassData = {
        id: booking._id,
        bookingId: booking._id,
        title: booking.classTitle,
        teacher: `${booking.teacherId.firstName} ${booking.teacherId.lastName}`,
        teacherId: booking.teacherId._id,
        topic: booking.topic || "English Lesson",
        scheduledTime: booking.scheduledTime,
        scheduledDate: scheduledDate,
        duration: booking.duration,
        notes: booking.notes || ""
      };

      // ✅ Validation
      if (!completeClassData.duration) {
        console.warn(`⚠️ Booking ${booking._id} has no duration! Using 30 as emergency fallback.`);
        completeClassData.duration = 30;
      }

      // Log for debugging
      console.log('📊 Processing booking:', {
        bookingId: completeClassData.bookingId,
        duration: completeClassData.duration,
        title: completeClassData.title
      });

      // Active/Live classes (starting within 15 minutes or currently happening)
      if (timeDiff < 900000 && timeDiff > -(booking.duration * 60 * 1000)) {
        active.push({
          ...completeClassData,
          time: scheduledDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }),
          status: timeDiff < 0 ? "live" : "starting-soon",
          participants: 1,
          maxParticipants: 12
        });
        
        console.log('✅ Added to active classes:', completeClassData.title);
      } 
      // Starting soon (within 2 hours)
      else if (timeDiff > 0 && timeDiff < 7200000) {
        active.push({
          ...completeClassData,
          time: scheduledDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }),
          status: "starting-soon",
          participants: 1,
          maxParticipants: 12
        });
        
        console.log('✅ Added to starting-soon:', completeClassData.title);
      }
      // Upcoming (more than 2 hours away)
      else if (timeDiff > 0) {
        upcoming.push({
          ...completeClassData,
          time: scheduledDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          enrolled: true
        });
        
        console.log('✅ Added to upcoming:', completeClassData.title);
      }
    });

    // Process completed classes
    const completed = completedBookings.map((booking) => {
      const scheduledDate = new Date(booking.scheduledTime);
      return {
        id: booking._id,
        bookingId: booking._id,
        title: booking.classTitle,
        teacher: `${booking.teacherId.firstName} ${booking.teacherId.lastName}`,
        topic: booking.topic || "Completed Lesson",
        scheduledTime: booking.scheduledTime,
        scheduledDate: scheduledDate,
        fullDateTime: scheduledDate.toLocaleString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        duration: booking.duration || 60,
        notes: booking.notes || "",
        status: "completed"
      };
    });


    // ✅ Debug logs to verify data structure
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 STUDENT DATA LOADED:');
    console.log('Active classes:', active.length);
    console.log('Upcoming classes:', upcoming.length);
    console.log('Completed classes:', completed.length);
    
    if (active.length > 0) {
      console.log('🔍 First active class structure:');
      console.log('  - ID:', active[0].id);
      console.log('  - BookingId:', active[0].bookingId);
      console.log('  - Duration:', active[0].duration);
      console.log('  - Title:', active[0].title);
      
      // ✅ Verify critical fields exist
      if (!active[0].bookingId) {
        console.error('❌ CRITICAL: Active class missing bookingId!');
      } else {
        console.log('✅ All critical fields present');
      }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Update state with processed data
    setActiveClasses(active);
    setUpcomingClasses(upcoming);
    setCompletedClasses(completed);

    // Calculate progress metrics
    const weeklyCompleted = calculateWeeklyCompleted(completed);
    const streakDays = calculateStreakDays(completed);
    
    // Get actual student data to show classes remaining
    const studentInfo = JSON.parse(localStorage.getItem('studentInfo'));
    const classesRemaining = studentInfo?.noOfClasses || 0;
    const completedCount = completed.length;
    const totalClassesPaid = completedCount + classesRemaining;
    
    setProgress({
      completedLessons: completedCount,
      totalLessons: totalClassesPaid,
      classesRemaining: classesRemaining,
      streakDays: streakDays,
      weeklyGoal: 5,
      weeklyCompleted: weeklyCompleted,
    });

    // Generate notifications for upcoming classes
    const newNotifications = [];
    active.forEach((cls) => {
      if (cls.status === "starting-soon") {
        newNotifications.push({
          id: `class-${cls.id}`,
          type: "class",
          message: `${cls.title} starts soon!`,
          time: cls.time,
          read: false
        });
      }
    });

    if (newNotifications.length > 0) {
      setNotifications((prev) => [...newNotifications, ...prev]);
    }

    setLoading(false);

  } catch (err) {
    console.error("Failed to fetch student data:", err);
    showToast("Failed to load your classes", "error");
    setLoading(false);
  }
};


  const calculateStreakDays = (completedBookings) => {
    if (completedBookings.length === 0) return 0;
    
    const sorted = completedBookings
      .map(b => new Date(b.scheduledTime))
      .sort((a, b) => b - a);
    
    let streak = 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const mostRecent = new Date(sorted[0]);
    mostRecent.setHours(0, 0, 0, 0);
    const dayDiff = Math.floor((today - mostRecent) / (1000 * 60 * 60 * 24));
    
    if (dayDiff > 1) return 0;
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = new Date(sorted[i]);
      const next = new Date(sorted[i + 1]);
      current.setHours(0, 0, 0, 0);
      next.setHours(0, 0, 0, 0);
      
      const diff = Math.floor((current - next) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        streak++;
      } else if (diff > 1) {
        break;
      }
    }
    
    return streak;
  };

  const calculateWeeklyCompleted = (completedBookings) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    return completedBookings.filter(b => 
      new Date(b.scheduledTime) >= weekAgo
    ).length;
  };

  const checkEarnedBadges = (completedCount, streakDays, weeklyCount, completedList) => {
    const earned = [];
    
    BADGE_DEFINITIONS.forEach(badge => {
      if (badge.type === 'streak' && streakDays >= badge.requirement) {
        earned.push(badge);
      } else if (badge.type === 'total' && completedCount >= badge.requirement) {
        earned.push(badge);
      } else if (badge.type === 'weekly' && weeklyCount >= badge.requirement) {
        earned.push(badge);
      } else if (badge.type === 'special') {
        if (badge.id === 'early_bird') {
          const hasEarlyClass = completedList.some(cls => {
            const hour = new Date(cls.scheduledTime).getHours();
            return hour < 9;
          });
          if (hasEarlyClass) earned.push(badge);
        } else if (badge.id === 'night_owl') {
          const hasLateClass = completedList.some(cls => {
            const hour = new Date(cls.scheduledTime).getHours();
            return hour >= 20;
          });
          if (hasLateClass) earned.push(badge);
        }
      } else if (!badge.type && completedCount >= badge.requirement) {
        earned.push(badge);
      }
    });
    
    return earned;
  };

  const checkForCelebrationAndBadges = () => {
    const completedCount = completedClasses.length;
    const streakDays = progress.streakDays;
    const weeklyCount = progress.weeklyCompleted;
    
    const earnedBadges = checkEarnedBadges(completedCount, streakDays, weeklyCount, completedClasses);
    const previousBadges = badges.map(b => b.id);
    const newlyEarnedBadges = earnedBadges.filter(b => !previousBadges.includes(b.id));
    
    if (newlyEarnedBadges.length > 0) {
      const latestBadge = newlyEarnedBadges[newlyEarnedBadges.length - 1];
      setNewBadge(latestBadge);
      setBadges(earnedBadges);
      triggerCelebration(latestBadge.name, latestBadge.icon);
      return;
    }
    
    setBadges(earnedBadges);
    
    if (streakDays === 5) {
      triggerCelebration("🔥 Amazing! 5-Day Learning Streak! 🔥", "🔥");
    } else if (streakDays === 10) {
      triggerCelebration("⚡ Incredible! 10-Day Streak Master! ⚡", "⚡");
    } else if (streakDays === 30) {
      triggerCelebration("👑 Legendary! 30-Day Streak Champion! 👑", "👑");
    } else if (completedCount === 25) {
      triggerCelebration("🎓 Milestone Reached! 25 Classes Completed! 🎓", "🎓");
    } else if (completedCount === 50) {
      triggerCelebration("🏆 Half Century! 50 Classes Conquered! 🏆", "🏆");
    } else if (completedCount === 100) {
      triggerCelebration("💯 Century Club! 100 Classes Mastered! 💯", "💯");
    }
  };

  const triggerCelebration = (message, emoji) => {
    setCelebrationMessage(message);
    setCelebrationEmoji(emoji);
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 8000);
  };

  const checkUpcomingClassNotifications = () => {
    upcomingClasses.forEach(cls => {
      const classTime = new Date(cls.scheduledDate);
      const now = new Date();
      const timeDiff = classTime - now;
      
      if (timeDiff > 0 && timeDiff <= 600000) {
        sendBrowserNotification(
          'Class Starting Soon!',
          `${cls.title} starts in 10 minutes`,
          cls
        );
      }
      else if (timeDiff > 0 && timeDiff <= 3600000 && timeDiff > 3540000) {
        sendBrowserNotification(
          'Class Reminder',
          `${cls.title} starts in 1 hour`,
          cls
        );
      }
    });
  };

  const sendBrowserNotification = (title, body, classData) => {
    if (notificationPermission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: '/logo.png',
        badge: '/badge.png',
        tag: classData.id,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        handleJoinClass(classData);
        notification.close();
      };
    }
  };

  const enableNotifications = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('notificationsEnabled', 'true');
        showToast('Notifications enabled successfully!');
      } else {
        showToast('Notification permission denied', 'error');
      }
    } else {
      showToast('Your browser does not support notifications', 'error');
    }
  };

  const disableNotifications = () => {
    setNotificationsEnabled(false);
    localStorage.setItem('notificationsEnabled', 'false');
    showToast('Notifications disabled');
  };

  const getChartData = () => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const count = completedClasses.filter(cls => {
        const clsDate = new Date(cls.scheduledTime);
        clsDate.setHours(0, 0, 0, 0);
        return clsDate.getTime() === date.getTime();
      }).length;
      
      last7Days.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        classes: count
      });
    }

    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const count = completedClasses.filter(cls => {
        const clsDate = new Date(cls.scheduledTime);
        clsDate.setHours(0, 0, 0, 0);
        return clsDate.getTime() === date.getTime();
      }).length;
      
      last30Days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        classes: count
      });
    }

    const timeDistribution = [
      { name: 'Morning (6AM-12PM)', value: 0, color: '#3b82f6' },
      { name: 'Afternoon (12PM-6PM)', value: 0, color: '#10b981' },
      { name: 'Evening (6PM-12AM)', value: 0, color: '#f59e0b' },
      { name: 'Night (12AM-6AM)', value: 0, color: '#8b5cf6' },
    ];

    completedClasses.forEach(cls => {
      const hour = new Date(cls.scheduledTime).getHours();
      if (hour >= 6 && hour < 12) timeDistribution[0].value++;
      else if (hour >= 12 && hour < 18) timeDistribution[1].value++;
      else if (hour >= 18 && hour < 24) timeDistribution[2].value++;
      else timeDistribution[3].value++;
    });

    return { last7Days, last30Days, timeDistribution };
  };

  const shareAchievement = (type) => {
    let message = '';
    let title = '';

    if (type === 'streak') {
      title = `${progress.streakDays}-Day Streak!`;
      message = `I've completed ${progress.streakDays} consecutive days of learning on our English Learning Platform! 🔥`;
    } else if (type === 'total') {
      title = `${progress.completedLessons} Classes Completed!`;
      message = `I've successfully completed ${progress.completedLessons} English classes! Keep learning! 📚`;
    } else if (type === 'badge') {
      const latestBadge = badges[badges.length - 1];
      title = `${latestBadge.name} Badge Earned!`;
      message = `I just earned the "${latestBadge.name}" badge ${latestBadge.icon}! ${latestBadge.description}`;
    }

    setShareData({ title, message });
    setShowShareModal(true);
  };

  const copyShareText = () => {
    navigator.clipboard.writeText(shareData.message);
    showToast('Copied to clipboard!');
  };

  const shareOnSocial = (platform) => {
    const text = encodeURIComponent(shareData.message);
    const url = encodeURIComponent(window.location.origin);
    
    let shareUrl = '';
    
    if (platform === 'twitter') {
      shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    } else if (platform === 'facebook') {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`;
    } else if (platform === 'linkedin') {
      shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    } else if (platform === 'whatsapp') {
      shareUrl = `https://wa.me/?text=${text}%20${url}`;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const filteredCompletedClasses = useMemo(() => {
    let filtered = completedClasses;

    if (searchQuery) {
      filtered = filtered.filter((cls) =>
        cls.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.teacher.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      filtered = filtered.filter((cls) => {
        const classDate = new Date(cls.scheduledTime);
        return classDate >= start && classDate <= end;
      });
    }

    return filtered.sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));
  }, [completedClasses, searchQuery, startDate, endDate]);

  const totalPages = Math.ceil(filteredCompletedClasses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCompletedClasses = filteredCompletedClasses.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate]);

  const generatePDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("My Completed Classes", 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Student: ${student.name}`, 14, 30);
    doc.text(`Email: ${student.email}`, 14, 36);
    
    if (startDate && endDate) {
      doc.text(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, 14, 42);
    } else {
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 42);
    }
    
    doc.text(`Total Classes: ${filteredCompletedClasses.length}`, 14, 48);

    const tableData = filteredCompletedClasses.map((cls, index) => [
      index + 1,
      cls.title,
      cls.topic,
      cls.teacher,
      cls.fullDateTime,
      `${cls.duration} mins`
    ]);

    doc.autoTable({
      startY: 55,
      head: [['#', 'Class Title', 'Topic', 'Teacher', 'Date & Time', 'Duration']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 40 },
        5: { cellWidth: 20 }
      }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    const filename = startDate && endDate
      ? `completed-classes-${startDate}-to-${endDate}.pdf`
      : `completed-classes-${new Date().toISOString().split('T')[0]}.pdf`;
    
    doc.save(filename);
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem("studentToken");
    localStorage.removeItem("studentSessionToken");
    localStorage.removeItem("studentInfo");
    navigate("/student/login");
  };

  const handlePasswordChanged = () => {
    setShowChangePassword(false);
    showToast("Password changed successfully!");
  };

  const handleJoinClass = async (classItem) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎓 STUDENT JOINING CLASS');
  console.log('📋 classItem received:', classItem);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const bookingId = classItem.bookingId || classItem.id;
    
    if (!bookingId) {
      console.error('❌ ERROR: No bookingId found!');
      showToast('Cannot join class: Missing booking ID', 'error');
      return;
    }
    
    console.log('📥 Fetching booking details for:', bookingId);
    
    const { data: bookingData } = await api.get(`/api/bookings/${bookingId}`);
    const teacherGoogleMeetLink = bookingData.booking?.teacherId?.googleMeetLink || '';
    
    console.log('🔗 Teacher Google Meet Link:', teacherGoogleMeetLink);
    
    const classroomData = {
      id: bookingId,
      bookingId: bookingId,
      title: classItem.title || "Class",
      topic: classItem.topic || "English Lesson",
      duration: classItem.duration,
      teacherGoogleMeetLink: teacherGoogleMeetLink
    };
    
    console.log('🚀 Navigating to classroom with data:', classroomData);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    navigate("/classroom", { 
      state: { 
        classData: classroomData, 
        userRole: "student" 
      } 
    });
    
  } catch (err) {
    console.error('❌ Error joining class:', err);
    showToast('Failed to join class. Please try again.', 'error');
  }
};

  const handleLeaveClassroom = () => {
  setIsClassroomOpen(false);
  setActiveClass(null);  
  fetchStudentData();
  };



  const handleEnrollClass = (classId) => {
    showToast("Enrollment feature coming soon!");
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDarkMode ? 'border-blue-400' : 'border-blue-600'} mx-auto`}></div>
          <p className={`mt-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (isClassroomOpen && activeClass) {  
  return (
    <Classroom
      classData={activeClass} 
      userRole="student"
      onLeave={handleLeaveClassroom}
    />
  );
}

  const chartData = getChartData();

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* FEATURE #1: Enhanced Celebration with Confetti */}
      {showCelebration && (
        <>
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={500}
            gravity={0.3}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className={`${isDarkMode ? 'bg-gradient-to-r from-blue-700 to-indigo-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} text-white px-12 py-8 rounded-3xl shadow-2xl animate-bounce text-center pointer-events-auto`}>
              <div className="text-6xl mb-4">{celebrationEmoji}</div>
              <h2 className="text-4xl font-bold mb-2">{celebrationMessage}</h2>
              <p className="text-xl">Keep up the amazing work!</p>
              <div className="mt-4 text-5xl">🌺🎈🌸🎈🌺</div>
              
              <button
                onClick={() => shareAchievement(newBadge ? 'badge' : progress.streakDays >= 5 ? 'streak' : 'total')}
                className="mt-6 px-6 py-3 bg-white text-gray-800 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2 mx-auto"
              >
                <Share2 className="w-5 h-5" />
                Share Achievement
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          toast.type === "error" 
            ? "bg-red-500 text-white" 
            : "bg-green-500 text-white"
        }`}>
          {toast.message}
        </div>
      )}

      <Header
        student={student}
        notifications={notifications}
        onLogout={handleLogout}
        onChangePassword={() => setShowChangePassword(true)}
        onManageSessions={() => setShowSessionManagement(true)}
      />


      {/* 🆕 PENDING CONFIRMATIONS BANNER */}
      {pendingConfirmations.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          {pendingConfirmations.map(confirmation => (
            <div 
              key={confirmation.id}
              className={`${isDarkMode ? 'bg-yellow-900/30 border-yellow-800' : 'bg-yellow-50 border-yellow-200'} border-2 rounded-2xl p-4 mb-4`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={`w-5 h-5 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                    <h3 className={`font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-800'}`}>
                      Class Completion Confirmation Required
                    </h3>
                  </div>
                  <p className={`text-sm ${isDarkMode ? 'text-yellow-500' : 'text-yellow-700'} mb-2`}>
                    Your teacher marked <strong>"{confirmation.title}"</strong> as complete. Please confirm attendance.
                  </p>
                  <p className={`text-xs ${isDarkMode ? 'text-yellow-600' : 'text-yellow-600'}`}>
                    Auto-confirms in: <strong>{getTimeRemaining(confirmation.autoConfirmAt)}</strong>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedConfirmation(confirmation);
                    setShowConfirmationModal(true);
                  }}
                  className={`px-4 py-2 ${isDarkMode ? 'bg-yellow-700 hover:bg-yellow-600' : 'bg-yellow-500 hover:bg-yellow-600'} text-white rounded-lg font-medium transition-all whitespace-nowrap`}
                >
                  Review Class
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation Tabs */}
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
  <div className={`flex gap-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} mb-6 overflow-x-auto`}>
    <button
      onClick={() => setActiveTab("dashboard")}
      className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
        activeTab === "dashboard"
          ? `${isDarkMode ? 'text-blue-400 border-blue-400' : 'text-blue-600 border-blue-600'} border-b-2`
          : `${isDarkMode ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'}`
      }`}
    >
      Dashboard
    </button>
    
    <button
      onClick={() => setActiveTab("completed-classes")}
      className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
        activeTab === "completed-classes"
          ? `${isDarkMode ? 'text-blue-400 border-blue-400' : 'text-blue-600 border-blue-600'} border-b-2`
          : `${isDarkMode ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'}`
      }`}
    >
      Completed Classes ({completedClasses.length})
    </button>
    
    <button
      onClick={() => setActiveTab("badges")}
      className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
        activeTab === "badges"
          ? `${isDarkMode ? 'text-blue-400 border-blue-400' : 'text-blue-600 border-blue-600'} border-b-2`
          : `${isDarkMode ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'}`
      }`}
    >
      <Award className="w-5 h-5" />
      Badges ({badges.length}/{BADGE_DEFINITIONS.length})
    </button>
    
    <button
      onClick={() => setActiveTab("charts")}
      className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
        activeTab === "charts"
          ? `${isDarkMode ? 'text-blue-400 border-blue-400' : 'text-blue-600 border-blue-600'} border-b-2`
          : `${isDarkMode ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'}`
      }`}
    >
      <TrendingUp className="w-5 h-5" />
      Progress Charts
    </button>
    
    {/* 🆕 MOVED INSIDE - Messages Tab */}
    <button
      onClick={() => setActiveTab("messages")}
      className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
        activeTab === "messages"
          ? `${isDarkMode ? 'text-blue-400 border-blue-400' : 'text-blue-600 border-blue-600'} border-b-2`
          : `${isDarkMode ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'}`
      }`}
    >
      <MessageCircle className="w-5 h-5" />
      Messages
    </button>
  </div>
</div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <>
            <WelcomeSection studentName={student.name} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 mt-6">
              <div className="lg:col-span-2 space-y-6">
                <ActiveClasses 
                  activeClasses={activeClasses} 
                  onJoin={handleJoinClass} 
                />
                <UpcomingClasses 
                  upcomingClasses={upcomingClasses} 
                  onEnroll={handleEnrollClass} 
                />
              </div>

              <div className="space-y-6">
                <ProgressCard progress={progress} />
                
                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>Recent Badges</h3>
                    <button
                      onClick={() => setActiveTab("badges")}
                      className={`text-sm ${isDarkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-600'} px-3 py-1 rounded-full hover:opacity-80`}
                    >
                      View All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {badges.slice(-4).map((badge) => (
                      <div
                        key={badge.id}
                        className="flex flex-col items-center"
                        title={badge.description}
                      >
                        <div className="text-4xl mb-1">{badge.icon}</div>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-center`}>{badge.name}</p>
                      </div>
                    ))}
                    {badges.length === 0 && (
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-center w-full`}>
                        Complete classes to earn badges!
                      </p>
                    )}
                  </div>
                </div>

                <QuickActions />
                <NotificationsCard 
                  notifications={notifications}
                  onClearAll={() => setNotifications([])}
                />
              </div>
            </div>
          </>
        )}

        {/* Completed Classes Tab */}
        {activeTab === "completed-classes" && (
          <div className="space-y-6">
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>My Completed Classes</h2>
                <button
                  onClick={generatePDF}
                  className={`flex items-center gap-2 px-4 py-2 ${isDarkMode ? 'bg-gradient-to-r from-blue-700 to-indigo-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} text-white rounded-lg hover:opacity-90 transition-colors`}
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'} w-5 h-5`} />
                  <input
                    type="text"
                    placeholder="Search classes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  />
                </div>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`px-4 py-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`px-4 py-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
              </div>

              <div className={`mt-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Showing {startIndex + 1}-{Math.min(endIndex, filteredCompletedClasses.length)} of {filteredCompletedClasses.length} classes
              </div>
            </div>

            {currentCompletedClasses.length === 0 ? (
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-12 text-center`}>
                <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-500'} text-lg`}>
                  {searchQuery || startDate || endDate
                    ? "No classes found matching your criteria"
                    : "No completed classes yet"}
                </p>
                {(searchQuery || startDate || endDate) && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setStartDate("");
                      setEndDate("");
                    }}
                    className={`mt-4 px-4 py-2 ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} underline`}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className={`${isDarkMode ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'} rounded-lg shadow-md divide-y`}>
                {currentCompletedClasses.map((cls, index) => (
                  <div key={cls.id} className={`p-6 ${isDarkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'} transition-colors`}>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div className={`${isDarkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-600'} rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0`}>
                            {startIndex + index + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>{cls.title}</h3>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mt-1`}>
                              <span className="font-medium">Topic:</span> {cls.topic}
                            </p>
                            
                            <div className={`flex flex-wrap items-center gap-4 mt-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              <div className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                <span>{cls.teacher}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>{cls.fullDateTime}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{cls.duration} minutes</span>
                              </div>
                            </div>

                            {cls.notes && (
                              <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} italic`}>
                                Note: {cls.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          ✓ Completed
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg ${isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border hover:bg-gray-50'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <span className={`px-4 py-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Page {currentPage} of {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg ${isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border hover:bg-gray-50'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* FEATURE #2: Badges Tab */}
        {activeTab === "badges" && (
          <div className="space-y-6">
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>Achievement Badges</h2>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mt-1`}>
                    Earned {badges.length} of {BADGE_DEFINITIONS.length} badges
                  </p>
                </div>
                
                <button
                  onClick={() => shareAchievement('badge')}
                  className={`flex items-center gap-2 px-4 py-2 ${isDarkMode ? 'bg-gradient-to-r from-blue-700 to-indigo-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} text-white rounded-lg hover:opacity-90`}
                  disabled={badges.length === 0}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {BADGE_DEFINITIONS.map((badge) => {
                  const earned = badges.some(b => b.id === badge.id);
                  return (
                    <div
                      key={badge.id}
                      className={`p-4 rounded-lg border-2 text-center transition-all ${
                        earned 
                          ? `${isDarkMode ? 'border-blue-700 bg-blue-900/20' : 'border-blue-200 bg-blue-50'} transform hover:scale-105` 
                          : `${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'} opacity-60`
                      }`}
                    >
                      <div className={`text-5xl mb-2 ${earned ? '' : 'grayscale'}`}>
                        {badge.icon}
                      </div>
                      <h3 className={`font-semibold text-sm mb-1 ${earned ? (isDarkMode ? 'text-gray-100' : 'text-gray-800') : (isDarkMode ? 'text-gray-400' : 'text-gray-500')}`}>
                        {badge.name}
                      </h3>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>{badge.description}</p>
                      {earned ? (
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          <Check className="w-3 h-3 inline" /> Earned
                        </span>
                      ) : (
                        <span className={`inline-block px-2 py-1 ${isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'} text-xs rounded-full`}>
                          Locked
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress towards next badges */}
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>Next Badges</h3>
              <div className="space-y-4">
                {BADGE_DEFINITIONS.filter(b => !badges.some(earned => earned.id === b.id))
                  .slice(0, 3)
                  .map((badge) => {
                    let current = 0;
                    let target = badge.requirement;
                    
                    if (badge.type === 'streak') {
                      current = progress.streakDays;
                    } else if (badge.type === 'total') {
                      current = completedClasses.length;
                    } else if (badge.type === 'weekly') {
                      current = progress.weeklyCompleted;
                    }
                    
                    const percentage = Math.min((current / target) * 100, 100);
                    
                    return (
                      <div key={badge.id} className={`${isDarkMode ? 'border-gray-700' : 'border'} rounded-lg p-4`}>
                        <div className="flex items-center gap-4 mb-2">
                          <div className="text-3xl">{badge.icon}</div>
                          <div className="flex-1">
                            <h4 className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>{badge.name}</h4>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{badge.description}</p>
                          </div>
                        </div>
                        {badge.type !== 'special' && (
                          <>
                            <div className={`w-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2 mb-1`}>
                              <div 
                                className={`${isDarkMode ? 'bg-gradient-to-r from-blue-700 to-indigo-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} h-2 rounded-full transition-all`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-right`}>
                              {current} / {target}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* FEATURE #3: Charts Tab */}
        {activeTab === "charts" && (
          <div className="space-y-6">
            {/* Last 7 Days */}
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>Classes - Last 7 Days</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.last7Days}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="date" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#f3f4f6' : '#111827'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="classes" fill={isDarkMode ? '#60a5fa' : '#3b82f6'} name="Classes Completed" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Last 30 Days */}
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>Classes - Last 30 Days</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData.last30Days}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="date" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#f3f4f6' : '#111827'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="classes" 
                    stroke={isDarkMode ? '#60a5fa' : '#3b82f6'} 
                    strokeWidth={2}
                    name="Classes Completed"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Time Distribution */}
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>Classes by Time of Day</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.timeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.timeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#f3f4f6' : '#111827'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Statistics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-blue-50'} rounded-lg p-6 text-center`}>
                <div className={`text-4xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} mb-2`}>
                  {completedClasses.length}
                </div>
                <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Total Classes</p>
              </div>
              
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-blue-50'} rounded-lg p-6 text-center`}>
                <div className={`text-4xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} mb-2`}>
                  {progress.streakDays}
                </div>
                <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Day Streak</p>
              </div>
              
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-blue-50'} rounded-lg p-6 text-center`}>
                <div className={`text-4xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} mb-2`}>
                  {completedClasses.length > 0 
                    ? Math.round(completedClasses.reduce((sum, cls) => sum + cls.duration, 0) / 60)
                    : 0}
                </div>
                <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Total Hours</p>
              </div>
            </div>
          </div>
        )}
        {/* Messages Tab */}
        {activeTab === "messages" && (
          <MessagesTab userRole="student" />
        )}
      </main>

      {/* FEATURE #4: Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl max-w-md w-full p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>Share Achievement</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className={`p-2 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-blue-50'} rounded-lg p-4 mb-6`}>
              <h4 className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} mb-2`}>{shareData?.title}</h4>
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{shareData?.message}</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={copyShareText}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 ${isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'} rounded-lg transition-colors`}
              >
                <Check className="w-5 h-5" />
                Copy to Clipboard
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => shareOnSocial('twitter')}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1DA1F2] text-white rounded-lg hover:opacity-90"
                >
                  Twitter
                </button>
                <button
                  onClick={() => shareOnSocial('facebook')}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1877F2] text-white rounded-lg hover:opacity-90"
                >
                  Facebook
                </button>
                <button
                  onClick={() => shareOnSocial('linkedin')}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0A66C2] text-white rounded-lg hover:opacity-90"
                >
                  LinkedIn
                </button>
                <button
                  onClick={() => shareOnSocial('whatsapp')}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] text-white rounded-lg hover:opacity-90"
                >
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-30">
        {/* FEATURE #6: Notification Bell */}
        <button
          onClick={() => notificationsEnabled ? disableNotifications() : enableNotifications()}
          className={`p-4 rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 group ${
            notificationsEnabled 
              ? 'bg-gradient-to-r from-green-600 to-teal-600' 
              : 'bg-gradient-to-r from-gray-600 to-gray-700'
          } text-white`}
          title={notificationsEnabled ? 'Notifications Enabled' : 'Enable Notifications'}
        >
          <Bell className={`w-6 h-6 ${notificationsEnabled ? 'animate-pulse' : ''}`} />
        </button>

        {/* FEATURE #5: Dark Mode Toggle (NEW!) */}
        <button
          onClick={toggleDarkMode}
          className={`p-4 ${isDarkMode ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-indigo-600 to-purple-600'} text-white rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 group`}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettingsSidebar(true)}
          className={`p-4 ${isDarkMode ? 'bg-gradient-to-r from-blue-700 to-indigo-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} text-white rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 group`}
          aria-label="Open Settings"
        >
          <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Modals */}
      {showChangePassword && (
        <ChangePassword
          onClose={() => setShowChangePassword(false)}
          onSuccess={handlePasswordChanged}
        />
      )}

      {showSessionManagement && (
        <SessionManagement
          isOpen={showSessionManagement}
          onClose={() => setShowSessionManagement(false)}
          userType="student"
        />
      )}

      {showSettingsSidebar && (
        <SettingsSidebar
          isOpen={showSettingsSidebar}
          onClose={() => setShowSettingsSidebar(false)}
          onChangePassword={() => {
            setShowSettingsSidebar(false);
            setShowChangePassword(true);
          }}
          onManageSessions={() => {
            setShowSettingsSidebar(false);
            setShowSessionManagement(true);
          }}
          onManage2FA={() => {
            setShowSettingsSidebar(false);
            setShowSettingsModal(true);
          }}
          userInfo={{
            firstName: student.firstName,
            lastName: student.surname,
            email: student.email,
            continent: student.continent
          }}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          userType="student"
        />
      )}


      {/* 🆕 CLASS CONFIRMATION MODAL */}
      {showConfirmationModal && selectedConfirmation && (
        <ClassConfirmation
          booking={selectedConfirmation}
          onConfirm={() => {
            setShowConfirmationModal(false);
            setSelectedConfirmation(null);
            showToast('Class confirmed successfully!');
            fetchStudentData(); // Refresh data
          }}
          onDispute={() => {
            setShowConfirmationModal(false);
            setSelectedConfirmation(null);
            showToast('Dispute submitted. Admin will review.');
            fetchStudentData(); // Refresh data
          }}
          onClose={() => {
            setShowConfirmationModal(false);
            setSelectedConfirmation(null);
          }}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}

