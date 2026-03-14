import React, { useState, useEffect, useMemo, useRef } from "react";
import { Users, UserCheck, Search, Trash2, Plus, ChevronDown, X } from "lucide-react";
import { getAssignments, createAssignment, deleteAssignment } from "../../../services/assignmentService";

// ── Searchable dropdown combobox ─────────────────────────────────────────────
function SearchableSelect({ options, value, onChange, placeholder, isDarkMode, getLabel, getId }) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const containerRef          = useRef(null);
  const inputRef              = useRef(null);

  const selected = options.find((o) => getId(o) === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => getLabel(o).toLowerCase().includes(q));
  }, [options, query, getLabel]);

  // close on outside click
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

  // focus search input when dropdown opens
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

  const triggerClass = isDarkMode
    ? "bg-[#13161f] border-[#2a2f45] text-slate-100 hover:border-violet-500"
    : "bg-white border-slate-300 text-slate-900 hover:border-violet-500";

  const dropdownClass = isDarkMode
    ? "bg-[#1a1d27] border-[#2a2f45] shadow-xl"
    : "bg-white border-slate-200 shadow-xl";

  const searchClass = isDarkMode
    ? "bg-[#13161f] border-[#2a2f45] text-slate-100 placeholder-slate-500"
    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400";

  const itemBase   = "px-3 py-2 text-sm rounded-lg cursor-pointer flex items-center gap-2.5 transition";
  const itemActive = isDarkMode ? "bg-violet-900/40 text-violet-300" : "bg-violet-50 text-violet-700";
  const itemHover  = isDarkMode ? "hover:bg-[#252d4a]"               : "hover:bg-slate-100";
  const mutedCls   = isDarkMode ? "text-slate-400"                   : "text-slate-500";
  const avatarCls  = isDarkMode ? "bg-violet-900/50 text-violet-300" : "bg-violet-100 text-violet-600";

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${triggerClass}`}
      >
        <span className={selected ? "" : mutedCls}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <span className="flex items-center gap-1 ml-2 flex-shrink-0">
          {selected && (
            <span
              role="button"
              onClick={handleClear}
              className={`p-0.5 rounded hover:text-red-400 ${mutedCls}`}
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`${mutedCls} transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className={`absolute z-50 mt-1 w-full rounded-xl border overflow-hidden ${dropdownClass}`}>
          {/* Search input */}
          <div className={`p-2 border-b ${isDarkMode ? "border-[#2a2f45]" : "border-slate-100"}`}>
            <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${searchClass}`}>
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
                <button onClick={() => setQuery("")} className={mutedCls}>
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className={`text-xs text-center py-4 ${mutedCls}`}>No results found</p>
            ) : (
              filtered.map((o) => {
                const id        = getId(o);
                const label     = getLabel(o);
                const isSelected = id === value;
                return (
                  <div
                    key={id}
                    onClick={() => handleSelect(id)}
                    className={`${itemBase} ${isSelected ? itemActive : itemHover}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarCls}`}>
                      {label[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span className={isSelected ? "font-medium" : ""}>{label}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Count footer */}
          <div className={`px-3 py-1.5 text-xs border-t ${mutedCls} ${isDarkMode ? "border-[#2a2f45]" : "border-slate-100"}`}>
            {filtered.length} of {options.length}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssignStudentsTab({ teachers = [], students = [], onNotify, isDarkMode }) {
  const [teacherId, setTeacherId]   = useState("");
  const [studentId, setStudentId]   = useState("");
  const [assignments, setAssignments] = useState([]);
  const [toast, setToast]           = useState({ msg: "", type: "success" });
  const [loading, setLoading]       = useState(true);
  const [assigning, setAssigning]   = useState(false);
  const [search, setSearch]         = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");

  // ── theme helpers ────────────────────────────────────────────────────────────
  const t = {
    page:        isDarkMode ? "bg-[#0f1117] text-slate-100"            : "bg-slate-50 text-slate-900",
    card:        isDarkMode ? "bg-[#1a1d27] border-[#1e2235]"          : "bg-white border-slate-200",
    cardHeader:  isDarkMode ? "bg-[#13161f] border-[#1e2235]"          : "bg-slate-50 border-slate-200",
    input:       isDarkMode ? "bg-[#13161f] border-[#2a2f45] text-slate-100 placeholder-slate-500 focus:border-violet-500"
                            : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-violet-500",
    label:       isDarkMode ? "text-slate-300"                         : "text-slate-700",
    muted:       isDarkMode ? "text-slate-400"                         : "text-slate-500",
    tableHead:   isDarkMode ? "bg-[#13161f] text-slate-400"            : "bg-slate-50 text-slate-500",
    tableRow:    isDarkMode ? "border-[#1e2235] hover:bg-[#1e2235]"    : "border-slate-100 hover:bg-slate-50",
    badge:       isDarkMode ? "bg-violet-900/40 text-violet-300"       : "bg-violet-100 text-violet-700",
    badgeGreen:  isDarkMode ? "bg-emerald-900/40 text-emerald-300"     : "bg-emerald-100 text-emerald-700",
    divider:     isDarkMode ? "border-[#1e2235]"                       : "border-slate-200",
    statCard:    isDarkMode ? "bg-[#13161f] border-[#1e2235]"          : "bg-white border-slate-200",
    searchBg:    isDarkMode ? "bg-[#13161f] border-[#2a2f45]"          : "bg-white border-slate-200",
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3000);
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await getAssignments();
        setAssignments(data);
      } catch (err) {
        console.error("Error loading assignments:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAssign = async () => {
    if (!teacherId || !studentId) {
      showToast("Please select both a teacher and a student.", "error");
      return;
    }
    setAssigning(true);
    try {
      const newAssignment = await createAssignment({ teacherId, studentId });
      setAssignments((prev) => [newAssignment, ...prev]);
      const teacher = teachers.find((t) => t._id === teacherId);
      const student = students.find((s) => s._id === studentId);
      showToast(`${student?.firstName} assigned to ${teacher?.firstName}`);
      if (onNotify) onNotify(`Student ${student?.firstName} assigned to ${teacher?.firstName}`);
      setTeacherId("");
      setStudentId("");
    } catch (err) {
      showToast(err.response?.data?.message || "Error creating assignment.", "error");
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this assignment?")) return;
    try {
      await deleteAssignment(id);
      setAssignments((prev) => prev.filter((a) => a._id !== id));
      showToast("Assignment removed.");
    } catch (err) {
      showToast("Error removing assignment.", "error");
    }
  };

  // ── filtered list ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      const studentName = `${a.studentId?.firstName ?? ""} ${a.studentId?.surname ?? ""}`.toLowerCase();
      const teacherName = `${a.teacherId?.firstName ?? ""} ${a.teacherId?.lastName ?? ""}`.toLowerCase();
      const q = search.toLowerCase();
      const matchesSearch = !q || studentName.includes(q) || teacherName.includes(q);
      const matchesTeacher = !filterTeacher || a.teacherId?._id === filterTeacher;
      return matchesSearch && matchesTeacher;
    });
  }, [assignments, search, filterTeacher]);

  const uniqueTeachersInAssignments = useMemo(() => {
    const seen = new Set();
    return assignments
      .map((a) => a.teacherId)
      .filter((t) => t && !seen.has(t._id) && seen.add(t._id));
  }, [assignments]);

  // ── stat helpers ─────────────────────────────────────────────────────────────
  const totalAssignments = assignments.length;
  const uniqueTeacherCount = new Set(assignments.map((a) => a.teacherId?._id).filter(Boolean)).size;
  const uniqueStudentCount = new Set(assignments.map((a) => a.studentId?._id).filter(Boolean)).size;

  // ── alias for selected teacher/student name in dropdowns ─────────────────────
  const selectedTeacher = teachers.find((t) => t._id === teacherId);
  const selectedStudent = students.find((s) => s._id === studentId);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          Loading assignments…
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-full p-6 ${t.page}`}>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast.msg && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
          ${toast.type === "error" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-violet-500">Assign Students</h2>
        <p className={`text-sm mt-1 ${t.muted}`}>Link students to their assigned teachers.</p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Users,     label: "Total Assignments", value: totalAssignments,   color: "violet" },
          { icon: UserCheck, label: "Teachers Assigned", value: uniqueTeacherCount, color: "sky"    },
          { icon: UserCheck, label: "Students Assigned", value: uniqueStudentCount, color: "emerald"},
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className={`rounded-xl border p-4 flex items-center gap-4 ${t.statCard}`}>
            <div className={`p-2.5 rounded-lg
              ${color === "violet"  ? isDarkMode ? "bg-violet-900/40 text-violet-400"  : "bg-violet-100 text-violet-600"  : ""}
              ${color === "sky"     ? isDarkMode ? "bg-sky-900/40 text-sky-400"        : "bg-sky-100 text-sky-600"        : ""}
              ${color === "emerald" ? isDarkMode ? "bg-emerald-900/40 text-emerald-400": "bg-emerald-100 text-emerald-600": ""}
            `}>
              <Icon size={18} />
            </div>
            <div>
              <div className="text-2xl font-bold leading-tight">{value}</div>
              <div className={`text-xs ${t.muted}`}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main layout: form left, list right ─────────────────────────────── */}
      <div className="flex gap-6 items-start">

        {/* ── Assignment form ──────────────────────────────────────────────── */}
        <div className={`w-72 flex-shrink-0 rounded-xl border overflow-hidden ${t.card}`}>
          <div className={`px-5 py-4 border-b flex items-center gap-2 ${t.cardHeader} ${t.divider}`}>
            <Plus size={16} className="text-violet-500" />
            <span className="font-semibold text-sm">New Assignment</span>
          </div>

          <div className="p-5 space-y-4">
            {/* Teacher select */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${t.label}`}>Teacher</label>
              <SearchableSelect
                options={teachers}
                value={teacherId}
                onChange={setTeacherId}
                placeholder="Select a teacher…"
                isDarkMode={isDarkMode}
                getId={(o) => o._id}
                getLabel={(o) => `${o.firstName} ${o.lastName}`}
              />
            </div>

            {/* Student select */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${t.label}`}>Student</label>
              <SearchableSelect
                options={students}
                value={studentId}
                onChange={setStudentId}
                placeholder="Select a student…"
                isDarkMode={isDarkMode}
                getId={(o) => o._id}
                getLabel={(o) => `${o.firstName} ${o.surname}`}
              />
            </div>

            {/* Preview */}
            {(selectedTeacher || selectedStudent) && (
              <div className={`rounded-lg p-3 text-xs space-y-1 ${isDarkMode ? "bg-violet-900/20 border border-violet-800/30" : "bg-violet-50 border border-violet-100"}`}>
                {selectedStudent && (
                  <div className={t.muted}>
                    Student: <span className={`font-medium ${isDarkMode ? "text-violet-300" : "text-violet-700"}`}>
                      {selectedStudent.firstName} {selectedStudent.surname}
                    </span>
                  </div>
                )}
                {selectedTeacher && (
                  <div className={t.muted}>
                    Teacher: <span className={`font-medium ${isDarkMode ? "text-violet-300" : "text-violet-700"}`}>
                      {selectedTeacher.firstName} {selectedTeacher.lastName}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleAssign}
              disabled={assigning || !teacherId || !studentId}
              className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
            >
              {assigning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Assigning…
                </>
              ) : (
                <>
                  <Plus size={15} />
                  Assign Student
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Assignments list ─────────────────────────────────────────────── */}
        <div className={`flex-1 min-w-0 rounded-xl border overflow-hidden ${t.card}`}>
          {/* List header + filters */}
          <div className={`px-5 py-4 border-b flex flex-wrap items-center gap-3 ${t.cardHeader} ${t.divider}`}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Users size={16} className="text-violet-500 flex-shrink-0" />
              <span className="font-semibold text-sm">
                Current Assignments
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${t.badge}`}>
                  {filtered.length}
                </span>
              </span>
            </div>

            {/* Search */}
            <div className={`relative flex items-center rounded-lg border px-3 py-1.5 ${t.searchBg}`} style={{ minWidth: 180 }}>
              <Search size={13} className={`mr-2 flex-shrink-0 ${t.muted}`} />
              <input
                type="text"
                placeholder="Search name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`text-sm bg-transparent outline-none w-full ${isDarkMode ? "text-slate-100 placeholder-slate-500" : "text-slate-800 placeholder-slate-400"}`}
              />
            </div>

            {/* Filter by teacher */}
            <div className="relative">
              <select
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
                className={`rounded-lg border px-3 py-1.5 text-sm appearance-none pr-7 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition ${t.input}`}
                style={{ minWidth: 140 }}
              >
                <option value="">All teachers</option>
                {uniqueTeachersInAssignments.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.firstName} {teacher.lastName}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className={`absolute right-2 top-2.5 pointer-events-none ${t.muted}`} />
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-16 gap-3 ${t.muted}`}>
              <Users size={36} className="opacity-30" />
              <p className="text-sm">
                {assignments.length === 0 ? "No assignments yet." : "No results match your filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[520px]">
              <table className="w-full min-w-[520px] text-sm">
                <thead className={`sticky top-0 z-10 ${t.tableHead}`}>
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-xs uppercase tracking-wide">Student</th>
                    <th className="px-5 py-3 text-left font-medium text-xs uppercase tracking-wide">Teacher</th>
                    <th className="px-5 py-3 text-left font-medium text-xs uppercase tracking-wide">Assigned</th>
                    <th className="px-5 py-3 text-right font-medium text-xs uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? "divide-[#1e2235]" : "divide-slate-100"}`}>
                  {filtered.map((a) => (
                    <tr key={a._id} className={`transition ${t.tableRow}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                            ${isDarkMode ? "bg-emerald-900/50 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}>
                            {(a.studentId?.firstName?.[0] ?? "?").toUpperCase()}
                          </div>
                          <span className="font-medium truncate">
                            {a.studentId?.firstName} {a.studentId?.surname}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                            ${isDarkMode ? "bg-violet-900/50 text-violet-300" : "bg-violet-100 text-violet-600"}`}>
                            {(a.teacherId?.firstName?.[0] ?? "?").toUpperCase()}
                          </div>
                          <span className="font-medium truncate">
                            {a.teacherId?.firstName} {a.teacherId?.lastName}
                          </span>
                        </div>
                      </td>
                      <td className={`px-5 py-3 ${t.muted} text-xs`}>
                        {a.assignedDate
                          ? new Date(a.assignedDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDelete(a._id)}
                          title="Remove assignment"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition
                            ${isDarkMode
                              ? "bg-red-900/30 text-red-400 hover:bg-red-900/60"
                              : "bg-red-50 text-red-600 hover:bg-red-100"}`}
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
