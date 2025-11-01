// src/pages/teacher/components/dashboard/UpcomingClasses.jsx
import React from "react";
import { Bell } from "lucide-react";

export default function UpcomingClasses({ classes, onCancel, onDelete }) {
  const formatTime = (value) =>
    new Date(value).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  // Check if class is starting soon (within 15 minutes)
  const isStartingSoon = (cls) => {
    if (!cls.scheduledDate) return false;
    const now = new Date();
    const timeDiff = cls.scheduledDate - now;
    return timeDiff > 0 && timeDiff < 900000; // 15 minutes in milliseconds
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow">
      <h3 className="text-lg font-semibold mb-4">Upcoming Classes</h3>

      {classes.length === 0 && (
        <p className="text-gray-500 text-sm">No classes scheduled</p>
      )}

      <ul className="divide-y">
        {classes.map((cls) => {
          const startingSoon = isStartingSoon(cls);
          
          return (
            <li 
              key={cls.id} 
              className={`py-4 ${
                startingSoon 
                  ? 'bg-yellow-50 border-l-4 border-yellow-400 pl-4 -ml-4 animate-pulse' 
                  : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {/* Title with blinking indicator */}
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-medium text-gray-800">
                      {cls.title}
                      {cls.status === "cancelled" && (
                        <span className="ml-2 text-xs text-red-600 font-semibold">
                          (Cancelled)
                        </span>
                      )}
                    </h4>
                    {startingSoon && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold animate-bounce">
                        <Bell className="w-3 h-3" />
                        STARTING SOON!
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mt-1">
                    Topic: {cls.topic} | Time: {cls.fullDateTime || formatTime(cls.scheduledTime)}
                  </p>

                  {cls.duration && (
                    <p className="text-xs text-gray-500">
                      Duration: {cls.duration} mins
                    </p>
                  )}

                  {cls.students && cls.students.length > 0 ? (
                    <p className="text-xs text-gray-500">
                      Students:{" "}
                      {cls.students
                        .map((s) =>
                          typeof s === "object" && s.name ? s.name : s
                        )
                        .join(", ")}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      No students assigned
                    </p>
                  )}

                  {/* Time remaining indicator for upcoming classes */}
                  {startingSoon && (
                    <p className="text-sm font-semibold text-yellow-700 mt-2 flex items-center gap-1">
                      <Bell className="w-4 h-4 animate-ping" />
                      Class starts in less than 15 minutes!
                    </p>
                  )}
                </div>

                <div className="mt-3 sm:mt-0 flex gap-2">
                  <button
                    onClick={() => onCancel(cls.id)}
                    className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onDelete(cls.id)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* CSS for blinking animation */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        @keyframes ping {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          75%, 100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .animate-bounce {
          animation: bounce 1s ease-in-out infinite;
        }

        .animate-ping {
          animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
}
