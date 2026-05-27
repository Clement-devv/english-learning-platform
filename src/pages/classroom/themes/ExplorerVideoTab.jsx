// src/pages/classroom/themes/ExplorerVideoTab.jsx
// "Space Explorer" classroom theme — cosmic dark purple/teal, rockets & stars, kid-friendly adventure vibe.

import { Circle, Square, Loader, AlertTriangle, X, CheckCircle } from "lucide-react";

// Static star positions so they don't re-render
const STAR_POSITIONS = [
  { top: "8%",  left: "10%",  size: 4, opacity: 0.6, delay: "0s" },
  { top: "15%", left: "75%",  size: 3, opacity: 0.8, delay: "0.5s" },
  { top: "4%",  left: "50%",  size: 5, opacity: 0.5, delay: "1s" },
  { top: "25%", left: "88%",  size: 3, opacity: 0.7, delay: "0.3s" },
  { top: "60%", left: "5%",   size: 4, opacity: 0.6, delay: "0.8s" },
  { top: "70%", left: "92%",  size: 3, opacity: 0.5, delay: "1.2s" },
  { top: "85%", left: "40%",  size: 4, opacity: 0.4, delay: "0.6s" },
  { top: "40%", left: "2%",   size: 3, opacity: 0.7, delay: "0.9s" },
  { top: "50%", left: "95%",  size: 5, opacity: 0.5, delay: "0.2s" },
  { top: "90%", left: "15%",  size: 3, opacity: 0.6, delay: "1.4s" },
  { top: "20%", left: "30%",  size: 2, opacity: 0.4, delay: "0.7s" },
  { top: "75%", left: "60%",  size: 3, opacity: 0.5, delay: "1.1s" },
];

const TEAL   = "#2dd4bf";
const PURPLE = "#a855f7";
const DARK   = "#0a0a1f";
const PANEL  = "#0f1728";

