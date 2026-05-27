// src/pages/classroom/themes/SunshineVideoTab.jsx
// "Sunshine Friends" classroom theme — warm yellow/orange, cartoon-style, kid-friendly.

import { Video, Circle, Square, Loader, AlertTriangle, X, CheckCircle } from "lucide-react";

const STARS = ["⭐", "🌟", "✨", "⭐", "🌟", "✨", "⭐", "✨"];

export default function SunshineVideoTab({
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
      background: "linear-gradient(160deg, #fffbeb 0%, #fef3c7 40%, #fed7aa 80%, #fecdd3 100%)",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* ── Floating decorations ── */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50%       { transform: translateY(-12px) rotate(5deg); }
        }
        @keyframes sunPulse {
          0%, 100% { transform: scaleY(0.3); opacity: 0.6; }
          50%       { transform: scaleY(1);   opacity: 1;   }
        }
        @keyframes floatStar {
          0%   { transform: translateY(0px) rotate(0deg);   opacity: 0.7; }
          50%  { transform: translateY(-18px) rotate(20deg); opacity: 1;   }
          100% { transform: translateY(0px) rotate(0deg);   opacity: 0.7; }
        }
      `}</style>

      {[
        { top: "6%",  left: "4%",  size: 28, delay: "0s" },
        { top: "12%", right: "6%", size: 22, delay: "0.4s" },
        { top: "3%",  left: "45%", size: 18, delay: "0.8s" },
        { top: "80%", left: "2%",  size: 20, delay: "0.2s" },
        { top: "75%", right: "3%", size: 26, delay: "0.6s" },
      ].map((pos, i) => (
        <div key={i} style={{
          position: "absolute",
          fontSize: `${pos.size}px`,
          top: pos.top, left: pos.left, right: pos.right,
          animation: `floatStar ${2.2 + i * 0.4}s ease-in-out ${pos.delay} infinite`,
          pointerEvents: "none",
          zIndex: 0,
          userSelect: "none",
        }}>
          {STARS[i % STARS.length]}
        </div>
      ))}

      {/* ── Top bar ── */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: "rgba(255,255,255,0.5)",
        backdropFilter: "blur(6px)",
        borderBottom: "2px solid rgba(251,191,36,0.35)",
        flexShrink: 0,
      }}>
        {/* Live / Waiting badge */}
        {classStarted ? (
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#dc2626", padding: "4px 12px", borderRadius: "99px",
            boxShadow: "0 2px 8px rgba(220,38,38,0.4)",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "sunPulse 1s ease-in-out infinite", display: "inline-block" }} />
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em" }}>LIVE</span>
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#fbbf24", padding: "4px 12px", borderRadius: "99px",
          }}>
            <span style={{ fontSize: 13 }}>⏳</span>
            <span style={{ color: "#78350f", fontSize: 11, fontWeight: 800 }}>WAITING</span>
          </div>
        )}

        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontWeight: 900, fontSize: 15, color: "#92400e" }}>
            {classData?.title || "Class"} 🎓
          </p>
          {classData?.topic && <p style={{ margin: 0, fontSize: 11, color: "#b45309" }}>{classData.topic}</p>}
        </div>

        {/* Timer */}
        <div style={{ textAlign: "right" }}>
          <p style={{
            margin: 0, fontWeight: 900, fontSize: 20, fontVariantNumeric: "tabular-nums",
            color: timeRemaining < 120 ? "#dc2626" : "#d97706",
            animation: timeRemaining < 120 ? "sunPulse 0.8s ease-in-out infinite" : "none",
          }}>
            {formatTime(timeRemaining)}
          </p>
          <p style={{ margin: 0, fontSize: 10, color: "#b45309", fontWeight: 700 }}>remaining ⏰</p>
        </div>
      </div>

      {/* ── Video panels ── */}
      <div style={{
        flex: 1, display: "flex", gap: 12, padding: "12px 12px 8px",
        position: "relative", zIndex: 1, minHeight: 0,
      }}>
        {[
          { label: "Teacher", isPresent: isTeacherPresent, isYou: userRole === "teacher", emoji: "👩‍🏫" },
          { label: "Student", isPresent: isStudentPresent, isYou: userRole === "student", emoji: "👦" },
        ].map(({ label, isPresent, isYou, emoji }) => (
          <div key={label} style={{
            flex: 1, borderRadius: 24, overflow: "hidden",
            background: isPresent
              ? "linear-gradient(160deg,#fffbeb,#fef9c3,#fff)"
              : "rgba(255,255,255,0.45)",
            border: isPresent
              ? "3px solid #fbbf24"
              : "3px dashed #fde68a",
            boxShadow: isPresent
              ? "0 8px 32px rgba(251,191,36,0.3), inset 0 1px 0 rgba(255,255,255,0.8)"
              : "0 4px 16px rgba(0,0,0,0.06)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            position: "relative",
            transition: "all 0.5s ease",
          }}>
            {/* Presence chip */}
            <div style={{
              position: "absolute", top: 10, left: 10,
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 99,
              background: isPresent ? "#dcfce7" : "#fef3c7",
              border: `1.5px solid ${isPresent ? "#86efac" : "#fde68a"}`,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: isPresent ? "#22c55e" : "#fbbf24",
                display: "inline-block",
                animation: isPresent ? "sunPulse 1.2s ease-in-out infinite" : "none",
              }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: isPresent ? "#15803d" : "#92400e" }}>
                {isPresent ? "In Class! 🎉" : "Waiting..."}
              </span>
            </div>

            {/* "You" badge */}
            {isYou && (
              <div style={{
                position: "absolute", top: 10, right: 10,
                padding: "2px 8px", borderRadius: 99,
                background: "#fef9c3", border: "1.5px solid #fbbf24",
                fontSize: 10, fontWeight: 800, color: "#92400e",
              }}>
                You 👋
              </div>
            )}

            {/* Avatar */}
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 10,
              background: isPresent
                ? "linear-gradient(135deg,#fbbf24,#f97316)"
                : "#f3f4f6",
              border: isPresent ? "4px solid #fff" : "4px dashed #e5e7eb",
              boxShadow: isPresent ? "0 4px 20px rgba(251,191,36,0.5)" : "none",
              fontSize: isPresent ? 40 : 32,
              transition: "all 0.4s",
            }}>
              {isPresent ? emoji : "❓"}
            </div>

            {/* Name */}
            <p style={{
              margin: "0 0 2px", fontWeight: 900, fontSize: 16,
              color: isPresent ? "#92400e" : "#9ca3af",
            }}>
              {isYou ? userName : label}
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 11, color: isPresent ? "#b45309" : "#d1d5db", fontWeight: 600 }}>
              {isPresent ? (platform === "zoom" ? "🔵 Live in Zoom" : "🌟 Live in Google Meet") : "Not joined yet 💤"}
            </p>

            {/* Waveform bars */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 22 }}>
              {[...Array(7)].map((_, i) => (
                <div key={i} style={{
                  width: 4, height: 18, borderRadius: 99,
                  background: isPresent && classStarted
                    ? `hsl(${30 + i * 12},90%,55%)`
                    : "#e5e7eb",
                  transformOrigin: "bottom",
                  transform: isPresent && classStarted ? undefined : "scaleY(0.2)",
                  animation: isPresent && classStarted
                    ? `sunPulse ${0.5 + i * 0.08}s ease-in-out ${i * 0.07}s infinite`
                    : "none",
                }} />
              ))}
            </div>

            {/* Dimmed overlay when absent */}
            {!isPresent && (
              <div style={{
                position: "absolute", inset: 0, borderRadius: 22,
                background: "rgba(255,255,255,0.35)",
                backdropFilter: "blur(1px)",
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
        {/* Attendance bar */}
        <div style={{
          background: "rgba(255,255,255,0.7)", backdropFilter: "blur(6px)",
          borderRadius: 18, padding: "10px 16px",
          border: "2px solid rgba(251,191,36,0.4)",
          boxShadow: "0 4px 16px rgba(251,191,36,0.15)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ⭐ Gold Stars
            </span>
            <span style={{ fontSize: 14, fontWeight: 900, color: completionPct >= 100 ? "#16a34a" : "#d97706" }}>
              {completionPct}% {completionPct >= 100 ? "🏆" : ""}
            </span>
          </div>
          <div style={{ width: "100%", height: 10, background: "#fef3c7", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
            <div style={{
              height: "100%", borderRadius: 99,
              background: completionPct >= 100
                ? "linear-gradient(90deg,#22c55e,#16a34a)"
                : "linear-gradient(90deg,#fbbf24,#f97316)",
              width: `${completionPct}%`,
              transition: "width 1s ease",
              boxShadow: "0 0 8px rgba(251,191,36,0.6)",
            }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center" }}>
            {[
              { label: "⏱ Together", val: formatTime(bothActiveTime) },
              { label: "🎯 Required", val: formatTime(requiredTime) },
              { label: "⏰ Left", val: formatTime(timeRemaining) },
            ].map(({ label, val }) => (
              <div key={label}>
                <p style={{ margin: 0, fontSize: 10, color: "#b45309", fontWeight: 700 }}>{label}</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: "#78350f" }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Status message */}
        {!classStarted ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontSize: 11, color: "#d97706", fontWeight: 700,
            background: "rgba(254,243,199,0.8)", borderRadius: 12,
            padding: "8px 16px", border: "1.5px solid #fde68a",
          }}>
            <Loader style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
            Waiting for everyone to open their classroom page… 🌈
          </div>
        ) : completionPct >= 100 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontSize: 11, color: "#16a34a", fontWeight: 700,
            background: "rgba(220,252,231,0.8)", borderRadius: 12,
            padding: "8px 16px", border: "1.5px solid #86efac",
          }}>
            <CheckCircle style={{ width: 13, height: 13 }} /> 🏆 Amazing! Attendance done — you can leave safely!
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontSize: 11, color: "#b45309", fontWeight: 700,
            background: "rgba(254,243,199,0.6)", borderRadius: 12,
            padding: "8px 16px", border: "1.5px solid #fde68a",
          }}>
            <span>📚</span> Keep this page open — closing it stops your gold stars!
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          {googleMeetLink && (
            <button
              onClick={() => window.open(googleMeetLink, "_blank")}
              style={{
                flex: 1, padding: "11px 16px", borderRadius: 16,
                background: platform === "zoom"
                  ? "linear-gradient(135deg,#2D8CFF,#1a7de8)"
                  : "linear-gradient(135deg,#22c55e,#16a34a)",
                color: "#fff", border: "none", cursor: "pointer",
                fontWeight: 900, fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: platform === "zoom"
                  ? "0 4px 16px rgba(45,140,255,0.4)"
                  : "0 4px 16px rgba(34,197,94,0.4)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "scale(1.03)";
                e.currentTarget.style.boxShadow = platform === "zoom"
                  ? "0 6px 20px rgba(45,140,255,0.5)"
                  : "0 6px 20px rgba(34,197,94,0.5)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = platform === "zoom"
                  ? "0 4px 16px rgba(45,140,255,0.4)"
                  : "0 4px 16px rgba(34,197,94,0.4)";
              }}
            >
              {platform === "zoom" ? "🎥 Open Zoom" : "🎥 Open Google Meet"}
            </button>
          )}

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={uploadingRecording}
            style={{
              flex: 1, padding: "11px 16px", borderRadius: 16,
              background: uploadingRecording ? "#f3f4f6"
                : isRecording ? "linear-gradient(135deg,#ef4444,#dc2626)"
                : "linear-gradient(135deg,#f97316,#ea580c)",
              color: uploadingRecording ? "#9ca3af" : "#fff",
              border: "none", cursor: uploadingRecording ? "not-allowed" : "pointer",
              fontWeight: 900, fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: uploadingRecording ? "none" : isRecording ? "0 4px 16px rgba(239,68,68,0.4)" : "0 4px 16px rgba(249,115,22,0.4)",
              transition: "transform 0.15s",
            }}
            onMouseEnter={e => { if (!uploadingRecording) e.currentTarget.style.transform = "scale(1.03)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            {uploadingRecording ? (
              <><Loader style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Saving… 💾</>
            ) : isRecording ? (
              <><Square style={{ width: 13, height: 13, fill: "white" }} /> Stop ⏹ <span style={{ fontFamily: "monospace", fontSize: 11, background: "rgba(0,0,0,0.2)", padding: "1px 6px", borderRadius: 6 }}>{formatRecTime(recSeconds)}</span></>
            ) : (
              <><Circle style={{ width: 13, height: 13 }} /> 🔴 Record</>
            )}
          </button>
        </div>

        {/* Recording error */}
        {recordingError && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12,
            padding: "8px 12px", fontSize: 11, color: "#dc2626",
          }}>
            <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1, fontWeight: 600 }}>{recordingError}</span>
            <button onClick={() => setRecordingError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 0, lineHeight: 1 }}>
              <X style={{ width: 12, height: 12 }} />
            </button>
          </div>
        )}

        {userRole === "teacher" && !googleMeetLink && (
          <p style={{ margin: 0, fontSize: 10, color: "#b45309", textAlign: "center", fontWeight: 600 }}>
            {platform === "zoom"
              ? "🔗 Add a Zoom link to your profile to enable the button."
              : "🔗 Add a Google Meet link to your profile to enable the button."}
          </p>
        )}
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
