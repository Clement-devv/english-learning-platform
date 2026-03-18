// src/pages/teacher/components/classes/CompletedClasses.jsx
import React, { useState, useMemo } from "react";
import { getUserTimezone, formatDateInTZ, tzAbbr } from "../../../../utils/timezone";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
  X,
} from "lucide-react";
import api from "../../../../api";

export default function CompletedClassesTab({ classes, teacherInfo, isDarkMode }) {
  const myTZ   = getUserTimezone();
  const myAbbr = tzAbbr(myTZ);
  const fmtScheduled = (raw) =>
    raw ? `${formatDateInTZ(raw, myTZ)} ${myAbbr}` : "—";
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | completed | not_completed
  const [exportError, setExportError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Dispute modal state
  const [disputeBooking, setDisputeBooking] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeError, setDisputeError] = useState("");
  const [disputeSuccess, setDisputeSuccess] = useState("");

  // Track which bookings have already had a dispute raised (persisted from server data)
  const [localDisputed, setLocalDisputed] = useState({});

  const itemsPerPage = 10;

  // ── Colours ──────────────────────────────────────────────────────────────
  const bg = isDarkMode ? "bg-gray-800" : "bg-white";
  const text = isDarkMode ? "text-gray-100" : "text-gray-800";
  const subText = isDarkMode ? "text-gray-400" : "text-gray-500";
  const border = isDarkMode ? "border-gray-700" : "border-gray-200";
  const hoverRow = isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-50";
  const inputCls = isDarkMode
    ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
    : "border-gray-300 text-gray-900";

  // ── Filter + search ───────────────────────────────────────────────────────
  const filteredClasses = useMemo(() => {
    let filtered = classes;

    if (statusFilter === "completed") {
      filtered = filtered.filter((c) => !c.adminRejected);
    } else if (statusFilter === "not_completed") {
      filtered = filtered.filter((c) => c.adminRejected);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (cls) =>
          cls.title?.toLowerCase().includes(q) ||
          cls.topic?.toLowerCase().includes(q) ||
          cls.students?.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((cls) => {
        const d = new Date(cls.scheduledTime);
        return d >= start && d <= end;
      });
    }

    return filtered.sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));
  }, [classes, searchQuery, startDate, endDate, statusFilter]);

  // Counts for tabs
  const completedCount = classes.filter((c) => !c.adminRejected).length;
  const notCompletedCount = classes.filter((c) => c.adminRejected).length;

  // Pagination
  const totalPages = Math.ceil(filteredClasses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentClasses = filteredClasses.slice(startIndex, startIndex + itemsPerPage);

  React.useEffect(() => { setCurrentPage(1); }, [searchQuery, startDate, endDate, statusFilter]);

  // ── PDF Export ────────────────────────────────────────────────────────────
  const generatePDF = async () => {
    try {
      setIsGenerating(true);
      setExportError("");
      if (!teacherInfo) { setExportError("Teacher information not available"); return; }

      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Completed Classes Report", 14, 20);
      doc.setFontSize(11);
      doc.text(`Teacher: ${teacherInfo.firstName} ${teacherInfo.lastName}`, 14, 30);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);

      autoTable(doc, {
        startY: 45,
        head: [["#", "Class", "Topic", "Students", "Date", "Duration", "Status"]],
        body: filteredClasses.map((cls, i) => [
          i + 1,
          cls.title,
          cls.topic || "—",
          cls.students?.join(", ") || "—",
          new Date(cls.scheduledTime).toLocaleDateString(),
          `${cls.duration} min`,
          cls.adminRejected ? "Not Completed" : "Completed",
        ]),
        theme: "striped",
        headStyles: { fillColor: [88, 28, 135] },
        styles: { fontSize: 8 },
      });

      doc.save(`completed-classes-${teacherInfo.firstName}-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      setExportError("Could not generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Dispute submission ────────────────────────────────────────────────────
  const openDisputeModal = (cls) => {
    setDisputeBooking(cls);
    setDisputeReason("");
    setDisputeError("");
    setDisputeSuccess("");
  };

  const closeDisputeModal = () => {
    setDisputeBooking(null);
    setDisputeReason("");
    setDisputeError("");
    setDisputeSuccess("");
  };

  const submitDispute = async () => {
    if (!disputeReason.trim()) {
      setDisputeError("Please describe the reason for your dispute.");
      return;
    }
    try {
      setDisputeSubmitting(true);
      setDisputeError("");
      await api.post(`/api/disputes/booking/${disputeBooking.id}`, { disputeReason: disputeReason.trim() });
      setDisputeSuccess("Dispute submitted successfully. The admin will review it shortly.");
      setLocalDisputed((prev) => ({ ...prev, [disputeBooking.id]: true }));
    } catch (err) {
      setDisputeError(err.response?.data?.message || "Failed to submit dispute. Please try again.");
    } finally {
      setDisputeSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className={`${bg} rounded-xl shadow-md p-5`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className={`text-xl font-bold ${text}`}>Completed Classes</h2>
            <p className={`text-sm mt-0.5 ${subText}`}>
              {completedCount} completed · {notCompletedCount} not completed (rejected by admin)
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={generatePDF}
              disabled={isGenerating || filteredClasses.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                isGenerating || filteredClasses.length === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              <Download className="w-4 h-4" />
              {isGenerating ? "Generating…" : "Export PDF"}
            </button>
          </div>
        </div>

        {exportError && (
          <p className="text-sm text-red-600 mb-3 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> {exportError}
          </p>
        )}

        {/* Status filter tabs */}
        <div className={`flex gap-1 p-1 rounded-lg mb-4 w-fit ${isDarkMode ? "bg-gray-700" : "bg-gray-100"}`}>
          {[
            { key: "all", label: `All (${classes.length})` },
            { key: "completed", label: `Completed (${completedCount})` },
            { key: "not_completed", label: `Not Completed (${notCompletedCount})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                statusFilter === key
                  ? key === "not_completed"
                    ? "bg-rose-600 text-white"
                    : "bg-purple-600 text-white"
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
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${subText}`} />
            <input
              type="text"
              placeholder="Search classes, topics, students…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none ${inputCls}`}
            />
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none ${inputCls}`}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={`px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none ${inputCls}`}
          />
        </div>

        <p className={`text-xs mt-2 ${subText}`}>
          Showing {filteredClasses.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredClasses.length)} of {filteredClasses.length} classes
        </p>
      </div>

      {/* Class list */}
      {currentClasses.length === 0 ? (
        <div className={`${bg} rounded-xl shadow-md p-12 text-center`}>
          <CheckCircle className={`w-12 h-12 mx-auto mb-3 opacity-25 ${subText}`} />
          <p className={`${subText} text-lg`}>
            {searchQuery || startDate || endDate || statusFilter !== "all"
              ? "No classes match your filters."
              : "No completed classes yet."}
          </p>
          {(searchQuery || startDate || endDate || statusFilter !== "all") && (
            <button
              onClick={() => { setSearchQuery(""); setStartDate(""); setEndDate(""); setStatusFilter("all"); }}
              className="mt-3 text-sm text-purple-600 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className={`${bg} rounded-xl shadow-md divide-y ${border}`}>
          {currentClasses.map((cls, idx) => {
            const isNotCompleted = cls.adminRejected;
            const alreadyDisputed = cls.disputeRaised || localDisputed[cls.id];
            return (
              <div key={cls.id || idx} className={`p-5 ${hoverRow} transition-colors`}>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex gap-3 flex-1">
                    {/* Index badge */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      isNotCompleted
                        ? "bg-red-100 text-red-700"
                        : isDarkMode
                        ? "bg-purple-900 text-purple-300"
                        : "bg-purple-100 text-purple-700"
                    }`}>
                      {startIndex + idx + 1}
                    </div>

                    <div className="flex-1">
                      {/* Title + status badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-semibold ${text}`}>{cls.title}</h3>
                        {isNotCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3" />
                            Not Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            Completed
                          </span>
                        )}
                        {alreadyDisputed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                            <MessageSquare className="w-3 h-3" />
                            Dispute Submitted
                          </span>
                        )}
                      </div>

                      {cls.topic && (
                        <p className={`text-sm mt-0.5 ${subText}`}>
                          <span className="font-medium">Topic:</span> {cls.topic}
                        </p>
                      )}

                      {/* Meta row */}
                      <div className={`flex flex-wrap items-center gap-4 mt-2 text-sm ${subText}`}>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {fmtScheduled(cls.scheduledTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {cls.duration} min
                        </span>
                        {cls.students?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {cls.students.join(", ")}
                          </span>
                        )}
                      </div>

                      {/* Admin rejection reason */}
                      {isNotCompleted && cls.adminRejectedReason && (
                        <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                          <strong>Admin reason:</strong> {cls.adminRejectedReason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Raise Dispute button — only for not-completed classes */}
                  {isNotCompleted && (
                    <div className="flex-shrink-0">
                      {alreadyDisputed ? (
                        <span className={`text-xs px-3 py-1.5 rounded-lg border ${
                          isDarkMode ? "border-amber-700 text-amber-400" : "border-amber-300 text-amber-600"
                        }`}>
                          Dispute pending review
                        </span>
                      ) : (
                        <button
                          onClick={() => openDisputeModal(cls)}
                          className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Raise Dispute
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className={`text-sm ${subText}`}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Raise Dispute Modal */}
      {disputeBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"} rounded-2xl shadow-2xl max-w-lg w-full p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-rose-500" />
                Raise a Dispute
              </h2>
              <button onClick={closeDisputeModal} className={`p-1 rounded-lg ${isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Class summary */}
            <div className={`rounded-lg p-3 mb-4 text-sm ${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
              <p className="font-semibold">{disputeBooking.title}</p>
              {disputeBooking.topic && <p className={subText}>Topic: {disputeBooking.topic}</p>}
              <p className={subText}>
                {disputeBooking.fullDateTime || new Date(disputeBooking.scheduledTime).toLocaleString()}
              </p>
              {disputeBooking.adminRejectedReason && (
                <p className="mt-1 text-red-500 text-xs">
                  Admin reason: {disputeBooking.adminRejectedReason}
                </p>
              )}
            </div>

            {disputeSuccess ? (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <p className="text-emerald-600 font-medium">{disputeSuccess}</p>
                <button
                  onClick={closeDisputeModal}
                  className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Explain why this class should be counted as completed:
                </label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="e.g. The class ran for the full duration. The student attended and we covered all topics…"
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none resize-none ${inputCls}`}
                />

                {disputeError && (
                  <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {disputeError}
                  </p>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={closeDisputeModal}
                    disabled={disputeSubmitting}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isDarkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitDispute}
                    disabled={disputeSubmitting || !disputeReason.trim()}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {disputeSubmitting ? "Submitting…" : "Submit Dispute"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
