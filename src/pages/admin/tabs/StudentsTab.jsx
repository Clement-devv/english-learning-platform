// src/pages/admin/tabs/StudentsTab.jsx
import React, { useState, useEffect } from "react";
import {
  Search,
  Users,
  UserCheck,
  AlertTriangle,
  GraduationCap,
  Plus,
  SlidersHorizontal,
  BookOpen,
  Receipt,
} from "lucide-react";
import StudentCard from "../components/StudentCard";
import StudentModal from "../modals/StudentModal";
import PaymentHistoryModal from "../modals/PaymentHistoryModal";
import ManualPaymentModal from "../modals/ManualPaymentModal";
import LessonHistoryModal from "../modals/LessonHistoryModal";
import LessonMarkModal from "../modals/LessonMarkModal";

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

const PASSWORD_TTL = 15000;

// ── Summary stat card ─────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, sub, color, isDarkMode }) {
  const colors = {
    sky: {
      bg: isDarkMode ? "bg-sky-900/30" : "bg-sky-50",
      icon: isDarkMode ? "bg-sky-700/60 text-sky-300" : "bg-sky-100 text-sky-600",
      value: isDarkMode ? "text-sky-300" : "text-sky-700",
      border: isDarkMode ? "border-sky-800/40" : "border-sky-100",
    },
    emerald: {
      bg: isDarkMode ? "bg-emerald-900/30" : "bg-emerald-50",
      icon: isDarkMode ? "bg-emerald-700/60 text-emerald-300" : "bg-emerald-100 text-emerald-600",
      value: isDarkMode ? "text-emerald-300" : "text-emerald-700",
      border: isDarkMode ? "border-emerald-800/40" : "border-emerald-100",
    },
    red: {
      bg: isDarkMode ? "bg-red-900/30" : "bg-red-50",
      icon: isDarkMode ? "bg-red-700/60 text-red-300" : "bg-red-100 text-red-600",
      value: isDarkMode ? "text-red-300" : "text-red-700",
      border: isDarkMode ? "border-red-800/40" : "border-red-100",
    },
    purple: {
      bg: isDarkMode ? "bg-purple-900/30" : "bg-purple-50",
      icon: isDarkMode ? "bg-purple-700/60 text-purple-300" : "bg-purple-100 text-purple-600",
      value: isDarkMode ? "text-purple-300" : "text-purple-700",
      border: isDarkMode ? "border-purple-800/40" : "border-purple-100",
    },
  };
  const c = colors[color] || colors.sky;

  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 ${c.bg} ${c.border}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className={`text-xs font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
          {label}
        </p>
        <p className={`text-xl font-bold ${c.value}`}>{value}</p>
        {sub && (
          <p className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{sub}</p>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StudentsTab({ onNotify, isDarkMode = false }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [lessonModal, setLessonModal] = useState(null);
 

  // History data
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [lessonHistory, setLessonHistory] = useState([]);

  // Filters
  const [view, setView] = useState("active"); // "active" | "disabled" | "all"
  const [searchQuery, setSearchQuery] = useState("");

  // Toast
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState("success");

  const showToast = (message, type = "success") => {
    setToast(message);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  };

  const sendEmail = (to, message) => {
    if (to) console.log(`📧 Email to ${to}: ${message}`);
  };

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [studentsData, paymentsData, lessonsData] = await Promise.all([
          getStudents(),
          getAllPayments(),
          getAllLessons(),
        ]);

        setStudents(studentsData);

        // Format payment history (filter nulls)
        const formattedPayments = paymentsData
          .filter((p) => p.studentId !== null)
          .map((p) => ({
            ...p,
            studentId: p.studentId._id,
            student: `${p.studentId.firstName} ${p.studentId.surname}`,
            amountDisplay: `₦${p.amount}`,
          }));
        setPaymentHistory(formattedPayments);

        // Format lesson history (filter nulls)
        const formattedLessons = lessonsData
          .filter((l) => l.studentId !== null)
          .map((l) => ({
            ...l,
            studentId: l.studentId._id,
            student: `${l.studentId.firstName} ${l.studentId.surname}`,
          }));
        setLessonHistory(formattedLessons);
      } catch (err) {
        console.error("❌ Load students error:", err);
        showToast("Could not load students. Please refresh.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Save student (create / update) ─────────────────────────────────────────
  const handleSaveStudent = async (data) => {
    try {
      if (editId) {
        const updated = await updateStudent(editId, data);
        setStudents((prev) => prev.map((s) => (s._id === editId ? updated : s)));
        onNotify?.(`Student updated: ${updated.firstName} ${updated.surname}`);
        showToast(`${updated.firstName} updated successfully!`);
        setEditId(null);
        setIsModalOpen(false);
      } else {
        const result = await createStudent(data);
        setStudents((prev) => [...prev, result.student]);
        onNotify?.(`New student created: ${result.student.firstName} ${result.student.surname}`);
        sendEmail(data.email, `Welcome ${data.firstName}!`);
        showToast(`${result.student.firstName} created successfully!`);
        // Return result so modal can show temp password
        return result;
      }
    } catch (e) {
      console.error("❌ Save student error:", e);
      showToast("Could not save student. Please try again.", "error");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDeleteStudent = async (id) => {
    const stu = students.find((s) => s._id === id);
    if (!window.confirm(`Delete ${stu?.firstName} ${stu?.surname}? This cannot be undone.`))
      return;
    try {
      await deleteStudent(id);
      setStudents((prev) => prev.filter((s) => s._id !== id));
      showToast(`${stu?.firstName} deleted.`);
    } catch (e) {
      console.error("❌ Delete error:", e);
      showToast("Could not delete student.", "error");
    }
  };

  // ── Toggle ──────────────────────────────────────────────────────────────────
  const handleToggleAccess = async (id, newState) => {
    try {
      const updated = await toggleStudent(id, { active: newState });
      setStudents((prev) => prev.map((s) => (s._id === id ? updated : s)));
      showToast(`${updated.firstName} ${newState ? "enabled" : "disabled"}.`, "info");
    } catch (e) {
      console.error("❌ Toggle error:", e);
      showToast("Could not update student status.", "error");
    }
  };

  // ── Mark lesson ─────────────────────────────────────────────────────────────
  const handleMarkLesson = (studentId) => {
    const stu = students.find((s) => s._id === studentId);
    if (!stu) return;
    setLessonModal({ mode: "mark", student: stu });
  };

  const handleUnmarkLesson = (studentId) => {
    const stu = students.find((s) => s._id === studentId);
    if (!stu) return;
    setLessonModal({ mode: "unmark", student: stu });
  };

  const handleLessonSuccess = (result) => {
    // Update student in list to reflect new class count
    if (result?.student) {
      setStudents((prev) =>
        prev.map((s) =>
          s._id === lessonModal?.student?._id
            ? { ...s, noOfClasses: result.student.noOfClasses, active: result.student.active }
            : s
        )
      );
    }
    onNotify?.(
      lessonModal?.mode === "mark"
        ? "✅ Lesson marked complete!"
        : "⚠️ Lesson rejected and class restored."
    );
  };

  // ── Manual payment ──────────────────────────────────────────────────────────
  const handleOpenManualPayment = (id) => {
    setSelectedStudent(id);
    setIsManualModalOpen(true);
  };

  const handleSaveManualPayment = async (paymentData) => {
    try {
      const result = await addPayment(paymentData);
      setPaymentHistory((prev) => [...prev, result]);

      // Refresh student classes count
      const studentsData = await getStudents();
      setStudents(studentsData);

      showToast("Payment recorded successfully!");
    } catch (e) {
      console.error("❌ Manual payment error:", e);
      showToast("Could not record payment.", "error");
    }
  };

  // ── View modals ─────────────────────────────────────────────────────────────
  const handleViewPayment = (id) => {
    setSelectedStudent(id);
    setIsPaymentModalOpen(true);
  };

  const handleViewLessons = (id) => {
    setSelectedStudent(id);
    setIsLessonModalOpen(true);
  };

  // ── Reset password ──────────────────────────────────────────────────────────
  const handleResetPassword = async (id) => {
    try {
      const response = await apiResetPassword(id);
      const plainPassword = response.newPassword;
      const stu = students.find((s) => s._id === id);

      setStudents((prev) =>
        prev.map((s) =>
          s._id === id
            ? { ...s, showTempPassword: true, tempPassword: plainPassword }
            : s
        )
      );
      showToast("Password reset. Copy it from the card.", "info");

      if (stu) sendEmail(stu.email, `Password reset: ${plainPassword}`);

      setTimeout(() => {
        setStudents((prev) =>
          prev.map((s) =>
            s._id === id ? { ...s, showTempPassword: false, tempPassword: undefined } : s
          )
        );
      }, PASSWORD_TTL);
    } catch (e) {
      console.error("❌ Reset error:", e);
      showToast("Could not reset password.", "error");
    }
  };

  // ── Copy password ───────────────────────────────────────────────────────────
  const handleCopyPassword = (id) => {
    const stu = students.find((s) => s._id === id);
    if (stu?.tempPassword && navigator.clipboard) {
      navigator.clipboard.writeText(stu.tempPassword);
      showToast("Password copied to clipboard!");
      setStudents((prev) =>
        prev.map((s) =>
          s._id === id ? { ...s, showTempPassword: false, tempPassword: undefined } : s
        )
      );
    }
  };

  // ── Computed values ─────────────────────────────────────────────────────────
  const activeStudents = students.filter((s) => s.active);
  const disabledStudents = students.filter((s) => !s.active);
  const zeroClassStudents = students.filter(
    (s) => s.active && (s.noOfClasses ?? 0) <= 0
  );
  const totalClasses = students.reduce((sum, s) => sum + (s.noOfClasses || 0), 0);

  const sourceList =
    view === "active"
      ? activeStudents
      : view === "disabled"
      ? disabledStudents
      : students;

  const filteredStudents = sourceList.filter((s) =>
    `${s.firstName} ${s.surname} ${s.email}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const selectedStudentObj = students.find((s) => s._id === selectedStudent);

  // ── UI helpers ───────────────────────────────────────────────────────────────
  const base = isDarkMode ? "bg-gray-900" : "bg-gray-50";
  const cardBg = isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const textPrimary = isDarkMode ? "text-white" : "text-gray-900";
  const textSecondary = isDarkMode ? "text-gray-400" : "text-gray-500";
  const inputCls = isDarkMode
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-sky-500 focus:border-sky-500"
    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-sky-500 focus:border-sky-500";

  const tabBtnCls = (key) =>
    view === key
      ? "bg-sky-600 text-white shadow-sm"
      : isDarkMode
      ? "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100";

  return (
    <div className={`min-h-[60vh] ${base} rounded-2xl p-6`}>
      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white transition-all ${
            toastType === "error"
              ? "bg-red-500"
              : toastType === "info"
              ? "bg-sky-500"
              : "bg-emerald-500"
          }`}
        >
          {toastType === "error" ? "✕" : toastType === "info" ? "ℹ" : "✓"} {toast}
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className={`text-2xl font-bold ${textPrimary}`}>Students</h2>
          <p className={`text-sm mt-0.5 ${textSecondary}`}>
            Manage all students on the platform
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Global history shortcuts */}
          <button
            onClick={() => { setSelectedStudent(null); setIsPaymentModalOpen(true); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isDarkMode
                ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            All Payments
          </button>
          <button
            onClick={() => { setSelectedStudent(null); setIsLessonModalOpen(true); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isDarkMode
                ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            All Lessons
          </button>

          <button
            onClick={() => { setEditId(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all duration-150 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          icon={Users}
          label="Total Students"
          value={students.length}
          color="sky"
          isDarkMode={isDarkMode}
        />
        <SummaryCard
          icon={UserCheck}
          label="Active"
          value={activeStudents.length}
          sub={`${disabledStudents.length} disabled`}
          color="emerald"
          isDarkMode={isDarkMode}
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Needs Top-up"
          value={zeroClassStudents.length}
          sub="0 classes remaining"
          color="red"
          isDarkMode={isDarkMode}
        />
        <SummaryCard
          icon={GraduationCap}
          label="Total Classes"
          value={totalClasses}
          sub="across all students"
          color="purple"
          isDarkMode={isDarkMode}
        />
      </div>

      {/* ── Filter bar ── */}
      <div
        className={`rounded-xl border p-4 mb-6 ${cardBg} flex flex-col sm:flex-row gap-3 items-start sm:items-center`}
      >
        {/* View tabs */}
        <div className={`flex gap-1 p-1 rounded-lg ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`}>
          {[
            { key: "all", label: `All (${students.length})` },
            { key: "active", label: `Active (${activeStudents.length})` },
            { key: "disabled", label: `Disabled (${disabledStudents.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${tabBtnCls(key)}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textSecondary}`}
          />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm transition-colors ${inputCls}`}
          />
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className={`text-sm ${textSecondary}`}>Loading students...</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && filteredStudents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isDarkMode ? "bg-gray-800" : "bg-gray-100"
            }`}
          >
            <GraduationCap className={`w-8 h-8 ${textSecondary}`} />
          </div>
          <p className={`text-base font-semibold ${textPrimary}`}>No students found</p>
          <p className={`text-sm ${textSecondary}`}>
            {searchQuery
              ? `No results for "${searchQuery}"`
              : view === "disabled"
              ? "There are no disabled students."
              : "Add your first student to get started."}
          </p>
          {!searchQuery && view === "active" && (
            <button
              onClick={() => { setEditId(null); setIsModalOpen(true); }}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Add First Student
            </button>
          )}
        </div>
      )}

      {/* ── Student card grid ── */}
      {!loading && filteredStudents.length > 0 && (
        <>
          <p className={`text-xs mb-4 ${textSecondary}`}>
            Showing {filteredStudents.length} of {sourceList.length} student
            {sourceList.length !== 1 ? "s" : ""}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredStudents.map((student) => (
              <StudentCard
                key={student._id}
                student={student}
                isDarkMode={isDarkMode}
                onEdit={() => {
                  setEditId(student._id);
                  setIsModalOpen(true);
                }}
                onDelete={() => handleDeleteStudent(student._id)}
                onToggle={() => handleToggleAccess(student._id, !student.active)}
                onMarkLesson={() => handleMarkLesson(student._id)}        
                onUnmarkLesson={() => handleUnmarkLesson(student._id)}
                onManualPayment={() => handleOpenManualPayment(student._id)}
                onViewPayment={() => handleViewPayment(student._id)}
                onViewLessons={() => handleViewLessons(student._id)}
                onResetPassword={() => handleResetPassword(student._id)}
                onCopyPassword={() => handleCopyPassword(student._id)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Modals ── */}

        {lessonModal && (
      <LessonMarkModal
        mode={lessonModal.mode}
        startWith="student"
        student={lessonModal.student}
        onClose={() => setLessonModal(null)}
        onSuccess={handleLessonSuccess}
        isDarkMode={false}
      />
    )}
      <StudentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditId(null);
        }}
        onSave={handleSaveStudent}
        initialData={editId ? students.find((s) => s._id === editId) : null}
      />

      <PaymentHistoryModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        history={
          selectedStudent
            ? paymentHistory.filter((p) => p.studentId === selectedStudent)
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
