import React from "react";
import BookingCard from "./BookingCard";

export default function BookingList({ bookings, onAccept, onReject }) {
  if (!bookings || bookings.length === 0) {
    return (
      <p className="text-center text-gray-500 bg-white p-6 rounded shadow">
        No booking requests yet.
      </p>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow divide-y divide-gray-200">
      {bookings.map((b) => (
        <BookingCard
          key={b.id}
          booking={b}
          onAccept={onAccept}
          onReject={onReject}
        />
      ))}
    </div>
  );
}
