// src/pages/student/tabs/StudentCompletedTab.jsx
// NEW standalone component for the student's "Completed Classes" tab
// Shows both normal completed classes AND admin-rejected ones with distinct styling
// Usage in StudentDashboard.jsx:
//   import StudentCompletedTab from "./tabs/StudentCompletedTab";
//   {activeTab === "completed-classes" && (
//     <StudentCompletedTab studentId={student.id} isDarkMode={isDarkMode} />
//   )}

import { useState, useEffect, useMemo } from "react";
import {
  CheckCircle,
  XCircle,
  Search,
  Calendar,
  Clock,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Filter,
  BookOpen,
} from "lucide-react";
import api from "../../../api";

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ adminRejected }) {
  if (adminRejected) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
        <XCircle className="w-3 h-3" />
        Rejected by Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
      <CheckCircle className="w-3 h-3" />
      Completed
    </span>
  );
}

export default function StudentCompletedTab({ studentId, isDarkMode }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | completed | rejected
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ── Colour tokens ─────────────────────────────────────────────────────────
  const bg = isDarkMode ? "bg-gray-800" : "bg-white";
  const textPrimary = isDarkMode ? "text-white" : "text-gray-900";
  const textSub = isDarkMode ? "text-gray-400" : "text-gray-500";
  const border = isDarkMode ? "border-gray-700" : "border-gray-200";
  const hoverRow = isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-50";
  const inputCls = isDarkMode
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
    : "border-gray-300 text-gray-900 placeholder-gray-400";

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = async (silent = false) => {
    if (!studentId) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      // Fetch ALL completed bookings for this student (including adminRejected ones)
      const { data } = await api.get(`/api/bookings/student/${studentId}?status=completed`);

      // Normalise shape
      const normalised = (Array.isArray(data) ? data : []).map((b) => ({
        id: b._id,
        title: b.classTitle,
        topic: b.topic || "",
        teacher: b.teacherId
          ? `${b.teacherId.firstName} ${b.teacherId.lastName}`
          : "—",
        scheduledTime: b.scheduledTime,
        completedAt: b.completedAt,
        duration: b.duration || 60,
        adminRejected: b.adminRejected || false,
        adminRejectedReason: b.adminRejectedReason || "",
        adminRejectedAt: b.adminRejectedAt,
      }));

      setClasses(normalised);
    } catch (err) {
      console.error("StudentCompletedTab load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [studentId]);

  // ── Filter + search ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = classes;

    if (statusFilter === "completed") list = list.filter((c) => !c.adminRejected);
    if (statusFilter === "rejected") list = list.filter((c) => c.adminRejected);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.topic.toLowerCase().includes(q) ||
          c.teacher.toLowerCase().includes(q)
      );
    }

    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      list = list.filter((c) => {
        const d = new Date(c.scheduledTime);
        return d >= s && d <= e;
      });
    }

    return list.sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));
  }, [classes, statusFilter, search, startDate, endDate]);

  const completedCount = classes.filter((c) => !c.adminRejected).length;
  const rejectedCount = classes.filter((c) => c.adminRejected).length;

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const current = filtered.slice(startIdx, startIdx + itemsPerPage);

  useMemo(() => { setCurrentPage(1); }, [search, startDate, endDate, statusFilter]);

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className={`text-xl font-bold ${textPrimary}`}>My Completed Classes</h2>
            <p className={`text-sm mt-0.5 ${textSub}`}>
              {completedCount} completed · {rejectedCount > 0 ? `${rejectedCount} rejected by admin` : "none rejected"}
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

        {/* Filter tabs */}
        <div className={`flex gap-1 p-1 rounded-xl w-fit mb-4 ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`}>
          {[
            { key: "all", label: `All (${classes.length})` },
            { key: "completed", label: `Completed (${completedCount})` },
            { key: "rejected", label: `Rejected (${rejectedCount})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                statusFilter === key
                  ? key === "rejected"
                    ? "bg-red-600 text-white"
                    : "bg-blue-600 text-white"
                  : isDarkMode
                  ? "text-gray-400 hover:text-gray-200"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
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
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none ${inputCls}`}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={`px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none ${inputCls}`}
          />
        </div>
      </div>

      {/* Class cards */}
      {current.length === 0 ? (
        <div className={`${bg} rounded-2xl shadow-sm py-16 text-center`}>
          <BookOpen className={`w-12 h-12 mx-auto mb-3 opacity-20 ${textSub}`} />
          <p className={`${textSub}`}>
            {search || startDate || endDate || statusFilter !== "all"
              ? "No classes match your filters."
              : "No completed classes yet."}
          </p>
          {(search || startDate || endDate || statusFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setStartDate(""); setEndDate(""); setStatusFilter("all"); }}
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
              className={`p-5 ${hoverRow} transition-colors ${cls.adminRejected ? (isDarkMode ? "bg-red-950/20" : "bg-red-50/50") : ""}`}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Number */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  cls.adminRejected
                    ? "bg-red-100 text-red-700"
                    : isDarkMode
                    ? "bg-blue-900 text-blue-300"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {startIdx + idx + 1}
                </div>

                <div className="flex-1">
                  {/* Title + badge */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h3 className={`font-semibold ${textPrimary}`}>{cls.title}</h3>
                    <StatusBadge adminRejected={cls.adminRejected} />
                  </div>

                  {cls.topic && (
                    <p className={`text-sm mt-0.5 ${textSub}`}>
                      <strong>Topic:</strong> {cls.topic}
                    </p>
                  )}

                  {/* Meta */}
                  <div className={`flex flex-wrap gap-4 mt-2 text-sm ${textSub}`}>
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4" />
                      {cls.teacher}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {fmtDateTime(cls.scheduledTime)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {cls.duration} min
                    </span>
                    {cls.completedAt && !cls.adminRejected && (
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle className="w-4 h-4" />
                        Completed {fmtDateTime(cls.completedAt)}
                      </span>
                    )}
                  </div>

                  {/* Rejection info */}
                  {cls.adminRejected && (
                    <div className="mt-2.5 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-100 border border-red-200 text-red-700 text-xs">
                      <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Admin rejected this class.</strong> Your class has been restored to your account.
                        {cls.adminRejectedReason && (
                          <span className="block mt-0.5">
                            <strong>Reason:</strong> {cls.adminRejectedReason}
                          </span>
                        )}
                      </div>
                    </div>
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

      {/* Info note */}
      {rejectedCount > 0 && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-xs ${
          isDarkMode ? "bg-amber-900/20 border border-amber-700/30 text-amber-400" : "bg-amber-50 border border-amber-200 text-amber-700"
        }`}>
          <span className="text-base flex-shrink-0">ℹ️</span>
          <span>
            Classes marked <strong>Rejected by Admin</strong> mean an admin reviewed and reversed the completion. 
            The class was <strong>not counted</strong> and your balance has been restored. 
            Contact admin if you believe this was an error.
          </span>
        </div>
      )}
    </div>
  );
}
