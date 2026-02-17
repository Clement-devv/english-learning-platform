// src/pages/teacher/components/dashboard/LiveClasses.jsx
import React from "react";
import { Video, Users, Clock, ArrowRight, Radio } from "lucide-react";

export default function LiveClasses({ classes, onJoin, isDarkMode }) {
  if (!classes || classes.length === 0) {
    return null; // Don't show section if no live classes
  }

  return (
    <div className={`${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    } rounded-2xl border shadow-xl overflow-hidden`}>
      {/* Header with animated gradient */}
      <div className="relative bg-gradient-to-r from-red-500 via-pink-500 to-rose-500 p-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-pink-600 animate-pulse opacity-50"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Radio className="w-8 h-8 text-white animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Live Classes
                <span className="text-sm font-normal bg-white/20 px-3 py-1 rounded-full">
                  {classes.length}
                </span>
              </h2>
              <p className="text-white/90 text-sm">Classes happening right now</p>
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-white text-sm font-semibold">LIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Classes List */}
      <div className="p-6 space-y-4">
        {classes.map((classItem) => (
          <div
            key={classItem.id}
            className={`${
              isDarkMode 
                ? 'bg-gradient-to-r from-red-900/30 to-pink-900/30 border-red-800' 
                : 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200'
            } border-2 rounded-xl p-5 shadow-lg hover:shadow-2xl transition-all duration-300 group`}
          >
            <div className="flex items-center justify-between gap-4">
              {/* Left: Class Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 mb-3">
                  {/* Pulsing Live Indicator */}
                  <div className="flex-shrink-0 mt-1">
                    <div className="relative">
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className={`text-xl font-bold mb-1 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {classItem.title}
                    </h3>
                    <p className={`text-sm mb-3 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {classItem.topic}
                    </p>

                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${
                          isDarkMode ? 'text-red-400' : 'text-red-600'
                        }`} />
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          Started at {classItem.time}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className={`w-4 h-4 ${
                          isDarkMode ? 'text-red-400' : 'text-red-600'
                        }`} />
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          {classItem.students.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Join Button */}
              <button
                onClick={() => onJoin(classItem)}
                className="flex-shrink-0 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-2xl transition-all duration-300 flex items-center gap-3 group-hover:scale-105 animate-pulse"
              >
                <Video className="w-6 h-6" />
                <span className="hidden sm:inline">Join Now</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
