// src/pages/admin/components/StudentTable.jsx
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
  onUnmarkLesson,   // ← NEW
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
            students.map((s) => (
              <tr key={s._id} className="hover:bg-gray-50">
                <td className="border p-2">{s.firstName}</td>
                <td className="border p-2">{s.surname}</td>
                <td className="border p-2">{s.email}</td>

                {/* Password column */}
                <td className="border p-2">
                  {s.showTempPassword && s.tempPassword ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">
                        {s.tempPassword}
                      </span>
                      <button
                        onClick={() => onCopyPassword(s._id)}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <span className="italic text-gray-400 text-sm">••••••••</span>
                  )}
                  <div className="mt-1">
                    <button
                      onClick={() => onResetPassword(s._id)}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Reset Password
                    </button>
                  </div>
                </td>

                {/* Classes */}
                <td className="border p-2 text-center">{s.noOfClasses ?? 0}</td>

                {/* Actions */}
                <td className="border p-2">
                  <div className="flex flex-wrap gap-2">

                    {/* ✅ Mark Lesson */}
                    <button
                      onClick={() => onMarkLesson(s._id)}
                      className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs"
                    >
                      ✅ Mark Lesson
                    </button>

                    {/* ✅ NEW: Unmark Lesson */}
                    <button
                      onClick={() => onUnmarkLesson(s._id)}
                      className="px-2 py-1 bg-rose-600 text-white rounded hover:bg-rose-700 text-xs"
                    >
                      ⚠️ Unmark Lesson
                    </button>

                    <button
                      onClick={() => onManualPayment(s._id)}
                      className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                    >
                      Manual Payment
                    </button>

                    <button
                      onClick={() => onViewPayment(s._id)}
                      className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs"
                    >
                      View Payment
                    </button>

                    <button
                      onClick={() => onViewLessons(s._id)}
                      className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                    >
                      View Lessons
                    </button>

                    <button
                      onClick={() => onEdit(s._id)}
                      className="px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-xs"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => onDelete(s._id)}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                    >
                      Delete
                    </button>

                    <button
                      onClick={() => onToggle(s._id, !s.active)}
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
