import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export default function LessonHistoryModal({ isOpen, onClose, history = [] }) {
  const { t: tr } = useTranslation("admin");
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

  const handlePrint = async () => {
    const { default: jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    const doc = new jsPDF();
    doc.text("Lesson History", 14, 15);
    doc.autoTable({
      head: [["Date", "Class", "Student", "Teacher"]],
      body: filtered.map((l) => [
        new Date(l.date).toLocaleDateString(),
        l.classTitle || "—",
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
        <h2 className="text-xl font-bold mb-4">{tr("lessonHistoryModal.lessonHistory")}</h2>

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
            {tr("lessonHistoryModal.printToPdf")}
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto border rounded">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">{tr("lessonHistoryModal.date")}</th>
                <th className="border p-2">{tr("lessonHistoryModal.class")}</th>
                <th className="border p-2">{tr("lessonHistoryModal.student")}</th>
                <th className="border p-2">{tr("lessonHistoryModal.teacher")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border p-2 whitespace-nowrap">
                      {new Date(row.date).toLocaleDateString()}
                    </td>
                    <td className="border p-2">{row.classTitle || "—"}</td>
                    <td className="border p-2">{row.student || tr("lessonHistoryModal.unknown")}</td>
                    <td className="border p-2">{row.teacher || tr("lessonHistoryModal.unknown")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center p-4 text-gray-500">
                    {tr("lessonHistoryModal.noLessonRecordsFound")}
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
            {tr("lessonHistoryModal.close")}
          </button>
        </div>
      </div>
    </div>
  );
}