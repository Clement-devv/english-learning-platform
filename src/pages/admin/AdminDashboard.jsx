// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { TabErrorBoundary } from "../../components/ErrorBoundary";
import { useAuth }          from "../../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, Video, User, Home, Bell, Users, DollarSign,
  Calendar, BarChart3, AlertTriangle, MessageCircle,
  X, BookOpen, Shield, CalendarDays, FileText, Star, Palette, Globe
} from "lucide-react";

// Always-needed (small utilities)
import api from "../../api";
import { useDarkMode } from "../../hooks/useDarkMode";
import { useBranding } from "../../context/BrandingContext";
import DashboardLayout  from "../../components/dashboard/DashboardLayout";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import DashboardTopBar  from "../../components/dashboard/DashboardTopBar";
import { dashboardColors } from "../../utils/dashboardColors";
import { getTeachers } from "../../services/teacherService";
import { getStudents } from "../../services/studentService";

// Small overlay components — keep static (used across tabs)
import SessionManagement from "../../components/SessionManagement";
import SettingsSidebar from "../../components/SettingsSidebar";
import SettingsModal from "../../components/SettingsModal";

// Tab components — each becomes its own JS chunk, loaded only when first visited
const OverviewTab        = lazy(() => import("./tabs/OverviewTab"));
const TeachersTab        = lazy(() => import("./tabs/TeachersTab"));
const StudentsTab        = lazy(() => import("./tabs/StudentsTab"));
const ClassesTab         = lazy(() => import("./tabs/ClassesTab"));
const ApplicationsTab    = lazy(() => import("./tabs/ApplicationsTab"));
const NotificationsTab   = lazy(() => import("./tabs/NotificationsTab"));
const AssignStudentsTab  = lazy(() => import("./tabs/AssignStudentsTab"));
const BookingsTab        = lazy(() => import("./tabs/BookingsTab"));
const MessagesTab        = lazy(() => import("../../components/chat/MessagesTab"));
const PaymentsTab        = lazy(() => import("./tabs/PaymentTab"));
const DisputeReview      = lazy(() => import("../../components/admin/DisputeReview"));
const AnalyticsDashboard = lazy(() => import("../../components/analytics/AnalyticsDashboard"));
const SubAdminsTab       = lazy(() => import("./tabs/SubAdminsTab"));
const TeacherScheduleTab = lazy(() => import("./tabs/TeacherScheduleTab"));
const ChatCreditsTab     = lazy(() => import("./tabs/ChatCreditsTab"));
const RecordingsTab      = lazy(() => import("./tabs/RecordingsTab"));
const ReportsTab         = lazy(() => import("./tabs/ReportsTab"));
const ReviewsTab         = lazy(() => import("./tabs/ReviewsTab"));
const ReferralsTab       = lazy(() => import("./tabs/ReferralsTab"));
const BrandingTab        = lazy(() => import("./tabs/BrandingTab"));
const DomainTab          = lazy(() => import("./tabs/DomainTab"));
const ClassPricingTab    = lazy(() => import("./tabs/ClassPricingTab"));

