import React from "react";

export default function DashboardHeader() {
  return (
    <header className="bg-slate-50 shadow-sm border-b border-slate-200 dark:bg-slate-800 dark:border-slate-600">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">
          English Learning Platform
        </h1>
        <div className="flex items-center space-x-4">
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
