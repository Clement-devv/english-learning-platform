// src/components/SignedOutNotice.jsx
// After this device was signed out remotely (deviceWipe.js), explain why on
// the login page instead of silently dropping the user there.
import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";

export default function SignedOutNotice() {
  const [reason, setReason] = useState(null);

  useEffect(() => {
    try {
      const r = sessionStorage.getItem("signedOutReason");
      if (r) {
        sessionStorage.removeItem("signedOutReason");
        setReason(r);
      }
    } catch { /* storage unavailable */ }
  }, []);

  if (!reason) return null;

  return (
    <div role="alert" style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
      width: "min(440px, calc(100vw - 32px))", display: "flex", gap: 10, alignItems: "flex-start",
      background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 14,
      padding: "12px 14px", boxShadow: "0 8px 30px rgba(15,23,42,0.15)", fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, flex: 1 }}>
        <strong>You were signed out on this device.</strong> Your account was logged out from another device, and this app's data here has been erased. Log in again to continue.
      </p>
      <button onClick={() => setReason(null)} aria-label="Dismiss" style={{ background: "none", border: "none", color: "#9a3412", cursor: "pointer", padding: 0 }}>
        <X size={16} />
      </button>
    </div>
  );
}
