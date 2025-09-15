import React from "react";
import { motion } from "framer-motion";

export default function LiveClasses({ classes }) {
  const live = classes.filter((c) => c.status === "live");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-2xl shadow p-6"
    >
      <h3 className="text-lg font-semibold text-emerald-600 mb-4">
        🔴 Live Classes
      </h3>
      {live.length === 0 ? (
        <p className="text-gray-400 text-sm text-center">No live classes now.</p>
      ) : (
        <div className="space-y-3">
          {live.map((cls, i) => (
            <motion.div
              key={cls.id}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-800">{cls.title}</p>
                <p className="text-xs text-gray-500">{cls.topic}</p>
              </div>
              <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                {cls.time}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
