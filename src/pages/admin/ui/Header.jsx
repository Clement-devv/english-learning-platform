// src/pages/admin/ui/Header.jsx
import React from "react";
import { LogOut, Shield } from "lucide-react";

export default function Header({ onLogout }) {
  // Get admin info from localStorage
  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");

  return (
    <header className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">Platform Management</p>
            </div>
          </div>

          {/* Right: Admin Info & Logout */}
          <div className="flex items-center gap-4">
            {/* Admin Info */}
            {adminInfo.email && (
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {adminInfo.firstName || "Admin"} {adminInfo.lastName || ""}
                </p>
                <p className="text-xs text-gray-500">{adminInfo.email}</p>
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
