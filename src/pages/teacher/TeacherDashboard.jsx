// src/pages/teacher/TeacherDashboard.jsx - NEW SIDEBAR DESIGN + 100% ORIGINAL LOGIC
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Settings, Plus, MessageCircle, Video, Repeat,
  Home, Calendar, CheckCircle, Users, BookOpen,
  DollarSign, LogOut, Menu, ChevronRight,
  GraduationCap, RefreshCw, AlertCircle, CalendarDays, Film, Star, Bell
} from "lucide-react";

// ── Layout (original) ─────────────────────────────────────────────────────────
import DashboardHeader from "./components/Layout/DashboardHeader";

// ── Change Password (original) ────────────────────────────────────────────────
import ChangePassword from "../../components/teacher/auth/ChangePassword";

// ── Classes (original) ────────────────────────────────────────────────────────
import ClassList           from "./components/classes/ClassList";
import ClassModal          from "./components/classes/ClassModal";
import ConfirmModal        from "./components/classes/ConfirmModal";
import CompletedClassesTab from "./components/classes/CompletedClasses";

// ── Students (original) ───────────────────────────────────────────────────────
import StudentProgressList from "./components/students/StudentProgressList";

// ── Bookings (original) ───────────────────────────────────────────────────────
import BookingList from "./components/bookings/BookingList";

// ── Dashboard widgets (original) ──────────────────────────────────────────────
import QuickStats      from "./components/dashboard/QuickStats";
import LiveClasses     from "./components/dashboard/LiveClasses";
import UpcomingClasses from "./components/dashboard/UpcomingClasses";
import Classroom       from "../../pages/Classroom";

// ── Dark Mode (original) ──────────────────────────────────────────────────────
import { useDarkMode }  from "../../hooks/useDarkMode";
import DarkModeToggle   from "../../components/DarkModeToggle";

// ── Session / Settings (original) ─────────────────────────────────────────────
import SessionManagement from "../../components/SessionManagement";
import SettingsSidebar   from "../../components/SettingsSidebar";
import SettingsModal     from "../../components/SettingsModal";

// ── Messages / Payment / Meet / Recurring (original) ──────────────────────────
import MessagesTab        from "../../components/chat/MessagesTab";
import PaymentTab         from "./tabs/PaymentTab";
import HomeworkTab        from "./tabs/HomeworkTab";
import QuizTab           from "./tabs/QuizTab";
import VocabTab          from "./tabs/VocabTab";
import RecordingsTab     from "./tabs/RecordingsTab";
import ReviewsTab       from "./tabs/ReviewsTab";
import ScheduleTab        from "./tabs/ScheduleTab";
import GoogleMeetSettings from "../../components/GoogleMeetSettings";
import RecurringClassForm from "../../components/teacher/RecurringClassForm";
import api                from "../../api";
import { getUserTimezone } from "../../utils/timezone";
import { pushSupported, enablePush, disablePush, getPushStatus } from "../../utils/pushNotifications";

// ── Services (original) ───────────────────────────────────────────────────────
import { getAssignedStudents } from "../../services/teacherStudentService";
import {
  getTeacherBookings,
  acceptBooking,
  rejectBooking,
  createBooking,
  deleteBooking,
  cancelBooking,
} from "../../services/bookingService";

// ── Sidebar nav config ────────────────────────────────────────────────────────
const NAV = [
  { key: "dashboard",         label: "Dashboard",         icon: Home          },
  { key: "schedule",          label: "Schedule",          icon: CalendarDays  },
  { key: "classes",           label: "My Classes",        icon: Calendar      },
  { key: "completed-classes", label: "Completed Classes", icon: CheckCircle   },
  { key: "students",          label: "Students",          icon: Users         },
  { key: "bookings",          label: "Bookings",          icon: BookOpen      },
  { key: "messages",          label: "Messages",          icon: MessageCircle },
  { key: "payment",           label: "Payment",           icon: DollarSign    },
  { key: "homework",          label: "Homework",          icon: BookOpen      },
  { key: "quiz",              label: "Quizzes",           icon: GraduationCap },
  { key: "vocab",             label: "Vocabulary",        icon: BookOpen      },
  { key: "recordings",        label: "Recordings",        icon: Film          },
  { key: "reviews",           label: "My Reviews",        icon: Star          },
];

