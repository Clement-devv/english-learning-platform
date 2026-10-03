// src/pages/admin/tabs/RecordingsTab.jsx
// Same arrangement as the teacher's Recordings tab, one level higher:
//   1. Teacher list
//   2. That teacher's students (one row per student, count = classes)
//   3. The student's classes under date headings — one card per class,
//      Part 1 first, "See more" reveals the other parts / saved links
//   4. Video player — plays the parts back-to-back
// Admins view, download and open links; show/hide stays the teacher's choice.
import { useState, useEffect, useMemo } from "react";
import { Play, X, Clock, Calendar, Video, ChevronRight, ArrowLeft, Download, ExternalLink, ChevronDown, ChevronUp, Search } from "lucide-react";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import Pagination from "../../../components/Pagination";
import { groupRecordingSessions, groupByDay, partLabel, isExternal, linkSource, openExternal } from "../../../utils/recordingSessions.js";

const UNASSIGNED = "__unassigned__";
const studentKey = (rec) => rec.studentId?._id || rec.studentId?.id || UNASSIGNED;

export default function RecordingsTab({ teachers = [], isDarkMode }) {
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null); // { id, name, count }
  const [recordings,      setRecordings]      = useState([]);
  const [loadingRecs,     setLoadingRecs]     = useState(false);
  const [playing,         setPlaying]         = useState(null); // { key, index }
  const [videoUrls,       setVideoUrls]       = useState({});
  const [search,          setSearch]          = useState("");
  const [studentSearch,   setStudentSearch]   = useState("");
  const [expanded,        setExpanded]        = useState(() => new Set());
  const [toast,           setToast]           = useState("");

  const col = {
    card:   isDarkMode ? "#1a1d2e" : "#ffffff",
    border: isDarkMode ? "#2a2d40" : "#e8edf5",
    text:   isDarkMode ? "#e8eaf6" : "#1a1d2e",
    muted:  isDarkMode ? "#8b91b8" : "#6b7280",
    input:  isDarkMode ? "#1e2235" : "#f3f4f6",
    hover:  isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(99,102,241,0.04)",
    accent: "#6366f1",
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  // Recordings are paged by class on the server (10 classes per page)
  const [page,  setPage]  = useState(1);
  const [pager, setPager] = useState({ total: 0, totalPages: 1, limit: 10 });
  const [listKey, setListKey] = useState(0);
  const reloadAll = () => setListKey(k => k + 1);
  useOnDataChanged(["recordings"], reloadAll); // live
  const [studentList, setStudentList] = useState([]);   // per-student summary for the teacher
  const teacherIdOf = (t) => t?._id || t?.id;

  // Teacher selected → their students (a summary — not every recording)
  useEffect(() => {
    if (!selectedTeacher) { setStudentList([]); return; }
    setLoadingRecs(true);
    setStudentList([]);
    api.get("/recordings/students", { params: { teacherId: teacherIdOf(selectedTeacher) } })
      .then(r => setStudentList(r.data.students || []))
      .catch(() => showToast("Failed to load recordings"))
      .finally(() => setLoadingRecs(false));
  }, [selectedTeacher, listKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Student selected → one page of their classes with this teacher
  useEffect(() => {
    if (!selectedTeacher || !selectedStudent) { setRecordings([]); return; }
    let stale = false;
    setLoadingRecs(true);
    api.get(`/recordings/teacher/${teacherIdOf(selectedTeacher)}`, { params: { studentId: selectedStudent.id, page, limit: 10 } })
      .then(r => { if (stale) return; setRecordings(r.data.recordings || []); if (r.data.pagination) { setPager(r.data.pagination); if (r.data.pagination.page !== page) setPage(r.data.pagination.page); } })
      .catch(() => showToast("Failed to load recordings"))
      .finally(() => { if (!stale) setLoadingRecs(false); });
    return () => { stale = true; };
  }, [selectedTeacher, selectedStudent, page, listKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDuration = (s) => {
    if (!s) return "--";
    const m = Math.floor(s / 60), sec = Math.round(s % 60);
    return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  };

  const formatDate = (d) => new Date(d).toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
  });

  const formatSize = (b) => {
    if (!b) return "";
    return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Students of the selected teacher (count = classes, not files) ─────────
  const students = studentList;

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()));

  const studentSessions = useMemo(() => groupRecordingSessions(recordings), [recordings]); // already this student's page

  const allSessions = useMemo(() => groupRecordingSessions(recordings), [recordings]);

  const toggleExpanded = (key) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  // ── Load + play ────────────────────────────────────────────────────────────
  const fetchVideoUrl = async (rec) => {
    if (videoUrls[rec._id]) return videoUrls[rec._id];
    let url;
    const { data } = await api.get(`/recordings/${rec._id}/stream`);
    if (data?.url) {
      // S3: presigned URL — browser streams directly from S3, server carries zero load
      url = data.url;
    } else {
      // Local disk fallback: re-fetch as binary blob
      const { data: blob } = await api.get(`/recordings/${rec._id}/stream`, { responseType: 'blob' });
      url = URL.createObjectURL(blob);
    }
    setVideoUrls(prev => ({ ...prev, [rec._id]: url }));
    return url;
  };

  const loadVideo = async (session, index = 0) => {
    const rec = session.parts[index];
    if (!rec) return;
    if (isExternal(rec)) { openExternal(rec.externalUrl); return; } // recorded elsewhere — open the link
    try {
      await fetchVideoUrl(rec);
      setPlaying({ key: session.key, index });
    } catch { showToast("Failed to load video"); }
  };

  const downloadVideo = async (rec) => {
    try {
      const { data } = await api.get(`/recordings/${rec._id}/download`);
      if (data?.url) {
        // S3: presigned download URL — browser downloads directly from S3
        window.open(data.url, '_blank');
      } else {
        // Local disk fallback: fetch as blob and trigger download
        const { data: blob } = await api.get(`/recordings/${rec._id}/download`, { responseType: 'blob' });
        const ext  = rec.mimeType === "video/mp4" ? ".mp4" : ".webm";
        const base = (rec.title || rec.bookingId?.classTitle || "recording") + (rec.sessionId ? ` part ${rec.partNumber || 1}` : "");
        const name = base.replace(/[^a-z0-9\s-]/gi, "").trim() + ext;
        const url  = URL.createObjectURL(new Blob([blob]));
        const a    = document.createElement("a");
        a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
      }
    } catch { showToast("Download failed"); }
  };

  const filteredTeachers = teachers.filter(t =>
    `${t.displayName || ""} ${t.firstName} ${t.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const teacherName = selectedTeacher
    ? (selectedTeacher.displayName?.trim() || `${selectedTeacher.firstName} ${selectedTeacher.lastName}`)
    : "";

  const toastEl = toast && (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", padding: "12px 20px", background: "#1a1d2e", color: "#fff", borderRadius: "12px", fontWeight: 700, zIndex: 9999, border: "1px solid #2a2d40" }}>
      {toast}
    </div>
  );

  const backBtn = (label, onClick) => (
    <button onClick={onClick}
      style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", fontFamily: "inherit" }}>
      <ArrowLeft size={16} /> {label}
    </button>
  );

  const pill = (bg, color, text, title) => (
    <span title={title} style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "20px", background: bg, color }}>{text}</span>
  );

  // ── 4. Player ──────────────────────────────────────────────────────────────
  const playingSession = playing ? allSessions.find(s => s.key === playing.key) : null;
  const playingRec     = playingSession?.parts[playing.index] || null;

  if (playingRec) {
    const total   = playingSession.parts.length;
    // Auto-continue only into another of our videos (a link opens a new tab)
    const hasNext = playing.index < total - 1 && !isExternal(playingSession.parts[playing.index + 1]);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button onClick={() => setPlaying(null)} style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
            <X size={16} /> Back
          </button>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: col.text, flex: 1 }}>
            {playingRec.title || playingRec.bookingId?.classTitle || "Class Recording"}
            {total > 1 && (
              <span style={{ marginLeft: "10px", fontSize: "13px", fontWeight: 700, color: col.muted }}>
                Part {playing.index + 1} of {total}
              </span>
            )}
          </h2>
          <button onClick={() => downloadVideo(playingRec)}
            style={{ padding: "8px 14px", borderRadius: "10px", background: col.input, color: col.text, border: `1px solid ${col.border}`, cursor: "pointer", fontSize: "12px", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px" }}>
            <Download size={13} /> {total > 1 ? "Download this part" : "Download"}
          </button>
        </div>

        <div style={{ background: "#000", borderRadius: "16px", overflow: "hidden", aspectRatio: "16/9" }}>
          <video key={playingRec._id} src={videoUrls[playingRec._id]} controls autoPlay
            onEnded={() => { if (hasNext) loadVideo(playingSession, playing.index + 1); }}
            style={{ width: "100%", height: "100%", display: "block" }} />
        </div>

        {total > 1 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {playingSession.parts.map((p, i) => {
              const active = i === playing.index;
              return (
                <button key={p._id} onClick={() => loadVideo(playingSession, i)}
                  style={{ padding: "7px 12px", borderRadius: "10px", border: `1px solid ${active ? col.accent : col.border}`, background: active ? "rgba(99,102,241,0.12)" : col.card, color: active ? col.accent : col.text, cursor: "pointer", fontSize: "12px", fontWeight: 800, fontFamily: "inherit" }}>
                  {partLabel(p, total, i)}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "14px", padding: "14px 18px", display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: col.muted }}>
            <Calendar size={13} style={{ display: "inline", marginRight: "5px" }} />
            {formatDate(playingSession.classDate)}
          </span>
          <span style={{ fontSize: "13px", color: col.muted }}>
            <Clock size={13} style={{ display: "inline", marginRight: "5px" }} />
            {formatDuration(playingSession.totalDuration)}
          </span>
          <span style={{ fontSize: "13px", color: col.muted }}>👩‍🏫 {teacherName}</span>
          {playingRec.studentId && (
            <span style={{ fontSize: "13px", color: col.muted }}>👤 {playingRec.studentId.firstName} {playingRec.studentId.lastName}</span>
          )}
          {playingSession.totalSize > 0 && (
            <span style={{ fontSize: "13px", color: col.muted }}>💾 {formatSize(playingSession.totalSize)}</span>
          )}
          <span style={{ fontSize: "13px", color: playingSession.visibleToStudent ? "#10b981" : col.muted }}>
            {playingSession.visibleToStudent ? "👁 Visible to student" : "🚫 Hidden from student"}
          </span>
        </div>
        {toastEl}
      </div>
    );
  }

  // ── 3. One student's classes, grouped by day ───────────────────────────────
  if (selectedTeacher && selectedStudent) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {backBtn("Students", () => setSelectedStudent(null))}
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: col.text }}>{selectedStudent.name}</h2>
          <p style={{ margin: "2px 0 0", fontSize: "13px", color: col.muted }}>
            with {teacherName} · {loadingRecs ? "Loading…" : `${pager.total} recorded class${pager.total !== 1 ? "es" : ""}`}
          </p>
        </div>
      </div>

      {studentSessions.length === 0 ? (
        <div style={{ background: col.card, border: `2px dashed ${col.border}`, borderRadius: "18px", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎬</div>
          <p style={{ margin: 0, fontWeight: 800, color: col.text }}>No recordings yet</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {groupByDay(studentSessions).map(({ day, classes }) => (
            <section key={day} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Calendar size={14} color={col.accent} />
                <span style={{ fontSize: "13px", fontWeight: 900, color: col.text }}>{day}</span>
                <div style={{ flex: 1, height: "1px", background: col.border }} />
              </div>

              {classes.map(session => {
                const rec    = session.first;
                const total  = session.parts.length;
                const isOpen = expanded.has(session.key);
                const classTime = new Date(session.classDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                return (
                  <div key={session.key} style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "16px", overflow: "hidden" }}>
                    <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                      <div style={{ width: "58px", height: "42px", borderRadius: "10px", background: isExternal(rec) && total === 1 ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isExternal(rec) && total === 1 ? <ExternalLink size={18} color="white" /> : <Video size={18} color="white" />}
                      </div>

                      <div style={{ flex: 1, minWidth: "180px" }}>
                        <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {rec.title || rec.bookingId?.classTitle || "Class Recording"}
                        </p>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: "12px", color: col.muted, display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={11} /> {classTime}
                          </span>
                          {session.totalDuration > 0 && (
                            <span style={{ fontSize: "12px", color: col.muted }}>{formatDuration(session.totalDuration)} total</span>
                          )}
                          {total > 1 && pill("rgba(99,102,241,0.12)", col.accent, `${total} parts`)}
                          {session.hasExternal && pill("rgba(14,165,233,0.12)", "#0284c7", "🔗 External link", "The teacher recorded outside the app and saved the link")}
                          {session.visibleToStudent
                            ? pill("rgba(16,185,129,0.12)", "#10b981", "👁 Visible")
                            : pill("rgba(107,114,128,0.12)", col.muted, "🚫 Hidden")}
                        </div>
                        {total === 1 && isExternal(rec) && (
                          <p style={{ margin: "6px 0 0", fontSize: "12px", color: col.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={rec.externalUrl}>
                            {linkSource(rec.externalUrl)} · <span style={{ fontFamily: "monospace" }}>{rec.externalUrl}</span>
                            {rec.note ? <> · <em>{rec.note}</em></> : null}
                          </p>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "6px", flexShrink: 0, alignItems: "center" }}>
                        <button onClick={() => loadVideo(session, 0)} title={isExternal(rec) ? "Opens the teacher's link in a new tab" : total > 1 ? "Plays all parts in order" : "Watch recording"}
                          style={{ padding: "8px 14px", borderRadius: "10px", background: isExternal(rec) ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 800, display: "flex", alignItems: "center", gap: "5px" }}>
                          {isExternal(rec)
                            ? <><ExternalLink size={13} /> {total > 1 ? "Open Part 1" : "Open link"}</>
                            : <><Play size={13} fill="white" /> {total > 1 ? "Watch Part 1" : "Watch"}</>}
                        </button>
                        {total > 1 ? (
                          <button onClick={() => toggleExpanded(session.key)}
                            style={{ padding: "8px 12px", borderRadius: "10px", border: `1px solid ${isOpen ? col.accent : col.border}`, background: isOpen ? "rgba(99,102,241,0.12)" : "none", color: isOpen ? col.accent : col.text, cursor: "pointer", fontSize: "12px", fontWeight: 800, display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                            {isOpen ? <>Hide <ChevronUp size={14} /></> : <>See more ({total}) <ChevronDown size={14} /></>}
                          </button>
                        ) : !isExternal(rec) && (
                          <button onClick={() => downloadVideo(rec)} title="Download recording"
                            style={{ padding: "8px", borderRadius: "10px", border: `1px solid ${col.border}`, background: "none", color: col.text, cursor: "pointer" }}>
                            <Download size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {isOpen && total > 1 && (
                      <div style={{ borderTop: `1px solid ${col.border}`, background: col.input, padding: "6px 18px 10px", display: "flex", flexDirection: "column" }}>
                        {session.parts.map((p, i) => (
                          <div key={p._id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 0", borderBottom: i < total - 1 ? `1px dashed ${col.border}` : "none" }}>
                            <span style={{ width: "26px", height: "26px", borderRadius: "8px", background: col.card, border: `1px solid ${col.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 900, color: col.accent, flexShrink: 0 }}>
                              {i + 1}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {partLabel(p, total, i)}
                              </p>
                              {isExternal(p) && (
                                <p style={{ margin: "2px 0 0", fontSize: "11px", color: col.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.externalUrl}>
                                  <span style={{ fontFamily: "monospace" }}>{p.externalUrl}</span>{p.note ? ` · ${p.note}` : ""}
                                </p>
                              )}
                            </div>
                            {!isExternal(p) && p.fileSize > 0 && <span style={{ fontSize: "11px", color: col.muted }}>{formatSize(p.fileSize)}</span>}
                            <button onClick={() => loadVideo(session, i)} title={isExternal(p) ? "Open the saved link" : "Watch this part"}
                              style={{ padding: "6px 10px", borderRadius: "8px", background: isExternal(p) ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 800, display: "flex", alignItems: "center", gap: "4px" }}>
                              {isExternal(p) ? <><ExternalLink size={11} /> Open</> : <><Play size={11} fill="white" /> Watch</>}
                            </button>
                            {!isExternal(p) && (
                              <button onClick={() => downloadVideo(p)} title="Download this part"
                                style={{ padding: "6px", borderRadius: "8px", border: `1px solid ${col.border}`, background: col.card, color: col.text, cursor: "pointer" }}>
                                <Download size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
      {pager.totalPages > 1 && (
        <Pagination page={page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit}
          onPage={(p) => { setPage(p); setExpanded(new Set()); window.scrollTo({ top: 0, behavior: "smooth" }); }} isDarkMode={isDarkMode} />
      )}
      {toastEl}
    </div>
  );

  // ── 2. The teacher's students ──────────────────────────────────────────────
  if (selectedTeacher) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {backBtn("All Teachers", () => { setSelectedTeacher(null); setRecordings([]); setStudentSearch(""); })}
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: col.text }}>{teacherName}</h2>
          <p style={{ margin: "2px 0 0", fontSize: "13px", color: col.muted }}>
            {loadingRecs ? "Loading…" : `${students.length} student${students.length !== 1 ? "s" : ""} with recordings · select a student`}
          </p>
        </div>
      </div>

      {students.length > 0 && (
        <div style={{ position: "relative" }}>
          <Search size={15} color={col.muted}
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input type="text" placeholder="Search students…" value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px 10px 38px", borderRadius: "12px", border: `1px solid ${col.border}`, background: col.input, color: col.text, fontSize: "14px", fontFamily: "inherit", outline: "none" }} />
        </div>
      )}

      {!loadingRecs && students.length === 0 && (
        <div style={{ background: col.card, border: `2px dashed ${col.border}`, borderRadius: "18px", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎬</div>
          <p style={{ margin: 0, fontWeight: 800, color: col.text }}>No recordings yet</p>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: col.muted }}>This teacher hasn't recorded or linked any classes.</p>
        </div>
      )}

      {!loadingRecs && students.length > 0 && filteredStudents.length === 0 && (
        <p style={{ color: col.muted, fontSize: "14px" }}>No students match your search.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filteredStudents.map(s => {
          const initials = s.id === UNASSIGNED ? "—" : s.name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
          return (
            <button key={s.id} onClick={() => { setPage(1); setExpanded(new Set()); setSelectedStudent(s); }}
              style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", background: col.card, border: `1px solid ${col.border}`, borderRadius: "14px", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
              onMouseEnter={e => e.currentTarget.style.background = col.hover}
              onMouseLeave={e => e.currentTarget.style.background = col.card}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "16px", fontWeight: 900, color: "#fff" }}>{initials}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: col.muted }}>
                  {s.count} recorded class{s.count !== 1 ? "es" : ""}{s.links > 0 ? ` · ${s.links} external link${s.links !== 1 ? "s" : ""}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                <span style={{ fontSize: "12px", fontWeight: 800, color: col.muted, background: col.input, padding: "4px 10px", borderRadius: "20px" }}>{s.count}</span>
                <ChevronRight size={18} color={col.muted} />
              </div>
            </button>
          );
        })}
      </div>
      {toastEl}
    </div>
  );

  // ── 1. Teacher list ────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 900, color: col.text }}>🎬 Class Recordings</h2>
        <p style={{ margin: 0, fontSize: "13px", color: col.muted }}>Select a teacher, then a student, to view their classes</p>
      </div>

      <div style={{ position: "relative" }}>
        <Search size={15} color={col.muted}
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input type="text" placeholder="Search teachers…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px 10px 38px", borderRadius: "12px", border: `1px solid ${col.border}`, background: col.input, color: col.text, fontSize: "14px", fontFamily: "inherit", outline: "none" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filteredTeachers.length === 0 && (
          <p style={{ color: col.muted, fontSize: "14px" }}>No teachers found.</p>
        )}
        {filteredTeachers.map(t => {
          const id = t._id || t.id;
          return (
            <button key={id} onClick={() => { setSelectedTeacher(t); setSelectedStudent(null); }}
              style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", background: col.card, border: `1px solid ${col.border}`, borderRadius: "14px", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
              onMouseEnter={e => e.currentTarget.style.background = col.hover}
              onMouseLeave={e => e.currentTarget.style.background = col.card}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "16px", fontWeight: 900, color: "#fff" }}>{t.firstName?.[0]}{t.lastName?.[0]}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: col.text }}>
                  {t.displayName?.trim() || `${t.firstName} ${t.lastName}`}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: col.muted }}>{t.email}</p>
              </div>
              <ChevronRight size={18} color={col.muted} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
