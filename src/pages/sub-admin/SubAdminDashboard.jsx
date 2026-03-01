// src/pages/sub-admin/SubAdminDashboard.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, TrendingUp, Users, Video, BookOpen,
  MessageCircle, Calendar, LogOut, Menu,
  ChevronRight, Bell, Settings, Sun, Moon,
  CheckCircle, Clock, XCircle, AlertCircle,
  RefreshCw, Loader2, User
} from "lucide-react";
import { useDarkMode } from "../../hooks/useDarkMode";
import MessagesTab from "../../components/chat/MessagesTab";

// ── Navigation items for sub-admin (limited set) ─────────────────────────────
const NAV = [
  { key: "overview",  label: "Overview",  icon: TrendingUp  },
  { key: "teachers",  label: "Teachers",  icon: Video       },
  { key: "students",  label: "Students",  icon: Users       },
  { key: "bookings",  label: "Bookings",  icon: Calendar    },
  { key: "messages",  label: "Messages",  icon: MessageCircle },
];

export default function SubAdminDashboard() {
  const navigate   = useNavigate();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const [activeTab,    setActiveTab]    = useState("overview");
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [subAdminInfo, setSubAdminInfo] = useState({});
  const [mounted,      setMounted]      = useState(false);

  useEffect(() => {
    setMounted(true);
    const info = localStorage.getItem("subAdminInfo");
    if (info) setSubAdminInfo(JSON.parse(info));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("subAdminToken");
    localStorage.removeItem("subAdminInfo");
    navigate("/sub-admin/login");
  };

  const activeLabel = NAV.find((n) => n.key === activeTab)?.label || "Overview";
  const c = palette(isDarkMode);

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return <OverviewPanel isDarkMode={isDarkMode} />;
      case "teachers": return <TeachersPanel isDarkMode={isDarkMode} />;
      case "students": return <StudentsPanel isDarkMode={isDarkMode} />;
      case "bookings": return <BookingsPanel isDarkMode={isDarkMode} />;
      case "messages": return <MessagesTab userRole="sub-admin" />;
      default: return <OverviewPanel isDarkMode={isDarkMode} />;
    }
  };

  return (
    <>
      <style>{css(isDarkMode)}</style>
      <div style={{
        display: "flex", height: "100vh",
        background: c.bg,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        overflow: "hidden",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}>

        {/* ── SIDEBAR ── */}
        <aside style={{
          width: sidebarOpen ? "230px" : "60px",
          background: c.card,
          borderRight: `1px solid ${c.border}`,
          display: "flex", flexDirection: "column",
          flexShrink: 0,
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden", zIndex: 40,
        }}>

          {/* Logo */}
          <div style={{
            height: "64px", display: "flex", alignItems: "center",
            padding: sidebarOpen ? "0 18px" : "0 14px",
            borderBottom: `1px solid ${c.border}`,
            gap: "10px", flexShrink: 0,
          }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0,
              background: "linear-gradient(135deg, #4f63d2, #6b82f0)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Shield size={15} color="white" />
            </div>
            {sidebarOpen && (
              <div style={{ overflow: "hidden" }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", color: c.heading, whiteSpace: "nowrap" }}>
                  EduLearn
                </p>
                <p style={{ margin: 0, fontSize: "9px", color: c.muted, fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  Sub-Admin
                </p>
              </div>
            )}
          </div>

          {/* Nav items */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "10px 6px" }} className="sa-scroll">
            {NAV.map(({ key, label, icon: Icon }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  title={!sidebarOpen ? label : undefined}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    gap: "10px", padding: sidebarOpen ? "9px 10px" : "9px 14px",
                    borderRadius: "10px", border: "none", cursor: "pointer",
                    background: active ? (isDarkMode ? "#252d4a" : "#eef1ff") : "transparent",
                    color: active ? (isDarkMode ? "#a5b4fc" : "#4f63d2") : (isDarkMode ? "#4b5563" : "#64748b"),
                    fontFamily: "inherit", fontSize: "13.5px",
                    fontWeight: active ? "700" : "500",
                    textAlign: "left", marginBottom: "2px",
                    whiteSpace: "nowrap", overflow: "hidden",
                    position: "relative", transition: "all 0.15s",
                  }}
                  className="sa-nav-btn"
                >
                  {active && (
                    <div style={{
                      position: "absolute", left: 0, top: "20%", bottom: "20%",
                      width: "3px", borderRadius: "0 3px 3px 0",
                      background: "#6b82f0",
                    }} />
                  )}
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  {sidebarOpen && <span>{label}</span>}
                </button>
              );
            })}
          </div>

          {/* Bottom: dark mode + logout */}
          <div style={{ borderTop: `1px solid ${c.border}`, padding: "10px 6px", flexShrink: 0 }}>
            <button
              onClick={toggleDarkMode}
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "10px",
                padding: sidebarOpen ? "9px 10px" : "9px 14px",
                borderRadius: "10px", border: "none", cursor: "pointer",
                background: "transparent",
                color: isDarkMode ? "#4b5563" : "#64748b",
                fontFamily: "inherit", fontSize: "13.5px", fontWeight: "500",
                textAlign: "left", marginBottom: "4px", whiteSpace: "nowrap",
              }}
              className="sa-nav-btn"
            >
              <span style={{ fontSize: "15px", flexShrink: 0 }}>{isDarkMode ? "☀️" : "🌙"}</span>
              {sidebarOpen && <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>}
            </button>
            <button
              onClick={handleLogout}
              title="Logout"
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "10px",
                padding: sidebarOpen ? "9px 10px" : "9px 14px",
                borderRadius: "10px", border: "none", cursor: "pointer",
                background: "transparent", color: "#ef4444",
                fontFamily: "inherit", fontSize: "13.5px", fontWeight: "500",
                textAlign: "left", whiteSpace: "nowrap",
              }}
              className="sa-logout-btn"
            >
              <LogOut size={16} style={{ flexShrink: 0 }} />
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

          {/* Top bar */}
          <header style={{
            height: "64px", background: c.card,
            borderBottom: `1px solid ${c.border}`,
            display: "flex", alignItems: "center",
            padding: "0 24px", gap: "16px", flexShrink: 0,
          }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: "none", border: "none", cursor: "pointer", color: c.muted, padding: "6px", borderRadius: "8px", display: "flex", alignItems: "center" }}
              className="sa-nav-btn"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12.5px", color: c.muted, fontWeight: "500" }}>Sub-Admin</span>
              <ChevronRight size={13} color={c.muted} />
              <span style={{ fontSize: "13px", color: c.heading, fontWeight: "700" }}>{activeLabel}</span>
            </div>

            <div style={{ flex: 1 }} />

            {/* Scope badge */}
            {subAdminInfo.assignmentType && (
              <div style={{
                background: isDarkMode ? "#1e2235" : "#eef1ff",
                border: `1px solid ${isDarkMode ? "#252840" : "#dde3f8"}`,
                borderRadius: "20px", padding: "4px 12px",
                fontSize: "11.5px", fontWeight: "700",
                color: isDarkMode ? "#6b82f0" : "#4f63d2",
              }}>
                {subAdminInfo.assignmentType === "region"
                  ? `🌍 ${subAdminInfo.region?.charAt(0).toUpperCase() + subAdminInfo.region?.slice(1)} Region`
                  : `👥 ${subAdminInfo.teacherScope?.length || 0} Teachers Assigned`}
              </div>
            )}

            {/* Avatar */}
            <div style={{
              width: "34px", height: "34px", borderRadius: "10px",
              background: "linear-gradient(135deg, #4f63d2, #6b82f0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", fontWeight: "800", color: "white",
            }}>
              {(subAdminInfo?.firstName?.[0] || "S").toUpperCase()}
            </div>
          </header>

          {/* Content */}
          <main style={{ flex: 1, overflowY: "auto", padding: activeTab === "messages" ? "0" : "24px", background: c.bg }} className="sa-scroll">
            <div style={{
              background: c.card,
              borderRadius: "16px",
              border: `1px solid ${c.border}`,
              minHeight: "calc(100vh - 112px)",
              padding: activeTab === "messages" ? "0" : "24px",
              overflow: activeTab === "messages" ? "hidden" : "visible",
            }}>
              {renderTab()}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW PANEL
