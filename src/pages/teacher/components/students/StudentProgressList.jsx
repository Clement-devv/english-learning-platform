// src/pages/teacher/components/students/StudentProgressList.jsx
import React, { useState, useMemo } from "react";
import {
  Search, ChevronLeft, ChevronRight, TrendingUp,
  User, X, Calendar, Award, BookOpen, Clock,
} from "lucide-react";

function formatDob(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function calcAge(raw) {
  if (!raw) return null;
  const dob = new Date(raw);
  if (isNaN(dob)) return null;
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function StudentDetailModal({ student, isDarkMode, onClose }) {
  const dm = isDarkMode;
  const modalBg   = dm ? "bg-gray-800"   : "bg-white";
  const text      = dm ? "text-gray-100" : "text-gray-900";
  const subText   = dm ? "text-gray-400" : "text-gray-500";
  const divider   = dm ? "divide-gray-700" : "divide-gray-100";
  const rowBg     = dm ? "bg-gray-700/50" : "bg-gray-50";

  const dob     = formatDob(student.dateOfBirth);
  const age     = calcAge(student.dateOfBirth) ?? student.age;
  const initials = student.name
    ? student.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const rows = [
    { icon: Award,    label: "Rank / Level",       value: student.rank || "—" },
    { icon: Calendar, label: "Date of Birth",       value: dob ? `${dob}${age ? ` (age ${age})` : ""}` : "—" },
    { icon: BookOpen, label: "Classes remaining",   value: student.progress ?? 0 },
    { icon: TrendingUp, label: "Status",            value: student.active ? "Active" : "Inactive",
      badge: student.active
        ? dm ? "bg-emerald-900 text-emerald-300" : "bg-emerald-100 text-emerald-700"
        : dm ? "bg-gray-700 text-gray-400"       : "bg-gray-100 text-gray-500" },
    { icon: Clock,    label: "Assigned on",
      value: student.assignedDate
        ? new Date(student.assignedDate).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })
        : "—" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${modalBg} rounded-2xl shadow-2xl w-full max-w-md overflow-hidden`}>
        {/* Header */}
        <div className={`relative flex items-center gap-4 px-6 py-5 ${dm ? "bg-purple-900/40" : "bg-purple-50"}`}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${
            dm ? "bg-purple-700 text-purple-100" : "bg-purple-600 text-white"
          }`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-lg font-bold truncate ${text}`}>{student.name}</h2>
            {student.rank && (
              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                dm ? "bg-purple-800 text-purple-200" : "bg-purple-100 text-purple-700"
              }`}>
                {student.rank}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${
              dm ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Detail rows */}
        <div className={`divide-y ${divider} px-6 py-2`}>
          {rows.map(({ icon: Icon, label, value, badge }) => (
            <div key={label} className="flex items-center justify-between py-3 gap-3">
              <div className={`flex items-center gap-2 text-sm ${subText}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </div>
              {badge ? (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge}`}>{value}</span>
              ) : (
                <span className={`text-sm font-medium ${text}`}>{value}</span>
              )}
            </div>
          ))}
        </div>

        <div className="px-6 pb-5 pt-3">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StudentProgressList({ students, isDarkMode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const itemsPerPage = 12; // works better for grid

  const dm = isDarkMode;

  // ── colours ──────────────────────────────────────────────────────────────
  const pageBg    = dm ? "bg-gray-800"   : "bg-white";
  const cardBg    = dm ? "bg-gray-750 bg-gray-700" : "bg-white";
  const cardBorder= dm ? "border-gray-600 hover:border-purple-500" : "border-gray-200 hover:border-purple-300";
  const text      = dm ? "text-gray-100" : "text-gray-800";
  const subText   = dm ? "text-gray-400" : "text-gray-500";
  const inputCls  = dm
    ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500"
    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400";
  const paginBtn  = dm
    ? "border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
    : "border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40";

  // ── filter + pagination ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter((s) => s.name?.toLowerCase().includes(q));
  }, [students, searchQuery]);

  const totalPages     = Math.ceil(filtered.length / itemsPerPage);
  const startIndex     = (currentPage - 1) * itemsPerPage;
  const currentStudents = filtered.slice(startIndex, startIndex + itemsPerPage);

  React.useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className={`${pageBg} rounded-xl shadow-md px-5 py-4`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${subText}`} />
            <input
              type="text"
              placeholder="Search students…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none ${inputCls}`}
            />
          </div>
          <p className={`text-sm whitespace-nowrap ${subText}`}>
            {filtered.length === 0 ? "0 students" : `${startIndex + 1}–${Math.min(startIndex + itemsPerPage, filtered.length)} of ${filtered.length}`}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {currentStudents.length === 0 ? (
        <div className={`${pageBg} rounded-xl shadow-md p-12 text-center`}>
          <User className={`w-12 h-12 mx-auto mb-3 opacity-20 ${subText}`} />
          <p className={`text-base ${subText}`}>
            {searchQuery ? "No students match your search." : "No students assigned yet."}
          </p>
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="mt-2 text-sm text-purple-500 hover:underline">
              Clear search
            </button>
          )}
        </div>
      ) : (
        /* Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentStudents.map((student, idx) => {
            const initials = student.name
              ? student.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
              : "?";
            const dob = formatDob(student.dateOfBirth);
            const age = calcAge(student.dateOfBirth) ?? student.age;

            return (
              <div
                key={student.id}
                onClick={() => setSelected(student)}
                className={`${dm ? "bg-gray-700" : "bg-white"} rounded-xl border ${cardBorder} p-5 cursor-pointer transition-all hover:shadow-md flex flex-col gap-3`}
              >
                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    dm ? "bg-purple-800 text-purple-200" : "bg-purple-100 text-purple-700"
                  }`}>
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm truncate ${text}`}>{student.name}</p>
                    <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      student.active
                        ? dm ? "bg-emerald-900 text-emerald-300" : "bg-emerald-100 text-emerald-700"
                        : dm ? "bg-gray-600 text-gray-400"       : "bg-gray-100 text-gray-500"
                    }`}>
                      {student.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className={`space-y-1.5 text-xs ${subText}`}>
                  <div className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{student.rank || "No rank set"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{dob ? `${dob}${age ? ` · ${age}y` : ""}` : age ? `Age ${age}` : "DOB not set"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{student.progress ?? 0} classes remaining</span>
                  </div>
                </div>

                {/* View button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setSelected(student); }}
                  className="mt-auto w-full py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                >
                  View Details
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={`${pageBg} rounded-xl shadow-md px-5 py-3`}>
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${paginBtn}`}
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                const show = page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1);
                const ellipsis = page === currentPage - 2 || page === currentPage + 2;
                if (ellipsis) return <span key={page} className={`px-1 text-sm ${subText}`}>…</span>;
                if (!show) return null;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? "bg-purple-600 text-white"
                        : dm
                        ? "border border-gray-600 hover:bg-gray-700 text-gray-300"
                        : "border border-gray-300 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${paginBtn}`}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <StudentDetailModal
          student={selected}
          isDarkMode={isDarkMode}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
