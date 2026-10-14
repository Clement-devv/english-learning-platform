// src/pages/admin/tabs/OverviewTab.jsx
import React, { useState, useEffect } from "react";
import {
  Users, Video, Calendar, DollarSign, TrendingUp,
  CheckCircle, Clock, XCircle, AlertCircle, RefreshCw,
  BookOpen, Activity, ArrowUpRight, Loader2, Eye, EyeOff, Wallet
} from "lucide-react";
import api from "../../../api";
import { useCurrencySymbol } from "../../../hooks/useCurrencySymbol";
import AnalyticsPinPrompt from "../../../components/admin/analytics/AnalyticsPinPrompt";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import { clearAnalyticsUnlock } from "../../../utils/analyticsPin";
import { useTranslation } from "react-i18next";
import { dateLocale } from "../../../i18n/dateLocale.js";

const MASK = "••••••";

export default function OverviewTab({ isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  const [overview, setOverview] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  // Revenue is hidden by default; revealing it needs the analytics PIN (if set)
  const [revealed, setRevealed] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const c = palette(isDarkMode);
  const sym = useCurrencySymbol();

  const fetchData = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);

      const [overviewRes, bookingsRes] = await Promise.all([
        api.get("/analytics/overview"),
        api.get("/bookings?limit=6&sort=recent"),
      ]);

      setOverview(overviewRes.data.data);
      if (!overviewRes.data.data?.revenue) setRevealed(false);

      // Handle different response shapes for bookings
      const bookings = bookingsRes.data?.bookings
        || bookingsRes.data?.data
        || (Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
      setRecentBookings(bookings.slice(0, 6));

    } catch (err) {
      console.error("Overview fetch error:", err);
      setError(tr("overviewTab.failedToLoadDashboardData"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  // Live: the server sends "analytics" a few seconds after anything changes; the
  // numbers come from one shared snapshot, so every admin refreshing is cheap.
  useOnDataChanged(["analytics"], () => fetchData(true));

  // Re-fetch only the overview (now with revenue) and show it
  const loadRevenue = async () => {
    setRevealing(true);
    try {
      const res = await api.get("/analytics/overview");
      setOverview(res.data.data);
      if (res.data.data?.revenue) {
        setRevealed(true);
      } else {
        clearAnalyticsUnlock();   // token expired or PIN changed
        setShowPinPrompt(true);
      }
    } catch {
      setError(tr("overviewTab.failedToLoadRevenue"));
    } finally {
      setRevealing(false);
    }
  };

  const toggleRevenue = () => {
    if (revealed) return setRevealed(false);
    if (overview?.revenue) return setRevealed(true);   // already unlocked (or no PIN set)
    setShowPinPrompt(true);
  };

  // ── helpers ──────────────────────────────────────────────────────────────
  const fmt = (n) => (n === undefined || n === null ? "—" : Number(n).toLocaleString());
  const fmtMoney = (n) => (n === undefined || n === null ? "—" : `${sym}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
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

  // Status colours carry meaning only; badge tints are mixed from the colour itself
  const status = (color, label) => ({ color, bg: `color-mix(in srgb, ${color} 13%, var(--a-surface))`, label });
  const statusConfig = {
    pending:              status("#d97706", tr("overviewTab.pending")),
    accepted:             status("#2563eb", tr("overviewTab.accepted")),
    completed:            status("#16a34a", tr("overviewTab.completed")),
    missed:               status("#e11d48", tr("overviewTab.missed")),
    pending_confirmation: status("#0891b2", tr("overviewTab.awaitingConfirmation")),
    rejected:             status("#b91c1c", tr("overviewTab.rejected")),
    cancelled:            status("#78716c", tr("overviewTab.cancelled")),
  };

  // ── loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* KPI row skeleton */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "20px", display: "flex", gap: "14px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "var(--a-raised)", flexShrink: 0, animation: "ov-pulse 1.5s ease-in-out infinite" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ height: "10px", borderRadius: "6px", background: "var(--a-raised)", width: "60%", animation: "ov-pulse 1.5s ease-in-out infinite" }} />
                <div style={{ height: "26px", borderRadius: "6px", background: "var(--a-raised)", width: "80%", animation: "ov-pulse 1.5s ease-in-out infinite" }} />
                <div style={{ height: "10px", borderRadius: "6px", background: "var(--a-raised)", width: "50%", animation: "ov-pulse 1.5s ease-in-out infinite" }} />
              </div>
            </div>
          ))}
        </div>
        {/* Middle row skeleton */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {[1,2].map(i => (
            <div key={i} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "20px", height: "200px", animation: "ov-pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
        {/* Bookings skeleton */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "20px" }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: "52px", borderRadius: "12px", background: "var(--a-raised)", marginBottom: "8px", animation: "ov-pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
        <style>{`@keyframes ov-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes ov-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "12px" }}>
        <AlertCircle size={36} color="#ef4444" />
        <p style={{ fontSize: "14px", color: c.muted, margin: 0 }}>{error}</p>
        <button onClick={() => fetchData()} style={{
          background: "var(--a-accent-grad)", color: "var(--a-on-accent)", border: "none", borderRadius: "10px",
          padding: "10px 20px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
        }}>
          {tr("overviewTab.tryAgain")}
        </button>
      </div>
    );
  }

  const ov = overview;
  const showRevenue = revealed && !!ov?.revenue;

  const eyeButton = (
    <button
      type="button"
      onClick={toggleRevenue}
      disabled={revealing}
      aria-label={showRevenue ? tr("overviewTab.hideRevenue") : tr("overviewTab.showRevenue")}
      aria-pressed={showRevenue}
      title={showRevenue ? tr("overviewTab.hideRevenue") : tr("overviewTab.showRevenue")}
      style={{
        border: "none", background: "transparent", cursor: "pointer", padding: 4, borderRadius: 8,
        display: "inline-flex", alignItems: "center", color: c.text, flexShrink: 0,
      }}
    >
      {revealing ? <Loader2 size={16} style={{ animation: "ov-spin 0.8s linear infinite" }} />
        : showRevenue ? <Eye size={16} /> : <EyeOff size={16} />}
    </button>
  );

  // ── stat cards data ───────────────────────────────────────────────────────
  const statCards = [
    {
      icon: Video,
      label: tr("overviewTab.totalTeachers"), cat: "teal",
      value: fmt(ov?.users?.teachers?.total),
      sub: tr("overviewTab.active", { fmt: fmt(ov?.users?.teachers?.active) }),
    },
    {
      icon: Users,
      label: tr("overviewTab.totalStudents"), cat: "sky",
      value: fmt(ov?.users?.students?.total),
      sub: tr("overviewTab.active", { fmt: fmt(ov?.users?.students?.active) }),
    },
    {
      icon: BookOpen,
      label: tr("overviewTab.totalBookings"), cat: "amber",
      value: fmt(ov?.bookings?.total),
      sub: tr("overviewTab.completed2", { fmt: fmt(ov?.bookings?.byStatus?.completed) }),
    },
    {
      icon: DollarSign,
      label: tr("overviewTab.totalRevenue"), cat: "green",
      value: showRevenue ? fmtMoney(ov.revenue.total) : MASK,
      sub: showRevenue ? tr("overviewTab.owedToTeachers", { fmtMoney: fmtMoney(ov.revenue.teacherPending) }) : tr("overviewTab.hidden"),
      action: eyeButton,
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
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: c.heading, letterSpacing: "-0.3px" }}>
            {tr("overviewTab.dashboardOverview")}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13.5px", color: c.muted }}>
            {tr("overviewTab.liveDataFromYourPlatform")}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "var(--a-surface)",
            border: `1px solid ${c.border}`,
            borderRadius: "10px", padding: "8px 14px",
            fontSize: "13px", fontWeight: "700",
            color: c.text,
            cursor: "pointer",
          }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? "ov-spin 0.8s linear infinite" : "none" }} />
          {refreshing ? tr("overviewTab.refreshing") : tr("overviewTab.refresh")}
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        {statCards.map(({ icon: Icon, label, value, sub, cat, action }) => (
          <div key={label} className={`cat-${cat}`} style={{
            position: "relative", overflow: "hidden",
            background: `radial-gradient(120% 90% at 100% 0%, var(--cat-soft) 0%, transparent 55%), ${c.card}`,
            border: `1px solid ${c.border}`,
            borderRadius: "16px",
            padding: "20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
            boxShadow: "var(--a-shadow)",
          }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px",
              background: "var(--cat)", boxShadow: "0 6px 14px -6px var(--cat)", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon size={20} color="#fff" strokeWidth={2.2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, margin: "0 0 4px" }}>
                <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: c.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}
                </p>
                {action}
              </div>
              <p style={{ margin: "0 0 4px", fontSize: "26px", fontWeight: "800", color: c.heading, letterSpacing: "-0.5px", lineHeight: 1 }}>
                {value}
              </p>
              <p style={{ margin: 0, fontSize: "12.5px", color: c.text, fontWeight: "600" }}>
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
            <Activity size={16} color="#d97706" />
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: c.heading }}>
              {tr("overviewTab.bookingStatus")}
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
                <div style={{ height: "5px", borderRadius: "4px", background: "var(--a-raised)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: "4px",
                    width: `${pct}%`, background: color,
                    transition: "width 0.6s ease",
                  }} />
                </div>
              </div>
            ))}
            {statusBreakdown.length === 0 && (
              <p style={{ fontSize: "13px", color: c.muted, textAlign: "center", padding: "20px 0" }}>{tr("overviewTab.noBookingsYet")}</p>
            )}
          </div>
        </div>

        {/* Revenue Split */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
            <TrendingUp size={16} color="#16a34a" />
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: c.heading, flex: 1 }}>
              {tr("overviewTab.revenueBreakdown")}
            </h2>
            {eyeButton}
          </div>

          {!showRevenue ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "28px 0" }}>
              <EyeOff size={26} color={c.muted} />
              <p style={{ margin: 0, fontSize: "13px", color: c.text, textAlign: "center" }}>
                {tr("overviewTab.revenueIsHiddenForPrivacy")}
              </p>
              <button type="button" onClick={toggleRevenue} disabled={revealing} style={{
                border: `1px solid ${c.border}`, background: "var(--a-accent-soft)", color: "var(--a-accent-ink)",
                borderRadius: "10px", padding: "7px 14px", fontSize: "12.5px", fontWeight: "700", cursor: "pointer",
              }}>
                {ov?.revenue ? tr("overviewTab.showRevenue") : tr("overviewTab.enterPinToView")}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { label: tr("overviewTab.studentPayments"), value: fmtMoney(ov.revenue.total), color: "var(--a-ink)", icon: DollarSign },
                { label: tr("overviewTab.paidToTeachers"), value: fmtMoney(ov.revenue.teacherPaid), color: "#16a34a", icon: CheckCircle },
                { label: tr("overviewTab.owedToTeachers2"), value: fmtMoney(ov.revenue.teacherPending), color: "#d97706", icon: Clock },
                { label: tr("overviewTab.netAfterTeacherPay"), value: fmtMoney(ov.revenue.net), color: ov.revenue.net < 0 ? "#dc2626" : "#16a34a", icon: Wallet },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: "12px",
                  background: "var(--a-raised)",
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
                <p style={{ margin: 0, fontSize: "12px", color: c.muted, textAlign: "center" }}>{tr("overviewTab.teacherAwaitingPayment", { teachersWithPending: ov.revenue.teachersWithPending, value: ov.revenue.teachersWithPending > 1 ? "s" : "" })}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Bookings ── */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: "16px", padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={16} color="#0284c7" />
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: c.heading }}>
              {tr("overviewTab.recentBookings")}
            </h2>
          </div>
          <span style={{ fontSize: "12px", color: c.muted }}>{tr("overviewTab.last6")}</span>
        </div>

        {recentBookings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{
              width: "64px", height: "64px", borderRadius: "20px",
              background: "var(--a-accent-soft)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <Calendar size={28} color="var(--a-accent)" />
            </div>
            <p style={{ fontSize: "16px", fontWeight: "700", color: c.heading, margin: "0 0 8px" }}>
              {tr("overviewTab.noBookingsYet")}
            </p>
            <p style={{ fontSize: "13.5px", color: c.muted, margin: 0 }}>
              {tr("overviewTab.bookingsWillAppearHereOnce")}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentBookings.map((booking, i) => {
              const sc = statusConfig[booking.status] || statusConfig.pending;
              const teacherName = booking.teacherId
                ? `${booking.teacherId.firstName || ""} ${booking.teacherId.lastName || ""}`.trim()
                : "—";
              const studentName = booking.studentId
                ? `${booking.studentId.firstName || ""} ${booking.studentId.lastName || ""}`.trim()
                : "—";

              return (
                <div key={booking._id || i} style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "12px 14px", borderRadius: "12px",
                  background: "var(--a-raised)",
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
                      {booking.classTitle || tr("overviewTab.untitledClass")}
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
                      ? new Date(booking.scheduledTime).toLocaleDateString(dateLocale("en-US"), { month: "short", day: "numeric" })
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
          { label: tr("overviewTab.pendingBookings"), value: fmt(ov?.bookings?.byStatus?.pending), icon: Clock, color: "#d97706" },
          { label: tr("overviewTab.acceptedBookings"), value: fmt(ov?.bookings?.byStatus?.accepted), icon: CheckCircle, color: "#2563eb" },
          { label: tr("overviewTab.completedClasses"), value: fmt(ov?.bookings?.byStatus?.completed), icon: CheckCircle, color: "#16a34a" },
          { label: tr("overviewTab.cancelledRejected"), value: fmt((ov?.bookings?.byStatus?.cancelled || 0) + (ov?.bookings?.byStatus?.rejected || 0)), icon: XCircle, color: "#dc2626" },
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

      {showPinPrompt && (
        <AnalyticsPinPrompt
          isDarkMode={isDarkMode}
          title={tr("overviewTab.revenueIsHidden")}
          onCancel={() => setShowPinPrompt(false)}
          onUnlocked={() => { setShowPinPrompt(false); loadRevenue(); }}
        />
      )}

      <style>{`
        @keyframes ov-spin { to { transform: rotate(360deg); } }
        @keyframes ov-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

// Shared admin tokens (src/index.css .as-root) — follow brand colour + dark mode
function palette() {
  return {
    card:    "var(--a-surface)",
    border:  "var(--a-line)",
    heading: "var(--a-ink)",
    text:    "var(--a-ink-2)",
    muted:   "var(--a-muted)",
  };
}
