import React, { useState } from "react";
import { Bell } from "lucide-react";

export default function NotificationsTab({ notifications = [] }) {
  const [filter, setFilter] = useState("");

  const filtered = notifications.filter((n) =>
    filter
      ? new Date(n.date).toISOString().slice(0, 10) === filter
      : true
  );

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Bell className="w-6 h-6 text-purple-600" />
        Notifications
      </h2>

      <input
        type="date"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 border rounded p-2"
      />

      {filtered.length === 0 ? (
        <p className="text-gray-500">No notifications yet.</p>
      ) : (
        <ul className="divide-y">
          {filtered.map((n) => (
            <li key={n.date} className="py-3">
              <p className="text-gray-800">{n.message}</p>
              <span className="text-xs text-gray-500">
                {new Date(n.date).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
