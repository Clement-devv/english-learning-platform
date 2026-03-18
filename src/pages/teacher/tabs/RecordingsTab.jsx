// src/pages/teacher/tabs/RecordingsTab.jsx
import { useState, useEffect } from "react";
import { Trash2, Eye, EyeOff, Play, X, Clock, Calendar, Video } from "lucide-react";
import api from "../../../api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function RecordingsTab({ isDarkMode }) {
  const [recordings, setRecordings] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [playing,    setPlaying]    = useState(null);
  const [blobUrls,   setBlobUrls]   = useState({});
  const [toast,      setToast]      = useState("");

  const col = {
    card:   isDarkMode ? "#1a1d2e" : "#ffffff",
    border: isDarkMode ? "#2a2d40" : "#e8edf5",
    text:   isDarkMode ? "#e8eaf6" : "#1a1d2e",
    muted:  isDarkMode ? "#8b91b8" : "#6b7280",
    input:  isDarkMode ? "#1e2235" : "#f3f4f6",
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    api.get("/api/recordings")
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

  // ── Toggle visibility ──────────────────────────────────────────────────────
  const toggleVisibility = async (rec) => {
    try {
      const { data } = await api.patch(`/api/recordings/${rec._id}/visibility`);
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
      await api.delete(`/api/recordings/${rec._id}`);
      setRecordings(prev => prev.filter(r => r._id !== rec._id));
      if (playing?._id === rec._id) setPlaying(null);
      showToast("Recording deleted");
    } catch { showToast("Failed to delete"); }
  };

  // ── Load + play video ──────────────────────────────────────────────────────
  const loadVideo = async (rec) => {
    if (blobUrls[rec._id]) { setPlaying(rec); return; }
    try {
      const token = localStorage.getItem("teacherToken") || localStorage.getItem("token");
      const resp  = await fetch(`${API_BASE}/api/recordings/${rec._id}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      setBlobUrls(prev => ({ ...prev, [rec._id]: url }));
      setPlaying(rec);
    } catch { showToast("Failed to load video"); }
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
        <video src={blobUrls[playing._id]} controls autoPlay style={{ width: "100%", height: "100%", display: "block" }} />
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
              👤 {playing.studentId.firstName} {playing.studentId.surname}
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
          <button onClick={() => handleDelete(playing)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  );

  // ── List ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 900, color: col.text }}>🎬 Class Recordings</h2>
        <p style={{ margin: 0, fontSize: "13px", color: col.muted }}>
          {loading ? "Loading…" : `${recordings.length} recording${recordings.length !== 1 ? "s" : ""} · Auto-deleted after 30 days`}
        </p>
      </div>

      {!loading && recordings.length === 0 && (
        <div style={{ background: col.card, border: `2px dashed ${col.border}`, borderRadius: "18px", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "56px", marginBottom: "14px" }}>🎬</div>
          <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: col.text }}>No recordings yet</p>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: col.muted }}>
            Use the record button (⚪) in the video call controls to record a class.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {recordings.map(rec => {
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
                  {rec.studentId && <span style={{ fontSize: "12px", color: col.muted }}>👤 {rec.studentId.firstName} {rec.studentId.surname}</span>}

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
                <button onClick={() => handleDelete(rec)} title="Delete recording"
                  style={{ padding: "8px", borderRadius: "10px", border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer" }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
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
