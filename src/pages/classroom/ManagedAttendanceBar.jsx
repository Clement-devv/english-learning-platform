// src/pages/classroom/ManagedAttendanceBar.jsx
// Teacher-only bar for classes with a managed student (no login). The student
// joins Google Meet / Zoom but never opens the app, so the teacher confirms it:
// "Mark student joined" → the class clock starts and the normal completion rules
// (83% together, credits, pay) apply. Never confirmed → the class ends as
// "not completed" (missed), which can be disputed.
import { useState } from "react";
import { UserCheck, UserX, Loader, Info } from "lucide-react";

const fmtClock = (d) => new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function ManagedAttendanceBar({ core }) {
  const { managedStudent, isStudentPresent, setManagedStudentPresence, managedPresenceBusy, managedJoinedAt } = core;
  const [error, setError] = useState("");
  if (!managedStudent) return null;

  const toggle = async () => {
    setError("");
    try { await setManagedStudentPresence(!isStudentPresent); }
    catch (e) { setError(e?.response?.data?.message || "Could not update attendance. Please try again."); }
  };

  return (
    <div
      role="region" aria-label="Student attendance"
      className={`px-4 sm:px-6 py-3 border-b flex flex-wrap items-center gap-3 ${
        isStudentPresent ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
      }`}
    >
      <div className="flex items-start gap-2 flex-1 min-w-[220px]">
        <Info className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isStudentPresent ? "text-emerald-600" : "text-amber-600"}`} />
        <p className={`text-sm leading-snug ${isStudentPresent ? "text-emerald-800" : "text-amber-800"}`}>
          {isStudentPresent ? (
            <><strong>Student is in class</strong>{managedJoinedAt ? ` · confirmed at ${fmtClock(managedJoinedAt)}` : ""}. Attendance is counting.</>
          ) : managedJoinedAt ? (
            <><strong>Student marked as left.</strong> Tap "Student is back" if they rejoin the call.</>
          ) : (
            <><strong>Managed student</strong> (no app login). When they join the call, tap <strong>"Student joined"</strong> to start the class.</>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={managedPresenceBusy}
        aria-pressed={isStudentPresent}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-60 ${
          isStudentPresent
            ? "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            : "bg-emerald-600 text-white hover:bg-emerald-700"
        }`}
      >
        {managedPresenceBusy
          ? <Loader className="w-4 h-4 animate-spin" />
          : isStudentPresent ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
        {isStudentPresent ? "Student left" : managedJoinedAt ? "Student is back" : "Student joined"}
      </button>

      {error && <p className="w-full text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
