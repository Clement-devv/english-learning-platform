import React from "react";

export default function StudentCard({ student, onView }) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-gray-50">
      <div>
        <h4 className="font-semibold text-gray-800">{student.name}</h4>
        <p className="text-sm text-gray-600">Level: {student.level}</p>
        <p className="text-xs text-gray-500">
          Progress: {student.progress}%
        </p>
      </div>

      <button
        onClick={() => onView(student)}
        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
      >
        View
      </button>
    </div>
  );
}
