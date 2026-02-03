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

/**
 * AnalyticsDashboard Component
 * 
 * Comprehensive analytics dashboard for admins
 * Shows platform statistics, trends, and insights
 */
export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [teacherPerformance, setTeacherPerformance] = useState([]);
  const [studentEngagement, setStudentEngagement] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [popularTimes, setPopularTimes] = useState([]);
  const [acceptanceRate, setAcceptanceRate] = useState([]);
  const [period, setPeriod] = useState("week");

  /**
   * Fetch all analytics data
   */
  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      const [
        overviewRes,
        timelineRes,
        teachersRes,
        studentsRes,
        revenueRes,
        timesRes,
        acceptanceRes
      ] = await Promise.all([
        api.get("/api/analytics/overview"),
        api.get(`/api/analytics/bookings-timeline?period=${period}`),
        api.get("/api/analytics/teacher-performance?limit=5"),
        api.get("/api/analytics/student-engagement?limit=5"),
        api.get("/api/analytics/revenue-breakdown"),
        api.get("/api/analytics/popular-times"),
        api.get("/api/analytics/booking-acceptance-rate")
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

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  /**
   * Stat Card Component
   */
  const StatCard = ({ icon: Icon, title, value, subtitle, color = "purple" }) => (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className={`text-3xl font-bold text-${color}-600`}>{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-2">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-${color}-100`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  /**
   * Progress Bar Component
   */
  const ProgressBar = ({ percentage, color = "purple" }) => (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className={`bg-${color}-600 h-2 rounded-full transition-all`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 text-purple-600 animate-spin" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Platform performance and insights</p>
        </div>
        
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          title="Active Teachers"
          value={overview.users.teachers.active}
          subtitle={`${overview.users.teachers.total} total`}
          color="blue"
        />
        <StatCard
          icon={Users}
          title="Active Students"
          value={overview.users.students.active}
          subtitle={`${overview.users.students.total} total`}
          color="green"
        />
        <StatCard
          icon={Calendar}
          title="Total Bookings"
          value={overview.bookings.total}
          subtitle={`${overview.bookings.byStatus.completed} completed`}
          color="purple"
        />
        <StatCard
          icon={DollarSign}
          title="Total Revenue"
          value={`$${overview.revenue.total.toFixed(2)}`}
          subtitle={`$${overview.revenue.pending.toFixed(2)} pending`}
          color="orange"
        />
      </div>

      {/* Booking Status Breakdown */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5" />
          Booking Status Distribution
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(overview.bookings.byStatus).map(([status, count]) => {
            const colors = {
              pending: "yellow",
              accepted: "green",
              completed: "blue",
              rejected: "red",
              cancelled: "gray"
            };
            const color = colors[status];
            const percentage = (count / overview.bookings.total) * 100;

            return (
              <div key={status} className="text-center">
                <div className={`w-16 h-16 mx-auto rounded-full bg-${color}-100 flex items-center justify-center mb-2`}>
                  <span className={`text-2xl font-bold text-${color}-600`}>{count}</span>
                </div>
                <p className="text-sm font-medium text-gray-800 capitalize">{status}</p>
                <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue Breakdown */}
      {revenue && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Revenue Breakdown
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-green-600">
                ${revenue.summary.totalRevenue?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Paid Out</p>
              <p className="text-3xl font-bold text-blue-600">
                ${revenue.summary.totalPaid?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">
                ${revenue.summary.totalPending?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>

          <h3 className="font-semibold text-gray-800 mb-3">Top Earning Teachers</h3>
          <div className="space-y-3">
            {revenue.byTeacher.slice(0, 5).map((teacher, index) => (
              <div key={teacher._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <span className="font-bold text-purple-600">#{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{teacher.teacherName}</p>
                    <p className="text-sm text-gray-500">{teacher.classCount} classes</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">${teacher.totalEarned.toFixed(2)}</p>
                  <p className="text-sm text-yellow-600">${teacher.pendingAmount.toFixed(2)} pending</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teacher Performance */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5" />
          Top Performing Teachers
        </h2>

        <div className="space-y-4">
          {teacherPerformance.map((teacher, index) => (
            <div key={teacher._id} className="border-b border-gray-200 pb-4 last:border-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-300">#{index + 1}</span>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {teacher.firstName} {teacher.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{teacher.continent}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-purple-600">{teacher.lessonsCompleted} classes</p>
                  <p className="text-sm text-gray-500">${teacher.earned.toFixed(2)} earned</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Acceptance Rate: {teacher.acceptanceRate.toFixed(1)}%</span>
                <span>•</span>
                <span>{teacher.pendingBookings} pending</span>
                <span>•</span>
                <span>{teacher.rejectedBookings} rejected</span>
              </div>
              
              <div className="mt-2">
                <ProgressBar percentage={teacher.acceptanceRate} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Student Engagement */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Most Engaged Students
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studentEngagement.map((student, index) => (
            <div key={student._id} className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="font-bold text-purple-600">#{index + 1}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">
                    {student.firstName} {student.surname}
                  </p>
                  <p className="text-xs text-gray-500">{student.email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-white p-2 rounded">
                  <p className="text-gray-600 text-xs">Completed</p>
                  <p className="font-bold text-green-600">{student.completedClasses}</p>
                </div>
                <div className="bg-white p-2 rounded">
                  <p className="text-gray-600 text-xs">Upcoming</p>
                  <p className="font-bold text-blue-600">{student.upcomingClasses}</p>
                </div>
                <div className="bg-white p-2 rounded col-span-2">
                  <p className="text-gray-600 text-xs">Classes Remaining</p>
                  <p className="font-bold text-purple-600">{student.noOfClasses}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Popular Booking Times */}
      {popularTimes.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Most Popular Booking Times
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularTimes.slice(0, 8).map((slot, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-800">{slot.day}</p>
                  <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-full font-medium">
                    {slot.count} bookings
                  </span>
                </div>
                <p className="text-sm text-gray-600">{slot.timeSlot}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acceptance Rate Trend */}
      {acceptanceRate.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Booking Acceptance Rate Trend
          </h2>

          <div className="space-y-3">
            {acceptanceRate.slice(-6).map((month) => (
              <div key={month.month} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium text-gray-700">
                  {month.month}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ProgressBar percentage={month.acceptanceRate} />
                    <span className="text-sm font-semibold text-gray-700">
                      {month.acceptanceRate.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {month.accepted} accepted / {month.total} total
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
