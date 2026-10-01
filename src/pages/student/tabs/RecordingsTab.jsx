// src/pages/student/tabs/RecordingsTab.jsx
import { useState, useEffect, useMemo } from "react";
import { Play, X, Clock, Calendar, Video, Loader2 } from "lucide-react";
import api from "../../../api";
import Pagination from "../../../components/Pagination";
import { groupRecordingSessions, partLabel, isExternal, openExternal } from "../../../utils/recordingSessions.js";

export default function RecordingsTab({ isDarkMode }) {
  const [recordings, setRecordings] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [playing,    setPlaying]    = useState(null); // { session, index }
  const [videoSrc,   setVideoSrc]   = useState(null);
  const [loadingId,  setLoadingId]  = useState(null); // which card is loading

  // A class recorded in parts is shown once; its parts play back-to-back
  const sessions = useMemo(() => groupRecordingSessions(recordings), [recordings]);

  const col = {
    bg:      isDarkMode ? "#0f1117" : "#fff8f0",
    card:    isDarkMode ? "#1a1d2e" : "#ffffff",
    border:  isDarkMode ? "#2a2d40" : "#ffe8cc",
    text:    isDarkMode ? "#e8eaf6" : "#1a1d2e",
    muted:   isDarkMode ? "#8b91b8" : "#6b7280",
    accent:  "#6366f1",
    inputBg: isDarkMode ? "#1e2235" : "#f3f4f6",
  };

  // Paged by class on the server (10 classes per page)
  const [page,  setPage]  = useState(1);
  const [pager, setPager] = useState({ total: 0, totalPages: 1, limit: 10 });
  useEffect(() => {
    let stale = false;
    setLoading(true);
    api.get("/recordings", { params: { page, limit: 10 } })
      .then(r => { if (stale) return; setRecordings(r.data.recordings || []); if (r.data.pagination) { setPager(r.data.pagination); if (r.data.pagination.page !== page) setPage(r.data.pagination.page); } })
      .catch(() => {})
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [page]);

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

  const openVideo = async (session, index = 0) => {
    const rec = session.parts[index];
    if (!rec) return;
    if (isExternal(rec)) { openExternal(rec.externalUrl); return; } // recorded in Zoom/Meet — open the saved link
    setLoadingId(session.key);
    try {
      let src;
      const { data } = await api.get(`/recordings/${rec._id}/stream`);
      if (data?.url) {
        // S3: presigned URL — browser streams directly from S3, server carries zero load
        src = data.url;
      } else {
        // Local disk fallback: re-fetch as binary blob
        const { data: blob } = await api.get(`/recordings/${rec._id}/stream`, { responseType: 'blob' });
        src = URL.createObjectURL(blob);
      }
      if (videoSrc && videoSrc.startsWith("blob:")) URL.revokeObjectURL(videoSrc);
      setVideoSrc(src);
      setPlaying({ session, index });
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
  if (playing) {
    const { session, index } = playing;
    const rec     = session.parts[index];
    const total   = session.parts.length;
    const hasNext = index < total - 1 && !isExternal(session.parts[index + 1]);
    return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={closeVideo} style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 700, padding: 0 }}>
          <X size={16} /> Back
        </button>
        <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: col.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {rec.title || rec.bookingId?.classTitle || "Class Recording"}
          {total > 1 && <span style={{ marginLeft: "8px", fontSize: "13px", fontWeight: 700, color: col.muted }}>Part {index + 1} of {total}</span>}
        </h2>
      </div>

      {/* Video player — continues with the next part when one ends */}
      <div style={{ background: "#000", borderRadius: "16px", overflow: "hidden", aspectRatio: "16/9", width: "100%", position: "relative" }}>
        <video
          key={rec._id}
          src={videoSrc}
          controls
          autoPlay
          onEnded={() => { if (hasNext) openVideo(session, index + 1); }}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Part picker */}
      {total > 1 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {session.parts.map((p, i) => {
            const active = i === index;
            return (
              <button key={p._id} onClick={() => openVideo(session, i)} disabled={loadingId === session.key}
                style={{ padding: "7px 12px", borderRadius: "10px", border: `1px solid ${active ? col.accent : col.border}`, background: active ? "rgba(99,102,241,0.12)" : col.card, color: active ? col.accent : col.text, cursor: "pointer", fontSize: "12px", fontWeight: 800, fontFamily: "inherit" }}>
                {partLabel(p, total, i)}
              </button>
            );
          })}
        </div>
      )}

      {/* Metadata strip */}
      <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "14px", padding: "14px 18px", display: "flex", gap: "18px", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "13px", color: col.muted, display: "flex", alignItems: "center", gap: "5px" }}>
          <Calendar size={13} /> {formatDate(session.createdAt)}
        </span>
        {session.totalDuration > 0 && (
          <span style={{ fontSize: "13px", color: col.muted, display: "flex", alignItems: "center", gap: "5px" }}>
            <Clock size={13} /> {formatDuration(session.totalDuration)}
          </span>
        )}
        {session.totalSize > 0 && (
          <span style={{ fontSize: "13px", color: col.muted }}>💾 {formatSize(session.totalSize)}</span>
        )}
        {rec.teacherId && (
          <span style={{ fontSize: "13px", color: col.muted }}>
            👨‍🏫 {rec.teacherId.firstName} {rec.teacherId.lastName}
          </span>
        )}
      </div>

      {/* Other recordings quick-switch */}
      {sessions.length > 1 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: col.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Other recordings</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {sessions.filter(s => s.key !== session.key).map(s => (
              <button key={s.key} onClick={() => openVideo(s)} disabled={loadingId === s.key}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: col.card, border: `1px solid ${col.border}`, borderRadius: "12px", cursor: "pointer", textAlign: "left", width: "100%", opacity: loadingId === s.key ? 0.6 : 1 }}>
                <div style={{ width: "36px", height: "24px", borderRadius: "6px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {loadingId === s.key ? <Loader2 size={12} color="white" style={{ animation: "spin 1s linear infinite" }} /> : <Play size={10} fill="white" color="white" />}
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: col.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.first.title || s.first.bookingId?.classTitle || "Class Recording"}
                </span>
                <span style={{ fontSize: "11px", color: col.muted, flexShrink: 0 }}>{formatDate(s.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 900, color: col.text }}>🎬 Class Recordings</h2>
        <p style={{ margin: 0, fontSize: "13px", color: col.muted }}>
          {loading ? "Loading…" : `${pager.total} recording${pager.total !== 1 ? "s" : ""}`}
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
        {sessions.map(session => {
          const rec       = session.first;
          const total     = session.parts.length;
          const isLoading = loadingId === session.key;
          return (
            <div key={session.key} style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "16px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px" }}>

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
                    <Calendar size={11} /> {formatDate(session.createdAt)}
                  </span>
                  {session.totalDuration > 0 && (
                    <span style={{ fontSize: "12px", color: col.muted, display: "flex", alignItems: "center", gap: "3px" }}>
                      <Clock size={11} /> {formatDuration(session.totalDuration)}
                    </span>
                  )}
                  {total > 1 && (
                    <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "20px", background: "rgba(99,102,241,0.12)", color: col.accent }}>
                      {total} parts
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
              <button onClick={() => openVideo(session)} disabled={isLoading}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "12px", background: isLoading ? col.inputBg : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: isLoading ? col.muted : "#fff", border: "none", cursor: isLoading ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 800, flexShrink: 0, minWidth: "88px", justifyContent: "center", transition: "opacity 0.2s" }}>
                {isLoading
                  ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Loading</>
                  : isExternal(rec) ? <>🔗 Open</> : <><Play size={14} fill="white" /> Watch</>
                }
              </button>
            </div>
          );
        })}
      </div>

      {pager.totalPages > 1 && (
        <Pagination page={page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit}
          onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} isDarkMode={isDarkMode} />
      )}

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
