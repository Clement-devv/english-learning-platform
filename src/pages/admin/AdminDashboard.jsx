// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, Video, User, Home, Bell, Users, DollarSign,
  Calendar, BarChart3, AlertTriangle, MessageCircle, Settings,
  LogOut, ChevronRight, Menu, X, BookOpen, CheckSquare,
  Shield
} from "lucide-react";

import OverviewTab from "./tabs/OverviewTab";
import TeachersTab from "./tabs/TeachersTab";
import StudentsTab from "./tabs/StudentsTab";
import ClassesTab from "./tabs/ClassesTab";
import ApplicationsTab from "./tabs/ApplicationsTab";
import NotificationsTab from "./tabs/NotificationsTab";
import AssignStudentsTab from "./tabs/AssignStudentsTab";
import BookingsTab from "./tabs/BookingsTab";
import SessionManagement from "../../components/SessionManagement";
import SettingsSidebar from "../../components/SettingsSidebar";
import SettingsModal from "../../components/SettingsModal";
import { useDarkMode } from "../../hooks/useDarkMode";
import MessagesTab from "../../components/chat/MessagesTab";
import PaymentsTab from "./tabs/PaymentTab";
import DisputeReview from "../../components/admin/DisputeReview";
import BookingCalendar from "../../components/calendar/BookingCalendar";
import AnalyticsDashboard from "../../components/analytics/AnalyticsDashboard";
import { getTeachers } from "../../services/teacherService";
import { getStudents } from "../../services/studentService";
import SubAdminsTab from "./tabs/SubAdminsTab";

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
      { key: "teachers",     label: "Teachers",         icon: Video },
      { key: "students",     label: "Students",         icon: User },
      { key: "applications", label: "Applications",     icon: Home },
      { key: "assign",       label: "Assign Students",  icon: Users },
    ],
  },
  {
    group: "Classes",
    items: [
      { key: "classes",   label: "All Classes",    icon: BookOpen },
      { key: "bookings",  label: "Bookings",       icon: Calendar },
      { key: "calendar",  label: "Calendar View",  icon: Calendar },
    ],
  },
  {
    group: "Finance & Trust",
    items: [
      { key: "payments",  label: "Payments",  icon: DollarSign },
      { key: "disputes",  label: "Disputes",  icon: AlertTriangle },
    ],
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [notifications, setNotifications] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSessionManagement, setShowSessionManagement] = useState(false);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [calendarBookings, setCalendarBookings] = useState([]);
  const [toast, setToast] = useState("");
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminSessionToken");
    localStorage.removeItem("adminInfo");
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

  useEffect(() => {
    if (activeTab === "calendar") fetchCalendar();
  }, [activeTab]);

  const fetchCalendar = async () => {
    try {
      const res = await fetch("/api/bookings", {
        headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
      });
      const data = await res.json();
      setCalendarBookings(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotify = (note) => {
    const full = typeof note === "string"
      ? { message: note, date: new Date().toISOString() }
      : { ...note, date: note.date || new Date().toISOString() };
    setNotifications((p) => [full, ...p]);
  };

  const activeLabel = NAV.flatMap((g) => g.items).find((i) => i.key === activeTab)?.label || "Overview";

  const renderTab = () => {
    if (loading && activeTab === "assign") return <Loader isDarkMode={isDarkMode} />;
    switch (activeTab) {
      case "overview":      return <OverviewTab isDarkMode={isDarkMode} />;
      case "analytics":     return <AnalyticsDashboard isDarkMode={isDarkMode} />;
      case "teachers":      return <TeachersTab onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case "students":      return <StudentsTab onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case "classes":       return <ClassesTab isDarkMode={isDarkMode} />;
      case "applications":  return <ApplicationsTab isDarkMode={isDarkMode} />;
      case "notifications": return <NotificationsTab notifications={notifications} isDarkMode={isDarkMode} />;
      case "assign":        return <AssignStudentsTab teachers={teachers} students={students} onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case "bookings":      return <BookingsTab teachers={teachers} students={students} onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case "messages":      return <MessagesTab userRole="admin" />;
      case "payments":      return <PaymentsTab isDarkMode={isDarkMode} />;
      case "disputes":      return <DisputeReview isDarkMode={isDarkMode} />;
      case "sub-admins":    return <SubAdminsTab isDarkMode={isDarkMode} teachers={teachers} />;
      case "calendar":
        return (
          <BookingCalendar
            bookings={calendarBookings}
            onBookingClick={(b) => alert(`${b.classTitle}\n${new Date(b.scheduledTime).toLocaleString()}\nStatus: ${b.status}`)}
            onDateClick={() => setActiveTab("bookings")}
            allowCreate={true}
          />
        );
      default: return <OverviewTab isDarkMode={isDarkMode} />;
    }
  };

  // ── colours ──────────────────────────────────────────────────────────────
  const bg        = isDarkMode ? "#0f1117" : "#f4f6fb";
  const sidebar   = isDarkMode ? "#13161f" : "#ffffff";
  const border    = isDarkMode ? "#1e2235" : "#e8ecf4";
  const heading   = isDarkMode ? "#e2e8f0" : "#1e293b";
  const muted     = isDarkMode ? "#374151" : "#94a3b8";
  const cardBg    = isDarkMode ? "#1a1d27" : "#ffffff";
  const hoverBg   = isDarkMode ? "#1e2235" : "#f0f4ff";
  const activeBg  = isDarkMode ? "#252d4a" : "#eef1ff";
  const activeClr = isDarkMode ? "#a5b4fc" : "#4f63d2";

  return (
    <>
      <style>{css(isDarkMode)}</style>
      <div style={{ display: "flex", height: "100vh", background: bg, fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <aside
          className="adm-sidebar"
          style={{
            width: sidebarOpen ? "240px" : "64px",
            background: sidebar,
            borderRight: `1px solid ${border}`,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
            overflow: "hidden",
            zIndex: 40,
          }}
        >
          {/* Logo */}
          <div style={{
            height: "64px", display: "flex", alignItems: "center",
            padding: sidebarOpen ? "0 20px" : "0 16px",
            borderBottom: `1px solid ${border}`, flexShrink: 0, gap: "10px",
          }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0,
              background: "linear-gradient(135deg, #4f63d2, #6b82f0)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Shield size={16} color="white" />
            </div>
            {sidebarOpen && (
              <div style={{ overflow: "hidden" }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: heading, whiteSpace: "nowrap" }}>EduLearn</p>
                <p style={{ margin: 0, fontSize: "10px", color: muted, whiteSpace: "nowrap", fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase" }}>Admin Panel</p>
              </div>
            )}
          </div>

          {/* Nav */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 8px" }} className="adm-scroll">
            {NAV.map((group) => (
              <div key={group.group} style={{ marginBottom: "8px" }}>
                {sidebarOpen && (
                  <p style={{
                    margin: "0 0 4px 8px", fontSize: "10px", fontWeight: "700",
                    color: muted, textTransform: "uppercase", letterSpacing: "0.1em",
                    whiteSpace: "nowrap",
                  }}>
                    {group.group}
                  </p>
                )}
                {group.items.map(({ key, label, icon: Icon }) => {
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      title={!sidebarOpen ? label : undefined}
                      style={{
                        width: "100%", display: "flex", alignItems: "center",
                        gap: "10px", padding: sidebarOpen ? "9px 10px" : "9px 16px",
                        borderRadius: "10px", border: "none", cursor: "pointer",
                        background: isActive ? activeBg : "transparent",
                        color: isActive ? activeClr : isDarkMode ? "#6b7280" : "#64748b",
                        fontFamily: "inherit", fontSize: "13.5px", fontWeight: isActive ? "700" : "500",
                        textAlign: "left", transition: "all 0.15s", marginBottom: "2px",
                        whiteSpace: "nowrap", overflow: "hidden",
                        position: "relative",
                      }}
                      className="adm-nav-btn"
                    >
                      {isActive && (
                        <div style={{
                          position: "absolute", left: 0, top: "20%", bottom: "20%",
                          width: "3px", borderRadius: "0 3px 3px 0",
                          background: "#6b82f0",
                        }} />
                      )}
                      <Icon size={16} style={{ flexShrink: 0 }} />
                      {sidebarOpen && <span>{label}</span>}
                    </button>
                  );
                })}
                {sidebarOpen && <div style={{ height: "1px", background: border, margin: "8px 4px" }} />}
              </div>
            ))}
          </div>

          {/* User info + actions */}
          <div style={{ borderTop: `1px solid ${border}`, padding: "12px 8px", flexShrink: 0 }}>
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "10px",
                padding: sidebarOpen ? "9px 10px" : "9px 16px",
                borderRadius: "10px", border: "none", cursor: "pointer",
                background: "transparent", color: isDarkMode ? "#6b7280" : "#64748b",
                fontFamily: "inherit", fontSize: "13.5px", fontWeight: "500",
                textAlign: "left", marginBottom: "4px", whiteSpace: "nowrap",
              }}
              className="adm-nav-btn"
            >
              <span style={{ fontSize: "16px", flexShrink: 0 }}>{isDarkMode ? "☀️" : "🌙"}</span>
              {sidebarOpen && <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>}
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettingsSidebar(true)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "10px",
                padding: sidebarOpen ? "9px 10px" : "9px 16px",
                borderRadius: "10px", border: "none", cursor: "pointer",
                background: "transparent", color: isDarkMode ? "#6b7280" : "#64748b",
                fontFamily: "inherit", fontSize: "13.5px", fontWeight: "500",
                textAlign: "left", marginBottom: "4px", whiteSpace: "nowrap",
              }}
              className="adm-nav-btn"
            >
              <Settings size={16} style={{ flexShrink: 0 }} />
              {sidebarOpen && <span>Settings</span>}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "10px",
                padding: sidebarOpen ? "9px 10px" : "9px 16px",
                borderRadius: "10px", border: "none", cursor: "pointer",
                background: "transparent", color: "#ef4444",
                fontFamily: "inherit", fontSize: "13.5px", fontWeight: "500",
                textAlign: "left", whiteSpace: "nowrap",
              }}
              className="adm-logout-btn"
            >
              <LogOut size={16} style={{ flexShrink: 0 }} />
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

          {/* Top bar */}
          <header style={{
            height: "64px", background: cardBg,
            borderBottom: `1px solid ${border}`,
            display: "flex", alignItems: "center",
            padding: "0 24px", gap: "16px", flexShrink: 0,
          }}>
            {/* Collapse toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: muted, padding: "6px", borderRadius: "8px",
                display: "flex", alignItems: "center",
              }}
              className="adm-nav-btn"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "13px", color: muted, fontWeight: "500" }}>Admin</span>
              <ChevronRight size={14} color={muted} />
              <span style={{ fontSize: "13px", color: heading, fontWeight: "700" }}>{activeLabel}</span>
            </div>

            <div style={{ flex: 1 }} />

            {/* Notification bell */}
            <button
              onClick={() => setActiveTab("notifications")}
              style={{
                position: "relative", background: "none", border: "none",
                cursor: "pointer", color: muted, padding: "6px",
                borderRadius: "8px", display: "flex", alignItems: "center",
              }}
              className="adm-nav-btn"
            >
              <Bell size={19} />
              {notifications.length > 0 && (
                <span style={{
                  position: "absolute", top: "2px", right: "2px",
                  width: "8px", height: "8px", borderRadius: "50%",
                  background: "#ef4444",
                }} />
              )}
            </button>

            {/* Avatar */}
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #4f63d2, #6b82f0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontWeight: "700", color: "white", cursor: "pointer",
            }}
              onClick={() => setShowSettingsSidebar(true)}
            >
              {(adminInfo?.firstName?.[0] || "A").toUpperCase()}
            </div>
          </header>

          {/* Content */}
          <main style={{
            flex: 1, overflowY: "auto", padding: "24px",
            background: bg,
          }} className="adm-scroll">

            {/* Toast */}
            {toast && (
              <div style={{
                position: "fixed", top: "16px", right: "16px", zIndex: 100,
                background: "#10b981", color: "white", padding: "12px 20px",
                borderRadius: "12px", fontSize: "14px", fontWeight: "600",
                boxShadow: "0 4px 20px rgba(16,185,129,0.4)",
              }}>
                {toast}
              </div>
            )}

            {/* Tab content */}
            <div style={{
              background: cardBg, borderRadius: "16px",
              border: `1px solid ${border}`,
              minHeight: "calc(100vh - 140px)",
              padding: activeTab === "messages" ? "0" : "24px",
              overflow: activeTab === "messages" ? "hidden" : "visible",
            }}>
              {renderTab()}
            </div>
          </main>
        </div>

        {/* ── MODALS ── */}
        <SettingsSidebar
          isOpen={showSettingsSidebar}
          onClose={() => setShowSettingsSidebar(false)}
          onChangePassword={() => { setShowSettingsSidebar(false); setShowChangePassword(true); }}
          onManageSessions={() => { setShowSettingsSidebar(false); setShowSessionManagement(true); }}
          onManage2FA={() => { setShowSettingsSidebar(false); setShowSettingsModal(true); }}
          userInfo={{
            firstName: adminInfo?.firstName || "Admin",
            lastName: adminInfo?.lastName || "User",
            email: adminInfo?.email || localStorage.getItem("adminEmail") || "admin@example.com",
          }}
        />
        <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} userType="admin" />
        {showSessionManagement && (
          <SessionManagement isOpen={showSessionManagement} onClose={() => setShowSessionManagement(false)} userType="admin" />
        )}
      </div>
    </>
  );
}

function Loader({ isDarkMode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
      <div style={{
        width: "32px", height: "32px", borderRadius: "50%",
        border: `3px solid ${isDarkMode ? "#1e2235" : "#e8ecf4"}`,
        borderTopColor: "#6b82f0", animation: "adm-spin 0.8s linear infinite",
      }} />
    </div>
  );
}

const css = (dark) => `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }

  .adm-scroll::-webkit-scrollbar { width: 4px; }
  .adm-scroll::-webkit-scrollbar-track { background: transparent; }
  .adm-scroll::-webkit-scrollbar-thumb { background: ${dark ? "#1e2235" : "#e0e4f4"}; border-radius: 4px; }

  .adm-nav-btn:hover {
    background: ${dark ? "#1e2235 !important" : "#f0f4ff !important"};
    color: ${dark ? "#a5b4fc !important" : "#4f63d2 !important"};
  }
  .adm-logout-btn:hover {
    background: rgba(239,68,68,0.08) !important;
  }

  @keyframes adm-spin { to { transform: rotate(360deg); } }

  @media (max-width: 768px) {
    .adm-sidebar { position: fixed !important; height: 100vh; }
  }
`;
