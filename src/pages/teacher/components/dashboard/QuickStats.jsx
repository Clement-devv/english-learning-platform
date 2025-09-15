import React from "react";
import { motion } from "framer-motion";
import { Users, BookOpen, Calendar } from "lucide-react";

export default function QuickStats({ stats }) {
  const items = [
    {
      label: "Students",
      value: stats.totalStudents,
      icon: Users,
      color: "bg-blue-50 text-blue-700",
    },
    {
      label: "Classes",
      value: stats.totalClasses,
      icon: BookOpen,
      color: "bg-green-50 text-green-700",
    },
    {
      label: "Bookings",
      value: stats.totalBookings,
      icon: Calendar,
      color: "bg-purple-50 text-purple-700",
    },
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {items.map((item, idx) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.15, duration: 0.4 }}
          className="flex items-center p-5 bg-white rounded-2xl shadow hover:shadow-lg transition-shadow"
        >
          <div
            className={`w-12 h-12 flex items-center justify-center rounded-xl ${item.color}`}
          >
            <item.icon className="w-6 h-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-500">{item.label}</p>
            <p className="text-2xl font-bold">{item.value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
