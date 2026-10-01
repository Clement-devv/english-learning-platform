// src/pages/teacher/tabs/RecordingsTab.jsx
// Three-tier flow (mirrors admin RecordingsTab):
//   1. Student list  — recordings grouped by student, with search
//   2. Classes       — the selected student's classes; a class recorded in
//                      parts shows Part 1, "…" reveals the remaining parts
//   3. Video player  — plays the parts back-to-back + toggle/download/delete
import { useState, useEffect, useMemo } from "react";
import { Trash2, Eye, EyeOff, Play, X, Clock, Calendar, Video, Download, ChevronRight, ArrowLeft, Search, ChevronDown, ChevronUp, Link2, ExternalLink, Pencil } from "lucide-react";
import api from "../../../api";
import { groupRecordingSessions, groupByDay, partLabel, isExternal, linkSource, openExternal } from "../../../utils/recordingSessions.js";
import ExternalRecordingModal from "../../../components/ExternalRecordingModal.jsx";
import Pagination from "../../../components/Pagination";


export default function RecordingsTab({ isDarkMode }) {
  const [recordings,      setRecordings]      = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [playing,         setPlaying]         = useState(null); // { key, index } — session key + part index
  const [videoUrls,       setVideoUrls]       = useState({});
  const [toast,           setToast]           = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null); // { id, name, email, count }
  const [search,          setSearch]          = useState("");
  const [expanded,        setExpanded]        = useState(() => new Set()); // session keys showing all parts
  const [linkModal,       setLinkModal]       = useState(null); // { studentId?, editing? } — add/edit external link

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

  // Saved from the "Add recording link" form (new link or edited one)
  const handleLinkSaved = (rec) => {
    const wasEdit = !!linkModal?.editing;
    setRecordings(prev => wasEdit
      ? prev.map(r => r._id === rec._id ? rec : r)
      : [rec, ...prev]);
    setLinkModal(null);
    reloadAll();
    showToast(wasEdit ? "Recording link updated ✓" : "Recording link saved ✓");
  };

  const linkModalEl = linkModal && (
    <ExternalRecordingModal
      isDarkMode={isDarkMode}
      studentId={linkModal.studentId || null}
      editing={linkModal.editing || null}
      onClose={() => setLinkModal(null)}
      onSaved={handleLinkSaved}
    />
  );

  const addLinkBtn = (studentId) => (
    <button onClick={() => setLinkModal({ studentId })}
      title="Recorded in Zoom or Google Meet? Save the link here"
      style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "10px", border: `1px solid ${col.accent}`, background: "rgba(99,102,241,0.08)", color: col.accent, cursor: "pointer", fontSize: "13px", fontWeight: 800, fontFamily: "inherit", flexShrink: 0 }}>
      <Link2 size={15} /> Add recording link
    </button>
  );

  // Recordings are paged by class on the server (10 classes per page)
  const [page,  setPage]  = useState(1);
  const [pager, setPager] = useState({ total: 0, totalPages: 1, limit: 10 });
  const [listKey, setListKey] = useState(0);
  const reloadAll = () => setListKey(k => k + 1);
  const [studentList, setStudentList] = useState([]);   // per-student summary
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    api.get("/recordings/students")
      .then(r => setStudentList(r.data.students || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [listKey]);

  // One page of the selected student's classes
  useEffect(() => {
    if (!selectedStudent) { setRecordings([]); return; }
    let stale = false;
    setLoadingRecs(true);
    api.get("/recordings", { params: { studentId: selectedStudent.id, page, limit: 10 } })
      .then(r => { if (stale) return; setRecordings(r.data.recordings || []); if (r.data.pagination) { setPager(r.data.pagination); if (r.data.pagination.page !== page) setPage(r.data.pagination.page); } })
      .catch(() => {})
      .finally(() => { if (!stale) setLoadingRecs(false); });
    return () => { stale = true; };
  }, [selectedStudent, page, listKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const daysUntilDelete = (autoDeleteAt) => {
    if (!autoDeleteAt) return null;
    const days = Math.ceil((new Date(autoDeleteAt) - new Date()) / (1000 * 60 * 60 * 24));
    return days;
  };

  // ── Group recordings by student (client-side) ─────────────────────────────
  // Recordings without a studentId are bucketed under an "Unassigned" group
  // so older / group-class recordings remain reachable. Count = classes, not parts.
  const students = studentList;

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const studentRecordings = recordings; // already this student's page

  // One entry per class; parts of a split recording are grouped together
  const studentSessions = useMemo(() => groupRecordingSessions(studentRecordings), [studentRecordings]);
  const allSessions     = useMemo(() => groupRecordingSessions(recordings), [recordings]);

  const toggleExpanded = (key) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  // ── Toggle visibility (applies to every video of the class) ───────────────
  const toggleVisibility = async (session) => {
    const visibleToStudent = !session.visibleToStudent;
    try {
      if (session.bookingId) {
        await api.patch(`/recordings/booking/${session.bookingId}/visibility`, { visibleToStudent });
      } else {
        await api.patch(`/recordings/${session.first._id}/visibility`);
      }
      const ids = new Set(session.parts.map(p => p._id));
      setRecordings(prev => prev.map(r => ids.has(r._id) ? { ...r, visibleToStudent } : r));
      showToast(visibleToStudent ? "Visible to student ✓" : "Hidden from student");
    } catch { showToast("Failed to update visibility"); }
  };

  // ── Delete a whole class (all parts) ──────────────────────────────────────
  const handleDeleteSession = async (session) => {
    const title = session.first.title || session.first.bookingId?.classTitle || "this recording";
    const what  = session.parts.length > 1 ? `all ${session.parts.length} videos of "${title}"` : `"${title}"`;
    if (!confirm(`Delete ${what}? This cannot be undone.`)) return;
    try {
      if (session.bookingId)      await api.delete(`/recordings/booking/${session.bookingId}`);
      else if (session.sessionId) await api.delete(`/recordings/session/${session.sessionId}`);
      else                        await api.delete(`/recordings/${session.first._id}`);
      const ids = new Set(session.parts.map(p => p._id));
      setRecordings(prev => prev.filter(r => !ids.has(r._id)));
      if (playing?.key === session.key) setPlaying(null);
      reloadAll();
      showToast("Recording deleted");
    } catch { showToast("Failed to delete"); }
  };

  // ── Delete a single part ───────────────────────────────────────────────────
  const handleDeletePart = async (rec, total, index) => {
    if (!confirm(`Delete ${partLabel(rec, total, index) || "this recording"}? This cannot be undone.`)) return;
    try {
      await api.delete(`/recordings/${rec._id}`);
      setRecordings(prev => prev.filter(r => r._id !== rec._id));
      setPlaying(null);
      reloadAll();
      showToast("Part deleted");
    } catch { showToast("Failed to delete"); }
  };

  // ── Load + play video ──────────────────────────────────────────────────────
  const fetchVideoUrl = async (rec) => {
    if (videoUrls[rec._id]) return videoUrls[rec._id];
    let url;
    const { data } = await api.get(`/recordings/${rec._id}/stream`);
    if (data?.url) {
      url = data.url;
    } else {
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

  // ── Download video ─────────────────────────────────────────────────────────
  const downloadVideo = async (rec) => {
    try {
      const { data } = await api.get(`/recordings/${rec._id}/download`);
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
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

  // ── Player ─────────────────────────────────────────────────────────────────
  const playingSession = playing ? allSessions.find(s => s.key === playing.key) : null;
  const playingRec     = playingSession?.parts[playing.index] || null;

  if (playingRec) {
    const total  = playingSession.parts.length;
    // Auto-continue only into another of our videos (a link opens a new tab)
    const hasNext = playing.index < total - 1 && !isExternal(playingSession.parts[playing.index + 1]);
    return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
      </div>

      <div style={{ background: "#000", borderRadius: "16px", overflow: "hidden", aspectRatio: "16/9" }}>
        {/* key forces a fresh element per part; onEnded continues with the next part */}
        <video key={playingRec._id} src={videoUrls[playingRec._id]} controls autoPlay
          onEnded={() => { if (hasNext) loadVideo(playingSession, playing.index + 1); }}
          style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      {/* Part picker */}
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

      <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "14px", padding: "14px 18px", display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", color: col.muted }}>
            <Calendar size={13} style={{ display: "inline", marginRight: "5px" }} />
            {formatDate(playingSession.classDate)}
          </span>
          <span style={{ fontSize: "13px", color: col.muted }}>
            <Clock size={13} style={{ display: "inline", marginRight: "5px" }} />
            {formatDuration(playingSession.totalDuration)}
          </span>
          {playingRec.studentId && (
            <span style={{ fontSize: "13px", color: col.muted }}>
              👤 {playingRec.studentId.firstName} {playingRec.studentId.lastName}
            </span>
          )}
          {playingSession.totalSize > 0 && (
            <span style={{ fontSize: "13px", color: col.muted }}>💾 {formatSize(playingSession.totalSize)}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => toggleVisibility(playingSession)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: `1px solid ${col.border}`, background: "none", color: playingSession.visibleToStudent ? "#10b981" : col.muted, cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>
            {playingSession.visibleToStudent ? <Eye size={14} /> : <EyeOff size={14} />}
            {playingSession.visibleToStudent ? "Visible to student" : "Hidden from student"}
          </button>
          <button onClick={() => downloadVideo(playingRec)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: `1px solid ${col.border}`, background: "none", color: col.text, cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>
            <Download size={14} /> {total > 1 ? "Download this part" : "Download"}
          </button>
          <button onClick={() => handleDeleteSession(playingSession)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>
            <Trash2 size={14} /> {total > 1 ? "Delete class" : "Delete"}
          </button>
        </div>
      </div>
    </div>
    );
  }

  // ── Recordings list for a single student ──────────────────────────────────
  if (selectedStudent) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={() => setSelectedStudent(null)}
          style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
          <ArrowLeft size={16} /> All Students
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: col.text }}>
            {selectedStudent.name}
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: "13px", color: col.muted }}>
            {loadingRecs ? "Loading…" : `${pager.total} recorded class${pager.total !== 1 ? "es" : ""}`}
          </p>
        </div>
        {addLinkBtn(selectedStudent.id !== "__unassigned__" ? selectedStudent.id : null)}
      </div>

      {studentSessions.length === 0 ? (
        <div style={{ background: col.card, border: `2px dashed ${col.border}`, borderRadius: "18px", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎬</div>
          <p style={{ margin: 0, fontWeight: 800, color: col.text }}>{loadingRecs ? "Loading…" : "No recordings yet"}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {groupByDay(studentSessions).map(({ day, classes }) => (
            <section key={day} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Day heading — each date's classes are kept together */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Calendar size={14} color={col.accent} />
                <span style={{ fontSize: "13px", fontWeight: 900, color: col.text, letterSpacing: "0.01em" }}>{day}</span>
                <div style={{ flex: 1, height: "1px", background: col.border }} />
              </div>

              {classes.map(session => {
                const rec    = session.first;
                const total  = session.parts.length;
                const isOpen = expanded.has(session.key);
                const days   = daysUntilDelete(rec.autoDeleteAt);
                const expiringSoon = days !== null && days <= 7;
                const classTime = new Date(session.classDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                return (
                  <div key={session.key} style={{ background: col.card, border: `1px solid ${expiringSoon ? "#f97316" : col.border}`, borderRadius: "16px", overflow: "hidden" }}>
                    <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>

                      {/* Thumbnail */}
                      <div style={{ width: "58px", height: "42px", borderRadius: "10px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Video size={18} color="white" />
                      </div>

                      {/* Info */}
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
                          {total > 1 && (
                            <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "20px", background: "rgba(99,102,241,0.12)", color: col.accent }}>
                              {total} parts
                            </span>
                          )}
                          {session.hasExternal && (
                            <span title="Recorded outside the app — saved as a link" style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "20px", background: "rgba(14,165,233,0.12)", color: "#0284c7" }}>
                              🔗 External link
                            </span>
                          )}
                          <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "20px", background: session.visibleToStudent ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.12)", color: session.visibleToStudent ? "#10b981" : col.muted }}>
                            {session.visibleToStudent ? "👁 Visible" : "🚫 Hidden"}
                          </span>
                          {expiringSoon && (
                            <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "20px", background: "rgba(249,115,22,0.12)", color: "#f97316" }}>
                              ⏳ Deletes in {days}d
                            </span>
                          )}
                        </div>
                        {total === 1 && isExternal(rec) && (
                          <p style={{ margin: "5px 0 0", fontSize: "12px", color: col.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {linkSource(rec.externalUrl)} link{rec.note ? ` · ${rec.note}` : ""}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0, alignItems: "center" }}>
                        <button onClick={() => toggleVisibility(session)} title={session.visibleToStudent ? "Hide from student" : "Show to student"}
                          style={{ padding: "8px", borderRadius: "10px", border: `1px solid ${col.border}`, background: "none", color: session.visibleToStudent ? "#10b981" : col.muted, cursor: "pointer" }}>
                          {session.visibleToStudent ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <button onClick={() => loadVideo(session, 0)} title={isExternal(rec) ? "Opens the saved link in a new tab" : total > 1 ? "Plays all parts in order" : "Watch recording"}
                          style={{ padding: "8px 14px", borderRadius: "10px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 800, display: "flex", alignItems: "center", gap: "5px" }}>
                          {isExternal(rec)
                            ? <><ExternalLink size={13} /> {total > 1 ? "Open Part 1" : "Open link"}</>
                            : <><Play size={13} fill="white" /> {total > 1 ? "Watch Part 1" : "Watch"}</>}
                        </button>
                        {total > 1 ? (
                          <button onClick={() => toggleExpanded(session.key)}
                            style={{ padding: "8px 12px", borderRadius: "10px", border: `1px solid ${isOpen ? col.accent : col.border}`, background: isOpen ? "rgba(99,102,241,0.12)" : "none", color: isOpen ? col.accent : col.text, cursor: "pointer", fontSize: "12px", fontWeight: 800, display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                            {isOpen ? <>Hide <ChevronUp size={14} /></> : <>See more ({total}) <ChevronDown size={14} /></>}
                          </button>
                        ) : isExternal(rec) ? (
                          <button onClick={() => setLinkModal({ editing: rec })} title="Edit link or note"
                            style={{ padding: "8px", borderRadius: "10px", border: `1px solid ${col.border}`, background: "none", color: col.text, cursor: "pointer" }}>
                            <Pencil size={15} />
                          </button>
                        ) : (
                          <button onClick={() => downloadVideo(rec)} title="Download recording"
                            style={{ padding: "8px", borderRadius: "10px", border: `1px solid ${col.border}`, background: "none", color: col.text, cursor: "pointer" }}>
                            <Download size={15} />
                          </button>
                        )}
                        <button onClick={() => handleDeleteSession(session)} title={total > 1 ? "Delete the whole class (all parts)" : "Delete recording"}
                          style={{ padding: "8px", borderRadius: "10px", border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer" }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* All parts of this class (revealed by "See more") */}
                    {isOpen && total > 1 && (
                      <div style={{ borderTop: `1px solid ${col.border}`, background: col.input, padding: "6px 18px 10px", display: "flex", flexDirection: "column" }}>
                        {session.parts.map((p, i) => (
                          <div key={p._id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 0", borderBottom: i < total - 1 ? `1px dashed ${col.border}` : "none" }}>
                            <span style={{ width: "26px", height: "26px", borderRadius: "8px", background: col.card, border: `1px solid ${col.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 900, color: col.accent, flexShrink: 0 }}>
                              {i + 1}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: "13px", fontWeight: 700, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {partLabel(p, total, i)}
                            </span>
                            {isExternal(p)
                              ? p.note && <span title={p.note} style={{ fontSize: "11px", color: col.muted, maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.note}</span>
                              : p.fileSize > 0 && <span style={{ fontSize: "11px", color: col.muted }}>{formatSize(p.fileSize)}</span>}
                            <button onClick={() => loadVideo(session, i)} title={isExternal(p) ? "Open the saved link" : "Watch this part"}
                              style={{ padding: "6px 10px", borderRadius: "8px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 800, display: "flex", alignItems: "center", gap: "4px" }}>
                              {isExternal(p) ? <><ExternalLink size={11} /> Open</> : <><Play size={11} fill="white" /> Watch</>}
                            </button>
                            {isExternal(p) ? (
                              <button onClick={() => setLinkModal({ editing: p })} title="Edit link or note"
                                style={{ padding: "6px", borderRadius: "8px", border: `1px solid ${col.border}`, background: col.card, color: col.text, cursor: "pointer" }}>
                                <Pencil size={13} />
                              </button>
                            ) : (
                              <button onClick={() => downloadVideo(p)} title="Download this part"
                                style={{ padding: "6px", borderRadius: "8px", border: `1px solid ${col.border}`, background: col.card, color: col.text, cursor: "pointer" }}>
                                <Download size={13} />
                              </button>
                            )}
                            <button onClick={() => handleDeletePart(p, total, i)} title="Delete this part"
                              style={{ padding: "6px", borderRadius: "8px", border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer" }}>
                              <Trash2 size={13} />
                            </button>
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

      {linkModalEl}

      {toast && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", padding: "12px 20px", background: "#1a1d2e", color: "#fff", borderRadius: "12px", fontWeight: 700, zIndex: 9999, border: "1px solid #2a2d40" }}>
          {toast}
        </div>
      )}
    </div>
  );

  // ── Student list (default view) ───────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 900, color: col.text }}>🎬 Class Recordings</h2>
          <p style={{ margin: 0, fontSize: "13px", color: col.muted }}>
            {loading
              ? "Loading…"
              : `Select a student to view their recordings · Videos auto-delete after 30 days, saved links are kept`}
          </p>
        </div>
        {addLinkBtn(null)}
      </div>

      {/* Search */}
      {students.length > 0 && (
        <div style={{ position: "relative" }}>
          <Search size={15} color={col.muted}
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search students…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px 10px 38px", borderRadius: "12px", border: `1px solid ${col.border}`, background: col.input, color: col.text, fontSize: "14px", fontFamily: "inherit", outline: "none" }}
          />
        </div>
      )}

      {!loading && students.length === 0 && (
        <div style={{ background: col.card, border: `2px dashed ${col.border}`, borderRadius: "18px", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "56px", marginBottom: "14px" }}>🎬</div>
          <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: col.text }}>No recordings yet</p>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: col.muted }}>
            Use the record button (⚪) in the video call controls to record a class.
          </p>
        </div>
      )}

      {!loading && students.length > 0 && filteredStudents.length === 0 && (
        <p style={{ color: col.muted, fontSize: "14px" }}>No students match your search.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filteredStudents.map(s => {
          const initials = s.name === "Unassigned"
            ? "—"
            : s.name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
          return (
            <button key={s.id} onClick={() => { setPage(1); setExpanded(new Set()); setSelectedStudent(s); }}
              style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", background: col.card, border: `1px solid ${col.border}`, borderRadius: "14px", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
              onMouseEnter={e => e.currentTarget.style.background = col.hover}
              onMouseLeave={e => e.currentTarget.style.background = col.card}
            >
              {/* Avatar */}
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "16px", fontWeight: 900, color: "#fff" }}>{initials}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: col.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.email || `${s.count} recording${s.count !== 1 ? "s" : ""}`}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                <span style={{ fontSize: "12px", fontWeight: 800, color: col.muted, background: col.input, padding: "4px 10px", borderRadius: "20px" }}>
                  {s.count}
                </span>
                <ChevronRight size={18} color={col.muted} />
              </div>
            </button>
          );
        })}
      </div>

      {linkModalEl}

      {toast && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", padding: "12px 20px", background: "#1a1d2e", color: "#fff", borderRadius: "12px", fontWeight: 700, zIndex: 9999, border: "1px solid #2a2d40" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
