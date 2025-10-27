import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Key } from "lucide-react";

// layout
import DashboardHeader from "./components/Layout/DashboardHeader";
import TeacherNavTabs from "./components/layout/TeacherNavTabs";

// Change Password Modal
import ChangePassword from "../../components/teacher/auth/ChangePassword";

// classes
import ClassList from "./components/classes/ClassList";
import ClassModal from "./components/classes/ClassModal";
import ConfirmModal from "./components/classes/ConfirmModal";

// students
import StudentProgressList from "./components/students/StudentProgressList";

// bookings
import BookingList from "./components/bookings/BookingList";

// dashboard widgets
import QuickStats from "./components/dashboard/QuickStats";
import LiveClasses from "./components/dashboard/LiveClasses";
import UpcomingClasses from "./components/dashboard/UpcomingClasses";
import Classroom from "../../pages/Classroom"; // ✅ video call component

import SessionManagement from "../../components/SessionManagement";

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [toast, setToast] = useState("");
  const [showSessionManagement, setShowSessionManagement] = useState(false);

  // 🆕 Classroom state
  const [activeClass, setActiveClass] = useState(null);
  const [isClassroomOpen, setIsClassroomOpen] = useState(false);

  // Load teacher info on mount
  useEffect(() => {
    const storedTeacherInfo = localStorage.getItem("teacherInfo");
    if (storedTeacherInfo) {
      setTeacherInfo(JSON.parse(storedTeacherInfo));
    }
  }, []);

  const [classes, setClasses] = useState([
    { id: 1, title: "English Basics", topic: "Grammar", time: "2 PM", status: "live", students: ["John Doe"] },
    { id: 2, title: "Conversation Practice", topic: "Speaking", time: "4 PM", status: "scheduled", students: ["Jane Smith"] },
  ]);

  const [students, setStudents] = useState([
    { id: 1, name: "John Doe", level: "Beginner", progress: 45 },
    { id: 2, name: "Jane Smith", level: "Intermediate", progress: 70 },
  ]);

  const [bookings, setBookings] = useState([
    { id: 1, name: "Alice", classTitle: "Grammar 101", time: "3 PM" },
    {
      id: 2,
      name: "David Lee",
      classTitle: "Trial Lesson",
      time: "11:30 AM",
      isAdminBooking: true,
      studentId: 88,
      studentName: "David Lee",
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherSessionToken");
    localStorage.removeItem("teacherInfo");
    navigate("/teacher/login");
  };

  // Password change success handler
  const handlePasswordChangeSuccess = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  // ------------------ BOOKINGS ------------------
  const handleAcceptBooking = (booking) => {
    setBookings((prev) => prev.filter((b) => b.id !== booking.id));

    if (booking.isAdminBooking) {
      setStudents((prev) => {
        if (!prev.find((s) => s.id === booking.studentId)) {
          return [
            ...prev,
            { id: booking.studentId, name: booking.studentName, level: "Trial", progress: 0 },
          ];
        }
        return prev;
      });

      setClasses((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: booking.classTitle,
          topic: "Trial / Cover",
          time: booking.time,
          status: "scheduled",
          students: [booking.studentName],
        },
      ]);
    }

    alert(`Accepted booking for ${booking.name}`);
  };

  const handleRejectBooking = (booking) => {
    setBookings((prev) => prev.filter((b) => b.id !== booking.id));
    alert(`Rejected booking for ${booking.name}`);
  };

  // ------------------ CLASS CANCEL / DELETE ------------------
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: null,
    classId: null,
  });

  const askCancelClass = (id) =>
    setConfirmModal({ open: true, type: "cancel", classId: id });

  const askDeleteClass = (id) =>
    setConfirmModal({ open: true, type: "delete", classId: id });

  const handleConfirm = () => {
    if (confirmModal.type === "cancel") {
      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === confirmModal.classId ? { ...cls, status: "cancelled" } : cls
        )
      );
    } else if (confirmModal.type === "delete") {
      setClasses((prev) => prev.filter((cls) => cls.id !== confirmModal.classId));
    }
    setConfirmModal({ open: false, type: null, classId: null });
  };

  const handleAddClass = (newClass) => {
    setClasses((prev) => [...prev, { ...newClass, id: Date.now() }]);
  };

  // 🆕 Handle joining live classroom
  const handleJoinClass = (cls) => {
    setActiveClass(cls);
    setIsClassroomOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-500 to-pink-500">
      <DashboardHeader onManageSessions={() => setShowSessionManagement(true)}
 />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded shadow text-white bg-green-500">
          {toast}
        </div>
      )}

      {/* Welcome Banner */}
      {teacherInfo && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-white rounded-lg shadow-md p-4 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                Welcome, {teacherInfo.firstName} {teacherInfo.lastName}!
              </h2>
              <p className="text-gray-600 text-sm">
                {teacherInfo.email} • {teacherInfo.continent}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowChangePassword(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
              >
                <Key className="w-4 h-4" />
                Change Password
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TeacherNavTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={["dashboard", "classes", "students", "bookings"]}
        />

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <QuickStats
              stats={{
                totalStudents: students.length,
                totalClasses: classes.length,
                totalBookings: bookings.length,
              }}
            />
            <LiveClasses classes={classes} onJoin={handleJoinClass} /> {/* ✅ add this */}
            <UpcomingClasses
              classes={classes}
              students={students}
              onCancel={askCancelClass}
              onDelete={askDeleteClass}
            />
          </div>
        )}

        {/* Classes Tab */}
        {activeTab === "classes" && (
          <div className="space-y-6">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Add Class
            </button>
            <ClassList data={classes} />
          </div>
        )}

        <ClassModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleAddClass}
          students={students}
        />

        {/* Students Tab */}
        {activeTab === "students" && (
          <StudentProgressList
            students={students}
            onView={(student) => alert(`Viewing ${student.name}`)}
          />
        )}

        {/* Bookings Tab */}
        {activeTab === "bookings" && (
          <BookingList
            bookings={bookings}
            onAccept={handleAcceptBooking}
            onReject={handleRejectBooking}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.open}
        title={confirmModal.type === "cancel" ? "Cancel Class" : "Delete Class"}
        message={
          confirmModal.type === "cancel"
            ? "Are you sure you want to cancel this class?"
            : "Are you sure you want to delete this class?"
        }
        onConfirm={handleConfirm}
        onCancel={() =>
          setConfirmModal({ open: false, type: null, classId: null })
        }
      />

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePassword
          onClose={() => setShowChangePassword(false)}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}

      {/* Session Management Modal */}
      {showSessionManagement && (
        <SessionManagement
          isOpen={showSessionManagement}
          onClose={() => setShowSessionManagement(false)}
          userType="teacher"
        />
      )}

      {/* 🆕 Classroom Modal */}
      {isClassroomOpen && activeClass && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center">
          <div className="w-full max-w-5xl bg-white rounded-xl shadow-lg overflow-hidden">
            <Classroom
              channelName={activeClass.title.replace(/\s+/g, "_")}
              userName={teacherInfo?.firstName || "Teacher"}
            />
            <button
              onClick={() => setIsClassroomOpen(false)}
              className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded"
            >
              Leave Class
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
