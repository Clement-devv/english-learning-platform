import React from "react";
import { Shield } from 'lucide-react';

export default function DashboardHeader({ onManageSessions }) {
  return (
    <header className="bg-slate-50 shadow-sm border-b border-slate-200 dark:bg-slate-800 dark:border-slate-600">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">
          English Learning Platform
        </h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={onManageSessions}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
          >
            <Shield className="w-4 h-4" />
            Sessions
          </button>
          <span className="text-sm font-medium text-gray-600">
            Teacher Mannie
          </span>
          <div className="w-8 h-8 bg-blue-500 text-white flex items-center justify-center rounded-full">
            T
          </div>
        </div>
      </div>
    </header>
  );
}
