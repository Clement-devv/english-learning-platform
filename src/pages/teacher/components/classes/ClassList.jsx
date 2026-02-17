// src/pages/teacher/components/classes/ClassList.jsx
import React, { useState } from "react";
import { Calendar, Clock, Trash2, Users, ChevronRight, Video, Grid, List, CalendarDays, MoreVertical } from "lucide-react";

export default function ClassList({ data, onJoin, onDelete, isDarkMode }) {
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar', 'list', 'grid'
  const [selectedWeek, setSelectedWeek] = useState(0); // 0 = current week, 1 = next week, etc.

  // Group classes by date
  const groupedByDate = data.reduce((acc, classItem) => {
    const date = new Date(classItem.scheduledTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(classItem);
    return acc;
  }, {});

  // Sort dates
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
    return new Date(groupedByDate[a][0].scheduledTime) - new Date(groupedByDate[b][0].scheduledTime);
  });

  // Get classes for current week
  const getWeekClasses = (weekOffset = 0) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    
    return data.filter(c => {
      const classDate = new Date(c.scheduledTime);
      return classDate >= startOfWeek && classDate < endOfWeek;
    });
  };

  const weekClasses = getWeekClasses(selectedWeek);

  // View Mode Selector
  const ViewModeSelector = () => (
    <div className={`flex gap-2 mb-6 p-1 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg w-fit`}>
      <button
        onClick={() => setViewMode('calendar')}
        className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all ${
          viewMode === 'calendar'
            ? isDarkMode 
              ? 'bg-blue-600 text-white shadow-lg' 
              : 'bg-white text-blue-600 shadow-md'
            : isDarkMode
              ? 'text-gray-400 hover:text-gray-200'
              : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <CalendarDays className="w-4 h-4" />
        Calendar
      </button>
      <button
        onClick={() => setViewMode('list')}
        className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all ${
          viewMode === 'list'
            ? isDarkMode 
              ? 'bg-blue-600 text-white shadow-lg' 
              : 'bg-white text-blue-600 shadow-md'
            : isDarkMode
              ? 'text-gray-400 hover:text-gray-200'
              : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <List className="w-4 h-4" />
        List
      </button>
      <button
        onClick={() => setViewMode('grid')}
        className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all ${
          viewMode === 'grid'
            ? isDarkMode 
              ? 'bg-blue-600 text-white shadow-lg' 
              : 'bg-white text-blue-600 shadow-md'
            : isDarkMode
              ? 'text-gray-400 hover:text-gray-200'
              : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Grid className="w-4 h-4" />
        Cards
      </button>
    </div>
  );

  // Status Badge Component
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      'live': { bg: 'bg-green-100', text: 'text-green-700', darkBg: 'bg-green-900/30', darkText: 'text-green-400', label: 'Live Now', pulse: true },
      'upcoming-soon': { bg: 'bg-yellow-100', text: 'text-yellow-700', darkBg: 'bg-yellow-900/30', darkText: 'text-yellow-400', label: 'Starting Soon', pulse: true },
      'scheduled': { bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'bg-blue-900/30', darkText: 'text-blue-400', label: 'Scheduled', pulse: false }
    };

    const config = statusConfig[status] || statusConfig['scheduled'];

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
        isDarkMode ? `${config.darkBg} ${config.darkText}` : `${config.bg} ${config.text}`
      }`}>
        {config.pulse && <span className="w-2 h-2 bg-current rounded-full animate-pulse"></span>}
        {config.label}
      </span>
    );
  };

  // Calendar View
  const CalendarView = () => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (selectedWeek * 7));
    
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekDays = daysOfWeek.map((day, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return { day, date, classes: [] };
    });

    // Distribute classes into days
    weekClasses.forEach(classItem => {
      const classDate = new Date(classItem.scheduledTime);
      const dayIndex = classDate.getDay();
      weekDays[dayIndex].classes.push(classItem);
    });

    return (
      <div className="space-y-4">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSelectedWeek(selectedWeek - 1)}
            className={`px-4 py-2 rounded-lg ${
              isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border'
            } transition-colors`}
          >
            ← Previous Week
          </button>
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {selectedWeek === 0 ? 'This Week' : selectedWeek === 1 ? 'Next Week' : `Week of ${weekStart.toLocaleDateString()}`}
          </h3>
          <button
            onClick={() => setSelectedWeek(selectedWeek + 1)}
            className={`px-4 py-2 rounded-lg ${
              isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border'
            } transition-colors`}
          >
            Next Week →
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((dayData, index) => {
            const isToday = dayData.date.toDateString() === new Date().toDateString();
            
            return (
              <div
                key={index}
                className={`${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                } border rounded-lg p-3 min-h-[200px]`}
              >
                {/* Day Header */}
                <div className={`text-center mb-3 pb-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <p className={`text-sm font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {dayData.day}
                  </p>
                  <p className={`text-2xl font-bold ${
                    isToday 
                      ? 'text-blue-600' 
                      : isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {dayData.date.getDate()}
                  </p>
                  {isToday && (
                    <span className="text-xs text-blue-600 font-semibold">Today</span>
                  )}
                </div>

                {/* Classes for this day */}
                <div className="space-y-2">
                  {dayData.classes.length === 0 ? (
                    <p className={`text-xs text-center ${isDarkMode ? 'text-gray-600' : 'text-gray-400'} mt-4`}>
                      No classes
                    </p>
                  ) : (
                    dayData.classes.map(classItem => (
                      <div
                        key={classItem.id}
                        className={`${
                          isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-blue-50 hover:bg-blue-100'
                        } rounded-lg p-2 cursor-pointer transition-all border-l-4 ${
                          classItem.status === 'live' ? 'border-green-500' :
                          classItem.status === 'upcoming-soon' ? 'border-yellow-500' :
                          'border-blue-500'
                        }`}
                        onClick={() => onJoin(classItem)}
                      >
                        <p className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-1 truncate`}>
                          {classItem.title}
                        </p>
                        <div className="flex items-center gap-1 text-xs">
                          <Clock className={`w-3 h-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                            {classItem.time}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs mt-1">
                          <Users className={`w-3 h-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                            {classItem.students.length}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {weekClasses.length === 0 && (
          <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No classes scheduled for this week</p>
          </div>
        )}
      </div>
    );
  };

  // List View (Grouped by Date)
  const ListView = () => (
    <div className="space-y-6">
      {sortedDates.length === 0 ? (
        <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No classes scheduled</p>
        </div>
      ) : (
        sortedDates.map(date => (
          <div key={date} className="space-y-3">
            {/* Date Header */}
            <div className={`sticky top-0 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} px-4 py-3 rounded-lg border-l-4 border-blue-500 z-10`}>
              <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {date}
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {groupedByDate[date].length} {groupedByDate[date].length === 1 ? 'class' : 'classes'}
              </p>
            </div>

            {/* Classes for this date */}
            <div className="space-y-3">
              {groupedByDate[date]
                .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
                .map(classItem => (
                  <div
                    key={classItem.id}
                    className={`${
                      isDarkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:shadow-lg'
                    } rounded-xl p-5 shadow-md transition-all duration-300 border ${
                      isDarkMode ? 'border-gray-700' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      {/* Left: Class Info */}
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`w-12 h-12 rounded-lg ${
                            classItem.status === 'live' ? 'bg-green-500' :
                            classItem.status === 'upcoming-soon' ? 'bg-yellow-500' :
                            'bg-blue-500'
                          } flex items-center justify-center text-white font-bold text-lg`}>
                            {classItem.time.split(':')[0]}
                          </div>
                          <div className="flex-1">
                            <h4 className={`font-bold text-lg mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {classItem.title}
                            </h4>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                              {classItem.topic}
                            </p>
                            <div className="flex flex-wrap gap-3 text-sm">
                              <div className="flex items-center gap-1">
                                <Clock className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                                  {classItem.time} ({classItem.duration} min)
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                                  {classItem.students.join(', ')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <StatusBadge status={classItem.status} />
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => onJoin(classItem)}
                          className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                            classItem.status === 'live'
                              ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg'
                              : classItem.status === 'upcoming-soon'
                                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                : isDarkMode
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          <Video className="w-4 h-4" />
                          {classItem.status === 'live' ? 'Join Now' : 'Start'}
                        </button>
                        <button
                          onClick={() => onDelete(classItem)}
                          className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                            isDarkMode
                              ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400'
                              : 'bg-red-50 hover:bg-red-100 text-red-600'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );

  // Grid View (Cards)
  const GridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {data.length === 0 ? (
        <div className="col-span-full text-center py-12">
          <Calendar className={`w-16 h-16 mx-auto mb-4 opacity-50 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
          <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No classes scheduled</p>
        </div>
      ) : (
        data
          .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
          .map(classItem => (
            <div
              key={classItem.id}
              className={`${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              } rounded-xl border shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group`}
            >
              {/* Header with gradient */}
              <div className={`p-4 ${
                classItem.status === 'live' 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                  : classItem.status === 'upcoming-soon'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-600'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600'
              } text-white`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg mb-1">{classItem.title}</h3>
                    <p className="text-sm opacity-90">{classItem.topic}</p>
                  </div>
                  <StatusBadge status={classItem.status} />
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3">
                {/* Date and Time */}
                <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Calendar className="w-4 h-4" />
                  <span>{classItem.date}</span>
                </div>
                <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Clock className="w-4 h-4" />
                  <span>{classItem.time} • {classItem.duration} minutes</span>
                </div>

                {/* Students */}
                <div className={`flex items-start gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Users className="w-4 h-4 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium mb-1">Students:</p>
                    <div className="flex flex-wrap gap-1">
                      {classItem.students.map((student, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-1 rounded-full text-xs ${
                            isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {student}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className={`p-4 ${isDarkMode ? 'bg-gray-750 border-t border-gray-700' : 'bg-gray-50 border-t'} flex gap-2`}>
                <button
                  onClick={() => onJoin(classItem)}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    classItem.status === 'live'
                      ? 'bg-green-500 hover:bg-green-600 text-white animate-pulse'
                      : classItem.status === 'upcoming-soon'
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  {classItem.status === 'live' ? 'Join Now!' : 'Start Class'}
                </button>
                <button
                  onClick={() => onDelete(classItem)}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    isDarkMode
                      ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400'
                      : 'bg-red-50 hover:bg-red-100 text-red-600'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
      )}
    </div>
  );

  return (
    <div>
      <ViewModeSelector />
      
      {viewMode === 'calendar' && <CalendarView />}
      {viewMode === 'list' && <ListView />}
      {viewMode === 'grid' && <GridView />}
    </div>
  );
}
