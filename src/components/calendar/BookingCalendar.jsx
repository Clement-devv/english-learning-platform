// src/components/calendar/BookingCalendar.jsx - CALENDAR VIEW FOR BOOKINGS
import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from "lucide-react";

/**
 * BookingCalendar Component
 * 
 * Displays bookings in a monthly calendar view with color-coded statuses
 * 
 * Props:
 * @param {Array} bookings - Array of booking objects
 * @param {Function} onBookingClick - Callback when booking is clicked
 * @param {Function} onDateClick - Callback when empty date is clicked (for creating new booking)
 * @param {boolean} allowCreate - Whether to allow creating bookings by clicking dates
 */
export default function BookingCalendar({ 
  bookings = [], 
  onBookingClick, 
  onDateClick,
  allowCreate = false
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month"); // month, week, day
  const [selectedDate, setSelectedDate] = useState(null);

  // Get calendar data
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  /**
   * Get days in month with booking data
   */
  const getCalendarDays = () => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty days for previous month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split('T')[0];
      
      // Find bookings for this day
      const dayBookings = bookings.filter(booking => {
        const bookingDate = new Date(booking.scheduledTime);
        return bookingDate.toISOString().split('T')[0] === dateString;
      });

      days.push({
        day,
        date,
        dateString,
        bookings: dayBookings,
        isToday: isToday(date),
        isSelected: selectedDate && selectedDate.toDateString() === date.toDateString()
      });
    }

    return days;
  };

  /**
   * Check if date is today
   */
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  /**
   * Navigate to previous month
   */
  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  /**
   * Navigate to next month
   */
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  /**
   * Go to today
   */
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  /**
   * Handle date click
   */
  const handleDateClick = (dayData) => {
    if (!dayData) return;

    setSelectedDate(dayData.date);

    if (dayData.bookings.length > 0) {
      // If bookings exist, show them
      if (onBookingClick) {
        onBookingClick(dayData.bookings[0]); // Click first booking
      }
    } else if (allowCreate && onDateClick) {
      // If no bookings and creation is allowed
      onDateClick(dayData.date);
    }
  };

  /**
   * Get status color
   */
  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      accepted: "bg-green-100 text-green-800 border-green-300",
      completed: "bg-blue-100 text-blue-800 border-blue-300",
      rejected: "bg-red-100 text-red-800 border-red-300",
      cancelled: "bg-gray-100 text-gray-800 border-gray-300"
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  /**
   * Render booking badge
   */
  const renderBookingBadge = (booking, index) => {
    const time = new Date(booking.scheduledTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return (
      <div
        key={booking._id || index}
        onClick={(e) => {
          e.stopPropagation();
          if (onBookingClick) onBookingClick(booking);
        }}
        className={`text-xs p-1 mb-1 rounded border cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(booking.status)}`}
        title={`${time} - ${booking.classTitle}`}
      >
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span className="font-medium truncate">{time}</span>
        </div>
        <div className="truncate font-semibold">{booking.classTitle}</div>
      </div>
    );
  };

  const calendarDays = getCalendarDays();

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-800">{monthName}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            Today
          </button>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-white rounded transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-white rounded transition-colors"
              title="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
          <span>Accepted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
          <span>Rejected</span>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((dayData, index) => {
          if (!dayData) {
            // Empty cell for previous month days
            return <div key={`empty-${index}`} className="min-h-[120px] bg-gray-50 rounded-lg"></div>;
          }

          const hasBookings = dayData.bookings.length > 0;
          const isClickable = hasBookings || allowCreate;

          return (
            <div
              key={dayData.dateString}
              onClick={() => handleDateClick(dayData)}
              className={`min-h-[120px] p-2 border-2 rounded-lg transition-all ${
                dayData.isToday 
                  ? 'border-purple-500 bg-purple-50' 
                  : dayData.isSelected
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } ${isClickable ? 'cursor-pointer' : ''}`}
            >
              {/* Day number */}
              <div className={`text-right font-semibold mb-1 ${
                dayData.isToday ? 'text-purple-600' : 'text-gray-700'
              }`}>
                {dayData.day}
              </div>

              {/* Bookings */}
              <div className="space-y-1 max-h-[80px] overflow-y-auto">
                {dayData.bookings.slice(0, 3).map((booking, idx) => 
                  renderBookingBadge(booking, idx)
                )}
                {dayData.bookings.length > 3 && (
                  <div className="text-xs text-gray-500 text-center font-medium">
                    +{dayData.bookings.length - 3} more
                  </div>
                )}
              </div>

              {/* Empty state for create */}
              {!hasBookings && allowCreate && (
                <div className="text-xs text-gray-400 text-center mt-2 hidden group-hover:block">
                  Click to create
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between text-sm text-gray-600">
          <div>
            <span className="font-semibold">{bookings.length}</span> total bookings this month
          </div>
          <div className="flex gap-4">
            <div>
              <span className="font-semibold">
                {bookings.filter(b => b.status === 'pending').length}
              </span> pending
            </div>
            <div>
              <span className="font-semibold">
                {bookings.filter(b => b.status === 'accepted').length}
              </span> accepted
            </div>
            <div>
              <span className="font-semibold">
                {bookings.filter(b => b.status === 'completed').length}
              </span> completed
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Example usage in parent component:
 * 
 * import BookingCalendar from './components/calendar/BookingCalendar';
 * 
 * function MyDashboard() {
 *   const [bookings, setBookings] = useState([]);
 * 
 *   const handleBookingClick = (booking) => {
 *     console.log('Booking clicked:', booking);
 *     // Open booking details modal
 *   };
 * 
 *   const handleDateClick = (date) => {
 *     console.log('Date clicked:', date);
 *     // Open create booking form with pre-filled date
 *   };
 * 
 *   return (
 *     <BookingCalendar 
 *       bookings={bookings}
 *       onBookingClick={handleBookingClick}
 *       onDateClick={handleDateClick}
 *       allowCreate={userRole === 'admin'}
 *     />
 *   );
 * }
 */
