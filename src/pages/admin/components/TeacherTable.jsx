import React from "react";

export default function TeacherTable({
  teachers,
  onEdit,
  onDelete,
  onToggle,
  onMarkLesson,
  onMarkPaid,
  onResetPassword,
  onCopyPassword,
}) {
  if (!teachers || teachers.length === 0) {
    return (
      <div className="mt-4 text-center text-gray-500">
        No teachers available
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">First Name</th>
            <th className="border p-2 text-left">Last Name</th>
            <th className="border p-2 text-left">Email</th>
            <th className="border p-2 text-center">Rate / Class ($)</th>
            <th className="border p-2 text-center">Salary Accrued ($)</th>
            <th className="border p-2 text-center">Actions</th>
          </tr>
        </thead>

        <tbody>
          {teachers.map((t, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="border p-2">{t.firstName}</td>
              <td className="border p-2">{t.lastName}</td>
              <td className="border p-2">{t.email}</td>
              <td className="border p-2 text-center">
                {t.ratePerClass ? `$${t.ratePerClass}` : "-"}
              </td>
              <td className="border p-2 text-center">
                ${t.salaryAccrued?.toFixed(2) || "0.00"}
              </td>

              <td className="border p-2">
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => onMarkLesson(index)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Mark Lesson
                  </button>

                  <button
                    onClick={() => onMarkPaid(index)}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Mark Paid
                  </button>

                  {t.showTempPassword && t.password && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs bg-yellow-100 px-2 py-0.5 rounded">
                        {t.password}
                      </span>
                      <button
                        onClick={() => onCopyPassword(index)}
                        className="text-xs px-2 py-0.5 bg-gray-300 rounded hover:bg-gray-400"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => onResetPassword(index)}
                        className="text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Reset
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => onEdit(index)}
                    className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => onDelete(index)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>

                  <button
                    onClick={() => onToggle(index)}
                    className={`px-3 py-1 text-sm rounded text-white ${
                      t.active
                        ? "bg-gray-500 hover:bg-gray-600"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {t.active ? "Disable" : "Enable"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
