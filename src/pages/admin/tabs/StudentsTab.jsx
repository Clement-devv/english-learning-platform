// StudentsTab.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import StudentModal from "../modals/StudentModal";
import StudentTable from "../components/StudentTable";
import PaymentHistoryModal from "../modals/PaymentHistoryModal";
import ManualPaymentModal from "../modals/ManualPaymentModal";
import LessonHistoryModal from "../modals/LessonHistoryModal";
import AnimatedButton from "../components/AnimatedButton";

import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  toggleStudent,
  recordLesson,
  apiResetPassword,
  addPayment,
  getAllPayments,
  getAllLessons,
} from "../../../services/studentService";




export default function StudentsTab({ onNotify }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [lessonHistory, setLessonHistory] = useState([]);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);

  const [view, setView] = useState("active");
  const [toast, setToast] = useState("");
  const [searchActive, setSearchActive] = useState("");
  const [searchDisabled, setSearchDisabled] = useState("");

  const PASSWORD_TTL = 10000;

  const sendEmail = (to, message) => {
    if (to) console.log(`📧 Email to ${to}: ${message}`);
  };








// useEffect to load payment and lesson history
useEffect(() => {
  (async () => {
    try {
      console.log("🔄 Loading payment and lesson history...");
      
      const [paymentsData, lessonsData] = await Promise.all([
        getAllPayments(),
        getAllLessons(),
      ]);
      
      console.log("📥 Raw payments from API:", paymentsData);
      console.log("📥 Raw lessons from API:", lessonsData);
      
      // ✅ Filter out records where studentId is null, then format
      const formattedPayments = paymentsData
        .filter(p => p.studentId !== null) // Filter out null studentIds
        .map(p => ({
          ...p,
          studentId: p.studentId._id,
          student: `${p.studentId.firstName} ${p.studentId.surname}`,
          amountDisplay: `₦${p.amount}`,
        }));
      
      // ✅ Filter out records where studentId is null, then format
      const formattedLessons = lessonsData
        .filter(l => l.studentId !== null) // Filter out null studentIds
        .map(l => ({
          ...l,
          studentId: l.studentId._id,
          student: `${l.studentId.firstName} ${l.studentId.surname}`,
        }));
      
      console.log("✅ Formatted payments:", formattedPayments);
      console.log("✅ Formatted lessons:", formattedLessons);
      
      setPaymentHistory(formattedPayments);
      setLessonHistory(formattedLessons);
    } catch (err) {
      console.error("❌ Error loading history:", err);
      console.error("❌ Error details:", err.response?.data);
    }
  })();
}, [students]);




  // ---------------- Load Students ----------------
  // ---------------- Load Students ----------------
