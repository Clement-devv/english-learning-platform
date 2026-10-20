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
  Download,
} from "lucide-react";
import api from "../../../api";
import { useCurrencySymbol, fmtMoney } from "../../../hooks/useCurrencySymbol";
import { restoreTeacher } from "../../../services/teacherService";
import { downloadTeacherRoster } from "../../../utils/teacherPdf";
import TeacherCard from "../components/TeacherCard";
import TeacherModal from "../modals/TeacherModal";
import Pagination from "../../../components/Pagination";
import LessonMarkModal from "../modals/LessonMarkModal";
import TeacherPaymentHistoryModal from "../modals/TeacherPaymentHistoryModal";
import { useTranslation } from "react-i18next";

// ─── Delete confirmation modal ────────────────────────────────────────────────
function DeleteConfirmModal({ teacher, onConfirm, onCancel, isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  if (!teacher) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${
          isDarkMode ? "bg-stone-800 border border-stone-700" : "bg-white"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-stone-900"}`}>
              {tr("teachersTab.scheduleTeacherForDeletion")}
            </h3>
            <p className={`text-sm ${isDarkMode ? "text-stone-400" : "text-stone-500"}`}>
              {tr("teachersTab.thisCannotBeUndoneAfter")}
            </p>
          </div>
        </div>

        <div className={`rounded-xl p-4 mb-5 ${isDarkMode ? "bg-red-900/20 border border-red-800/40" : "bg-red-50 border border-red-100"}`}>
          <p className={`text-sm font-semibold mb-1 ${isDarkMode ? "text-red-300" : "text-red-700"}`}>
            {tr("teachersTab.whatWillHappen")}
          </p>
          <ul className={`text-sm space-y-1 ${isDarkMode ? "text-red-400" : "text-red-600"}`}>
            <li>{tr("teachersTab.accountDisabledImmediately")}</li>
            <li>{tr("teachersTab.teacherReceivesAWarningEmail")}</li>
            <li>{tr("teachersTab.permanentlyDeletedAfter")} <strong>{tr("teachersTab.t7Days")}</strong></li>
            <li>{tr("teachersTab.youCanRestoreTheAccount")}</li>
          </ul>
        </div>

        <p className={`text-sm mb-5 ${isDarkMode ? "text-stone-300" : "text-stone-600"}`}>
          {tr("teachersTab.areYouSureYouWant")}{" "}
          <strong>{teacher.firstName} {teacher.lastName}</strong> {tr("teachersTab.forDeletion")}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
              isDarkMode
                ? "border-stone-600 text-stone-300 hover:bg-stone-700"
                : "border-stone-300 text-stone-700 hover:bg-stone-50"
            }`}
          >
            {tr("teachersTab.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition"
          >
            {tr("teachersTab.yesScheduleDeletion")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pay confirmation modal (single teacher) ─────────────────────────────────
function PayConfirmModal({ teacher, onConfirm, onCancel, isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
  if (!teacher) return null;
  const amount = (teacher.earned || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${
          isDarkMode ? "bg-stone-800 border border-stone-700" : "bg-white"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-stone-900"}`}>
              {tr("teachersTab.confirmPayment")}
            </h3>
            <p className={`text-sm ${isDarkMode ? "text-stone-400" : "text-stone-500"}`}>
              {tr("teachersTab.thisWillResetTheTeacher")}
            </p>
          </div>
        </div>

        <div className={`rounded-xl p-4 mb-5 ${isDarkMode ? "bg-emerald-900/20 border border-emerald-800/40" : "bg-emerald-50 border border-emerald-100"}`}>
          <div className="flex justify-between items-center">
            <span className={`text-sm font-medium ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>
              {tr("teachersTab.teacher")}
            </span>
            <span className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-stone-900"}`}>
              {teacher.displayName?.trim() || `${teacher.firstName} ${teacher.lastName}`}
            </span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className={`text-sm font-medium ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>
              {tr("teachersTab.amountToPay")}
            </span>
            <span className={`text-xl font-bold ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`}>
              {sym}{amount}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
              isDarkMode
                ? "border-stone-600 text-stone-300 hover:bg-stone-700"
                : "border-stone-300 text-stone-700 hover:bg-stone-50"
            }`}
          >
            {tr("teachersTab.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
          >
            {tr("teachersTab.confirmPayment")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pay all confirmation modal ───────────────────────────────────────────────
function PayAllConfirmModal({ teachers, onConfirm, onCancel, isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
  if (!teachers) return null;
  const total = teachers.reduce((sum, t) => sum + (t.earned || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${
          isDarkMode ? "bg-stone-800 border border-stone-700" : "bg-white"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-stone-900"}`}>
              {tr("teachersTab.markAllAsPaid")}
            </h3>
            <p className={`text-sm ${isDarkMode ? "text-stone-400" : "text-stone-500"}`}>
              {tr("teachersTab.thisWillResetEarningsTo")}
            </p>
          </div>
        </div>

        <div className={`rounded-xl p-4 mb-4 max-h-52 overflow-y-auto ${isDarkMode ? "bg-stone-900/50 border border-stone-700" : "bg-stone-50 border border-stone-200"}`}>
          {teachers.map((t) => (
            <div key={t._id} className="flex justify-between items-center py-1.5 border-b last:border-0 border-stone-200/30">
              <span className={`text-sm ${isDarkMode ? "text-stone-300" : "text-stone-700"}`}>
                {t.displayName?.trim() || `${t.firstName} ${t.lastName}`}
              </span>
              <span className={`text-sm font-bold ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`}>
                {sym}{(t.earned || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>

        <div className={`flex justify-between items-center px-1 mb-5`}>
          <span className={`text-sm font-semibold ${isDarkMode ? "text-stone-300" : "text-stone-600"}`}>
            {tr("teachersTab.totalPayout")}
          </span>
          <span className={`text-xl font-bold ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`}>
            {sym}{total}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
              isDarkMode
                ? "border-stone-600 text-stone-300 hover:bg-stone-700"
                : "border-stone-300 text-stone-700 hover:bg-stone-50"
            }`}
          >
            {tr("teachersTab.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
          >{tr("teachersTab.payAll", { sym, total })}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Small summary stat card ──────────────────────────────────────────────────
// Colour by topic (see .cat-* in index.css): people = teal/sky, classes = amber,
// active = green, needs attention = rose. Solid icon tile + a faint corner wash.
const SUMMARY_CAT = { emerald: "green", red: "rose", blue: "sky", purple: "accent" };
function SummaryCard({ icon: Icon, label, value, sub, color }) {
  const cat = SUMMARY_CAT[color] || color || "accent";

  return (
    <div
      className={`cat-${cat} relative overflow-hidden rounded-xl border border-ad-line p-4 flex items-center gap-3.5 shadow-[var(--a-shadow)]`}
      style={{ background: "radial-gradient(120% 100% at 100% 0%, var(--cat-soft) 0%, transparent 60%), var(--a-surface)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
        style={{ background: "var(--cat)", boxShadow: "0 6px 14px -6px var(--cat)" }}
      >
        <Icon className="w-5 h-5" strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ad-muted">{label}</p>
        <p className="text-xl font-bold tabular-nums text-ad-ink">{value}</p>
        {sub && <p className="text-xs text-ad-muted">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TeachersTab({ onNotify, isDarkMode = false }) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

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
        const [teachersRes, statsRes] = await Promise.all([
          api.get("/teachers", { params: { limit: 5000 } }),
          api.get("/reviews/stats").catch(() => ({ data: [] })),
        ]);
        const ratingMap = {};
        (statsRes.data || []).forEach((s) => { ratingMap[String(s.teacherId)] = s; });
        const merged = teachersRes.data.map((t) => {
          const rs = ratingMap[String(t._id)];
          return rs ? { ...t, avgRating: rs.avgRating, totalRatings: rs.totalRatings, bayesianScore: rs.bayesianScore } : t;
        });
        setTeachers(merged);
      } catch (err) {
        console.error("Error fetching teachers:", err);
        showToast(
          tr("teachersTab.couldNotLoadTeachers", { value: err.response?.data?.message || err.message }),
          "error"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchTeachers();
  }, [tr]);

  // ── Save teacher (create / update) ─────────────────────────────────────────
  const handleSaveTeacher = async (teacherData) => {
    try {
      if (editIndex !== null) {
        const id = teachers[editIndex]._id;
        const res = await api.put(`/teachers/${id}`, teacherData);
        setTeachers((prev) => prev.map((t, i) => (i === editIndex ? res.data : t)));
        onNotify?.(`Teacher updated: ${teacherData.firstName} ${teacherData.lastName}`);
        showToast(tr("teachersTab.updatedSuccessfully", { firstName: teacherData.firstName, lastName: teacherData.lastName }));
      } else {
        const res = await api.post("/teachers", teacherData);
        setTeachers((prev) => [...prev, res.data.teacher ?? res.data]);
        onNotify?.(`Teacher created: ${teacherData.firstName} ${teacherData.lastName}`);
        showToast(tr("teachersTab.addedSuccessfully", { firstName: teacherData.firstName, lastName: teacherData.lastName }));
      }
    } catch (err) {
      console.error("Save teacher error:", err);
      showToast(err.response?.data?.message || tr("teachersTab.couldNotSaveTeacherPlease"), "error");
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
      const res = await api.delete(`/teachers/${deleteTarget._id}`);
      setTeachers((prev) =>
        prev.map((t) => (t._id === deleteTarget._id ? { ...t, ...res.data.teacher } : t))
      );
      showToast(tr("teachersTab.scheduledForDeletionWarningEmail", { firstName: deleteTarget.firstName }), "info");
      onNotify?.(`Teacher ${deleteTarget.firstName} scheduled for deletion`);
    } catch (err) {
      console.error("Delete teacher error:", err);
      showToast(err.response?.data?.message || tr("teachersTab.couldNotScheduleTeacherFor"), "error");
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
      showToast(tr("teachersTab.accountRestored", { firstName: teacher.firstName, lastName: teacher.lastName }));
      onNotify?.(`Teacher ${teacher.firstName} restored`);
    } catch (err) {
      console.error("Restore teacher error:", err);
      showToast(err.response?.data?.message || tr("teachersTab.couldNotRestoreTeacher"), "error");
    }
  };

  // ── Toggle active/disabled ──────────────────────────────────────────────────
  const handleToggle = async (index) => {
    const teacher = teachers[index];
    if (!teacher) return;
    try {
      const res = await api.put(`/teachers/${teacher._id}`, {
        active: !teacher.active,
      });
      setTeachers((prev) => prev.map((t, i) => (i === index ? res.data : t)));
      showToast(
        `${teacher.firstName} ${res.data.active ? "enabled" : "disabled"}.`,
        "info"
      );
    } catch (err) {
      console.error("Toggle teacher error:", err);
      showToast(tr("teachersTab.couldNotUpdateTeacherStatus"), "error");
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
      showToast(tr("teachersTab.noPaymentDueForThis"), "info");
      return;
    }
    setPayTarget(teacher);
  };

  const handleConfirmPay = async () => {
    if (!payTarget) return;
    try {
      // Settles the pending pay records too — only zeroing `earned` left them "owed" in Payments
      const res = await api.patch(`/payment-transactions/teacher/${payTarget._id}/pay-all`, {});
      const earned = res.data?.teacher?.earned ?? 0;
      setTeachers((prev) => prev.map((t) => (t._id === payTarget._id ? { ...t, earned } : t)));
      showToast(tr("teachersTab.paidTo", { fmtMoney: fmtMoney(res.data?.totalAmount ?? 0, sym), firstName: payTarget.firstName }));
    } catch (err) {
      console.error("Pay teacher error:", err);
      showToast(err.response?.data?.message || tr("teachersTab.couldNotProcessPayment"), "error");
    } finally {
      setPayTarget(null);
    }
  };

  // ── Mark all as paid ────────────────────────────────────────────────────────
  const unpaidTeachers = teachers.filter((t) => (t.earned || 0) > 0);

  const handleConfirmPayAll = async () => {
    setPayAllOpen(false);
    // Settle each teacher's pending pay records (not just zero `earned`); one failure doesn't stop the rest
    const results = await Promise.allSettled(
      unpaidTeachers.map((t) => api.patch(`/payment-transactions/teacher/${t._id}/pay-all`, {}))
    );
    const earnedById = {};
    results.forEach((r, i) => {
      if (r.status === "fulfilled") earnedById[unpaidTeachers[i]._id] = r.value.data?.teacher?.earned ?? 0;
    });
    setTeachers((prev) => prev.map((t) => (t._id in earnedById ? { ...t, earned: earnedById[t._id] } : t)));
    const paid = Object.keys(earnedById).length;
    const failed = results.length - paid;
    if (failed) {
      console.error("Pay all errors:", results.filter((r) => r.status === "rejected").map((r) => r.reason));
      showToast(tr("teachersTab.teacherPaidCouldNotBe", { paid, value: paid !== 1 ? "s" : "", failed }), "error");
    } else {
      showToast(tr("teachersTab.teacherMarkedAsPaid", { paid, value: paid !== 1 ? "s" : "" }));
    }
  };

  // ── Reset password ──────────────────────────────────────────────────────────
  const handleResetPassword = async (index) => {
    const teacher = teachers[index];
    if (!teacher) return;
    try {
      // The server makes a strong temporary password and returns it once
      const res = await api.put(`/teachers/${teacher._id}`, { resetPassword: true });
      const newPass = res.data.temporaryPassword;
      setTeachers((prev) =>
        prev.map((t, i) =>
          i === index
            ? { ...res.data, password: newPass, showTempPassword: true }
            : t
        )
      );
      showToast(tr("teachersTab.passwordResetCopyItFrom"), "info");

      setTimeout(() => {
        setTeachers((prev) =>
          prev.map((t, i) =>
            i === index ? { ...t, showTempPassword: false, password: undefined } : t
          )
        );
      }, 15000);
    } catch (err) {
      console.error("Reset password error:", err);
      showToast(tr("teachersTab.couldNotResetPassword"), "error");
    }
  };

  // ── Copy password ───────────────────────────────────────────────────────────
  const handleCopyPassword = (index) => {
    const teacher = teachers[index];
    if (teacher?.password && navigator.clipboard) {
      navigator.clipboard.writeText(teacher.password);
      showToast(tr("teachersTab.passwordCopiedToClipboard"));
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

  // ── Resend invite ────────────────────────────────────────────────────────────
  const handleResendInvite = async (index) => {
    const teacher = teachers[index];
    if (!teacher) return;
    try {
      await api.post(`/teachers/${teacher._id}/resend-invite`);
      showToast(tr("teachersTab.inviteResentTo", { email: teacher.email }));
    } catch (err) {
      showToast(err.response?.data?.message || tr("teachersTab.failedToResendInvite"), "error");
    }
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
    const matchesSearch = `${t.displayName || ""} ${t.firstName} ${t.lastName} ${t.email}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesContinent =
      continentFilter === "" || t.continent === continentFilter;
    return matchesSearch && matchesContinent;
  });

  // ── Pagination ──────────────────────────────────────────────────────────────
  const totalPages  = Math.ceil(filteredTeachers.length / PAGE_SIZE);
  const pagedTeachers = filteredTeachers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [searchQuery, continentFilter, view]);

  // ── UI helpers ──────────────────────────────────────────────────────────────
  const cardBg = isDarkMode ? "bg-stone-800 border-stone-700" : "bg-white border-stone-200";
  const textPrimary = isDarkMode ? "text-white" : "text-stone-900";
  const textSecondary = isDarkMode ? "text-stone-400" : "text-stone-500";
  const inputCls = isDarkMode
    ? "bg-stone-700 border-stone-600 text-white placeholder-stone-500 focus:ring-ad-accent focus:border-ad-accent"
    : "bg-white border-stone-300 text-stone-900 placeholder-stone-400 focus:ring-ad-accent focus:border-ad-accent";
  const selectCls = isDarkMode
    ? "bg-stone-700 border-stone-600 text-white focus:ring-ad-accent"
    : "bg-white border-stone-300 text-stone-900 focus:ring-ad-accent";

  const tabBtnCls = (key) =>
    view === key
      ? key === "pending_deletion"
        ? "bg-red-600 text-white shadow-sm"
        : "bg-ad-accent text-white shadow-sm"
      : isDarkMode
      ? "text-stone-400 hover:text-stone-200 hover:bg-stone-700"
      : "text-stone-500 hover:text-stone-700 hover:bg-stone-100";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[60vh]">

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
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white ui-toast-in ${
            toastType === "error"
              ? "bg-red-500"
              : toastType === "info"
              ? "bg-ad-accent"
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
          <h2 className={`text-2xl font-bold ${textPrimary}`}>{tr("teachersTab.teachers")}</h2>
          <p className={`text-sm mt-0.5 ${textSecondary}`}>
            {tr("teachersTab.manageAllTeachersOnThe")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => downloadTeacherRoster(filteredTeachers).catch(err => { console.error(err); showToast(`Could not create the PDF: ${err?.message || "unknown error"}`, "error"); })}
            title={tr("teachersTab.downloadVisibleTeachersAsPdf")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              isDarkMode
                ? "border-stone-600 text-stone-300 hover:bg-stone-700"
                : "border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            {tr("teachersTab.downloadPdf")}
          </button>

          <button
            onClick={() => {
              setEditIndex(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-ad-accent hover:bg-ad-accent-hover text-white rounded-xl font-semibold text-sm shadow-md transition duration-150 active:scale-95 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            {tr("teachersTab.addTeacher")}
          </button>
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          icon={Users}
          label={tr("teachersTab.totalTeachers")}
          value={teachers.length}
          color="teal"
          isDarkMode={isDarkMode}
        />
        <SummaryCard
          icon={UserCheck}
          label={tr("teachersTab.active")}
          value={activeTeachers.length}
          sub={tr("teachersTab.disabled", { disabledTeachersCount: disabledTeachers.length })}
          color="emerald"
          isDarkMode={isDarkMode}
        />
        <SummaryCard
          icon={TrendingUp}
          label={tr("teachersTab.totalLessons")}
          value={totalLessons}
          color="amber"
          isDarkMode={isDarkMode}
        />

        {/* Pending Payout card with Mark All as Paid button */}
        <div className="cat-green relative overflow-hidden rounded-xl border border-ad-line p-4 flex items-center gap-3.5 shadow-[var(--a-shadow)]" style={{ background: "radial-gradient(120% 100% at 100% 0%, var(--cat-soft) 0%, transparent 60%), var(--a-surface)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: "var(--cat)", boxShadow: "0 6px 14px -6px var(--cat)" }}>
            <DollarSign className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ad-muted">
              {tr("teachersTab.pendingPayout")}
            </p>
            <p className="text-xl font-bold tabular-nums text-ad-ink">
              {sym}{totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {unpaidTeachers.length > 0 && (
              <button
                onClick={() => setPayAllOpen(true)}
                className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <CheckCircle className="w-3 h-3" />
                {tr("teachersTab.markAllAsPaid2")}
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
        <div className={`flex gap-1 p-1 rounded-lg flex-wrap ${isDarkMode ? "bg-stone-900" : "bg-stone-100"}`}>
          {[
            { key: "all", label: tr("teachersTab.all", { teachersCount: teachers.length }) },
            { key: "active", label: tr("teachersTab.active2", { activeTeachersCount: activeTeachers.length }) },
            { key: "disabled", label: tr("teachersTab.disabled2", { disabledTeachersCount: disabledTeachers.length }) },
            {
              key: "pending_deletion",
              label: tr("teachersTab.pendingDeletion", { pendingDeletionTeachersCount: pendingDeletionTeachers.length }),
            },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 ${tabBtnCls(key)}`}
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
            placeholder={tr("teachersTab.searchTeachers")}
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
            <option value="">{tr("teachersTab.allContinents")}</option>
            <option value="Africa">{tr("teachersTab.africa")}</option>
            <option value="Europe">{tr("teachersTab.europe")}</option>
            <option value="Asia">{tr("teachersTab.asia")}</option>
            <option value="Americas">{tr("teachersTab.americas")}</option>
            <option value="Oceania">{tr("teachersTab.oceania")}</option>
          </select>
        </div>
      </div>

      {/* ── Loading state ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-ad-accent border-t-transparent rounded-full animate-spin" />
          <p className={`text-sm ${textSecondary}`}>{tr("teachersTab.loadingTeachers")}</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && filteredTeachers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isDarkMode ? "bg-stone-800" : "bg-stone-100"
            }`}
          >
            <Users className={`w-8 h-8 ${textSecondary}`} />
          </div>
          <p className={`text-base font-semibold ${textPrimary}`}>{tr("teachersTab.noTeachersFound")}</p>
          <p className={`text-sm ${textSecondary}`}>
            {searchQuery || continentFilter
              ? tr("teachersTab.tryAdjustingYourSearchOr")
              : view === "disabled"
              ? tr("teachersTab.thereAreNoDisabledTeachers")
              : view === "pending_deletion"
              ? tr("teachersTab.noTeachersArePendingDeletion")
              : tr("teachersTab.addYourFirstTeacherTo")}
          </p>
          {!searchQuery && !continentFilter && view === "active" && (
            <button
              onClick={() => {
                setEditIndex(null);
                setIsModalOpen(true);
              }}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-ad-accent hover:bg-ad-accent-hover text-white rounded-xl text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" />
              {tr("teachersTab.addFirstTeacher")}
            </button>
          )}
        </div>
      )}

      {/* ── Teacher card grid ── */}
      {!loading && filteredTeachers.length > 0 && (
        <>
          <p className={`text-xs mb-4 ${textSecondary}`}>
            {tr("teachersTab.showing")} {Math.min((page - 1) * PAGE_SIZE + 1, filteredTeachers.length)}–{Math.min(page * PAGE_SIZE, filteredTeachers.length)} {tr("teachersTab.of")} {filteredTeachers.length} {tr("teachersTab.teacher2")}
            {filteredTeachers.length !== 1 ? "s" : ""}
            {searchQuery && tr("teachersTab.matching", { searchQuery })}
          </p>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {pagedTeachers.map((teacher) => {
              const realIndex = teachers.findIndex((t) => t._id === teacher._id);
              const days = daysUntilDeletion(teacher.scheduledDeletionAt);

              return (
                <div key={teacher._id} className="relative">
                  {/* Pending-deletion countdown banner */}
                  {teacher.scheduledDeletionAt && (
                    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-2 px-3 py-2 bg-red-600 rounded-t-xl text-white text-xs font-semibold">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {tr("teachersTab.deletedIn")} {days} {tr("teachersTab.day")}{days !== 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={() => handleRestoreTeacher(teacher)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-lg transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {tr("teachersTab.restore")}
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
                      onResendInvite={() => handleResendInvite(realIndex)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={filteredTeachers.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
            isDarkMode={isDarkMode}
          />
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
        onPhotoChange={(teacherId, photoUrl) => {
          setTeachers(prev =>
            prev.map(t => t._id === teacherId ? { ...t, photo: photoUrl } : t)
          );
        }}
      />
    </div>
  );
}
