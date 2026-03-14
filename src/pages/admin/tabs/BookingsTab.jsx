// src/pages/admin/tabs/BookingsTab.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createBooking } from "../../../services/bookingService";
import {
  Repeat, Plus, X, Search, ChevronDown, Calendar, Clock,
  BookOpen, User, Video, FileText, Info, Loader2, AlertCircle,
} from "lucide-react";
import RecurringBookingForm from "../../../components/bookings/RecurringBookingForm";

// ── Searchable dropdown (same pattern as AssignStudentsTab) ──────────────────
function SearchableSelect({ options, value, onChange, placeholder, isDarkMode, getId, getLabel, renderOption, disabled }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const containerRef      = useRef(null);
  const inputRef          = useRef(null);

  const selected = options.find((o) => getId(o) === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => getLabel(o).toLowerCase().includes(q));
  }, [options, query, getLabel]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleSelect = (id) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
  };

  const dm = isDarkMode;
  const triggerCls = dm
    ? "bg-[#13161f] border-[#2a2f45] text-slate-100 hover:border-violet-500"
    : "bg-white border-slate-300 text-slate-900 hover:border-violet-500";
  const dropdownCls = dm ? "bg-[#1a1d27] border-[#2a2f45]" : "bg-white border-slate-200";
  const searchCls   = dm ? "bg-[#13161f] border-[#2a2f45] text-slate-100 placeholder-slate-500"
                         : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400";
  const mutedCls    = dm ? "text-slate-400" : "text-slate-500";
  const hoverCls    = dm ? "hover:bg-[#252d4a]" : "hover:bg-slate-50";
  const activeCls   = dm ? "bg-violet-900/40 text-violet-300" : "bg-violet-50 text-violet-700";
  const avatarCls   = dm ? "bg-violet-900/50 text-violet-300" : "bg-violet-100 text-violet-600";

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
        className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed ${triggerCls}`}
      >
        <span className={selected ? "" : mutedCls}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <span className="flex items-center gap-1 ml-2 flex-shrink-0">
          {selected && !disabled && (
            <span role="button" onClick={handleClear} className={`p-0.5 rounded hover:text-red-400 ${mutedCls}`}>
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`${mutedCls} transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className={`absolute z-50 mt-1 w-full rounded-xl border shadow-xl overflow-hidden ${dropdownCls}`}>
          <div className={`p-2 border-b ${dm ? "border-[#2a2f45]" : "border-slate-100"}`}>
            <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${searchCls}`}>
              <Search size={13} className={mutedCls} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search…"
                className="text-sm bg-transparent outline-none w-full"
              />
              {query && (
                <button onClick={() => setQuery("")} className={mutedCls}><X size={11} /></button>
              )}
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
            {filtered.length === 0 ? (
              <p className={`text-xs text-center py-4 ${mutedCls}`}>No results found</p>
            ) : (
              filtered.map((o) => {
                const id         = getId(o);
                const isSelected = id === value;
                return (
                  <div
                    key={id}
                    onClick={() => handleSelect(id)}
                    className={`px-3 py-2 text-sm rounded-lg cursor-pointer flex items-center gap-2.5 transition ${isSelected ? activeCls : hoverCls}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarCls}`}>
                      {getLabel(o)[0]?.toUpperCase() ?? "?"}
                    </div>
                    {renderOption ? renderOption(o, isSelected, dm) : (
                      <span className={isSelected ? "font-medium" : ""}>{getLabel(o)}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className={`px-3 py-1.5 text-xs border-t ${mutedCls} ${dm ? "border-[#2a2f45]" : "border-slate-100"}`}>
            {filtered.length} of {options.length}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BookingsTab({ teachers = [], students = [], onNotify, isDarkMode }) {
  const [teacherId, setTeacherId]       = useState("");
  const [studentId, setStudentId]       = useState("");
  const [classTitle, setClassTitle]     = useState("");
  const [topic, setTopic]               = useState("");
  const [duration, setDuration]         = useState("60");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes]               = useState("");
  const [toast, setToast]               = useState({ message: "", type: "" });
  const [loading, setLoading]           = useState(false);
  const [errors, setErrors]             = useState({});
  const [showRecurringForm, setShowRecurringForm] = useState(false);

  // ── theme ───────────────────────────────────────────────────────────────────
  const dm = isDarkMode;
  const th = {
    page:       dm ? "bg-[#0f1117] text-slate-100"          : "bg-slate-50 text-slate-900",
    card:       dm ? "bg-[#1a1d27] border-[#1e2235]"        : "bg-white border-slate-200",
    cardHead:   dm ? "bg-[#13161f] border-[#1e2235]"        : "bg-slate-50 border-slate-200",
    input:      dm ? "bg-[#13161f] border-[#2a2f45] text-slate-100 placeholder-slate-500 focus:border-violet-500"
                   : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-violet-500",
    inputErr:   dm ? "border-red-500" : "border-red-400",
    label:      dm ? "text-slate-300" : "text-slate-700",
    muted:      dm ? "text-slate-400" : "text-slate-500",
    divider:    dm ? "border-[#1e2235]" : "border-slate-200",
    infoCard:   dm ? "bg-blue-900/20 border-blue-800/40 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800",
    infoHeading:dm ? "text-blue-300" : "text-blue-900",
    warningBg:  dm ? "bg-amber-900/20 border-amber-800/40 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800",
    modalBg:    dm ? "bg-[#1a1d27] border-[#1e2235]" : "bg-white border-slate-200",
    modalHead:  dm ? "bg-[#13161f] border-[#1e2235]" : "bg-slate-50 border-slate-200",
    clearBtn:   dm ? "border-[#2a2f45] text-slate-300 hover:bg-[#1e2235]" : "border-slate-300 text-slate-700 hover:bg-slate-50",
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 4000);
  };

  const validateForm = () => {
    const errs = {};
    if (!teacherId)           errs.teacher       = "Please select a teacher";
    if (!studentId)           errs.student       = "Please select a student";
    if (!classTitle.trim())   errs.classTitle    = "Class title is required";
    if (!scheduledTime)       errs.scheduledTime = "Please select date and time";
    else if (new Date(scheduledTime) <= new Date())
                              errs.scheduledTime = "Scheduled time must be in the future";
    const d = parseInt(duration, 10);
    if (isNaN(d) || d < 15 || d > 180) errs.duration = "Duration must be 15–180 minutes";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSendBooking = async () => {
    if (!validateForm()) { showToast("Please fix the errors below.", "error"); return; }
    setLoading(true);
    setErrors({});
    try {
      const teacher = teachers.find((t) => t._id === teacherId);
      const student = students.find((s) => s._id === studentId);
      if (student.noOfClasses <= 0) {
        showToast(`${student.firstName} ${student.surname} has no classes remaining.`, "error");
        return;
      }
      await createBooking({
        teacherId, studentId,
        classTitle: classTitle.trim(),
        topic: topic.trim(),
        duration: parseInt(duration, 10),
        scheduledTime,
        notes: notes.trim(),
        createdBy: "admin",
      });
      showToast(`Booking sent to ${teacher.firstName} ${teacher.lastName} for ${student.firstName} ${student.surname}.`);
      if (onNotify) onNotify(`Booking request sent to ${teacher.firstName} ${teacher.lastName}`);
      clearForm();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || "Failed to create booking.", "error");
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setTeacherId(""); setStudentId(""); setClassTitle("");
    setTopic(""); setDuration("60"); setScheduledTime("");
    setNotes(""); setErrors({});
  };

  const getMinDateTime = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16);
  };

  const selectedStudent = students.find((s) => s._id === studentId);
  const noClassesLeft   = selectedStudent && selectedStudent.noOfClasses <= 0;

  const fieldCls = (key) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition ${th.input} ${errors[key] ? th.inputErr : ""}`;

  return (
    <div className={`min-h-full p-6 ${th.page}`}>

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast.message && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2
          ${toast.type === "error" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
          {toast.type === "error" ? <AlertCircle size={16} /> : <BookOpen size={16} />}
          {toast.message}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-violet-500">Send Booking Request</h2>
          <p className={`text-sm mt-1 ${th.muted}`}>Create a class request for a teacher to accept.</p>
        </div>
        <button
          onClick={() => setShowRecurringForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
        >
          <Repeat size={15} />
          Recurring Classes
        </button>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────────── */}
      <div className="flex gap-6 items-start">

        {/* ── LEFT: Form ───────────────────────────────────────────────────── */}
        <div className={`flex-1 min-w-0 rounded-xl border overflow-hidden ${th.card}`}>
          <div className={`px-5 py-4 border-b flex items-center gap-2 ${th.cardHead} ${th.divider}`}>
            <Plus size={16} className="text-violet-500" />
            <span className="font-semibold text-sm">Booking Details</span>
          </div>

          <div className="p-5 space-y-5">

            {/* Teacher */}
            <div>
              <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${th.label}`}>
                <Video size={12} /> Teacher <span className="text-red-400">*</span>
              </label>
              <SearchableSelect
                options={teachers}
                value={teacherId}
                onChange={(v) => { setTeacherId(v); setErrors((e) => ({ ...e, teacher: "" })); }}
                placeholder="Select a teacher…"
                isDarkMode={dm}
                disabled={loading}
                getId={(o) => o._id}
                getLabel={(o) => `${o.firstName} ${o.lastName}`}
                renderOption={(o, isSelected, dark) => (
                  <div className="min-w-0">
                    <div className={`text-sm ${isSelected ? "font-medium" : ""}`}>
                      {o.firstName} {o.lastName}
                    </div>
                    <div className={`text-xs truncate ${dark ? "text-slate-500" : "text-slate-400"}`}>
                      {o.email} · {o.continent}
                    </div>
                  </div>
                )}
              />
              {errors.teacher && <p className="text-red-400 text-xs mt-1">{errors.teacher}</p>}
            </div>

            {/* Student */}
            <div>
              <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${th.label}`}>
                <User size={12} /> Student <span className="text-red-400">*</span>
              </label>
              <SearchableSelect
                options={students}
                value={studentId}
                onChange={(v) => { setStudentId(v); setErrors((e) => ({ ...e, student: "" })); }}
                placeholder="Select a student…"
                isDarkMode={dm}
                disabled={loading}
                getId={(o) => o._id}
                getLabel={(o) => `${o.firstName} ${o.surname}`}
                renderOption={(o, isSelected, dark) => (
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                    <div>
                      <div className={`text-sm ${isSelected ? "font-medium" : ""}`}>
                        {o.firstName} {o.surname}
                      </div>
                      <div className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>
                        {o.noOfClasses} class{o.noOfClasses !== 1 ? "es" : ""} remaining
                      </div>
                    </div>
                    {o.noOfClasses <= 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex-shrink-0">No classes</span>
                    )}
                  </div>
                )}
              />
              {errors.student && <p className="text-red-400 text-xs mt-1">{errors.student}</p>}
              {noClassesLeft && (
                <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${th.warningBg}`}>
                  <AlertCircle size={13} className="flex-shrink-0" />
                  This student has no classes remaining. Please add classes first.
                </div>
              )}
            </div>

            {/* Class Title */}
            <div>
              <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${th.label}`}>
                <BookOpen size={12} /> Class Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Grammar Fundamentals"
                className={fieldCls("classTitle")}
                value={classTitle}
                onChange={(e) => { setClassTitle(e.target.value); setErrors((er) => ({ ...er, classTitle: "" })); }}
                disabled={loading}
                maxLength={100}
              />
              {errors.classTitle && <p className="text-red-400 text-xs mt-1">{errors.classTitle}</p>}
            </div>

            {/* Topic */}
            <div>
              <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${th.label}`}>
                <FileText size={12} /> Topic <span className={th.muted + " font-normal"}>(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Present Perfect Tense"
                className={fieldCls("topic")}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
                maxLength={100}
              />
            </div>

            {/* Duration + Scheduled Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${th.label}`}>
                  <Clock size={12} /> Duration (min) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  placeholder="60"
                  className={fieldCls("duration")}
                  value={duration}
                  onChange={(e) => { setDuration(e.target.value); setErrors((er) => ({ ...er, duration: "" })); }}
                  disabled={loading}
                  min="15"
                  max="180"
                />
                {errors.duration && <p className="text-red-400 text-xs mt-1">{errors.duration}</p>}
              </div>

              <div>
                <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${th.label}`}>
                  <Calendar size={12} /> Date & Time <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  className={`${fieldCls("scheduledTime")} ${dm ? "[color-scheme:dark]" : ""}`}
                  value={scheduledTime}
                  onChange={(e) => { setScheduledTime(e.target.value); setErrors((er) => ({ ...er, scheduledTime: "" })); }}
                  disabled={loading}
                  min={getMinDateTime()}
                />
                {errors.scheduledTime && <p className="text-red-400 text-xs mt-1">{errors.scheduledTime}</p>}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${th.label}`}>
                <FileText size={12} /> Notes <span className={th.muted + " font-normal"}>(optional)</span>
              </label>
              <textarea
                placeholder="Any additional information for the teacher…"
                className={`${fieldCls("notes")} resize-none`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                rows={3}
                maxLength={500}
              />
              <div className={`text-right text-xs mt-1 ${th.muted}`}>{notes.length}/500</div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSendBooking}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
              >
                {loading ? (
                  <><Loader2 size={15} className="animate-spin" /> Sending…</>
                ) : (
                  <><Plus size={15} /> Send Booking Request</>
                )}
              </button>
              <button
                onClick={clearForm}
                disabled={loading}
                className={`px-5 py-2.5 rounded-xl border text-sm font-medium transition ${th.clearBtn}`}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Info card ─────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* How it works */}
          <div className={`rounded-xl border p-5 ${dm ? "bg-[#1a1d27] border-[#1e2235]" : "bg-white border-slate-200"}`}>
            <div className={`flex items-center gap-2 font-semibold text-sm mb-4 ${dm ? "text-blue-300" : "text-blue-700"}`}>
              <Info size={15} />
              How it works
            </div>
            <ol className="space-y-3">
              {[
                "Select a teacher, student, and fill in the class details.",
                "The teacher receives the request in their Bookings tab.",
                "The teacher accepts or rejects the request.",
                "Once accepted, the class appears in both dashboards.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5
                    ${dm ? "bg-violet-900/50 text-violet-300" : "bg-violet-100 text-violet-600"}`}>
                    {i + 1}
                  </span>
                  <span className={`text-xs leading-relaxed ${th.muted}`}>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Quick tips */}
          <div className={`rounded-xl border p-5 ${dm ? "bg-[#1a1d27] border-[#1e2235]" : "bg-white border-slate-200"}`}>
            <div className={`flex items-center gap-2 font-semibold text-sm mb-3 ${dm ? "text-amber-300" : "text-amber-700"}`}>
              <AlertCircle size={15} />
              Tips
            </div>
            <ul className={`text-xs space-y-2 ${th.muted}`}>
              <li className="flex items-start gap-2"><span className="mt-1">•</span> Students with 0 classes remaining cannot be booked.</li>
              <li className="flex items-start gap-2"><span className="mt-1">•</span> Scheduled time must be at least 1 hour from now.</li>
              <li className="flex items-start gap-2"><span className="mt-1">•</span> Use Recurring Classes for regular weekly/biweekly sessions.</li>
            </ul>
          </div>
        </div>

      </div>

      {/* ── Recurring Booking Modal ───────────────────────────────────────────── */}
      {showRecurringForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl border w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl ${th.modalBg}`}>
            {/* Modal header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${th.modalHead} ${th.divider}`}>
              <div className="flex items-center gap-2">
                <Repeat size={18} className="text-sky-500" />
                <h2 className="text-lg font-bold">Create Recurring Classes</h2>
              </div>
              <button
                onClick={() => setShowRecurringForm(false)}
                className={`p-2 rounded-lg transition ${dm ? "hover:bg-[#252d4a] text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}
              >
                <X size={18} />
              </button>
            </div>
            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-6">
              <RecurringBookingForm
                teachers={teachers}
                students={students}
                onSuccess={(pattern) => {
                  setShowRecurringForm(false);
                  if (onNotify) onNotify(`Created ${pattern.occurrences} recurring classes!`);
                  showToast(`Created ${pattern.occurrences} recurring classes!`);
                }}
                onCancel={() => setShowRecurringForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
