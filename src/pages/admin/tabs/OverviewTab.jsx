// src/pages/admin/tabs/OverviewTab.jsx
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  GraduationCap, 
  Calendar, 
  TrendingUp, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Video,
  UserCheck,
  FileText,
  Activity,
  DollarSign,
  Award
} from 'lucide-react';

export default function OverviewTab() {
  const [stats, setStats] = useState({
    totalTeachers: 45,
    activeTeachers: 38,
    totalStudents: 320,
    activeStudents: 287,
    totalClasses: 156,
    ongoingClasses: 12,
    scheduledClasses: 23,
    completedToday: 8,
    pendingApplications: 15,
    totalRevenue: 45670,
    monthlyGrowth: 12.5
  });

  const [ongoingClasses, setOngoingClasses] = useState([
    {
      id: 1,
      title: "English Conversation - Intermediate",
      teacher: "Sarah Johnson",
      students: 8,
      maxStudents: 12,
      startTime: "2:00 PM",
      duration: "60 min",
      status: "live"
    },
    {
      id: 2,
      title: "Business English",
      teacher: "David Wilson",
      students: 6,
      maxStudents: 10,
      startTime: "2:30 PM",
      duration: "45 min",
      status: "live"
    },
    {
      id: 3,
      title: "Grammar Fundamentals",
      teacher: "Emily Chen",
      students: 10,
      maxStudents: 15,
      startTime: "3:00 PM",
      duration: "60 min",
      status: "starting-soon"
    }
  ]);

  const [recentActivities, setRecentActivities] = useState([
    {
      id: 1,
      type: "student-enrolled",
      message: "John Doe enrolled in Advanced Grammar",
      time: "5 minutes ago",
      icon: UserCheck,
      color: "text-green-600"
    },
    {
      id: 2,
      type: "class-completed",
      message: "Sarah Johnson completed 'Speaking Practice'",
      time: "15 minutes ago",
      icon: CheckCircle,
      color: "text-blue-600"
    },
    {
      id: 3,
      type: "application",
      message: "New teacher application from Michael Brown",
      time: "30 minutes ago",
      icon: FileText,
      color: "text-purple-600"
    },
    {
      id: 4,
      type: "payment",
      message: "Payment received from Alice Smith ($120)",
      time: "1 hour ago",
      icon: DollarSign,
      color: "text-green-600"
    },
    {
      id: 5,
      type: "class-cancelled",
      message: "Class 'Pronunciation Workshop' cancelled",
      time: "2 hours ago",
      icon: XCircle,
      color: "text-red-600"
    }
  ]);

  const [quickActions, setQuickActions] = useState([
    {
      id: 1,
      title: "Pending Applications",
      count: 15,
      icon: FileText,
      color: "bg-purple-500",
      action: "Review"
    },
    {
      id: 2,
      title: "New Bookings",
      count: 8,
      icon: Calendar,
      color: "bg-blue-500",
      action: "View"
    },
    {
      id: 3,
      title: "Pending Approvals",
      count: 5,
      icon: AlertCircle,
      color: "bg-amber-500",
      action: "Approve"
    },
    {
      id: 4,
      title: "Support Tickets",
      count: 3,
      icon: Activity,
      color: "bg-red-500",
      action: "Resolve"
    }
  ]);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome to Admin Dashboard</h1>
        <p className="text-purple-100">Here's what's happening with your English learning platform today</p>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Teachers */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Teachers</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalTeachers}</p>
              <p className="text-sm text-green-600 mt-2">
                <span className="font-medium">{stats.activeTeachers} active</span>
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <GraduationCap className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Total Students */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Students</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalStudents}</p>
              <p className="text-sm text-green-600 mt-2">
                <span className="font-medium">{stats.activeStudents} active</span>
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Total Classes */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Classes</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalClasses}</p>
              <p className="text-sm text-purple-600 mt-2">
                <span className="font-medium">{stats.ongoingClasses} ongoing</span>
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">${stats.totalRevenue.toLocaleString()}</p>
              <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">+{stats.monthlyGrowth}% this month</span>
              </p>
            </div>
            <div className="bg-amber-100 p-3 rounded-full">
              <DollarSign className="w-8 h-8 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed Today</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedToday}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Scheduled Classes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.scheduledClasses}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Applications</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingApplications}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ongoing Classes & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ongoing Classes */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">Ongoing Classes</h2>
            </div>
            <span className="bg-red-100 text-red-700 text-sm px-3 py-1 rounded-full font-medium">
              {stats.ongoingClasses} Live
            </span>
          </div>

          <div className="space-y-3">
            {ongoingClasses.map((cls) => (
              <div 
                key={cls.id} 
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{cls.title}</h3>
                      {cls.status === 'live' ? (
                        <span className="flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          Live
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
                          Starting Soon
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <GraduationCap className="w-4 h-4" />
                        {cls.teacher}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {cls.students}/{cls.maxStudents} students
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {cls.startTime} • {cls.duration}
                      </span>
                    </div>
                  </div>

                  <button className="ml-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
                    Monitor
                  </button>
                </div>
              </div>
            ))}

            {ongoingClasses.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Video className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No ongoing classes at the moment</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          
          <div className="space-y-3">
            {quickActions.map((action) => (
              <div 
                key={action.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`${action.color} p-2 rounded-lg`}>
                      <action.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{action.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{action.count}</p>
                    </div>
                  </div>
                </div>
                <button className="w-full mt-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium">
                  {action.action}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-900">Recent Activities</h2>
        </div>

        <div className="space-y-3">
          {recentActivities.map((activity) => (
            <div 
              key={activity.id}
              className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className={`${activity.color} mt-1`}>
                <activity.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-gray-900 font-medium">{activity.message}</p>
                <p className="text-sm text-gray-500 mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>

        <button className="w-full mt-4 px-4 py-2 border-2 border-gray-200 hover:border-purple-600 text-gray-700 hover:text-purple-600 rounded-lg transition-colors font-medium">
          View All Activities
        </button>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">System Status</p>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">Operational</p>
          <p className="text-xs text-gray-500 mt-1">All systems running smoothly</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Server Load</p>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-600">42%</p>
          <p className="text-xs text-gray-500 mt-1">Normal load levels</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Active Users</p>
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-purple-600">287</p>
          <p className="text-xs text-gray-500 mt-1">Currently online</p>
        </div>
      </div>
    </div>
  );
}
