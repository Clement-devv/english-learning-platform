// src/components/ring/IncomingRingModal.jsx
// Full-screen overlay shown when someone rings you.
// Animated phone icon, caller info, Answer / Decline buttons.
//
// Auth guard: the RingProvider lives at the App root and stays mounted across
// login/logout, and the socket disconnect on logout is async — so an in-flight
// ring packet can still call setIncoming() in the tiny window before the close
// completes.  Returning null when no user is logged in prevents private caller
// info from painting on the login screen of a shared device.

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
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
  const { role } = useAuth();
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

  if (!role || !incoming) return null;

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

          {/* Animated avatar with SVG countdown arc */}
          <div style={{ position: "relative", width: "108px", height: "108px", margin: "0 auto 20px" }}>
            {/* SVG progress arc — drains from full (green) to empty (red) over 30 s */}
            <svg
              viewBox="0 0 108 108"
              style={{
                position: "absolute", inset: 0,
                width: "108px", height: "108px",
                transform: "rotate(-90deg)",
                overflow: "visible",
              }}
            >
              {/* Track */}
              <circle cx="54" cy="54" r="50" fill="none" stroke="#e2e8f0" strokeWidth="4" />
              {/* Progress */}
              <circle
                cx="54" cy="54" r="50"
                fill="none"
                stroke={secondsLeft <= 10 ? "#ef4444" : secondsLeft <= 20 ? "#f59e0b" : "#22c55e"}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="314"
                strokeDashoffset={314 * (1 - secondsLeft / 30)}
                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
              />
            </svg>
            {/* Avatar */}
            <div style={{
              position: "absolute", top: "10px", left: "10px",
              width: "88px", height: "88px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "38px",
              animation: "ring-pulse 1.4s ease-in-out infinite",
            }}>
              {emoji}
            </div>
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
          <div style={{ display: "flex", gap: "14px", justifyContent: "center" }}>

            {/* Decline */}
            <button
              onClick={() => declineRing(ringId)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "14px 28px",
                borderRadius: "50px",
                background: "linear-gradient(135deg,#ef4444,#dc2626)",
                border: "none",
                cursor: "pointer",
                fontSize: "15px", fontWeight: "800",
                color: "#fff",
                boxShadow: "0 8px 24px rgba(239,68,68,0.35)",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(239,68,68,0.5)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(239,68,68,0.35)"; }}
            >
              📵 Decline
            </button>

            {/* Pick up */}
            <button
              onClick={() => answerRing(ringId)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "14px 28px",
                borderRadius: "50px",
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                border: "none",
                cursor: "pointer",
                fontSize: "15px", fontWeight: "800",
                color: "#fff",
                boxShadow: "0 8px 24px rgba(34,197,94,0.4)",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(34,197,94,0.5)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(34,197,94,0.4)"; }}
            >
              📲 Pick Up
            </button>
          </div>

          <p style={{ marginTop: "14px", fontSize: "11px", color: "#cbd5e1" }}>
            Auto-dismisses in {secondsLeft}s
          </p>
        </div>
      </div>
    </>
  );
}
