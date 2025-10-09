import React, { useState, useEffect } from "react";
import { getAssignments, createAssignment, deleteAssignment } from "../../../services/assignmentService";

export default function AssignStudentsTab({ teachers = [], students = [], onNotify }) {
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  // Load assignments on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await getAssignments();
        setAssignments(data);
      } catch (err) {
        console.error("Error loading assignments:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAssign = async () => {
    if (!teacherId || !studentId) {
      setToast("Please select both teacher and student.");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    try {
      const newAssignment = await createAssignment({ teacherId, studentId });
      
      setAssignments((prev) => [newAssignment, ...prev]);
      
      const teacher = teachers.find((t) => t._id === teacherId);
      const student = students.find((s) => s._id === studentId);
      
      setToast(`Assigned ${student.firstName} to ${teacher.firstName}`);
      
      if (onNotify) {
        onNotify(`Student ${student.firstName} assigned to ${teacher.firstName}`);
      }

      setTimeout(() => setToast(""), 3000);
      setTeacherId("");
      setStudentId("");
    } catch (err) {
      console.error("Error creating assignment:", err);
      setToast(err.response?.data?.message || "Error creating assignment");
      setTimeout(() => setToast(""), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Remove this assignment?")) {
      try {
        await deleteAssignment(id);
        setAssignments((prev) => prev.filter((a) => a._id !== id));
        setToast("Assignment removed");
        setTimeout(() => setToast(""), 3000);
      } catch (err) {
        console.error("Error deleting assignment:", err);
      }
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-600">Loading assignments...</div>;
  }

  return (
    <div className="p-6">
      {toast && (
        <div className="mb-4 px-4 py-2 bg-green-600 text-white rounded shadow">
          {toast}
        </div>
      )}

      <h2 className="text-2xl font-bold mb-6 text-brand-primary">
        Assign Students to Teachers
      </h2>

      <div className="grid gap-4 max-w-lg">
        <select
          className="border rounded p-2"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
        >
          <option value="">Select Teacher</option>
          {teachers.map((t) => (
            <option key={t._id} value={t._id}>
              {t.firstName} {t.lastName}
            </option>
          ))}
        </select>

        <select
          className="border rounded p-2"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          <option value="">Select Student</option>
          {students.map((s) => (
            <option key={s._id} value={s._id}>
              {s.firstName} {s.surname}
            </option>
          ))}
        </select>

        <button
          onClick={handleAssign}
          className="px-4 py-2 bg-brand-primary text-white rounded hover:bg-brand-secondary"
        >
          Assign
        </button>
      </div>

      {assignments.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Current Assignments ({assignments.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2 text-left">Student</th>
                  <th className="border p-2 text-left">Teacher</th>
                  <th className="border p-2 text-left">Assigned Date</th>
                  <th className="border p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a._id} className="hover:bg-gray-50">
                    <td className="border p-2">
                      {a.studentId?.firstName} {a.studentId?.surname}
                    </td>
                    <td className="border p-2">
                      {a.teacherId?.firstName} {a.teacherId?.lastName}
                    </td>
                    <td className="border p-2">
                      {new Date(a.assignedDate).toLocaleDateString()}
                    </td>
                    <td className="border p-2 text-center">
                      <button
                        onClick={() => handleDelete(a._id)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}