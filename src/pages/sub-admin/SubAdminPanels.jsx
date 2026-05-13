// src/pages/sub-admin/SubAdminPanels.jsx
// All sub-admin panel components as named exports.
// Imported by SubAdminDashboard (legacy shell) and SunshineShell.

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Video, BookOpen,
  CheckCircle, Clock, XCircle, AlertCircle,
  RefreshCw, Loader2,
  DollarSign, Film, BarChart2, Star, RotateCcw,
  ChevronRight, ChevronLeft,
} from "lucide-react";
import { getCachedCenter } from "../../utils/branding";
import { dashboardColors } from "../../utils/dashboardColors";
import api from "../../api";
import MessagesTab from "../../components/chat/MessagesTab";

// ── Shared helpers ─────────────────────────────────────────────────────────────
export async function apiFetch(url) {
  const token = sessionStorage.getItem("subAdminToken") || localStorage.getItem("subAdminToken");
  const slug  = import.meta.env.VITE_CENTER_SLUG || getCachedCenter()?.slug;
  const headers = { Authorization: `Bearer ${token}` };
  if (slug) headers["x-center-slug"] = slug;
  const res = await fetch(url, { headers });
  return res.json();
}

export function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "12px" }}>
      <Loader2 size={28} color="#6b82f0" style={{ animation: "db-spin 0.8s linear infinite" }} />
    </div>
  );
}

