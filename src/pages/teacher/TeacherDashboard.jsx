// src/pages/teacher/TeacherDashboard.jsx - WITH DARK MODE
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

// Dark Mode
import { useDarkMode } from '../../hooks/useDarkMode';
import DarkModeToggle from '../../components/DarkModeToggle';

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

  // Dark Mode
  const { isDarkMode, toggleDarkMode } = useDarkMode();

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
        
        const groupKey = `${booking.scheduledTime}_${booking.classTitle}`;
        
        if (classesMap.has(groupKey)) {
          const existingClass = classesMap.get(groupKey);
          existingClass.students.push(`${booking.studentId.firstName} ${booking.studentId.surname}`);
          existingClass.bookingIds.push(booking._id);
        } else {
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
            bookingIds: [booking._id]
          };
          
          classesMap.set(groupKey, classObj);
        }
      });

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
    
    // Log the duration to verify it's being captured
    console.log("Creating class with details:", {
      original: localDateTimeString,
      parsed: scheduledDate,
      iso: isoString,
      duration: newClass.duration,  // Should show actual value like 30, 45, etc.
      durationParsed: parseInt(newClass.duration)
    });
    
    const bookingPromises = newClass.students.map(async (student) => {
      const bookingData = {
        teacherId: teacherId,
        studentId: student.id,
        classTitle: newClass.title,
        topic: newClass.topic,
        scheduledTime: isoString,
        duration: parseInt(newClass.duration), // ✅ FIX: Remove the || 60 fallback, parse as integer
        notes: `Teacher-created class`,
        createdBy: "teacher"
      };

      console.log("📤 Sending booking data:", bookingData); // ✅ DEBUG

      const booking = await createBooking(bookingData);
      console.log("✅ Booking created:", booking); // ✅ DEBUG
      
      return await acceptBooking(booking._id);
    });

    await Promise.all(bookingPromises);
    showToast(`Class "${newClass.title}" created successfully for ${newClass.students.length} student(s)!`);
    
    await fetchTeacherData();
    
  } catch (err) {
    console.error("Error creating class:", err);
    console.error("Error details:", err.response?.data); // ✅ More detailed error
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

  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: null,
    classId: null,
  });

  const askCancelClass = (id) =>
    setConfirmModal({ open: true, type: "cancel", classId: id });

  const askDeleteClass = (classItem) => {
    const classId = typeof classItem === 'object' ? classItem.id : classItem;
    setConfirmModal({ open: true, type: "delete", classId: classId });
  };

  const handleConfirm = async () => {
    if (confirmModal.type === "cancel") {
      try {
        const classToCancel = classes.find(cls => cls.id === confirmModal.classId);
        
        if (classToCancel && classToCancel.bookingIds && classToCancel.bookingIds.length > 0) {
          await Promise.all(
            classToCancel.bookingIds.map(bookingId => cancelBooking(bookingId, "Teacher cancelled class"))
          );
        } else {
          await cancelBooking(confirmModal.classId, "Teacher cancelled class");
        }
        
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
        const classToDelete = classes.find(cls => cls.id === confirmModal.classId);
        
        if (classToDelete && classToDelete.bookingIds && classToDelete.bookingIds.length > 0) {
          await Promise.all(
            classToDelete.bookingIds.map(bookingId => deleteBooking(bookingId))
          );
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
     console.log('🔍 Joining class:', classItem);
     
     setActiveClass({
       id: classItem.bookingId || classItem.id,
       bookingId: classItem.bookingId || classItem.id,
       title: classItem.title,
       topic: classItem.topic,
       duration: classItem.duration
     });
     setIsClassroomOpen(true);
   };

  const handleLeaveClassroom = () => {
    setIsClassroomOpen(false);
    setActiveClass(null);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDarkMode ? 'border-blue-400' : 'border-blue-600'} mx-auto`}></div>
          <p className={`mt-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading dashboard...</p>
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
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50'}`}>
      {/* Toast Notification */}
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
        isDarkMode={isDarkMode}
      />

      {showChangePassword && (
        <ChangePassword
          onClose={() => setShowChangePassword(false)}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}

      {showSessionManagement && (
        <SessionManagement 
          onClose={() => setShowSessionManagement(false)}
          userType="teacher"
        />
      )}

      {showSettingsSidebar && (
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
            firstName: teacherInfo?.firstName,
            lastName: teacherInfo?.lastName,
            email: teacherInfo?.email
          }}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          userType="teacher"
        />
      )}

      {/* Welcome Banner */}
      {!loading && teacherInfo && (
        <div className={`${
          isDarkMode 
            ? 'bg-gradient-to-r from-purple-800 via-blue-800 to-indigo-800' 
            : 'bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600'
        } text-white py-6 px-4 shadow-lg`}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold">
              Welcome back, {teacherInfo.firstName}! 👋
            </h2>
            <p className={`text-sm ${isDarkMode ? 'text-purple-200' : 'text-purple-100'} mt-1`}>
              You have <span className="font-semibold text-white">{students.length}</span> assigned students,{" "}
              <span className="font-semibold text-white">{classes.length}</span> scheduled classes, and{" "}
              <span className="font-semibold text-white">{bookings.length}</span> pending bookings
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TeacherNavTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={["dashboard", "classes", "completed-classes", "students", "bookings"]}
          isDarkMode={isDarkMode}
        />

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <QuickStats
              stats={{
                totalStudents: students.length,
                totalClasses: classes.length,
                totalBookings: bookings.length,
              }}
              isDarkMode={isDarkMode}
            />
            <LiveClasses 
              classes={classes.filter(c => c.status === "live")} 
              onJoin={handleJoinClass}
              isDarkMode={isDarkMode}
            />
            <UpcomingClasses
              classes={classes.filter(c => c.status === "scheduled" || c.status === "upcoming-soon")}
              students={students}
              onCancel={askCancelClass}
              onDelete={askDeleteClass}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        {activeTab === "classes" && (
          <div className="space-y-6">
            <button
              onClick={() => setIsModalOpen(true)}
              className={`px-6 py-3 ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
              } text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 font-semibold text-lg`}
            >
              <Plus className="w-5 h-5" />
              Add New Class
            </button>
            
            {classes.length === 0 ? (
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-8 text-center`}>
                <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-500'} text-lg`}>No classes scheduled yet</p>
                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-400'} text-sm mt-2`}>
                  Accept booking requests to add classes to your schedule
                </p>
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

        <ClassModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleAddClass}
          students={students}
          isDarkMode={isDarkMode}
        />

        {activeTab === "completed-classes" && (
          <CompletedClassesTab 
            classes={completedClasses}
            teacherInfo={teacherInfo}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === "students" && (
          <div>
            {students.length === 0 ? (
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-8 text-center`}>
                <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-500'} text-lg`}>No students assigned yet</p>
              </div>
            ) : (
              <StudentProgressList 
                students={students}
                isDarkMode={isDarkMode}
              />
            )}
          </div>
        )}

        {activeTab === "bookings" && (
          <BookingList
            bookings={bookings}
            onAccept={handleAcceptBooking}
            onReject={handleRejectBooking}
            isDarkMode={isDarkMode}
          />
        )}

        <ConfirmModal
          isOpen={confirmModal.open}
          type={confirmModal.type}
          onConfirm={handleConfirm}
          onCancel={() =>
            setConfirmModal({ open: false, type: null, classId: null })
          }
          isDarkMode={isDarkMode}
        />
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
    </div>
  );
}
