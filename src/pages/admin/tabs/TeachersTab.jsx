// src/pages/admin/tabs/TeachersTab.jsx
import React, { useState, useEffect } from "react";
import {
  Search,
  Users,
  UserCheck,
  TrendingUp,
  DollarSign,
  Plus,
  SlidersHorizontal,
  Trash2,
  RotateCcw,
  Clock,
  CheckCircle,
} from "lucide-react";
import api from "../../../api";
import { restoreTeacher } from "../../../services/teacherService";
import TeacherCard from "../components/TeacherCard";
import TeacherModal from "../modals/TeacherModal";
import LessonMarkModal from "../modals/LessonMarkModal";
import TeacherPaymentHistoryModal from "../modals/TeacherPaymentHistoryModal";

// ─── Delete confirmation modal ────────────────────────────────────────────────
function DeleteConfirmModal({ teacher, onConfirm, onCancel, isDarkMode }) {
  if (!teacher) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${
          isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              Schedule teacher for deletion?
            </h3>
            <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              This cannot be undone after 7 days
            </p>
          </div>
        </div>

        <div className={`rounded-xl p-4 mb-5 ${isDarkMode ? "bg-red-900/20 border border-red-800/40" : "bg-red-50 border border-red-100"}`}>
          <p className={`text-sm font-semibold mb-1 ${isDarkMode ? "text-red-300" : "text-red-700"}`}>
            What will happen:
          </p>
          <ul className={`text-sm space-y-1 ${isDarkMode ? "text-red-400" : "text-red-600"}`}>
            <li>• Account disabled immediately</li>
            <li>• Teacher receives a warning email</li>
            <li>• Permanently deleted after <strong>7 days</strong></li>
            <li>• You can restore the account within 7 days</li>
          </ul>
        </div>

        <p className={`text-sm mb-5 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
          Are you sure you want to schedule{" "}
          <strong>{teacher.firstName} {teacher.lastName}</strong> for deletion?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              isDarkMode
                ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-all"
          >
            Yes, Schedule Deletion
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pay confirmation modal (single teacher) ─────────────────────────────────
function PayConfirmModal({ teacher, onConfirm, onCancel, isDarkMode }) {
  if (!teacher) return null;
  const amount = (teacher.earned || 0).toFixed(2);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${
          isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              Confirm Payment
            </h3>
            <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              This will reset the teacher's earnings to $0
            </p>
          </div>
        </div>

        <div className={`rounded-xl p-4 mb-5 ${isDarkMode ? "bg-emerald-900/20 border border-emerald-800/40" : "bg-emerald-50 border border-emerald-100"}`}>
          <div className="flex justify-between items-center">
            <span className={`text-sm font-medium ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>
              Teacher
            </span>
            <span className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              {teacher.firstName} {teacher.lastName}
            </span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className={`text-sm font-medium ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>
              Amount to pay
            </span>
            <span className={`text-xl font-bold ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`}>
              ${amount}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              isDarkMode
                ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
          >
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pay all confirmation modal ───────────────────────────────────────────────
function PayAllConfirmModal({ teachers, onConfirm, onCancel, isDarkMode }) {
  if (!teachers) return null;
  const total = teachers.reduce((sum, t) => sum + (t.earned || 0), 0).toFixed(2);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${
          isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              Mark All as Paid
            </h3>
            <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              This will reset earnings to $0 for all teachers below
            </p>
          </div>
        </div>

        <div className={`rounded-xl p-4 mb-4 max-h-52 overflow-y-auto ${isDarkMode ? "bg-gray-900/50 border border-gray-700" : "bg-gray-50 border border-gray-200"}`}>
          {teachers.map((t) => (
            <div key={t._id} className="flex justify-between items-center py-1.5 border-b last:border-0 border-gray-200/30">
              <span className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                {t.firstName} {t.lastName}
              </span>
              <span className={`text-sm font-bold ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`}>
                ${(t.earned || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className={`flex justify-between items-center px-1 mb-5`}>
          <span className={`text-sm font-semibold ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
            Total payout
          </span>
          <span className={`text-xl font-bold ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`}>
            ${total}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              isDarkMode
                ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
          >
            Pay All ${total}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Small summary stat card ──────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, sub, color, isDarkMode }) {
  const colors = {
    blue: {
      bg: isDarkMode ? "bg-blue-900/30" : "bg-blue-50",
      icon: isDarkMode ? "bg-blue-700/60 text-blue-300" : "bg-blue-100 text-blue-600",
      value: isDarkMode ? "text-blue-300" : "text-blue-700",
      border: isDarkMode ? "border-blue-800/40" : "border-blue-100",
    },
    emerald: {
      bg: isDarkMode ? "bg-emerald-900/30" : "bg-emerald-50",
      icon: isDarkMode ? "bg-emerald-700/60 text-emerald-300" : "bg-emerald-100 text-emerald-600",
      value: isDarkMode ? "text-emerald-300" : "text-emerald-700",
      border: isDarkMode ? "border-emerald-800/40" : "border-emerald-100",
    },
    amber: {
      bg: isDarkMode ? "bg-amber-900/30" : "bg-amber-50",
      icon: isDarkMode ? "bg-amber-700/60 text-amber-300" : "bg-amber-100 text-amber-600",
      value: isDarkMode ? "text-amber-300" : "text-amber-700",
      border: isDarkMode ? "border-amber-800/40" : "border-amber-100",
    },
    purple: {
      bg: isDarkMode ? "bg-purple-900/30" : "bg-purple-50",
      icon: isDarkMode ? "bg-purple-700/60 text-purple-300" : "bg-purple-100 text-purple-600",
      value: isDarkMode ? "text-purple-300" : "text-purple-700",
      border: isDarkMode ? "border-purple-800/40" : "border-purple-100",
    },
    red: {
      bg: isDarkMode ? "bg-red-900/30" : "bg-red-50",
      icon: isDarkMode ? "bg-red-700/60 text-red-300" : "bg-red-100 text-red-600",
      value: isDarkMode ? "text-red-300" : "text-red-700",
      border: isDarkMode ? "border-red-800/40" : "border-red-100",
    },
  };
  const c = colors[color] || colors.blue;

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

// ─── Main component ───────────────────────────────────────────────────────────
export default function TeachersTab({ onNotify, isDarkMode = false }) {
  const [teachers, setTeachers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [view, setView] = useState("active"); // "active" | "disabled" | "pending_deletion" | "all"
  const [searchQuery, setSearchQuery] = useState("");
  const [continentFilter, setContinentFilter] = useState("");
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState("success");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [payAllOpen, setPayAllOpen] = useState(false);
  const [payHistoryTeacher, setPayHistoryTeacher] = useState(null);

  const [lessonModal, setLessonModal] = useState(null);

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = (message, type = "success") => {
    setToast(message);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  };

  // ── Days until deletion helper ──────────────────────────────────────────────
  const daysUntilDeletion = (date) => {
    if (!date) return null;
    const diff = new Date(date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // ── Fetch teachers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTeachers = async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/teachers");
        setTeachers(res.data);
      } catch (err) {
        console.error("Error fetching teachers:", err);
        showToast(
          `Could not load teachers: ${err.response?.data?.message || err.message}`,
          "error"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchTeachers();
  }, []);

  // ── Save teacher (create / update) ─────────────────────────────────────────
  const handleSaveTeacher = async (teacherData) => {
    try {
      if (editIndex !== null) {
        const id = teachers[editIndex]._id;
        const res = await api.put(`/api/teachers/${id}`, teacherData);
        setTeachers((prev) => prev.map((t, i) => (i === editIndex ? res.data : t)));
        onNotify?.(`Teacher updated: ${teacherData.firstName} ${teacherData.lastName}`);
        showToast(`${teacherData.firstName} ${teacherData.lastName} updated successfully!`);
      } else {
        const res = await api.post("/api/teachers", teacherData);
        setTeachers((prev) => [...prev, res.data.teacher ?? res.data]);
        onNotify?.(`Teacher created: ${teacherData.firstName} ${teacherData.lastName}`);
        showToast(`${teacherData.firstName} ${teacherData.lastName} added successfully!`);
      }
    } catch (err) {
      console.error("Save teacher error:", err);
      showToast("Could not save teacher. Please try again.", "error");
    } finally {
      setEditIndex(null);
      setIsModalOpen(false);
    }
  };

  // ── Delete — show confirmation modal ───────────────────────────────────────
  const handleDelete = (index) => {
    const teacher = teachers[index];
    if (teacher) setDeleteTarget(teacher);
  };

  // ── Confirm delete — soft-delete via API ───────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await api.delete(`/api/teachers/${deleteTarget._id}`);
      setTeachers((prev) =>
        prev.map((t) => (t._id === deleteTarget._id ? { ...t, ...res.data.teacher } : t))
      );
      showToast(`${deleteTarget.firstName} scheduled for deletion. Warning email sent.`, "info");
      onNotify?.(`Teacher ${deleteTarget.firstName} scheduled for deletion`);
    } catch (err) {
      console.error("Delete teacher error:", err);
      showToast(err.response?.data?.message || "Could not schedule teacher for deletion.", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── Restore teacher ─────────────────────────────────────────────────────────
  const handleRestoreTeacher = async (teacher) => {
    try {
      const res = await restoreTeacher(teacher._id);
      setTeachers((prev) =>
        prev.map((t) => (t._id === teacher._id ? { ...t, ...res.teacher } : t))
      );
      showToast(`${teacher.firstName} ${teacher.lastName} account restored.`);
      onNotify?.(`Teacher ${teacher.firstName} restored`);
    } catch (err) {
      console.error("Restore teacher error:", err);
      showToast(err.response?.data?.message || "Could not restore teacher.", "error");
    }
  };

  // ── Toggle active/disabled ──────────────────────────────────────────────────
  const handleToggle = async (index) => {
    const teacher = teachers[index];
    if (!teacher) return;
    try {
      const res = await api.put(`/api/teachers/${teacher._id}`, {
        active: !teacher.active,
      });
      setTeachers((prev) => prev.map((t, i) => (i === index ? res.data : t)));
      showToast(
        `${teacher.firstName} ${res.data.active ? "enabled" : "disabled"}.`,
        "info"
      );
    } catch (err) {
      console.error("Toggle teacher error:", err);
      showToast("Could not update teacher status.", "error");
    }
  };

  // ── Mark lesson → opens multi-step modal ────────────────────────────────────
  const handleMarkLesson = (index) => {
    const teacher = teachers[index];
    if (!teacher) return;
    setLessonModal({ mode: "mark", teacher });
  };

  const handleUnmarkLesson = (index) => {
    const teacher = teachers[index];
    if (!teacher) return;
    setLessonModal({ mode: "unmark", teacher });
  };

  const handleLessonSuccess = (result) => {
    if (result?.teacher) {
      setTeachers((prev) =>
        prev.map((t) =>
          t._id === lessonModal?.teacher?._id ? { ...t, ...result.teacher } : t
        )
      );
    }
    const msg =
      lessonModal?.mode === "mark"
        ? "✅ Lesson marked complete! Earnings updated."
        : "⚠️ Lesson rejected and reversed.";
    showToast(msg, "info");
  };

  // ── Pay teacher — open modal ────────────────────────────────────────────────
  const handlePayTeacher = (index) => {
    const teacher = teachers[index];
    if (!teacher) return;
    if (!teacher.earned || teacher.earned <= 0) {
      showToast("No payment due for this teacher.", "info");
      return;
    }
    setPayTarget(teacher);
  };

  const handleConfirmPay = async () => {
    if (!payTarget) return;
    const amount = payTarget.earned;
    try {
      const res = await api.put(`/api/teachers/${payTarget._id}`, { earned: 0 });
      setTeachers((prev) => prev.map((t) => (t._id === payTarget._id ? res.data : t)));
      showToast(`$${amount.toFixed(2)} paid to ${payTarget.firstName}!`);
    } catch (err) {
      console.error("Pay teacher error:", err);
      showToast("Could not process payment.", "error");
    } finally {
      setPayTarget(null);
    }
  };

  // ── Mark all as paid ────────────────────────────────────────────────────────
  const unpaidTeachers = teachers.filter((t) => (t.earned || 0) > 0);

  const handleConfirmPayAll = async () => {
    setPayAllOpen(false);
    try {
      const results = await Promise.all(
        unpaidTeachers.map((t) => api.put(`/api/teachers/${t._id}`, { earned: 0 }))
      );
      const updated = results.map((r) => r.data);
      setTeachers((prev) =>
        prev.map((t) => updated.find((u) => u._id === t._id) || t)
      );
      showToast(`${unpaidTeachers.length} teacher${unpaidTeachers.length !== 1 ? "s" : ""} marked as paid!`);
    } catch (err) {
      console.error("Pay all error:", err);
      showToast("Could not complete payment for all teachers.", "error");
    }
  };

  // ── Reset password ──────────────────────────────────────────────────────────
  const handleResetPassword = async (index) => {
    const teacher = teachers[index];
    if (!teacher) return;
    try {
      const newPass = Math.random().toString(36).slice(-8);
      const res = await api.put(`/api/teachers/${teacher._id}`, {
        password: newPass,
      });
      setTeachers((prev) =>
        prev.map((t, i) =>
          i === index
            ? { ...res.data, password: newPass, showTempPassword: true }
            : t
        )
      );
      showToast("Password reset. Copy it from the card.", "info");

      setTimeout(() => {
        setTeachers((prev) =>
          prev.map((t, i) =>
            i === index ? { ...t, showTempPassword: false, password: undefined } : t
          )
        );
      }, 15000);
    } catch (err) {
      console.error("Reset password error:", err);
      showToast("Could not reset password.", "error");
    }
  };

  // ── Copy password ───────────────────────────────────────────────────────────
  const handleCopyPassword = (index) => {
    const teacher = teachers[index];
    if (teacher?.password && navigator.clipboard) {
      navigator.clipboard.writeText(teacher.password);
      showToast("Password copied to clipboard!");
      setTeachers((prev) =>
        prev.map((t, i) =>
          i === index ? { ...t, showTempPassword: false, password: undefined } : t
        )
      );
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const handleEdit = (index) => {
    setEditIndex(index);
    setIsModalOpen(true);
  };

  // ── Computed stats ──────────────────────────────────────────────────────────
  const activeTeachers = teachers.filter((t) => t.active && !t.scheduledDeletionAt);
  const disabledTeachers = teachers.filter((t) => !t.active && !t.scheduledDeletionAt);
  const pendingDeletionTeachers = teachers.filter((t) => !!t.scheduledDeletionAt);
  const totalEarned = teachers.reduce((sum, t) => sum + (t.earned || 0), 0);
  const totalLessons = teachers.reduce((sum, t) => sum + (t.lessonsCompleted || 0), 0);

  // ── Filtered teachers ───────────────────────────────────────────────────────
  const sourceList =
    view === "active"
      ? activeTeachers
      : view === "disabled"
      ? disabledTeachers
      : view === "pending_deletion"
      ? pendingDeletionTeachers
      : teachers;

  const filteredTeachers = sourceList.filter((t) => {
    const matchesSearch = `${t.firstName} ${t.lastName} ${t.email}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesContinent =
      continentFilter === "" || t.continent === continentFilter;
    return matchesSearch && matchesContinent;
  });

  // ── UI helpers ──────────────────────────────────────────────────────────────
  const base = isDarkMode ? "bg-gray-900" : "bg-gray-50";
  const cardBg = isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const textPrimary = isDarkMode ? "text-white" : "text-gray-900";
  const textSecondary = isDarkMode ? "text-gray-400" : "text-gray-500";
  const inputCls = isDarkMode
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500";
  const selectCls = isDarkMode
    ? "bg-gray-700 border-gray-600 text-white focus:ring-blue-500"
    : "bg-white border-gray-300 text-gray-900 focus:ring-blue-500";

  const tabBtnCls = (key) =>
    view === key
      ? key === "pending_deletion"
        ? "bg-red-600 text-white shadow-sm"
        : "bg-blue-600 text-white shadow-sm"
      : isDarkMode
      ? "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-[60vh] ${base} rounded-2xl p-6`}>

      {/* ── Delete confirm modal ── */}
      <DeleteConfirmModal
        teacher={deleteTarget}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDarkMode={isDarkMode}
      />

      {/* ── Pay confirm modal (single) ── */}
      <PayConfirmModal
        teacher={payTarget}
        onConfirm={handleConfirmPay}
        onCancel={() => setPayTarget(null)}
        isDarkMode={isDarkMode}
      />

      {/* ── Pay all confirm modal ── */}
      {payAllOpen && (
        <PayAllConfirmModal
          teachers={unpaidTeachers}
          onConfirm={handleConfirmPayAll}
          onCancel={() => setPayAllOpen(false)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* ── Teacher payment history modal ── */}
      {payHistoryTeacher && (
        <TeacherPaymentHistoryModal
          teacher={payHistoryTeacher}
          onClose={() => setPayHistoryTeacher(null)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white transition-all ${
            toastType === "error"
              ? "bg-red-500"
              : toastType === "info"
              ? "bg-blue-500"
              : "bg-emerald-500"
          }`}
        >
          {toastType === "error" ? "✕" : toastType === "info" ? "ℹ" : "✓"} {toast}
        </div>
      )}

      {/* ── Lesson Mark / Unmark Modal ── */}
      {lessonModal && (
        <LessonMarkModal
          mode={lessonModal.mode}
          startWith="teacher"
          teacher={lessonModal.teacher}
          onClose={() => setLessonModal(null)}
          onSuccess={handleLessonSuccess}
          isDarkMode={isDarkMode}
        />
      )}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className={`text-2xl font-bold ${textPrimary}`}>Teachers</h2>
          <p className={`text-sm mt-0.5 ${textSecondary}`}>
            Manage all teachers on the platform
          </p>
        </div>
        <button
          onClick={() => {
            setEditIndex(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all duration-150 active:scale-95 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Teacher
        </button>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          icon={Users}
          label="Total Teachers"
          value={teachers.length}
          color="blue"
          isDarkMode={isDarkMode}
        />
        <SummaryCard
          icon={UserCheck}
          label="Active"
          value={activeTeachers.length}
          sub={`${disabledTeachers.length} disabled`}
          color="emerald"
          isDarkMode={isDarkMode}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Total Lessons"
          value={totalLessons}
          color="amber"
          isDarkMode={isDarkMode}
        />

        {/* Pending Payout card with Mark All as Paid button */}
        <div className={`rounded-xl border p-4 flex items-center gap-4 ${isDarkMode ? "bg-purple-900/30 border-purple-800/40" : "bg-purple-50 border-purple-100"}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-purple-700/60 text-purple-300" : "bg-purple-100 text-purple-600"}`}>
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              Pending Payout
            </p>
            <p className={`text-xl font-bold ${isDarkMode ? "text-purple-300" : "text-purple-700"}`}>
              ${totalEarned.toFixed(2)}
            </p>
            {unpaidTeachers.length > 0 && (
              <button
                onClick={() => setPayAllOpen(true)}
                className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <CheckCircle className="w-3 h-3" />
                Mark all as paid
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div
        className={`rounded-xl border p-4 mb-6 ${cardBg} flex flex-col sm:flex-row gap-3 items-start sm:items-center`}
      >
        {/* View tabs */}
        <div className={`flex gap-1 p-1 rounded-lg flex-wrap ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`}>
          {[
            { key: "all", label: `All (${teachers.length})` },
            { key: "active", label: `Active (${activeTeachers.length})` },
            { key: "disabled", label: `Disabled (${disabledTeachers.length})` },
            {
              key: "pending_deletion",
              label: `Pending Deletion (${pendingDeletionTeachers.length})`,
            },
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
        <div className="relative w-full sm:w-56">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textSecondary}`}
          />
          <input
            type="text"
            placeholder="Search teachers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm transition-colors ${inputCls}`}
          />
        </div>

        {/* Continent filter */}
        <div className="relative">
          <SlidersHorizontal
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textSecondary}`}
          />
          <select
            value={continentFilter}
            onChange={(e) => setContinentFilter(e.target.value)}
            className={`pl-9 pr-3 py-2 rounded-lg border text-sm transition-colors appearance-none ${selectCls}`}
          >
            <option value="">All Continents</option>
            <option value="Africa">Africa</option>
            <option value="Europe">Europe</option>
            <option value="Asia">Asia</option>
            <option value="Americas">Americas</option>
            <option value="Oceania">Oceania</option>
          </select>
        </div>
      </div>

      {/* ── Loading state ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className={`text-sm ${textSecondary}`}>Loading teachers...</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && filteredTeachers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isDarkMode ? "bg-gray-800" : "bg-gray-100"
            }`}
          >
            <Users className={`w-8 h-8 ${textSecondary}`} />
          </div>
          <p className={`text-base font-semibold ${textPrimary}`}>No teachers found</p>
          <p className={`text-sm ${textSecondary}`}>
            {searchQuery || continentFilter
              ? "Try adjusting your search or filters."
              : view === "disabled"
              ? "There are no disabled teachers."
              : view === "pending_deletion"
              ? "No teachers are pending deletion."
              : "Add your first teacher to get started."}
          </p>
          {!searchQuery && !continentFilter && view === "active" && (
            <button
              onClick={() => {
                setEditIndex(null);
                setIsModalOpen(true);
              }}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Add First Teacher
            </button>
          )}
        </div>
      )}

      {/* ── Teacher card grid ── */}
      {!loading && filteredTeachers.length > 0 && (
        <>
          <p className={`text-xs mb-4 ${textSecondary}`}>
            Showing {filteredTeachers.length} of {sourceList.length} teacher
            {sourceList.length !== 1 ? "s" : ""}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTeachers.map((teacher) => {
              const realIndex = teachers.findIndex((t) => t._id === teacher._id);
              const days = daysUntilDeletion(teacher.scheduledDeletionAt);

              return (
                <div key={teacher._id} className="relative">
                  {/* Pending-deletion countdown banner */}
                  {teacher.scheduledDeletionAt && (
                    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-2 px-3 py-2 bg-red-600 rounded-t-xl text-white text-xs font-semibold">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Deleted in {days} day{days !== 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={() => handleRestoreTeacher(teacher)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </button>
                    </div>
                  )}

                  <div className={teacher.scheduledDeletionAt ? "mt-9" : ""}>
                    <TeacherCard
                      teacher={teacher}
                      isDarkMode={isDarkMode}
                      onEdit={() => handleEdit(realIndex)}
                      onDelete={() => handleDelete(realIndex)}
                      onToggle={() => handleToggle(realIndex)}
                      onMarkLesson={() => handleMarkLesson(realIndex)}
                      onUnmarkLesson={() => handleUnmarkLesson(realIndex)}
                      onPay={() => handlePayTeacher(realIndex)}
                      onCopyPassword={() => handleCopyPassword(realIndex)}
                      onResetPassword={() => handleResetPassword(realIndex)}
                      onPayHistory={() => setPayHistoryTeacher(teacher)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Teacher create / edit modal ── */}
      <TeacherModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditIndex(null);
        }}
        onSave={handleSaveTeacher}
        initialData={editIndex !== null ? teachers[editIndex] : null}
      />
    </div>
  );
}