export default function TeacherDashboard() {
  const navigate = useNavigate();

  // ── Original state (100% preserved) ──────────────────────────────────────────
  const [teacherInfo,    setTeacherInfo]    = useState(null);
  const [activeTab,      setActiveTab]      = useState("dashboard");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [toast,          setToast]          = useState("");
  const [showSessionManagement, setShowSessionManagement] = useState(false);
  const [showSettingsSidebar,   setShowSettingsSidebar]   = useState(false);
  const [showSettingsModal,     setShowSettingsModal]     = useState(false);
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [activeClass,    setActiveClass]    = useState(null);
  const [isClassroomOpen,setIsClassroomOpen]= useState(false);
  const [students,       setStudents]       = useState([]);
  const [bookings,       setBookings]       = useState([]);
  const [classes,        setClasses]        = useState([]);
  const [completedClasses, setCompletedClasses] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [googleMeetLink, setGoogleMeetLink] = useState("");
  const [showGoogleMeetSettings, setShowGoogleMeetSettings] = useState(false);
  const [showRecurringForm,      setShowRecurringForm]      = useState(false);
  const [isModalOpen,    setIsModalOpen]    = useState(false);
  const [confirmModal,   setConfirmModal]   = useState({ open: false, type: null, classId: null });
  const [homeworkToGrade, setHomeworkToGrade] = useState(0);
  const prevHomeworkToGradeRef = useRef(null);
  const [quizAttempted, setQuizAttempted] = useState(0);
  const prevQuizAttemptedRef = useRef(null);

  // ── Push notifications ────────────────────────────────────────────────────────
  const [pushEnabled, setPushEnabled] = useState(false);
  useEffect(() => {
    if (!pushSupported()) return;
    getPushStatus().then(setPushEnabled);
  }, []);

  async function togglePush() {
    if (pushEnabled) {
      await disablePush();
      setPushEnabled(false);
      showToast("Notifications disabled");
    } else {
      const { ok, reason } = await enablePush();
      if (ok) {
        setPushEnabled(true);
        showToast("🔔 Notifications enabled! You'll be reminded before class.");
      } else if (reason === "denied") {
        showToast("Notifications blocked — allow them in browser settings.", "error");
      } else {
        showToast("Could not enable notifications.", "error");
      }
    }
  }

  // ── New sidebar state ─────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted,     setMounted]     = useState(false);

  const location = useLocation();

  // ── Original useEffect ────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    const teacherData = JSON.parse(localStorage.getItem("teacherInfo") || "{}");
    if (!teacherData._id && !teacherData.id) {
      navigate("/teacher/login");
      return;
    }
    setTeacherInfo(teacherData);
    fetchTeacherData();
  }, [navigate]);

  useEffect(() => {
    if (location.state?.classCompleted) {
      setActiveTab(location.state.activeTab || "payment");
      navigate(location.pathname, { replace: true, state: {} });
    } else if (location.state?.classMissed) {
      setActiveTab(location.state.activeTab || "bookings");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.classCompleted, location.state?.classMissed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Homework submission count polling ─────────────────────────────────────
  useEffect(() => {
    const checkHomework = async () => {
      try {
        const { data } = await api.get("/api/homework/my");
        const toGrade = (data.homework || []).filter(h => h.status === "submitted").length;
        setHomeworkToGrade(toGrade);

        // Notify if a new submission came in since last check
        if (prevHomeworkToGradeRef.current !== null && toGrade > prevHomeworkToGradeRef.current) {
          const diff = toGrade - prevHomeworkToGradeRef.current;
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("📬 Homework Submitted!", {
              body: `${diff} student${diff > 1 ? "s have" : " has"} submitted homework for you to grade.`,
              icon: "/favicon.ico",
            });
          }
        }
        prevHomeworkToGradeRef.current = toGrade;
      } catch { /* silent */ }
    };

    checkHomework();
    const interval = setInterval(checkHomework, 90 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Quiz attempt count polling ─────────────────────────────────────────────
  useEffect(() => {
    const checkQuizzes = async () => {
      try {
        const { data } = await api.get("/api/quiz/my");
        const attempted = (data.quizzes || []).filter(q => q.status === "attempted").length;
        setQuizAttempted(attempted);

        if (prevQuizAttemptedRef.current !== null && attempted > prevQuizAttemptedRef.current) {
          const diff = attempted - prevQuizAttemptedRef.current;
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("📝 Quiz Completed!", {
              body: `${diff} student${diff > 1 ? "s have" : " has"} completed a quiz. View results in the Quizzes tab.`,
              icon: "/favicon.ico",
            });
          }
        }
        prevQuizAttemptedRef.current = attempted;
      } catch { /* silent */ }
    };

    checkQuizzes();
    const interval = setInterval(checkQuizzes, 90 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Original fetchTeacherData (100% preserved) ────────────────────────────────
  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      const teacherData = JSON.parse(localStorage.getItem("teacherInfo") || "{}");
      const teacherId = teacherData._id || teacherData.id;
      setGoogleMeetLink(teacherData.googleMeetLink || "");
      console.log("✅ Teacher Info Loaded:", teacherData._id);

      if (!teacherId) throw new Error("No teacher ID found");

      // Silently update teacher's timezone so bookings created later carry correct TZ
      api.patch(`/api/teachers/${teacherId}/timezone`, { timezone: getUserTimezone() }).catch(() => {});

      const { data: apiTeacherData } = await api.get(`/api/teachers/${teacherId}`);
      setTeacherInfo(apiTeacherData);
      setGoogleMeetLink(apiTeacherData.googleMeetLink || "");
      console.log("✅ Teacher Info Loaded:", apiTeacherData._id);
      
      localStorage.setItem("teacherInfo", JSON.stringify({
        ...JSON.parse(localStorage.getItem("teacherInfo") || "{}"),
        ...apiTeacherData,
      }));

      const [studentsData, pendingBookingsData, acceptedBookingsData, completedBookingsData] =
        await Promise.all([
          getAssignedStudents(teacherId),
          getTeacherBookings(teacherId, "pending"),
          getTeacherBookings(teacherId, "accepted"),
          getTeacherBookings(teacherId, "completed"),
        ]);

      // Format students
      const studentsFormatted = studentsData.map((item) => ({
        _id:          item.student._id,
        id:           item.student._id,
        firstName:    item.student.firstName,
        surname:      item.student.surname || "",
        noOfClasses:  item.student.noOfClasses || 0,
        name:         `${item.student.firstName} ${item.student.surname}`,
        email:        item.student.email,
        status:       item.student.active ? "Active" : "Inactive",
        progress:     item.student.noOfClasses || 0,
        active:       item.student.active,
        age:          item.student.age || null,
        dateOfBirth:  item.student.dateOfBirth || null,
        rank:         item.student.rank || "",
        assignmentId: item.assignmentId,
        assignedDate: item.assignedDate,
      }));
      setStudents(studentsFormatted);

      // Format pending bookings
      const bookingsFormatted = pendingBookingsData.map((booking) => {
        const scheduledDate = new Date(booking.scheduledTime);
        return {
          id:            booking._id,
          name:          `${booking.studentId.firstName} ${booking.studentId.surname}`,
          studentId:     booking.studentId._id,
          studentName:   `${booking.studentId.firstName} ${booking.studentId.surname}`,
          classTitle:    booking.classTitle,
          topic:         booking.topic,
          time:          scheduledDate.toLocaleString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
          duration:      booking.duration,
          notes:         booking.notes,
          status:        booking.status,
          isAdminBooking:   booking.createdBy === "admin",
          scheduledTime:    booking.scheduledTime,
          rawDate:          scheduledDate,
          teacherTimezone:  booking.teacherTimezone || "",
          studentTimezone:  booking.studentTimezone || "",
        };
      });
      setBookings(bookingsFormatted);

      // Build classes map from accepted bookings
      const classesMap = new Map();
      acceptedBookingsData.forEach((booking) => {
        const scheduledDate = new Date(booking.scheduledTime);
        const now           = new Date();
        const timeDiff      = scheduledDate - now;

        let status = "scheduled";
        if      (timeDiff < -3600000)                status = "completed";
        else if (timeDiff < 0 && timeDiff > -3600000) status = "live";
        else if (timeDiff > 0 && timeDiff < 900000)   status = "upcoming-soon";

        const groupKey = `${booking.scheduledTime}_${booking.classTitle}`;

        if (classesMap.has(groupKey)) {
          const existing = classesMap.get(groupKey);
          existing.students.push(`${booking.studentId.firstName} ${booking.studentId.surname}`);
          existing.bookingIds.push(booking._id);
        } else {
          classesMap.set(groupKey, {
            id:           booking._id,
            title:        booking.classTitle,
            topic:        booking.topic || "Scheduled Lesson",
            time:         scheduledDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
            date:         scheduledDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            fullDateTime: scheduledDate.toLocaleString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
            scheduledTime:booking.scheduledTime,
            scheduledDate,
            status,
            students:  [`${booking.studentId.firstName} ${booking.studentId.surname}`],
            duration:  booking.duration,
            notes:     booking.notes,
            bookingId: booking._id,
            bookingIds:[booking._id],
          });
        }
      });

      const activeClasses   = [];
      const finishedClasses = [];
      classesMap.forEach((cls) => {
        if (cls.status === "completed") finishedClasses.push(cls);
        else                            activeClasses.push(cls);
      });
      setClasses(activeClasses);

      // Build completed map
      const completedMap = new Map();
      completedBookingsData.forEach((booking) => {
        const scheduledDate = new Date(booking.scheduledTime);
        const groupKey = `${booking.scheduledTime}_${booking.classTitle}`;
        if (completedMap.has(groupKey)) {
          completedMap.get(groupKey).students.push(`${booking.studentId.firstName} ${booking.studentId.surname}`);
        } else {
          completedMap.set(groupKey, {
            id:                  booking._id,
            title:               booking.classTitle,
            topic:               booking.topic || "Completed Lesson",
            fullDateTime:        scheduledDate.toLocaleString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
            scheduledTime:       booking.scheduledTime,
            scheduledDate,
            students:            [`${booking.studentId.firstName} ${booking.studentId.surname}`],
            duration:            booking.duration,
            status:              "completed",
            adminRejected:       booking.adminRejected || false,
            adminRejectedReason: booking.adminRejectedReason || "",
            adminRejectedAt:     booking.adminRejectedAt || null,
            disputeRaised:       booking.disputeRaised || false,
          });
        }
      });

      setCompletedClasses([...finishedClasses, ...Array.from(completedMap.values())]);
    } catch (err) {
      console.error("Failed to load teacher data:", err);
      console.error("Error details:", err.response?.data?.message || "Failed to load teacher data");
      showToast("Failed to load data from server", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Original handlers (100% preserved) ───────────────────────────────────────
  const handleAcceptBooking = async (booking) => {
    try {
      await acceptBooking(booking.id);
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));

      const scheduledDate = new Date(booking.scheduledTime);
      const timeDiff      = scheduledDate - new Date();
      let status = "scheduled";
      if      (timeDiff < -3600000)               status = "completed";
      else if (timeDiff < 900000 && timeDiff > 0)  status = "upcoming-soon";

      setClasses((prev) => [...prev, {
        id:           booking.id,
        title:        booking.classTitle,
        topic:        booking.topic || "Scheduled Lesson",
        time:         scheduledDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        date:         scheduledDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        fullDateTime: scheduledDate.toLocaleString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
        scheduledTime:booking.scheduledTime,
        scheduledDate,
        status,
        students:  [booking.studentName],
        duration:  booking.duration,
        notes:     booking.notes,
        bookingId: booking.id,
        bookingIds:[booking.id],
      }]);

      showToast(`Accepted booking for ${booking.name}! Class added to your schedule.`);
      setTimeout(fetchTeacherData, 1000);
    } catch (err) {
      console.error("Error accepting booking:", err);
      showToast("Failed to accept booking. Please try again.", "error");
    }
  };

  const handleRejectBooking = async (booking) => {
    try {
      const reason = prompt("Reason for rejection (optional):");
      await rejectBooking(booking.id, reason || "");
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      showToast(`Rejected booking for ${booking.name}`);
    } catch (err) {
      console.error("Error rejecting booking:", err);
      showToast("Failed to reject booking", "error");
    }
  };

  const handleAddClass = async (newClass) => {
    try {
      if (!newClass.students || newClass.students.length === 0) {
        showToast("Please select at least one student for the class", "error");
        return;
      }
      const teacherId     = teacherInfo._id || teacherInfo.id;
      const scheduledDate = new Date(newClass.time);
      const isoString     = scheduledDate.toISOString();

      console.log("Creating class with details:", { teacher: teacherId, students: newClass.students.length, scheduledTime: isoString, duration: parseInt(newClass.duration) });

      const bookingPromises = newClass.students.map(async (student) => {
        const bookingData = {
          teacherId,
          studentId:    student.id,
          classTitle:   newClass.title,
          topic:        newClass.topic || "",
          scheduledTime:isoString,
          duration:     parseInt(newClass.duration),
          notes:        newClass.notes || "Teacher-created class",
          createdBy:    "teacher",
        };
        console.log("📤 Creating booking for student:", student.name);
        const response = await api.post("/api/bookings", bookingData);
        console.log("✅ Booking created:", response.data.booking._id);
        if (response.data.booking.status === "pending") {
          return await acceptBooking(response.data.booking._id);
        }
        return response.data.booking;
      });

      const createdBookings = await Promise.all(bookingPromises);
      console.log(`✅ Created ${createdBookings.length} bookings`);
      showToast(`Class "${newClass.title}" created successfully for ${newClass.students.length} student(s)!`, "success");
      await fetchTeacherData();
    } catch (err) {
      console.error("❌ Error creating class:", err);
      if (err.response) { console.error("Response error:", err.response.data); console.error("Status code:", err.response.status); }
      else if (err.request) { console.error("Request error - no response received"); console.error("Is backend running on port 5000?"); }
      else { console.error("Error:", err.message); }
      showToast(err.response?.data?.message || err.message || "Failed to create class. Please check your connection and try again.", "error");
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(""), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherSessionToken");
    localStorage.removeItem("teacherInfo");
    navigate("/teacher/login");
  };

  const handlePasswordChangeSuccess = (message) => {
    showToast(message);
  };

  const askCancelClass = (classItem) => {
    const classId = typeof classItem === "object" ? (classItem.id || classItem.bookingId) : classItem;
    console.log("✅ Cancel classId:", classId);
    setConfirmModal({ open: true, type: "cancel", classId });
  };

  const askDeleteClass = (classItem) => {
    const classId = typeof classItem === "object" ? (classItem.id || classItem.bookingId) : classItem;
    console.log("✅ Delete classId:", classId);
    setConfirmModal({ open: true, type: "delete", classId });
  };

  const handleConfirm = async () => {
    if (confirmModal.type === "cancel") {
      try {
        const classToCancel = classes.find((cls) => cls.id === confirmModal.classId);
        if (classToCancel?.bookingIds?.length > 0) {
          await Promise.all(classToCancel.bookingIds.map((bid) => cancelBooking(bid, "Teacher cancelled class")));
        } else {
          await cancelBooking(confirmModal.classId, "Teacher cancelled class");
        }
        setClasses((prev) => prev.map((cls) => cls.id === confirmModal.classId ? { ...cls, status: "cancelled" } : cls));
        showToast("Class cancelled successfully");
      } catch (err) {
        console.error("Error cancelling class:", err);
        showToast("Failed to cancel class", "error");
      }
    } else if (confirmModal.type === "delete") {
      try {
        const classToDelete = classes.find((cls) => cls.id === confirmModal.classId);
        if (classToDelete?.bookingIds?.length > 0) {
          await Promise.all(classToDelete.bookingIds.map((bid) => deleteBooking(bid)));
        } else {
          await deleteBooking(confirmModal.classId);
        }
        setClasses((prev) => prev.filter((cls) => cls.id !== confirmModal.classId));
        showToast("Class deleted successfully");
      } catch (err) {
        console.error("Error deleting class:", err);
        showToast("Failed to delete class", "error");
      }
    }
    setConfirmModal({ open: false, type: null, classId: null });
  };

  const handleJoinClass = (classItem) => {
    console.log("🚀 Starting class:", classItem);
    const classroomData = {
      id:                    classItem.id || classItem.bookingId,
      bookingId:             classItem.bookingId || classItem.id,
      title:                 classItem.title,
      teacher:               `${teacherInfo.firstName} ${teacherInfo.lastName}`,
      students:              classItem.students || [],
      duration:              classItem.duration,
      scheduledTime:         classItem.scheduledTime,
      teacherGoogleMeetLink: googleMeetLink,
    };
    console.log("📊 Classroom data:", classroomData);
    navigate("/classroom", { state: { classData: classroomData, userRole: "teacher" } });
  };

  const handleLeaveClassroom = () => {
    setIsClassroomOpen(false);
    setActiveClass(null);
  };

  // ── Computed ──────────────────────────────────────────────────────────────────
  const pendingBookings = bookings.length;
  const completedCount  = completedClasses.length;
  const c               = palette(isDarkMode);
  const activeLabel     = NAV.find((n) => n.key === activeTab)?.label || "Dashboard";

  // ── Original loading screen ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? "bg-gray-900" : "bg-gray-50"}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDarkMode ? "border-blue-400" : "border-blue-600"} mx-auto`} />
          <p className={`mt-4 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Original classroom override ───────────────────────────────────────────────
  if (isClassroomOpen && activeClass) {
    return <Classroom classData={activeClass} userRole="teacher" onLeave={handleLeaveClassroom} />;
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{globalCSS(isDarkMode)}</style>
      <div style={{ display: "flex", height: "100vh", background: c.bg, fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden", opacity: mounted ? 1 : 0, transition: "opacity 0.3s ease" }}>

        {/* ═══════════════════════════════════════════ SIDEBAR ══ */}
        <aside style={{ width: sidebarOpen ? "230px" : "60px", background: c.card, borderRight: `1px solid ${c.border}`, display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden", zIndex: 40 }}>

          {/* Logo */}
          <div style={{ height: "64px", display: "flex", alignItems: "center", padding: sidebarOpen ? "0 18px" : "0 14px", borderBottom: `1px solid ${c.border}`, gap: "10px", flexShrink: 0 }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0, background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GraduationCap size={15} color="white" />
            </div>
            {sidebarOpen && (
              <div style={{ overflow: "hidden" }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", color: c.heading, whiteSpace: "nowrap" }}>EduLearn</p>
                <p style={{ margin: 0, fontSize: "9px", color: c.muted, fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase" }}>Teacher Portal</p>
              </div>
            )}
          </div>

          {/* Nav items */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "10px 6px" }} className="td-scroll">
            {NAV.map(({ key, label, icon: Icon }) => {
              const active   = activeTab === key;
              const hasBadge = (key === "bookings" && pendingBookings > 0) || (key === "homework" && homeworkToGrade > 0) || (key === "quiz" && quizAttempted > 0);
              const badgeCount = key === "bookings" ? pendingBookings : key === "homework" ? homeworkToGrade : key === "quiz" ? quizAttempted : 0;
              return (
                <button key={key} onClick={() => setActiveTab(key)} title={!sidebarOpen ? label : undefined}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: sidebarOpen ? "9px 10px" : "9px 14px", borderRadius: "10px", border: "none", cursor: "pointer", background: active ? (isDarkMode ? "#1e1730" : "#f5f0ff") : "transparent", color: active ? (isDarkMode ? "#a78bfa" : "#7c3aed") : (isDarkMode ? "#4b5563" : "#64748b"), fontFamily: "inherit", fontSize: "13.5px", fontWeight: active ? "700" : "500", textAlign: "left", marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", position: "relative", transition: "all 0.15s" }}
                  className="td-nav-btn"
                >
                  {active && <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: "3px", borderRadius: "0 3px 3px 0", background: "#8b5cf6" }} />}
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  {sidebarOpen && <span style={{ flex: 1 }}>{label}</span>}
                  {sidebarOpen && hasBadge && (
                    <span style={{ background: "#ef4444", color: "white", borderRadius: "10px", fontSize: "10px", fontWeight: "800", padding: "1px 7px", flexShrink: 0 }}>{badgeCount}</span>
                  )}
                  {!sidebarOpen && hasBadge && (
                    <span style={{ position: "absolute", top: "6px", right: "6px", width: "8px", height: "8px", background: "#ef4444", borderRadius: "50%" }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom controls */}
          <div style={{ borderTop: `1px solid ${c.border}`, padding: "10px 6px", flexShrink: 0 }}>
            <button onClick={toggleDarkMode} title={isDarkMode ? "Light Mode" : "Dark Mode"}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: sidebarOpen ? "9px 10px" : "9px 14px", borderRadius: "10px", border: "none", cursor: "pointer", background: "transparent", color: isDarkMode ? "#4b5563" : "#64748b", fontFamily: "inherit", fontSize: "13.5px", fontWeight: "500", textAlign: "left", marginBottom: "4px", whiteSpace: "nowrap" }}
              className="td-nav-btn"
            >
              <span style={{ fontSize: "15px", flexShrink: 0 }}>{isDarkMode ? "☀️" : "🌙"}</span>
              {sidebarOpen && <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>}
            </button>

            <button onClick={() => setShowSettingsSidebar(true)} title="Settings"
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: sidebarOpen ? "9px 10px" : "9px 14px", borderRadius: "10px", border: "none", cursor: "pointer", background: "transparent", color: isDarkMode ? "#4b5563" : "#64748b", fontFamily: "inherit", fontSize: "13.5px", fontWeight: "500", textAlign: "left", marginBottom: "4px", whiteSpace: "nowrap" }}
              className="td-nav-btn"
            >
              <Settings size={16} style={{ flexShrink: 0 }} />
              {sidebarOpen && <span>Settings</span>}
            </button>

            <button onClick={handleLogout} title="Logout"
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: sidebarOpen ? "9px 10px" : "9px 14px", borderRadius: "10px", border: "none", cursor: "pointer", background: "transparent", color: "#ef4444", fontFamily: "inherit", fontSize: "13.5px", fontWeight: "500", textAlign: "left", whiteSpace: "nowrap" }}
              className="td-logout-btn"
            >
              <LogOut size={16} style={{ flexShrink: 0 }} />
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* ══════════════════════════════════════════ MAIN AREA ══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

          {/* Top bar */}
          <header style={{ height: "64px", background: c.card, borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "center", padding: "0 24px", gap: "16px", flexShrink: 0 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: "none", border: "none", cursor: "pointer", color: c.muted, padding: "6px", borderRadius: "8px", display: "flex", alignItems: "center" }}
              className="td-nav-btn"
            >
              <Menu size={20} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12.5px", color: c.muted, fontWeight: "500" }}>Teacher</span>
              <ChevronRight size={13} color={c.muted} />
              <span style={{ fontSize: "13px", color: c.heading, fontWeight: "700" }}>{activeLabel}</span>
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ background: isDarkMode ? "#1e1730" : "#f5f0ff", border: `1px solid ${isDarkMode ? "#2d1f4a" : "#ddd6fe"}`, borderRadius: "20px", padding: "4px 12px", fontSize: "11.5px", fontWeight: "700", color: isDarkMode ? "#a78bfa" : "#7c3aed" }}>
              👨‍🎓 {students.length} students
            </div>

            {pendingBookings > 0 && (
              <div onClick={() => setActiveTab("bookings")}
                style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "20px", padding: "4px 12px", fontSize: "11.5px", fontWeight: "700", color: "#ef4444", cursor: "pointer" }}>
                🔔 {pendingBookings} pending
              </div>
            )}

            {pushSupported() && (
              <button
                onClick={togglePush}
                title={pushEnabled ? "Disable push notifications" : "Enable push notifications"}
                style={{
                  background: pushEnabled ? "#16a34a" : (isDarkMode ? "#1e293b" : "#f1f5f9"),
                  border: `1px solid ${pushEnabled ? "#16a34a" : c.border}`,
                  borderRadius: "10px", padding: "7px 10px", cursor: "pointer",
                  color: pushEnabled ? "#fff" : c.muted, display: "flex", alignItems: "center",
                }}
              >
                <Bell size={16} fill={pushEnabled ? "currentColor" : "none"} />
              </button>
            )}

            <button onClick={() => setIsModalOpen(true)}
              style={{ background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", color: "white", border: "none", borderRadius: "10px", padding: "8px 14px", fontSize: "12.5px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px" }}>
              <Plus size={14} /> New Class
            </button>

            <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800", color: "white", flexShrink: 0 }}>
              {(teacherInfo?.firstName?.[0] || "T").toUpperCase()}
            </div>
          </header>

          {/* Scrollable content */}
          <main
            style={{ flex: 1, overflowY: "auto", padding: activeTab === "messages" ? "0" : "24px", background: c.bg }}
            className="td-scroll"
          >
            <div style={{ background: c.card, borderRadius: "16px", border: `1px solid ${c.border}`, minHeight: "calc(100vh - 112px)", padding: activeTab === "messages" ? "0" : "24px", overflow: activeTab === "messages" ? "hidden" : "visible" }}>

              {/* ─────────────────────────── DASHBOARD TAB ── */}
              {activeTab === "dashboard" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>

                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>
                        Welcome back, {teacherInfo?.firstName}! 👋
                      </h1>
                      <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>
                        You have <strong style={{ color: c.heading }}>{students.length}</strong> assigned students,{" "}
                        <strong style={{ color: c.heading }}>{classes.length}</strong> scheduled classes, and{" "}
                        <strong style={{ color: c.heading }}>{bookings.length}</strong> pending bookings
                      </p>
                    </div>
                    <button onClick={fetchTeacherData}
                      style={{ background: isDarkMode ? "#1e1730" : "#f5f0ff", border: `1px solid ${isDarkMode ? "#2d1f4a" : "#ddd6fe"}`, borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: isDarkMode ? "#a78bfa" : "#7c3aed", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontFamily: "inherit" }}>
                      <RefreshCw size={13} /> Refresh
                    </button>
                  </div>

                  {/* Stat cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px" }}>
                    {[
                      { icon: Users,       label: "Students",         value: students.length, sub: "assigned to you",   accent: "#8b5cf6", bg: isDarkMode ? "rgba(139,92,246,0.1)" : "#f5f3ff" },
                      { icon: Calendar,    label: "Classes",          value: classes.length,  sub: "scheduled total",   accent: "#3b82f6", bg: isDarkMode ? "rgba(59,130,246,0.1)"  : "#eff6ff" },
                      { icon: CheckCircle, label: "Completed",        value: completedCount,  sub: "classes finished",  accent: "#10b981", bg: isDarkMode ? "rgba(16,185,129,0.1)"  : "#f0fdf4" },
                      { icon: BookOpen,    label: "Pending Bookings", value: pendingBookings, sub: "awaiting response", accent: "#f59e0b", bg: isDarkMode ? "rgba(245,158,11,0.1)"  : "#fffbeb" },
                    ].map(({ icon: Icon, label, value, sub, accent, bg }) => (
                      <div key={label} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px", padding: "18px", display: "flex", gap: "12px", boxShadow: isDarkMode ? "none" : "0 2px 10px rgba(0,0,0,0.04)" }}>
                        <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={18} color={accent} />
                        </div>
                        <div>
                          <p style={{ margin: "0 0 3px", fontSize: "11px", fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                          <p style={{ margin: "0 0 2px", fontSize: "24px", fontWeight: "800", color: c.heading, lineHeight: 1 }}>{value}</p>
                          <p style={{ margin: 0, fontSize: "12px", color: accent, fontWeight: "600" }}>{sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Google Meet — original logic, new shell */}
                  {teacherInfo?._id && (
                    <div style={{ background: isDarkMode ? "#1e1730" : "#f5f0ff", border: `1px solid ${isDarkMode ? "#2d1f4a" : "#ddd6fe"}`, borderRadius: "14px", overflow: "hidden" }}>
                      <button
                        onClick={() => setShowGoogleMeetSettings(!showGoogleMeetSettings)}
                        style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg, #059669, #10b981)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Video size={16} color="white" />
                          </div>
                          <div style={{ textAlign: "left" }}>
                            <p style={{ margin: 0, fontSize: "13.5px", fontWeight: "700", color: c.heading }}>Google Meet Link</p>
                            <p style={{ margin: 0, fontSize: "12px", color: c.muted }}>{googleMeetLink ? "Link configured ✓" : "Click to set up your meeting link"}</p>
                          </div>
                        </div>
                        <div style={{ transform: showGoogleMeetSettings ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                          <svg style={{ width: "18px", height: "18px" }} fill="none" stroke={c.muted} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {showGoogleMeetSettings && (
                        <div style={{ padding: "16px 20px 20px", borderTop: `1px solid ${isDarkMode ? "#2d1f4a" : "#ddd6fe"}` }}>
                          <GoogleMeetSettings
                            teacherId={teacherInfo._id}
                            initialLink={googleMeetLink || ""}
                            onUpdate={(newLink) => setGoogleMeetLink(newLink)}
                            isDarkMode={isDarkMode}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Original dashboard widgets */}
                  <QuickStats
                    stats={{ totalStudents: students.length, totalClasses: classes.length, totalBookings: bookings.length }}
                    isDarkMode={isDarkMode}
                  />
                  <LiveClasses
                    classes={classes.filter((c) => c.status === "live")}
                    onJoin={handleJoinClass}
                    isDarkMode={isDarkMode}
                  />
                  <UpcomingClasses
                    classes={classes.filter((c) => c.status === "scheduled" || c.status === "upcoming-soon")}
                    students={students}
                    onCancel={askCancelClass}
                    onDelete={askDeleteClass}
                    isDarkMode={isDarkMode}
                  />
                </div>
              )}

              {/* ────────────────────────────── CLASSES TAB ── */}
              {activeTab === "classes" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>My Classes</h1>
                      <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>{classes.length} classes scheduled</p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => setShowRecurringForm(true)}
                        style={{ background: isDarkMode ? "#1e1730" : "#f5f0ff", border: `1px solid ${isDarkMode ? "#2d1f4a" : "#ddd6fe"}`, borderRadius: "10px", padding: "9px 16px", fontSize: "13px", fontWeight: "600", color: isDarkMode ? "#a78bfa" : "#7c3aed", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px" }}
                        className="td-nav-btn"
                      >
                        <Repeat size={14} /> Create Recurring Classes
                      </button>
                      <button
                        onClick={() => setIsModalOpen(true)}
                        style={{ background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", color: "white", border: "none", borderRadius: "10px", padding: "9px 16px", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        <Plus size={14} /> Add New Class
                      </button>
                    </div>
                  </div>

                  {classes.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 0", background: isDarkMode ? "#0f1117" : "#f8faff", borderRadius: "14px", border: `1px solid ${c.border}` }}>
                      <Calendar size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} />
                      <p style={{ fontSize: "14px", color: c.muted, margin: "0 0 4px", fontWeight: "600" }}>No classes scheduled yet</p>
                      <p style={{ fontSize: "12px", color: c.muted, margin: 0 }}>Accept booking requests to add classes to your schedule</p>
                    </div>
                  ) : (
                    <ClassList
                      data={classes}
                      onJoin={handleJoinClass}
                      onDelete={askDeleteClass}
                      isDarkMode={isDarkMode}
                    />
                  )}
                </div>
              )}

              {/* ─────────────────────────── COMPLETED TAB ── */}
              {activeTab === "completed-classes" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Completed Classes</h1>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>{completedClasses.length} classes completed</p>
                  </div>
                  <CompletedClassesTab
                    classes={completedClasses}
                    teacherInfo={teacherInfo}
                    isDarkMode={isDarkMode}
                  />
                </div>
              )}

              {/* ──────────────────────────── STUDENTS TAB ── */}
              {activeTab === "students" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>My Students</h1>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>{students.length} students assigned to you</p>
                  </div>
                  {students.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 0", background: isDarkMode ? "#0f1117" : "#f8faff", borderRadius: "14px", border: `1px solid ${c.border}` }}>
                      <Users size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} />
                      <p style={{ fontSize: "14px", color: c.muted, margin: 0, fontWeight: "600" }}>No students assigned yet</p>
                    </div>
                  ) : (
                    <StudentProgressList students={students} isDarkMode={isDarkMode} />
                  )}
                </div>
              )}

              {/* ──────────────────────────── BOOKINGS TAB ── */}
              {activeTab === "bookings" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Bookings</h1>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>{pendingBookings} pending · {bookings.length} total</p>
                  </div>
                  <BookingList
                    bookings={bookings}
                    onAccept={handleAcceptBooking}
                    onReject={handleRejectBooking}
                    isDarkMode={isDarkMode}
                  />
                </div>
              )}

              {/* ──────────────────────────── SCHEDULE TAB ── */}
              {activeTab === "schedule" && (
                <ScheduleTab
                  teacherInfo={teacherInfo}
                  isDarkMode={isDarkMode}
                  classes={classes}
                  bookings={bookings}
                  students={students}
                  onRefresh={fetchTeacherData}
                />
              )}

              {/* ──────────────────────────── MESSAGES TAB ── */}
              {activeTab === "messages" && <MessagesTab userRole="teacher" />}

              {/* ───────────────────────────── PAYMENT TAB ── */}
              {activeTab === "payment" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Payment</h1>
                  <PaymentTab teacher={teacherInfo} isDarkMode={isDarkMode} />
                </div>
              )}

              {/* ──────────────────────────── HOMEWORK TAB ── */}
              {activeTab === "homework" && (
                <HomeworkTab
                  teacherInfo={teacherInfo}
                  students={students}
                  isDarkMode={isDarkMode}
                />
              )}

              {/* ─────────────────────────────── QUIZ TAB ── */}
              {activeTab === "quiz" && (
                <QuizTab
                  teacherInfo={teacherInfo}
                  students={students}
                  isDarkMode={isDarkMode}
                />
              )}

              {/* ─────────────────────────────── VOCAB TAB ── */}
              {activeTab === "vocab" && (
                <VocabTab
                  teacherInfo={teacherInfo}
                  students={students}
                  isDarkMode={isDarkMode}
                />
              )}

              {/* ─────────────────────────────── RECORDINGS TAB ── */}
              {activeTab === "recordings" && (
                <RecordingsTab isDarkMode={isDarkMode} />
              )}

              {/* ──────────────────────────────── REVIEWS TAB ── */}
              {activeTab === "reviews" && (
                <ReviewsTab teacherInfo={teacherInfo} isDarkMode={isDarkMode} />
              )}

            </div>
          </main>
        </div>
      </div>

      {/* ── Toast (original) ── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === "error" ? "bg-red-500" : "bg-green-500"} text-white`}>
          {toast.message}
        </div>
      )}

      {/* ── Class Modal (original) ── */}
      <ClassModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddClass}
        students={students}
        isDarkMode={isDarkMode}
      />

      {/* ── Recurring Form Modal (original) ── */}
      {showRecurringForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <RecurringClassForm
              students={students}
              teacherInfo={teacherInfo}
              onSuccess={(pattern) => {
                console.log("✅ Recurring classes created:", pattern);
                setShowRecurringForm(false);
                showToast(`Successfully created ${pattern.occurrences} recurring classes!`, "success");
                setTimeout(() => { fetchTeacherData(); }, 1000);
              }}
              onCancel={() => setShowRecurringForm(false)}
            />
          </div>
        </div>
      )}

      {/* ── Confirm Modal (original) ── */}
      <ConfirmModal
        isOpen={confirmModal.open}
        type={confirmModal.type}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmModal({ open: false, type: null, classId: null })}
        isDarkMode={isDarkMode}
      />

      {/* ── Change Password (original) ── */}
      {showChangePassword && (
        <ChangePassword
          onClose={() => setShowChangePassword(false)}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}

      {/* ── Session Management (original) ── */}
      {showSessionManagement && (
        <SessionManagement
          onClose={() => setShowSessionManagement(false)}
          userType="teacher"
        />
      )}

      {/* ── Settings Sidebar (original) ── */}
      {showSettingsSidebar && (
        <SettingsSidebar
          isOpen={showSettingsSidebar}
          onClose={() => setShowSettingsSidebar(false)}
          onChangePassword={() => { setShowSettingsSidebar(false); setShowChangePassword(true); }}
          onManageSessions={() => { setShowSettingsSidebar(false); setShowSessionManagement(true); }}
          onManage2FA={() => { setShowSettingsSidebar(false); setShowSettingsModal(true); }}
          userInfo={{ firstName: teacherInfo?.firstName, lastName: teacherInfo?.lastName, email: teacherInfo?.email }}
        />
      )}

      {/* ── Settings Modal (original) ── */}
      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          userType="teacher"
        />
      )}
    </>
  );
}

// ── Palette helper ────────────────────────────────────────────────────────────
function palette(dark) {
  return {
    bg:      dark ? "#0f1117" : "#f4f6fb",
    card:    dark ? "#1a1d27" : "#ffffff",
    border:  dark ? "#1e2235" : "#e8ecf4",
    heading: dark ? "#e2e8f0" : "#1e293b",
    text:    dark ? "#94a3b8" : "#475569",
    muted:   dark ? "#374151" : "#94a3b8",
  };
}

// ── Global CSS ────────────────────────────────────────────────────────────────
function globalCSS(dark) {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; }
    .td-scroll::-webkit-scrollbar { width: 4px; }
    .td-scroll::-webkit-scrollbar-thumb { background: ${dark ? "#1e2235" : "#e0e4f4"}; border-radius: 4px; }
    .td-nav-btn:hover { background: ${dark ? "#1e1730 !important" : "#f5f0ff !important"}; color: ${dark ? "#a78bfa !important" : "#7c3aed !important"}; }
    .td-logout-btn:hover { background: rgba(239,68,68,0.08) !important; }
  `;
}
