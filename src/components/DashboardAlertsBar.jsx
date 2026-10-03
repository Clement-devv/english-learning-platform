// src/components/DashboardAlertsBar.jsx
// "While you were away" bar at the top of teacher & student dashboards (the
// admin dashboard has its own): missed calls with who called and when, and new
// messages with a shortcut to the Messages tab. Both are cleared per person on
// the server (RingContext), so they stay cleared after logout / on other devices.
import { useRing } from "../context/RingContext";

const ROLE_LABEL = { teacher: "Teacher", student: "Student", admin: "Admin", "sub-admin": "Sub-Admin", subAdmin: "Sub-Admin" };

const fmtWhen = (ms) => {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString([], { day: "numeric", month: "short" })} · ${time}`;
};

export default function DashboardAlertsBar({ isDark = false, onOpenMessages, onOpenCalls }) {
  const { missedCalls, missedCallCount, clearMissedCalls, unreadMessageCount, markMessagesSeen } = useRing();
  if (!missedCallCount && !unreadMessageCount) return null;

  const btn = (extra = {}) => ({
    border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "#e5e7eb"}`,
    background: isDark ? "rgba(255,255,255,0.06)" : "#fff",
    color: isDark ? "#e5e7eb" : "#374151",
    borderRadius: 10, padding: "6px 12px", cursor: "pointer",
    fontSize: 12, fontWeight: 700, fontFamily: "inherit", flexShrink: 0, ...extra,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
      {missedCallCount > 0 && (
        <div role="status" style={{
          display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap",
          background: isDark ? "rgba(239,68,68,0.10)" : "#fff5f5",
          border: `1.5px solid ${isDark ? "rgba(239,68,68,0.3)" : "#fecaca"}`,
          borderRadius: 16, padding: "14px 16px",
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#ef4444,#dc2626)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📞</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 900, color: isDark ? "#fca5a5" : "#dc2626" }}>
              {missedCallCount} missed call{missedCallCount > 1 ? "s" : ""}
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: isDark ? "#9ca3af" : "#6b7280" }}>while you were away</span>
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {missedCalls.slice(0, 6).map((mc, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 12, background: isDark ? "rgba(255,255,255,0.06)" : "#fff", border: `1px solid ${isDark ? "rgba(239,68,68,0.2)" : "#fecaca"}` }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {(mc.callerName?.[0] || "?").toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: isDark ? "#f3f4f6" : "#111827", lineHeight: 1.2 }}>{mc.callerName || "Someone"}</p>
                    <p style={{ margin: 0, fontSize: 10.5, color: isDark ? "#9ca3af" : "#6b7280" }}>
                      {ROLE_LABEL[mc.callerRole] || mc.callerRole || ""}{mc.at ? ` · ${fmtWhen(mc.at)}` : ""}
                    </p>
                  </div>
                </div>
              ))}
              {missedCallCount > 6 && (
                <span style={{ alignSelf: "center", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>+{missedCallCount - 6} more</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignSelf: "center" }}>
            {onOpenCalls && <button onClick={onOpenCalls} style={btn()}>Call back</button>}
            <button onClick={clearMissedCalls} style={btn()}>✓ Mark seen</button>
          </div>
        </div>
      )}

      {unreadMessageCount > 0 && (
        <div role="status" style={{
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          background: isDark ? "rgba(139,92,246,0.12)" : "#f5f3ff",
          border: `1.5px solid ${isDark ? "rgba(139,92,246,0.3)" : "#ddd6fe"}`,
          borderRadius: 16, padding: "12px 16px",
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>💬</div>
          <p style={{ margin: 0, flex: 1, minWidth: 160, fontSize: 14, fontWeight: 900, color: isDark ? "#c4b5fd" : "#6d28d9" }}>
            {unreadMessageCount} new message{unreadMessageCount > 1 ? "s" : ""}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {onOpenMessages && (
              <button onClick={onOpenMessages}
                style={btn({ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none" })}>
                Open messages
              </button>
            )}
            <button onClick={markMessagesSeen} style={btn()}>✓ Mark seen</button>
          </div>
        </div>
      )}
    </div>
  );
}