export function ErrorState({ msg, onRetry }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "12px" }}>
      <AlertCircle size={32} color="#ef4444" />
      <p style={{ margin: 0, fontSize: "14px", color: "#ef4444" }}>{msg}</p>
      <button onClick={onRetry} style={{ background: "#6b82f0", color: "white", border: "none", borderRadius: "10px", padding: "9px 18px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
        Try Again
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function OverviewPanel({ isDarkMode }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const c = dashboardColors(isDarkMode);

  const fetch = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const res = await apiFetch("/api/v1/sub-admin-scope/overview");
      if (res.success) setData(res.data);
      else setError(res.message || "Failed to load");
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorState msg={error} onRetry={fetch} />;

  const statusConfig = {
    pending:   { color: "#f59e0b", label: "Pending"   },
    accepted:  { color: "#3b82f6", label: "Accepted"  },
    completed: { color: "#10b981", label: "Completed" },
    rejected:  { color: "#ef4444", label: "Rejected"  },
    cancelled: { color: "#6b7280", label: "Cancelled" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Your Overview</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>
            {data.assignmentType === "region"
              ? `Showing data for ${data.region} region teachers`
              : "Showing data for your assigned teachers"}
          </p>
        </div>
        <button onClick={fetch} style={{ background: isDarkMode ? "#1e2235" : "#eef1ff", border: `1px solid ${isDarkMode ? "#252840" : "#dde3f8"}`, borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: isDarkMode ? "#6b82f0" : "#4f63d2", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
        {[
          { icon: Video,    label: "Total Teachers",  value: data.totalTeachers,  sub: `${data.activeTeachers} active`,    accent: "#3b82f6", bg: isDarkMode ? "rgba(59,130,246,0.1)" : "#eff6ff" },
          { icon: Users,    label: "Students",         value: data.totalStudents,  sub: "across your teachers",              accent: "#10b981", bg: isDarkMode ? "rgba(16,185,129,0.1)" : "#f0fdf4" },
          { icon: BookOpen, label: "Total Bookings",   value: data.totalBookings,  sub: `${data.bookingsByStatus?.completed || 0} completed`, accent: "#8b5cf6", bg: isDarkMode ? "rgba(139,92,246,0.1)" : "#f5f3ff" },
          { icon: CheckCircle, label: "Completed",     value: data.bookingsByStatus?.completed || 0, sub: "lessons done", accent: "#10b981", bg: isDarkMode ? "rgba(16,185,129,0.1)" : "#f0fdf4" },
        ].map(({ icon: Icon, label, value, sub, accent, bg }) => (
          <div key={label} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px", padding: "18px", display: "flex", gap: "12px", boxShadow: isDarkMode ? "none" : "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={18} color={accent} />
            </div>
            <div>
              <p style={{ margin: "0 0 3px", fontSize: "11px", fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
              <p style={{ margin: "0 0 2px", fontSize: "24px", fontWeight: "800", color: c.heading, lineHeight: 1 }}>{value}</p>
              <p style={{ margin: 0, fontSize: "12px", color: accent, fontWeight: "600" }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px", padding: "20px" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "700", color: c.heading }}>Booking Status Breakdown</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {Object.entries(data.bookingsByStatus || {}).map(([key, val]) => {
            const cfg = statusConfig[key];
            const pct = data.totalBookings > 0 ? Math.round((val / data.totalBookings) * 100) : 0;
            return (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: cfg.color, display: "inline-block" }} />
                    <span style={{ fontSize: "13px", fontWeight: "600", color: c.text, textTransform: "capitalize" }}>{cfg.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px", background: isDarkMode ? `${cfg.color}20` : `${cfg.color}18`, color: cfg.color }}>{val}</span>
                    <span style={{ fontSize: "11px", color: c.muted, minWidth: "30px", textAlign: "right" }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ height: "4px", background: isDarkMode ? "#1e2235" : "#f0f2fc", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: cfg.color, borderRadius: "4px", transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px", padding: "20px" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "700", color: c.heading }}>Recent Bookings</h2>
        {data.recentBookings?.length === 0 ? (
          <p style={{ textAlign: "center", padding: "24px 0", fontSize: "13px", color: c.muted, margin: 0 }}>No bookings yet</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.recentBookings?.map((b, i) => {
              const sc = statusConfig[b.status] || statusConfig.pending;
              return (
                <div key={b._id || i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "10px", background: isDarkMode ? "#0f1117" : "#f8faff", border: `1px solid ${c.border}` }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: sc.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: c.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.classTitle || "Class"}</p>
                    <p style={{ margin: 0, fontSize: "11.5px", color: c.muted }}>
                      {b.teacherId?.firstName} {b.teacherId?.lastName} → {b.studentId?.firstName} {b.studentId?.lastName}
                    </p>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "20px", background: isDarkMode ? `${sc.color}20` : `${sc.color}15`, color: sc.color, flexShrink: 0 }}>
                    {sc.label}
                  </span>
                  <span style={{ fontSize: "11px", color: c.muted, flexShrink: 0 }}>
                    {b.scheduledTime ? new Date(b.scheduledTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEACHERS PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function TeachersPanel({ isDarkMode }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const c = dashboardColors(isDarkMode);

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await apiFetch("/api/v1/sub-admin-scope/teachers");
      if (res.success) setTeachers(res.teachers);
      else setError(res.message);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = teachers.filter((t) =>
    `${t.firstName} ${t.lastName} ${t.email} ${t.continent}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;
  if (error)   return <ErrorState msg={error} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Your Teachers</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>{teachers.length} teacher{teachers.length !== 1 ? "s" : ""} in your scope</p>
        </div>
      </div>

      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search teachers…"
        style={{ width: "100%", padding: "11px 14px", background: isDarkMode ? "#0f1117" : "#f8faff", border: `1.5px solid ${c.border}`, borderRadius: "12px", fontSize: "13.5px", color: c.heading, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
      />

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <Video size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>{search ? "No teachers match your search" : "No teachers assigned yet"}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "14px" }}>
          {filtered.map((t) => {
            const classesDone = t.lessonsCompleted ?? t.bookingStats?.completed ?? 0;
            const earned      = Number(t.earned || 0).toFixed(2);
            const rate        = t.ratePerClass ? `$${t.ratePerClass}` : "—";
            return (
              <div key={t._id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "46px", height: "46px", borderRadius: "14px", background: "linear-gradient(135deg, #3b82f6, #6b82f0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800", color: "white", flexShrink: 0 }}>
                    {(t.firstName?.[0] || "")}{(t.lastName?.[0] || "")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading }}>{t.firstName} {t.lastName}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.email}</p>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "20px", flexShrink: 0, background: t.active ? (isDarkMode ? "rgba(16,185,129,0.12)" : "#d1fae5") : (isDarkMode ? "rgba(107,114,128,0.12)" : "#f3f4f6"), color: t.active ? "#10b981" : "#6b7280" }}>
                    {t.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {[
                    { label: "Classes Done", value: classesDone, color: "#6b82f0" },
                    { label: "Rate / Class", value: rate,        color: "#10b981" },
                    { label: "Pending Pay",  value: `$${earned}`, color: "#f59e0b" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: isDarkMode ? "#0f1117" : "#f8faff", borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "800", color }}>{value}</p>
                      <p style={{ margin: "3px 0 0", fontSize: "10px", fontWeight: "600", color: c.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                    </div>
                  ))}
                </div>
                {t.continent && (
                  <p style={{ margin: 0, fontSize: "12px", color: c.muted, fontWeight: "600", textTransform: "capitalize" }}>
                    🌍 {t.continent}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENTS PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function StudentsPanel({ isDarkMode }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const c = dashboardColors(isDarkMode);

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await apiFetch("/api/v1/sub-admin-scope/students");
      if (res.success) setStudents(res.students);
      else setError(res.message);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = students.filter((s) =>
    `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;
  if (error)   return <ErrorState msg={error} onRetry={load} />;

  const statusConfig = {
    pending:   { color: "#f59e0b", label: "Pending"   },
    accepted:  { color: "#3b82f6", label: "Accepted"  },
    completed: { color: "#10b981", label: "Completed" },
    rejected:  { color: "#ef4444", label: "Rejected"  },
    cancelled: { color: "#6b7280", label: "Cancelled" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Students</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>Students from your teachers' bookings</p>
        </div>
      </div>

      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search students…"
        style={{ width: "100%", padding: "11px 14px", background: isDarkMode ? "#0f1117" : "#f8faff", border: `1.5px solid ${c.border}`, borderRadius: "12px", fontSize: "13.5px", color: c.heading, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
      />

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <Users size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>{search ? "No students match your search" : "No students yet"}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "14px" }}>
          {filtered.map((s) => {
            const sc = statusConfig[s.latestBookingStatus] || statusConfig.pending;
            let ageDisplay = "—";
            if (s.age) {
              ageDisplay = `${s.age} yrs`;
            } else if (s.dateOfBirth) {
              const yrs = Math.floor((Date.now() - new Date(s.dateOfBirth)) / (365.25 * 24 * 3600 * 1000));
              ageDisplay = `${yrs} yrs`;
            }
            const dobDisplay = s.dateOfBirth
              ? new Date(s.dateOfBirth).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
              : null;
            const level = s.rank || "—";
            return (
              <div key={s._id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "46px", height: "46px", borderRadius: "14px", background: "linear-gradient(135deg, #10b981, #34d399)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800", color: "white", flexShrink: 0 }}>
                    {(s.firstName?.[0] || "")}{(s.lastName?.[0] || "")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading }}>{s.firstName} {s.lastName}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.email}</p>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "20px", flexShrink: 0, background: s.active ? (isDarkMode ? "rgba(16,185,129,0.12)" : "#d1fae5") : (isDarkMode ? "rgba(107,114,128,0.12)" : "#f3f4f6"), color: s.active ? "#10b981" : "#6b7280" }}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {[
                    { label: "Classes Left", value: s.classCredits ?? 0, color: "#6b82f0" },
                    { label: "Age",          value: ageDisplay,          color: "#3b82f6" },
                    { label: "Level",        value: level,               color: "#10b981" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: isDarkMode ? "#0f1117" : "#f8faff", borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "800", color }}>{value}</p>
                      <p style={{ margin: "3px 0 0", fontSize: "10px", fontWeight: "600", color: c.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  {dobDisplay && (
                    <span style={{ fontSize: "12px", color: c.muted, fontWeight: "600" }}>🎂 {dobDisplay}</span>
                  )}
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "20px", background: isDarkMode ? `${sc.color}20` : `${sc.color}15`, color: sc.color }}>
                    {sc.label}
                  </span>
                  {s.assignedTeacher && (
                    <span style={{ fontSize: "12px", color: c.muted, fontWeight: "600" }}>
                      👨‍🏫 {s.assignedTeacher.firstName} {s.assignedTeacher.lastName}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REMOTE VIDEO — outside AgoraSpectatorModal so React never unmounts it
// ─────────────────────────────────────────────────────────────────────────────
export function RemoteVideo({ uid, videoTrack }) {
  const divRef = useRef(null);
  useEffect(() => {
    if (divRef.current && videoTrack) videoTrack.play(divRef.current);
    return () => { try { videoTrack?.stop(); } catch (_) {} };
  }, [videoTrack]);
  return (
    <div style={{ flex: 1, minWidth: "280px", background: "#000", borderRadius: "10px", overflow: "hidden", position: "relative", minHeight: "220px" }}>
      <div ref={divRef} style={{ width: "100%", height: "100%" }} />
      <span style={{ position: "absolute", bottom: "8px", left: "10px", fontSize: "11px", fontWeight: "600", color: "white", background: "rgba(0,0,0,0.55)", padding: "2px 8px", borderRadius: "6px" }}>
        Participant {uid}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AGORA SPECTATOR MODAL
// ─────────────────────────────────────────────────────────────────────────────
const SPECTATE_LIMIT = 300; // 5 minutes

export function AgoraSpectatorModal({ booking, isDarkMode, onClose }) {
  const [phase,       setPhase]       = useState("connecting");
  const [errorMsg,    setErrorMsg]    = useState("");
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(SPECTATE_LIMIT);
  const clientRef = useRef(null);
  const c = dashboardColors(isDarkMode);

  // 5-minute session limit — starts from mount
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { onClose(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [onClose]);

  const timerMm   = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const timerSs   = String(secondsLeft % 60).padStart(2, "0");
  const timerWarn = secondsLeft <= 60;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
        AgoraRTC.setLogLevel(import.meta.env.DEV ? 0 : 3);
        if (!mounted) return;
        const { data } = await api.get(`/agora/token?channel=class-${booking._id}`);
        if (!data.success || !data.appId) throw new Error(data.message || "Could not get Agora token");
        if (!mounted) return;
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = client;
        client.on("user-published", async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "audio") user.audioTrack?.play();
          if (mediaType === "video") {
            setRemoteUsers((prev) => {
              const exists = prev.find((u) => u.uid === user.uid);
              const entry  = { uid: user.uid, videoTrack: user.videoTrack };
              return exists ? prev.map((u) => u.uid === user.uid ? entry : u) : [...prev, entry];
            });
          }
        });
        client.on("user-unpublished", (user, mediaType) => {
          if (mediaType === "audio") user.audioTrack?.stop();
          if (mediaType === "video") setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
        });
        client.on("user-left", (user) => setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid)));
        await client.join(data.appId, data.channel, data.token, null);
        if (!mounted) return;
        setPhase("connected");
      } catch (e) {
        if (mounted) { setPhase("error"); setErrorMsg(e.message); }
      }
    })();
    return () => { mounted = false; clientRef.current?.leave().catch(() => {}); };
  }, [booking._id]);

  const overlay = { position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" };
  const modal   = { width: "100%", maxWidth: "820px", background: isDarkMode ? "#13161f" : "#ffffff", borderRadius: "20px", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", maxHeight: "90vh" };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${isDarkMode ? "#1e2235" : "#e8ecf4"}` }}>
          <div>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: isDarkMode ? "#e2e8f0" : "#1e293b" }}>{booking.classTitle || "Class"} — Spectator View</p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: isDarkMode ? "#6b7280" : "#94a3b8" }}>Agora channel · class-{booking._id}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              fontFamily: "monospace", fontSize: "13px", fontWeight: "800",
              padding: "4px 10px", borderRadius: "8px",
              background: timerWarn ? "rgba(239,68,68,0.18)" : (isDarkMode ? "#1e2235" : "#f0f4ff"),
              color: timerWarn ? "#f87171" : (isDarkMode ? "#94a3b8" : "#6366f1"),
              border: `1px solid ${timerWarn ? "rgba(239,68,68,0.35)" : (isDarkMode ? "#2d3148" : "#e0e7ff")}`,
              animation: timerWarn ? "db-pulse 1s ease-in-out infinite" : "none",
            }}>
              ⏱ {timerMm}:{timerSs}
            </span>
            <button onClick={onClose} style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", cursor: "pointer", background: isDarkMode ? "#1e2235" : "#f0f4ff", color: isDarkMode ? "#6b7280" : "#94a3b8", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </div>
        {timerWarn && (
          <div style={{ background: "rgba(239,68,68,0.12)", borderBottom: `1px solid rgba(239,68,68,0.25)`, padding: "6px 20px", textAlign: "center", fontSize: "12px", fontWeight: "700", color: "#f87171" }}>
            Session ending in {secondsLeft}s — spectating limit is 5 minutes
          </div>
        )}
        <div style={{ flex: 1, padding: "20px", overflowY: "auto", minHeight: "300px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: phase === "connected" && remoteUsers.length > 0 ? "flex-start" : "center", gap: "16px" }}>
          {phase === "connecting" && (<><Loader2 size={36} color="#6366f1" style={{ animation: "db-spin 0.8s linear infinite" }} /><p style={{ margin: 0, color: isDarkMode ? "#6b7280" : "#94a3b8", fontSize: "14px" }}>Joining class as spectator…</p></>)}
          {phase === "error" && (<><XCircle size={36} color="#ef4444" /><p style={{ margin: 0, color: "#ef4444", fontSize: "14px", fontWeight: "600" }}>Failed to connect</p><p style={{ margin: 0, color: isDarkMode ? "#6b7280" : "#94a3b8", fontSize: "12px" }}>{errorMsg}</p></>)}
          {phase === "connected" && remoteUsers.length === 0 && (<><AlertCircle size={36} color={isDarkMode ? "#374151" : "#d1d5db"} /><p style={{ margin: 0, color: isDarkMode ? "#6b7280" : "#94a3b8", fontSize: "14px" }}>Connected — waiting for teacher or student to share video</p></>)}
          {remoteUsers.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", width: "100%" }}>
              {remoteUsers.map((u) => <RemoteVideo key={u.uid} uid={u.uid} videoTrack={u.videoTrack} />)}
            </div>
          )}
        </div>
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${isDarkMode ? "#1e2235" : "#e8ecf4"}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: "10px", border: "none", cursor: "pointer", background: "#ef4444", color: "white", fontSize: "13px", fontWeight: "700", fontFamily: "inherit" }}>Leave</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE CLASSES PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function LiveClassesPanel({ isDarkMode }) {
  const navigate = useNavigate();
  const [bookings,   setBookings]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [now,        setNow]        = useState(Date.now());
  const [spectating, setSpectating] = useState(null);
  const c = dashboardColors(isDarkMode);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await apiFetch("/api/v1/sub-admin-scope/bookings?status=accepted");
      if (res.success) setBookings(res.bookings);
      else setError(res.message);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const classify = (b) => {
    const start = new Date(b.scheduledTime).getTime();
    const end   = start + (b.duration || 60) * 60 * 1000;
    if (now >= start && now < end) return "live";
    if (now < start)               return "upcoming";
    return "ended";
  };

  const live     = bookings.filter((b) => classify(b) === "live");
  const upcoming = bookings.filter((b) => classify(b) === "upcoming").sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
  const ended    = bookings.filter((b) => classify(b) === "ended").sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));

  const timeLabel = (b) => {
    const diff = new Date(b.scheduledTime).getTime() - now;
    if (diff > 0) {
      const mins = Math.round(diff / 60000);
      if (mins < 60) return `in ${mins}m`;
      const h = Math.floor(mins / 60), m = mins % 60;
      return `in ${h}h${m > 0 ? ` ${m}m` : ""}`;
    }
    return new Date(b.scheduledTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const handleJoinMeet      = (b) => { const link = b.teacherId?.googleMeetLink; if (link) window.open(link, "_blank", "noopener,noreferrer"); };
  const handleWatchAgora    = (b) => setSpectating(b);
  const handleJoinClassroom = (b) => {
    navigate("/classroom", {
      state: {
        classData: { id: b._id, bookingId: b._id, title: b.classTitle || "Class", topic: b.topic || "", duration: b.duration || 60, scheduledTime: b.scheduledTime, teacherGoogleMeetLink: b.teacherId?.googleMeetLink || "" },
        userRole: "spectator",
      },
    });
  };

  if (loading) return <Spinner />;
  if (error)   return <ErrorState msg={error} onRetry={load} />;

  const ClassCard = ({ b, phase }) => {
    const meetLink = b.teacherId?.googleMeetLink;
    const isLive   = phase === "live";
    return (
      <div style={{ background: c.card, border: `1px solid ${isLive ? "rgba(239,68,68,0.35)" : c.border}`, borderRadius: "16px", padding: "16px 18px", boxShadow: isLive ? "0 0 0 2px rgba(239,68,68,0.08)" : "none" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
          <div style={{ paddingTop: "2px", flexShrink: 0 }}>
            {isLive ? (
              <div style={{ position: "relative", width: "10px", height: "10px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(239,68,68,0.4)", animation: "db-ping 1.4s ease-in-out infinite" }} />
              </div>
            ) : (
              <Clock size={11} color={c.muted} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.classTitle || "Class"}</p>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: c.muted }}>👨‍🏫 {b.teacherId?.firstName} {b.teacherId?.lastName} → 👩‍🎓 {b.studentId?.firstName} {b.studentId?.lastName}</p>
            <p style={{ margin: "3px 0 0", fontSize: "11px", color: c.muted }}>
              {b.scheduledTime ? new Date(b.scheduledTime).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
              {" · "}{b.duration || 60} min
            </p>
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            {isLive
              ? <span style={{ fontSize: "10px", fontWeight: "800", padding: "3px 8px", borderRadius: "6px", background: "#ef4444", color: "white", letterSpacing: "0.05em" }}>LIVE</span>
              : <span style={{ fontSize: "11px", fontWeight: "600", color: c.muted }}>{timeLabel(b)}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {meetLink && (
            <button onClick={() => handleJoinMeet(b)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 13px", borderRadius: "9px", border: "none", cursor: "pointer", background: isDarkMode ? "rgba(59,130,246,0.15)" : "#dbeafe", color: "#3b82f6", fontSize: "12px", fontWeight: "700", fontFamily: "inherit" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.9L15 14"/><rect x="3" y="8" width="12" height="8" rx="2"/></svg>
              Join Google Meet
            </button>
          )}
          <button onClick={() => handleWatchAgora(b)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 13px", borderRadius: "9px", border: "none", cursor: "pointer", background: isDarkMode ? "rgba(99,102,241,0.15)" : "#e0e7ff", color: "#6366f1", fontSize: "12px", fontWeight: "700", fontFamily: "inherit" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Watch on Agora
          </button>
          {isLive && (
            <button onClick={() => handleJoinClassroom(b)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 13px", borderRadius: "9px", border: "none", cursor: "pointer", background: "linear-gradient(135deg,#4f63d2,#6b82f0)", color: "white", fontSize: "12px", fontWeight: "700", fontFamily: "inherit", boxShadow: "0 3px 10px rgba(79,99,210,0.3)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Join Classroom
            </button>
          )}
        </div>
      </div>
    );
  };

  const Section = ({ title, items, phase, emptyText }) => (
    <div>
      <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {title} <span style={{ fontWeight: "400", textTransform: "none" }}>({items.length})</span>
      </p>
      {items.length === 0
        ? <div style={{ padding: "18px", textAlign: "center", background: c.card, borderRadius: "12px", border: `1px solid ${c.border}` }}><p style={{ margin: 0, fontSize: "13px", color: c.muted }}>{emptyText}</p></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{items.map((b) => <ClassCard key={b._id} b={b} phase={phase} />)}</div>}
    </div>
  );

  return (
    <>
      {spectating && <AgoraSpectatorModal booking={spectating} isDarkMode={isDarkMode} onClose={() => setSpectating(null)} />}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Live Classes</h1>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>
              {live.length > 0 ? `${live.length} class${live.length > 1 ? "es" : ""} happening now` : "No classes live right now"}
            </p>
          </div>
          <button onClick={load} style={{ background: isDarkMode ? "#1e2235" : "#eef1ff", border: `1px solid ${isDarkMode ? "#252840" : "#dde3f8"}`, borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: isDarkMode ? "#6b82f0" : "#4f63d2", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        <Section title="🔴 Live Now"  items={live}     phase="live"     emptyText="No classes live at the moment" />
        <Section title="⏰ Upcoming"  items={upcoming}  phase="upcoming"  emptyText="No upcoming classes scheduled" />
        <Section title="⌛ Ended"     items={ended}     phase="ended"     emptyText="No recently ended classes" />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER CLASSES VIEW (drill-down from ClassesPanel)
// ─────────────────────────────────────────────────────────────────────────────
export function TeacherClassesView({ teacher, isDarkMode, canMark, onBack }) {
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [busy,     setBusy]     = useState({});
  const [toast,    setToast]    = useState({ msg: "", ok: true });
  const c = dashboardColors(isDarkMode);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: "", ok: true }), 3500);
  };

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await apiFetch(`/api/v1/sub-admin-scope/classes?teacherId=${teacher._id}`);
      if (res.success) setBookings(res.bookings);
      else setError(res.message);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, [teacher._id]);

  useEffect(() => { load(); }, [load]);

  const apiAction = async (endpoint, bookingId, successMsg) => {
    setBusy((p) => ({ ...p, [bookingId]: true }));
    try {
      const token = sessionStorage.getItem("subAdminToken") || localStorage.getItem("subAdminToken");
      const slug  = import.meta.env.VITE_CENTER_SLUG || getCachedCenter()?.slug;
      const actionHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      if (slug) actionHeaders["x-center-slug"] = slug;
      const res = await fetch(`/api/v1/sub-admin-scope/classes/${endpoint}`, {
        method: "POST", headers: actionHeaders, body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (data.success) { showToast(successMsg, true); load(); }
      else showToast(data.message || "Action failed", false);
    } catch { showToast("Network error", false); }
    finally { setBusy((p) => ({ ...p, [bookingId]: false })); }
  };

  const accepted  = bookings.filter((b) => b.status === "accepted");
  const completed = bookings.filter((b) => b.status === "completed");
  const statusCfg = {
    accepted:  { color: "#3b82f6", bg: isDarkMode ? "rgba(59,130,246,0.12)" : "#dbeafe",  label: "Accepted"  },
    completed: { color: "#10b981", bg: isDarkMode ? "rgba(16,185,129,0.12)" : "#d1fae5",  label: "Completed" },
  };

  const ClassRow = ({ b }) => {
    const sc   = statusCfg[b.status] || statusCfg.accepted;
    const isBusy = busy[b._id];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px" }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: sc.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.classTitle || "Class"}</p>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted }}>👩‍🎓 {b.studentId?.firstName} {b.studentId?.lastName}</p>
          <p style={{ margin: "2px 0 0", fontSize: "11px", color: c.muted }}>
            {b.scheduledTime ? new Date(b.scheduledTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : ""}
            {teacher.ratePerClass ? ` · $${teacher.ratePerClass}/class` : ""}
          </p>
        </div>
        <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "20px", background: sc.bg, color: sc.color, flexShrink: 0 }}>{sc.label}</span>
        {canMark && b.status === "accepted" && (
          <button onClick={() => apiAction("mark", b._id, "Class marked as completed ✅")} disabled={isBusy}
            style={{ padding: "7px 14px", borderRadius: "10px", border: "none", cursor: isBusy ? "not-allowed" : "pointer", background: "linear-gradient(135deg, #10b981, #34d399)", color: "white", fontSize: "12px", fontWeight: "700", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, opacity: isBusy ? 0.6 : 1 }}>
            {isBusy ? <Loader2 size={12} style={{ animation: "db-spin 0.8s linear infinite" }} /> : <CheckCircle size={12} />}
            Mark Done
          </button>
        )}
        {canMark && b.status === "completed" && (
          <button onClick={() => apiAction("unmark", b._id, "Class reverted to accepted ↩")} disabled={isBusy}
            style={{ padding: "7px 14px", borderRadius: "10px", border: `1px solid ${isDarkMode ? "rgba(245,158,11,0.3)" : "#fde68a"}`, cursor: isBusy ? "not-allowed" : "pointer", background: isDarkMode ? "rgba(245,158,11,0.15)" : "#fef3c7", color: "#f59e0b", fontSize: "12px", fontWeight: "700", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, opacity: isBusy ? 0.6 : 1 }}>
            {isBusy ? <Loader2 size={12} style={{ animation: "db-spin 0.8s linear infinite" }} /> : <RotateCcw size={12} />}
            Unmark
          </button>
        )}
      </div>
    );
  };

  const Section = ({ title, items, emptyText }) => (
    <div>
      <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {title} <span style={{ fontWeight: "400", textTransform: "none" }}>({items.length})</span>
      </p>
      {items.length === 0
        ? <div style={{ padding: "20px", textAlign: "center", background: c.card, borderRadius: "12px", border: `1px solid ${c.border}` }}><p style={{ margin: 0, fontSize: "13px", color: c.muted }}>{emptyText}</p></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{items.map((b) => <ClassRow key={b._id} b={b} />)}</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {toast.msg && (
        <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 200, background: toast.ok ? "#10b981" : "#ef4444", color: "white", padding: "12px 20px", borderRadius: "12px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {toast.msg}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: `1px solid ${c.border}`, background: c.card, color: c.muted, fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
          <ChevronLeft size={15} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "13px", background: "linear-gradient(135deg, #4f63d2, #6b82f0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800", color: "white", flexShrink: 0 }}>
            {(teacher.firstName?.[0] || "")}{(teacher.lastName?.[0] || "")}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: c.heading }}>{teacher.firstName} {teacher.lastName}</p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted }}>
              {loading ? "Loading…" : `${bookings.length} class${bookings.length !== 1 ? "es" : ""}`}
              {canMark ? " · Mark / Unmark enabled" : " · View only"}
            </p>
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={load} style={{ background: isDarkMode ? "#1e2235" : "#eef1ff", border: `1px solid ${isDarkMode ? "#252840" : "#dde3f8"}`, borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: isDarkMode ? "#6b82f0" : "#4f63d2", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>
      {loading ? <Spinner /> : error ? <ErrorState msg={error} onRetry={load} /> : (
        <>
          <Section title="Accepted Classes"  items={accepted}  emptyText="No accepted classes" />
          <Section title="Completed Classes" items={completed} emptyText="No completed classes" />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASSES PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function ClassesPanel({ isDarkMode, canMark }) {
  const [teachers,         setTeachers]         = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState("");
  const [selectedTeacher,  setSelectedTeacher]  = useState(null);
  const c = dashboardColors(isDarkMode);

  const loadTeachers = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await apiFetch("/api/v1/sub-admin-scope/teachers");
      if (res.success) setTeachers(res.teachers);
      else setError(res.message);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorState msg={error} onRetry={loadTeachers} />;

  if (selectedTeacher) {
    return <TeacherClassesView teacher={selectedTeacher} isDarkMode={isDarkMode} canMark={canMark} onBack={() => setSelectedTeacher(null)} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Classes</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>Select a teacher to view their classes</p>
        </div>
        <button onClick={loadTeachers} style={{ background: isDarkMode ? "#1e2235" : "#eef1ff", border: `1px solid ${isDarkMode ? "#252840" : "#dde3f8"}`, borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: isDarkMode ? "#6b82f0" : "#4f63d2", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      {teachers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <Video size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>No teachers in your scope</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
          {teachers.map((t) => (
            <button key={t._id} onClick={() => setSelectedTeacher(t)}
              style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "18px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: "12px", transition: "border-color 0.15s, box-shadow 0.15s", fontFamily: "inherit" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6b82f0"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(107,130,240,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "46px", height: "46px", borderRadius: "14px", background: "linear-gradient(135deg, #4f63d2, #6b82f0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "800", color: "white", flexShrink: 0 }}>
                  {(t.firstName?.[0] || "")}{(t.lastName?.[0] || "")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading }}>{t.firstName} {t.lastName}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.email}</p>
                </div>
                <ChevronRight size={16} color={c.muted} style={{ flexShrink: 0 }} />
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11.5px", padding: "4px 10px", borderRadius: "20px", background: isDarkMode ? "#1e2235" : "#f0f4ff", color: c.muted, fontWeight: "600" }}>{t.bookingStats?.completed || 0} completed</span>
                <span style={{ fontSize: "11.5px", padding: "4px 10px", borderRadius: "20px", background: t.active ? (isDarkMode ? "rgba(16,185,129,0.12)" : "#d1fae5") : (isDarkMode ? "#1e2235" : "#f3f4f6"), color: t.active ? "#10b981" : "#6b7280", fontWeight: "600" }}>{t.active ? "Active" : "Inactive"}</span>
                {t.continent && <span style={{ fontSize: "11.5px", padding: "4px 10px", borderRadius: "20px", background: isDarkMode ? "#1e2235" : "#f0f4ff", color: c.muted, fontWeight: "600", textTransform: "capitalize" }}>🌍 {t.continent}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function PaymentsPanel({ isDarkMode }) {
  const [payments, setPayments] = useState([]);
  const [summary,  setSummary]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [view,     setView]     = useState("summary");
  const c = dashboardColors(isDarkMode);

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await apiFetch("/api/v1/sub-admin-scope/payments");
      if (res.success) { setPayments(res.payments); setSummary(res.summary); }
      else setError(res.message);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorState msg={error} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Payments</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>{payments.length} payment record{payments.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={load} style={{ background: isDarkMode ? "#1e2235" : "#eef1ff", border: `1px solid ${isDarkMode ? "#252840" : "#dde3f8"}`, borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: isDarkMode ? "#6b82f0" : "#4f63d2", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {["summary", "detail"].map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ padding: "6px 16px", borderRadius: "20px", border: "none", cursor: "pointer", background: view === v ? "linear-gradient(135deg, #4f63d2, #6b82f0)" : (isDarkMode ? "#1e2235" : "#f0f4ff"), color: view === v ? "white" : c.muted, fontFamily: "inherit", fontSize: "12.5px", fontWeight: "700", textTransform: "capitalize" }}>
            {v === "summary" ? "By Teacher" : "All Records"}
          </button>
        ))}
      </div>
      {view === "summary" ? (
        summary.length === 0
          ? <div style={{ textAlign: "center", padding: "48px 0" }}><DollarSign size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} /><p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>No payment data yet</p></div>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
              {summary.map((s) => (
                <div key={s.teacher?._id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px", padding: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg, #4f63d2, #6b82f0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", color: "white", flexShrink: 0 }}>
                      {s.teacher?.firstName?.[0]}{s.teacher?.lastName?.[0]}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading }}>{s.teacher?.firstName} {s.teacher?.lastName}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: c.muted }}>{s.count} payment{s.count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[{ l: "Total", v: `$${s.totalEarned}`, c2: "#6b82f0" }, { l: "Paid", v: `$${s.totalPaid}`, c2: "#10b981" }, { l: "Pending", v: `$${s.totalPending}`, c2: "#f59e0b" }].map(({ l, v, c2 }) => (
                      <div key={l} style={{ flex: 1, background: isDarkMode ? "#0f1117" : "#f8faff", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: "11px", color: c.muted, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</p>
                        <p style={{ margin: "4px 0 0", fontSize: "18px", fontWeight: "800", color: c2 }}>{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
      ) : (
        payments.length === 0
          ? <div style={{ textAlign: "center", padding: "48px 0" }}><DollarSign size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} /><p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>No payments yet</p></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {payments.map((p) => (
                <div key={p._id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px" }}>
                  <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: p.status === "paid" ? (isDarkMode ? "rgba(16,185,129,0.12)" : "#d1fae5") : (isDarkMode ? "rgba(245,158,11,0.12)" : "#fef9c3"), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <DollarSign size={16} color={p.status === "paid" ? "#10b981" : "#f59e0b"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "13.5px", fontWeight: "700", color: c.heading }}>{p.teacherId?.firstName} {p.teacherId?.lastName}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted }}>Student: {p.studentId?.firstName} {p.studentId?.lastName} · {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ""}</p>
                  </div>
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: p.status === "paid" ? "#10b981" : "#f59e0b", flexShrink: 0 }}>${p.amount}</p>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "20px", background: p.status === "paid" ? (isDarkMode ? "rgba(16,185,129,0.12)" : "#d1fae5") : (isDarkMode ? "rgba(245,158,11,0.12)" : "#fef9c3"), color: p.status === "paid" ? "#10b981" : "#f59e0b", textTransform: "capitalize", flexShrink: 0 }}>
                    {p.status || "pending"}
                  </span>
                </div>
              ))}
            </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER RECORDINGS VIEW (drill-down from RecordingsPanel)
// ─────────────────────────────────────────────────────────────────────────────
export function TeacherRecordingsView({ teacher, isDarkMode, onBack }) {
  const [recordings, setRecordings] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [search,     setSearch]     = useState("");
  const c = dashboardColors(isDarkMode);

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await apiFetch(`/api/v1/sub-admin-scope/recordings?teacherId=${teacher._id}`);
      if (res.success) setRecordings(res.recordings);
      else setError(res.message);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, [teacher._id]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    recordings.filter((r) =>
      `${r.title || ""} ${r.studentId?.firstName || ""} ${r.studentId?.lastName || ""}`.toLowerCase().includes(search.toLowerCase())
    ), [recordings, search]);

  const totalMins = recordings.reduce((s, r) => s + (r.duration ? Math.round(r.duration / 60) : 0), 0);

  if (loading) return <Spinner />;
  if (error)   return <ErrorState msg={error} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: `1px solid ${c.border}`, background: c.card, color: c.muted, fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
          <ChevronLeft size={15} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "13px", background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800", color: "white", flexShrink: 0 }}>
            {(teacher.firstName?.[0] || "")}{(teacher.lastName?.[0] || "")}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: c.heading }}>{teacher.firstName} {teacher.lastName}</p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted }}>
              {recordings.length} recording{recordings.length !== 1 ? "s" : ""}{totalMins > 0 ? ` · ${totalMins}m total` : ""}
            </p>
          </div>
        </div>
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or student…"
        style={{ width: "100%", padding: "11px 14px", background: isDarkMode ? "#0f1117" : "#f8faff", border: `1.5px solid ${c.border}`, borderRadius: "12px", fontSize: "13.5px", color: c.heading, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
      />
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <Film size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>{search ? "No recordings match your search" : "No recordings yet"}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map((r) => (
            <div key={r._id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: isDarkMode ? "rgba(139,92,246,0.12)" : "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Film size={18} color="#8b5cf6" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title || "Class Recording"}</p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted }}>Student: {r.studentId?.firstName} {r.studentId?.lastName}</p>
              </div>
              <p style={{ margin: 0, fontSize: "11.5px", color: c.muted, flexShrink: 0 }}>
                {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
              </p>
              {r.duration && (
                <span style={{ fontSize: "11.5px", padding: "3px 9px", borderRadius: "20px", background: isDarkMode ? "#1e2235" : "#f0f4ff", color: c.muted, fontWeight: "600", flexShrink: 0 }}>
                  {Math.round(r.duration / 60)}m
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECORDINGS PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function RecordingsPanel({ isDarkMode }) {
  const [teachers,        setTeachers]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const c = dashboardColors(isDarkMode);

  const loadTeachers = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await apiFetch("/api/v1/sub-admin-scope/teachers");
      if (res.success) setTeachers(res.teachers);
      else setError(res.message);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorState msg={error} onRetry={loadTeachers} />;

  if (selectedTeacher) {
    return <TeacherRecordingsView teacher={selectedTeacher} isDarkMode={isDarkMode} onBack={() => setSelectedTeacher(null)} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Recordings</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>Select a teacher to view their recordings</p>
        </div>
        <button onClick={loadTeachers} style={{ background: isDarkMode ? "#1e2235" : "#eef1ff", border: `1px solid ${isDarkMode ? "#252840" : "#dde3f8"}`, borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: isDarkMode ? "#6b82f0" : "#4f63d2", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      {teachers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <Film size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>No teachers in your scope</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
          {teachers.map((t) => (
            <button key={t._id} onClick={() => setSelectedTeacher(t)}
              style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "18px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: "12px", transition: "border-color 0.15s, box-shadow 0.15s", fontFamily: "inherit" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#8b5cf6"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(139,92,246,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "46px", height: "46px", borderRadius: "14px", background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "800", color: "white", flexShrink: 0 }}>
                  {(t.firstName?.[0] || "")}{(t.lastName?.[0] || "")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading }}>{t.firstName} {t.lastName}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.email}</p>
                </div>
                <ChevronRight size={16} color={c.muted} style={{ flexShrink: 0 }} />
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11.5px", padding: "4px 10px", borderRadius: "20px", background: isDarkMode ? "rgba(139,92,246,0.12)" : "#ede9fe", color: "#8b5cf6", fontWeight: "600" }}>View recordings</span>
                {t.active && <span style={{ fontSize: "11.5px", padding: "4px 10px", borderRadius: "20px", background: isDarkMode ? "rgba(16,185,129,0.12)" : "#d1fae5", color: "#10b981", fontWeight: "600" }}>Active</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function ReportsPanel({ isDarkMode }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [view,    setView]    = useState("students");
  const [search,  setSearch]  = useState("");
  const c = dashboardColors(isDarkMode);

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await apiFetch("/api/v1/sub-admin-scope/reports");
      if (res.success) setData(res);
      else setError(res.message);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorState msg={error} onRetry={load} />;

  const filteredStudents = (data.studentProgress || []).filter((s) =>
    `${s.student?.firstName} ${s.student?.lastName} ${s.teacher?.firstName} ${s.teacher?.lastName}`.toLowerCase().includes(search.toLowerCase())
  );
  const filteredHistory = (data.completedBookings || []).filter((b) =>
    `${b.studentId?.firstName} ${b.studentId?.lastName} ${b.teacherId?.firstName} ${b.teacherId?.lastName} ${b.classTitle || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Progress Reports</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>{data.total} completed class{data.total !== 1 ? "es" : ""} · {data.studentProgress?.length || 0} students</p>
        </div>
        <button onClick={load} style={{ background: isDarkMode ? "#1e2235" : "#eef1ff", border: `1px solid ${isDarkMode ? "#252840" : "#dde3f8"}`, borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: isDarkMode ? "#6b82f0" : "#4f63d2", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {["students", "history"].map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ padding: "6px 16px", borderRadius: "20px", border: "none", cursor: "pointer", background: view === v ? "linear-gradient(135deg, #4f63d2, #6b82f0)" : (isDarkMode ? "#1e2235" : "#f0f4ff"), color: view === v ? "white" : c.muted, fontFamily: "inherit", fontSize: "12.5px", fontWeight: "700" }}>
            {v === "students" ? "By Student" : "Class History"}
          </button>
        ))}
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
        style={{ width: "100%", padding: "11px 14px", background: isDarkMode ? "#0f1117" : "#f8faff", border: `1.5px solid ${c.border}`, borderRadius: "12px", fontSize: "13.5px", color: c.heading, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
      />
      {view === "students" ? (
        filteredStudents.length === 0
          ? <div style={{ textAlign: "center", padding: "48px 0" }}><BarChart2 size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} /><p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>No completed classes yet</p></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredStudents.map((s, i) => {
                const pct = s.completedClasses > 0
                  ? Math.min(100, Math.round((s.completedClasses / (s.completedClasses + (s.remainingClasses || 0))) * 100))
                  : 0;
                return (
                  <div key={s.student?._id || i} style={{ padding: "16px", background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg, #10b981, #34d399)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", color: "white", flexShrink: 0 }}>
                        {s.student?.firstName?.[0]}{s.student?.lastName?.[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading }}>{s.student?.firstName} {s.student?.lastName}</p>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted }}>Teacher: {s.teacher?.firstName} {s.teacher?.lastName} · Last class: {s.lastClass ? new Date(s.lastClass).toLocaleDateString() : "N/A"}</p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#10b981" }}>{s.completedClasses}</p>
                        <p style={{ margin: "2px 0 0", fontSize: "11px", color: c.muted }}>completed</p>
                      </div>
                    </div>
                    <div style={{ height: "6px", background: isDarkMode ? "#1e2235" : "#f0f2fc", borderRadius: "6px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #10b981, #34d399)", borderRadius: "6px", transition: "width 0.6s ease" }} />
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: c.muted }}>{pct}% of purchased classes completed · {s.remainingClasses || 0} remaining</p>
                  </div>
                );
              })}
            </div>
      ) : (
        filteredHistory.length === 0
          ? <div style={{ textAlign: "center", padding: "48px 0" }}><BarChart2 size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} /><p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>No completed classes yet</p></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredHistory.map((b) => (
                <div key={b._id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px", background: c.card, border: `1px solid ${c.border}`, borderRadius: "12px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "13.5px", fontWeight: "700", color: c.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.classTitle || "Class"}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted }}>👨‍🏫 {b.teacherId?.firstName} {b.teacherId?.lastName} → 👩‍🎓 {b.studentId?.firstName} {b.studentId?.lastName}</p>
                  </div>
                  <span style={{ fontSize: "11px", color: c.muted, flexShrink: 0 }}>{b.scheduledTime ? new Date(b.scheduledTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</span>
                </div>
              ))}
            </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function ReviewsPanel({ isDarkMode }) {
  const [reviews,       setReviews]       = useState([]);
  const [teacherRatings,setTeacherRatings]= useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [view,          setView]          = useState("ratings");
  const c = dashboardColors(isDarkMode);

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await apiFetch("/api/v1/sub-admin-scope/reviews");
      if (res.success) { setReviews(res.reviews); setTeacherRatings(res.teacherRatings); }
      else setError(res.message);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorState msg={error} onRetry={load} />;

  const StarRow = ({ rating }) => (
    <div style={{ display: "flex", gap: "2px" }}>
      {[1,2,3,4,5].map((i) => <Star key={i} size={13} color={i <= rating ? "#f59e0b" : (isDarkMode ? "#1e2235" : "#e2e8f0")} fill={i <= rating ? "#f59e0b" : "none"} />)}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Reviews</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={load} style={{ background: isDarkMode ? "#1e2235" : "#eef1ff", border: `1px solid ${isDarkMode ? "#252840" : "#dde3f8"}`, borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: isDarkMode ? "#6b82f0" : "#4f63d2", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {["ratings", "all"].map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ padding: "6px 16px", borderRadius: "20px", border: "none", cursor: "pointer", background: view === v ? "linear-gradient(135deg, #4f63d2, #6b82f0)" : (isDarkMode ? "#1e2235" : "#f0f4ff"), color: view === v ? "white" : c.muted, fontFamily: "inherit", fontSize: "12.5px", fontWeight: "700" }}>
            {v === "ratings" ? "Teacher Ratings" : "All Reviews"}
          </button>
        ))}
      </div>
      {view === "ratings" ? (
        teacherRatings.length === 0
          ? <div style={{ textAlign: "center", padding: "48px 0" }}><Star size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} /><p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>No reviews yet</p></div>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
              {teacherRatings.sort((a, b) => b.average - a.average).map((t) => (
                <div key={t.teacher?._id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "13px", background: "linear-gradient(135deg, #f59e0b, #fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800", color: "white", flexShrink: 0 }}>
                      {t.teacher?.firstName?.[0]}{t.teacher?.lastName?.[0]}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading }}>{t.teacher?.firstName} {t.teacher?.lastName}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted }}>{t.count} review{t.count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <p style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: "#f59e0b" }}>{t.average}</p>
                    <StarRow rating={Math.round(parseFloat(t.average))} />
                  </div>
                </div>
              ))}
            </div>
      ) : (
        reviews.length === 0
          ? <div style={{ textAlign: "center", padding: "48px 0" }}><Star size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} /><p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>No reviews yet</p></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {reviews.map((r) => (
                <div key={r._id} style={{ padding: "16px", background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "13.5px", fontWeight: "700", color: c.heading }}>{r.studentId?.firstName} {r.studentId?.lastName} → {r.teacherId?.firstName} {r.teacherId?.lastName}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: c.muted }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</p>
                    </div>
                    <StarRow rating={r.rating || 0} />
                  </div>
                  {r.comment && (
                    <p style={{ margin: 0, fontSize: "13px", color: c.text, fontStyle: "italic", padding: "8px 12px", background: isDarkMode ? "#0f1117" : "#f8faff", borderRadius: "8px", borderLeft: "3px solid #f59e0b" }}>
                      "{r.comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES TAB (re-export for shell convenience)
// ─────────────────────────────────────────────────────────────────────────────
export { MessagesTab };