// ─────────────────────────────────────────────────────────────────────────────
function OverviewPanel({ isDarkMode }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const c = palette(isDarkMode);

  const fetch = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const res = await apiFetch("/api/sub-admin-scope/overview");
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

      {/* Header */}
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

      {/* Stat cards */}
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

      {/* Booking status breakdown */}
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

      {/* Recent bookings */}
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
                      {b.teacherId?.firstName} {b.teacherId?.lastName} → {b.studentId?.firstName} {b.studentId?.surname}
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
// TEACHERS PANEL (read-only)
// ─────────────────────────────────────────────────────────────────────────────
function TeachersPanel({ isDarkMode }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const c = palette(isDarkMode);

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await apiFetch("/api/sub-admin-scope/teachers");
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

      {/* Search */}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {filtered.map((t) => (
            <div key={t._id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "13px", background: "linear-gradient(135deg, #3b82f6, #6b82f0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800", color: "white", flexShrink: 0 }}>
                  {t.firstName[0]}{t.lastName[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading }}>{t.firstName} {t.lastName}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.email}</p>
                </div>
                <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "20px", background: t.active ? (isDarkMode ? "rgba(16,185,129,0.12)" : "#d1fae5") : (isDarkMode ? "rgba(107,114,128,0.12)" : "#f3f4f6"), color: t.active ? "#10b981" : "#6b7280" }}>
                  {t.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {t.continent && (
                  <span style={{ fontSize: "11.5px", padding: "4px 10px", borderRadius: "20px", background: isDarkMode ? "#1e2235" : "#f0f4ff", color: c.muted, fontWeight: "600", textTransform: "capitalize" }}>
                    🌍 {t.continent}
                  </span>
                )}
                <span style={{ fontSize: "11.5px", padding: "4px 10px", borderRadius: "20px", background: isDarkMode ? "#1e2235" : "#f0f4ff", color: c.muted, fontWeight: "600" }}>
                  {t.bookingStats?.completed || 0} classes done
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENTS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function StudentsPanel({ isDarkMode }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const c = palette(isDarkMode);

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await apiFetch("/api/sub-admin-scope/students");
      if (res.success) setStudents(res.students);
      else setError(res.message);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = students.filter((s) =>
    `${s.firstName} ${s.surname} ${s.email}`.toLowerCase().includes(search.toLowerCase())
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
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map((s) => {
            const sc = statusConfig[s.latestBookingStatus] || statusConfig.pending;
            return (
              <div key={s._id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg, #10b981, #34d399)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", color: "white", flexShrink: 0 }}>
                  {s.firstName[0]}{s.surname[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading }}>{s.firstName} {s.surname}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted }}>{s.email} · Teacher: {s.assignedTeacher?.firstName} {s.assignedTeacher?.lastName}</p>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "11.5px", padding: "3px 9px", borderRadius: "20px", background: isDarkMode ? "#1e2235" : "#f0f4ff", color: c.muted, fontWeight: "600" }}>
                    {s.noOfClasses || 0} classes left
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "20px", background: isDarkMode ? `${sc.color}20` : `${sc.color}15`, color: sc.color }}>
                    {sc.label}
                  </span>
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
// BOOKINGS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function BookingsPanel({ isDarkMode }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [filter, setFilter]     = useState("all");
  const c = palette(isDarkMode);

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const url = filter === "all" ? "/api/sub-admin-scope/bookings" : `/api/sub-admin-scope/bookings?status=${filter}`;
      const res = await apiFetch(url);
      if (res.success) setBookings(res.bookings);
      else setError(res.message);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const statusConfig = {
    pending:   { color: "#f59e0b", bg: isDarkMode ? "rgba(245,158,11,0.12)" : "#fef9c3",  label: "Pending"   },
    accepted:  { color: "#3b82f6", bg: isDarkMode ? "rgba(59,130,246,0.12)" : "#dbeafe",  label: "Accepted"  },
    completed: { color: "#10b981", bg: isDarkMode ? "rgba(16,185,129,0.12)" : "#d1fae5",  label: "Completed" },
    rejected:  { color: "#ef4444", bg: isDarkMode ? "rgba(239,68,68,0.12)" : "#fee2e2",   label: "Rejected"  },
    cancelled: { color: "#6b7280", bg: isDarkMode ? "rgba(107,114,128,0.12)" : "#f3f4f6", label: "Cancelled" },
  };

  if (loading) return <Spinner />;
  if (error)   return <ErrorState msg={error} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading }}>Bookings</h1>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.muted }}>{bookings.length} booking{bookings.length !== 1 ? "s" : ""} found</p>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {["all", "pending", "accepted", "completed", "rejected", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
              background: filter === s ? "linear-gradient(135deg, #4f63d2, #6b82f0)" : (isDarkMode ? "#1e2235" : "#f0f4ff"),
              color: filter === s ? "white" : c.muted,
              fontFamily: "inherit", fontSize: "12.5px", fontWeight: "700",
              textTransform: "capitalize",
            }}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <Calendar size={36} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>No {filter === "all" ? "" : filter} bookings</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {bookings.map((b) => {
            const sc = statusConfig[b.status] || statusConfig.pending;
            return (
              <div key={b._id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", background: c.card, border: `1px solid ${c.border}`, borderRadius: "14px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: sc.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: c.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.classTitle || "Class"}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted }}>
                    👨‍🏫 {b.teacherId?.firstName} {b.teacherId?.lastName} &nbsp;→&nbsp; 👩‍🎓 {b.studentId?.firstName} {b.studentId?.surname}
                  </p>
                </div>
                <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "20px", background: sc.bg, color: sc.color, textTransform: "capitalize", flexShrink: 0 }}>
                  {sc.label}
                </span>
                <span style={{ fontSize: "11px", color: c.muted, flexShrink: 0 }}>
                  {b.scheduledTime ? new Date(b.scheduledTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function apiFetch(url) {
  const token = localStorage.getItem("subAdminToken");
  const res   = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "12px" }}>
      <Loader2 size={28} color="#6b82f0" style={{ animation: "sa-spin 0.8s linear infinite" }} />
    </div>
  );
}

function ErrorState({ msg, onRetry }) {
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

function palette(dark) {
  return {
    bg:      dark ? "#0f1117" : "#f4f6fb",
    card:    dark ? "#1a1d27" : "#ffffff",
    border:  dark ? "#1e2235" : "#e8ecf4",
    heading: dark ? "#e2e8f0" : "#1e293b",
    text:    dark ? "#94a3b8" : "#475569",
    muted:   dark ? "#374151" : "#94a3b8",
  };
}

const css = (dark) => `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  .sa-scroll::-webkit-scrollbar { width: 4px; }
  .sa-scroll::-webkit-scrollbar-thumb { background: ${dark ? "#1e2235" : "#e0e4f4"}; border-radius: 4px; }
  .sa-nav-btn:hover { background: ${dark ? "#1e2235 !important" : "#f0f4ff !important"}; color: ${dark ? "#a5b4fc !important" : "#4f63d2 !important"}; }
  .sa-logout-btn:hover { background: rgba(239,68,68,0.08) !important; }
  @keyframes sa-spin { to { transform: rotate(360deg); } }
`;
