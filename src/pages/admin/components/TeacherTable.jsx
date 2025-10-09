import React, { useState } from "react";

export default function TeacherTable({
  teachers,
  onEdit,
  onDelete,
  onToggle,
  onMarkLesson,
  onPay,
  onCopyPassword,
  onResetPassword,
}) {
  const [continentFilter, setContinentFilter] = useState("All");

  const filteredTeachers =
    continentFilter === "All"
      ? teachers
      : teachers.filter((t) => t.continent === continentFilter);

  const totalSalary = filteredTeachers.reduce(
    (acc, t) => acc + (t.earned || 0),
    0
  );

  return (
    <div className="mt-4 overflow-x-auto">
      {/* Continent Filter */}
      <div className="mb-3 flex items-center gap-3">
        <label className="font-medium">Filter by Continent:</label>
        <select
          value={continentFilter}
          onChange={(e) => setContinentFilter(e.target.value)}
          className="border px-3 py-1 rounded shadow-sm"
        >
          <option value="All">All</option>
          <option value="Africa">Africa</option>
          <option value="Asia">Asia</option>
          <option value="Europe">Europe</option>
        </select>
      </div>

      <table className="w-full border-collapse border border-gray-300 shadow-sm text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">First</th>
            <th className="border p-2">Last</th>
            <th className="border p-2">Email</th>
            <th className="border p-2">Rate ($)</th>
            <th className="border p-2">Lessons</th>
            <th className="border p-2">Earned ($)</th>
            <th className="border p-2">Continent</th>
            <th className="border p-2">Password</th>
            <th className="border p-2 w-70">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredTeachers.length === 0 ? (
            <tr>
              <td
                colSpan="9"
                className="text-center p-4 text-gray-500 italic"
              >
                No teachers found
              </td>
            </tr>
          ) : (
            filteredTeachers.map((t, i) => (
              <tr key={i} className="hover:bg-gray-50 transition">
                <td className="border p-2">{t.firstName}</td>
                <td className="border p-2">{t.lastName}</td>
                <td className="border p-2">{t.email}</td>
                <td className="border p-2 text-center">{t.ratePerClass}</td>
                <td className="border p-2 text-center">
                  {t.lessonsCompleted || 0}
                </td>
                <td className="border p-2 text-center">
                  {(t.earned || 0).toFixed(2)}
                </td>
                <td className="border p-2 text-center">
                  {t.continent || "—"}
                </td>
                <td className="border p-2 text-center">
                  {t.showTempPassword ? (
                    <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-xs">
                      {t.password}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic text-xs">Hidden</span>
                  )}
                </td>
                <td className="border p-1">
                  <div className="flex flex-wrap gap-1 justify-center text-xs">
                    <button
                      onClick={() => onEdit(i)}
                      className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(i)}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => onToggle(i)}
                      className={`px-2 py-1 rounded text-white ${
                        t.active ? "bg-gray-500" : "bg-green-600"
                      }`}
                    >
                      {t.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => onMarkLesson(i)}
                      className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      +Lesson
                    </button>
                    <button
                      onClick={() => onPay(i)}
                      className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Paid
                    </button>

                    {t.password && (
                      <>
                        <button
                          onClick={() => onCopyPassword(i)}
                          className="px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => onResetPassword(i)}
                          className="px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
                        >
                          Reset
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Total salary footer */}
      {filteredTeachers.length > 0 && (
        <div className="mt-3 text-right pr-2 text-gray-700 font-semibold">
          Total Salaries: ${totalSalary.toFixed(2)}
        </div>
      )}
    </div>
  );
}
