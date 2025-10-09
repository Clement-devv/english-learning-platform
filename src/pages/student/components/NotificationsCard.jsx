// src/pages/student/Notifications.jsx
export default function Notifications({ notifications }) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">
        🔔 Notifications
      </h3>
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {notifications.map((note) => (
          <div
            key={note.id}
            className={`p-3 rounded-lg border ${
              note.unread
                ? "border-indigo-300 bg-indigo-50"
                : "border-gray-100 bg-gray-50"
            }`}
          >
            <p className="text-sm text-gray-700">{note.message}</p>
            <span className="text-xs text-gray-500">{note.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
