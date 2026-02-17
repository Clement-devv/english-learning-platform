// src/pages/teacher/components/dashboard/QuickStats.jsx 
import React from "react";
import { Users, Calendar, Clock, TrendingUp, BookOpen, Award, DollarSign } from "lucide-react";

export default function QuickStats({ stats, isDarkMode }) {
  const statCards = [
    {
      title: "Total Students",
      value: stats.totalStudents || 0,
      icon: Users,
      color: "blue",
      gradient: "from-blue-500 to-indigo-600",
      bgLight: "bg-blue-50",
      bgDark: "bg-blue-900/20",
      textLight: "text-blue-700",
      textDark: "text-blue-400",
      trend: "+2 this month"
    },
    {
      title: "Scheduled Classes",
      value: stats.totalClasses || 0,
      icon: Calendar,
      color: "purple",
      gradient: "from-purple-500 to-pink-600",
      bgLight: "bg-purple-50",
      bgDark: "bg-purple-900/20",
      textLight: "text-purple-700",
      textDark: "text-purple-400",
      trend: "Next 7 days"
    },
    {
      title: "Pending Requests",
      value: stats.totalBookings || 0,
      icon: Clock,
      color: "yellow",
      gradient: "from-yellow-500 to-orange-600",
      bgLight: "bg-yellow-50",
      bgDark: "bg-yellow-900/20",
      textLight: "text-yellow-700",
      textDark: "text-yellow-400",
      trend: "Needs attention"
    },
    {
      title: "Completed Today",
      value: stats.completedToday || 0,
      icon: Award,
      color: "green",
      gradient: "from-green-500 to-emerald-600",
      bgLight: "bg-green-50",
      bgDark: "bg-green-900/20",
      textLight: "text-green-700",
      textDark: "text-green-400",
      trend: "Great progress!"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        
        return (
          <div
            key={index}
            className={`${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            } rounded-2xl border shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer`}
          >
            {/* Gradient Header */}
            <div className={`h-2 bg-gradient-to-r ${stat.gradient}`}></div>
            
            <div className="p-6">
              {/* Icon and Value */}
              <div className="flex items-start justify-between mb-4">
                <div className={`${
                  isDarkMode ? stat.bgDark : stat.bgLight
                } p-3 rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-7 h-7 ${
                    isDarkMode ? stat.textDark : stat.textLight
                  }`} />
                </div>
                
                <div className="text-right">
                  <p className={`text-4xl font-bold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  } group-hover:scale-110 transition-transform duration-300`}>
                    {stat.value}
                  </p>
                </div>
              </div>

              {/* Title */}
              <h3 className={`text-sm font-semibold mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {stat.title}
              </h3>

              {/* Trend/Subtitle */}
              <p className={`text-xs ${
                isDarkMode ? 'text-gray-500' : 'text-gray-400'
              }`}>
                {stat.trend}
              </p>
            </div>

            {/* Hover Effect */}
            <div className={`h-1 bg-gradient-to-r ${stat.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`}></div>
          </div>
        );
      })}
    </div>
  );
}
