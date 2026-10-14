// src/components/analytics/AnalyticsDashboard.jsx - COMPREHENSIVE ANALYTICS DASHBOARD
import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Award,
  Clock,
  BarChart3,
  PieChart,
  RefreshCw,
  Lock,
  ShieldCheck
} from "lucide-react";
import api from "../../api";
import { useCurrencySymbol, fmtMoney } from "../../hooks/useCurrencySymbol";
import AnalyticsPinPrompt from "../admin/analytics/AnalyticsPinPrompt";
import { useOnDataChanged } from "../../hooks/useLiveData";
import { clearAnalyticsUnlock } from "../../utils/analyticsPin";
import { visibleEmail } from "../../utils/managedStudent.js";

export default function AnalyticsDashboard({ isDarkMode }) {
  // PIN gate: null = checking, otherwise { pinSet, unlocked }
  const [pinState, setPinState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [teacherPerformance, setTeacherPerformance] = useState([]);
  const [studentEngagement, setStudentEngagement] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [popularTimes, setPopularTimes] = useState([]);
  const [acceptanceRate, setAcceptanceRate] = useState([]);

  const sym = useCurrencySymbol();
  const dm = isDarkMode;

  // ── colour tokens ──────────────────────────────────────────────────────────
  // Shared admin tokens (src/index.css .as-root): follow the center colour + dark mode.
  // No page background of its own, so the dashboard's sunrise shows through.
  const pageBg   = "";
  const cardBg   = "as-panel bg-ad-surface border border-ad-line shadow-[var(--a-shadow)]";
  const heading  = "text-ad-ink";
  const subText  = "text-ad-ink-2";
  const mutedText= "text-ad-muted";
  const divider  = "border-ad-line";
  const inlineBg = "bg-ad-raised";

  const lock = () => {
    clearAnalyticsUnlock();
    setPinState(s => ({ ...s, unlocked: false }));
  };

  const fetchAnalytics = async (quiet = false) => {
    try {
      if (quiet !== true) setLoading(true);
      const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      const [
        overviewRes, teachersRes,
        studentsRes, revenueRes, timesRes, acceptanceRes
      ] = await Promise.all([
        api.get("/analytics/overview"),
        api.get("/analytics/teacher-performance?limit=5"),
        api.get("/analytics/student-engagement?limit=5"),
        api.get("/analytics/revenue-breakdown"),
        api.get(`/analytics/popular-times?tz=${tz}`),
        api.get("/analytics/booking-acceptance-rate")
      ]);
      setOverview(overviewRes.data.data);
      setTeacherPerformance(teachersRes.data.data);
      setStudentEngagement(studentsRes.data.data);
      setRevenue(revenueRes.data.data);
      setPopularTimes(timesRes.data.data);
      setAcceptanceRate(acceptanceRes.data.data);
    } catch (error) {
      if (error.response?.data?.code === "ANALYTICS_LOCKED") {
        lock();   // unlock expired or PIN changed elsewhere
      } else {
        console.error("Error fetching analytics:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Live: refresh quietly when the server says the numbers changed (shared snapshot server-side)
  useOnDataChanged(["analytics"], () => { if (pinState?.unlocked) fetchAnalytics(true); });

  useEffect(() => {
    api.get("/admin/analytics-pin/status")
      .then(res => setPinState(res.data.data))
      .catch(() => setPinState({ pinSet: false, unlocked: true }));   // server still enforces the PIN
  }, []);

  useEffect(() => { if (pinState?.unlocked) fetchAnalytics(); }, [pinState?.unlocked]);

  // ── sub-components ──────────────────────────────────────────────────────────
  // Same topic tiles as Overview/Teachers: solid icon in the topic colour + a corner wash
  const StatCard = ({ icon: Icon, title, value, subtitle, cat = "accent" }) => (
    <div
      className={`cat-${cat} relative overflow-hidden rounded-xl p-5 border border-ad-line shadow-[var(--a-shadow)]`}
      style={{ background: "radial-gradient(120% 100% at 100% 0%, var(--cat-soft) 0%, transparent 60%), var(--a-surface)" }}
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: "var(--cat)", boxShadow: "0 6px 14px -6px var(--cat)" }}>
          <Icon className="w-5 h-5" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>{title}</p>
          <p className={`text-2xl font-extrabold tabular-nums leading-tight break-all ${heading}`}>{value}</p>
          {subtitle && <p className={`text-xs mt-0.5 font-semibold ${subText}`}>{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  const ProgressBar = ({ percentage, color = "purple" }) => {
    const barColor = {
      purple: "bg-ad-accent", blue: "bg-blue-500",
      green: "bg-green-500", yellow: "bg-yellow-500",
    }[color] || "bg-ad-accent";
    return (
      <div className="w-full rounded-full h-2 bg-ad-raised">
        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    );
  };

  if (pinState && !pinState.unlocked) {
    return (
      <div className={`${pageBg} rounded-xl`}>
        <AnalyticsPinPrompt inline isDarkMode={dm} onUnlocked={() => setPinState(s => ({ ...s, unlocked: true }))} />
      </div>
    );
  }

  if (!pinState || loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${pageBg} rounded-xl`}>
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 text-ad-accent animate-spin" />
          <p className={subText}>Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className={`text-center py-12 ${pageBg} rounded-xl`}>
        <p className={subText}>No data available</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${pageBg} rounded-xl p-2`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-extrabold tracking-tight ${heading}`}>Analytics Dashboard</h1>
          <p className={`mt-1 ${subText}`}>Platform performance and insights</p>
        </div>
        <div className="flex items-center gap-2">
          {pinState.pinSet && (
            <button
              onClick={lock}
              aria-label="Lock analytics"
              className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition active:scale-[0.97] bg-ad-surface border border-ad-line hover:bg-ad-raised text-ad-ink-2"
            >
              <Lock className="w-4 h-4" />
              Lock
            </button>
          )}
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-ad-accent hover:bg-ad-accent-hover text-ad-on-accent rounded-xl flex items-center gap-2 text-sm font-semibold transition active:scale-[0.97] shadow-[0_4px_14px_-4px_var(--a-accent)]"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {!pinState.pinSet && (
        <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3 bg-ad-accent-soft text-ad-accent-ink border border-ad-accent-line">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          Tip: protect revenue and analytics with a 4-digit PIN in Settings → Analytics PIN.
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Users}     title="Active Teachers" value={overview.users.teachers.active} subtitle={`${overview.users.teachers.total} total`}                           cat="teal"  />
        <StatCard icon={Users}     title="Active Students" value={overview.users.students.active} subtitle={`${overview.users.students.total} total`}                           cat="sky"   />
        <StatCard icon={Calendar}  title="Total Bookings"  value={overview.bookings.total}         subtitle={`${overview.bookings.byStatus.completed} completed`}                cat="amber" />
        <StatCard icon={DollarSign} title="Total Revenue"  value={fmtMoney(overview.revenue?.total, sym)} subtitle={`${fmtMoney(overview.revenue?.teacherPending, sym)} owed to teachers`} cat="green" />
      </div>

      {/* Booking Status Breakdown */}
      <div className={`rounded-xl p-6 ${cardBg}`}>
        <h2 className={`text-lg font-extrabold mb-4 flex items-center gap-2 ${heading}`}>
          <PieChart className="w-5 h-5" style={{ color: "#d97706" }} /> Booking Status Distribution
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(overview.bookings.byStatus).map(([status, count]) => {
            const colorMap = {
              pending:   { label: "Pending",   ring: dm ? "bg-yellow-900/40 text-yellow-300" : "bg-yellow-100 text-yellow-600" },
              accepted:  { label: "Accepted",  ring: dm ? "bg-green-900/40 text-green-300"   : "bg-green-100 text-green-600"   },
              completed: { label: "Completed", ring: dm ? "bg-blue-900/40 text-blue-300"     : "bg-blue-100 text-blue-600"     },
              missed:    { label: "Missed",    ring: dm ? "bg-rose-900/40 text-rose-300" : "bg-rose-100 text-rose-600" },
              pending_confirmation: { label: "Awaiting Confirmation", ring: dm ? "bg-sky-900/40 text-sky-300" : "bg-sky-100 text-sky-600" },
              rejected:  { label: "Rejected",  ring: dm ? "bg-red-900/40 text-red-300"       : "bg-red-100 text-red-600"       },
              cancelled: { label: "Cancelled", ring: dm ? "bg-stone-700 text-stone-400"        : "bg-stone-100 text-stone-600"     },
            };
            const c = colorMap[status] || colorMap.cancelled;
            const label = colorMap[status]?.label || status.replace(/_/g, " ");
            const percentage = overview.bookings.total ? (count / overview.bookings.total) * 100 : 0;
            return (
              <div key={status} className="text-center">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2 ring-4 ring-ad-surface shadow-[var(--a-shadow)] ${c.ring}`}>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
                <p className={`text-sm font-medium capitalize ${heading}`}>{label}</p>
                <p className={`text-xs ${mutedText}`}>{percentage.toFixed(1)}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue Breakdown */}
      {revenue && (
        <div className={`rounded-xl p-6 ${cardBg}`}>
          <h2 className={`text-lg font-extrabold mb-4 flex items-center gap-2 ${heading}`}>
            <DollarSign className="w-5 h-5" style={{ color: "#16a34a" }} /> Revenue Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {[
              { label: "Total Revenue", value: revenue.summary.totalRevenue,  c: dm ? "bg-green-900/30 text-green-300"  : "bg-green-50 text-green-600"  },
              { label: "Paid to Teachers",  value: revenue.summary.totalPaid,    c: dm ? "bg-blue-900/30 text-blue-300"    : "bg-blue-50 text-blue-600"    },
              { label: "Owed to Teachers",  value: revenue.summary.totalPending, c: dm ? "bg-yellow-900/30 text-yellow-300": "bg-yellow-50 text-yellow-600" },
            ].map(({ label, value, c }) => (
              <div key={label} className={`text-center p-4 rounded-lg ${c}`}>
                <p className={`text-sm mb-1 ${subText}`}>{label}</p>
                <p className="text-3xl font-bold">{fmtMoney(value, sym)}</p>
              </div>
            ))}
          </div>

          <h3 className={`font-semibold mb-3 ${heading}`}>Top Earning Teachers</h3>
          <div className="space-y-3">
            {revenue.byTeacher.slice(0, 5).map((teacher, index) => (
              <div key={teacher._id} className={`flex items-center justify-between p-3 rounded-lg ${inlineBg}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-ad-accent-soft text-ad-accent-ink ring-1 ring-inset ring-ad-accent-line`}>
                    #{index + 1}
                  </div>
                  <div>
                    <p className={`font-medium ${heading}`}>{teacher.teacherName}</p>
                    <p className={`text-sm ${mutedText}`}>{teacher.classCount} classes</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${heading}`}>{fmtMoney(teacher.totalEarned, sym)}</p>
                  <p className="text-sm text-yellow-500">{fmtMoney(teacher.pendingAmount, sym)} owed</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teacher Performance */}
      <div className={`rounded-xl p-6 ${cardBg}`}>
        <h2 className={`text-lg font-extrabold mb-4 flex items-center gap-2 ${heading}`}>
          <Award className="w-5 h-5" style={{ color: "#0d9488" }} /> Top Performing Teachers
        </h2>
        <div className="space-y-4">
          {teacherPerformance.map((teacher, index) => (
            <div key={teacher._id} className={`border-b pb-4 last:border-0 ${divider}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold text-ad-accent-line`}>#{index + 1}</span>
                  <div>
                    <p className={`font-semibold ${heading}`}>{teacher.firstName} {teacher.lastName}</p>
                    <p className={`text-sm ${mutedText}`}>{teacher.continent}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-ad-accent-ink">{teacher.completedBookings} classes</p>
                  <p className={`text-sm ${mutedText}`}>{fmtMoney(teacher.earned, sym)} earned (all time)</p>
                </div>
              </div>
              <div className={`flex items-center gap-4 text-sm mb-2 ${subText}`}>
                <span>Acceptance Rate: {teacher.acceptanceRate.toFixed(1)}%</span>
                <span>•</span>
                <span>{teacher.pendingBookings} pending</span>
                <span>•</span>
                <span>{teacher.rejectedBookings} rejected</span>
              </div>
              <ProgressBar percentage={teacher.acceptanceRate} />
            </div>
          ))}
        </div>
      </div>

      {/* Student Engagement */}
      <div className={`rounded-xl p-6 ${cardBg}`}>
        <h2 className={`text-lg font-extrabold mb-4 flex items-center gap-2 ${heading}`}>
          <TrendingUp className="w-5 h-5" style={{ color: "#0284c7" }} /> Most Engaged Students
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studentEngagement.map((student, index) => (
            <div key={student._id} className={`p-4 rounded-lg as-panel bg-ad-surface border border-ad-line`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-ad-accent-soft text-ad-accent-ink ring-1 ring-inset ring-ad-accent-line`}>
                  #{index + 1}
                </div>
                <div>
                  <p className={`font-semibold ${heading}`}>{student.firstName} {student.lastName}</p>
                  <p className={`text-xs ${mutedText}`}>{visibleEmail(student.email) || "No login (managed)"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: "Completed", value: student.completedClasses, color: "text-green-500" },
                  { label: "Upcoming",  value: student.upcomingClasses,  color: "text-blue-500"  },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`p-2 rounded bg-ad-raised`}>
                    <p className={`text-xs ${mutedText}`}>{label}</p>
                    <p className={`font-bold ${color}`}>{value}</p>
                  </div>
                ))}
                <div className={`p-2 rounded col-span-2 bg-ad-raised`}>
                  <p className={`text-xs ${mutedText}`}>Classes Remaining</p>
                  <p className="font-bold text-ad-accent-ink">{student.classCredits}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Popular Booking Times */}
      {popularTimes.length > 0 && (
        <div className={`rounded-xl p-6 ${cardBg}`}>
          <h2 className={`text-lg font-extrabold mb-4 flex items-center gap-2 ${heading}`}>
            <Clock className="w-5 h-5" style={{ color: "var(--a-accent)" }} /> Most Popular Booking Times
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularTimes.slice(0, 8).map((slot, index) => (
              <div key={index} className={`p-4 rounded-lg transition-colors bg-ad-raised hover:bg-ad-accent-soft`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`font-semibold ${heading}`}>{slot.day}</p>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium bg-ad-accent-soft text-ad-accent-ink`}>
                    {slot.count} bookings
                  </span>
                </div>
                <p className={`text-sm ${subText}`}>{slot.timeSlot}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acceptance Rate Trend */}
      {acceptanceRate.length > 0 && (
        <div className={`rounded-xl p-6 ${cardBg}`}>
          <h2 className={`text-lg font-extrabold mb-4 flex items-center gap-2 ${heading}`}>
            <BarChart3 className="w-5 h-5" style={{ color: "#ea580c" }} /> Booking Acceptance Rate Trend
          </h2>
          <div className="space-y-3">
            {acceptanceRate.slice(-6).map((month) => (
              <div key={month.month} className="flex items-center gap-4">
                <div className={`w-24 text-sm font-medium ${heading}`}>{month.month}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ProgressBar percentage={month.acceptanceRate} />
                    <span className={`text-sm font-semibold ${heading}`}>{month.acceptanceRate.toFixed(1)}%</span>
                  </div>
                  <p className={`text-xs ${mutedText}`}>{month.accepted} accepted / {month.total} total</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
