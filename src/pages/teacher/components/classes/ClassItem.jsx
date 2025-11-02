// src/pages/teacher/components/classes/ClassItem.jsx - FIXED
import React from "react";
import { motion } from "framer-motion";
import { Video, Calendar, Clock, Users, Trash2 } from "lucide-react";

export default function ClassItem({ item, onJoin, onDelete }) {
  const getBadgeClasses = (status) => {
    switch (status) {
      case "live":
        return "bg-green-100 text-green-700";
      case "scheduled":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-gray-100 text-gray-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  //  date formatting
  const formatDateTime = () => {
    try {
      // Try multiple date sources
      const dateSource = item.scheduledTime || item.scheduledDate || item.time;
      
      if (!dateSource) {
        return "No time set";
      }

      const date = new Date(dateSource);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }

      return date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error("Date formatting error:", error);
      return "Date unavailable";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.01 }}
      className="relative bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-6 border border-gray-100"
    >
      {/* Status badge */}
      <span
        className={`absolute top-4 right-4 px-3 py-1 text-xs font-semibold rounded-full ${getBadgeClasses(
          item.status
        )}`}
      >
        {item.status || "unknown"}
      </span>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-xl text-gray-800 mb-2">{item.title}</h3>
          <p className="text-sm text-gray-600 mb-3">
            <span className="font-medium">Topic:</span> {item.topic}
          </p>

          <div className="space-y-2">
            {/* ✅ FIXED: Date/Time display */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span>{formatDateTime()}</span>
            </div>

            {item.duration && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-green-500" />
                <span>{item.duration} minutes</span>
              </div>
            )}

            {item.students && item.students.length > 0 ? (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4 text-purple-500 mt-0.5" />
                <span>
                  <strong>Students:</strong>{" "}
                  {item.students
                    .map((st) =>
                      typeof st === "string" || typeof st === "number" ? st : st.name
                    )
                    .join(", ")}
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic flex items-center gap-2">
                <Users className="w-4 h-4" />
                No students assigned
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 items-center">
          {/* ✅ FIXED: Add delete button for cancelled classes */}
          {item.status === "cancelled" && onDelete && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onDelete(item)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 transition-colors"
              title="Delete cancelled class"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </motion.button>
          )}

          {/* Start button for scheduled/live classes */}
          {item.status !== "cancelled" && item.status !== "completed" && onJoin && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onJoin(item)}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 flex items-center gap-2 shadow-md transition-all"
            >
              <Video className="w-4 h-4" />
              <span className="font-medium">Start Class</span>
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
