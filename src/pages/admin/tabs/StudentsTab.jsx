// src/pages/admin/tabs/StudentsTab.jsx
import React, { useState, useEffect } from "react";
import {
  Search,
  Users,
  UserCheck,
  AlertTriangle,
  GraduationCap,
  Plus,
  BookOpen,
  Receipt,
  Trash2,
  RotateCcw,
  Clock,
  Download,
  BadgeCheck,
  UserCog,
  Info,
} from "lucide-react";
import { downloadStudentRoster } from "../../../utils/studentPdf";
import api from "../../../api";
import Pagination from "../../../components/Pagination";
import StudentCard from "../components/StudentCard";
import StudentModal from "../modals/StudentModal";
import ManagedStudentModal from "../modals/ManagedStudentModal";
import PaymentHistoryModal from "../modals/PaymentHistoryModal";
import ManualPaymentModal from "../modals/ManualPaymentModal";
import LessonHistoryModal from "../modals/LessonHistoryModal";
import LessonMarkModal from "../modals/LessonMarkModal";

import {
  getStudents,
  createStudent,
  createManagedStudent,
  convertManagedStudent,
  updateStudent,
  deleteStudent,
  restoreStudent,
  toggleStudent,
  recordLesson,
  apiResetPassword,
  resendStudentInvite,
  addPayment,
  getAllPayments,
  getAllLessons,
} from "../../../services/studentService";

const PASSWORD_TTL = 15000;
const ACCOUNT_TYPE_KEY = "admin.students.accountType";

function readAccountType() {
  try { return localStorage.getItem(ACCOUNT_TYPE_KEY) === "managed" ? "managed" : "real"; }
  catch { return "real"; }
}

