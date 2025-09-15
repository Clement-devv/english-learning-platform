import React from "react";

export default function BookingCard({ booking, onAccept, onReject }) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-gray-50">
      <div>
        <h4 className="font-semibold text-gray-800 flex items-center gap-2">
          {booking.name}
          {booking.isAdminBooking && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              Admin Request
            </span>
          )}
        </h4>

        <p className="text-sm text-gray-600">
          Class: {booking.classTitle}
        </p>

        <p className="text-xs text-gray-500">
          Time: {booking.time}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAccept(booking)}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          Accept
        </button>
        <button
          onClick={() => onReject(booking)}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
