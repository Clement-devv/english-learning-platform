import React, { useState } from "react";

// layout
import DashboardHeader from "./components/Layout/DashboardHeader";
import TeacherNavTabs from "./components/layout/TeacherNavTabs";

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

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const [classes, setClasses] = useState([
    { id: 1, title: "English Basics", topic: "Grammar", time: "2 PM", status: "live", students: ["John Doe"] },
    { id: 2, title: "Conversation Practice", topic: "Speaking", time: "4 PM", status: "scheduled", students: ["Jane Smith"] },
  ]);

  // ✅ we now keep a setter for students
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

  // ------------------ BOOKINGS ------------------
  const handleAcceptBooking = (booking) => {
    // remove from list
    setBookings((prev) => prev.filter((b) => b.id !== booking.id));

    if (booking.isAdminBooking) {
      // 1) add student if not yet assigned
      setStudents((prev) => {
        if (!prev.find((s) => s.id === booking.studentId)) {
          return [
            ...prev,
            { id: booking.studentId, name: booking.studentName, level: "Trial", progress: 0 },
          ];
        }
        return prev;
      });

      // 2) add class for teacher
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

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-500 to-pink-500">
      <DashboardHeader />

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
            <LiveClasses classes={classes} />
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
    </div>
  );
}
