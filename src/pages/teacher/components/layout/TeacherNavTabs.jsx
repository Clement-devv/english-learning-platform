import React from "react";
import { TrendingUp, Video, Users, Calendar, House } from "lucide-react";

const tabs = [
  { key: "dashboard", label: "Dashboard", icon: TrendingUp },
  { key: "classes", label: "My Classes", icon: Video },
  { key: "students", label: "Students", icon: Users },
  { key: "bookings", label: "Bookings", icon: Calendar },
  { key: "CompletedClasses", label: "Completed-Class", icon: House },
];

export default function TeacherNavTabs({ activeTab, onChange }) {
  return (
    <nav className="flex space-x-4 mb-6">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === key
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