export default function ExplorerVideoTab({
  classData, userRole, userName,
  classStarted, isTeacherPresent, isStudentPresent,
  timeRemaining, bothActiveTime, requiredTime, completionPct,
  formatTime,
  googleMeetLink,
  platform = "googlemeet",
  isRecording, uploadingRecording, recSeconds, recordingError,
  setRecordingError, startRecording, stopRecording, formatRecTime,
}) {
  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: `radial-gradient(ellipse at 30% 20%, #1a0533 0%, ${DARK} 60%)`,
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes orbit {
          0%, 100% { transform: scaleY(0.2); opacity: 0.4; }
          50%       { transform: scaleY(1);   opacity: 1;   }
        }
        @keyframes rocketFloat {
          0%, 100% { transform: translateY(0) rotate(-10deg); }
          50%       { transform: translateY(-14px) rotate(-5deg); }
        }
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── CSS star field ── */}
      {STAR_POSITIONS.map((s, i) => (
        <div key={i} style={{
          position: "absolute",
          top: s.top, left: s.left,
          width: s.size, height: s.size,
          borderRadius: "50%",
          background: "#fff",
          opacity: s.opacity,
          animation: `twinkle ${1.5 + i * 0.2}s ease-in-out ${s.delay} infinite`,
          pointerEvents: "none",
          zIndex: 0,
        }} />
      ))}

      {/* Floating rocket decoration */}
      <div style={{
        position: "absolute", right: "3%", top: "18%",
        fontSize: 28, zIndex: 0, pointerEvents: "none",
        animation: "rocketFloat 3s ease-in-out infinite",
      }}>🚀</div>
      <div style={{
        position: "absolute", left: "2%", top: "55%",
        fontSize: 22, zIndex: 0, pointerEvents: "none",
        animation: "rocketFloat 3.5s ease-in-out 0.5s infinite",
      }}>🪐</div>

      {/* ── Top bar ── */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: "rgba(10,10,31,0.7)",
        backdropFilter: "blur(8px)",
        borderBottom: `1px solid rgba(168,85,247,0.25)`,
        flexShrink: 0,
      }}>
        {classStarted ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(220,38,38,0.85)", padding: "4px 12px", borderRadius: 99,
            boxShadow: "0 0 12px rgba(239,68,68,0.5)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "orbit 1s ease-in-out infinite", display: "inline-block" }} />
            <span style={{ color: "#fff", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em" }}>MISSION LIVE</span>
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(168,85,247,0.2)", border: `1px solid ${PURPLE}50`, padding: "4px 12px", borderRadius: 99,
          }}>
            <span style={{ fontSize: 12 }}>🛸</span>
            <span style={{ color: PURPLE, fontSize: 10, fontWeight: 800 }}>PRE-LAUNCH</span>
          </div>
        )}

        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontWeight: 900, fontSize: 14, color: "#e2e8f0" }}>
            🌌 {classData?.title || "Class"}
          </p>
          {classData?.topic && <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>{classData.topic}</p>}
        </div>

        <div style={{ textAlign: "right" }}>
          <p style={{
            margin: 0, fontWeight: 900, fontSize: 20, fontVariantNumeric: "tabular-nums",
            color: timeRemaining < 120 ? "#f87171" : TEAL,
            textShadow: `0 0 10px ${timeRemaining < 120 ? "rgba(248,113,113,0.6)" : "rgba(45,212,191,0.6)"}`,
          }}>
            {formatTime(timeRemaining)}
          </p>
          <p style={{ margin: 0, fontSize: 9, color: "#64748b", fontWeight: 700, letterSpacing: "0.08em" }}>MISSION TIME</p>
        </div>
      </div>

      {/* ── Video panels ── */}
      <div style={{
        flex: 1, display: "flex", gap: 12, padding: "12px 12px 8px",
        position: "relative", zIndex: 1, minHeight: 0,
      }}>
        {[
          { label: "Teacher", isPresent: isTeacherPresent, isYou: userRole === "teacher", emoji: "👩‍🚀", color: PURPLE },
          { label: "Student", isPresent: isStudentPresent, isYou: userRole === "student", emoji: "👨‍🚀", color: TEAL },
        ].map(({ label, isPresent, isYou, emoji, color }) => (
          <div key={label} style={{
            flex: 1, borderRadius: 20, overflow: "hidden",
            background: PANEL,
            border: isPresent ? `2px solid ${color}55` : "2px solid rgba(255,255,255,0.05)",
            boxShadow: isPresent
              ? `0 0 0 1px ${color}30, 0 12px 40px rgba(0,0,0,0.5), 0 0 24px ${color}20`
              : "0 8px 32px rgba(0,0,0,0.4)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            position: "relative",
            transition: "all 0.5s ease",
          }}>
            {/* Corner star decorations */}
            {isPresent && (
              <>
                <span style={{ position: "absolute", top: 8, right: 12, fontSize: 12, opacity: 0.5, animation: "twinkle 2s ease-in-out infinite" }}>✨</span>
                <span style={{ position: "absolute", bottom: 14, left: 10, fontSize: 10, opacity: 0.4, animation: "twinkle 2.5s ease-in-out 0.4s infinite" }}>⭐</span>
              </>
            )}

            {/* Presence chip */}
            <div style={{
              position: "absolute", top: 10, left: 10,
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: 99,
              background: isPresent ? `${color}18` : "rgba(255,255,255,0.04)",
              border: `1.5px solid ${isPresent ? color + "55" : "rgba(255,255,255,0.08)"}`,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: isPresent ? color : "#374151",
                boxShadow: isPresent ? `0 0 6px ${color}` : "none",
                display: "inline-block",
                animation: isPresent ? "orbit 1.3s ease-in-out infinite" : "none",
              }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: isPresent ? color : "#4b5563" }}>
                {isPresent ? "In Mission 🚀" : "Awaiting..."}
              </span>
            </div>

            {/* You badge */}
            {isYou && (
              <div style={{
                position: "absolute", top: 10, right: 10,
                padding: "2px 8px", borderRadius: 99,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)",
              }}>
                You 👋
              </div>
            )}

            {/* Avatar */}
            <div style={{
              width: 78, height: 78, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 10, fontSize: isPresent ? 42 : 30,
              background: isPresent
                ? `radial-gradient(circle, ${color}30, ${color}08)`
                : "rgba(255,255,255,0.03)",
              border: isPresent
                ? `3px solid ${color}60`
                : "3px dashed rgba(255,255,255,0.08)",
              boxShadow: isPresent ? `0 0 24px ${color}35` : "none",
              transition: "all 0.4s",
            }}>
              {isPresent ? emoji : "❓"}
            </div>

            {/* Name */}
            <p style={{
              margin: "0 0 2px", fontWeight: 900, fontSize: 15,
              color: isPresent ? "#f1f5f9" : "#374151",
            }}>
              {isYou ? userName : label}
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 11, color: isPresent ? color : "#1f2937", fontWeight: 600 }}>
              {isPresent ? (platform === "zoom" ? "🔵 Live in Zoom" : "🌠 Live in Google Meet") : "Not docked yet 💤"}
            </p>

            {/* Waveform bars */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 20 }}>
              {[...Array(7)].map((_, i) => (
                <div key={i} style={{
                  width: 3, height: 16, borderRadius: 99,
                  background: isPresent && classStarted ? color : "#1f2937",
                  boxShadow: isPresent && classStarted ? `0 0 6px ${color}60` : "none",
                  transformOrigin: "bottom",
                  transform: isPresent && classStarted ? undefined : "scaleY(0.18)",
                  animation: isPresent && classStarted
                    ? `orbit ${0.48 + i * 0.08}s ease-in-out ${i * 0.07}s infinite`
                    : "none",
                }} />
              ))}
            </div>

            {/* Absent overlay */}
            {!isPresent && (
              <div style={{
                position: "absolute", inset: 0, borderRadius: 18,
                background: "rgba(0,0,0,0.35)",
              }} />
            )}
          </div>
        ))}
      </div>

      {/* ── Bottom HUD ── */}
      <div style={{
        flexShrink: 0, padding: "0 12px 12px",
        display: "flex", flexDirection: "column", gap: 8,
        position: "relative", zIndex: 1,
      }}>
        {/* Mission progress bar */}
        <div style={{
          background: "rgba(10,10,31,0.8)", backdropFilter: "blur(8px)",
          borderRadius: 16, padding: "10px 16px",
          border: "1px solid rgba(168,85,247,0.2)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              🛸 Mission Progress
            </span>
            <span style={{ fontSize: 14, fontWeight: 900, color: completionPct >= 100 ? TEAL : PURPLE, textShadow: `0 0 8px ${completionPct >= 100 ? TEAL : PURPLE}60` }}>
              {completionPct}% {completionPct >= 100 ? "🏆" : ""}
            </span>
          </div>
          <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
            <div style={{
              height: "100%", borderRadius: 99,
              background: completionPct >= 100
                ? `linear-gradient(90deg, ${TEAL}, #10b981)`
                : `linear-gradient(90deg, ${PURPLE}, ${TEAL})`,
              width: `${completionPct}%`,
              transition: "width 1s ease",
              boxShadow: `0 0 10px ${completionPct >= 100 ? TEAL : PURPLE}80`,
            }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center" }}>
            {[
              { label: "⏱ Together", val: formatTime(bothActiveTime), col: TEAL },
              { label: "🎯 Required", val: formatTime(requiredTime), col: "#94a3b8" },
              { label: "⏰ Remaining", val: formatTime(timeRemaining), col: timeRemaining < 120 ? "#f87171" : "#e2e8f0" },
            ].map(({ label, val, col }) => (
              <div key={label}>
                <p style={{ margin: 0, fontSize: 9, color: "#64748b", fontWeight: 700 }}>{label}</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: col }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        {!classStarted ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontSize: 11, color: PURPLE, fontWeight: 700,
            background: `${PURPLE}12`, borderRadius: 12,
            padding: "7px 16px", border: `1px solid ${PURPLE}30`,
          }}>
            <Loader style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
            🛸 Awaiting crew… waiting for both to open classroom pages
          </div>
        ) : completionPct >= 100 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontSize: 11, color: TEAL, fontWeight: 700,
            background: `${TEAL}12`, borderRadius: 12,
            padding: "7px 16px", border: `1px solid ${TEAL}30`,
          }}>
            <CheckCircle style={{ width: 12, height: 12 }} /> 🏆 Mission complete! You can safely return to base.
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontSize: 11, color: "#64748b", fontWeight: 700,
            background: "rgba(255,255,255,0.04)", borderRadius: 12,
            padding: "7px 16px", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            🛸 Keep your base open — closing it stops the mission timer!
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          {googleMeetLink && (
            <button
              onClick={() => window.open(googleMeetLink, "_blank")}
              style={{
                flex: 1, padding: "11px 16px", borderRadius: 14,
                background: platform === "zoom"
                  ? "linear-gradient(135deg, #2D8CFF, #1a7de8)"
                  : "linear-gradient(135deg, #059669, #0d9488)",
                color: "#fff", border: "none", cursor: "pointer",
                fontWeight: 900, fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: platform === "zoom"
                  ? "0 4px 16px rgba(45,140,255,0.4)"
                  : "0 4px 16px rgba(13,148,136,0.4)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "scale(1.03)";
                e.currentTarget.style.boxShadow = platform === "zoom"
                  ? "0 6px 20px rgba(45,140,255,0.55)"
                  : "0 6px 20px rgba(13,148,136,0.55)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = platform === "zoom"
                  ? "0 4px 16px rgba(45,140,255,0.4)"
                  : "0 4px 16px rgba(13,148,136,0.4)";
              }}
            >
              {platform === "zoom" ? "🚀 Launch Zoom" : "🚀 Launch Google Meet"}
            </button>
          )}

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={uploadingRecording}
            style={{
              flex: 1, padding: "11px 16px", borderRadius: 14,
              background: uploadingRecording ? "rgba(255,255,255,0.06)"
                : isRecording ? `linear-gradient(135deg,#ef4444,#dc2626)`
                : `linear-gradient(135deg,${PURPLE},#7c3aed)`,
              color: uploadingRecording ? "#374151" : "#fff",
              border: "none", cursor: uploadingRecording ? "not-allowed" : "pointer",
              fontWeight: 900, fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: uploadingRecording ? "none" : isRecording ? "0 4px 14px rgba(239,68,68,0.4)" : `0 4px 14px ${PURPLE}50`,
              transition: "transform 0.15s",
            }}
            onMouseEnter={e => { if (!uploadingRecording) e.currentTarget.style.transform = "scale(1.03)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            {uploadingRecording ? (
              <><Loader style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Saving…</>
            ) : isRecording ? (
              <><Square style={{ width: 13, height: 13, fill: "white" }} /> End Rec <span style={{ fontFamily: "monospace", fontSize: 11, background: "rgba(0,0,0,0.25)", padding: "1px 6px", borderRadius: 6 }}>{formatRecTime(recSeconds)}</span></>
            ) : (
              <><span style={{ fontSize: 12 }}>🔴</span> Record Mission</>
            )}
          </button>
        </div>

        {/* Recording error */}
        {recordingError && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12,
            padding: "8px 12px", fontSize: 11, color: "#f87171",
          }}>
            <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1, fontWeight: 600 }}>{recordingError}</span>
            <button onClick={() => setRecordingError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", padding: 0, lineHeight: 1 }}>
              <X style={{ width: 12, height: 12 }} />
            </button>
          </div>
        )}

        {userRole === "teacher" && !googleMeetLink && (
          <p style={{ margin: 0, fontSize: 10, color: "#374151", textAlign: "center", fontWeight: 600 }}>
            {platform === "zoom"
              ? "🔗 Add a Zoom link to your profile to enable the launch button."
              : "🔗 Add a Google Meet link to your profile to enable the launch button."}
          </p>
        )}
      </div>
    </div>
  );
}