// Inline spinner for tab switches (lightweight, no layout shift)
function TabLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
      <div style={{
        width: "32px", height: "32px", borderRadius: "50%",
        border: "3px solid #e5e7eb", borderTopColor: "#6366f1",
        animation: "spin 0.75s linear infinite",
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Nav groups ────────────────────────────────────────────────────────────────
const NAV = [
  {
    group: "Main",
    items: [
      { key: "overview",      label: "Overview",        icon: TrendingUp },
      { key: "analytics",     label: "Analytics",       icon: BarChart3 },
      { key: "notifications", label: "Notifications",   icon: Bell },
      { key: "messages",      label: "Messages",        icon: MessageCircle },
      { key: "sub-admins",    label: "Sub-Admins",      icon: Shield },
    ],
  },
  {
    group: "People",
    items: [
      { key: "teachers",          label: "Teachers",          icon: Video },
      { key: "teacher-schedules", label: "Teacher Schedules",  icon: CalendarDays },
      { key: "students",          label: "Students",          icon: User },
      { key: "applications",      label: "Applications",      icon: Home },
      { key: "assign",            label: "Assign Students",   icon: Users },
    ],
  },
  {
    group: "Classes",
    items: [
      { key: "classes",     label: "All Classes",    icon: BookOpen },
      { key: "bookings",    label: "Bookings",       icon: Calendar },
      { key: "recordings",  label: "Recordings",     icon: Video     },
      { key: "reports",     label: "Progress Reports", icon: FileText },
      { key: "reviews",     label: "Reviews",          icon: Star     },
      { key: "referrals",   label: "Referrals",        icon: Users    },
    ],
  },
  {
    group: "Finance & Trust",
    items: [
      { key: "payments",      label: "Payments",      icon: DollarSign },
      { key: "class-pricing", label: "Class Pricing", icon: DollarSign },
      { key: "chat-credits",  label: "Chat Credits",  icon: MessageCircle },
      { key: "disputes",      label: "Disputes",      icon: AlertTriangle },
    ],
  },
  {
    group: "Settings",
    items: [
      { key: "branding", label: "Branding",       icon: Palette },
      { key: "domain",   label: "Custom Domain",  icon: Globe   },
    ],
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [notifications, setNotifications] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const activeTeachers = teachers.filter(
    (t) => t.active === true && t.status === "active" && !t.scheduledDeletionAt
  );
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSessionManagement, setShowSessionManagement] = useState(false);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [toast, setToast] = useState("");
  const [unreadMessages, setUnreadMessages]           = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { branding, center } = useBranding();
  const centerName = center?.centerName || "Admin Panel";
  const { user: adminInfo, logout: authLogout } = useAuth();

  const handleLogout = () => {
    authLogout();
    navigate("/admin/login");
  };

  useEffect(() => {
    (async () => {
      try {
        const [t, s] = await Promise.all([getTeachers(), getStudents()]);
        setTeachers(t);
        setStudents(s);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);


  // Poll unread notification count every 60 s
  useEffect(() => {
    const fetchUnreadNotifications = async () => {
      try {
        const res  = await api.get("/notifications/unread-count");
        const data = res.data;
        if (data.success) setUnreadNotifications(data.count);
      } catch (_) {}
    };
    fetchUnreadNotifications();
    const timer = setInterval(fetchUnreadNotifications, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleNotify = (note) => {
    const full = typeof note === "string"
      ? { message: note, date: new Date().toISOString() }
      : { ...note, date: note.date || new Date().toISOString() };
    setNotifications((p) => [full, ...p]);
  };

  const activeLabel = NAV.flatMap((g) => g.items).find((i) => i.key === activeTab)?.label || "Overview";

  // Memoized so the tab component only re-renders when its own dependencies change,
  // not on every unrelated state update (e.g. sidebarOpen, toast, unreadMessages).
  const tabContent = useMemo(() => {
    if (loading && activeTab === "assign") return <Loader isDarkMode={isDarkMode} />;
    switch (activeTab) {
      case "overview":          return <OverviewTab isDarkMode={isDarkMode} />;
      case "analytics":         return <AnalyticsDashboard isDarkMode={isDarkMode} />;
      case "teachers":          return <TeachersTab onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case "teacher-schedules": return <TeacherScheduleTab teachers={activeTeachers} isDarkMode={isDarkMode} />;
      case "students":          return <StudentsTab onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case "classes":           return <ClassesTab isDarkMode={isDarkMode} />;
      case "applications":      return <ApplicationsTab isDarkMode={isDarkMode} />;
      case "notifications":     return <NotificationsTab isDarkMode={isDarkMode} onUnreadCount={setUnreadNotifications} />;
      case "assign":            return <AssignStudentsTab teachers={activeTeachers} students={students} onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case "bookings":          return <BookingsTab teachers={activeTeachers} students={students} onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case "messages":          return <MessagesTab userRole="admin" onUnreadCount={setUnreadMessages} />;
      case "payments":          return <PaymentsTab isDarkMode={isDarkMode} />;
      case "class-pricing":     return <ClassPricingTab isDarkMode={isDarkMode} />;
      case "chat-credits":      return <ChatCreditsTab isDarkMode={isDarkMode} />;
      case "disputes":          return <DisputeReview isDarkMode={isDarkMode} />;
      case "recordings":        return <RecordingsTab teachers={teachers} isDarkMode={isDarkMode} />;
      case "reports":           return <ReportsTab students={students} isDarkMode={isDarkMode} />;
      case "reviews":           return <ReviewsTab isDarkMode={isDarkMode} />;
      case "referrals":         return <ReferralsTab isDarkMode={isDarkMode} />;
      case "sub-admins":        return <SubAdminsTab isDarkMode={isDarkMode} teachers={teachers} />;
      case "branding":          return <BrandingTab isDarkMode={isDarkMode} />;
      case "domain":            return <DomainTab isDarkMode={isDarkMode} />;
      default: return <OverviewTab isDarkMode={isDarkMode} />;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isDarkMode, loading, teachers, students]);

  // ── colours ──────────────────────────────────────────────────────────────
  const c = dashboardColors(isDarkMode);

  return (
    <>
    <DashboardLayout
      isDarkMode={isDarkMode}
      colors={c}
      activeTab={activeTab}
      noPaddingTabs={["messages"]}
      sidebar={
        <DashboardSidebar
          nav={NAV}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          sidebarOpen={sidebarOpen}
          colors={c}
          isDarkMode={isDarkMode}
          branding={branding}
          centerName={centerName}
          portalLabel="Admin Panel"
          portalIcon={Shield}
          badges={{ messages: unreadMessages, notifications: unreadNotifications }}
          onDarkModeToggle={toggleDarkMode}
          onSettings={() => setShowSettingsSidebar(true)}
          onLogout={handleLogout}
        />
      }
      topBar={
        <DashboardTopBar
          sidebarOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          roleName="Admin"
          activeLabel={activeLabel}
          colors={c}
          userInitial={(adminInfo?.firstName?.[0] || "A").toUpperCase()}
          onAvatarClick={() => setShowSettingsSidebar(true)}
          actions={
            <button
              onClick={() => setActiveTab("notifications")}
              style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: c.muted, padding: "6px", borderRadius: "8px", display: "flex", alignItems: "center" }}
              className="db-nav-btn"
            >
              <Bell size={19} />
              {unreadNotifications > 0 && (
                <span style={{ position: "absolute", top: "2px", right: "2px", width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
              )}
            </button>
          }
        />
      }
    >
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: "16px", right: "16px", zIndex: 100, background: "#10b981", color: "white", padding: "12px 20px", borderRadius: "12px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(16,185,129,0.4)" }}>
          {toast}
        </div>
      )}
      <Suspense fallback={<TabLoader />}>
        <TabErrorBoundary key={activeTab}>
          {tabContent}
        </TabErrorBoundary>
      </Suspense>
    </DashboardLayout>
    <SettingsSidebar
      isOpen={showSettingsSidebar}
      onClose={() => setShowSettingsSidebar(false)}
      onChangePassword={() => { setShowSettingsSidebar(false); setShowChangePassword(true); }}
      onManageSessions={() => { setShowSettingsSidebar(false); setShowSessionManagement(true); }}
      onManage2FA={() => { setShowSettingsSidebar(false); setShowSettingsModal(true); }}
      userInfo={{
        firstName: adminInfo?.firstName || "Admin",
        lastName: adminInfo?.lastName || "User",
        email: adminInfo?.email || "admin@example.com",
      }}
    />
    <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} userType="admin" />
    {showSessionManagement && (
      <SessionManagement isOpen={showSessionManagement} onClose={() => setShowSessionManagement(false)} userType="admin" />
    )}
    </>
  );
}

function Loader({ isDarkMode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
      <div style={{
        width: "32px", height: "32px", borderRadius: "50%",
        border: `3px solid ${isDarkMode ? "#1e2235" : "#e8ecf4"}`,
        borderTopColor: "var(--brand-secondary)", animation: "db-spin 0.8s linear infinite",
      }} />
    </div>
  );
}

