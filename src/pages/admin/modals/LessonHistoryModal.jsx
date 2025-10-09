import React, { useState } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function LessonHistoryModal({ isOpen, onClose, history = [] }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  if (!isOpen) return null;

  const filtered = history.filter((p) => {
    const d = new Date(p.date);
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const handlePrint = () => {
    const doc = new jsPDF();
    doc.text("Lesson History", 14, 15);
    doc.autoTable({
      head: [["Date", "Student", "Teacher"]],
      body: filtered.map((l) => [
        new Date(l.date).toLocaleDateString(),
        l.student || "Unknown",
        l.teacher || "Unknown",
      ]),
      startY: 25,
    });
    doc.save("lesson-history.pdf");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6">
        <h2 className="text-xl font-bold mb-4">Lesson History</h2>

        <div className="flex gap-3 mb-4">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border px-3 py-1 rounded w-40"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border px-3 py-1 rounded w-40"
          />
          <button
            onClick={handlePrint}
            className="ml-auto px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Print to PDF
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto border rounded">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Date</th>
                <th className="border p-2">Student</th>
                <th className="border p-2">Teacher</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border p-2">
                      {new Date(row.date).toLocaleDateString()}
                    </td>
                    <td className="border p-2">{row.student || "Unknown"}</td>
                    <td className="border p-2">{row.teacher || "Unknown"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="text-center p-4 text-gray-500">
                    No lesson records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}