// src/pages/admin/tabs/TeachersTab.jsx
import React, { useState, useEffect } from "react";
import {
  Search,
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  DollarSign,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import api from "../../../api";
import TeacherCard from "../components/TeacherCard";
import TeacherModal from "../modals/TeacherModal";
import LessonMarkModal from "../modals/LessonMarkModal"; // ← NEW

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
  const [view, setView] = useState("active"); // "active" | "disabled" | "all"
  const [searchQuery, setSearchQuery] = useState("");
  const [continentFilter, setContinentFilter] = useState("");
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState("success"); // "success" | "error" | "info"
  const [loading, setLoading] = useState(false);

  // ── NEW: Lesson modal state ──────────────────────────────────────────────────
  // Shape: { mode: "mark" | "unmark", teacher: {...} }
  const [lessonModal, setLessonModal] = useState(null);

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = (message, type = "success") => {
    setToast(message);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
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
        setTeachers((prev) => [...prev, res.data]);
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

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (index) => {
    const teacher = teachers[index];
    if (!teacher) return;
    if (!window.confirm(`Delete ${teacher.firstName} ${teacher.lastName}? This cannot be undone.`))
      return;
    try {
      await api.delete(`/api/teachers/${teacher._id}`);
      setTeachers((prev) => prev.filter((_, i) => i !== index));
      showToast(`${teacher.firstName} deleted.`);
    } catch (err) {
      console.error("Delete teacher error:", err);
      showToast("Could not delete teacher.", "error");
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

  // ── NEW: Unmark lesson → opens multi-step modal ─────────────────────────────
  const handleUnmarkLesson = (index) => {
    const teacher = teachers[index];
    if (!teacher) return;
    setLessonModal({ mode: "unmark", teacher });
  };

  // ── Handle lesson modal success ─────────────────────────────────────────────
  const handleLessonSuccess = (result) => {
    // Update teacher earnings/lessons in local state
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
    // Modal stays open showing the "Done" screen — user clicks Done to close it
  };

  // ── Pay teacher ─────────────────────────────────────────────────────────────
  const handlePayTeacher = async (index) => {
    const teacher = teachers[index];
    if (!teacher) return;
    if (!teacher.earned || teacher.earned <= 0) {
      showToast("No payment due for this teacher.", "info");
      return;
    }
    if (!window.confirm(`Pay $${teacher.earned?.toFixed(2)} to ${teacher.firstName} ${teacher.lastName}?`))
      return;
    try {
      const res = await api.put(`/api/teachers/${teacher._id}`, { earned: 0 });
      setTeachers((prev) => prev.map((t, i) => (i === index ? res.data : t)));
      showToast(`$${teacher.earned?.toFixed(2)} paid to ${teacher.firstName}!`);
    } catch (err) {
      console.error("Pay teacher error:", err);
      showToast("Could not process payment.", "error");
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

      // Auto-hide after 15 seconds
      setTimeout(() => {
        setTeachers((prev) =>
          prev.map((t, i) =>
            i === index ? { ...t, showTempPassword: false, password: undefined } : t
          )
        );
      }, 15000);

      console.log(`📧 Send to ${teacher.email}: new password = ${newPass}`);
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
  const activeTeachers = teachers.filter((t) => t.active);
  const disabledTeachers = teachers.filter((t) => !t.active);
  const totalEarned = teachers.reduce((sum, t) => sum + (t.earned || 0), 0);
  const totalLessons = teachers.reduce((sum, t) => sum + (t.lessonsCompleted || 0), 0);

  // ── Filtered teachers ───────────────────────────────────────────────────────
  const sourceList =
    view === "active"
      ? activeTeachers
      : view === "disabled"
      ? disabledTeachers
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
      ? "bg-blue-600 text-white shadow-sm"
      : isDarkMode
      ? "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-[60vh] ${base} rounded-2xl p-6`}>

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

      {/* ── NEW: Lesson Mark / Unmark Modal ── */}
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
        <SummaryCard
          icon={DollarSign}
          label="Pending Payout"
          value={`$${totalEarned.toFixed(2)}`}
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
            { key: "all", label: `All (${teachers.length})` },
            { key: "active", label: `Active (${activeTeachers.length})` },
            { key: "disabled", label: `Disabled (${disabledTeachers.length})` },
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

        {/* Spacer */}
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
            <option value="North America">North America</option>
            <option value="South America">South America</option>
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
          {/* Result count */}
          <p className={`text-xs mb-4 ${textSecondary}`}>
            Showing {filteredTeachers.length} of {sourceList.length} teacher
            {sourceList.length !== 1 ? "s" : ""}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTeachers.map((teacher) => {
              // Resolve real index in the full teachers array (handlers use index)
              const realIndex = teachers.findIndex((t) => t._id === teacher._id);
              return (
                <TeacherCard
                  key={teacher._id || realIndex}
                  teacher={teacher}
                  isDarkMode={isDarkMode}
                  onEdit={() => handleEdit(realIndex)}
                  onDelete={() => handleDelete(realIndex)}
                  onToggle={() => handleToggle(realIndex)}
                  onMarkLesson={() => handleMarkLesson(realIndex)}
                  onUnmarkLesson={() => handleUnmarkLesson(realIndex)} // ← NEW
                  onPay={() => handlePayTeacher(realIndex)}
                  onCopyPassword={() => handleCopyPassword(realIndex)}
                  onResetPassword={() => handleResetPassword(realIndex)}
                />
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
