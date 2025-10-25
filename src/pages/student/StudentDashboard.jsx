// src/pages/student/StudentDashboard.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./components/Header";
import WelcomeSection from "./components/WelcomeSection";
import ActiveClasses from "./components/ActiveClasses";
import UpcomingClasses from "./components/UpcomingClasses";
import ProgressCard from "./components/ProgressCard";
import QuickActions from "./components/QuickActions";
import NotificationsCard from "./components/NotificationsCard";
import ChangePassword from "../../components/student/auth/ChangePassword";

export default function StudentDashboard() {
  const navigate = useNavigate();
  
  // Change Password Modal State
  const [showChangePassword, setShowChangePassword] = useState(false);
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

  // Update progress when student data changes
  useEffect(() => {
    const studentInfo = localStorage.getItem('studentInfo');
    if (studentInfo) {
      const parsed = JSON.parse(studentInfo);
      setProgress(prev => ({
        ...prev,
        totalLessons: parsed.noOfClasses || 0
      }));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("studentToken");
    localStorage.removeItem("studentInfo");
    navigate("/student/login");
  };

  const handlePasswordChangeSuccess = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const joinVideoCall = (classId, className) => {
    alert(`Joining "${className}" video call...`);
  };

  const enrollInClass = (classId) => {
    setUpcomingClasses((prev) =>
      prev.map((cls) => (cls.id === classId ? { ...cls, enrolled: true } : cls))
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded shadow text-white bg-green-500">
          {toast}
        </div>
      )}

      <Header 
        student={student} 
        notifications={notifications} 
        onLogout={handleLogout}
        onChangePassword={() => setShowChangePassword(true)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            <WelcomeSection student={student} progress={progress} />
            <ActiveClasses activeClasses={activeClasses} onJoin={joinVideoCall} />
            <UpcomingClasses upcomingClasses={upcomingClasses} onEnroll={enrollInClass} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <ProgressCard progress={progress} />
            <QuickActions />
            <NotificationsCard notifications={notifications} />
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePassword
          onClose={() => setShowChangePassword(false)}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}
    </div>
  );
}