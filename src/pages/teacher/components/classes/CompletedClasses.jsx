import React from "react";

export default function CompletedClasses({ classes }) {
  const completed = classes.filter((cls) => cls.status === "completed");

  if (completed.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow">
        <h3 className="text-lg font-semibold mb-4">Completed Classes</h3>
        <p className="text-gray-500 text-sm">No completed classes yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow">
      <h3 className="text-lg font-semibold mb-4">Completed Classes</h3>
      <ul className="divide-y">
        {completed.map((cls) => (
          <li key={cls.id} className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-base font-medium text-gray-800">
                  {cls.title}
                </h4>

                <p className="text-sm text-gray-600">
                  Topic: {cls.topic}
                </p>
                <p className="text-xs text-gray-500">
                  Time: {new Date(cls.time).toLocaleString()}
                </p>

                {cls.duration && (
                  <p className="text-xs text-gray-500">
                    Duration: {cls.duration} mins
                  </p>
                )}

                {cls.students?.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Students:{" "}
                    {cls.students
                      .map((s) =>
                        typeof s === "object" && s.name ? s.name : s
                      )
                      .join(", ")}
                  </p>
                )}
              </div>

              <span className="mt-2 sm:mt-0 px-3 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                Completed
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
