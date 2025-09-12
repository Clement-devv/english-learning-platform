import React from "react";

export default function StudentTable({
  students,
  onEdit,
  onDelete,
  onToggle,
  onManualPayment,
  onViewPayment,
  onViewLessons,
  onMarkLesson,
  onCopyPassword,
  onResetPassword,
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="border p-2">First Name</th>
            <th className="border p-2">Surname</th>
            <th className="border p-2">Email</th>
            <th className="border p-2">Password</th>
            <th className="border p-2">No. of Classes</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center p-4 text-gray-500">
                No students found
              </td>
            </tr>
          ) : (
            students.map((s, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border p-2">{s.firstName}</td>
                <td className="border p-2">{s.surname}</td>
                <td className="border p-2">{s.email}</td>

                {/* Password column */}
                <td className="border p-2">
                  {s.showTempPassword ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                        {s.password}
                      </span>
                      <button
                        onClick={() => onCopyPassword(i)}
                        className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <span className="italic text-gray-500 text-sm">
                      (Password hidden)
                    </span>
                  )}

                  <div className="mt-1">
                    <button
                      onClick={() => onResetPassword(i)}
                      className="px-2 py-1 text-xs bg-red-200 text-red-700 rounded hover:bg-red-300"
                    >
                      Reset Password
                    </button>
                  </div>
                </td>

                {/* Classes */}
                <td className="border p-2 text-center">
                  {s.noOfClasses ?? 0}
                </td>

                {/* Actions */}
                <td className="border p-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onMarkLesson(i)}
                      className="px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs"
                    >
                      Mark Lesson
                    </button>

                    <button
                      onClick={() => onManualPayment(i)}
                      className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                    >
                      Manual Payment
                    </button>

                    <button
                      onClick={() => onViewPayment(i)}
                      className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs"
                    >
                      View Payment
                    </button>

                    <button
                      onClick={() => onViewLessons(i)}
                      className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                    >
                      View Lessons
                    </button>

                    <button
                      onClick={() => onEdit(i)}
                      className="px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-xs"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => onDelete(i)}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                    >
                      Delete
                    </button>

                    <button
                      onClick={() => onToggle(i)}
                      className={`px-2 py-1 text-xs rounded text-white ${
                        s.active
                          ? "bg-gray-500 hover:bg-gray-600"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {s.active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
