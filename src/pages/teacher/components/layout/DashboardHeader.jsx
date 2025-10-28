// src/pages/teacher/components/Layout/DashboardHeader.jsx
import React from "react";
import { LogOut, GraduationCap } from "lucide-react";

export default function DashboardHeader({ teacherInfo, onLogout }) {
  return (
    <header className="bg-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-2 rounded-lg">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Teacher Dashboard</h1>
              <p className="text-xs text-gray-500">Manage your classes and students</p>
            </div>
          </div>

          {/* Right: Teacher Info & Logout */}
          <div className="flex items-center gap-4">
            {/* Teacher Info */}
            {teacherInfo && (
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {teacherInfo.firstName} {teacherInfo.lastName}
                </p>
                <p className="text-xs text-gray-500">{teacherInfo.email}</p>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
