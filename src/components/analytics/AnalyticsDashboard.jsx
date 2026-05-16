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
  RefreshCw
} from "lucide-react";
import api from "../../api";
import { useCurrencySymbol, fmtMoney } from "../../hooks/useCurrencySymbol";

export default function AnalyticsDashboard({ isDarkMode }) {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [teacherPerformance, setTeacherPerformance] = useState([]);
  const [studentEngagement, setStudentEngagement] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [popularTimes, setPopularTimes] = useState([]);
  const [acceptanceRate, setAcceptanceRate] = useState([]);
  const [period, setPeriod] = useState("week");

  const sym = useCurrencySymbol();
  const dm = isDarkMode;

  // ── colour tokens ──────────────────────────────────────────────────────────
  const pageBg   = dm ? "bg-gray-900"              : "bg-gray-50";
  const cardBg   = dm ? "bg-gray-800 border border-gray-700" : "bg-white shadow-md";
  const heading  = dm ? "text-white"               : "text-gray-800";
  const subText  = dm ? "text-gray-400"             : "text-gray-600";
  const mutedText= dm ? "text-gray-500"             : "text-gray-500";
  const divider  = dm ? "border-gray-700"           : "border-gray-200";
  const rowHover = dm ? "hover:bg-gray-700/50"      : "hover:bg-gray-50";
  const inlineBg = dm ? "bg-gray-700"               : "bg-gray-50";

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [
        overviewRes, timelineRes, teachersRes,
        studentsRes, revenueRes, timesRes, acceptanceRes
      ] = await Promise.all([
        api.get("/analytics/overview"),
        api.get(`/analytics/bookings-timeline?period=${period}`),
        api.get("/analytics/teacher-performance?limit=5"),
        api.get("/analytics/student-engagement?limit=5"),
        api.get("/analytics/revenue-breakdown"),
        api.get("/analytics/popular-times"),
        api.get("/analytics/booking-acceptance-rate")
      ]);
      setOverview(overviewRes.data.data);
      setTimeline(timelineRes.data.data);
      setTeacherPerformance(teachersRes.data.data);
      setStudentEngagement(studentsRes.data.data);
      setRevenue(revenueRes.data.data);
      setPopularTimes(timesRes.data.data);
      setAcceptanceRate(acceptanceRes.data.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, [period]);

  // ── sub-components ──────────────────────────────────────────────────────────
  const StatCard = ({ icon: Icon, title, value, subtitle, color = "purple" }) => {
    const colorMap = {
      purple: { bg: dm ? "bg-purple-900/40" : "bg-purple-100", icon: dm ? "text-purple-300" : "text-purple-600", val: dm ? "text-purple-300" : "text-purple-600" },
      blue:   { bg: dm ? "bg-blue-900/40"   : "bg-blue-100",   icon: dm ? "text-blue-300"   : "text-blue-600",   val: dm ? "text-blue-300"   : "text-blue-600"   },
      green:  { bg: dm ? "bg-green-900/40"  : "bg-green-100",  icon: dm ? "text-green-300"  : "text-green-600",  val: dm ? "text-green-300"  : "text-green-600"  },
      orange: { bg: dm ? "bg-orange-900/40" : "bg-orange-100", icon: dm ? "text-orange-300" : "text-orange-600", val: dm ? "text-orange-300" : "text-orange-600" },
    };
    const c = colorMap[color] || colorMap.purple;
    return (
      <div className={`rounded-xl p-6 ${cardBg} transition-shadow`}>
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm font-medium mb-1 ${subText}`}>{title}</p>
            <p className={`text-3xl font-bold ${c.val}`}>{value}</p>
            {subtitle && <p className={`text-sm mt-2 ${mutedText}`}>{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg ${c.bg}`}>
            <Icon className={`w-6 h-6 ${c.icon}`} />
          </div>
        </div>
      </div>
    );
  };

  const ProgressBar = ({ percentage, color = "purple" }) => {
    const barColor = {
      purple: "bg-purple-600", blue: "bg-blue-500",
      green: "bg-green-500", yellow: "bg-yellow-500",
    }[color] || "bg-purple-600";
    return (
      <div className={`w-full rounded-full h-2 ${dm ? "bg-gray-700" : "bg-gray-200"}`}>
        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${pageBg} rounded-xl`}>
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 text-purple-500 animate-spin" />
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
          <h1 className={`text-3xl font-bold ${heading}`}>Analytics Dashboard</h1>
          <p className={`mt-1 ${subText}`}>Platform performance and insights</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Users}     title="Active Teachers" value={overview.users.teachers.active} subtitle={`${overview.users.teachers.total} total`}                           color="blue"   />
        <StatCard icon={Users}     title="Active Students" value={overview.users.students.active} subtitle={`${overview.users.students.total} total`}                           color="green"  />
        <StatCard icon={Calendar}  title="Total Bookings"  value={overview.bookings.total}         subtitle={`${overview.bookings.byStatus.completed} completed`}                color="purple" />
        <StatCard icon={DollarSign} title="Total Revenue"  value={fmtMoney(overview.revenue.total, sym)} subtitle={`${fmtMoney(overview.revenue.pending, sym)} pending`}         color="orange" />
      </div>

      {/* Booking Status Breakdown */}
      <div className={`rounded-xl p-6 ${cardBg}`}>
        <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${heading}`}>
          <PieChart className="w-5 h-5" /> Booking Status Distribution
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(overview.bookings.byStatus).map(([status, count]) => {
            const colorMap = {
              pending:   { ring: dm ? "bg-yellow-900/40 text-yellow-300" : "bg-yellow-100 text-yellow-600" },
              accepted:  { ring: dm ? "bg-green-900/40 text-green-300"   : "bg-green-100 text-green-600"   },
              completed: { ring: dm ? "bg-blue-900/40 text-blue-300"     : "bg-blue-100 text-blue-600"     },
              rejected:  { ring: dm ? "bg-red-900/40 text-red-300"       : "bg-red-100 text-red-600"       },
              cancelled: { ring: dm ? "bg-gray-700 text-gray-400"        : "bg-gray-100 text-gray-600"     },
            };
            const c = colorMap[status] || colorMap.cancelled;
            const percentage = overview.bookings.total ? (count / overview.bookings.total) * 100 : 0;
            return (
              <div key={status} className="text-center">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2 ${c.ring}`}>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
                <p className={`text-sm font-medium capitalize ${heading}`}>{status}</p>
                <p className={`text-xs ${mutedText}`}>{percentage.toFixed(1)}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue Breakdown */}
      {revenue && (
        <div className={`rounded-xl p-6 ${cardBg}`}>
          <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${heading}`}>
            <DollarSign className="w-5 h-5" /> Revenue Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {[
              { label: "Total Revenue", value: revenue.summary.totalRevenue,  c: dm ? "bg-green-900/30 text-green-300"  : "bg-green-50 text-green-600"  },
              { label: "Paid Out",      value: revenue.summary.totalPaid,     c: dm ? "bg-blue-900/30 text-blue-300"    : "bg-blue-50 text-blue-600"    },
              { label: "Pending",       value: revenue.summary.totalPending,  c: dm ? "bg-yellow-900/30 text-yellow-300": "bg-yellow-50 text-yellow-600" },
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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${dm ? "bg-purple-800 text-purple-200" : "bg-purple-100 text-purple-600"}`}>
                    #{index + 1}
                  </div>
                  <div>
                    <p className={`font-medium ${heading}`}>{teacher.teacherName}</p>
                    <p className={`text-sm ${mutedText}`}>{teacher.classCount} classes</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${heading}`}>{fmtMoney(teacher.totalEarned, sym)}</p>
                  <p className="text-sm text-yellow-500">{fmtMoney(teacher.pendingAmount, sym)} pending</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teacher Performance */}
      <div className={`rounded-xl p-6 ${cardBg}`}>
        <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${heading}`}>
          <Award className="w-5 h-5" /> Top Performing Teachers
        </h2>
        <div className="space-y-4">
          {teacherPerformance.map((teacher, index) => (
            <div key={teacher._id} className={`border-b pb-4 last:border-0 ${divider}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold ${dm ? "text-gray-600" : "text-gray-300"}`}>#{index + 1}</span>
                  <div>
                    <p className={`font-semibold ${heading}`}>{teacher.firstName} {teacher.lastName}</p>
                    <p className={`text-sm ${mutedText}`}>{teacher.continent}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-purple-500">{teacher.lessonsCompleted} classes</p>
                  <p className={`text-sm ${mutedText}`}>{fmtMoney(teacher.earned, sym)} earned</p>
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
        <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${heading}`}>
          <TrendingUp className="w-5 h-5" /> Most Engaged Students
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studentEngagement.map((student, index) => (
            <div key={student._id} className={`p-4 rounded-lg ${dm ? "bg-purple-900/20 border border-purple-800/30" : "bg-gradient-to-br from-purple-50 to-blue-50"}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${dm ? "bg-purple-800 text-purple-200" : "bg-purple-100 text-purple-600"}`}>
                  #{index + 1}
                </div>
                <div>
                  <p className={`font-semibold ${heading}`}>{student.firstName} {student.lastName}</p>
                  <p className={`text-xs ${mutedText}`}>{student.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: "Completed", value: student.completedClasses, color: "text-green-500" },
                  { label: "Upcoming",  value: student.upcomingClasses,  color: "text-blue-500"  },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`p-2 rounded ${dm ? "bg-gray-700" : "bg-white"}`}>
                    <p className={`text-xs ${mutedText}`}>{label}</p>
                    <p className={`font-bold ${color}`}>{value}</p>
                  </div>
                ))}
                <div className={`p-2 rounded col-span-2 ${dm ? "bg-gray-700" : "bg-white"}`}>
                  <p className={`text-xs ${mutedText}`}>Classes Remaining</p>
                  <p className="font-bold text-purple-500">{student.classCredits}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Popular Booking Times */}
      {popularTimes.length > 0 && (
        <div className={`rounded-xl p-6 ${cardBg}`}>
          <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${heading}`}>
            <Clock className="w-5 h-5" /> Most Popular Booking Times
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularTimes.slice(0, 8).map((slot, index) => (
              <div key={index} className={`p-4 rounded-lg transition-colors ${dm ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-50 hover:bg-gray-100"}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`font-semibold ${heading}`}>{slot.day}</p>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${dm ? "bg-purple-900/50 text-purple-300" : "bg-purple-100 text-purple-600"}`}>
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
          <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${heading}`}>
            <BarChart3 className="w-5 h-5" /> Booking Acceptance Rate Trend
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
