import React, { useState } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function PaymentHistoryModal({ isOpen, onClose, history }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  if (!isOpen) return null;

  // Filter by date range
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
    doc.text("Payment History", 14, 15);
    doc.autoTable({
      head: [["Date", "Student", "Method", "Amount", "Classes", "Status"]],
      body: filtered.map((p) => [
        new Date(p.date).toLocaleDateString(),
        p.student || "Unknown",
        p.method,
        p.amount,
        p.classes || "-",
        p.status,
      ]),
      startY: 25,
    });
    doc.save("payment-history.pdf");
  };

  const handleCSV = () => {
    const rows = [
      ["Date", "Student", "Method", "Amount", "Classes", "Status"],
      ...filtered.map((p) => [
        new Date(p.date).toLocaleDateString(),
        p.student || "Unknown",
        p.method,
        p.amount,
        p.classes || "-",
        p.status,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payment-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6">
        <h2 className="text-xl font-bold mb-4">Payment History</h2>

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
            PDF
          </button>
          <button
            onClick={handleCSV}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            CSV
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto border rounded">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Date</th>
                <th className="border p-2">Student</th>
                <th className="border p-2">Method</th>
                <th className="border p-2">Amount</th>
                <th className="border p-2">Classes</th>
                <th className="border p-2">Status</th>
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
                    <td className="border p-2">{row.method}</td>
                    <td className="border p-2">₦{row.amount}</td>
                    <td className="border p-2">{row.classes || "-"}</td>
                    <td className="border p-2">{row.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center p-4 text-gray-500">
                    No payment records found
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