// ActiveClassBanner.jsx
// Floating "Return to Class" pill shown on dashboards when a class was minimized.
// Reads from sessionStorage key "activeClass" written by AgoraClassroom / GoogleMeetClassroom
// when the user clicks the Dashboard (minimize) button.

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function ActiveClassBanner() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [data, setData] = useState(null);

  // Read sessionStorage on every route change
  useEffect(() => {
    const raw = sessionStorage.getItem("activeClass");
    if (!raw) { setData(null); return; }
    try {
      const parsed = JSON.parse(raw);
      // Discard stale entries (> 3 hours old)
      if (Date.now() - parsed.minimizedAt > 3 * 60 * 60 * 1000) {
        sessionStorage.removeItem("activeClass");
        setData(null);
      } else {
        setData(parsed);
      }
    } catch {
      sessionStorage.removeItem("activeClass");
      setData(null);
    }
  }, [location.pathname]);

  // Don't show on the classroom route itself
  if (!data || location.pathname.startsWith("/classroom")) return null;

  const handleReturn = () => {
    navigate("/classroom", { state: { classData: data.classData, userRole: data.userRole } });
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    sessionStorage.removeItem("activeClass");
    setData(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "linear-gradient(135deg, #7c3aed, #4f63d2)",
        color: "#fff",
        borderRadius: "999px",
        padding: "12px 20px",
        boxShadow: "0 8px 32px rgba(124,58,237,0.45)",
        cursor: "pointer",
        userSelect: "none",
        animation: "acb-pulse 2.5s ease-in-out infinite",
      }}
      onClick={handleReturn}
    >
      <style>{`
        @keyframes acb-pulse {
          0%, 100% { box-shadow: 0 8px 32px rgba(124,58,237,0.45); }
          50%       { box-shadow: 0 8px 40px rgba(124,58,237,0.7); }
        }
      `}</style>

      {/* Animated live dot */}
      <span style={{ position: "relative", display: "inline-flex" }}>
        <span style={{
          width: "10px", height: "10px", borderRadius: "50%", background: "#4ade80",
          display: "block",
          boxShadow: "0 0 0 0 rgba(74,222,128,0.7)",
          animation: "acb-ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
        }} />
        <style>{`
          @keyframes acb-ping {
            75%, 100% { transform: scale(2.2); opacity: 0; }
          }
        `}</style>
      </span>

      <span style={{ fontSize: "13px", fontWeight: "700" }}>
        Class in Progress — Return
      </span>

      {/* Dismiss × */}
      <span
        onClick={handleDismiss}
        style={{
          marginLeft: "4px",
          width: "20px", height: "20px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", fontWeight: "900", lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ×
      </span>
    </div>
  );
}
