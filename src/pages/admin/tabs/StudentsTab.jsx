import React, { useState } from "react";
import StudentModal from "../modals/StudentModal";
import StudentTable from "../components/StudentTable";
import PaymentHistoryModal from "../modals/PaymentHistoryModal";
import ManualPaymentModal from "../modals/ManualPaymentModal";
import LessonHistoryModal from "../modals/LessonHistoryModal";

export default function StudentsTab() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [students, setStudents] = useState([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [lessonHistory, setLessonHistory] = useState([]);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [view, setView] = useState("active");
  const [toast, setToast] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // --------------------
  // Email helper
  // --------------------
  const sendEmail = (to, message) =>
    console.log(`Email sent to ${to}: ${message}`);

  // --------------------
  // Manual Payment
  // --------------------
  const handleOpenManualPayment = (index) => {
    setSelectedStudent(index);
    setIsManualModalOpen(true);
  };

  const handleSaveManualPayment = ({ amount, classes }) => {
    if (selectedStudent === null) return;
    const updated = [...students];
    updated[selectedStudent].lastPaymentDate = new Date();
    updated[selectedStudent].reminderCount = 0;
    updated[selectedStudent].active = true;
    updated[selectedStudent].noOfClasses =
      (updated[selectedStudent].noOfClasses || 0) + parseInt(classes);
    setStudents(updated);

    setPaymentHistory((prev) => [
      ...prev,
      {
        date: new Date().toLocaleString(),
        student: `${updated[selectedStudent].firstName} ${updated[selectedStudent].surname}`,
        method: "Manual",
        amount: `₦${amount}`,
        classes,
        status: "Success",
      },
    ]);

    sendEmail(
      updated[selectedStudent].email,
      `We have received your payment of ₦${amount} for ${classes} classes.`
    );
    setIsManualModalOpen(false);
  };

  // --------------------
  // Create / Edit Student
  // --------------------
  const handleSaveStudent = (studentData) => {
    const generatedPassword =
      studentData.password && studentData.password.trim() !== ""
        ? studentData.password
        : Math.random().toString(36).slice(-8);

    if (editIndex !== null) {
      const updated = [...students];
      updated[editIndex] = {
        ...studentData,
        password: generatedPassword,
        active: students[editIndex].active,
        noOfClasses: students[editIndex].noOfClasses ?? 0,
        showTempPassword: true,
      };
      setStudents(updated);
      setEditIndex(null);
    } else {
      const newStudent = {
        ...studentData,
        password: generatedPassword,
        active: true,
        noOfClasses: 0,
        showTempPassword: true,
      };
      setStudents([...students, newStudent]);
    }

    sendEmail(
      studentData.email,
      `Welcome ${studentData.firstName}! Your temporary password is: ${generatedPassword}`
    );
  };

  // --------------------
  // Edit / Delete / Toggle
  // --------------------
  const handleEditStudent = (index) => {
    setEditIndex(index);
    setIsModalOpen(true);
  };

  const handleDeleteStudent = (index) => {
    if (window.confirm("Are you sure you want to delete this student?")) {
      const updated = [...students];
      updated.splice(index, 1);
      setStudents(updated);
    }
  };

  const handleToggleAccess = (index) => {
    const updated = [...students];
    updated[index].active = !updated[index].active;
    setStudents(updated);
  };

  // --------------------
  // Mark Lesson
  // --------------------
  const handleLessonTaken = (index, teacherName = "Unknown Teacher") => {
    const updated = [...students];
    if (!updated[index]) return;

    if (updated[index].noOfClasses > 0) {
      updated[index].noOfClasses -= 1;

      setLessonHistory((prev) => [
        ...prev,
        {
          date: new Date().toLocaleString(),
          student: `${updated[index].firstName} ${updated[index].surname}`,
          teacher: teacherName,
          remaining: updated[index].noOfClasses,
        },
      ]);

      if (updated[index].noOfClasses === 2) {
        sendEmail(updated[index].email, "You have 2 classes left. Please renew soon!");
      }
      if (updated[index].noOfClasses === 1) {
        sendEmail(updated[index].email, "You have 1 class left. Renew now!");
      }
      if (updated[index].noOfClasses === 0) {
        updated[index].active = false;
        sendEmail(
          updated[index].email,
          "Your classes are finished. Account disabled until payment."
        );
      }
      setStudents(updated);
    }
  };

  // --------------------
  // Password actions
  // --------------------
  const handleResetPassword = (index) => {
    const newPass = Math.random().toString(36).slice(-8);
    const updated = [...students];
    updated[index].password = newPass;
    updated[index].showTempPassword = true;
    setStudents(updated);

    sendEmail(
      updated[index].email,
      `Your password has been reset. New password: ${newPass}`
    );

    setToast("Password reset!");
    setTimeout(() => setToast(""), 2000);

    setTimeout(() => {
      const again = [...students];
      if (again[index]) {
        again[index].showTempPassword = false;
        setStudents(again);
      }
    }, 5000);
  };

  const handleCopyPassword = (index) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(students[index].password || "");
      setToast("Password copied!");
      setTimeout(() => setToast(""), 2000);

      const updated = [...students];
      if (updated[index]) {
        updated[index].showTempPassword = false;
        setStudents(updated);
      }
    }
  };

  // --------------------
  // Filters with search
  // --------------------
  const activeStudents = students
    .filter((s) => s.active)
    .filter((s) =>
      `${s.firstName} ${s.surname}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const inactiveStudents = students
    .filter((s) => !s.active)
    .filter((s) =>
      `${s.firstName} ${s.surname}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // --------------------
  // Render
  // --------------------
  return (
    <div className="relative">
      <h2 className="text-2xl font-bold mb-4 text-brand-primary">Students</h2>

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}

      <button
        onClick={() => {
          setEditIndex(null);
          setIsModalOpen(true);
        }}
        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary"
      >
        + Create Student
      </button>

      <button
        onClick={() => {
          setSelectedStudent(null);
          setIsPaymentModalOpen(true);
        }}
        className="ml-3 px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-yellow-600"
      >
        View Payment History
      </button>

      <button
        onClick={() => {
          setSelectedStudent(null);
          setIsLessonModalOpen(true);
        }}
        className="ml-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        View Lesson History
      </button>

      {/* Create Student Modal */}
      <StudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveStudent}
        initialData={editIndex !== null ? students[editIndex] : null}
      />

      {/* Payment History Modal */}
      <PaymentHistoryModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        history={
          selectedStudent !== null
            ? paymentHistory.filter(
                (p) =>
                  p.student ===
                  `${students[selectedStudent].firstName} ${students[selectedStudent].surname}`
              )
            : paymentHistory
        }
      />

      {/* Lesson History Modal */}
      <LessonHistoryModal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        history={
          selectedStudent !== null
            ? lessonHistory.filter(
                (item) =>
                  item.student ===
                  `${students[selectedStudent].firstName} ${students[selectedStudent].surname}`
              )
            : lessonHistory
        }
      />

      {/* View toggles */}
      <div className="flex justify-center gap-3 mt-6">
        <button
          onClick={() => setView("active")}
          className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
            view === "active"
              ? "bg-green-600 text-white shadow-lg scale-105"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Active Students
        </button>

        <button
          onClick={() => setView("disabled")}
          className={`px-5 py-2 rounded-full font-medium transition-all duration-300 ${
            view === "disabled"
              ? "bg-red-600 text-white shadow-lg scale-105"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Disabled Students
        </button>
      </div>

      {/* Active list */}
      {view === "active" && (
        <>
          <h3 className="text-lg font-bold mb-2 text-green-600">Active Students</h3>

          <input
            type="text"
            placeholder="Search active students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-3 w-full md:w-1/2 px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring focus:ring-green-300"
          />

          <StudentTable
            students={activeStudents}
            onEdit={handleEditStudent}
            onDelete={handleDeleteStudent}
            onToggle={handleToggleAccess}
            onManualPayment={handleOpenManualPayment}
            onViewPayment={(index) => {
              setSelectedStudent(index);
              setIsPaymentModalOpen(true);
            }}
            onViewLessons={(index) => {
              setSelectedStudent(index);
              setIsLessonModalOpen(true);
            }}
            onMarkLesson={handleLessonTaken}
            onResetPassword={handleResetPassword}
            onCopyPassword={handleCopyPassword}
          />
        </>
      )}

      {/* Disabled list */}
      {view === "disabled" && (
        <>
          <h3 className="text-lg font-bold mb-1 text-red-600">Disabled Students</h3>

          <input
            type="text"
            placeholder="Search disabled students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-3 w-full md:w-1/2 px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring focus:ring-red-300"
          />

          <StudentTable
            students={inactiveStudents}
            onEdit={handleEditStudent}
            onDelete={handleDeleteStudent}
            onToggle={handleToggleAccess}
            onManualPayment={handleOpenManualPayment}
            onViewPayment={(index) => {
              setSelectedStudent(index);
              setIsPaymentModalOpen(true);
            }}
            onViewLessons={(index) => {
              setSelectedStudent(index);
              setIsLessonModalOpen(true);
            }}
            onMarkLesson={handleLessonTaken}
            onResetPassword={handleResetPassword}
            onCopyPassword={handleCopyPassword}
          />
        </>
      )}

      {/* Manual Payment Modal */}
      <ManualPaymentModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSave={handleSaveManualPayment}
        student={students[selectedStudent]}
      />
    </div>
  );
}
