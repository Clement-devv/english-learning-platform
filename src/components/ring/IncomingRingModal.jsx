// src/components/ring/IncomingRingModal.jsx
// Full-screen overlay shown when someone rings you.
// Animated phone icon, caller info, Answer / Decline buttons.

import { useEffect, useState } from "react";
import { useRing } from "../../context/RingContext";

const ROLE_EMOJI = {
  teacher:  "👨‍🏫",
  student:  "🎓",
  admin:    "🛡️",
  subAdmin: "🔧",
};

const ROLE_LABEL = {
  teacher:  "Teacher",
  student:  "Student",
  admin:    "Admin",
  subAdmin: "Sub-Admin",
};

export default function IncomingRingModal() {
  const { incoming, answerRing, declineRing } = useRing();
  const [secondsLeft, setSecondsLeft] = useState(30);

  // Countdown — auto-dismiss when it hits 0 (server already sent ring-timeout)
  useEffect(() => {
    if (!incoming) return;
    setSecondsLeft(30);
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [incoming]);

  if (!incoming) return null;

  const { ringId, callerName, callerRole } = incoming;
  const emoji = ROLE_EMOJI[callerRole] || "👤";
  const label = ROLE_LABEL[callerRole] || callerRole;

  return (
    <>
      <style>{`
        @keyframes ring-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          50%       { transform: scale(1.07); box-shadow: 0 0 0 18px rgba(99,102,241,0); }
        }
        @keyframes ring-shake {
          0%,100% { transform: rotate(0deg); }
          15%     { transform: rotate(-18deg); }
          30%     { transform: rotate(18deg); }
          45%     { transform: rotate(-12deg); }
          60%     { transform: rotate(12deg); }
          75%     { transform: rotate(-6deg); }
          90%     { transform: rotate(6deg); }
        }
        @keyframes ring-fadein {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>

      {/* Backdrop */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 99990,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}>

        {/* Card */}
        <div style={{
          background: "#fff",
          borderRadius: "24px",
          padding: "40px 36px 32px",
          maxWidth: "360px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 32px 80px rgba(0,0,0,0.28)",
          animation: "ring-fadein 0.3s ease",
          position: "relative",
        }}>

          {/* Timer arc */}
          <div style={{
            position: "absolute", top: 14, right: 18,
            fontSize: "12px", fontWeight: "700",
            color: secondsLeft <= 10 ? "#ef4444" : "#94a3b8",
            fontFamily: "monospace",
          }}>
            {secondsLeft}s
          </div>

          {/* Animated phone / avatar */}
          <div style={{
            width: "88px", height: "88px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: "38px",
            animation: "ring-pulse 1.4s ease-in-out infinite",
          }}>
            {emoji}
          </div>

          {/* Phone shake icon */}
          <div style={{
            fontSize: "28px",
            marginBottom: "12px",
            display: "inline-block",
            animation: "ring-shake 0.8s ease-in-out infinite",
          }}>
            📞
          </div>

          <p style={{
            margin: "0 0 4px",
            fontSize: "13px",
            fontWeight: "600",
            color: "#6366f1",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}>
            Incoming Call
          </p>

          <h2 style={{
            margin: "0 0 4px",
            fontSize: "22px",
            fontWeight: "800",
            color: "#1e293b",
          }}>
            {callerName}
          </h2>

          <p style={{
            margin: "0 0 32px",
            fontSize: "13px",
            color: "#64748b",
            fontWeight: "500",
          }}>
            {label} is calling you
          </p>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>

            {/* Decline */}
            <button
              onClick={() => declineRing(ringId)}
              style={{
                width: "64px", height: "64px",
                borderRadius: "50%",
                background: "#fef2f2",
                border: "2px solid #fecaca",
                cursor: "pointer",
                fontSize: "26px",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#ef4444"; e.currentTarget.style.borderColor = "#ef4444"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#fecaca"; }}
              title="Decline"
            >
              📵
            </button>

            {/* Answer */}
            <button
              onClick={() => answerRing(ringId)}
              style={{
                width: "64px", height: "64px",
                borderRadius: "50%",
                background: "#f0fdf4",
                border: "2px solid #bbf7d0",
                cursor: "pointer",
                fontSize: "26px",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#22c55e"; e.currentTarget.style.borderColor = "#22c55e"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#f0fdf4"; e.currentTarget.style.borderColor = "#bbf7d0"; }}
              title="Answer"
            >
              📲
            </button>
          </div>

          <p style={{
            marginTop: "20px",
            fontSize: "11px",
            color: "#cbd5e1",
          }}>
            Tap 📲 to acknowledge · auto-dismisses in {secondsLeft}s
          </p>
        </div>
      </div>
    </>
  );
}
