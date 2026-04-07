// src/pages/student/tabs/StudentCompletedTab.jsx
import { useState, useEffect, useMemo } from "react";
import { getUserTimezone, dualTime, tzCity } from "../../../utils/timezone";
import {
  CheckCircle, XCircle, AlertCircle, Search,
  Calendar, Clock, GraduationCap,
  ChevronLeft, ChevronRight, RefreshCw, BookOpen,
} from "lucide-react";
import api from "../../../api";

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

function StudentDualTime({ scheduledTime, teacherTimezone }) {
  if (!scheduledTime) return <span>—</span>;
  const myTZ = getUserTimezone();
  const dual = dualTime(scheduledTime, myTZ, teacherTimezone);
  return (
    <span>
      {dual.myTime} {dual.myAbbr}
      {!dual.sameZone && teacherTimezone && (
        <span style={{ marginLeft: 6, opacity: 0.65, fontSize: "0.85em" }}>
          · Teacher ({tzCity(teacherTimezone)}): {dual.theirTime} {dual.theirAbbr}
        </span>
      )}
    </span>
  );
}

// ─── Why a class is "not completed" ──────────────────────────────────────────
function NotCompletedReason({ cls, isDarkMode }) {
  if (cls.adminRejected) {
    return (
      <div className={`mt-2.5 flex items-start gap-2 px-3 py-2 rounded-lg text-xs
        ${isDarkMode ? "bg-red-950/40 border border-red-800/40 text-red-300" : "bg-red-50 border border-red-200 text-red-700"}`}>
        <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Reversed by admin.</strong> The completion was reviewed and reversed — your class credit has been restored.
          {cls.adminRejectedReason && <span className="block mt-0.5"><strong>Reason:</strong> {cls.adminRejectedReason}</span>}
        </div>
      </div>
    );
  }
  if (cls.missedReason) {
    return (
      <div className={`mt-2.5 flex items-start gap-2 px-3 py-2 rounded-lg text-xs
        ${isDarkMode ? "bg-amber-950/40 border border-amber-800/40 text-amber-300" : "bg-amber-50 border border-amber-200 text-amber-700"}`}>
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Attendance requirement not met.</strong>
          <span className="block mt-0.5">{cls.missedReason}</span>
          <span className="block mt-1 opacity-75">Your class credit was not deducted.</span>
        </div>
      </div>
    );
  }
  return null;
}

