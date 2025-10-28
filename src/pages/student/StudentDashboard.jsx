// src/pages/student/StudentDashboard.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react"; // Import Settings icon
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

export default function StudentDashboard() {
  const navigate = useNavigate();
  
  // Modal States
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSessionManagement, setShowSessionManagement] = useState(false);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toast, setToast] = useState("");
  
  // Get student info from localStorage
  const [student, setStudent] = useState(() => {
    const studentInfo = localStorage.getItem('studentInfo');
    if (studentInfo) {
      const parsed = JSON.parse(studentInfo);
      return {
        name: `${parsed.firstName} ${parsed.surname}`,
        firstName: parsed.firstName,
        surname: parsed.surname,
        email: parsed.email,
        noOfClasses: parsed.noOfClasses || 0,
        level: "Intermediate"
      };
    }
    return { name: "Student", level: "Intermediate" };
  });

  const [activeClasses, setActiveClasses] = useState([
    {
      id: 1,
      title: "English Conversation - Beginner",
      teacher: "Ms. Sarah Johnson",
      time: "2:00 PM - 3:00 PM",
      participants: 8,
      maxParticipants: 12,
      status: "live",
      topic: "Daily Routines & Habits",
    },
    {
      id: 2,
      title: "Business English",
      teacher: "Mr. David Wilson",
      time: "4:00 PM - 5:00 PM",
      participants: 6,
      maxParticipants: 10,
      status: "starting-soon",
      topic: "Professional Presentations",
    },
  ]);

  const [upcomingClasses, setUpcomingClasses] = useState([
    {
      id: 3,
      title: "Grammar Workshop",
      teacher: "Ms. Emily Chen",
      time: "Tomorrow 10:00 AM",
      topic: "Past Perfect Tense",
      enrolled: true,
    },
    {
      id: 4,
      title: "Pronunciation Practice",
      teacher: "Mr. James Miller",
      time: "Friday 3:00 PM",
      topic: "American vs British Accent",
      enrolled: false,
    },
  ]);

  const [progress, setProgress] = useState({
    completedLessons: 24,
    totalLessons: 40,
    streakDays: 7,
    weeklyGoal: 5,
    weeklyCompleted: 3,
  });

  const [notifications, setNotifications] = useState([
    { id: 1, message: "New grammar exercise available", time: "5 min ago", unread: true },
    { id: 2, message: "Class reminder: Business English starts in 30 min", time: "25 min ago", unread: true },
    { id: 3, message: "Great job completing yesterday's lesson!", time: "1 day ago", unread: false },
  ]);

  const handleLogout = () => {
    localStorage.removeItem("studentToken");
    localStorage.removeItem("studentSessionToken");
    localStorage.removeItem("studentInfo");
    navigate("/student/login");
  };

  const handlePasswordChanged = () => {
    setShowChangePassword(false);
    setToast("Password changed successfully!");
    setTimeout(() => setToast(""), 3000);
  };

  const handleJoinClass = (classId) => {
    console.log("Joining class:", classId);
    // Add your join class logic here
  };

  const handleEnrollClass = (classId) => {
    console.log("Enrolling in class:", classId);
    // Add your enroll logic here
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        student={student}
        notifications={notifications}
        onLogout={handleLogout}
        onChangePassword={() => setShowChangePassword(true)}
        onManageSessions={() => setShowSessionManagement(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <WelcomeSection student={student} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 space-y-6">
            <ActiveClasses activeClasses={activeClasses} onJoin={handleJoinClass} />
            <UpcomingClasses upcomingClasses={upcomingClasses} onEnroll={handleEnrollClass} />
          </div>

          <div className="space-y-6">
            <ProgressCard progress={progress} />
            <QuickActions />
            <NotificationsCard notifications={notifications} />
          </div>
        </div>
      </main>

      {/* Floating Settings Button */}
      <button
        onClick={() => setShowSettingsSidebar(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 z-30 group"
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
        userType="student"
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
          userType="student"
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 right-6 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
          {toast}
        </div>
      )}
    </div>
  );
}
