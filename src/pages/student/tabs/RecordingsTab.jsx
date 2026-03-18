// src/pages/student/tabs/RecordingsTab.jsx
import { useState, useEffect, useRef } from "react";
import { Play, X, Clock, Calendar, Video } from "lucide-react";
import api from "../../../api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function RecordingsTab({ isDarkMode }) {
  const [recordings, setRecordings] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [playing,    setPlaying]    = useState(null); // recording object
  const videoRef = useRef(null);

  const col = {
    bg:     isDarkMode ? "#0f1117" : "#fff8f0",
    card:   isDarkMode ? "#1a1d2e" : "#ffffff",
    border: isDarkMode ? "#2a2d40" : "#ffe8cc",
    text:   isDarkMode ? "#e8eaf6" : "#1a1d2e",
    muted:  isDarkMode ? "#8b91b8" : "#6b7280",
  };

  useEffect(() => {
    api.get("/api/recordings")
      .then(r => setRecordings(r.data.recordings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDuration = (secs) => {
    if (!secs) return "--";
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  const formatDate = (d) => new Date(d).toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
  });

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Create an object URL so we can stream with auth headers
  const [blobUrls, setBlobUrls] = useState({});

  const loadVideo = async (rec) => {
    if (blobUrls[rec._id]) { setPlaying(rec); return; }
    try {
      const token = localStorage.getItem("studentToken") ||
                    localStorage.getItem("teacherToken") ||
                    localStorage.getItem("token");
      const resp = await fetch(`${API_BASE}/api/recordings/${rec._id}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      setBlobUrls(prev => ({ ...prev, [rec._id]: url }));
      setPlaying(rec);
    } catch (e) {
      console.error("Failed to load video:", e);
    }
  };

  // ── Player modal ──────────────────────────────────────────────────────────
  if (playing) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={() => setPlaying(null)} style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 700 }}>
          <X size={16} /> Close
        </button>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: col.text, flex: 1 }}>
          {playing.title || playing.bookingId?.classTitle || "Class Recording"}
        </h2>
      </div>

      <div style={{ background: "#000", borderRadius: "16px", overflow: "hidden", aspectRatio: "16/9", width: "100%" }}>
        <video
          ref={videoRef}
          src={blobUrls[playing._id]}
          controls
          autoPlay
          style={{ width: "100%", height: "100%", display: "block" }}
        />
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
        {playing.fileSize > 0 && (
          <span style={{ fontSize: "13px", color: col.muted }}>
            💾 {formatSize(playing.fileSize)}
          </span>
        )}
        {playing.teacherId && (
          <span style={{ fontSize: "13px", color: col.muted }}>
            👨‍🏫 {playing.teacherId.firstName} {playing.teacherId.lastName}
          </span>
        )}
      </div>
    </div>
  );

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 900, color: col.text }}>🎬 Class Recordings</h2>
        <p style={{ margin: 0, fontSize: "13px", color: col.muted }}>
          {loading ? "Loading…" : `${recordings.length} recording${recordings.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {!loading && recordings.length === 0 && (
        <div style={{ background: col.card, border: `2px dashed ${col.border}`, borderRadius: "18px", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "56px", marginBottom: "14px" }}>🎬</div>
          <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: col.text }}>No recordings yet</p>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: col.muted }}>Your teacher can record classes and they'll appear here.</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {recordings.map(rec => (
          <div key={rec._id} style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "16px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px" }}>

            {/* Thumbnail placeholder */}
            <div style={{ width: "72px", height: "48px", borderRadius: "10px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Video size={22} color="white" />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {rec.title || rec.bookingId?.classTitle || "Class Recording"}
              </p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", color: col.muted }}>
                  <Calendar size={11} style={{ display: "inline", marginRight: "4px" }} />
                  {formatDate(rec.createdAt)}
                </span>
                {rec.duration > 0 && (
                  <span style={{ fontSize: "12px", color: col.muted }}>
                    <Clock size={11} style={{ display: "inline", marginRight: "4px" }} />
                    {formatDuration(rec.duration)}
                  </span>
                )}
                {rec.teacherId && (
                  <span style={{ fontSize: "12px", color: col.muted }}>
                    👨‍🏫 {rec.teacherId.firstName} {rec.teacherId.lastName}
                  </span>
                )}
              </div>
            </div>

            {/* Play button */}
            <button onClick={() => loadVideo(rec)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "12px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 800, flexShrink: 0 }}>
              <Play size={14} fill="white" /> Watch
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
