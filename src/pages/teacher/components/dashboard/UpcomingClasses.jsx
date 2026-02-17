// src/pages/teacher/components/dashboard/UpcomingClasses.jsx
import React, { useState } from "react";
import { Calendar, Clock, Users, Video, Trash2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

export default function UpcomingClasses({ classes, onCancel, onDelete, isDarkMode }) {
  const [showAll, setShowAll] = useState(false);
  
  if (!classes || classes.length === 0) {
    return (
      <div className={`${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } rounded-2xl border shadow-lg p-12 text-center`}>
        <Calendar className={`w-16 h-16 mx-auto mb-4 ${
          isDarkMode ? 'text-gray-600' : 'text-gray-300'
        }`} />
        <h3 className={`text-xl font-semibold mb-2 ${
          isDarkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          No Upcoming Classes
        </h3>
        <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Accept booking requests or create new classes to get started
        </p>
      </div>
    );
  }

  // Sort by scheduled time
  const sortedClasses = [...classes].sort((a, b) => 
    new Date(a.scheduledTime) - new Date(b.scheduledTime)
  );

  // Show first 3 or all
  const displayClasses = showAll ? sortedClasses : sortedClasses.slice(0, 3);
  const hasMore = sortedClasses.length > 3;

  // Separate upcoming soon from scheduled
  const upcomingSoon = sortedClasses.filter(c => c.status === 'upcoming-soon');
  const scheduled = sortedClasses.filter(c => c.status === 'scheduled');

  return (
    <div className={`${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    } rounded-2xl border shadow-xl overflow-hidden`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${
              isDarkMode ? 'bg-white/20' : 'bg-white/30'
            } backdrop-blur-sm p-3 rounded-xl`}>
              <Calendar className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Upcoming Classes
                <span className="text-sm font-normal bg-white/20 px-3 py-1 rounded-full">
                  {classes.length}
                </span>
              </h2>
              <p className="text-white/90 text-sm">
                {upcomingSoon.length > 0 && (
                  <span className="font-semibold">{upcomingSoon.length} starting soon</span>
                )}
                {upcomingSoon.length > 0 && scheduled.length > 0 && ' • '}
                {scheduled.length > 0 && (
                  <span>{scheduled.length} scheduled</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Classes List */}
      <div className="p-6 space-y-4">
        {/* Upcoming Soon Alert */}
        {upcomingSoon.length > 0 && (
          <div className={`${
            isDarkMode ? 'bg-yellow-900/30 border-yellow-800' : 'bg-yellow-50 border-yellow-200'
          } border-2 rounded-xl p-4`}>
            <div className="flex items-center gap-3">
              <AlertCircle className={`w-5 h-5 ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
              }`} />
              <div>
                <p className={`font-semibold ${
                  isDarkMode ? 'text-yellow-400' : 'text-yellow-700'
                }`}>
                  {upcomingSoon.length} {upcomingSoon.length === 1 ? 'class' : 'classes'} starting within 15 minutes!
                </p>
                <p className={`text-sm ${
                  isDarkMode ? 'text-yellow-500' : 'text-yellow-600'
                }`}>
                  Get ready to join
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Class Cards */}
        {displayClasses.map((classItem, index) => {
          const isUpcomingSoon = classItem.status === 'upcoming-soon';
          const scheduledDate = new Date(classItem.scheduledTime);
          const now = new Date();
          const timeUntil = Math.floor((scheduledDate - now) / 1000 / 60); // minutes

          return (
            <div
              key={classItem.id}
              className={`${
                isDarkMode 
                  ? isUpcomingSoon
                    ? 'bg-yellow-900/20 border-yellow-800'
                    : 'bg-gray-750 border-gray-700'
                  : isUpcomingSoon
                    ? 'bg-yellow-50 border-yellow-300'
                    : 'bg-gray-50 border-gray-200'
              } border-2 rounded-xl p-5 hover:shadow-lg transition-all duration-300 group`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Class Info */}
                <div className="flex-1 min-w-0">
                  {/* Title and Time Until */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className={`text-lg font-bold mb-1 ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {classItem.title}
                      </h3>
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {classItem.topic}
                      </p>
                    </div>
                    
                    {/* Status Badge */}
                    {isUpcomingSoon && (
                      <span className={`${
                        isDarkMode 
                          ? 'bg-yellow-900/50 text-yellow-400 border-yellow-800' 
                          : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                      } px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 animate-pulse`}>
                        <Clock className="w-3 h-3" />
                        {timeUntil} min
                      </span>
                    )}
                  </div>

                  {/* Meta Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`${
                        isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'
                      } p-2 rounded-lg`}>
                        <Calendar className={`w-4 h-4 ${
                          isDarkMode ? 'text-blue-400' : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <p className={`text-xs ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          Date
                        </p>
                        <p className={`text-sm font-semibold ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {classItem.date}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`${
                        isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100'
                      } p-2 rounded-lg`}>
                        <Clock className={`w-4 h-4 ${
                          isDarkMode ? 'text-purple-400' : 'text-purple-600'
                        }`} />
                      </div>
                      <div>
                        <p className={`text-xs ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          Time
                        </p>
                        <p className={`text-sm font-semibold ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {classItem.time}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`${
                        isDarkMode ? 'bg-green-900/30' : 'bg-green-100'
                      } p-2 rounded-lg`}>
                        <Users className={`w-4 h-4 ${
                          isDarkMode ? 'text-green-400' : 'text-green-600'
                        }`} />
                      </div>
                      <div>
                        <p className={`text-xs ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          Students
                        </p>
                        <p className={`text-sm font-semibold ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {classItem.students.length}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Student Names */}
                  <div className="flex flex-wrap gap-2">
                    {classItem.students.map((student, idx) => (
                      <span
                        key={idx}
                        className={`${
                          isDarkMode 
                            ? 'bg-gray-700 text-gray-300' 
                            : 'bg-white text-gray-700 border border-gray-300'
                        } px-3 py-1 rounded-lg text-sm font-medium`}
                      >
                        {student}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => onCancel && onCancel(classItem.id)}
                    className={`${
                      isUpcomingSoon
                        ? 'bg-yellow-500 hover:bg-yellow-600'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl group-hover:scale-105`}
                  >
                    <Video className="w-5 h-5" />
                    <span className="hidden sm:inline">Start</span>
                  </button>
                  <button
                    onClick={() => onDelete && onDelete(classItem)}
                    className={`${
                      isDarkMode
                        ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400'
                        : 'bg-red-50 hover:bg-red-100 text-red-600'
                    } px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Show More/Less Button */}
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className={`w-full ${
              isDarkMode 
                ? 'bg-gray-750 hover:bg-gray-700 text-gray-300 border-gray-700' 
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
            } border-2 rounded-xl py-3 font-semibold transition-all duration-200 flex items-center justify-center gap-2`}
          >
            {showAll ? (
              <>
                <ChevronUp className="w-5 h-5" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-5 h-5" />
                Show All ({sortedClasses.length - 3} more)
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
