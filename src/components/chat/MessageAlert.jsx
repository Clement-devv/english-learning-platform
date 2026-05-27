// src/components/chat/MessageAlert.jsx
// Floating alert shown at the top of the dashboard when there are unread chat
// messages (group chats + direct messages).
// - Appears immediately when the user comes online / logs in (RingContext fetches
//   /group-chats + /direct-messages and sums unreadCount for the current role).
// - Dismissed when the user clicks it OR opens the Messages tab (markMessagesSeen
//   in RingContext writes a lastSeenAt timestamp to localStorage so refresh does
//   NOT re-show until a brand-new message arrives).
// - Only renders on dashboard routes — never on login / public pages.
// - When the missed-call banner is also visible, this one stacks below it.

import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useRing } from "../../context/RingContext";

const DASHBOARD_PATHS = [
  "/student/dashboard",
  "/teacher/dashboard",
  "/admin",
  "/sub-admin/dashboard",
  "/parent/dashboard",
];

function isDashboardPath(path) {
  return DASHBOARD_PATHS.some((p) => path.startsWith(p));
}

export default function MessageAlert() {
  const { role } = useAuth();
  const { unreadMessageCount, markMessagesSeen, missedCallCount } = useRing();
  const location = useLocation();

  if (!role) return null;
  if (!isDashboardPath(location.pathname)) return null;
  if (unreadMessageCount === 0) return null;

  // Stack below the missed-call banner when both are visible.
  const topPx = missedCallCount > 0 ? 146 : 76;

  return (
    <>
      <style>{`
        @keyframes mca-slidein {
          from { opacity: 0; transform: translateY(-12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes mca-pulse-blue {
          0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.45); }
          50%      { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
        }
      `}</style>

      <div
        onClick={markMessagesSeen}
        title="Click to dismiss new messages alert"
        style={{
          position: "fixed",
          top: `${topPx}px`,
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
          transition: "top 0.2s ease",
        }}
      >
        {/* Blue badge circle */}
        <div style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
          flexShrink: 0,
          animation: "mca-pulse-blue 1.6s ease-in-out infinite",
        }}>
          💬
        </div>

        {/* Text */}
        <div>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", lineHeight: 1.3 }}>
            {unreadMessageCount} new message{unreadMessageCount > 1 ? "s" : ""}
          </p>
          <p style={{ margin: 0, fontSize: "11px", opacity: 0.55, fontWeight: "500" }}>
            Open Messages tab to read
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
