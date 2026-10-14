// src/pages/admin/tabs/BookingsTab.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createBooking } from "../../../services/bookingService";
import {
  Repeat, Plus, X, Search, ChevronDown, Calendar, Clock,
  BookOpen, User, Video, FileText, Info, Loader2, AlertCircle, FlaskConical,
} from "lucide-react";
import RecurringBookingForm from "../../../components/bookings/RecurringBookingForm";
import { useTranslation } from "react-i18next";

// ── Searchable dropdown (same pattern as AssignStudentsTab) ──────────────────
function SearchableSelect({ options, value, onChange, placeholder, isDarkMode, getId, getLabel, renderOption, disabled }) {
  const { t: tr } = useTranslation("admin");
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
    ? "bg-[var(--a-surface)] border-[var(--a-line)] text-stone-100 hover:border-ad-accent"
    : "bg-white border-stone-300 text-stone-900 hover:border-ad-accent";
  const dropdownCls = dm ? "bg-[var(--a-surface)] border-[var(--a-line)]" : "bg-white border-stone-200";
  const searchCls   = dm ? "bg-[var(--a-surface)] border-[var(--a-line)] text-stone-100 placeholder-stone-500"
                         : "bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400";
  const mutedCls    = dm ? "text-stone-400" : "text-stone-500";
  const hoverCls    = dm ? "hover:bg-[var(--a-raised)]" : "hover:bg-stone-50";
  const activeCls   = dm ? "bg-ad-accent-soft text-ad-accent-ink" : "bg-ad-accent-soft text-ad-accent-ink";
  const avatarCls   = dm ? "bg-ad-accent-soft text-ad-accent-ink" : "bg-ad-accent-soft text-ad-accent-ink";

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
        className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-ad-accent disabled:opacity-50 disabled:cursor-not-allowed ${triggerCls}`}
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
          <div className={`p-2 border-b ${dm ? "border-[var(--a-line)]" : "border-stone-100"}`}>
            <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${searchCls}`}>
              <Search size={13} className={mutedCls} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr("bookingsTab.typeToSearch")}
                className="text-sm bg-transparent outline-none w-full"
              />
              {query && (
                <button onClick={() => setQuery("")} className={mutedCls}><X size={11} /></button>
              )}
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
            {filtered.length === 0 ? (
              <p className={`text-xs text-center py-4 ${mutedCls}`}>{tr("bookingsTab.noResultsFound")}</p>
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

          <div className={`px-3 py-1.5 text-xs border-t ${mutedCls} ${dm ? "border-[var(--a-line)]" : "border-stone-100"}`}>
            {tr("bookingsTab.of", { filteredCount: filtered.length, optionsCount: options.length })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
// allowRecurring: false for sub-admins (recurring series are admin-only)
export default function BookingsTab({ teachers = [], students = [], onNotify, isDarkMode, allowRecurring = true }) {
  const { t: tr } = useTranslation("admin");
  const [teacherId, setTeacherId]       = useState("");
  const [studentId, setStudentId]       = useState("");
  const [classTitle, setClassTitle]     = useState("");
  const [topic, setTopic]               = useState("");
  const [duration, setDuration]         = useState("60");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes]               = useState("");
  const [isTrial, setIsTrial]           = useState(false);
  const [toast, setToast]               = useState({ message: "", type: "" });
  const [loading, setLoading]           = useState(false);
  const [errors, setErrors]             = useState({});
  const [showRecurringForm, setShowRecurringForm] = useState(false);

  // ── theme ───────────────────────────────────────────────────────────────────
  const dm = isDarkMode;
  const th = {
    page:       dm ? "bg-[var(--a-bg)] text-stone-100"          : "bg-stone-50 text-stone-900",
    card:       dm ? "bg-[var(--a-surface)] border-[var(--a-line)]"        : "bg-white border-stone-200",
    cardHead:   dm ? "bg-[var(--a-surface)] border-[var(--a-line)]"        : "bg-stone-50 border-stone-200",
    input:      dm ? "bg-[var(--a-surface)] border-[var(--a-line)] text-stone-100 placeholder-stone-500 focus:border-ad-accent"
                   : "bg-white border-stone-300 text-stone-900 placeholder-stone-400 focus:border-ad-accent",
    inputErr:   dm ? "border-red-500" : "border-red-400",
    label:      dm ? "text-stone-300" : "text-stone-700",
    muted:      dm ? "text-stone-400" : "text-stone-500",
    divider:    dm ? "border-[var(--a-line)]" : "border-stone-200",
    infoCard:   dm ? "bg-blue-900/20 border-blue-800/40 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800",
    infoHeading:dm ? "text-blue-300" : "text-blue-900",
    warningBg:  dm ? "bg-amber-900/20 border-amber-800/40 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800",
    modalBg:    dm ? "bg-[var(--a-surface)] border-[var(--a-line)]" : "bg-white border-stone-200",
    modalHead:  dm ? "bg-[var(--a-surface)] border-[var(--a-line)]" : "bg-stone-50 border-stone-200",
    clearBtn:   dm ? "border-[var(--a-line)] text-stone-300 hover:bg-[var(--a-raised)]" : "border-stone-300 text-stone-700 hover:bg-stone-50",
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
    if (!validateForm()) { showToast(tr("bookingsTab.pleaseFixTheErrorsBelow"), "error"); return; }
    setLoading(true);
    setErrors({});
    try {
      const teacher = teachers.find((t) => t._id === teacherId);
      const student = students.find((s) => s._id === studentId);
      if (!isTrial && student.classCredits <= 0) {
        showToast(tr("bookingsTab.hasNoClassesRemaining", { firstName: student.firstName, lastName: student.lastName }), "error");
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
        isTrial,
      });
      showToast(tr("bookingsTab.bookingSentToFor", { firstName: teacher.firstName, lastName: teacher.lastName, firstName2: student.firstName, lastName2: student.lastName }));
      if (onNotify) onNotify(`Booking request sent to ${teacher.firstName} ${teacher.lastName}`);
      clearForm();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || tr("bookingsTab.failedToCreateBooking"), "error");
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setTeacherId(""); setStudentId(""); setClassTitle("");
    setTopic(""); setDuration("60"); setScheduledTime("");
    setNotes(""); setIsTrial(false); setErrors({});
  };

  const getMinDateTime = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16);
  };

  const selectedStudent = students.find((s) => s._id === studentId);
  const noClassesLeft   = !isTrial && selectedStudent && selectedStudent.classCredits <= 0;

  const fieldCls = (key) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ad-accent transition ${th.input} ${errors[key] ? th.inputErr : ""}`;

  return (
    <div className={`min-h-full p-6 ${th.page}`}>

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast.message && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ui-toast-in
          ${toast.type === "error" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
          {toast.type === "error" ? <AlertCircle size={16} /> : <BookOpen size={16} />}
          {toast.message}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ad-accent-ink">{tr("bookingsTab.sendBookingRequest")}</h2>
          <p className={`text-sm mt-1 ${th.muted}`}>{tr("bookingsTab.createAClassRequestFor")}</p>
        </div>
        {allowRecurring && (
        <button
          onClick={() => setShowRecurringForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
        >
          <Repeat size={15} />
          {tr("bookingsTab.recurringClasses")}
        </button>
        )}
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────────── */}
      <div className="flex gap-6 items-start">

        {/* ── LEFT: Form ───────────────────────────────────────────────────── */}
        <div className={`flex-1 min-w-0 rounded-xl border overflow-hidden ${th.card}`}>
          <div className={`px-5 py-4 border-b flex items-center gap-2 ${th.cardHead} ${th.divider}`}>
            <Plus size={16} className="text-ad-accent-ink" />
            <span className="font-semibold text-sm">{tr("bookingsTab.bookingDetails")}</span>
          </div>

          <div className="p-5 space-y-5">

            {/* Teacher */}
            <div>
              <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${th.label}`}>
                <Video size={12} /> {tr("bookingsTab.teacher")} <span className="text-red-400">*</span>
              </label>
              <SearchableSelect
                options={teachers}
                value={teacherId}
                onChange={(v) => { setTeacherId(v); setErrors((e) => ({ ...e, teacher: "" })); }}
                placeholder={tr("bookingsTab.selectATeacher")}
                isDarkMode={dm}
                disabled={loading}
                getId={(o) => o._id}
                getLabel={(o) => `${o.firstName} ${o.lastName}`}
                renderOption={(o, isSelected, dark) => (
                  <div className="min-w-0">
                    <div className={`text-sm ${isSelected ? "font-medium" : ""}`}>
                      {o.firstName} {o.lastName}
                    </div>
                    <div className={`text-xs truncate ${dark ? "text-stone-500" : "text-stone-400"}`}>
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
                <User size={12} /> {tr("bookingsTab.student")} <span className="text-red-400">*</span>
              </label>
              <SearchableSelect
                options={students}
                value={studentId}
                onChange={(v) => { setStudentId(v); setErrors((e) => ({ ...e, student: "" })); }}
                placeholder={tr("bookingsTab.selectAStudent")}
                isDarkMode={dm}
                disabled={loading}
                getId={(o) => o._id}
                getLabel={(o) => `${o.firstName} ${o.lastName}`}
                renderOption={(o, isSelected, dark) => (
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                    <div>
                      <div className={`text-sm ${isSelected ? "font-medium" : ""}`}>
                        {o.firstName} {o.lastName}
                      </div>
                      <div className={`text-xs ${dark ? "text-stone-500" : "text-stone-400"}`}>
                        {tr("bookingsTab.classRemaining", { classCredits: o.classCredits, value: o.classCredits !== 1 ? "es" : "" })}</div>
                    </div>
                    {o.classCredits <= 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex-shrink-0">{tr("bookingsTab.noClasses")}</span>
                    )}
                  </div>
                )}
              />
              {errors.student && <p className="text-red-400 text-xs mt-1">{errors.student}</p>}
              {noClassesLeft && (
                <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${th.warningBg}`}>
                  <AlertCircle size={13} className="flex-shrink-0" />
                  {tr("bookingsTab.thisStudentHasNoClasses")}
                </div>
              )}
            </div>

            {/* Class Title */}
            <div>
              <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${th.label}`}>
                <BookOpen size={12} /> {tr("bookingsTab.classTitle")} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder={tr("bookingsTab.eGGrammarFundamentals")}
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
                <FileText size={12} /> {tr("bookingsTab.topic")} <span className={th.muted + " font-normal"}>{tr("bookingsTab.optional")}</span>
              </label>
              <input
                type="text"
                placeholder={tr("bookingsTab.eGPresentPerfectTense")}
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
                  <Clock size={12} /> {tr("bookingsTab.durationMin")} <span className="text-red-400">*</span>
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
                  <Calendar size={12} /> {tr("bookingsTab.dateTime")} <span className="text-red-400">*</span>
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
                <FileText size={12} /> {tr("bookingsTab.notes")} <span className={th.muted + " font-normal"}>{tr("bookingsTab.optional")}</span>
              </label>
              <textarea
                placeholder={tr("bookingsTab.anyAdditionalInformationForThe")}
                className={`${fieldCls("notes")} resize-none`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                rows={3}
                maxLength={500}
              />
              <div className={`text-right text-xs mt-1 ${th.muted}`}>{notes.length}/500</div>
            </div>

            {/* Trial Lesson Toggle */}
            <div
              onClick={() => !loading && setIsTrial((p) => !p)}
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border cursor-pointer select-none transition
                ${isTrial
                  ? dm ? "bg-amber-900/20 border-amber-700/50" : "bg-amber-50 border-amber-300"
                  : dm ? "bg-[var(--a-surface)] border-[var(--a-line)] hover:border-amber-600/40" : "bg-white border-stone-200 hover:border-amber-300"
                }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FlaskConical size={16} className={isTrial ? "text-amber-500" : dm ? "text-stone-500" : "text-stone-400"} />
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${isTrial ? "text-amber-500" : dm ? "text-stone-200" : "text-stone-700"}`}>
                    {tr("bookingsTab.trialLesson")}
                  </div>
                  <div className={`text-xs ${dm ? "text-stone-500" : "text-stone-400"}`}>
                    {tr("bookingsTab.noCreditDeductedNoPayment")}
                  </div>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full flex-shrink-0 transition-colors relative ${isTrial ? "bg-amber-500" : dm ? "bg-stone-700" : "bg-stone-300"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-[left] duration-200 ease-out ${isTrial ? "left-5" : "left-0.5"}`} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSendBooking}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-ad-accent hover:bg-ad-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
              >
                {loading ? (
                  <><Loader2 size={15} className="animate-spin" /> Sending…</>
                ) : isTrial ? (
                  <><FlaskConical size={15} /> Send Trial Booking</>
                ) : (
                  <><Plus size={15} /> Send Booking Request</>
                )}
              </button>
              <button
                onClick={clearForm}
                disabled={loading}
                className={`px-5 py-2.5 rounded-xl border text-sm font-medium transition ${th.clearBtn}`}
              >
                {tr("bookingsTab.clear")}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Info card ─────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* How it works */}
          <div className={`rounded-xl border p-5 ${dm ? "bg-[var(--a-surface)] border-[var(--a-line)]" : "bg-white border-stone-200"}`}>
            <div className={`flex items-center gap-2 font-semibold text-sm mb-4 ${dm ? "text-blue-300" : "text-blue-700"}`}>
              <Info size={15} />
              {tr("bookingsTab.howItWorks")}
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
                    ${dm ? "bg-ad-accent-soft text-ad-accent-ink" : "bg-ad-accent-soft text-ad-accent-ink"}`}>
                    {i + 1}
                  </span>
                  <span className={`text-xs leading-relaxed ${th.muted}`}>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Quick tips */}
          <div className={`rounded-xl border p-5 ${dm ? "bg-[var(--a-surface)] border-[var(--a-line)]" : "bg-white border-stone-200"}`}>
            <div className={`flex items-center gap-2 font-semibold text-sm mb-3 ${dm ? "text-amber-300" : "text-amber-700"}`}>
              <AlertCircle size={15} />
              {tr("bookingsTab.tips")}
            </div>
            <ul className={`text-xs space-y-2 ${th.muted}`}>
              <li className="flex items-start gap-2"><span className="mt-1">•</span> {tr("bookingsTab.studentsWith0ClassesRemaining")}</li>
              <li className="flex items-start gap-2"><span className="mt-1">•</span> {tr("bookingsTab.scheduledTimeMustBeAt")}</li>
              <li className="flex items-start gap-2"><span className="mt-1">•</span> {tr("bookingsTab.useRecurringClassesForRegular")}</li>
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
                <h2 className="text-lg font-bold">{tr("bookingsTab.createRecurringClasses")}</h2>
              </div>
              <button
                onClick={() => setShowRecurringForm(false)}
                className={`p-2 rounded-lg transition ${dm ? "hover:bg-[var(--a-raised)] text-stone-400" : "hover:bg-stone-100 text-stone-500"}`}
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
                  showToast(tr("bookingsTab.createdRecurringClasses", { occurrences: pattern.occurrences }));
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
