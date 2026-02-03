import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Settings } from "lucide-react";
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
import { useDarkMode } from '../../hooks/useDarkMode';
import DarkModeToggle from '../../components/DarkModeToggle';
import MessagesTab from '../../components/chat/MessagesTab';
import PaymentsTab from "./tabs/PaymentTab";
import DisputeReview from '../../components/admin/DisputeReview';

import BookingCalendar from "../../components/calendar/BookingCalendar";
import RecurringBookingForm from "../../components/bookings/RecurringBookingForm";
import AnalyticsDashboard from "../../components/analytics/AnalyticsDashboard";

//import ChangePassword from "../../components/admin/auth/ChangePassword"; // ✅ FIXED: Uncommented
import {
  TrendingUp,
  Video,
  User,
  Home,
  Bell,
  Users,
  DollarSign,
  Calendar,      
  BarChart3,     
  Repeat,         
  AlertTriangle
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

  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [calendarBookings, setCalendarBookings] = useState([]);

  // Dark Mode
  const { isDarkMode, toggleDarkMode } = useDarkMode();

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

  
useEffect(() => {
  if (activeTab === "calendar") {
    fetchBookingsForCalendar();
  }
}, [activeTab]);

// Add this function around line 95
const fetchBookingsForCalendar = async () => {
  try {
    const response = await fetch('/api/bookings', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    const data = await response.json();
    setCalendarBookings(data);
    console.log("📅 Bookings loaded for calendar:", data.length);
  } catch (err) {
    console.error("Error fetching bookings for calendar:", err);
  }
};

  const handleNotify = (note) => {
    const fullNote =
      typeof note === "string"
        ? { message: note, date: new Date().toISOString() }
        : { ...note, date: note.date || new Date().toISOString() };

    setNotifications((prev) => [fullNote, ...prev]);
  };

  const renderTab = () => {
    if (loading && (activeTab === "assign")) {
      return (
        <div className={`p-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Loading...
        </div>
      );
    }

    switch (activeTab) {
      case "overview":
        return <OverviewTab isDarkMode={isDarkMode} />;
      case "teachers":
        return <TeachersTab onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case "students":
        return <StudentsTab onNotify={handleNotify} isDarkMode={isDarkMode} />;
      case "classes":
        return <ClassesTab isDarkMode={isDarkMode} />;
      case "analytics":
      return <AnalyticsDashboard isDarkMode={isDarkMode} />;
      case "applications":
        return <ApplicationsTab isDarkMode={isDarkMode} />;
      case "notifications":
        return <NotificationsTab notifications={notifications} isDarkMode={isDarkMode} />;
      case "assign":
        return (
          <AssignStudentsTab
            teachers={teachers}
            students={students}
            onNotify={handleNotify}
            isDarkMode={isDarkMode}
          />
        );
      case "bookings":
        return (
          <BookingsTab
            teachers={teachers} 
            students={students} 
            onNotify={handleNotify}
            isDarkMode={isDarkMode}
          />
        );
        
        case "calendar":
      return (
        <div>
          <BookingCalendar 
            bookings={calendarBookings}
            onBookingClick={(booking) => {
              console.log("Booking clicked:", booking);
              alert(
                `${booking.classTitle}\n` +
                `Time: ${new Date(booking.scheduledTime).toLocaleString()}\n` +
                `Status: ${booking.status}`
              );
            }}
            onDateClick={(date) => {
              console.log("Date clicked:", date);
              setActiveTab("bookings"); // Switch to bookings tab
            }}
            allowCreate={true}
          />
        </div>
      );
      case "messages": 
        return (
          <MessagesTab userRole="admin" />
        );
      case "payments":
      return <PaymentsTab isDarkMode={isDarkMode} />;

      case "disputes":
      return <DisputeReview isDarkMode={isDarkMode} />;

      default:
        return <OverviewTab isDarkMode={isDarkMode} />;
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
    { key: "messages", label: "Messages", icon: MessageCircle },
    { key: "payments", label: "Payments", icon: DollarSign },
    { key: "disputes", label: "Disputes", icon: AlertTriangle },
    { key: "calendar", label: "Calendar View", icon: Calendar },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className={`min-h-screen ${
      isDarkMode 
        ? 'bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
    }`}>
      {/* Header - Only Logout */}
      <Header onLogout={handleLogout} isDarkMode={isDarkMode} />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white bg-green-500">
          {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-3 mb-6">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === key
                  ? isDarkMode
                    ? 'bg-purple-700 text-white shadow-lg'
                    : 'bg-purple-600 text-white shadow-lg'
                  : isDarkMode
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-gray-100 text-gray-700'
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {label}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className={`${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        } shadow-md rounded-lg p-6`}>
          {renderTab()}
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-30">
        {/* Dark Mode Toggle */}
        <DarkModeToggle isDarkMode={isDarkMode} onToggle={toggleDarkMode} />

        {/* Settings Button */}
        <button
          onClick={() => setShowSettingsSidebar(true)}
          className={`${
            isDarkMode 
              ? 'bg-gradient-to-r from-purple-700 to-pink-700' 
              : 'bg-gradient-to-r from-purple-600 to-pink-600'
          } text-white p-4 rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 group`}
          aria-label="Open Settings"
        >
          <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          <span className={`absolute right-full mr-3 top-1/2 -translate-y-1/2 ${
            isDarkMode ? 'bg-gray-700' : 'bg-gray-900'
          } text-white text-sm px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap`}>
            Settings
          </span>
        </button>
      </div>

      {/* Settings Sidebar */}
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
          firstName: "Admin",
          lastName: "User",
          email: localStorage.getItem("adminEmail") || "admin@example.com"
        }}
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
