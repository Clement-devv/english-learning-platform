import React from "react";
import { motion } from "framer-motion";
import { Video } from "lucide-react";

export default function ClassItem({ item, onJoin }) {
  const getBadgeClasses = (status) => {
    switch (status) {
      case "live":
        return "bg-green-100 text-green-700";
      case "scheduled":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      className="relative bg-white rounded-xl shadow p-4 flex items-center justify-between cursor-pointer"
    >
      {/* Status badge */}
      <span
        className={`absolute top-3 right-3 px-2 py-0.5 text-xs font-medium rounded-full ${getBadgeClasses(
          item.status
        )}`}
      >
        {item.status || "unknown"}
      </span>

      <div>
        <h3 className="font-semibold text-gray-800">{item.title}</h3>
        <p className="text-sm text-gray-600">{item.topic}</p>

        <p className="text-xs text-gray-500">
          Time:{" "}
          {item.time
            ? new Date(item.time).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "No time"}
        </p>

        {item.duration && (
          <p className="text-xs text-gray-500">
            Duration: {item.duration} mins
          </p>
        )}

        {item.students && item.students.length > 0 ? (
          <p className="mt-1 text-xs text-gray-600">
            <strong>Students:</strong>{" "}
            {item.students
              .map((st) =>
                typeof st === "string" || typeof st === "number" ? st : st.name
              )
              .join(", ")}
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-400 italic">
            No students assigned
          </p>
        )}
      </div>

      {/* ✅ Start button now triggers onJoin */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onJoin(item)} // 🔥 this connects to TeacherDashboard
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2"
      >
        <Video className="w-4 h-4" />
        <span>Start</span>
      </motion.button>
    </motion.div>
  );
}
