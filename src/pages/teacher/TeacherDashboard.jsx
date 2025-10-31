// src/pages/teacher/TeacherDashboard.jsx - COMPLETE FIX (All Issues Resolved)
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";

// Layout
import DashboardHeader from "./components/Layout/DashboardHeader";
import TeacherNavTabs from "./components/layout/TeacherNavTabs";

// Change Password Modal
import ChangePassword from "../../components/teacher/auth/ChangePassword";

// Classes
import ClassList from "./components/classes/ClassList";
import ClassModal from "./components/classes/ClassModal";
import ConfirmModal from "./components/classes/ConfirmModal";

// Students
import StudentProgressList from "./components/students/StudentProgressList";

// Bookings
import BookingList from "./components/bookings/BookingList";

// Dashboard widgets
import QuickStats from "./components/dashboard/QuickStats";
import LiveClasses from "./components/dashboard/LiveClasses";
import UpcomingClasses from "./components/dashboard/UpcomingClasses";
import Classroom from "../../pages/Classroom";

// Session Management & Settings
import SessionManagement from "../../components/SessionManagement";
import SettingsSidebar from "../../components/SettingsSidebar";
import SettingsModal from "../../components/SettingsModal";

// Services for fetching real data
import { getAssignedStudents } from "../../services/teacherStudentService";
import { 
  getTeacherBookings, 
  acceptBooking, 
  rejectBooking 
} from "../../services/bookingService";

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [toast, setToast] = useState("");
  const [showSessionManagement, setShowSessionManagement] = useState(false);
  
  // Settings Sidebar States
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Classroom state
  const [activeClass, setActiveClass] = useState(null);
  const [isClassroomOpen, setIsClassroomOpen] = useState(false);

  // Real data from backend - NO MORE PROPS!
  const [students, setStudents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [classes, setClasses] = useState([]); // Now fetched from accepted bookings!
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load teacher info on mount
  useEffect(() => {
    const storedTeacherInfo = localStorage.getItem("teacherInfo");
    if (storedTeacherInfo) {
      try {
        const parsedInfo = JSON.parse(storedTeacherInfo);
        console.log("Loaded teacher info:", parsedInfo);
        setTeacherInfo(parsedInfo);
        
        // Get teacher ID - handle both 'id' and '_id' fields
        const teacherId = parsedInfo._id || parsedInfo.id;
        
        if (teacherId) {
          console.log("Teacher ID found:", teacherId);
          fetchTeacherData(teacherId);
        } else {
          console.error("No teacher ID found in stored info:", parsedInfo);
          setError("Teacher ID not found. Please login again.");
          setLoading(false);
        }
      } catch (err) {
        console.error("Error parsing teacher info:", err);
        setError("Failed to load teacher information");
        setLoading(false);
      }
    } else {
      console.error("No teacher info in localStorage");
      setError("Not logged in. Redirecting...");
      setTimeout(() => navigate("/teacher/login"), 2000);
    }
  }, [navigate]);

  /**
   * Fetch all teacher data from backend
   */
  const fetchTeacherData = async (teacherId) => {
    try {
      setLoading(true);
      setError("");
      
      console.log("Fetching data for teacher ID:", teacherId);

      // Fetch assigned students
      const assignedStudentsData = await getAssignedStudents(teacherId);
      console.log("Assigned students:", assignedStudentsData);
      
      // Transform data for display
      const studentsFormatted = assignedStudentsData.map((item) => ({
        id: item.student._id,
        name: `${item.student.firstName} ${item.student.surname}`,
        level: item.student.noOfClasses > 0 ? "Active" : "Inactive",
        progress: item.student.noOfClasses || 0,
        email: item.student.email,
        active: item.student.active,
        assignmentId: item.assignmentId,
        assignedDate: item.assignedDate
      }));

      setStudents(studentsFormatted);

      // Fetch pending bookings for this teacher
      const pendingBookingsData = await getTeacherBookings(teacherId, "pending");
      console.log("Pending bookings:", pendingBookingsData);
      
      // Transform bookings data
      const bookingsFormatted = pendingBookingsData.map((booking) => ({
        id: booking._id,
        name: `${booking.studentId.firstName} ${booking.studentId.surname}`,
        studentId: booking.studentId._id,
        studentName: `${booking.studentId.firstName} ${booking.studentId.surname}`,
        classTitle: booking.classTitle,
        topic: booking.topic,
        time: new Date(booking.scheduledTime).toLocaleString(),
        duration: booking.duration,
        notes: booking.notes,
        status: booking.status,
        isAdminBooking: booking.createdBy === "admin",
        scheduledTime: booking.scheduledTime
      }));

      setBookings(bookingsFormatted);

      // Fetch accepted bookings and convert to classes
      const acceptedBookingsData = await getTeacherBookings(teacherId, "accepted");
      console.log("Accepted bookings (classes):", acceptedBookingsData);
      
      // Transform accepted bookings into classes
      const classesFromBookings = acceptedBookingsData.map((booking) => {
        const scheduledDate = new Date(booking.scheduledTime);
        const now = new Date();
        
        // Determine status based on scheduled time
        let status = "scheduled";
        if (scheduledDate < now) {
          status = "completed";
        } else if (scheduledDate.toDateString() === now.toDateString()) {
          status = "live";
        }
        
        return {
          id: booking._id,
          title: booking.classTitle,
          topic: booking.topic || "Scheduled Lesson",
          time: scheduledDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }),
          scheduledTime: booking.scheduledTime,
          status: status,
          students: [`${booking.studentId.firstName} ${booking.studentId.surname}`],
          duration: booking.duration,
          notes: booking.notes,
          bookingId: booking._id
        };
      });

      setClasses(classesFromBookings);

    } catch (err) {
      console.error("Error fetching teacher data:", err);
      console.error("Error details:", err.response?.data);
      setError(err.response?.data?.message || "Failed to load teacher data");
      showToast("Failed to load data from server", "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle accepting a booking
   */
  const handleAcceptBooking = async (booking) => {
    try {
      await acceptBooking(booking.id);
      
      // Remove from bookings list
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));

      // Add to classes immediately
      const scheduledDate = new Date(booking.scheduledTime);
      const newClass = {
        id: booking.id,
        title: booking.classTitle,
        topic: booking.topic || "Scheduled Lesson",
        time: scheduledDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        scheduledTime: booking.scheduledTime,
        status: "scheduled",
        students: [booking.studentName],
        duration: booking.duration,
        notes: booking.notes,
        bookingId: booking.id
      };

      setClasses((prev) => [...prev, newClass]);

      showToast(`Accepted booking for ${booking.name}! Class added to your schedule.`);
    } catch (err) {
      console.error("Error accepting booking:", err);
      showToast("Failed to accept booking", "error");
    }
  };

  /**
   * Handle rejecting a booking
   */
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

  /**
   * Show toast notification
   */
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(""), 3000);
  };

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherSessionToken");
    localStorage.removeItem("teacherInfo");
    navigate("/teacher/login");
  };

  // Password change success handler
  const handlePasswordChangeSuccess = (message) => {
    showToast(message);
  };

  // CLASS CANCEL / DELETE
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

  // Handle joining live classroom
  const handleJoinClass = (cls) => {
    setActiveClass(cls);
    setIsClassroomOpen(true);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 font-semibold">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-500 to-pink-500">
      {/* Header with Settings Button */}
      <div className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Teacher Dashboard</h1>
          <div className="flex items-center gap-4">
            {/* Settings Button */}
            <button
              onClick={() => setShowSettingsSidebar(true)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Settings"
            >
              <Settings className="h-6 w-6 text-gray-600" />
            </button>
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow text-white ${
          toast.type === "error" ? "bg-red-500" : "bg-green-500"
        }`}>
          {toast.message || toast}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      {teacherInfo && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-2xl font-bold text-gray-800">
              Welcome, {teacherInfo.firstName} {teacherInfo.lastName}!
            </h2>
            <p className="text-gray-600 text-sm">
              {teacherInfo.email} • {teacherInfo.continent}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              You have <span className="font-semibold text-purple-600">{students.length}</span> assigned students,{" "}
              <span className="font-semibold text-blue-600">{classes.length}</span> scheduled classes, and{" "}
              <span className="font-semibold text-orange-600">{bookings.length}</span> pending bookings
            </p>
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
            <LiveClasses classes={classes.filter(c => c.status === "live")} onJoin={handleJoinClass} />
            <UpcomingClasses
              classes={classes.filter(c => c.status === "scheduled")}
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
            {classes.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-500 text-lg">No classes scheduled yet</p>
                <p className="text-gray-400 text-sm mt-2">
                  Accept booking requests to add classes to your schedule
                </p>
              </div>
            ) : (
              <ClassList data={classes} />
            )}
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
          <div>
            {students.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-500 text-lg">No students assigned yet</p>
                <p className="text-gray-400 text-sm mt-2">
                  Contact your admin to get students assigned to you
                </p>
              </div>
            ) : (
              <StudentProgressList
                students={students}
                onView={(student) => alert(`Viewing ${student.name}`)}
              />
            )}
          </div>
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
        onCancel={() => setConfirmModal({ open: false, type: null, classId: null })}
      />

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePassword
          isOpen={showChangePassword}
          onClose={() => setShowChangePassword(false)}
          onSuccess={handlePasswordChangeSuccess}
          userType="teacher"
        />
      )}

      {/* Session Management */}
      {showSessionManagement && (
        <SessionManagement
          isOpen={showSessionManagement}
          onClose={() => setShowSessionManagement(false)}
          userType="teacher"
        />
      )}

      {/* Settings Sidebar */}
      {showSettingsSidebar && (
        <SettingsSidebar
          isOpen={showSettingsSidebar}
          onClose={() => setShowSettingsSidebar(false)}
          onOpenSettings={() => {
            setShowSettingsSidebar(false);
            setShowSettingsModal(true);
          }}
          onOpenSessions={() => {
            setShowSettingsSidebar(false);
            setShowSessionManagement(true);
          }}
          onChangePassword={() => {
            setShowSettingsSidebar(false);
            setShowChangePassword(true);
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          userType="teacher"
        />
      )}

      {/* Classroom */}
      {isClassroomOpen && activeClass && (
        <Classroom
          classInfo={activeClass}
          onClose={() => {
            setIsClassroomOpen(false);
            setActiveClass(null);
          }}
        />
      )}
    </div>
  );
}
