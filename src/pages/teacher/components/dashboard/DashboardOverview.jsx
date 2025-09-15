import React from "react";

export default function DashboardOverview({ stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((item) => (
        <div
          key={item.label}
          className="bg-white shadow rounded-xl p-4 flex flex-col items-center"
        >
          <div className="text-3xl font-bold text-blue-600">{item.value}</div>
          <p className="text-gray-600 mt-1">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
