// src/components/DeviceNotificationPrompt.jsx
// Notifications are per device. This shows:
//
//  1. FIRST TIME on a device — "Get notifications on this device?" Allow / Not now.
//     The browser's own permission pop-up only appears after Allow.
//  2. WEEKLY TIP — while notifications are still NOT on for this device, a small
//     "ℹ️ Tip" at most once a week: Turn on / Later / Don't remind me.
//     If the browser has blocked notifications, the tip explains how to unblock.
//     The reminder can also be switched off in My devices (SessionManagement).
//
// Browser already allowed + user said yes before → re-attached silently, nothing shown.

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bell, Info, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  pushSupported, pushPermission, getDeviceChoice, getPushStatus,
  enablePush, declinePush, restorePushIfAllowed,
  isTipDue, markTipShown, setTipsEnabled,
} from "../utils/pushNotifications";

const DASHBOARD_PATHS = ["/student/dashboard", "/teacher/dashboard", "/admin", "/sub-admin/dashboard", "/parent/dashboard"];
const isDashboard = (p) => DASHBOARD_PATHS.some(d => p.startsWith(d)) && !p.endsWith("/login");

export default function DeviceNotificationPrompt() {
  const { role, user } = useAuth();
  const location = useLocation();
  const [mode,   setMode]   = useState(null);  // null | "ask" | "tip" | "blocked-tip"
  const [busy,   setBusy]   = useState(false);
  const [result, setResult] = useState(null);  // "on" | "blocked" | "error"

  const onDashboard = isDashboard(location.pathname);
  const userId = user?.id || user?._id;

  useEffect(() => {
    setMode(null);
    setResult(null);
    if (!role || !userId || !onDashboard || !pushSupported()) return;

    let cancelled = false;
    let timer;
    (async () => {
      const perm = pushPermission();

      // Already allowed in this browser → re-attach to this login quietly
      if (perm === "granted" && await restorePushIfAllowed()) return;
      if (cancelled) return;

      // Never answered on this device → the first-time question
      if (!getDeviceChoice() && perm !== "denied") {
        timer = setTimeout(() => { if (!cancelled) { markTipShown(); setMode("ask"); } }, 2500);
        return;
      }

      // Not on for this device → gentle weekly tip
      if (!isTipDue()) return;
      if (await getPushStatus()) return;
      if (cancelled) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        markTipShown();
        setMode(perm === "denied" ? "blocked-tip" : "tip");
      }, 4000);
    })();

    return () => { cancelled = true; clearTimeout(timer); };
  }, [role, userId, onDashboard]);

  if (!mode) return null;

  const close = () => setMode(null);

  const allow = async () => {
    setBusy(true);
    const { ok, reason } = await enablePush();
    setBusy(false);
    setResult(ok ? "on" : reason === "denied" ? "blocked" : "error");
    setTimeout(close, ok ? 2500 : 4500);
  };

  const notNow = () => { declinePush(); close(); };
  const later  = () => close(); // already marked as shown → back in a week
  const stopReminders = () => { setTipsEnabled(false); close(); };

  const isTip = mode === "tip" || mode === "blocked-tip";

  return (
    <div role="dialog" aria-labelledby="dnp-title" className="dnp-card" style={{
      position: "fixed", left: 16, zIndex: 9985, width: `min(${isTip ? 340 : 360}px, calc(100vw - 32px))`,
      background: isTip ? "#f8fafc" : "#fff", borderRadius: 18, boxShadow: "0 12px 40px rgba(15,23,42,0.22)",
      border: `1px solid ${isTip ? "#cbd5e1" : "#e2e8f0"}`, padding: "14px 16px 12px",
      fontFamily: "'Inter', system-ui, sans-serif", animation: "dnp-in .25s ease",
    }}>
      <style>{`@keyframes dnp-in { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform:none } }
        .dnp-card { bottom: 16px; }
        @media (max-width: 640px) { .dnp-card { bottom: auto; top: 16px; } }
        .dnp-link { background:none; border:none; padding:0; cursor:pointer; font: inherit; color:#64748b; text-decoration: underline; }`}</style>

      {result ? (
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: result === "on" ? "#059669" : "#b45309" }}>
          {result === "on"      && "🔔 Notifications are on for this device."}
          {result === "blocked" && "Notifications are blocked for this site. You can allow them later in your browser's site settings."}
          {result === "error"   && "Couldn't turn on notifications right now. You can try again from your devices / sessions settings."}
        </p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{
              width: isTip ? 30 : 38, height: isTip ? 30 : 38, borderRadius: isTip ? 10 : 12, flexShrink: 0,
              background: isTip ? "#e0e7ff" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {isTip ? <Info size={16} color="#4f46e5" /> : <Bell size={18} color="#fff" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isTip && (
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#4f46e5" }}>Tip</span>
              )}
              <p id="dnp-title" style={{ margin: 0, fontSize: isTip ? 13.5 : 14.5, fontWeight: 800, color: "#0f172a" }}>
                {mode === "ask"         && "Get notifications on this device?"}
                {mode === "tip"         && "Notifications are off on this device"}
                {mode === "blocked-tip" && "Notifications are blocked in this browser"}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "#64748b" }}>
                {mode === "ask" && "Class reminders, messages and calls — even when the app is closed. Only this device; logging out here turns them off."}
                {mode === "tip" && "Turn them on to get class reminders, messages and calls here, even when the app is closed."}
                {mode === "blocked-tip" && <>To get class reminders here, click the 🔒 icon next to the web address, set <strong>Notifications</strong> to <strong>Allow</strong>, then reload the page.</>}
              </p>
            </div>
            <button onClick={mode === "ask" ? notNow : later} aria-label="Close" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 2 }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", marginTop: 12 }}>
            {isTip && (
              <button className="dnp-link" onClick={stopReminders} style={{ marginRight: "auto", fontSize: 12 }}>
                Don't remind me
              </button>
            )}
            {mode === "blocked-tip" ? (
              <button onClick={later}
                style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#4f46e5", color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                Got it
              </button>
            ) : (
              <>
                <button onClick={mode === "ask" ? notNow : later} disabled={busy}
                  style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#334155", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {mode === "ask" ? "Not now" : "Later"}
                </button>
                <button onClick={allow} disabled={busy}
                  style={{ padding: "7px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.7 : 1 }}>
                  {busy ? "Turning on…" : mode === "ask" ? "Allow" : "Turn on"}
                </button>
              </>
            )}
          </div>
          {mode === "ask" && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#94a3b8" }}>
              You can change this any time in your <strong>devices / sessions</strong> settings.
            </p>
          )}
        </>
      )}
    </div>
  );
}
