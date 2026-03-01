// src/pages/admin/tabs/OverviewTab.jsx
import React, { useState, useEffect } from "react";
import {
  Users, Video, Calendar, DollarSign, TrendingUp,
  CheckCircle, Clock, XCircle, AlertCircle, RefreshCw,
  BookOpen, Activity, ArrowUpRight, Loader2
} from "lucide-react";
import api from "../../../api";

export default function OverviewTab({ isDarkMode }) {
  const [overview, setOverview] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const c = palette(isDarkMode);

  const fetchData = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);

      const [overviewRes, bookingsRes] = await Promise.all([
        api.get("/api/analytics/overview"),
        api.get("/api/bookings?limit=6&sort=desc"),
      ]);

      setOverview(overviewRes.data.data);

      // Handle different response shapes for bookings
      const bookings = bookingsRes.data?.bookings
        || bookingsRes.data?.data
        || (Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
      setRecentBookings(bookings.slice(0, 6));

    } catch (err) {
      console.error("Overview fetch error:", err);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── helpers ──────────────────────────────────────────────────────────────
  const fmt = (n) => (n === undefined || n === null ? "—" : Number(n).toLocaleString());
  const fmtMoney = (n) => (n === undefined || n === null ? "—" : `$${Number(n).toFixed(2)}`);
  const timeAgo = (date) => {
    if (!date) return "";
    const diff = Date.now() - new Date(date);
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const statusConfig = {
    pending:   { color: "#f59e0b", bg: isDarkMode ? "rgba(245,158,11,0.12)" : "#fef9c3", label: "Pending" },
    accepted:  { color: "#3b82f6", bg: isDarkMode ? "rgba(59,130,246,0.12)" : "#dbeafe", label: "Accepted" },
    completed: { color: "#10b981", bg: isDarkMode ? "rgba(16,185,129,0.12)" : "#d1fae5", label: "Completed" },
    rejected:  { color: "#ef4444", bg: isDarkMode ? "rgba(239,68,68,0.12)" : "#fee2e2",  label: "Rejected" },
    cancelled: { color: "#6b7280", bg: isDarkMode ? "rgba(107,114,128,0.12)" : "#f3f4f6", label: "Cancelled" },
  };

  // ── loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "16px" }}>
        <Loader2 size={36} color="#6b82f0" style={{ animation: "ov-spin 0.8s linear infinite" }} />
        <p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>Loading dashboard…</p>
        <style>{`@keyframes ov-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "12px" }}>
        <AlertCircle size={36} color="#ef4444" />
        <p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>{error}</p>
        <button onClick={() => fetchData()} style={{
          background: "#6b82f0", color: "white", border: "none", borderRadius: "10px",
          padding: "10px 20px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
        }}>
          Try Again
        </button>
      </div>
    );
  }

  const ov = overview;

  // ── stat cards data ───────────────────────────────────────────────────────
  const statCards = [
    {
      icon: Video,
      label: "Total Teachers",
      value: fmt(ov?.users?.teachers?.total),
      sub: `${fmt(ov?.users?.teachers?.active)} active`,
      accent: "#3b82f6",
      lightBg: isDarkMode ? "rgba(59,130,246,0.1)" : "#eff6ff",
    },
    {
      icon: Users,
      label: "Total Students",
      value: fmt(ov?.users?.students?.total),
      sub: `${fmt(ov?.users?.students?.active)} active`,
      accent: "#10b981",
      lightBg: isDarkMode ? "rgba(16,185,129,0.1)" : "#f0fdf4",
    },
    {
      icon: BookOpen,
      label: "Total Bookings",
      value: fmt(ov?.bookings?.total),
      sub: `${fmt(ov?.bookings?.byStatus?.completed)} completed`,
      accent: "#8b5cf6",
      lightBg: isDarkMode ? "rgba(139,92,246,0.1)" : "#f5f3ff",
    },
    {
      icon: DollarSign,
      label: "Total Revenue",
      value: fmtMoney(ov?.revenue?.total),
      sub: `${fmtMoney(ov?.revenue?.pending)} pending`,
      accent: "#f59e0b",
      lightBg: isDarkMode ? "rgba(245,158,11,0.1)" : "#fffbeb",
    },
  ];

  // Booking status breakdown
  const statusBreakdown = ov?.bookings?.byStatus
    ? Object.entries(ov.bookings.byStatus).map(([key, val]) => ({
        key,
        val,
        pct: ov.bookings.total > 0 ? Math.round((val / ov.bookings.total) * 100) : 0,
        ...statusConfig[key],
      }))
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: c.heading, letterSpacing: "-0.3px" }}>
            Dashboard Overview
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13.5px", color: c.muted }}>
            Live data from your platform
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: isDarkMode ? "#1e2235" : "#eef1ff",
            border: `1px solid ${isDarkMode ? "#252840" : "#dde3f8"}`,
            borderRadius: "10px", padding: "8px 14px",
            fontSize: "13px", fontWeight: "600",
            color: isDarkMode ? "#6b82f0" : "#4f63d2",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? "ov-spin 0.8s linear infinite" : "none" }} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        {statCards.map(({ icon: Icon, label, value, sub, accent, lightBg }) => (
          <div key={label} style={{
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: "16px",
            padding: "20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
            boxShadow: isDarkMode ? "none" : "0 2px 12px rgba(0,0,0,0.04)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
            className="ov-card"
          >
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px",
              background: lightBg, display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon size={20} color={accent} />
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: "600", color: c.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {label}
              </p>
              <p style={{ margin: "0 0 4px", fontSize: "26px", fontWeight: "800", color: c.heading, letterSpacing: "-0.5px", lineHeight: 1 }}>
                {value}
              </p>
              <p style={{ margin: 0, fontSize: "12.5px", color: accent, fontWeight: "600" }}>
                {sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Middle row: Status breakdown + Revenue split ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Booking Status Breakdown */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
            <Activity size={16} color="#6b82f0" />
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: c.heading }}>
              Booking Status
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {statusBreakdown.map(({ key, val, pct, color, bg, label }) => (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      display: "inline-block", width: "8px", height: "8px",
                      borderRadius: "50%", background: color,
                    }} />
                    <span style={{ fontSize: "13px", fontWeight: "600", color: c.text, textTransform: "capitalize" }}>
                      {label}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                      borderRadius: "20px", background: bg, color: color,
                    }}>
                      {val}
                    </span>
                    <span style={{ fontSize: "11px", color: c.muted, minWidth: "32px", textAlign: "right" }}>
                      {pct}%
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height: "5px", borderRadius: "4px", background: isDarkMode ? "#1e2235" : "#f0f2fc", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: "4px",
                    width: `${pct}%`, background: color,
                    transition: "width 0.6s ease",
                  }} />
                </div>
              </div>
            ))}
            {statusBreakdown.length === 0 && (
              <p style={{ fontSize: "13px", color: c.muted, textAlign: "center", padding: "20px 0" }}>No bookings yet</p>
            )}
          </div>
        </div>

        {/* Revenue Split */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
            <TrendingUp size={16} color="#6b82f0" />
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: c.heading }}>
              Revenue Breakdown
            </h2>
          </div>

          {ov?.revenue ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { label: "Paid Out", value: fmtMoney(ov.revenue.paid), color: "#10b981", icon: CheckCircle },
                { label: "Pending", value: fmtMoney(ov.revenue.pending), color: "#f59e0b", icon: Clock },
                { label: "Total", value: fmtMoney(ov.revenue.total), color: "#6b82f0", icon: DollarSign },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: "12px",
                  background: isDarkMode ? "#0f1117" : "#f8faff",
                  border: `1px solid ${c.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Icon size={15} color={color} />
                    <span style={{ fontSize: "13px", fontWeight: "600", color: c.text }}>{label}</span>
                  </div>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: color }}>{value}</span>
                </div>
              ))}

              {ov.revenue.teachersWithPending > 0 && (
                <p style={{ margin: 0, fontSize: "12px", color: c.muted, textAlign: "center" }}>
                  💡 {ov.revenue.teachersWithPending} teacher{ov.revenue.teachersWithPending > 1 ? "s" : ""} awaiting payment
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: c.muted, textAlign: "center", padding: "20px 0" }}>No revenue data yet</p>
          )}
        </div>
      </div>

      {/* ── Recent Bookings ── */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={16} color="#6b82f0" />
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: c.heading }}>
              Recent Bookings
            </h2>
          </div>
          <span style={{ fontSize: "12px", color: c.muted }}>Last 6</span>
        </div>

        {recentBookings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Calendar size={32} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 8px" }} />
            <p style={{ fontSize: "13px", color: c.muted, margin: 0 }}>No bookings yet</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentBookings.map((booking, i) => {
              const sc = statusConfig[booking.status] || statusConfig.pending;
              const teacherName = booking.teacherId
                ? `${booking.teacherId.firstName || ""} ${booking.teacherId.lastName || ""}`.trim()
                : "—";
              const studentName = booking.studentId
                ? `${booking.studentId.firstName || ""} ${booking.studentId.surname || ""}`.trim()
                : "—";

              return (
                <div key={booking._id || i} style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "12px 14px", borderRadius: "12px",
                  background: isDarkMode ? "#0f1117" : "#f8faff",
                  border: `1px solid ${c.border}`,
                }}>
                  {/* Status dot */}
                  <div style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    background: sc.color, flexShrink: 0,
                  }} />

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "13.5px", fontWeight: "700", color: c.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {booking.classTitle || "Untitled Class"}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.muted }}>
                      {teacherName} → {studentName}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span style={{
                    fontSize: "11px", fontWeight: "700", padding: "3px 10px",
                    borderRadius: "20px", background: sc.bg, color: sc.color,
                    textTransform: "capitalize", flexShrink: 0,
                  }}>
                    {sc.label}
                  </span>

                  {/* Time */}
                  <span style={{ fontSize: "11px", color: c.muted, flexShrink: 0 }}>
                    {booking.scheduledTime
                      ? new Date(booking.scheduledTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : timeAgo(booking.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Quick summary row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
        {[
          { label: "Pending Applications", value: fmt(ov?.bookings?.byStatus?.pending), icon: Clock, color: "#f59e0b" },
          { label: "Accepted Bookings", value: fmt(ov?.bookings?.byStatus?.accepted), icon: CheckCircle, color: "#3b82f6" },
          { label: "Completed Classes", value: fmt(ov?.bookings?.byStatus?.completed), icon: CheckCircle, color: "#10b981" },
          { label: "Cancelled / Rejected", value: fmt((ov?.bookings?.byStatus?.cancelled || 0) + (ov?.bookings?.byStatus?.rejected || 0)), icon: XCircle, color: "#ef4444" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{
            background: c.card, border: `1px solid ${c.border}`,
            borderRadius: "14px", padding: "14px 16px",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <Icon size={18} color={color} style={{ flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: c.heading, lineHeight: 1 }}>{value}</p>
              <p style={{ margin: "3px 0 0", fontSize: "11px", color: c.muted, fontWeight: "500" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes ov-spin { to { transform: rotate(360deg); } }
        .ov-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; }
      `}</style>
    </div>
  );
}

function palette(dark) {
  return {
    card:    dark ? "#1a1d27" : "#ffffff",
    border:  dark ? "#1e2235" : "#e8ecf4",
    heading: dark ? "#e2e8f0" : "#1e293b",
    text:    dark ? "#94a3b8" : "#475569",
    muted:   dark ? "#374151" : "#94a3b8",
  };
}
