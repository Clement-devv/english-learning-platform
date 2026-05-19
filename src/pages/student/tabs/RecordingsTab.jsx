// src/pages/student/tabs/RecordingsTab.jsx
import { useState, useEffect } from "react";
import { Play, X, Clock, Calendar, Video, Loader2 } from "lucide-react";
import api from "../../../api";

export default function RecordingsTab({ isDarkMode }) {
  const [recordings, setRecordings] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [playing,    setPlaying]    = useState(null);
  const [videoSrc,   setVideoSrc]   = useState(null);
  const [loadingId,  setLoadingId]  = useState(null); // which card is loading

  const col = {
    bg:      isDarkMode ? "#0f1117" : "#fff8f0",
    card:    isDarkMode ? "#1a1d2e" : "#ffffff",
    border:  isDarkMode ? "#2a2d40" : "#ffe8cc",
    text:    isDarkMode ? "#e8eaf6" : "#1a1d2e",
    muted:   isDarkMode ? "#8b91b8" : "#6b7280",
    accent:  "#6366f1",
    inputBg: isDarkMode ? "#1e2235" : "#f3f4f6",
  };

  useEffect(() => {
    api.get("/recordings")
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

  const openVideo = async (rec) => {
    setLoadingId(rec._id);
    try {
      const resp = await api.get(`/recordings/${rec._id}/stream`, { responseType: 'blob' });
      const ct   = resp.headers?.['content-type'] || '';
      let src;
      if (ct.includes('application/json')) {
        // S3: server returned { url } — use presigned URL directly as video src
        const json = JSON.parse(await resp.data.text());
        src = json.url;
      } else {
        // Local disk: server streamed the binary
        src = URL.createObjectURL(new Blob([resp.data], { type: ct || 'video/webm' }));
      }
      setVideoSrc(src);
      setPlaying(rec);
    } catch (e) {
      console.error("Failed to load video:", e);
    } finally {
      setLoadingId(null);
    }
  };

  const closeVideo = () => {
    if (videoSrc && videoSrc.startsWith("blob:")) URL.revokeObjectURL(videoSrc);
    setPlaying(null);
    setVideoSrc(null);
  };

  // ── Player view ──────────────────────────────────────────────────────────────
  if (playing) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={closeVideo} style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 700, padding: 0 }}>
          <X size={16} /> Back
        </button>
        <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: col.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {playing.title || playing.bookingId?.classTitle || "Class Recording"}
        </h2>
      </div>

      {/* Video player */}
      <div style={{ background: "#000", borderRadius: "16px", overflow: "hidden", aspectRatio: "16/9", width: "100%", position: "relative" }}>
        <video
          src={videoSrc}
          controls
          autoPlay
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Metadata strip */}
      <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "14px", padding: "14px 18px", display: "flex", gap: "18px", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "13px", color: col.muted, display: "flex", alignItems: "center", gap: "5px" }}>
          <Calendar size={13} /> {formatDate(playing.createdAt)}
        </span>
        {playing.duration > 0 && (
          <span style={{ fontSize: "13px", color: col.muted, display: "flex", alignItems: "center", gap: "5px" }}>
            <Clock size={13} /> {formatDuration(playing.duration)}
          </span>
        )}
        {playing.fileSize > 0 && (
          <span style={{ fontSize: "13px", color: col.muted }}>💾 {formatSize(playing.fileSize)}</span>
        )}
        {playing.teacherId && (
          <span style={{ fontSize: "13px", color: col.muted }}>
            👨‍🏫 {playing.teacherId.firstName} {playing.teacherId.lastName}
          </span>
        )}
      </div>

      {/* Other recordings quick-switch */}
      {recordings.length > 1 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: col.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Other recordings</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {recordings.filter(r => r._id !== playing._id).map(rec => (
              <button key={rec._id} onClick={() => openVideo(rec)} disabled={loadingId === rec._id}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: col.card, border: `1px solid ${col.border}`, borderRadius: "12px", cursor: "pointer", textAlign: "left", width: "100%", opacity: loadingId === rec._id ? 0.6 : 1 }}>
                <div style={{ width: "36px", height: "24px", borderRadius: "6px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {loadingId === rec._id ? <Loader2 size={12} color="white" style={{ animation: "spin 1s linear infinite" }} /> : <Play size={10} fill="white" color="white" />}
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: col.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {rec.title || rec.bookingId?.classTitle || "Class Recording"}
                </span>
                <span style={{ fontSize: "11px", color: col.muted, flexShrink: 0 }}>{formatDate(rec.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── List view ─────────────────────────────────────────────────────────────────
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
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: col.muted }}>Your teacher will share class recordings here.</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {recordings.map(rec => {
          const isLoading = loadingId === rec._id;
          return (
            <div key={rec._id} style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "16px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px" }}>

              {/* Thumbnail */}
              <div style={{ width: "72px", height: "48px", borderRadius: "10px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {isLoading
                  ? <Loader2 size={20} color="white" style={{ animation: "spin 1s linear infinite" }} />
                  : <Video size={22} color="white" />
                }
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {rec.title || rec.bookingId?.classTitle || "Class Recording"}
                </p>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: col.muted, display: "flex", alignItems: "center", gap: "3px" }}>
                    <Calendar size={11} /> {formatDate(rec.createdAt)}
                  </span>
                  {rec.duration > 0 && (
                    <span style={{ fontSize: "12px", color: col.muted, display: "flex", alignItems: "center", gap: "3px" }}>
                      <Clock size={11} /> {formatDuration(rec.duration)}
                    </span>
                  )}
                  {rec.teacherId && (
                    <span style={{ fontSize: "12px", color: col.muted }}>
                      👨‍🏫 {rec.teacherId.firstName} {rec.teacherId.lastName}
                    </span>
                  )}
                </div>
              </div>

              {/* Watch button */}
              <button onClick={() => openVideo(rec)} disabled={isLoading}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "12px", background: isLoading ? col.inputBg : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: isLoading ? col.muted : "#fff", border: "none", cursor: isLoading ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 800, flexShrink: 0, minWidth: "88px", justifyContent: "center", transition: "opacity 0.2s" }}>
                {isLoading
                  ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Loading</>
                  : <><Play size={14} fill="white" /> Watch</>
                }
              </button>
            </div>
          );
        })}
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
