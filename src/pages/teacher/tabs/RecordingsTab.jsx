// src/pages/teacher/tabs/RecordingsTab.jsx
// Three-tier flow (mirrors admin RecordingsTab):
//   1. Student list  — recordings grouped by student, with search
//   2. Recordings    — only the selected student's recordings
//   3. Video player  — full controls + toggle/download/delete
import { useState, useEffect, useMemo } from "react";
import { Trash2, Eye, EyeOff, Play, X, Clock, Calendar, Video, Download, ChevronRight, ArrowLeft, Search } from "lucide-react";
import api from "../../../api";


export default function RecordingsTab({ isDarkMode }) {
  const [recordings,      setRecordings]      = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [playing,         setPlaying]         = useState(null);
  const [videoUrls,       setVideoUrls]       = useState({});
  const [toast,           setToast]           = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null); // { id, name, email, count }
  const [search,          setSearch]          = useState("");

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

  useEffect(() => {
    api.get("/recordings")
      .then(r => setRecordings(r.data.recordings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
  // so older / group-class recordings remain reachable.
  const students = useMemo(() => {
    const map = new Map();
    for (const rec of recordings) {
      const s = rec.studentId;
      const id = s?._id || s?.id || "__unassigned__";
      const name = s ? `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Unknown" : "Unassigned";
      const email = s?.email || "";
      if (!map.has(id)) map.set(id, { id, name, email, count: 0, latest: 0 });
      const entry = map.get(id);
      entry.count += 1;
      const t = new Date(rec.createdAt).getTime();
      if (t > entry.latest) entry.latest = t;
    }
    // Most recent activity first
    return Array.from(map.values()).sort((a, b) => b.latest - a.latest);
  }, [recordings]);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const studentRecordings = useMemo(() => {
    if (!selectedStudent) return [];
    return recordings.filter(rec => {
      const id = rec.studentId?._id || rec.studentId?.id || "__unassigned__";
      return id === selectedStudent.id;
    });
  }, [recordings, selectedStudent]);

  // ── Toggle visibility ──────────────────────────────────────────────────────
  const toggleVisibility = async (rec) => {
    try {
      const { data } = await api.patch(`/recordings/${rec._id}/visibility`);
      setRecordings(prev => prev.map(r =>
        r._id === rec._id ? { ...r, visibleToStudent: data.visibleToStudent } : r
      ));
      showToast(data.visibleToStudent ? "Visible to student ✓" : "Hidden from student");
    } catch { showToast("Failed to update visibility"); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (rec) => {
    if (!confirm(`Delete "${rec.title || "this recording"}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/recordings/${rec._id}`);
      setRecordings(prev => prev.filter(r => r._id !== rec._id));
      if (playing?._id === rec._id) setPlaying(null);
      showToast("Recording deleted");
    } catch { showToast("Failed to delete"); }
  };

  // ── Load + play video ──────────────────────────────────────────────────────
  const loadVideo = async (rec) => {
    if (videoUrls[rec._id]) { setPlaying(rec); return; }
    try {
      let url;
      const { data } = await api.get(`/recordings/${rec._id}/stream`);
      if (data?.url) {
        url = data.url;
      } else {
        const { data: blob } = await api.get(`/recordings/${rec._id}/stream`, { responseType: 'blob' });
        url = URL.createObjectURL(blob);
      }
      setVideoUrls(prev => ({ ...prev, [rec._id]: url }));
      setPlaying(rec);
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
        const name = (rec.title || rec.bookingId?.classTitle || "recording").replace(/[^a-z0-9\s-]/gi, "").trim() + ext;
        const url  = URL.createObjectURL(new Blob([blob]));
        const a    = document.createElement("a");
        a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
      }
    } catch { showToast("Download failed"); }
  };

  // ── Player ─────────────────────────────────────────────────────────────────
  if (playing) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={() => setPlaying(null)} style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
          <X size={16} /> Back
        </button>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: col.text, flex: 1 }}>
          {playing.title || playing.bookingId?.classTitle || "Class Recording"}
        </h2>
      </div>

      <div style={{ background: "#000", borderRadius: "16px", overflow: "hidden", aspectRatio: "16/9" }}>
        <video src={videoUrls[playing._id]} controls autoPlay style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "14px", padding: "14px 18px", display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", color: col.muted }}>
            <Calendar size={13} style={{ display: "inline", marginRight: "5px" }} />
            {formatDate(playing.createdAt)}
          </span>
          <span style={{ fontSize: "13px", color: col.muted }}>
            <Clock size={13} style={{ display: "inline", marginRight: "5px" }} />
            {formatDuration(playing.duration)}
          </span>
          {playing.studentId && (
            <span style={{ fontSize: "13px", color: col.muted }}>
              👤 {playing.studentId.firstName} {playing.studentId.lastName}
            </span>
          )}
          {playing.fileSize > 0 && (
            <span style={{ fontSize: "13px", color: col.muted }}>💾 {formatSize(playing.fileSize)}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => toggleVisibility(playing)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: `1px solid ${col.border}`, background: "none", color: playing.visibleToStudent ? "#10b981" : col.muted, cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>
            {playing.visibleToStudent ? <Eye size={14} /> : <EyeOff size={14} />}
            {playing.visibleToStudent ? "Visible to student" : "Hidden from student"}
          </button>
          <button onClick={() => downloadVideo(playing)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: `1px solid ${col.border}`, background: "none", color: col.text, cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>
            <Download size={14} /> Download
          </button>
          <button onClick={() => handleDelete(playing)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  );

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
            {studentRecordings.length} recording{studentRecordings.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {studentRecordings.length === 0 ? (
        <div style={{ background: col.card, border: `2px dashed ${col.border}`, borderRadius: "18px", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎬</div>
          <p style={{ margin: 0, fontWeight: 800, color: col.text }}>No recordings yet</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {studentRecordings.map(rec => {
            const days = daysUntilDelete(rec.autoDeleteAt);
            const expiringSoon = days !== null && days <= 7;
            return (
              <div key={rec._id} style={{ background: col.card, border: `1px solid ${expiringSoon ? "#f97316" : col.border}`, borderRadius: "16px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px" }}>

                {/* Thumbnail */}
                <div style={{ width: "68px", height: "46px", borderRadius: "10px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Video size={20} color="white" />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {rec.title || rec.bookingId?.classTitle || "Class Recording"}
                  </p>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: col.muted }}>{formatDate(rec.createdAt)}</span>
                    {rec.duration > 0 && <span style={{ fontSize: "12px", color: col.muted }}>{formatDuration(rec.duration)}</span>}

                    {/* Visibility badge */}
                    <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "20px", background: rec.visibleToStudent ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.12)", color: rec.visibleToStudent ? "#10b981" : col.muted }}>
                      {rec.visibleToStudent ? "👁 Visible" : "🚫 Hidden"}
                    </span>

                    {/* Expiry warning */}
                    {expiringSoon && (
                      <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "20px", background: "rgba(249,115,22,0.12)", color: "#f97316" }}>
                        ⏳ Deletes in {days}d
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button onClick={() => toggleVisibility(rec)} title={rec.visibleToStudent ? "Hide from student" : "Show to student"}
                    style={{ padding: "8px", borderRadius: "10px", border: `1px solid ${col.border}`, background: "none", color: rec.visibleToStudent ? "#10b981" : col.muted, cursor: "pointer" }}>
                    {rec.visibleToStudent ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button onClick={() => loadVideo(rec)} title="Watch recording"
                    style={{ padding: "8px 14px", borderRadius: "10px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 800, display: "flex", alignItems: "center", gap: "5px" }}>
                    <Play size={13} fill="white" /> Watch
                  </button>
                  <button onClick={() => downloadVideo(rec)} title="Download recording"
                    style={{ padding: "8px", borderRadius: "10px", border: `1px solid ${col.border}`, background: "none", color: col.text, cursor: "pointer" }}>
                    <Download size={15} />
                  </button>
                  <button onClick={() => handleDelete(rec)} title="Delete recording"
                    style={{ padding: "8px", borderRadius: "10px", border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer" }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 900, color: col.text }}>🎬 Class Recordings</h2>
        <p style={{ margin: 0, fontSize: "13px", color: col.muted }}>
          {loading
            ? "Loading…"
            : `Select a student to view their recordings · Auto-deleted after 30 days`}
        </p>
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

      {!loading && recordings.length === 0 && (
        <div style={{ background: col.card, border: `2px dashed ${col.border}`, borderRadius: "18px", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "56px", marginBottom: "14px" }}>🎬</div>
          <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: col.text }}>No recordings yet</p>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: col.muted }}>
            Use the record button (⚪) in the video call controls to record a class.
          </p>
        </div>
      )}

      {!loading && recordings.length > 0 && filteredStudents.length === 0 && (
        <p style={{ color: col.muted, fontSize: "14px" }}>No students match your search.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filteredStudents.map(s => {
          const initials = s.name === "Unassigned"
            ? "—"
            : s.name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
          return (
            <button key={s.id} onClick={() => setSelectedStudent(s)}
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

      {toast && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", padding: "12px 20px", background: "#1a1d2e", color: "#fff", borderRadius: "12px", fontWeight: 700, zIndex: 9999, border: "1px solid #2a2d40" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
