import React, { useState } from "react";
import { motion } from "framer-motion";
import StudentModal from "../modals/StudentModal";
import StudentTable from "../components/StudentTable";
import PaymentHistoryModal from "../modals/PaymentHistoryModal";
import ManualPaymentModal from "../modals/ManualPaymentModal";
import LessonHistoryModal from "../modals/LessonHistoryModal";
import AnimatedButton from "../components/AnimatedButton";

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

  // Send email placeholder
  const sendEmail = (to, message) => console.log(`Email to ${to}: ${message}`);

  // ----- Manual Payment -----
  const handleOpenManualPayment = (index) => {
    setSelectedStudent(index);
    setIsManualModalOpen(true);
  };

  const handleSaveManualPayment = ({ amount, classes }) => {
    if (selectedStudent === null) return;
    const updated = [...students];
    updated[selectedStudent].lastPaymentDate = new Date();
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
    sendEmail(updated[selectedStudent].email, `We received ₦${amount} for ${classes} classes.`);
    setIsManualModalOpen(false);
  };

  // ----- Create/Edit -----
  const handleSaveStudent = (data) => {
    const pass = data.password?.trim() || Math.random().toString(36).slice(-8);

    if (editIndex !== null) {
      const updated = [...students];
      updated[editIndex] = {
        ...data,
        password: pass,
        active: students[editIndex].active,
        noOfClasses: students[editIndex].noOfClasses ?? 0,
        showTempPassword: true,
      };
      setStudents(updated);
      setEditIndex(null);
    } else {
      const newStudent = {
        ...data,
        password: pass,
        active: true,
        noOfClasses: 0,
        showTempPassword: true,
      };
      setStudents([...students, newStudent]);
    }
    sendEmail(data.email, `Welcome ${data.firstName}! Password: ${pass}`);
  };

  // ----- Delete / Toggle -----
  const handleEditStudent = (i) => { setEditIndex(i); setIsModalOpen(true); };
  const handleDeleteStudent = (i) => {
    if (window.confirm("Delete this student?")) {
      const copy = [...students];
      copy.splice(i, 1);
      setStudents(copy);
    }
  };
  const handleToggleAccess = (i) => {
    const u = [...students];
    u[i].active = !u[i].active;
    setStudents(u);
  };

  // ----- Mark Lesson -----
  const handleLessonTaken = (i, teacher = "Teacher") => {
    const u = [...students];
    if (!u[i] || u[i].noOfClasses <= 0) return;
    u[i].noOfClasses -= 1;
    setLessonHistory((prev) => [
      ...prev,
      { date: new Date().toLocaleString(), student: `${u[i].firstName} ${u[i].surname}`, teacher, remaining: u[i].noOfClasses },
    ]);
    if (u[i].noOfClasses === 0) {
      u[i].active = false;
      sendEmail(u[i].email, "Classes finished. Account disabled.");
    }
    setStudents(u);
  };

  // ----- Password helpers -----
  const handleResetPassword = (i) => {
    const pass = Math.random().toString(36).slice(-8);
    const u = [...students];
    u[i].password = pass;
    u[i].showTempPassword = true;
    setStudents(u);
    sendEmail(u[i].email, `Password reset: ${pass}`);
    setToast("Password reset");
    setTimeout(() => setToast(""), 2000);
  };

  const handleCopyPassword = (i) => {
    if (navigator.clipboard) navigator.clipboard.writeText(students[i].password || "");
    setToast("Password copied");
    setTimeout(() => setToast(""), 2000);
    const u = [...students];
    if (u[i]) u[i].showTempPassword = false;
    setStudents(u);
  };

  const activeStudents = students.filter((s) => s.active);
  const disabledStudents = students.filter((s) => !s.active);

  return (
    <div className="relative">
      <h2 className="text-2xl font-bold mb-4 text-brand-primary">Students</h2>
      {toast && <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow">{toast}</div>}

      <div className="flex gap-3 mb-4">
        <AnimatedButton onClick={() => { setEditIndex(null); setIsModalOpen(true); }}>+ Create Student</AnimatedButton>
        <AnimatedButton className="bg-brand-accent" onClick={() => { setSelectedStudent(null); setIsPaymentModalOpen(true); }}>View Payment History</AnimatedButton>
        <AnimatedButton className="bg-blue-600" onClick={() => { setSelectedStudent(null); setIsLessonModalOpen(true); }}>View Lesson History</AnimatedButton>
      </div>

      <div className="flex justify-center gap-3 mb-6">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className={`px-6 py-2 rounded-full font-medium ${view === "active" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"}`}
          onClick={() => setView("active")}>Active Students</motion.button>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className={`px-6 py-2 rounded-full font-medium ${view === "disabled" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700"}`}
          onClick={() => setView("disabled")}>Disabled Students</motion.button>
      </div>

      {view === "active" && (
        <StudentTable
          students={activeStudents}
          onEdit={handleEditStudent}
          onDelete={handleDeleteStudent}
          onToggle={handleToggleAccess}
          onManualPayment={handleOpenManualPayment}
          onViewPayment={(i) => { setSelectedStudent(i); setIsPaymentModalOpen(true); }}
          onViewLessons={(i) => { setSelectedStudent(i); setIsLessonModalOpen(true); }}
          onMarkLesson={handleLessonTaken}
          onResetPassword={handleResetPassword}
          onCopyPassword={handleCopyPassword}
        />
      )}

      {view === "disabled" && (
        <StudentTable
          students={disabledStudents}
          onEdit={handleEditStudent}
          onDelete={handleDeleteStudent}
          onToggle={handleToggleAccess}
          onManualPayment={handleOpenManualPayment}
          onViewPayment={(i) => { setSelectedStudent(i); setIsPaymentModalOpen(true); }}
          onViewLessons={(i) => { setSelectedStudent(i); setIsLessonModalOpen(true); }}
          onMarkLesson={handleLessonTaken}
          onResetPassword={handleResetPassword}
          onCopyPassword={handleCopyPassword}
        />
      )}

      <StudentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveStudent}
        initialData={editIndex !== null ? students[editIndex] : null} />
      <PaymentHistoryModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)}
        history={selectedStudent !== null
          ? paymentHistory.filter(p => p.student === `${students[selectedStudent].firstName} ${students[selectedStudent].surname}`)
          : paymentHistory} />
      <LessonHistoryModal isOpen={isLessonModalOpen} onClose={() => setIsLessonModalOpen(false)}
        history={selectedStudent !== null
          ? lessonHistory.filter(l => l.student === `${students[selectedStudent].firstName} ${students[selectedStudent].surname}`)
          : lessonHistory} />
      <ManualPaymentModal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)}
        onSave={handleSaveManualPayment} student={students[selectedStudent]} />
    </div>
  );
}