export default function StudentCompletedTab({ studentId, isDarkMode }) {
  const [classes,     setClasses]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [search,      setSearch]      = useState("");
  const [startDate,   setStartDate]   = useState("");
  const [endDate,     setEndDate]     = useState("");
  const [tab,         setTab]         = useState("completed"); // "completed" | "not_completed"
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ── Colour tokens ──────────────────────────────────────────────────────────
  const bg        = isDarkMode ? "bg-gray-800"  : "bg-white";
  const textPrimary = isDarkMode ? "text-white"  : "text-gray-900";
  const textSub   = isDarkMode ? "text-gray-400" : "text-gray-500";
  const border    = isDarkMode ? "border-gray-700" : "border-gray-200";
  const hoverRow  = isDarkMode ? "hover:bg-gray-700/50" : "hover:bg-gray-50";
  const inputCls  = isDarkMode
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
    : "border-gray-300 text-gray-900 placeholder-gray-400";

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = async (silent = false) => {
    if (!studentId) return;
    silent ? setRefreshing(true) : setLoading(true);
    try {
      // ?status=completed returns BOTH "completed" and "missed" from the backend
      const { data } = await api.get(`/bookings/student/${studentId}?status=completed`);
      const normalised = (Array.isArray(data) ? data : []).map((b) => ({
        id:                  b._id,
        status:              b.status,            // "completed" | "missed"
        title:               b.classTitle,
        topic:               b.topic || "",
        teacher:             b.teacherId
          ? (b.teacherId.displayName?.trim() || `${b.teacherId.firstName} ${b.teacherId.lastName}`)
          : "—",
        scheduledTime:       b.scheduledTime,
        completedAt:         b.completedAt,
        duration:            b.duration || 60,
        adminRejected:       b.adminRejected       || false,
        adminRejectedReason: b.adminRejectedReason || "",
        adminRejectedAt:     b.adminRejectedAt,
        missedReason:        b.missedReason        || "",
        teacherTimezone:     b.teacherTimezone     || "",
      }));
      setClasses(normalised);
    } catch (err) {
      console.error("StudentCompletedTab load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [studentId]); // eslint-disable-line

  // ── Split into two buckets ─────────────────────────────────────────────────
  // Completed  = status "completed" AND not adminRejected
  // Not completed = status "missed" OR adminRejected
  const completedList    = useMemo(() => classes.filter((c) => c.status === "completed" && !c.adminRejected), [classes]);
  const notCompletedList = useMemo(() => classes.filter((c) => c.status === "missed" || c.adminRejected),     [classes]);

  const activeList = tab === "completed" ? completedList : notCompletedList;

  // ── Search + date filter ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = activeList;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.title.toLowerCase().includes(q) ||
               c.topic.toLowerCase().includes(q) ||
               c.teacher.toLowerCase().includes(q)
      );
    }
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      list = list.filter((c) => { const d = new Date(c.scheduledTime); return d >= s && d <= e; });
    }
    return list.sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));
  }, [activeList, search, startDate, endDate]);

  // Reset page when filters or tab changes
  useMemo(() => { setCurrentPage(1); }, [search, startDate, endDate, tab]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx   = (currentPage - 1) * itemsPerPage;
  const current    = filtered.slice(startIdx, startIdx + itemsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <div className="w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <span className={`text-sm ${textSub}`}>Loading your classes…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header card */}
      <div className={`${bg} rounded-2xl shadow-sm p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className={`text-xl font-bold ${textPrimary}`}>My Classes</h2>
            <p className={`text-sm mt-0.5 ${textSub}`}>
              {completedList.length} completed · {notCompletedList.length} not completed
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              isDarkMode ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-200 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* ── Tab switcher ── */}
        <div className={`flex gap-1 p-1 rounded-xl w-fit mb-5 ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`}>
          <button
            onClick={() => setTab("completed")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "completed"
                ? "bg-emerald-600 text-white shadow-sm"
                : isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Completed
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
              tab === "completed" ? "bg-white/20 text-white" : isDarkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
            }`}>
              {completedList.length}
            </span>
          </button>
          <button
            onClick={() => setTab("not_completed")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "not_completed"
                ? "bg-red-600 text-white shadow-sm"
                : isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <XCircle className="w-4 h-4" />
            Not Completed
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
              tab === "not_completed" ? "bg-white/20 text-white" : isDarkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
            }`}>
              {notCompletedList.length}
            </span>
          </button>
        </div>

        {/* Search + date filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textSub}`} />
            <input
              type="text"
              placeholder="Search class, topic, teacher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none ${inputCls}`}
            />
          </div>
          <input
            type="date" value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none ${inputCls}`}
          />
          <input
            type="date" value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={`px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none ${inputCls}`}
          />
        </div>
      </div>

      {/* Context note for not-completed tab */}
      {tab === "not_completed" && notCompletedList.length > 0 && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-xs ${
          isDarkMode ? "bg-amber-900/20 border border-amber-700/30 text-amber-400" : "bg-amber-50 border border-amber-200 text-amber-700"
        }`}>
          <span className="text-base flex-shrink-0">ℹ️</span>
          <span>
            Classes here either <strong>did not meet the attendance requirement</strong> (≥83% of class duration with both teacher and student present)
            or were <strong>reversed by admin</strong>. Credits for these classes are <strong>not deducted</strong> from your account.
          </span>
        </div>
      )}

      {/* Class list */}
      {current.length === 0 ? (
        <div className={`${bg} rounded-2xl shadow-sm py-16 text-center`}>
          <BookOpen className={`w-12 h-12 mx-auto mb-3 opacity-20 ${textSub}`} />
          <p className={`${textSub}`}>
            {search || startDate || endDate
              ? "No classes match your filters."
              : tab === "completed"
              ? "No completed classes yet."
              : "No incomplete classes — great attendance!"}
          </p>
          {(search || startDate || endDate) && (
            <button
              onClick={() => { setSearch(""); setStartDate(""); setEndDate(""); }}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className={`${bg} rounded-2xl shadow-sm divide-y ${border}`}>
          {current.map((cls, idx) => (
            <div
              key={cls.id}
              className={`p-5 ${hoverRow} transition-colors`}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Number bubble */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  tab === "completed"
                    ? isDarkMode ? "bg-emerald-900/60 text-emerald-300" : "bg-emerald-100 text-emerald-700"
                    : isDarkMode ? "bg-red-900/60 text-red-300"         : "bg-red-100 text-red-700"
                }`}>
                  {startIdx + idx + 1}
                </div>

                <div className="flex-1">
                  {/* Title + status chip */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h3 className={`font-semibold ${textPrimary}`}>{cls.title}</h3>
                    {tab === "completed" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3 h-3" /> Completed
                      </span>
                    ) : cls.adminRejected ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                        <XCircle className="w-3 h-3" /> Reversed by Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3 h-3" /> Attendance Not Met
                      </span>
                    )}
                  </div>

                  {cls.topic && (
                    <p className={`text-sm mt-0.5 ${textSub}`}>
                      <strong>Topic:</strong> {cls.topic}
                    </p>
                  )}

                  {/* Meta row */}
                  <div className={`flex flex-wrap gap-4 mt-2 text-sm ${textSub}`}>
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4" />
                      {cls.teacher}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <StudentDualTime scheduledTime={cls.scheduledTime} teacherTimezone={cls.teacherTimezone} />
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {cls.duration} min
                    </span>
                    {tab === "completed" && cls.completedAt && (
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle className="w-4 h-4" />
                        {fmtDateTime(cls.completedAt)}
                      </span>
                    )}
                  </div>

                  {/* Reason for not completing */}
                  {tab === "not_completed" && (
                    <NotCompletedReason cls={cls} isDarkMode={isDarkMode} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`p-2 rounded-xl transition-colors disabled:opacity-30 ${isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className={`text-sm ${textSub}`}>Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`p-2 rounded-xl transition-colors disabled:opacity-30 ${isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

    </div>
  );
}
