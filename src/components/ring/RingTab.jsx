// src/components/ring/RingTab.jsx
// "Ring" tab inside the Messages panel.
// - Admin  → sees all teachers + all students, can ring any of them
// - Teacher → sees only their assigned students
// - Student → sees their assigned teacher(s) + admin
// No voice. Sends a socket ring notification that plays a ringtone on the
// recipient's screen until they answer, decline, or it times out (30 s).

import { useState, useEffect, useRef, useCallback } from "react";
import { Phone, PhoneOff, PhoneMissed, Search, RefreshCw, Bell, BellOff } from "lucide-react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext.jsx";
import { useRing } from "../../context/RingContext";
import MissedCalls from "./MissedCalls";
import { RINGTONES, CUSTOM_RINGTONE_ID, makeCustomRingtone } from "./ringtones.js";
import { saveCustomToneUrl, saveCustomToneIDB, loadCustomTone, clearCustomTone } from "./ringStorage.js";

const ROLE_COLOR = {
  teacher:  { grad: "linear-gradient(135deg,#1d4ed8,#0891b2)", badge: "#1d4ed8", light: "#dbeafe" },
  student:  { grad: "linear-gradient(135deg,#047857,#10b981)", badge: "#047857", light: "#d1fae5" },
  admin:    { grad: "linear-gradient(135deg,#7c3aed,#a855f7)", badge: "#7c3aed", light: "#ede9fe" },
  subAdmin: { grad: "linear-gradient(135deg,#b45309,#f59e0b)", badge: "#b45309", light: "#fef3c7" },
};

