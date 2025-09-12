import React from "react";

const Header = () => {
  return (
    <header className="bg-white shadow-sm p-4 mb-6 flex justify-between items-center">
      <h1 className="text-xl font-bold text-purple-700">Admin Dashboard</h1>
      <div className="flex items-center space-x-4">
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
