// src/pages/student/components/Header.jsx
import { Key, Shield } from 'lucide-react';

export default function Header({ student, notifications, onLogout, onChangePassword, onManageSessions }) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              EL
            </div>
            <h1 className="ml-6 text-xl font-semibold text-gray-900">English Learning Platform</h1>
          </div>

          <div className="flex items-center space-x-3">
            {/* Session Management Button */}
            <button
              onClick={onManageSessions}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
              title="Manage your active sessions"
            >
              <Shield className="w-4 h-4" />
              Sessions
            </button>

            {/* Change Password Button */}
            <button
              onClick={onChangePassword}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              <Key className="w-4 h-4" />
              Change Password
            </button>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            >
              Logout
            </button>

            {/* Notifications */}
            <div className="relative">
              <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z" />
                </svg>
                {notifications.filter((n) => n.unread).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
