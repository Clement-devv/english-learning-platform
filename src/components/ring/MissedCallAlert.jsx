// src/components/ring/MissedCallAlert.jsx
// Floating alert shown anywhere on the dashboard when there are unread missed calls.
// Auto-dismisses when the user opens the Ring tab (clearMissedCalls called there).

import { useRing } from "../../context/RingContext";

export default function MissedCallAlert() {
  const { missedCallCount, clearMissedCalls } = useRing();

  if (missedCallCount === 0) return null;

  return (
    <>
      <style>{`
        @keyframes mca-slidein {
          from { opacity: 0; transform: translateY(-12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes mca-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.45); }
          50%      { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
      `}</style>

      <div
        onClick={clearMissedCalls}
        title="Click to dismiss missed call alert"
        style={{
          position: "fixed",
          top: "76px",   // just below the nav bar
          right: "20px",
          zIndex: 9998,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "#1e293b",
          color: "#fff",
          borderRadius: "16px",
          padding: "12px 18px 12px 14px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          cursor: "pointer",
          animation: "mca-slidein 0.3s ease",
          userSelect: "none",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Red badge circle */}
        <div style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "linear-gradient(135deg,#ef4444,#dc2626)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
          flexShrink: 0,
          animation: "mca-pulse 1.6s ease-in-out infinite",
        }}>
          📞
        </div>

        {/* Text */}
        <div>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", lineHeight: 1.3 }}>
            {missedCallCount} missed call{missedCallCount > 1 ? "s" : ""}
          </p>
          <p style={{ margin: 0, fontSize: "11px", opacity: 0.55, fontWeight: "500" }}>
            Open Ring tab to see details
          </p>
        </div>

        {/* Close × */}
        <div style={{
          marginLeft: "6px",
          fontSize: "14px",
          opacity: 0.45,
          fontWeight: "800",
        }}>
          ×
        </div>
      </div>
    </>
  );
}
