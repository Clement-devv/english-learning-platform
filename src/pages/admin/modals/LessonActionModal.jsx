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

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-GB", {
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
    cancelled: "bg-gray-100 text-gray-600",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] || "bg-gray-100 text-gray-600"}`}>
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
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                i < current
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : i === current
                  ? "bg-blue-600 border-blue-600 text-white"
                  : isDarkMode
                  ? "border-gray-600 text-gray-500"
                  : "border-gray-300 text-gray-400"
              }`}
            >
              {i < current ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                i === current
                  ? isDarkMode ? "text-blue-400" : "text-blue-600"
                  : isDarkMode ? "text-gray-500" : "text-gray-400"
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
                  : isDarkMode ? "bg-gray-700" : "bg-gray-200"
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
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
        disabled
          ? isDarkMode ? "opacity-40 cursor-not-allowed border-gray-700" : "opacity-40 cursor-not-allowed border-gray-200"
          : isDarkMode
          ? "border-gray-700 hover:border-blue-500 hover:bg-blue-900/20"
          : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
      }`}
    >
      <div>
        <p className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>{label}</p>
        {sub && <p className={`text-xs mt-0.5 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{sub}</p>}
      </div>
      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`} />
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

  const steps = ["Select Person", "Select Other", "Choose Class", "Confirm"];
  const currentStepIndex = { teacher: 0, student: 0, class: startWith === "teacher" ? 1 : 1, confirm: 2, done: 3 }[step] ?? 0;

  // ── Load teachers when step = "teacher" ──
  useEffect(() => {
    if (step === "teacher" && student?._id) {
      setLoading(true);
      api.get(`/api/admin/lessons/assignments/${student._id}/teachers`)
        .then((r) => setTeacherList(r.data.teachers || []))
        .catch(() => setError("Failed to load teachers"))
        .finally(() => setLoading(false));
    }
  }, [step, student?._id]);

  // ── Load students when step = "student" ──
  useEffect(() => {
    if (step === "student" && teacher?._id) {
      setLoading(true);
      api.get(`/api/admin/lessons/assignments/${teacher._id}/students`)
        .then((r) => setStudentList(r.data.students || []))
        .catch(() => setError("Failed to load students"))
        .finally(() => setLoading(false));
    }
  }, [step, teacher?._id]);

  // ── Load bookings when step = "class" ──
  useEffect(() => {
    if (step === "class" && teacher?._id && student?._id) {
      setLoading(true);
      const statusFilter = isMarking ? "accepted,pending" : "completed";
      api.get(`/api/admin/lessons/pair-bookings?teacherId=${teacher._id}&studentId=${student._id}&status=${statusFilter}`)
        .then((r) => setBookings(r.data.bookings || []))
        .catch(() => setError("Failed to load classes"))
        .finally(() => setLoading(false));
    }
  }, [step, teacher?._id, student?._id, isMarking]);

  // ── Submit ──
  const handleSubmit = async () => {
    if (!selectedBooking) return;
    setSubmitting(true);
    setError("");
    try {
      const endpoint = isMarking ? "/api/admin/lessons/mark" : "/api/admin/lessons/unmark";
      const res = await api.post(endpoint, { bookingId: selectedBooking._id });
      onSuccess?.(res.data);
      setStep("done");
    } catch (err) {
      setError(err.response?.data?.message || "Operation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Colour theme ──
  const bg = isDarkMode ? "bg-gray-900" : "bg-white";
  const cardBg = isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200";
  const textPrimary = isDarkMode ? "text-white" : "text-gray-900";
  const textSecondary = isDarkMode ? "text-gray-400" : "text-gray-500";
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
                {isMarking ? "Mark Lesson Complete" : "Unmark Lesson"}
              </h2>
              <p className="text-white/70 text-xs">
                {isMarking
                  ? "Select the class to mark as completed"
                  : "Reverse a completed class back to accepted"}
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
                  <p className={`text-sm font-semibold ${textPrimary}`}>Select Teacher</p>
                  <p className={`text-xs ${textSecondary}`}>
                    Teachers assigned to{" "}
                    <span className="font-medium">{student?.firstName} {student?.surname}</span>
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader className="w-5 h-5 animate-spin text-blue-500" />
                  <span className={`text-sm ${textSecondary}`}>Loading teachers...</span>
                </div>
              ) : teacherList.length === 0 ? (
                <div className={`text-center py-8 text-sm ${textSecondary}`}>
                  No teachers assigned to this student.
                </div>
              ) : (
                teacherList.map((t) => (
                  <SelectRow
                    key={t._id}
                    label={`${t.firstName} ${t.lastName}`}
                    sub={`${t.email} · $${t.ratePerClass}/class · ${t.continent}`}
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
                <div className={`p-2 rounded-lg ${isDarkMode ? "bg-purple-900/30" : "bg-purple-50"}`}>
                  <User className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${textPrimary}`}>Select Student</p>
                  <p className={`text-xs ${textSecondary}`}>
                    Students assigned to{" "}
                    <span className="font-medium">{teacher?.firstName} {teacher?.lastName}</span>
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader className="w-5 h-5 animate-spin text-blue-500" />
                  <span className={`text-sm ${textSecondary}`}>Loading students...</span>
                </div>
              ) : studentList.length === 0 ? (
                <div className={`text-center py-8 text-sm ${textSecondary}`}>
                  No students assigned to this teacher.
                </div>
              ) : (
                studentList.map((s) => (
                  <SelectRow
                    key={s._id}
                    label={`${s.firstName} ${s.surname}`}
                    sub={`${s.email} · ${s.noOfClasses} class${s.noOfClasses !== 1 ? "es" : ""} remaining`}
                    isDarkMode={isDarkMode}
                    disabled={isMarking && s.noOfClasses <= 0}
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
                    Select {isMarking ? "Accepted" : "Completed"} Class
                  </p>
                  <p className={`text-xs ${textSecondary}`}>
                    {teacher?.firstName} {teacher?.lastName} ↔ {student?.firstName} {student?.surname}
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader className="w-5 h-5 animate-spin text-blue-500" />
                  <span className={`text-sm ${textSecondary}`}>Loading classes...</span>
                </div>
              ) : bookings.length === 0 ? (
                <div className={`text-center py-10`}>
                  <BookOpen className={`w-10 h-10 mx-auto mb-2 ${textSecondary}`} />
                  <p className={`text-sm font-medium ${textPrimary}`}>No {isMarking ? "accepted" : "completed"} classes found</p>
                  <p className={`text-xs ${textSecondary} mt-1`}>
                    {isMarking
                      ? "There are no accepted bookings between this teacher and student."
                      : "There are no completed bookings to unmark."}
                  </p>
                </div>
              ) : (
                bookings.map((b) => (
                  <button
                    key={b._id}
                    onClick={() => { setSelectedBooking(b); setStep("confirm"); }}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                      isDarkMode
                        ? "border-gray-700 hover:border-blue-500 hover:bg-blue-900/20"
                        : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
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
                            {b.duration} min
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
              >
                ← Change {startWith === "teacher" ? "student" : "teacher"}
              </button>
            </div>
          )}

          {/* ── Step: Confirm ── */}
          {step === "confirm" && selectedBooking && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className={`rounded-xl border p-4 ${cardBg}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${textSecondary}`}>
                  You are about to
                </p>
                <div className={`text-base font-bold mb-4 ${isMarking ? "text-emerald-600" : "text-rose-600"}`}>
                  {isMarking ? "✅ Mark as Completed" : "↩️ Unmark (Reverse Completion)"}
                </div>

                <div className="space-y-2.5">
                  <InfoRow label="Class" value={selectedBooking.classTitle} isDarkMode={isDarkMode} />
                  {selectedBooking.topic && (
                    <InfoRow label="Topic" value={selectedBooking.topic} isDarkMode={isDarkMode} />
                  )}
                  <InfoRow label="Scheduled" value={fmt(selectedBooking.scheduledTime)} isDarkMode={isDarkMode} />
                  <InfoRow
                    label="Teacher"
                    value={`${teacher?.firstName} ${teacher?.lastName}`}
                    isDarkMode={isDarkMode}
                  />
                  <InfoRow
                    label="Student"
                    value={`${student?.firstName} ${student?.surname}`}
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
                  What will happen:
                </p>
                <ul className={`text-xs space-y-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                  {isMarking ? (
                    <>
                      <li>• Booking → <strong>completed</strong></li>
                      <li>• Teacher earnings +<strong>${teacher?.ratePerClass || 0}</strong></li>
                      <li>• Teacher lessons completed +1</li>
                      <li>• Student classes remaining <strong>-1</strong></li>
                      <li className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Emails sent to teacher &amp; student
                      </li>
                    </>
                  ) : (
                    <>
                      <li>• Booking → <strong>accepted</strong> (reversed)</li>
                      <li>• Teacher earnings -<strong>${teacher?.ratePerClass || 0}</strong></li>
                      <li>• Teacher lessons completed -1</li>
                      <li>• Student classes remaining <strong>+1</strong></li>
                      <li>• Payment transaction cancelled</li>
                      <li className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Emails sent to teacher &amp; student
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
                {isMarking ? "Lesson Marked!" : "Lesson Unmarked!"}
              </p>
              <p className={`text-sm ${textSecondary}`}>
                {isMarking
                  ? "The class has been marked as completed. Emails have been sent to both the teacher and student."
                  : "The class has been reversed. Teacher earnings and student classes have been adjusted."}
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {step !== "done" && (
          <div className={`flex items-center justify-between px-6 py-4 border-t flex-shrink-0 ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
            <button
              onClick={step === "confirm" ? () => setStep("class") : onClose}
              className={`text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
                isDarkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {step === "confirm" ? "← Back" : "Cancel"}
            </button>

            {step === "confirm" && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-60 ${
                  isMarking
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {submitting && <Loader className="w-4 h-4 animate-spin" />}
                {submitting
                  ? "Processing..."
                  : isMarking
                  ? "Confirm & Mark Complete"
                  : "Confirm & Reverse"}
              </button>
            )}
          </div>
        )}

        {step === "done" && (
          <div className={`px-6 py-4 border-t flex-shrink-0 ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all"
            >
              Done
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
      <span className={`text-xs font-medium w-20 flex-shrink-0 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
        {label}
      </span>
      <span className={`text-xs font-semibold ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>{value}</span>
    </div>
  );
}