function getInitials(name = "") {
  const p = name.trim().split(" ");
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export default function RingTab({ isDark }) {
  const { user, role }                                               = useAuth();
  const { ringUser, cancelRing, callerEvent, consumeCallerEvent,
          missedCallCount, clearMissedCalls, socketConnected,
          ringtoneId, setRingtoneId }                                = useRing();

  const [contacts,    setContacts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [ringingId,   setRingingId]   = useState(null); // userId being rung right now
  const [callStatus,  setCallStatus]  = useState({}); // userId → "calling"|"answered"|"declined"|"missed"
  const [ringEnabled, setRingEnabled] = useState(true);
  const [toggling,    setToggling]    = useState(false);
  const [previewingId,   setPreviewingId]   = useState(null);  // id of tone currently being previewed
  const [tonesOpen,      setTonesOpen]      = useState(false);  // ringtone picker collapsed by default
  const [uploading,      setUploading]      = useState(false);  // upload in progress
  const [uploadError,    setUploadError]    = useState(null);   // inline error message
  const [customFileName, setCustomFileName] = useState(
    () => localStorage.getItem("ring_tone_file_name") || null
  );
  const ringTimerRef   = useRef(null);
  const previewRef     = useRef(null); // { stop } for the preview audio
  const fileInputRef   = useRef(null);

  // Stop any in-progress preview when component unmounts
  useEffect(() => () => {
    previewRef.current?.stop();
    previewRef.current = null;
  }, []);

  const stopPreview = useCallback(() => {
    previewRef.current?.stop();
    previewRef.current = null;
    setPreviewingId(null);
  }, []);

  // Preview a synthetic tone
  const handlePreview = useCallback((tone) => {
    if (previewingId === tone.id) { stopPreview(); return; }
    stopPreview();
    previewRef.current = tone.make();
    setPreviewingId(tone.id);
    setTimeout(stopPreview, 4000);
  }, [previewingId, stopPreview]);

  // Preview the custom tone — fetches the audio from the stored S3 URL
  // (first fetch hits S3, subsequent calls are served from browser cache)
  const handlePreviewCustom = useCallback(async () => {
    if (previewingId === CUSTOM_RINGTONE_ID) { stopPreview(); return; }
    stopPreview();
    try {
      const buf = await loadCustomTone();
      if (!buf) return;
      previewRef.current = makeCustomRingtone(buf);
      setPreviewingId(CUSTOM_RINGTONE_ID);
      setTimeout(stopPreview, 4000);
    } catch { /* fail silently */ }
  }, [previewingId, stopPreview]);

  // Handle file selection — try S3 first, fall back to IndexedDB silently
  const handleCustomFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow re-selecting the same file later
    setUploading(true);
    setUploadError(null);

    // Read file bytes once — used for IDB fallback AND local preview
    const localBuf = await file.arrayBuffer();

    try {
      // ── Try S3 upload ──────────────────────────────────────────────────────
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/ring/ringtone", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!res.data.success) throw new Error(res.data.message || "Upload failed");
      saveCustomToneUrl(res.data.url, file.name);

    } catch (err) {
      const status = err?.response?.status;

      if (status === 503) {
        // S3 not configured on this server — save to IndexedDB silently.
        // Works perfectly in local dev; production should always have S3 set.
        await saveCustomToneIDB(localBuf.slice(0), file.name);
      } else {
        // Genuine error (network failure, bad file type, etc.) — show inline
        const msg = err?.response?.data?.message || err.message || "Upload failed";
        setUploadError(msg);
        setUploading(false);
        return;
      }
    }

    setCustomFileName(file.name);
    setRingtoneId(CUSTOM_RINGTONE_ID);
    // Auto-preview using the already-read local buffer — no extra network call
    stopPreview();
    previewRef.current = makeCustomRingtone(localBuf.slice(0));
    setPreviewingId(CUSTOM_RINGTONE_ID);
    setTimeout(stopPreview, 4000);
    setUploading(false);
  }, [setRingtoneId, stopPreview]);

  // Remove the custom ringtone from S3 and clear local state
  const handleClearCustom = useCallback(async () => {
    stopPreview();
    // Fire-and-forget — UI clears immediately regardless of network outcome
    api.delete("/ring/ringtone").catch(() => {});
    clearCustomTone();
    setCustomFileName(null);
    if (ringtoneId === CUSTOM_RINGTONE_ID) setRingtoneId("chime");
  }, [ringtoneId, setRingtoneId, stopPreview]);

  const C = {
    bg:      isDark ? "#13151c" : "#f8f9ff",
    card:    isDark ? "#1a1d2e" : "#ffffff",
    border:  isDark ? "rgba(255,255,255,0.08)" : "#eef0f8",
    text:    isDark ? "#e8eaf6" : "#1a1d2e",
    sub:     isDark ? "#8b91b8" : "#9ea3be",
    input:   isDark ? "#1e2235" : "#eef0f8",
    accent:  "#6366f1",
  };

  // ── Fetch contacts from the backend (role-aware, booking-based) ──────────
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const r    = await api.get("/ring/contacts");
      const list = (r.data.contacts || []).map(c => ({
        id:          c.id || c._id,
        name:        c.name,
        role:        c.role,
        ringEnabled: c.ringEnabled ?? true,
      }));
      setContacts(list);
    } catch (err) {
      console.error("RingTab contacts fetch failed:", err.message);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Fetch own ring preference
  useEffect(() => {
    api.get("/ring/preference")
      .then(r => setRingEnabled(r.data.ringEnabled ?? true))
      .catch(() => {});
  }, []);

  // Clear missed-call badge whenever the Ring tab is mounted/visible
  useEffect(() => {
    clearMissedCalls();
  }, [clearMissedCalls]);

  // React to caller-side feedback: ring was answered or declined by the target
  useEffect(() => {
    if (!callerEvent) return;
    clearTimeout(ringTimerRef.current);
    const { type, by, reason } = callerEvent;
    // 'by' is undefined when the server auto-declines before forwarding (muted / offline)
    const targetId = by != null ? by.toString() : ringingId;

    setRingingId(null);
    if (targetId) {
      const newStatus = type === "answered" ? "answered"
                      : reason === "muted"   ? "muted"
                      : reason === "offline" ? "offline"
                      : "declined";
      setCallStatus(prev => ({ ...prev, [targetId]: newStatus }));
      setTimeout(() => setCallStatus(prev => {
        const next = { ...prev };
        if (next[targetId] === newStatus) delete next[targetId];
        return next;
      }), type === "answered" ? 5000 : 3000);
    }
    consumeCallerEvent();
  }, [callerEvent, consumeCallerEvent, ringingId]);

  // ── Ring a contact ────────────────────────────────────────────────────────
  const handleRing = useCallback((contact) => {
    if (ringingId || contact.ringEnabled === false) return;
    const callerName = user
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Someone"
      : "Someone";

    ringUser({ targetUserId: contact.id, targetRole: contact.role, callerName });
    setRingingId(contact.id);
    setCallStatus(prev => ({ ...prev, [contact.id]: "calling" }));

    ringTimerRef.current = setTimeout(() => {
      setRingingId(null);
      setCallStatus(prev => ({ ...prev, [contact.id]: "missed" }));
      setTimeout(() => setCallStatus(prev => {
        const next = { ...prev }; delete next[contact.id]; return next;
      }), 4000);
    }, 30_000);
  }, [ringingId, user, ringUser]);

  const handleCancel = useCallback(() => {
    if (!ringingId) return;
    clearTimeout(ringTimerRef.current);
    cancelRing(); // uses internal ringId ref — no argument needed
    setCallStatus(prev => ({ ...prev, [ringingId]: "missed" }));
    setRingingId(null);
    setTimeout(() => setCallStatus(prev => {
      const next = { ...prev }; delete next[ringingId]; return next;
    }), 3000);
  }, [ringingId, cancelRing]);

  // ── Toggle incoming ring preference ──────────────────────────────────────
  const toggleRingEnabled = async () => {
    setToggling(true);
    const next = !ringEnabled;
    setRingEnabled(next);
    try { await api.put("/ring/preference", { ringEnabled: next }); }
    catch { setRingEnabled(!next); }
    finally { setToggling(false); }
  };

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.role.toLowerCase().includes(search.toLowerCase())
  );

  // Group by role for cleaner display
  const grouped = filtered.reduce((acc, c) => {
    const key = c.role;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  const groupOrder = ["teacher", "student", "admin", "subAdmin"];
  const groupLabel = { teacher: "Teachers", student: "Students", admin: "Admin", subAdmin: "Sub-Admins" };

  // ── Computed values used in JSX (avoids IIFEs which confuse the Babel parser) ──
  const _activeTone       = RINGTONES.find(r => r.id === ringtoneId);
  const selectedToneLabel = ringtoneId === CUSTOM_RINGTONE_ID
    ? (customFileName
        ? `📁 ${customFileName.length > 18 ? customFileName.slice(0, 16) + "…" : customFileName}`
        : "📁 Custom")
    : (_activeTone ? `${_activeTone.emoji} ${_activeTone.label}` : "");

  // Custom chip state — pre-computed so they can be used inline without an IIFE
  const customIsSelected   = ringtoneId   === CUSTOM_RINGTONE_ID;
  const customIsPreviewing = previewingId === CUSTOM_RINGTONE_ID;
  const customHasFile      = !!customFileName;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: C.bg, fontFamily: "var(--font-body)",
    }}>
      <style>{`
        @keyframes ring-spin { to { transform: rotate(360deg); } }
        @keyframes ring-pulse-red {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50%      { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        @keyframes ring-pulse-green {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50%      { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
        }
        @keyframes ring-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        .ring-contact-card:hover { background: ${isDark ? "rgba(255,255,255,0.04)" : "rgba(99,102,241,0.04)"} !important; }
      `}</style>

      {/* ── Session expired warning ── */}
      {socketConnected === false && (
        <div style={{
          background: isDark ? "rgba(239,68,68,0.12)" : "#fef2f2",
          borderBottom: `1px solid ${isDark ? "rgba(239,68,68,0.25)" : "#fecaca"}`,
          padding: "10px 20px",
          display: "flex", alignItems: "center", gap: "10px",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "16px" }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "12px", fontWeight: "800", color: isDark ? "#fca5a5" : "#dc2626" }}>
              Session expired — ring is offline
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: isDark ? "#f87171" : "#ef4444", opacity: 0.8 }}>
              Log out and back in to restore calling
            </p>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        padding: "16px 20px 12px",
        borderBottom: `1px solid ${C.border}`,
        background: isDark ? "#16191f" : "#fff",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: C.text }}>
                📞 Ring
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: C.sub }}>
                {contacts.length} contact{contacts.length !== 1 ? "s" : ""} available
              </p>
            </div>
            {missedCallCount > 0 && (
              <div style={{
                background: "#ef4444", color: "#fff",
                borderRadius: "20px", padding: "2px 9px",
                fontSize: "11px", fontWeight: "800",
                display: "flex", alignItems: "center", gap: "4px",
              }}>
                <PhoneMissed size={11} />
                {missedCallCount} missed
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Refresh */}
            <button
              onClick={fetchContacts}
              title="Refresh contacts"
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "6px", borderRadius: "8px", color: C.sub,
                display: "flex", alignItems: "center",
              }}
            >
              <RefreshCw size={14} style={loading ? { animation: "ring-spin 1s linear infinite" } : {}} />
            </button>

            {/* Ring-enabled toggle */}
            <button
              onClick={toggleRingEnabled}
              disabled={toggling}
              title={ringEnabled ? "Mute incoming calls" : "Unmute incoming calls"}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "6px 12px", borderRadius: "20px", border: "none",
                cursor: "pointer", fontSize: "11px", fontWeight: "700",
                background: ringEnabled
                  ? (isDark ? "rgba(34,197,94,0.15)" : "#f0fdf4")
                  : (isDark ? "rgba(239,68,68,0.12)" : "#fef2f2"),
                color: ringEnabled ? "#22c55e" : "#ef4444",
                transition: "all 0.2s",
              }}
            >
              {ringEnabled
                ? <><Bell size={12} /> Receiving calls</>
                : <><BellOff size={12} /> Calls muted</>
              }
            </button>
          </div>
        </div>

        {/* ── Ringtone picker (collapsible) ── */}
        <div style={{
          marginBottom: "12px",
          borderRadius: "12px",
          border: `1px solid ${C.border}`,
          overflow: "hidden",
        }}>
          {/* Toggle header */}
          <button
            onClick={() => setTonesOpen(o => !o)}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "9px 12px",
              background: tonesOpen
                ? (isDark ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.05)")
                : (isDark ? "rgba(255,255,255,0.03)" : "#fafbff"),
              border: "none", cursor: "pointer",
              transition: "background 0.15s",
              fontFamily: "inherit",
            }}
          >
            {/* Left: label */}
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <span style={{ fontSize: "13px" }}>🎵</span>
              <span style={{ fontSize: "11.5px", fontWeight: "800",
                textTransform: "uppercase", letterSpacing: "0.07em", color: C.sub }}>
                Ringtone
              </span>
            </div>
            {/* Right: current selection + chevron */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: "700", color: C.accent }}>
                {selectedToneLabel}
              </span>
              <span style={{
                fontSize: "10px", color: C.sub,
                display: "inline-block",
                transform: tonesOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}>
                ▼
              </span>
            </div>
          </button>

          {/* Collapsible body */}
          {tonesOpen && (
            <div style={{
              padding: "10px 12px 12px",
              borderTop: `1px solid ${C.border}`,
              background: isDark ? "rgba(255,255,255,0.015)" : "#fff",
            }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {/* ── Synthetic tones ── */}
            {RINGTONES.map(tone => {
              const isSelected   = ringtoneId === tone.id;
              const isPreviewing = previewingId === tone.id;
              return (
                <button
                  key={tone.id}
                  onClick={() => setRingtoneId(tone.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "5px 10px", borderRadius: "20px",
                    border: isSelected
                      ? `2px solid ${C.accent}`
                      : `2px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                    background: isSelected
                      ? (isDark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.08)")
                      : (isDark ? "rgba(255,255,255,0.04)" : "#f8fafc"),
                    cursor: "pointer",
                    fontSize: "11.5px", fontWeight: isSelected ? "800" : "600",
                    color: isSelected ? C.accent : C.sub,
                    transition: "all 0.15s", fontFamily: "inherit",
                  }}
                >
                  <span style={{ fontSize: "13px" }}>{tone.emoji}</span>
                  {tone.label}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); handlePreview(tone); }}
                    title={isPreviewing ? "Stop preview" : "Preview"}
                    style={{
                      marginLeft: "3px", fontSize: "10px",
                      background: isPreviewing ? "#ef4444" : (isDark ? "rgba(255,255,255,0.12)" : "#e2e8f0"),
                      color: isPreviewing ? "#fff" : C.sub,
                      borderRadius: "50%", width: "16px", height: "16px",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, cursor: "pointer", transition: "background 0.15s",
                    }}
                  >
                    {isPreviewing ? "■" : "▶"}
                  </span>
                </button>
              );
            })}

            {/* ── Custom (device file) chip ── */}
            <button
              onClick={() => {
                if (uploading) return;
                if (customHasFile) {
                  setRingtoneId(CUSTOM_RINGTONE_ID);
                } else {
                  fileInputRef.current?.click();
                }
              }}
              disabled={uploading}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "5px 10px", borderRadius: "20px",
                border: customIsSelected
                  ? `2px solid ${C.accent}`
                  : `2px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                background: customIsSelected
                  ? (isDark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.08)")
                  : (isDark ? "rgba(255,255,255,0.04)" : "#f8fafc"),
                cursor: "pointer",
                fontSize: "11.5px", fontWeight: customIsSelected ? "800" : "600",
                color: customIsSelected ? C.accent : C.sub,
                transition: "all 0.15s", fontFamily: "inherit",
                maxWidth: "160px",
              }}
              title={customHasFile ? customFileName : "Pick an audio file from your device"}
            >
              <span style={{ fontSize: "13px" }}>📁</span>
              <span style={{
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: "80px",
              }}>
                {customHasFile ? customFileName : "Custom"}
              </span>
              {customHasFile && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); handlePreviewCustom(); }}
                  title={customIsPreviewing ? "Stop preview" : "Preview"}
                  style={{
                    marginLeft: "2px", fontSize: "10px",
                    background: customIsPreviewing ? "#ef4444" : (isDark ? "rgba(255,255,255,0.12)" : "#e2e8f0"),
                    color: customIsPreviewing ? "#fff" : C.sub,
                    borderRadius: "50%", width: "16px", height: "16px",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, cursor: "pointer", transition: "background 0.15s",
                  }}
                >
                  {customIsPreviewing ? "■" : "▶"}
                </span>
              )}
            </button>
          </div>

          {/* Single always-rendered hidden file input — lives outside conditional
              blocks so fileInputRef is always valid regardless of which tone
              is selected.                                                     */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            style={{ display: "none" }}
            onChange={handleCustomFileChange}
          />

          {/* ── File controls (shown when Custom is selected) ── */}
          {ringtoneId === CUSTOM_RINGTONE_ID && (
            <div style={{
              marginTop: "8px",
              display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
            }}>
              <button
                onClick={() => { if (!uploading) { setUploadError(null); fileInputRef.current?.click(); } }}
                disabled={uploading}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "5px 12px", borderRadius: "8px", border: "none",
                  background: isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)",
                  color: C.accent, cursor: uploading ? "wait" : "pointer",
                  fontSize: "11.5px", fontWeight: "700", fontFamily: "inherit",
                  opacity: uploading ? 0.7 : 1, transition: "opacity 0.2s",
                }}
              >
                {uploading
                  ? <><span style={{ animation: "ring-spin 0.8s linear infinite", display: "inline-block" }}>⏳</span> Uploading…</>
                  : (customFileName ? "🔄 Change file" : "📂 Choose audio file")
                }
              </button>
              {customFileName && !uploading && (
                <button
                  onClick={handleClearCustom}
                  title="Remove custom tone"
                  style={{
                    display: "flex", alignItems: "center", gap: "4px",
                    padding: "5px 10px", borderRadius: "8px", border: "none",
                    background: isDark ? "rgba(239,68,68,0.12)" : "#fef2f2",
                    color: "#ef4444", cursor: "pointer",
                    fontSize: "11.5px", fontWeight: "700", fontFamily: "inherit",
                  }}
                >
                  ✕ Remove
                </button>
              )}
              <span style={{ fontSize: "11px", color: C.sub }}>
                MP3, WAV, OGG, AAC · saved to cloud ☁️
              </span>
              {uploadError && (
                <span style={{
                  fontSize: "11px", color: "#ef4444", fontWeight: "600",
                  display: "flex", alignItems: "center", gap: "4px",
                  marginTop: "2px", width: "100%",
                }}>
                  ⚠️ {uploadError}
                </span>
              )}
            </div>
          )}

            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={13} style={{
            position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)",
            color: C.sub, pointerEvents: "none",
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or role…"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "8px 12px 8px 30px",
              background: C.input, border: `1px solid ${C.border}`,
              borderRadius: "10px", fontSize: "12.5px", color: C.text,
              outline: "none", fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      {/* ── Contact list ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }} className="msg-scrollbar">
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: C.sub, gap: "10px", flexDirection: "column" }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "ring-spin 0.8s linear infinite" }} />
            <span style={{ fontSize: "13px" }}>Loading contacts…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", color: C.sub, gap: "8px" }}>
            <Phone size={32} style={{ opacity: 0.2 }} />
            <p style={{ margin: 0, fontSize: "13px" }}>
              {search ? "No contacts match your search" : "No contacts available"}
            </p>
          </div>
        ) : (
          groupOrder.filter(g => grouped[g]?.length).map(g => (
            <div key={g} style={{ animation: "ring-fadein 0.2s ease" }}>
              {/* Group label */}
              <div style={{
                padding: "10px 20px 4px",
                fontSize: "10.5px", fontWeight: "800", letterSpacing: "0.08em",
                textTransform: "uppercase", color: C.sub,
              }}>
                {groupLabel[g]} · {grouped[g].length}
              </div>

              {grouped[g].map(contact => {
                const rc       = ROLE_COLOR[contact.role] || ROLE_COLOR.student;
                const isRing   = ringingId === contact.id;
                const status   = callStatus[contact.id];
                const isMuted  = contact.ringEnabled === false;

                return (
                  <div
                    key={contact.id}
                    className="ring-contact-card"
                    style={{
                      display: "flex", alignItems: "center",
                      padding: "10px 20px", gap: "13px",
                      transition: "background 0.12s",
                      background: isRing
                        ? (isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.06)")
                        : "transparent",
                      opacity: isMuted ? 0.65 : 1,
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: "42px", height: "42px", borderRadius: "13px",
                      background: rc.grad, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "13px", fontWeight: "800", color: "#fff",
                      boxShadow: `0 4px 12px ${rc.badge}40`,
                    }}>
                      {getInitials(contact.name)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0, fontSize: "13.5px", fontWeight: "700", color: C.text,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {contact.name}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: "10px", fontWeight: "700", color: rc.badge,
                          background: isDark ? `${rc.badge}25` : rc.light,
                          padding: "1px 7px", borderRadius: "6px", textTransform: "capitalize",
                        }}>
                          {contact.role}
                        </span>
                        {isMuted && (
                          <span style={{
                            fontSize: "10px", fontWeight: "700", color: "#ef4444",
                            background: isDark ? "rgba(239,68,68,0.12)" : "#fef2f2",
                            padding: "1px 7px", borderRadius: "6px",
                            display: "inline-flex", alignItems: "center", gap: "2px",
                          }}>
                            🔕 Muted
                          </span>
                        )}
                        {status === "calling" && (
                          <span style={{ fontSize: "10px", color: C.accent, fontWeight: "600" }}>
                            Ringing…
                          </span>
                        )}
                        {status === "answered" && (
                          <span style={{ fontSize: "10px", color: "#22c55e", fontWeight: "600" }}>
                            Answered ✓
                          </span>
                        )}
                        {status === "declined" && (
                          <span style={{ fontSize: "10px", color: "#ef4444", fontWeight: "600" }}>
                            Declined
                          </span>
                        )}
                        {status === "muted" && (
                          <span style={{ fontSize: "10px", color: "#ef4444", fontWeight: "600" }}>
                            🔕 Calls muted
                          </span>
                        )}
                        {status === "offline" && (
                          <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "600" }}>
                            📴 Offline
                          </span>
                        )}
                        {status === "missed" && (
                          <span style={{ fontSize: "10px", color: "#f59e0b", fontWeight: "600" }}>
                            No answer
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Call / Cancel button */}
                    {isRing ? (
                      <button
                        onClick={handleCancel}
                        style={{
                          width: "40px", height: "40px", borderRadius: "50%",
                          background: "#ef4444", border: "none",
                          cursor: "pointer", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          animation: "ring-pulse-red 1s ease-in-out infinite",
                          color: "#fff",
                        }}
                        title="Cancel call"
                      >
                        <PhoneOff size={16} />
                      </button>
                    ) : status === "answered" ? (
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "50%",
                        background: "#f0fdf4", border: "2px solid #bbf7d0",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <Phone size={16} color="#22c55e" />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRing(contact)}
                        disabled={!!ringingId || socketConnected === false || isMuted}
                        style={{
                          width: "40px", height: "40px", borderRadius: "50%",
                          background: (ringingId || socketConnected === false || isMuted)
                            ? (isDark ? "#1e2235" : "#f1f5f9")
                            : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                          border: "none",
                          cursor: (ringingId || socketConnected === false || isMuted) ? "not-allowed" : "pointer",
                          flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          opacity: (ringingId || socketConnected === false || isMuted) ? 0.35 : 1,
                          transition: "all 0.15s",
                          boxShadow: (ringingId || socketConnected === false || isMuted) ? "none" : "0 4px 14px rgba(99,102,241,0.4)",
                          color: "#fff", fontSize: "16px",
                        }}
                        title={isMuted ? "This user has calls muted" : socketConnected === false ? "Session expired — please log out and back in" : `Ring ${contact.name}`}
                      >
                        {isMuted ? "🔕" : <Phone size={16} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}

        {/* ── Missed calls section ── */}
        <div style={{
          margin: "8px 12px 12px",
          padding: "12px 14px",
          borderRadius: "14px",
          background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
          border: `1px solid ${C.border}`,
        }}>
          <MissedCalls isDark={isDark} />
        </div>
      </div>

      {/* ── Active call bar ── */}
      {ringingId && (
        <div style={{
          padding: "12px 20px",
          borderTop: `1px solid ${C.border}`,
          background: isDark ? "#16191f" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0, animation: "ring-fadein 0.2s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#6366f1", animation: "ring-pulse-red 1s ease-in-out infinite",
            }} />
            <span style={{ fontSize: "12px", fontWeight: "700", color: C.text }}>
              Calling {contacts.find(c => c.id === ringingId)?.name || "…"}
            </span>
          </div>
          <button
            onClick={handleCancel}
            style={{
              background: "#ef4444", border: "none", borderRadius: "8px",
              padding: "6px 14px", fontSize: "12px", fontWeight: "700",
              color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "5px",
            }}
          >
            <PhoneMissed size={13} /> End
          </button>
        </div>
      )}
    </div>
  );
}
