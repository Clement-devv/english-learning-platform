import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import OverviewTab from "./tabs/OverviewTab";
import TeachersTab from "./tabs/TeachersTab";
import StudentsTab from "./tabs/StudentsTab";
import ClassesTab from "./tabs/ClassesTab";
import ApplicationsTab from "./tabs/ApplicationsTab";
import NotificationsTab from "./tabs/NotificationsTab";
import AssignStudentsTab from "./tabs/AssignStudentsTab";
import BookingsTab from "./tabs/BookingsTab";
import Header from "./ui/Header";
import SessionManagement from "../../components/SessionManagement";
import SettingsSidebar from "../../components/SettingsSidebar";
import SettingsModal from "../../components/SettingsModal";
//import ChangePassword from "../../components/admin/auth/ChangePassword"; // Add this component
import {
  TrendingUp,
  Video,
  User,
  Calendar,
  Home,
  Bell,
  Users,
} from "lucide-react";
import { getTeachers } from "../../services/teacherService";
import { getStudents } from "../../services/studentService";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [notifications, setNotifications] = useState([]);
  
  // Load actual data from database
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [showSessionManagement, setShowSessionManagement] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toast, setToast] = useState("");

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminSessionToken");
    localStorage.removeItem("adminInfo");
    navigate("/admin/login");
  };

  const handlePasswordChanged = () => {
    setShowChangePassword(false);
    setToast("Password changed successfully!");
    setTimeout(() => setToast(""), 3000);
  };

  // Load teachers and students on mount
  useEffect(() => {
    (async () => {
      try {
        const [teachersData, studentsData] = await Promise.all([
          getTeachers(),
          getStudents(),
        ]);
        setTeachers(teachersData);
        setStudents(studentsData);
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleNotify = (note) => {
    const fullNote =
      typeof note === "string"
        ? { message: note, date: new Date().toISOString() }
        : { ...note, date: note.date || new Date().toISOString() };

    setNotifications((prev) => [fullNote, ...prev]);
  };

  const renderTab = () => {
    if (loading && (activeTab === "assign")) {
      return <div className="p-6 text-gray-600">Loading...</div>;
    }

    switch (activeTab) {
      case "overview":
        return <OverviewTab />;
      case "teachers":
        return <TeachersTab onNotify={handleNotify} />;
      case "students":
        return <StudentsTab onNotify={handleNotify} />;
      case "classes":
        return <ClassesTab />;
      case "applications":
        return <ApplicationsTab />;
      case "notifications":
        return <NotificationsTab notifications={notifications} />;
      case "assign":
        return (
          <AssignStudentsTab
            teachers={teachers}
            students={students}
            onNotify={handleNotify}
          />
        );
      case "bookings":
        return <BookingsTab />;
      default:
        return <OverviewTab />;
    }
  };

  const tabs = [
    { key: "overview", label: "Overview", icon: TrendingUp },
    { key: "teachers", label: "Teachers", icon: Video },
    { key: "students", label: "Students", icon: User },
    { key: "classes", label: "Classes", icon: Calendar },
    { key: "applications", label: "Applications", icon: Home },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "assign", label: "Assign Students", icon: Users },
    { key: "bookings", label: "Bookings", icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-r from-violet-500 to-fuchsia-500">
      {/* Header - Only Logout */}
      <Header onLogout={handleLogout} />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white bg-green-500">
          {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-3 mb-6">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === key
                  ? "bg-purple-600 text-white shadow-lg"
                  : "bg-white hover:bg-gray-100 text-gray-700"
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">{renderTab()}</div>
      </div>

      {/* Floating Settings Button */}
      <button
        onClick={() => setShowSettingsSidebar(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 z-30 group"
        aria-label="Open Settings"
      >
        <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Settings
        </span>
      </button>

      {/* Settings Sidebar */}
      <SettingsSidebar
        isOpen={showSettingsSidebar}
        onClose={() => setShowSettingsSidebar(false)}
        onChangePassword={() => setShowChangePassword(true)}
        onManageSessions={() => setShowSessionManagement(true)}
        onManage2FA={() => setShowSettingsModal(true)}
      />

      {/* Settings Modal (for 2FA) */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        userType="admin"
      />

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePassword
          onClose={() => setShowChangePassword(false)}
          onPasswordChanged={handlePasswordChanged}
        />
      )}

      {/* Session Management Modal */}
      {showSessionManagement && (
        <SessionManagement
          isOpen={showSessionManagement}
          onClose={() => setShowSessionManagement(false)}
          userType="admin"
        />
      )}
    </div>
  );
}
