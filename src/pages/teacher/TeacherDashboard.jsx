// src/pages/teacher/TeacherDashboard.jsx - UPDATED WITH ALL FIXES
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Plus } from "lucide-react";

// Layout
import DashboardHeader from "./components/Layout/DashboardHeader";
import TeacherNavTabs from "./components/layout/TeacherNavTabs";

// Change Password Modal
import ChangePassword from "../../components/teacher/auth/ChangePassword";

// Classes
import ClassList from "./components/classes/ClassList";
import ClassModal from "./components/classes/ClassModal";
import ConfirmModal from "./components/classes/ConfirmModal";
import CompletedClassesTab from "./components/classes/CompletedClasses";

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
  rejectBooking,
  createBooking,
  deleteBooking,
  cancelBooking
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

  // Real data from backend
  const [students, setStudents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [completedClasses, setCompletedClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const teacherData = JSON.parse(localStorage.getItem("teacherInfo") || "{}");
    if (!teacherData._id && !teacherData.id) {
      navigate("/teacher/login");
      return;
    }
    setTeacherInfo(teacherData);
    fetchTeacherData();
  }, [navigate]);

  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      const teacherData = JSON.parse(localStorage.getItem("teacherInfo") || "{}");
      const teacherId = teacherData._id || teacherData.id;

      if (!teacherId) {
        throw new Error("No teacher ID found");
      }

      const [studentsData, pendingBookingsData, acceptedBookingsData, completedBookingsData] = await Promise.all([
        getAssignedStudents(teacherId),
        getTeacherBookings(teacherId, "pending"),
        getTeacherBookings(teacherId, "accepted"),
        getTeacherBookings(teacherId, "completed")
      ]);

      const studentsFormatted = studentsData.map((item) => ({
        id: item.student._id,
        name: `${item.student.firstName} ${item.student.surname}`,
        email: item.student.email,
        status: item.student.active ? "Active" : "Inactive",
        progress: item.student.noOfClasses || 0,
        active: item.student.active,
        assignmentId: item.assignmentId,
        assignedDate: item.assignedDate
      }));
      setStudents(studentsFormatted);

      const bookingsFormatted = pendingBookingsData.map((booking) => {
        const scheduledDate = new Date(booking.scheduledTime);
        
        return {
          id: booking._id,
          name: `${booking.studentId.firstName} ${booking.studentId.surname}`,
          studentId: booking.studentId._id,
          studentName: `${booking.studentId.firstName} ${booking.studentId.surname}`,
          classTitle: booking.classTitle,
          topic: booking.topic,
          time: scheduledDate.toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          duration: booking.duration,
          notes: booking.notes,
          status: booking.status,
          isAdminBooking: booking.createdBy === "admin",
          scheduledTime: booking.scheduledTime,
          rawDate: scheduledDate
        };
      });
      setBookings(bookingsFormatted);

      // ✅ FIXED: Group bookings by scheduledTime and classTitle to combine multiple students
      const classesMap = new Map();
      
      acceptedBookingsData.forEach((booking) => {
        const scheduledDate = new Date(booking.scheduledTime);
        const now = new Date();
        const timeDiff = scheduledDate - now;
        
        let status = "scheduled";
        if (timeDiff < -3600000) {
          status = "completed";
        } else if (timeDiff < 0 && timeDiff > -3600000) {
          status = "live";
        } else if (timeDiff > 0 && timeDiff < 900000) {
          status = "upcoming-soon";
        }
        
        // Create a unique key for grouping: time + title
        const groupKey = `${booking.scheduledTime}_${booking.classTitle}`;
        
        if (classesMap.has(groupKey)) {
          // Add student to existing class
          const existingClass = classesMap.get(groupKey);
          existingClass.students.push(`${booking.studentId.firstName} ${booking.studentId.surname}`);
          existingClass.bookingIds.push(booking._id);
        } else {
          // Create new class entry
          const classObj = {
            id: booking._id,
            title: booking.classTitle,
            topic: booking.topic || "Scheduled Lesson",
            time: scheduledDate.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            }),
            date: scheduledDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }),
            fullDateTime: scheduledDate.toLocaleString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }),
            scheduledTime: booking.scheduledTime,
            scheduledDate: scheduledDate,
            status: status,
            students: [`${booking.studentId.firstName} ${booking.studentId.surname}`],
            duration: booking.duration,
            notes: booking.notes,
            bookingId: booking._id,
            bookingIds: [booking._id] // Track all booking IDs for this class
          };
          
          classesMap.set(groupKey, classObj);
        }
      });

      // Convert map to arrays
      const activeClasses = [];
      const finishedClasses = [];
      
      classesMap.forEach((classObj) => {
        if (classObj.status === "completed") {
          finishedClasses.push(classObj);
        } else {
          activeClasses.push(classObj);
        }
      });

      setClasses(activeClasses);

      // ✅ FIXED: Group completed bookings too
      const completedMap = new Map();
      
      completedBookingsData.forEach((booking) => {
        const scheduledDate = new Date(booking.scheduledTime);
        const groupKey = `${booking.scheduledTime}_${booking.classTitle}`;
        
        if (completedMap.has(groupKey)) {
          const existingClass = completedMap.get(groupKey);
          existingClass.students.push(`${booking.studentId.firstName} ${booking.studentId.surname}`);
        } else {
          completedMap.set(groupKey, {
            id: booking._id,
            title: booking.classTitle,
            topic: booking.topic || "Completed Lesson",
            fullDateTime: scheduledDate.toLocaleString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }),
            scheduledTime: booking.scheduledTime,
            scheduledDate: scheduledDate,
            students: [`${booking.studentId.firstName} ${booking.studentId.surname}`],
            duration: booking.duration,
            status: "completed"
          });
        }
      });
      
      const completedFromBookings = Array.from(completedMap.values());
      setCompletedClasses([...finishedClasses, ...completedFromBookings]);
      
    } catch (err) {
      console.error("Failed to load teacher data:", err);
      console.error("Error details:", err.response?.data?.message || "Failed to load teacher data");
      showToast("Failed to load data from server", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBooking = async (booking) => {
    try {
      await acceptBooking(booking.id);
      
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));

      const scheduledDate = new Date(booking.scheduledTime);
      const now = new Date();
      const timeDiff = scheduledDate - now;
      
      let status = "scheduled";
      if (timeDiff < -3600000) {
        status = "completed";
      } else if (timeDiff < 900000 && timeDiff > 0) {
        status = "upcoming-soon";
      }

      const newClass = {
        id: booking.id,
        title: booking.classTitle,
        topic: booking.topic || "Scheduled Lesson",
        time: scheduledDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        date: scheduledDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        fullDateTime: scheduledDate.toLocaleString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        scheduledTime: booking.scheduledTime,
        scheduledDate: scheduledDate,
        status: status,
        students: [booking.studentName],
        duration: booking.duration,
        notes: booking.notes,
        bookingId: booking.id
      };

      setClasses((prev) => [...prev, newClass]);
      showToast(`Accepted booking for ${booking.name}! Class added to your schedule.`);
      
      setTimeout(() => {
        fetchTeacherData();
      }, 1000);
      
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

  // ✅ FIXED: Improved class creation for multiple students under ONE schedule
  const handleAddClass = async (newClass) => {
    try {
      if (!newClass.students || newClass.students.length === 0) {
        showToast("Please select at least one student for the class", "error");
        return;
      }

      const teacherId = teacherInfo._id || teacherInfo.id;
      
      const localDateTimeString = newClass.time;
      const scheduledDate = new Date(localDateTimeString);
      const isoString = scheduledDate.toISOString();
      
      console.log("Creating class with date:", {
        original: localDateTimeString,
        parsed: scheduledDate,
        iso: isoString
      });
      
      // Create bookings for each student
      const bookingPromises = newClass.students.map(async (student) => {
        const bookingData = {
          teacherId: teacherId,
          studentId: student.id,
          classTitle: newClass.title,
          topic: newClass.topic,
          scheduledTime: isoString,
          duration: newClass.duration || 60,
          notes: `Teacher-created class`,
          createdBy: "teacher"
        };

        const booking = await createBooking(bookingData);
        return await acceptBooking(booking._id);
      });

      await Promise.all(bookingPromises);
      showToast(`Class "${newClass.title}" created successfully for ${newClass.students.length} student(s)!`);
      
      await fetchTeacherData();
      
    } catch (err) {
      console.error("Error creating class:", err);
      showToast("Failed to create class. Please try again.", "error");
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

  // ✅ CLASS CANCEL / DELETE
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: null,
    classId: null,
  });

  const askCancelClass = (id) =>
    setConfirmModal({ open: true, type: "cancel", classId: id });

  const askDeleteClass = (classItem) => {
    // Accept both ID and class object
    const classId = typeof classItem === 'object' ? classItem.id : classItem;
    setConfirmModal({ open: true, type: "delete", classId: classId });
  };

  const handleConfirm = async () => {
    if (confirmModal.type === "cancel") {
      try {
        // ✅ FIXED: Cancel all bookings if class has multiple students
        const classToCancel = classes.find(cls => cls.id === confirmModal.classId);
        
        if (classToCancel && classToCancel.bookingIds && classToCancel.bookingIds.length > 0) {
          // Cancel all bookings for this class (in case of grouped students)
          await Promise.all(
            classToCancel.bookingIds.map(bookingId => cancelBooking(bookingId, "Teacher cancelled class"))
          );
        } else {
          // Single booking - cancel by class ID
          await cancelBooking(confirmModal.classId, "Teacher cancelled class");
        }
        
        // Update UI
        setClasses((prev) =>
          prev.map((cls) =>
            cls.id === confirmModal.classId
              ? { ...cls, status: "cancelled" }
              : cls
          )
        );
        showToast("Class cancelled successfully");
      } catch (err) {
        console.error("Error cancelling class:", err);
        showToast("Failed to cancel class", "error");
      }
    } else if (confirmModal.type === "delete") {
      try {
        // ✅ FIXED: Delete all bookings if class has multiple students
        const classToDelete = classes.find(cls => cls.id === confirmModal.classId);
        
        if (classToDelete && classToDelete.bookingIds && classToDelete.bookingIds.length > 0) {
          // Delete all bookings for this class (in case of grouped students)
          await Promise.all(
            classToDelete.bookingIds.map(bookingId => deleteBooking(bookingId))
          );
        } else {
          // Single booking - delete by class ID
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

  const handleJoinClass = (cls) => {
    setActiveClass(cls);
    setIsClassroomOpen(true);
  };

  const handleLeaveClassroom = () => {
    setIsClassroomOpen(false);
    setActiveClass(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (isClassroomOpen && activeClass) {
    return (
      <Classroom
        classData={activeClass}
        userRole="teacher"
        onLeave={handleLeaveClassroom}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          toast.type === "error" ? "bg-red-500" : "bg-green-500"
        } text-white`}>
          {toast.message}
        </div>
      )}

      <DashboardHeader
        teacherName={teacherInfo?.firstName || "Teacher"}
        onLogout={handleLogout}
        onChangePassword={() => setShowChangePassword(true)}
        onOpenSettings={() => setShowSettingsSidebar(true)}
        onSessionManagement={() => setShowSessionManagement(true)}
      />

      {showChangePassword && (
        <ChangePassword
          onClose={() => setShowChangePassword(false)}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}

      {showSessionManagement && (
        <SessionManagement onClose={() => setShowSessionManagement(false)} />
      )}

      {showSettingsSidebar && (
        <SettingsSidebar
          isOpen={showSettingsSidebar}
          onClose={() => setShowSettingsSidebar(false)}
          onOpenModal={() => {
            setShowSettingsSidebar(false);
            setShowSettingsModal(true);
          }}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {!loading && teacherInfo && (
        <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white py-6 px-4 shadow-lg">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold">
              Welcome back, {teacherInfo.firstName}! 👋
            </h2>
            <p className="text-sm text-purple-100 mt-1">
              You have <span className="font-semibold text-white">{students.length}</span> assigned students,{" "}
              <span className="font-semibold text-white">{classes.length}</span> scheduled classes, and{" "}
              <span className="font-semibold text-white">{bookings.length}</span> pending bookings
            </p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TeacherNavTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={["dashboard", "classes", "completed-classes", "students", "bookings"]}
        />

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
              classes={classes.filter(c => c.status === "scheduled" || c.status === "upcoming-soon")}
              students={students}
              onCancel={askCancelClass}
              onDelete={askDeleteClass}
            />
          </div>
        )}

        {activeTab === "classes" && (
          <div className="space-y-6">
            {/* ✅ IMPROVED: Better Add Class button design */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 font-semibold text-lg"
            >
              <Plus className="w-5 h-5" />
              Add New Class
            </button>
            
            {classes.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-500 text-lg">No classes scheduled yet</p>
                <p className="text-gray-400 text-sm mt-2">
                  Accept booking requests to add classes to your schedule
                </p>
              </div>
            ) : (
              <ClassList 
                data={classes} 
                onJoin={handleJoinClass}
                onDelete={askDeleteClass}
              />
            )}
          </div>
        )}

        <ClassModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleAddClass}
          students={students}
        />

        {activeTab === "completed-classes" && (
          <CompletedClassesTab 
            classes={completedClasses}
            teacherInfo={teacherInfo}
          />
        )}

        {activeTab === "students" && (
          <div>
            {students.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-500 text-lg">No students assigned yet</p>
              </div>
            ) : (
              <StudentProgressList students={students} />
            )}
          </div>
        )}

        {activeTab === "bookings" && (
          <BookingList
            bookings={bookings}
            onAccept={handleAcceptBooking}
            onReject={handleRejectBooking}
          />
        )}

        <ConfirmModal
          isOpen={confirmModal.open}
          type={confirmModal.type}
          onConfirm={handleConfirm}
          onCancel={() =>
            setConfirmModal({ open: false, type: null, classId: null })
          }
        />
      </div>
    </div>
  );
}