import React from "react";
import { Shield } from 'lucide-react';

const Header = ({ onManageSessions, onLogout }) => {
  return (
    <header className="bg-white shadow-sm p-4 mb-6 flex justify-between items-center">
      <h1 className="text-xl font-bold text-purple-700">Admin Dashboard</h1>
      <div className="flex items-center space-x-4">
        {/* Sessions Button */}
        <button
          onClick={onManageSessions}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
        >
          <Shield className="w-4 h-4" />
          Sessions
        </button>

        {/* Logout Button - ✅ UPDATED STYLING */}
        <button 
          onClick={onLogout}
          className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
        >
          Logout
        </button>

        <span className="text-gray-600">Welcome, Admin</span>
        <img
          src="https://via.placeholder.com/40"
          alt="Logo"
          className="w-10 h-10 rounded-full border"
        />
      </div>
    </header>
  );
};

export default Header;