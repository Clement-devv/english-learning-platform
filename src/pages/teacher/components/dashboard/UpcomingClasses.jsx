import React from "react";

export default function UpcomingClasses({ classes, onCancel, onDelete }) {
  const formatTime = (value) =>
    new Date(value).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="bg-white rounded-xl p-6 shadow">
      <h3 className="text-lg font-semibold mb-4">Upcoming Classes</h3>

      {classes.length === 0 && (
        <p className="text-gray-500 text-sm">No classes scheduled</p>
      )}

      <ul className="divide-y">
        {classes.map((cls) => (
          <li key={cls.id} className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-base font-medium text-gray-800">
                  {cls.title}
                  {cls.status === "cancelled" && (
                    <span className="ml-2 text-xs text-red-600 font-semibold">
                      (Cancelled)
                    </span>
                  )}
                </h4>

                <p className="text-sm text-gray-600">
                  Topic: {cls.topic} | Time: {formatTime(cls.time)}
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
              </div>

              <div className="mt-3 sm:mt-0 flex gap-2">
                <button
                  onClick={() => onCancel(cls.id)}
                  className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onDelete(cls.id)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