useEffect(() => {
  (async () => {
    try {
      const data = await getStudents();
      console.log("🔄 Loaded students from DB:", data); // ✅ ADD THIS
      console.log("🔄 Number of students:", data.length); // ✅ ADD THIS
      setStudents(data);
    } catch (err) {
      console.error("❌ Failed to load students:", err);
    } finally {
      setLoading(false);
    }
  })();
}, []);

  // Reset search fields when switching view
  useEffect(() => {
    setSearchActive("");
    setSearchDisabled("");
  }, [view]);

  // ----- Manual Payment -----
  const handleOpenManualPayment = (id) => {
    setSelectedStudent(id);
    setIsManualModalOpen(true);
  };

  const handleSaveManualPayment = async ({ amount, classes }) => {
    if (!selectedStudent) return;
    try {
      const stu = students.find((s) => s._id === selectedStudent);
      if (!stu) return;

      const res = await addPayment(stu._id, { amount, classes });

      // Update student list
      setStudents((prev) =>
        prev.map((s) => (s._id === res.student._id ? res.student : s))
      );

      // Add to payment history
      setPaymentHistory((prev) => [
        ...prev,
        {
          ...res.payment,
          studentId: res.student._id,
          student: `${res.student.firstName} ${res.student.surname}`,
          amountDisplay: `₦${res.payment.amount}`,
        },
      ]);

      sendEmail(
        res.student.email,
        `We received ₦${amount} for ${classes} classes.`
      );
      onNotify?.(`Manual payment of ₦${amount} recorded for ${res.student.firstName}`);
      setIsManualModalOpen(false);
    } catch (e) {
      console.error("❌ Payment error:", e);
    }
  };

  // ----- Create/Edit -----
  const handleSaveStudent = async (data) => {
  try {
    if (editId !== null) {
      const updated = await updateStudent(editId, data);
      setStudents((prev) =>
        prev.map((s) => (s._id === editId ? updated : s))
      );
      onNotify?.(`Student updated: ${updated.firstName} ${updated.surname}`);
      setEditId(null);
      setIsModalOpen(false); // ✅ Close modal for edit
    } else {
      const result = await createStudent(data);
      
      setStudents((prev) => [...prev, result.student]);
      
      onNotify?.(
        `New student created: ${result.student.firstName} ${result.student.surname}`
      );
      
      sendEmail(data.email, `Welcome ${data.firstName}!`);
      
      // ✅ Return the result so modal can handle tempPassword display
      return result;
    }
  } catch (e) {
    console.error("❌ Save student error:", e);
    console.error("❌ Error details:", e.response?.data);
  }
};
  // ----- Delete / Toggle -----
  const handleEditStudent = (id) => {
    setEditId(id);
    setIsModalOpen(true);
  };

  const handleDeleteStudent = async (id) => {
    if (window.confirm("Delete this student?")) {
      try {
        await deleteStudent(id);
        setStudents((prev) => prev.filter((s) => s._id !== id));
      } catch (e) {
        console.error("❌ Delete error:", e);
      }
    }
  };

  const handleToggleAccess = async (id, newState) => {
    try {
      const updated = await toggleStudent(id, { active: newState });
      setStudents((prev) =>
        prev.map((s) => (s._id === id ? updated : s))
      );
    } catch (e) {
      console.error("❌ Toggle error:", e);
    }
  };

  // ----- Mark Lesson -----
  const handleLessonTaken = async (id, teacher = "Teacher") => {
  const stu = students.find((s) => s._id === id);
  if (!stu) return;

  if ((Number(stu.noOfClasses) || 0) <= 0) {
    onNotify?.("No classes left for this student.");
    return;
  }

  try {
    const updated = await recordLesson(stu._id, { teacher });

    setStudents((prev) =>
      prev.map((s) => 
        s._id === id 
          ? { ...updated.student, showTempPassword: false } // ✅ Force it to false
          : s
      )
    );

    setLessonHistory((prev) => [
      ...prev,
      {
        ...updated.lesson,
        studentId: updated.student._id,
        student: `${updated.student.firstName} ${updated.student.surname}`,
      },
    ]);

    if (updated.student.noOfClasses === 0) {
      sendEmail(updated.student.email, "Classes finished. Account disabled.");
    }
  } catch (e) {
    console.error("❌ Lesson error:", e);
  }
};

  // ----- Password helpers -----
  const handleResetPassword = async (id) => {
  try {
    const response = await apiResetPassword(id);
    const plainPassword = response.newPassword;
    
    setStudents((prev) =>
      prev.map((s) =>
        s._id === id 
          ? { ...s, showTempPassword: true, tempPassword: plainPassword }
          : s
      )
    );

    const stu = students.find((s) => s._id === id);
    if (stu) sendEmail(stu.email, `Password reset: ${plainPassword}`);

    setToast(`Temp password: ${plainPassword}`);
    
    // Clear after 10 seconds
    setTimeout(() => {
      setToast("");
      setStudents((prev) =>
        prev.map((s) =>
          s._id === id
            ? { ...s, showTempPassword: false, tempPassword: undefined }
            : s
        )
      );
    }, PASSWORD_TTL);
  } catch (e) {
    console.error("❌ Reset error:", e);
  }
};

 const handleCopyPassword = (id) => {
  const stu = students.find((s) => s._id === id);
  if (stu?.tempPassword && navigator.clipboard) { // ✅ Use tempPassword instead of password
    navigator.clipboard.writeText(stu.tempPassword);
    setToast("Password copied");
    setTimeout(() => setToast(""), 2000);

    setStudents((prev) =>
      prev.map((s) =>
        s._id === id
          ? { ...s, showTempPassword: false, tempPassword: undefined }
          : s
      )
    );
  }
};

  // ----- View modals -----
  const handleViewPayment = (id) => {
    setSelectedStudent(id);
    setIsPaymentModalOpen(true);
  };

  const handleViewLessons = (id) => {
    setSelectedStudent(id);
    setIsLessonModalOpen(true);

    
  };

  

  // Lists & filters
  const activeStudents = students.filter((s) => s.active);
  const disabledStudents = students.filter((s) => !s.active);
  

  const filteredActive = activeStudents.filter((s) =>
    `${s.firstName} ${s.surname} ${s.email}`
      .toLowerCase()
      .includes(searchActive.toLowerCase())
  );
  const filteredDisabled = disabledStudents.filter((s) =>
    `${s.firstName} ${s.surname} ${s.email}`
      .toLowerCase()
      .includes(searchDisabled.toLowerCase())
  );

  const selectedStudentObj = students.find((s) => s._id === selectedStudent);

 /* console.log("👥 All students:", students);
console.log("✅ Active students:", activeStudents);
console.log("❌ Disabled students:", disabledStudents);
console.log("🔍 Filtered active:", filteredActive);
console.log("🔍 Filtered disabled:", filteredDisabled);*/

  if (loading) {
    return <div className="p-6 text-gray-600">Loading students...</div>;
  }

  return (
    <div className="relative">
      <h2 className="text-2xl font-bold mb-4 text-brand-primary">Students</h2>
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <AnimatedButton
          onClick={() => {
            setEditId(null);
            setIsModalOpen(true);
          }}
        >
          + Create Student
        </AnimatedButton>
        <AnimatedButton
          className="bg-brand-accent"
          onClick={() => {
            setSelectedStudent(null);
            setIsPaymentModalOpen(true);
          }}
        >
          View Payment History
        </AnimatedButton>
        <AnimatedButton
          className="bg-blue-600"
          onClick={() => {
            setSelectedStudent(null);
            setIsLessonModalOpen(true);
          }}
        >
          View Lesson History
        </AnimatedButton>
      </div>

      {/* Active / Disabled toggle buttons */}
      <div className="flex justify-center gap-3 mb-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`px-6 py-2 rounded-full font-medium ${
            view === "active"
              ? "bg-green-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
          onClick={() => setView("active")}
        >
          Active Students
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`px-6 py-2 rounded-full font-medium ${
            view === "disabled"
              ? "bg-red-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
          onClick={() => setView("disabled")}
        >
          Disabled Students
        </motion.button>
      </div>

      {/* Active Tab */}
      {view === "active" && (
        <div className="mt-4">
          <div className="mb-4 flex justify-center">
            <input
              type="text"
              placeholder="Search active students..."
              value={searchActive}
              onChange={(e) => setSearchActive(e.target.value)}
              className="w-80 px-4 py-2 rounded-full border shadow focus:ring focus:ring-green-300"
            />
          </div>
          <StudentTable
            students={filteredActive}
            onEdit={handleEditStudent}
            onDelete={handleDeleteStudent}
            onToggle={handleToggleAccess}
            onManualPayment={handleOpenManualPayment}
            onViewPayment={handleViewPayment}
            onViewLessons={handleViewLessons}
            onMarkLesson={handleLessonTaken}
            onResetPassword={handleResetPassword}
            onCopyPassword={handleCopyPassword}
          />
        </div>
      )}

      {/* Disabled Tab */}
      {view === "disabled" && (
        <div className="mt-4">
          <div className="mb-4 flex justify-center">
            <input
              type="text"
              placeholder="Search disabled students..."
              value={searchDisabled}
              onChange={(e) => setSearchDisabled(e.target.value)}
              className="w-80 px-4 py-2 rounded-full border shadow focus:ring focus:ring-red-300"
            />
          </div>
          <StudentTable
            students={filteredDisabled}
            onEdit={handleEditStudent}
            onDelete={handleDeleteStudent}
            onToggle={handleToggleAccess}
            onManualPayment={handleOpenManualPayment}
            onViewPayment={handleViewPayment}
            onViewLessons={handleViewLessons}
            onMarkLesson={handleLessonTaken}
            onResetPassword={handleResetPassword}
            onCopyPassword={handleCopyPassword}
          />
        </div>
      )}

      {/* Modals */}
      <StudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveStudent}
        initialData={editId ? students.find((s) => s._id === editId) : null}
      />

      <PaymentHistoryModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        history={
          selectedStudent
            ? paymentHistory.filter(
                (p) => p.studentId === selectedStudent
              )
            : paymentHistory
        }
      />

      <LessonHistoryModal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        history={
          selectedStudent
            ? lessonHistory.filter((l) => l.studentId === selectedStudent)
            : lessonHistory
        }
      />

      <ManualPaymentModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSave={handleSaveManualPayment}
        student={selectedStudentObj}
      />
    </div>
  );
}
