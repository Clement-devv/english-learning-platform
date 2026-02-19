// src/pages/admin/modals/LessonMarkModal.jsx
// Multi-step modal for admin to mark or unmark lessons
// Props:
//   mode:      "mark" | "unmark"
//   startWith: "teacher" | "student"  (which side to pick first)
//   teacher:   { _id, firstName, lastName, ratePerClass } | null  (pre-fill)
//   student:   { _id, firstName, surname, noOfClasses } | null    (pre-fill)
//   onClose:   () => void
//   onSuccess: (result) => void
//   isDarkMode: boolean

import { useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Users,
  BookOpen,
  AlertTriangle,
  Loader2,
  DollarSign,
  RotateCcw,
  Calendar,
  Clock,
  User,
  GraduationCap,
  MessageSquare,
} from "lucide-react";
import api from "../../../api";

// ─── tiny helpers ────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const fmtMoney = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

// Step names
const STEPS = ["select_a", "select_b", "pick_class", "confirm", "done"];

export default function LessonMarkModal({
  mode = "mark",         // "mark" | "unmark"
  startWith = "teacher", // "teacher" | "student"
  teacher: preTeacher = null,
  student: preStudent = null,
  onClose,
  onSuccess,
  isDarkMode = false,
}) {
  const isMarkMode = mode === "mark";

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0); // index into STEPS
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState(""); // for unmark

  // Selected entities
  const [selectedTeacher, setSelectedTeacher] = useState(preTeacher || null);
  const [selectedStudent, setSelectedStudent] = useState(preStudent || null);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Lists fetched from API
  const [teacherList, setTeacherList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  const [bookingList, setBookingList] = useState([]);

  // ── Dark mode tokens ───────────────────────────────────────────────────────
  const bg = isDarkMode ? "bg-gray-900" : "bg-white";
  const cardBg = isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const hoverCard = isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-50";
  const selectedCard = isDarkMode ? "bg-purple-900/40 border-purple-500" : "bg-purple-50 border-purple-500";
  const textPrimary = isDarkMode ? "text-white" : "text-gray-900";
  const textSecondary = isDarkMode ? "text-gray-400" : "text-gray-500";
  const divider = isDarkMode ? "border-gray-700" : "border-gray-200";
  const inputCls = isDarkMode
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-500"
    : "bg-gray-50 border-gray-300 text-gray-900";

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchStudentsForTeacher = useCallback(async (teacherId) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/api/admin/lessons/teacher/${teacherId}/students`);
      setStudentList(data.students || []);
    } catch (err) {
      setError("Could not load students for this teacher.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeachersForStudent = useCallback(async (studentId) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/api/admin/lessons/student/${studentId}/teachers`);
      setTeacherList(data.teachers || []);
    } catch (err) {
      setError("Could not load teachers for this student.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async (teacherId, studentId) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(
        `/api/admin/lessons/bookings?teacherId=${teacherId}&studentId=${studentId}&type=${mode}`
      );
      setBookingList(data.bookings || []);
    } catch (err) {
      setError("Could not load classes.");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  // ── Step navigation ────────────────────────────────────────────────────────
  // Advance to next step and trigger any needed fetches
  const advance = useCallback(
    async (step_) => {
      const next = step_ ?? step + 1;
      setError("");

      if (STEPS[next] === "select_b") {
        // After selecting the "A" side, fetch the "B" side list
        if (startWith === "teacher" && selectedTeacher) {
          await fetchStudentsForTeacher(selectedTeacher._id);
        } else if (startWith === "student" && selectedStudent) {
          await fetchTeachersForStudent(selectedStudent._id);
        }
      }

      if (STEPS[next] === "pick_class" && selectedTeacher && selectedStudent) {
        await fetchBookings(selectedTeacher._id, selectedStudent._id);
      }

      setStep(next);
    },
    [step, startWith, selectedTeacher, selectedStudent, fetchStudentsForTeacher, fetchTeachersForStudent, fetchBookings]
  );

  // ── On mount: if a side is pre-filled, skip step 0 ────────────────────────
  useEffect(() => {
    if (startWith === "teacher" && preTeacher) {
      // Teacher is pre-filled; start at step 1 (pick student)
      fetchStudentsForTeacher(preTeacher._id);
      setStep(1);
    } else if (startWith === "student" && preStudent) {
      // Student is pre-filled; start at step 1 (pick teacher)
      fetchTeachersForStudent(preStudent._id);
      setStep(1);
    }
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedBooking) return;
    setSubmitting(true);
    setError("");
    try {
      const endpoint = isMarkMode ? "/api/admin/lessons/mark" : "/api/admin/lessons/unmark";
      const payload = { bookingId: selectedBooking._id };
      if (!isMarkMode && reason) payload.reason = reason;

      const { data } = await api.post(endpoint, payload);
      onSuccess?.(data);
      setStep(4); // done
    } catch (err) {
      setError(err.response?.data?.message || "Operation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Colour palette for mode ────────────────────────────────────────────────
  const modeColor = isMarkMode
    ? { accent: "emerald", btn: "bg-emerald-600 hover:bg-emerald-700", badge: "bg-emerald-100 text-emerald-700" }
    : { accent: "rose", btn: "bg-rose-600 hover:bg-rose-700", badge: "bg-rose-100 text-rose-700" };

  const ModeIcon = isMarkMode ? Check : RotateCcw;

  // ── Shared step header ─────────────────────────────────────────────────────
  const StepHeader = ({ icon: Icon, title, sub }) => (
    <div className="flex items-start gap-3 mb-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${modeColor.badge}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className={`text-base font-bold ${textPrimary}`}>{title}</h3>
        {sub && <p className={`text-sm mt-0.5 ${textSecondary}`}>{sub}</p>}
      </div>
    </div>
  );

  // ── Progress bar ───────────────────────────────────────────────────────────
  const totalSteps = 4; // excludes done step
  const progress = Math.min(step / (totalSteps - 1), 1);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${bg}`}>

        {/* ── Modal header ── */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${divider} ${isDarkMode ? "bg-gray-800" : "bg-gray-50"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${modeColor.badge}`}>
              <ModeIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className={`font-bold ${textPrimary}`}>
                {isMarkMode ? "Mark Lesson Complete" : "Unmark Lesson"}
              </h2>
              <p className={`text-xs ${textSecondary}`}>
                {isMarkMode
                  ? "Select the class to mark as completed"
                  : "Select the completed class to reverse"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Progress bar (only for non-done steps) ── */}
        {step < 4 && (
          <div className={`h-1 ${isDarkMode ? "bg-gray-700" : "bg-gray-100"}`}>
            <div
              className={`h-full transition-all duration-500 ${isMarkMode ? "bg-emerald-500" : "bg-rose-500"}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        {/* ── Modal body ── */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">

          {/* Error alert */}
          {error && (
            <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 0: Select "A" side (teacher or student based on startWith) */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 0 && startWith === "teacher" && (
            <>
              <StepHeader icon={GraduationCap} title="Select Teacher" sub="Choose the teacher for this lesson" />
              {/* For step 0 teacher side, we don't have a list — admin pastes teacher from the table so this step is usually skipped */}
              <p className={`text-sm ${textSecondary}`}>
                This modal was opened without a pre-selected teacher. Please close and click Mark/Unmark from a specific teacher card.
              </p>
            </>
          )}

          {step === 0 && startWith === "student" && (
            <>
              <StepHeader icon={User} title="Select Student" sub="Choose the student for this lesson" />
              <p className={`text-sm ${textSecondary}`}>
                This modal was opened without a pre-selected student. Please close and click Mark/Unmark from a specific student card.
              </p>
            </>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 1: Select the "B" side */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 1 && (
            <>
              {startWith === "teacher" ? (
                <>
                  <StepHeader
                    icon={User}
                    title="Select Student"
                    sub={`Students assigned to ${selectedTeacher?.firstName} ${selectedTeacher?.lastName}`}
                  />
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                    </div>
                  ) : studentList.length === 0 ? (
                    <p className={`text-sm text-center py-8 ${textSecondary}`}>
                      No students assigned to this teacher.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {studentList.map((s) => (
                        <button
                          key={s._id}
                          onClick={() => setSelectedStudent(s)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                            selectedStudent?._id === s._id ? selectedCard : `${cardBg} ${hoverCard}`
                          }`}
                        >
                          <p className={`font-semibold text-sm ${textPrimary}`}>
                            {s.firstName} {s.surname}
                          </p>
                          <p className={`text-xs mt-0.5 ${textSecondary}`}>
                            {s.email} · {s.noOfClasses} class{s.noOfClasses !== 1 ? "es" : ""} remaining
                          </p>
                          {isMarkMode && s.noOfClasses <= 0 && (
                            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                              No classes left
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <StepHeader
                    icon={GraduationCap}
                    title="Select Teacher"
                    sub={`Teachers assigned to ${selectedStudent?.firstName} ${selectedStudent?.surname}`}
                  />
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                    </div>
                  ) : teacherList.length === 0 ? (
                    <p className={`text-sm text-center py-8 ${textSecondary}`}>
                      No teachers assigned to this student.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {teacherList.map((t) => (
                        <button
                          key={t._id}
                          onClick={() => setSelectedTeacher(t)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                            selectedTeacher?._id === t._id ? selectedCard : `${cardBg} ${hoverCard}`
                          }`}
                        >
                          <p className={`font-semibold text-sm ${textPrimary}`}>
                            {t.firstName} {t.lastName}
                          </p>
                          <p className={`text-xs mt-0.5 ${textSecondary}`}>
                            {t.email} · Rate: {fmtMoney(t.ratePerClass)}/class
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 2: Pick a class */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <StepHeader
                icon={BookOpen}
                title={isMarkMode ? "Select Class to Mark" : "Select Class to Unmark"}
                sub={
                  isMarkMode
                    ? "Choose an accepted (pending) class to mark as completed"
                    : "Choose a completed class to reverse"
                }
              />
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
              ) : bookingList.length === 0 ? (
                <div className={`text-center py-8 ${textSecondary}`}>
                  <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {isMarkMode
                      ? "No accepted classes found for this pair."
                      : "No completed classes found for this pair."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bookingList.map((b) => (
                    <button
                      key={b._id}
                      onClick={() => setSelectedBooking(b)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                        selectedBooking?._id === b._id ? selectedCard : `${cardBg} ${hoverCard}`
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm truncate ${textPrimary}`}>
                            {b.classTitle}
                          </p>
                          {b.topic && (
                            <p className={`text-xs mt-0.5 ${textSecondary}`}>{b.topic}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className={`flex items-center gap-1 text-xs ${textSecondary}`}>
                              <Calendar className="w-3 h-3" />
                              {fmtDate(b.scheduledTime)}
                            </span>
                            <span className={`flex items-center gap-1 text-xs ${textSecondary}`}>
                              <Clock className="w-3 h-3" />
                              {b.duration} min
                            </span>
                          </div>
                        </div>
                        <span
                          className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium ${
                            b.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {b.status === "completed" ? "Completed" : "Accepted"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Unmark reason input */}
              {!isMarkMode && selectedBooking && (
                <div className="mt-4">
                  <label className={`block text-xs font-semibold mb-1.5 ${textSecondary}`}>
                    Reason for rejection (optional)
                  </label>
                  <div className="relative">
                    <MessageSquare className={`absolute left-3 top-3 w-4 h-4 ${textSecondary}`} />
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Student reported teacher did not show up..."
                      rows={3}
                      className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-rose-400 ${inputCls}`}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 3: Confirm */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 3 && selectedBooking && (
            <>
              <StepHeader
                icon={isMarkMode ? Check : AlertTriangle}
                title="Confirm Action"
                sub={`Review the details before ${isMarkMode ? "marking complete" : "rejecting"}`}
              />

              {/* Class card */}
              <div className={`rounded-xl border p-4 mb-4 ${cardBg}`}>
                <p className={`text-sm font-bold ${textPrimary} mb-3`}>📚 Class Details</p>
                <div className="space-y-2">
                  <InfoRow label="Class" value={selectedBooking.classTitle} textPrimary={textPrimary} textSecondary={textSecondary} />
                  {selectedBooking.topic && (
                    <InfoRow label="Topic" value={selectedBooking.topic} textPrimary={textPrimary} textSecondary={textSecondary} />
                  )}
                  <InfoRow label="Scheduled" value={fmtDate(selectedBooking.scheduledTime)} textPrimary={textPrimary} textSecondary={textSecondary} />
                  <InfoRow label="Duration" value={`${selectedBooking.duration} minutes`} textPrimary={textPrimary} textSecondary={textSecondary} />
                </div>
              </div>

              {/* People card */}
              <div className={`rounded-xl border p-4 mb-4 ${cardBg}`}>
                <p className={`text-sm font-bold ${textPrimary} mb-3`}>👥 People</p>
                <div className="space-y-2">
                  <InfoRow
                    label="Teacher"
                    value={`${selectedTeacher?.firstName} ${selectedTeacher?.lastName}`}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                  />
                  <InfoRow
                    label="Student"
                    value={`${selectedStudent?.firstName} ${selectedStudent?.surname}`}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                  />
                </div>
              </div>

              {/* What will happen */}
              <div className={`rounded-xl border p-4 mb-2 ${
                isMarkMode
                  ? isDarkMode ? "border-emerald-700/40 bg-emerald-900/20" : "border-emerald-200 bg-emerald-50"
                  : isDarkMode ? "border-rose-700/40 bg-rose-900/20" : "border-rose-200 bg-rose-50"
              }`}>
                <p className={`text-sm font-bold mb-3 ${isMarkMode ? "text-emerald-600" : "text-rose-600"}`}>
                  What will happen:
                </p>
                <ul className="space-y-1.5">
                  {isMarkMode ? (
                    <>
                      <li className="text-xs text-emerald-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        Booking status → Completed
                      </li>
                      <li className="text-xs text-emerald-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        Teacher earnings +{fmtMoney(selectedTeacher?.ratePerClass)}
                      </li>
                      <li className="text-xs text-emerald-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        Teacher lessons completed +1
                      </li>
                      <li className="text-xs text-emerald-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        Student classes remaining -1
                      </li>
                      <li className="text-xs text-emerald-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        Payment transaction created (pending)
                      </li>
                      <li className="text-xs text-emerald-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        Email sent to both teacher & student
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="text-xs text-rose-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                        Class flagged as "Rejected by Admin"
                      </li>
                      <li className="text-xs text-rose-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                        Teacher earnings -{fmtMoney(selectedTeacher?.ratePerClass)}
                      </li>
                      <li className="text-xs text-rose-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                        Teacher lessons completed -1
                      </li>
                      <li className="text-xs text-rose-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                        Student gets 1 class restored
                      </li>
                      <li className="text-xs text-rose-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                        Payment transaction cancelled
                      </li>
                      <li className="text-xs text-rose-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                        Email sent to both teacher & student
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {reason && !isMarkMode && (
                <p className={`text-xs mt-2 ${textSecondary}`}>
                  <strong>Reason:</strong> {reason}
                </p>
              )}
            </>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 4: Done ── */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 4 && (
            <div className="text-center py-8">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isMarkMode ? "bg-emerald-100" : "bg-rose-100"
              }`}>
                {isMarkMode ? (
                  <Check className="w-8 h-8 text-emerald-600" />
                ) : (
                  <RotateCcw className="w-8 h-8 text-rose-600" />
                )}
              </div>
              <h3 className={`text-lg font-bold mb-2 ${textPrimary}`}>
                {isMarkMode ? "Lesson Marked Complete!" : "Lesson Rejected Successfully!"}
              </h3>
              <p className={`text-sm ${textSecondary} mb-6`}>
                {isMarkMode
                  ? "Teacher earnings updated and notification emails sent to both parties."
                  : "Class flagged as rejected. Student's class has been restored and emails sent."}
              </p>
              <button
                onClick={onClose}
                className={`px-6 py-2.5 rounded-xl text-white font-semibold text-sm ${modeColor.btn} transition-all`}
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* ── Footer actions (not shown on done screen) ── */}
        {step < 4 && (
          <div className={`flex items-center justify-between px-6 py-4 border-t ${divider} ${isDarkMode ? "bg-gray-800" : "bg-gray-50"}`}>
            {/* Back button */}
            <button
              onClick={() => { setError(""); setStep((s) => Math.max(0, s - 1)); }}
              disabled={step === 0 || (preTeacher && step <= 1) || (preStudent && step <= 1)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                step === 0 || (preTeacher && step <= 1) || (preStudent && step <= 1)
                  ? "opacity-30 cursor-not-allowed"
                  : isDarkMode
                  ? "text-gray-300 hover:bg-gray-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {/* Next / Submit button */}
            {step < 3 ? (
              <button
                onClick={() => advance()}
                disabled={
                  loading ||
                  (step === 1 && !selectedStudent && startWith === "teacher") ||
                  (step === 1 && !selectedTeacher && startWith === "student") ||
                  (step === 2 && !selectedBooking)
                }
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${modeColor.btn}`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !selectedBooking}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${modeColor.btn}`}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isMarkMode ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {submitting
                  ? "Processing…"
                  : isMarkMode
                  ? "Mark Complete"
                  : "Reject Lesson"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tiny helper row ──────────────────────────────────────────────────────────
function InfoRow({ label, value, textPrimary, textSecondary }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className={`text-xs ${textSecondary} flex-shrink-0`}>{label}</span>
      <span className={`text-xs font-medium text-right ${textPrimary}`}>{value}</span>
    </div>
  );
}
