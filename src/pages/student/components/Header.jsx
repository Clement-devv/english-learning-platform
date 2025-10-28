// src/pages/student/components/Header.jsx
import React from "react";
import { LogOut, BookOpen } from "lucide-react";

export default function Header({ student, notifications, onLogout }) {
  const unreadCount = notifications?.filter(n => n.unread).length || 0;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Student Portal</h1>
              <p className="text-xs text-gray-500">Your learning journey</p>
            </div>
          </div>

          {/* Right: Student Info & Logout */}
          <div className="flex items-center gap-4">
            {/* Student Info */}
            {student && (
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {student.name || student.firstName}
                </p>
                <p className="text-xs text-gray-500">
                  {student.level || "Student"}
                </p>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
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
