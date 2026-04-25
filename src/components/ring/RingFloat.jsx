// src/components/ring/RingFloat.jsx
// Floating ring button shown on all dashboard pages.
// Opens a contact picker panel — click a contact to ring them.
// Includes a toggle to enable/disable incoming rings for your account.

import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useRing } from "../../context/RingContext";
import api from "../../api";

// Only show on these routes
const DASHBOARD_PATHS = [
  "/student/dashboard",
  "/teacher/dashboard",
  "/admin",
  "/sub-admin/dashboard",
];

function isDashboardPath(path) {
  return DASHBOARD_PATHS.some((p) => path.startsWith(p));
}

const ROLE_EMOJI = { teacher: "👨‍🏫", student: "🎓", admin: "🛡️", subAdmin: "🔧" };

export default function RingFloat() {
  const { user, role } = useAuth();
  const { ringUser }   = useRing();
  const location       = useLocation();

  const [open,         setOpen]         = useState(false);
  const [contacts,     setContacts]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [ringing,      setRinging]      = useState(null);   // userId currently being rung
  const [ringEnabled,  setRingEnabled]  = useState(true);
  const [toastMsg,     setToastMsg]     = useState("");
  const [search,       setSearch]       = useState("");
  const panelRef = useRef(null);
  const ringTimerRef = useRef(null);

  // Hide on non-dashboard routes
  if (!isDashboardPath(location.pathname)) return null;
  if (!user || !role) return null;

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Fetch ring preference once on mount
  useEffect(() => {
    api.get("/ring/preference")
      .then((r) => setRingEnabled(r.data.ringEnabled ?? true))
      .catch(() => {});
  }, []);

  // Fetch contacts when panel opens
  useEffect(() => {
    if (!open || contacts.length > 0) return;
    fetchContacts();
  }, [open]);

  async function fetchContacts() {
    setLoading(true);
    try {
      let list = [];

      if (role === "student") {
        // Students see teachers (their assigned teacher + any active teachers)
        const r = await api.get("/teachers?limit=50");
        const raw = r.data.teachers || r.data || [];
        list = raw.map((t) => ({
          id:   t._id,
          name: `${t.firstName} ${t.lastName}`.trim(),
          role: "teacher",
          active: t.active,
        })).filter((t) => t.active);

      } else if (role === "teacher") {
        // Teachers see their students
        const r = await api.get("/students?limit=100");
        const raw = r.data.students || r.data || [];
        list = raw.map((s) => ({
          id:   s._id,
          name: `${s.firstName} ${s.lastName}`.trim(),
          role: "student",
          active: s.active,
        })).filter((s) => s.active);

      } else if (role === "admin" || role === "subAdmin") {
        // Admins see both teachers and students
        const [tr, sr] = await Promise.allSettled([
          api.get("/teachers?limit=50"),
          api.get("/students?limit=100"),
        ]);
        const teachers = (tr.status === "fulfilled" ? (tr.value.data.teachers || []) : [])
          .filter((t) => t.active)
          .map((t) => ({ id: t._id, name: `${t.firstName} ${t.lastName}`.trim(), role: "teacher" }));
        const students = (sr.status === "fulfilled" ? (sr.value.data.students || []) : [])
          .filter((s) => s.active)
          .map((s) => ({ id: s._id, name: `${s.firstName} ${s.lastName}`.trim(), role: "student" }));
        list = [...teachers, ...students];
      }

      setContacts(list);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  }

  const handleRing = useCallback((contact) => {
    if (ringing) return;
    const callerName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Someone";

    ringUser({ targetUserId: contact.id, callerName });
    setRinging(contact.id);
    showToast(`Ringing ${contact.name}…`);

    // Auto-clear ringing state after 30s (matches server timeout)
    ringTimerRef.current = setTimeout(() => {
      setRinging(null);
      showToast("No answer");
    }, 30_000);
  }, [ringing, user, ringUser]);

  function handleCancelRing(contact) {
    clearTimeout(ringTimerRef.current);
    setRinging(null);
    showToast("Call cancelled");
  }

  async function toggleRingEnabled() {
    const next = !ringEnabled;
    setRingEnabled(next);
    try {
      await api.put("/ring/preference", { ringEnabled: next });
      showToast(next ? "Incoming calls enabled" : "Incoming calls muted");
    } catch {
      setRingEnabled(!next); // revert
      showToast("Failed to update preference");
    }
  }

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: "fixed", bottom: "100px", right: "24px", zIndex: 99980,
          background: "#1e293b", color: "#fff",
          padding: "10px 18px", borderRadius: "12px",
          fontSize: "13px", fontWeight: "600",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          animation: "ring-fadein 0.2s ease",
          pointerEvents: "none",
        }}>
          {toastMsg}
        </div>
      )}

      <style>{`
        @keyframes ring-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes ring-btn-pulse {
          0%,100% { box-shadow: 0 4px 20px rgba(99,102,241,0.5); }
          50%      { box-shadow: 0 4px 32px rgba(99,102,241,0.85); }
        }
        .ring-contact-row:hover { background: #f1f5f9 !important; }
      `}</style>

      <div ref={panelRef} style={{ position: "fixed", bottom: "24px", right: "90px", zIndex: 99970 }}>

        {/* Contact panel */}
        {open && (
          <div style={{
            position: "absolute", bottom: "68px", right: 0,
            width: "300px",
            background: "#fff",
            borderRadius: "20px",
            boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            animation: "ring-fadein 0.2s ease",
          }}>

            {/* Header */}
            <div style={{
              padding: "16px 18px 12px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "800" }}>📞 Ring Someone</p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", opacity: 0.8 }}>
                    Select a contact to call
                  </p>
                </div>

                {/* Toggle: accept incoming rings */}
                <button
                  onClick={toggleRingEnabled}
                  title={ringEnabled ? "Mute incoming calls" : "Unmute incoming calls"}
                  style={{
                    background: ringEnabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: "10px",
                    padding: "5px 10px",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "5px",
                  }}
                >
                  {ringEnabled ? "🔔 On" : "🔕 Off"}
                </button>
              </div>
            </div>

            {/* Search */}
            <div style={{ padding: "10px 14px 6px" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts…"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "8px 12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  fontSize: "13px",
                  outline: "none",
                  fontFamily: "inherit",
                  background: "#f8fafc",
                  color: "#1e293b",
                }}
              />
            </div>

            {/* Contact list */}
            <div style={{ maxHeight: "280px", overflowY: "auto", padding: "4px 0 8px" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: "13px" }}>
                  Loading contacts…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: "13px" }}>
                  {search ? "No matches" : "No contacts found"}
                </div>
              ) : filtered.map((contact) => {
                const isRinging = ringing === contact.id;
                return (
                  <div
                    key={contact.id}
                    className="ring-contact-row"
                    style={{
                      display: "flex", alignItems: "center",
                      padding: "10px 16px",
                      cursor: "pointer",
                      gap: "12px",
                      transition: "background 0.12s",
                      background: isRinging ? "#ede9fe" : "transparent",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      background: contact.role === "teacher"
                        ? "linear-gradient(135deg,#f97316,#fb923c)"
                        : contact.role === "student"
                        ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                        : "linear-gradient(135deg,#0ea5e9,#38bdf8)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "16px", flexShrink: 0,
                    }}>
                      {ROLE_EMOJI[contact.role] || "👤"}
                    </div>

                    {/* Name + role */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {contact.name}
                      </p>
                      <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", textTransform: "capitalize" }}>
                        {contact.role}
                      </p>
                    </div>

                    {/* Ring / Cancel button */}
                    {isRinging ? (
                      <button
                        onClick={() => handleCancelRing(contact)}
                        style={{
                          background: "#fef2f2", border: "1px solid #fecaca",
                          borderRadius: "8px", padding: "5px 10px",
                          fontSize: "11px", fontWeight: "700", color: "#ef4444",
                          cursor: "pointer", flexShrink: 0,
                        }}
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRing(contact)}
                        disabled={!!ringing}
                        style={{
                          background: ringing ? "#f1f5f9" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                          border: "none",
                          borderRadius: "8px", padding: "5px 12px",
                          fontSize: "13px",
                          cursor: ringing ? "not-allowed" : "pointer",
                          opacity: ringing && !isRinging ? 0.5 : 1,
                          flexShrink: 0,
                        }}
                        title={`Ring ${contact.name}`}
                      >
                        📞
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer note */}
            <div style={{
              padding: "8px 16px 12px",
              borderTop: "1px solid #f1f5f9",
              fontSize: "11px", color: "#cbd5e1", textAlign: "center",
            }}>
              🔔 Toggle above controls whether others can ring you
            </div>
          </div>
        )}

        {/* Floating button */}
        <button
          onClick={() => setOpen((o) => !o)}
          title="Ring someone"
          style={{
            width: "52px", height: "52px",
            borderRadius: "50%",
            background: open
              ? "linear-gradient(135deg,#8b5cf6,#6366f1)"
              : "linear-gradient(135deg,#6366f1,#8b5cf6)",
            border: "none",
            cursor: "pointer",
            fontSize: "22px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px rgba(99,102,241,0.5)",
            animation: ringing ? "ring-btn-pulse 0.9s ease-in-out infinite" : "none",
            transform: open ? "scale(1.08)" : "scale(1)",
            transition: "transform 0.15s, background 0.15s",
            color: "#fff",
          }}
        >
          {ringing ? "📳" : open ? "✕" : "📞"}
        </button>
      </div>
    </>
  );
}
