import React from "react";
import StudentCard from "./StudentCard";

export default function StudentProgressList({ students, onView }) {
  if (!students || students.length === 0) {
    return (
      <p className="text-center text-gray-500 bg-white p-6 rounded shadow">
        No students yet.
      </p>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow divide-y divide-gray-200">
      {students.map((student) => (
        <StudentCard key={student.id} student={student} onView={onView} />
      ))}
    </div>
  );
}
