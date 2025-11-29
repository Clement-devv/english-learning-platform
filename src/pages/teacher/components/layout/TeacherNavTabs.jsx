// src/pages/teacher/components/layout/TeacherNavTabs.jsx
import React from "react";
import { Home, Calendar, CheckCircle, Users, BookOpen, MessageCircle } from "lucide-react";

export default function TeacherNavTabs({ activeTab, onChange, tabs, isDarkMode }) {
  const tabConfig = {
    dashboard: { label: "Dashboard", icon: Home },
    classes: { label: "My Classes", icon: Calendar },
    "completed-classes": { label: "Completed Classes", icon: CheckCircle },
    students: { label: "Students", icon: Users },
    bookings: { label: "Bookings", icon: BookOpen },
    messages: { label: "Messages", icon: MessageCircle } // ✅ NEW: Messages tab
  };

  return (
    <div className={`${
      isDarkMode ? 'bg-gray-800' : 'bg-white'
    } rounded-xl shadow-md p-2 mb-6 overflow-x-auto`}>
      <div className="flex gap-2 min-w-max">
        {tabs.map((tab) => {
          const config = tabConfig[tab];
          if (!config) return null;

          const Icon = config.icon;
          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              onClick={() => onChange(tab)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                isActive
                  ? isDarkMode
                    ? "bg-gradient-to-r from-purple-700 to-pink-700 text-white shadow-lg transform scale-105"
                    : "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg transform scale-105"
                  : isDarkMode
                    ? "text-gray-300 hover:bg-gray-700 hover:text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{config.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
