// src/pages/admin/tabs/RecordingsTab.jsx
import { useState, useEffect } from "react";
import { Play, X, Clock, Calendar, Video, ChevronRight, ArrowLeft, Download } from "lucide-react";
import api from "../../../api";


export default function RecordingsTab({ teachers = [], isDarkMode }) {
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [recordings,      setRecordings]      = useState([]);
  const [loadingRecs,     setLoadingRecs]      = useState(false);
  const [playing,         setPlaying]          = useState(null);
  const [videoUrls,       setVideoUrls]        = useState({});
  const [search,          setSearch]           = useState("");

  const col = {
    card:   isDarkMode ? "#1a1d2e" : "#ffffff",
    border: isDarkMode ? "#2a2d40" : "#e8edf5",
    text:   isDarkMode ? "#e8eaf6" : "#1a1d2e",
    muted:  isDarkMode ? "#8b91b8" : "#6b7280",
    input:  isDarkMode ? "#1e2235" : "#f3f4f6",
    hover:  isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(99,102,241,0.04)",
    accent: "#6366f1",
  };

  // Load recordings when a teacher is selected
  useEffect(() => {
    if (!selectedTeacher) return;
    setLoadingRecs(true);
    setRecordings([]);
    api.get(`/recordings/teacher/${selectedTeacher._id || selectedTeacher.id}`)
      .then(r => setRecordings(r.data.recordings || []))
      .catch(() => {})
      .finally(() => setLoadingRecs(false));
  }, [selectedTeacher]);

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

  const loadVideo = async (rec) => {
    if (videoUrls[rec._id]) { setPlaying(rec); return; }
    try {
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
      setPlaying(rec);
    } catch (e) { console.error("Failed to load video:", e); }
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
        const name = (rec.title || rec.bookingId?.classTitle || "recording").replace(/[^a-z0-9\s-]/gi, "").trim() + ext;
        const url  = URL.createObjectURL(new Blob([blob]));
        const a    = document.createElement("a");
        a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { console.error("Download failed:", e); }
  };

  const filteredTeachers = teachers.filter(t =>
    `${t.displayName || ""} ${t.firstName} ${t.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  // ── Video player ───────────────────────────────────────────────────────────
  if (playing) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={() => setPlaying(null)} style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
          <X size={16} /> Close
        </button>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: col.text, flex: 1 }}>
          {playing.title || playing.bookingId?.classTitle || "Class Recording"}
        </h2>
        <button onClick={() => downloadVideo(playing)}
          style={{ padding: "8px 14px", borderRadius: "10px", background: col.input, color: col.text, border: `1px solid ${col.border}`, cursor: "pointer", fontSize: "12px", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px" }}>
          <Download size={13} /> Download
        </button>
      </div>

      <div style={{ background: "#000", borderRadius: "16px", overflow: "hidden", aspectRatio: "16/9" }}>
        <video src={videoUrls[playing._id]} controls autoPlay style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "14px", padding: "14px 18px", display: "flex", gap: "20px", flexWrap: "wrap" }}>
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
        <span style={{ fontSize: "13px", color: playing.visibleToStudent ? "#10b981" : col.muted }}>
          {playing.visibleToStudent ? "👁 Visible to student" : "🚫 Hidden from student"}
        </span>
      </div>
    </div>
  );

  // ── Teacher's recordings list ──────────────────────────────────────────────
  if (selectedTeacher) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={() => { setSelectedTeacher(null); setRecordings([]); }}
          style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
          <ArrowLeft size={16} /> All Teachers
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: col.text }}>
            {selectedTeacher.firstName} {selectedTeacher.lastName}
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: "13px", color: col.muted }}>
            {loadingRecs ? "Loading…" : `${recordings.length} recording${recordings.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {!loadingRecs && recordings.length === 0 && (
        <div style={{ background: col.card, border: `2px dashed ${col.border}`, borderRadius: "18px", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎬</div>
          <p style={{ margin: 0, fontWeight: 800, color: col.text }}>No recordings yet</p>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: col.muted }}>This teacher hasn't recorded any classes.</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {recordings.map(rec => (
          <div key={rec._id} style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "16px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "68px", height: "46px", borderRadius: "10px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Video size={20} color="white" />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {rec.title || rec.bookingId?.classTitle || "Class Recording"}
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: col.muted }}>{formatDate(rec.createdAt)}</span>
                {rec.duration > 0 && <span style={{ fontSize: "12px", color: col.muted }}>{formatDuration(rec.duration)}</span>}
                {rec.studentId && <span style={{ fontSize: "12px", color: col.muted }}>👤 {rec.studentId.firstName} {rec.studentId.lastName}</span>}
                <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "20px", background: rec.visibleToStudent ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.12)", color: rec.visibleToStudent ? "#10b981" : col.muted }}>
                  {rec.visibleToStudent ? "👁 Visible" : "🚫 Hidden"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button onClick={() => loadVideo(rec)}
                style={{ padding: "8px 16px", borderRadius: "10px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 800, display: "flex", alignItems: "center", gap: "5px" }}>
                <Play size={13} fill="white" /> Watch
              </button>
              <button onClick={() => downloadVideo(rec)}
                style={{ padding: "8px 12px", borderRadius: "10px", background: col.input, color: col.text, border: `1px solid ${col.border}`, cursor: "pointer", fontSize: "12px", fontWeight: 800, display: "flex", alignItems: "center", gap: "5px" }}>
                <Download size={13} /> Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Teacher list ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 900, color: col.text }}>🎬 Class Recordings</h2>
        <p style={{ margin: 0, fontSize: "13px", color: col.muted }}>Select a teacher to view their recordings</p>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search teachers…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ padding: "10px 14px", borderRadius: "12px", border: `1px solid ${col.border}`, background: col.input, color: col.text, fontSize: "14px", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filteredTeachers.length === 0 && (
          <p style={{ color: col.muted, fontSize: "14px" }}>No teachers found.</p>
        )}
        {filteredTeachers.map(t => {
          const id = t._id || t.id;
          return (
            <button key={id} onClick={() => setSelectedTeacher(t)}
              style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", background: col.card, border: `1px solid ${col.border}`, borderRadius: "14px", cursor: "pointer", textAlign: "left", width: "100%" }}
              onMouseEnter={e => e.currentTarget.style.background = col.hover}
              onMouseLeave={e => e.currentTarget.style.background = col.card}
            >
              {/* Avatar */}
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "16px", fontWeight: 900, color: "#fff" }}>
                  {t.firstName?.[0]}{t.lastName?.[0]}
                </span>
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