// ── Days remaining until deletion ────────────────────────────────────────────
function daysUntilDeletion(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteConfirmModal({ student, onConfirm, onCancel, isDarkMode }) {
  if (!student) return null;

  const overlay = "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm";
  const box = isDarkMode
    ? "bg-gray-800 border border-gray-700 text-white"
    : "bg-white border border-gray-200 text-gray-900";

  return (
    <div className={overlay}>
      <div className={`rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 ${box}`}>
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-red-600" />
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-xl font-bold text-center mb-2">Schedule Account Deletion?</h2>
        <p className={`text-center text-sm mb-5 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
          You are about to schedule{" "}
          <span className="font-semibold text-red-500">
            {student.firstName} {student.lastName}
          </span>{" "}
          for deletion.
        </p>

        {/* Info box */}
        <div className={`rounded-xl p-4 mb-5 text-sm space-y-2 ${isDarkMode ? "bg-red-900/20 border border-red-800/40" : "bg-red-50 border border-red-100"}`}>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <span className={isDarkMode ? "text-red-300" : "text-red-700"}>
              The account will be <strong>disabled immediately</strong> and permanently deleted after{" "}
              <strong>7 days</strong>.
            </span>
          </div>
          {!student.isManaged && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span className={isDarkMode ? "text-amber-300" : "text-amber-700"}>
                A warning email will be sent to <strong>{student.email}</strong> telling them to contact
                admin if this is a mistake.
              </span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <RotateCcw className="w-4 h-4 text-sky-500 mt-0.5 flex-shrink-0" />
            <span className={isDarkMode ? "text-sky-300" : "text-sky-700"}>
              You can <strong>restore</strong> the account any time within those 7 days.
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              isDarkMode
                ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-red-600 hover:bg-red-700 text-white transition-all"
          >
            Schedule Deletion
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Convert managed → student account modal ───────────────────────────────────
function ConvertModal({ student, onConfirm, onCancel, isDarkMode }) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setEmail(""); setError(""); setSaving(false); }, [student]);

  if (!student) return null;

  const box = isDarkMode
    ? "bg-gray-800 border border-gray-700 text-white"
    : "bg-white border border-gray-200 text-gray-900";
  const muted = isDarkMode ? "text-gray-400" : "text-gray-500";

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const err = await onConfirm(email.trim());
    if (err) { setError(err); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <form onSubmit={submit} className={`rounded-2xl shadow-2xl p-6 w-full max-w-md ${box}`}>
        <h2 className="text-lg font-bold mb-1">Give {student.firstName} login access</h2>
        <p className={`text-sm mb-4 ${muted}`}>
          {student.firstName} becomes a regular student account and gets an invite email to set a password.
          Classes, bookings, teachers and credits stay exactly as they are.
        </p>

        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${muted}`}>
          Student's email
        </label>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@email.com"
          className={`w-full px-3 py-2.5 rounded-xl border text-sm ${
            isDarkMode ? "bg-gray-900 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
          }`}
        />
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm ${
              isDarkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white"
          >
            {saving ? "Sending…" : "Send Invite"}
          </button>
        </div>
      </form>
    </div>
  );
}

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
  const [deleteTarget, setDeleteTarget] = useState(null); // student scheduled for deletion confirm
  const [convertTarget, setConvertTarget] = useState(null); // managed student getting login access
  const [lessonModal, setLessonModal] = useState(null);

  // History data
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [lessonHistory, setLessonHistory] = useState([]);

  // Account type — real (invited, logs in) vs managed (admin-run, no login)
  const [preferredType, setAccountTypeState] = useState(readAccountType);
  // Which student types the center's plan allows creating (from /center/config)
  const [studentModes, setStudentModes] = useState(null);
  const setAccountType = (type) => {
    setAccountTypeState(type);
    try { localStorage.setItem(ACCOUNT_TYPE_KEY, type); } catch { /* storage unavailable */ }
  };
  const [isManagedModalOpen, setIsManagedModalOpen] = useState(false);

  // Filters
  const [view, setView] = useState("active"); // "active" | "disabled" | "pending_deletion" | "all"
  const [searchQuery, setSearchQuery] = useState("");

  // Toast
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState("success");

  const showToast = (message, type = "success") => {
    setToast(message);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  };

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [studentsData, paymentsData, lessonsData, centerConfig] = await Promise.all([
          getStudents(),
          getAllPayments(),
          getAllLessons(),
          // UI hint only — the server enforces the plan, so fall back to showing both
          api.get("/center/config").then((r) => r.data).catch(() => null),
        ]);

        setStudents(studentsData);
        setStudentModes(centerConfig?.center?.studentModes || { real: true, managed: true });

        const formattedPayments = paymentsData
          .filter((p) => p.studentId !== null)
          .map((p) => ({
            ...p,
            studentId: p.studentId._id,
            student: `${p.studentId.firstName} ${p.studentId.lastName}`,
            amountDisplay: `₦${p.amount}`,
          }));
        setPaymentHistory(formattedPayments);

        const formattedLessons = lessonsData
          .filter((l) => l.studentId !== null)
          .map((l) => ({
            ...l,
            studentId: l.studentId._id,
            student: `${l.studentId.firstName} ${l.studentId.lastName}`,
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
        onNotify?.(`Student updated: ${updated.firstName} ${updated.lastName}`);
        showToast(`${updated.firstName} updated successfully!`);
        setEditId(null);
        setIsModalOpen(false);
      } else {
        const result = await createStudent(data);
        setStudents((prev) => [...prev, result.student]);
        onNotify?.(`New student created: ${result.student.firstName} ${result.student.lastName}`);
        showToast(`${result.student.firstName} created successfully!`);
        return result;
      }
    } catch (e) {
      console.error("❌ Save student error:", e);
      showToast(e.response?.data?.message || "Could not save student. Please try again.", "error");
    }
  };

  // ── Save managed student (create / update) — returns false to keep modal open
  const handleSaveManaged = async (data) => {
    try {
      if (editId) {
        const updated = await updateStudent(editId, data);
        setStudents((prev) => prev.map((s) => (s._id === editId ? updated : s)));
        showToast(`${updated.firstName} updated successfully!`);
        setEditId(null);
      } else {
        const result = await createManagedStudent(data);
        setStudents((prev) => [result.student, ...prev]);
        onNotify?.(`Managed student created: ${result.student.firstName} ${result.student.lastName}`.trim());
        showToast(`${result.student.firstName} created — ready to assign.`);
      }
      return true;
    } catch (e) {
      console.error("❌ Save managed student error:", e);
      showToast(e.response?.data?.message || "Could not save managed student.", "error");
      return false;
    }
  };

  const openCreate = () => {
    setEditId(null);
    if (accountType === "managed") setIsManagedModalOpen(true);
    else setIsModalOpen(true);
  };

  // ── Delete (open confirmation modal) ────────────────────────────────────────
  const handleDeleteStudent = (id) => {
    const stu = students.find((s) => s._id === id);
    setDeleteTarget(stu);
  };

  // ── Convert managed → student account. Returns an error message to show in the modal.
  const handleConfirmConvert = async (email) => {
    try {
      const result = await convertManagedStudent(convertTarget._id, email);
      setStudents((prev) => prev.map((s) => (s._id === convertTarget._id ? { ...s, ...result.student } : s)));
      showToast(`${convertTarget.firstName} moved to Student Accounts. ${result.message}`, result.emailSent ? "success" : "info");
      onNotify?.(`${convertTarget.firstName} converted to a student account.`);
      setConvertTarget(null);
      return null;
    } catch (e) {
      return e.response?.data?.message || "Could not convert student. Please try again.";
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const result = await deleteStudent(deleteTarget._id);
      // Update student in list to reflect scheduled deletion state
      setStudents((prev) =>
        prev.map((s) =>
          s._id === deleteTarget._id
            ? { ...s, active: false, scheduledDeletionAt: result.scheduledDeletionAt }
            : s
        )
      );
      showToast(
        `${deleteTarget.firstName} scheduled for deletion in 7 days.${deleteTarget.isManaged ? "" : " Warning email sent."}`,
        "info"
      );
      onNotify?.(`${deleteTarget.firstName} scheduled for deletion.`);
    } catch (e) {
      console.error("❌ Delete error:", e);
      showToast(e.response?.data?.message || "Could not schedule deletion.", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── Restore student ──────────────────────────────────────────────────────────
  const handleRestoreStudent = async (id) => {
    const stu = students.find((s) => s._id === id);
    try {
      const result = await restoreStudent(id);
      setStudents((prev) =>
        prev.map((s) =>
          s._id === id
            ? { ...s, active: true, scheduledDeletionAt: null, deletionWarningEmailSent: false }
            : s
        )
      );
      showToast(`${stu?.firstName}'s account has been restored!`, "success");
      onNotify?.(`${stu?.firstName} restored.`);
    } catch (e) {
      console.error("❌ Restore error:", e);
      showToast("Could not restore student.", "error");
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
    if (result?.student) {
      setStudents((prev) =>
        prev.map((s) =>
          s._id === lessonModal?.student?._id
            ? { ...s, classCredits: result.student.classCredits, active: result.student.active }
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
      if (!selectedStudent) {
        showToast("No student selected", "error");
        return;
      }
      const result = await addPayment(selectedStudent, paymentData);
      // Format the new payment the same way as the initial load so filters work
      const stu = selectedStudentObj;
      const newEntry = {
        ...result.payment,
        studentId: selectedStudent,
        student: stu ? `${stu.firstName} ${stu.lastName}` : "Unknown",
        amountDisplay: `₦${result.payment?.amount ?? paymentData.amount}`,
      };
      setPaymentHistory((prev) => [...prev, newEntry]);
      setIsManualModalOpen(false);
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

  // ── Resend invite ───────────────────────────────────────────────────────────
  const handleResendInvite = async (id) => {
    try {
      await resendStudentInvite(id);
      showToast("Invite email resent successfully.", "success");
    } catch (e) {
      showToast("Could not resend invite. Please try again.", "error");
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
  const realCount  = students.filter((s) => !s.isManaged).length;
  const managedCount = students.length - realCount;

  // A type is shown if the plan allows it, or if the center already has students of
  // that type (e.g. after a downgrade) — those keep working but no new ones can be added.
  const modes = studentModes || { real: true, managed: true };
  const visibleTypes = [
    (modes.real    || realCount    > 0) && "real",
    (modes.managed || managedCount > 0) && "managed",
  ].filter(Boolean);
  const accountType = visibleTypes.includes(preferredType) ? preferredType : visibleTypes[0];
  const canCreate   = modes[accountType];

  // Shown under the tabs when the plan leaves one student type out entirely
  const hiddenModeNote = !studentModes || visibleTypes.length > 1 ? null
    : !visibleTypes.includes("real")
    ? "Want students to log in with their own username and password? Student accounts are available on the Pro and Enterprise plans. Contact your platform admin to upgrade."
    : !visibleTypes.includes("managed")
    ? "Need students without a login, managed by you? Managed students are available on the Basic and Enterprise plans. Contact your platform admin to change your plan."
    : null;

  const typedStudents = students.filter((s) => (accountType === "managed" ? s.isManaged : !s.isManaged));

  const pendingDeletion = typedStudents.filter((s) => !!s.scheduledDeletionAt);
  const activeStudents = typedStudents.filter((s) => s.active && !s.scheduledDeletionAt);
  const disabledStudents = typedStudents.filter((s) => !s.active && !s.scheduledDeletionAt);
  const zeroClassStudents = typedStudents.filter((s) => s.active && (s.classCredits ?? 0) <= 0);
  const totalClasses = typedStudents.reduce((sum, s) => sum + (s.classCredits || 0), 0);

  const sourceList =
    view === "active"
      ? activeStudents
      : view === "disabled"
      ? disabledStudents
      : view === "pending_deletion"
      ? pendingDeletion
      : typedStudents;

  const filteredStudents = sourceList.filter((s) =>
    `${s.firstName} ${s.lastName} ${s.email} ${s.studentId || ""}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // ── Pagination ───────────────────────────────────────────────────────────────
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const totalPages    = Math.ceil(filteredStudents.length / PAGE_SIZE);
  const pagedStudents = filteredStudents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [searchQuery, view, accountType]);

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
      ? key === "pending_deletion"
        ? "bg-red-600 text-white shadow-sm"
        : "bg-sky-600 text-white shadow-sm"
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

      {/* ── Delete confirmation modal ── */}
      <DeleteConfirmModal
        student={deleteTarget}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDarkMode={isDarkMode}
      />

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className={`text-2xl font-bold ${textPrimary}`}>Students</h2>
          <p className={`text-sm mt-0.5 ${textSecondary}`}>
            Manage all students on the platform
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
            onClick={() => downloadStudentRoster(filteredStudents).catch(console.error)}
            title="Download visible students as PDF"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isDarkMode
                ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>

          {canCreate && (
            <button
              onClick={openCreate}
              className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-semibold text-sm shadow-md transition-all duration-150 active:scale-95 ${
                accountType === "managed" ? "bg-amber-500 hover:bg-amber-600" : "bg-sky-600 hover:bg-sky-700"
              }`}
            >
              <Plus className="w-4 h-4" />
              {accountType === "managed" ? "Add Managed Student" : "Add Student"}
            </button>
          )}
        </div>
      </div>

      {/* ── Plan notice: existing students of a type the plan no longer includes ── */}
      {!canCreate && studentModes && (
        <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 mb-6 text-sm ${
          isDarkMode ? "bg-amber-900/20 border-amber-800/40 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-800"
        }`}>
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            Your plan doesn't include {accountType === "managed" ? "managed students" : "student accounts"}.
            The students below keep working, but you can't add new ones. Contact your platform admin to upgrade.
          </span>
        </div>
      )}

      {/* ── Account type tabs: only the types this plan shows (Basic → managed, Pro → real, Enterprise → both) ── */}
      <div
        role="tablist"
        aria-label="Student account type"
        className={`grid gap-1 p-1 rounded-xl ${
          visibleTypes.length > 1 ? "grid-cols-2 max-w-md" : "grid-cols-1 max-w-[15rem]"
        } ${hiddenModeNote ? "mb-3" : "mb-6"} ${isDarkMode ? "bg-gray-800" : "bg-gray-200/70"}`}
      >
        {[
          { key: "real",  icon: BadgeCheck, label: "Student Accounts", count: realCount,    hint: "Log in themselves" },
          { key: "managed", icon: UserCog,    label: "Managed Students", count: managedCount, hint: "No login · run by admin" },
        ].filter(({ key }) => visibleTypes.includes(key)).map(({ key, icon: Icon, label, count, hint }) => {
          const selected = accountType === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={selected}
              onClick={() => setAccountType(key)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${
                selected
                  ? isDarkMode ? "bg-gray-900 shadow-sm" : "bg-white shadow-sm"
                  : isDarkMode ? "hover:bg-gray-700/60" : "hover:bg-white/60"
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${
                selected ? (key === "managed" ? "text-amber-500" : "text-sky-500") : textSecondary
              }`} />
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${selected ? textPrimary : textSecondary}`}>
                  {label} <span className="font-normal opacity-70">({count})</span>
                </span>
                <span className={`block text-[11px] ${textSecondary}`}>{hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Upgrade hint for the student type this plan leaves out ── */}
      {hiddenModeNote && (
        <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 mb-6 text-sm max-w-2xl ${
          isDarkMode ? "bg-sky-900/20 border-sky-800/40 text-sky-200" : "bg-sky-50 border-sky-200 text-sky-800"
        }`}>
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{hiddenModeNote}</span>
        </div>
      )}

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          icon={Users}
          label={accountType === "managed" ? "Managed Students" : "Total Students"}
          value={typedStudents.length}
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
        <div className={`flex gap-1 p-1 rounded-lg flex-wrap ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`}>
          {[
            { key: "all",             label: `All (${typedStudents.length})` },
            { key: "active",          label: `Active (${activeStudents.length})` },
            { key: "disabled",        label: `Disabled (${disabledStudents.length})` },
            { key: "pending_deletion", label: `🗑 Pending Deletion (${pendingDeletion.length})` },
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
              : view === "pending_deletion"
              ? "No students scheduled for deletion."
              : accountType === "managed"
              ? "Managed students have no login — just a name you can assign to teachers and book classes for."
              : "Add your first student to get started."}
          </p>
          {!searchQuery && view === "active" && canCreate && (
            <button
              onClick={openCreate}
              className={`mt-2 flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-semibold transition-all ${
                accountType === "managed" ? "bg-amber-500 hover:bg-amber-600" : "bg-sky-600 hover:bg-sky-700"
              }`}
            >
              <Plus className="w-4 h-4" />
              {accountType === "managed" ? "Add First Managed Student" : "Add First Student"}
            </button>
          )}
        </div>
      )}

      {/* ── Student card grid ── */}
      {!loading && filteredStudents.length > 0 && (
        <>
          <p className={`text-xs mb-4 ${textSecondary}`}>
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filteredStudents.length)}–{Math.min(page * PAGE_SIZE, filteredStudents.length)} of {filteredStudents.length} student
            {filteredStudents.length !== 1 ? "s" : ""}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pagedStudents.map((student) => {
              const days = daysUntilDeletion(student.scheduledDeletionAt);
              const isPendingDeletion = days !== null;

              return (
                <div key={student._id} className="relative">
                  {/* ── Deletion countdown banner ── */}
                  {isPendingDeletion && (
                    <div className="absolute -top-2 left-2 right-2 z-10 flex items-center justify-between gap-2 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Deletes in {days} day{days !== 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={() => handleRestoreStudent(student._id)}
                        className="flex items-center gap-1 bg-white text-red-600 px-2 py-0.5 rounded-md text-xs font-bold hover:bg-red-50 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </button>
                    </div>
                  )}

                  <div className={isPendingDeletion ? "mt-5 opacity-75 ring-2 ring-red-400 rounded-xl" : ""}>
                    <StudentCard
                      student={student}
                      isDarkMode={isDarkMode}
                      onEdit={() => {
                        setEditId(student._id);
                        if (student.isManaged) setIsManagedModalOpen(true);
                        else setIsModalOpen(true);
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
                      onResendInvite={() => handleResendInvite(student._id)}
                      onConvert={modes.real ? () => setConvertTarget(student) : undefined}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={filteredStudents.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
            isDarkMode={isDarkMode}
          />
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
          isDarkMode={isDarkMode}
        />
      )}

      <ConvertModal
        student={convertTarget}
        onConfirm={handleConfirmConvert}
        onCancel={() => setConvertTarget(null)}
        isDarkMode={isDarkMode}
      />

      <ManagedStudentModal
        isOpen={isManagedModalOpen}
        onClose={() => {
          setIsManagedModalOpen(false);
          setEditId(null);
        }}
        onSave={handleSaveManaged}
        initialData={editId ? students.find((s) => s._id === editId) : null}
        isDarkMode={isDarkMode}
      />

      <StudentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditId(null);
        }}
        onSave={handleSaveStudent}
        initialData={editId ? students.find((s) => s._id === editId) : null}
        isDarkMode={isDarkMode}
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
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
