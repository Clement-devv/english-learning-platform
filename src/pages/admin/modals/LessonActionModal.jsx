// src/pages/admin/modals/LessonActionModal.jsx
// Multi-step modal for admin to:
//   • Mark lesson (accepted → completed): deducts student class, adds teacher earnings
//   • Unmark lesson (completed → accepted): reverses both
//
// Props:
//   mode        "mark" | "unmark"
//   startWith   "teacher" | "student"  — which side to start the selection from
//   teacher     object (optional) — pre-fill if opened from a TeacherCard
//   student     object (optional) — pre-fill if opened from a StudentCard
//   onClose     () => void
//   onSuccess   (result) => void
//   isDarkMode  bool

import React, { useState, useEffect } from "react";
import {
  X,
  ChevronRight,
  CheckCircle,
  RotateCcw,
  User,
  Users,
  BookOpen,
  Calendar,
  Clock,
  AlertTriangle,
  Loader,
  Mail,
} from "lucide-react";
import api from "../../../api";
import { visibleEmail } from "../../../utils/managedStudent.js";
import { useTranslation } from "react-i18next";
import { dateLocale } from "../../../i18n/dateLocale.js";

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString(dateLocale("en-GB"), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  const map = {
    accepted: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    cancelled: "bg-stone-100 text-stone-600",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] || "bg-stone-100 text-stone-600"}`}>
      {status}
    </span>
  );
}

// ── Step indicator ─────────────────────────────────────────────────────────────
function Steps({ steps, current, isDarkMode }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition ${
                i < current
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : i === current
                  ? "bg-blue-600 border-blue-600 text-white"
                  : isDarkMode
                  ? "border-stone-600 text-stone-500"
                  : "border-stone-300 text-stone-400"
              }`}
            >
              {i < current ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                i === current
                  ? isDarkMode ? "text-blue-400" : "text-blue-600"
                  : isDarkMode ? "text-stone-500" : "text-stone-400"
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-1 mb-4 ${
                i < current
                  ? "bg-emerald-400"
                  : isDarkMode ? "bg-stone-700" : "bg-stone-200"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Selectable row ─────────────────────────────────────────────────────────────
function SelectRow({ label, sub, onClick, isDarkMode, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition ${
        disabled
          ? isDarkMode ? "opacity-40 cursor-not-allowed border-stone-700" : "opacity-40 cursor-not-allowed border-stone-200"
          : isDarkMode
          ? "border-stone-700 hover:border-blue-500 hover:bg-blue-900/20"
          : "border-stone-200 hover:border-blue-400 hover:bg-blue-50"
      }`}
    >
      <div>
        <p className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-stone-900"}`}>{label}</p>
        {sub && <p className={`text-xs mt-0.5 ${isDarkMode ? "text-stone-400" : "text-stone-500"}`}>{sub}</p>}
      </div>
      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? "text-stone-500" : "text-stone-400"}`} />
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function LessonActionModal({
  mode = "mark",         // "mark" | "unmark"
  startWith = "teacher", // "teacher" | "student"
  teacher: preTeacher = null,
  student: preStudent = null,
  onClose,
  onSuccess,
  isDarkMode = false,
}) {
  const { t: tr } = useTranslation("admin");
  const isMarking = mode === "mark";

  // State machine: "teacher" | "student" | "class" | "confirm" | "done"
  const [step, setStep] = useState(() => {
    if (preTeacher && preStudent) return "class";
    if (preTeacher) return "student";
    if (preStudent) return "teacher";
    return startWith; // "teacher" or "student"
  });

  const [teacher, setTeacher] = useState(preTeacher);
  const [student, setStudent] = useState(preStudent);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const [teacherList, setTeacherList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const currentStepIndex = { teacher: 0, student: 0, class: startWith === "teacher" ? 1 : 1, confirm: 2, done: 3 }[step] ?? 0;

  // ── Load teachers when step = "teacher" ──
  useEffect(() => {
    if (step === "teacher" && student?._id) {
      setLoading(true);
      api.get(`/admin/lessons/assignments/${student._id}/teachers`)
        .then((r) => setTeacherList(r.data.teachers || []))
        .catch(() => setError(tr("lessonActionModal.failedToLoadTeachers")))
        .finally(() => setLoading(false));
    }
  }, [step, student._id, tr]);

  // ── Load students when step = "student" ──
  useEffect(() => {
    if (step === "student" && teacher?._id) {
      setLoading(true);
      api.get(`/admin/lessons/assignments/${teacher._id}/students`)
        .then((r) => setStudentList(r.data.students || []))
        .catch(() => setError(tr("lessonActionModal.failedToLoadStudents")))
        .finally(() => setLoading(false));
    }
  }, [step, teacher._id, tr]);

  // ── Load bookings when step = "class" ──
  useEffect(() => {
    if (step === "class" && teacher?._id && student?._id) {
      setLoading(true);
      const statusFilter = isMarking ? "accepted,pending" : "completed";
      api.get(`/admin/lessons/pair-bookings?teacherId=${teacher._id}&studentId=${student._id}&status=${statusFilter}`)
        .then((r) => setBookings(r.data.bookings || []))
        .catch(() => setError(tr("lessonActionModal.failedToLoadClasses")))
        .finally(() => setLoading(false));
    }
  }, [step, teacher._id, student._id, isMarking, tr]);

  // ── Submit ──
  const handleSubmit = async () => {
    if (!selectedBooking) return;
    setSubmitting(true);
    setError("");
    try {
      const endpoint = isMarking ? "/admin/lessons/mark" : "/admin/lessons/unmark";
      const res = await api.post(endpoint, { bookingId: selectedBooking._id });
      onSuccess?.(res.data);
      setStep("done");
    } catch (err) {
      setError(err.response?.data?.message || tr("lessonActionModal.operationFailedPleaseTryAgain"));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Colour theme ──
  const bg = isDarkMode ? "bg-stone-900" : "bg-white";
  const cardBg = isDarkMode ? "bg-stone-800 border-stone-700" : "bg-stone-50 border-stone-200";
  const textPrimary = isDarkMode ? "text-white" : "text-stone-900";
  const textSecondary = isDarkMode ? "text-stone-400" : "text-stone-500";
  const headerGradient = isMarking
    ? "from-emerald-600 to-teal-600"
    : "from-rose-600 to-orange-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`relative w-full max-w-lg rounded-2xl shadow-2xl ${bg} overflow-hidden flex flex-col max-h-[90vh]`}
      >
        {/* ── Header ── */}
        <div className={`bg-gradient-to-r ${headerGradient} px-6 py-5 flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              {isMarking ? (
                <CheckCircle className="w-5 h-5 text-white" />
              ) : (
                <RotateCcw className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">
                {isMarking ? tr("lessonActionModal.markLessonComplete") : tr("lessonActionModal.unmarkLesson")}
              </h2>
              <p className="text-white/70 text-xs">
                {isMarking
                  ? tr("lessonActionModal.selectTheClassToMark")
                  : tr("lessonActionModal.reverseACompletedClassBack")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-6 overflow-y-auto flex-1">
          {step !== "done" && (
            <Steps
              steps={["Select", "Select", "Class", "Confirm"]}
              current={currentStepIndex}
              isDarkMode={isDarkMode}
            />
          )}

          {error && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── Step: Select Teacher (from student side) ── */}
          {step === "teacher" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className={`p-2 rounded-lg ${isDarkMode ? "bg-blue-900/30" : "bg-blue-50"}`}>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${textPrimary}`}>{tr("lessonActionModal.selectTeacher")}</p>
                  <p className={`text-xs ${textSecondary}`}>
                    {tr("lessonActionModal.teachersAssignedTo")}{" "}
                    <span className="font-medium">{student?.firstName} {student?.lastName}</span>
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader className="w-5 h-5 animate-spin text-blue-500" />
                  <span className={`text-sm ${textSecondary}`}>{tr("lessonActionModal.loadingTeachers")}</span>
                </div>
              ) : teacherList.length === 0 ? (
                <div className={`text-center py-8 text-sm ${textSecondary}`}>
                  {tr("lessonActionModal.noTeachersAssignedToThis")}
                </div>
              ) : (
                teacherList.map((t) => (
                  <SelectRow
                    key={t._id}
                    label={t.displayName?.trim() || `${t.firstName} ${t.lastName}`}
                    sub={tr("lessonActionModal.class", { email: t.email, ratePerClass: t.ratePerClass, continent: t.continent })}
                    isDarkMode={isDarkMode}
                    onClick={() => { setTeacher(t); setStep("class"); }}
                  />
                ))
              )}
            </div>
          )}

          {/* ── Step: Select Student (from teacher side) ── */}
          {step === "student" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className={`p-2 rounded-lg ${isDarkMode ? "bg-ad-accent-soft" : "bg-ad-accent-soft"}`}>
                  <User className="w-4 h-4 text-ad-accent-ink" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${textPrimary}`}>{tr("lessonActionModal.selectStudent")}</p>
                  <p className={`text-xs ${textSecondary}`}>
                    {tr("lessonActionModal.studentsAssignedTo")}{" "}
                    <span className="font-medium">{teacher?.firstName} {teacher?.lastName}</span>
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader className="w-5 h-5 animate-spin text-blue-500" />
                  <span className={`text-sm ${textSecondary}`}>{tr("lessonActionModal.loadingStudents")}</span>
                </div>
              ) : studentList.length === 0 ? (
                <div className={`text-center py-8 text-sm ${textSecondary}`}>
                  {tr("lessonActionModal.noStudentsAssignedToThis")}
                </div>
              ) : (
                studentList.map((s) => (
                  <SelectRow
                    key={s._id}
                    label={`${s.firstName} ${s.lastName}`}
                    sub={`${visibleEmail(s.email) || "Managed student"} · ${s.classCredits} class${s.classCredits !== 1 ? "es" : ""} remaining`}
                    isDarkMode={isDarkMode}
                    disabled={isMarking && s.classCredits <= 0}
                    onClick={() => { setStudent(s); setStep("class"); }}
                  />
                ))
              )}
            </div>
          )}

          {/* ── Step: Select Class ── */}
          {step === "class" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className={`p-2 rounded-lg ${isDarkMode ? "bg-amber-900/30" : "bg-amber-50"}`}>
                  <BookOpen className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${textPrimary}`}>
                    {tr("lessonActionModal.select")} {isMarking ? tr("lessonActionModal.accepted") : tr("lessonActionModal.completed")} {tr("lessonActionModal.class2")}
                  </p>
                  <p className={`text-xs ${textSecondary}`}>
                    {teacher?.firstName} {teacher?.lastName} ↔ {student?.firstName} {student?.lastName}
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader className="w-5 h-5 animate-spin text-blue-500" />
                  <span className={`text-sm ${textSecondary}`}>{tr("lessonActionModal.loadingClasses")}</span>
                </div>
              ) : bookings.length === 0 ? (
                <div className={`text-center py-10`}>
                  <BookOpen className={`w-10 h-10 mx-auto mb-2 ${textSecondary}`} />
                  <p className={`text-sm font-medium ${textPrimary}`}>{tr(isMarking ? "lessonActionModal.noAcceptedClassesFound" : "lessonActionModal.noCompletedClassesFound")}</p>
                  <p className={`text-xs ${textSecondary} mt-1`}>
                    {isMarking
                      ? tr("lessonActionModal.thereAreNoAcceptedBookings")
                      : tr("lessonActionModal.thereAreNoCompletedBookings")}
                  </p>
                </div>
              ) : (
                bookings.map((b) => (
                  <button
                    key={b._id}
                    onClick={() => { setSelectedBooking(b); setStep("confirm"); }}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                      isDarkMode
                        ? "border-stone-700 hover:border-blue-500 hover:bg-blue-900/20"
                        : "border-stone-200 hover:border-blue-400 hover:bg-blue-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${textPrimary}`}>{b.classTitle}</p>
                        {b.topic && <p className={`text-xs ${textSecondary} truncate`}>{b.topic}</p>}
                        <div className={`flex items-center gap-3 mt-1.5 text-xs ${textSecondary}`}>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {fmt(b.scheduledTime)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {b.duration} {tr("lessonActionModal.min")}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <StatusBadge status={b.status} />
                      </div>
                    </div>
                  </button>
                ))
              )}

              <button
                onClick={() => { setStep(startWith === "teacher" ? "student" : "teacher"); }}
                className={`text-xs ${textSecondary} hover:underline mt-1`}
              >{tr(startWith === "teacher" ? "lessonActionModal.changeStudent" : "lessonActionModal.changeTeacher")}
              </button>
            </div>
          )}

          {/* ── Step: Confirm ── */}
          {step === "confirm" && selectedBooking && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className={`rounded-xl border p-4 ${cardBg}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${textSecondary}`}>
                  {tr("lessonActionModal.youAreAboutTo")}
                </p>
                <div className={`text-base font-bold mb-4 ${isMarking ? "text-emerald-600" : "text-rose-600"}`}>
                  {isMarking ? tr("lessonActionModal.markAsCompleted") : tr("lessonActionModal.unmarkReverseCompletion")}
                </div>

                <div className="space-y-2.5">
                  <InfoRow label={tr("lessonActionModal.class2")} value={selectedBooking.classTitle} isDarkMode={isDarkMode} />
                  {selectedBooking.topic && (
                    <InfoRow label={tr("lessonActionModal.topic")} value={selectedBooking.topic} isDarkMode={isDarkMode} />
                  )}
                  <InfoRow label={tr("lessonActionModal.scheduled")} value={fmt(selectedBooking.scheduledTime)} isDarkMode={isDarkMode} />
                  <InfoRow
                    label={tr("lessonActionModal.teacher")}
                    value={`${teacher?.firstName} ${teacher?.lastName}`}
                    isDarkMode={isDarkMode}
                  />
                  <InfoRow
                    label={tr("lessonActionModal.student")}
                    value={`${student?.firstName} ${student?.lastName}`}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>

              {/* What will happen */}
              <div className={`rounded-xl border px-4 py-3 ${
                isMarking
                  ? isDarkMode ? "bg-emerald-900/20 border-emerald-700/40" : "bg-emerald-50 border-emerald-200"
                  : isDarkMode ? "bg-rose-900/20 border-rose-700/40" : "bg-rose-50 border-rose-200"
              }`}>
                <p className={`text-xs font-semibold mb-2 ${isMarking ? "text-emerald-600" : "text-rose-600"}`}>
                  {tr("lessonActionModal.whatWillHappen")}
                </p>
                <ul className={`text-xs space-y-1 ${isDarkMode ? "text-stone-300" : "text-stone-700"}`}>
                  {isMarking ? (
                    <>
                      <li>{tr("lessonActionModal.booking")} <strong>{tr("lessonActionModal.completed2")}</strong></li>
                      <li>{tr("lessonActionModal.teacherEarnings")}<strong>${teacher?.ratePerClass || 0}</strong></li>
                      <li>{tr("lessonActionModal.teacherLessonsCompleted1")}</li>
                      <li>{tr("lessonActionModal.studentClassesRemaining")} <strong>-1</strong></li>
                      <li className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {tr("lessonActionModal.emailsSentToTeacherStudent")}
                      </li>
                    </>
                  ) : (
                    <>
                      <li>{tr("lessonActionModal.booking")} <strong>{tr("lessonActionModal.accepted2")}</strong> {tr("lessonActionModal.reversed")}</li>
                      <li>{tr("lessonActionModal.teacherEarnings2")}<strong>${teacher?.ratePerClass || 0}</strong></li>
                      <li>{tr("lessonActionModal.teacherLessonsCompleted12")}</li>
                      <li>{tr("lessonActionModal.studentClassesRemaining")} <strong>+1</strong></li>
                      <li>{tr("lessonActionModal.paymentTransactionCancelled")}</li>
                      <li className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {tr("lessonActionModal.emailsSentToTeacherStudent")}
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* ── Step: Done ── */}
          {step === "done" && (
            <div className="flex flex-col items-center text-center py-8 gap-3">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isMarking ? "bg-emerald-100" : "bg-rose-100"
              }`}>
                {isMarking ? (
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                ) : (
                  <RotateCcw className="w-8 h-8 text-rose-600" />
                )}
              </div>
              <p className={`text-lg font-bold ${textPrimary}`}>
                {isMarking ? tr("lessonActionModal.lessonMarked") : tr("lessonActionModal.lessonUnmarked")}
              </p>
              <p className={`text-sm ${textSecondary}`}>
                {isMarking
                  ? tr("lessonActionModal.theClassHasBeenMarked")
                  : tr("lessonActionModal.theClassHasBeenReversed")}
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {step !== "done" && (
          <div className={`flex items-center justify-between px-6 py-4 border-t flex-shrink-0 ${isDarkMode ? "border-stone-700" : "border-stone-100"}`}>
            <button
              onClick={step === "confirm" ? () => setStep("class") : onClose}
              className={`text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
                isDarkMode ? "text-stone-300 hover:bg-stone-700" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {step === "confirm" ? tr("lessonActionModal.back") : tr("lessonActionModal.cancel")}
            </button>

            {step === "confirm" && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60 ${
                  isMarking
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {submitting && <Loader className="w-4 h-4 animate-spin" />}
                {submitting
                  ? tr("lessonActionModal.processing")
                  : isMarking
                  ? tr("lessonActionModal.confirmMarkComplete")
                  : tr("lessonActionModal.confirmReverse")}
              </button>
            )}
          </div>
        )}

        {step === "done" && (
          <div className={`px-6 py-4 border-t flex-shrink-0 ${isDarkMode ? "border-stone-700" : "border-stone-100"}`}>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition"
            >
              {tr("lessonActionModal.done")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small helper ───────────────────────────────────────────────────────────────
function InfoRow({ label, value, isDarkMode }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`text-xs font-medium w-20 flex-shrink-0 ${isDarkMode ? "text-stone-400" : "text-stone-500"}`}>
        {label}
      </span>
      <span className={`text-xs font-semibold ${isDarkMode ? "text-stone-200" : "text-stone-800"}`}>{value}</span>
    </div>
  );
}
