// src/pages/admin/modals/TeacherPaymentHistoryModal.jsx
import { useState, useEffect } from "react";
import { X, DollarSign, Clock, CheckCircle, FileText, Download } from "lucide-react";
import api from "../../../api";

function StatusBadge({ status }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle className="w-3 h-3" /> Paid
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <X className="w-3 h-3" /> Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

export default function TeacherPaymentHistoryModal({ teacher, onClose, isDarkMode }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (!teacher) return;
    setLoading(true);
    api
      .get(`/api/v1/payment-transactions/teacher/${teacher._id}`)
      .then((res) => {
        setTransactions(res.data.transactions || []);
        setSummary(res.data.summary || null);
      })
      .catch((err) => console.error("Failed to load payment history:", err))
      .finally(() => setLoading(false));
  }, [teacher]);

  const filtered = transactions.filter((tx) => {
    const d = new Date(tx.completedAt);
    if (fromDate && d < new Date(fromDate)) return false;
    if (toDate && d > new Date(toDate + "T23:59:59")) return false;
    return true;
  });

  const fmt = (date) =>
    date
      ? new Date(date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  const handleCSV = () => {
    const rows = [
      ["Date", "Class", "Student", "Amount", "Status", "Method", "Paid On"],
      ...filtered.map((tx) => [
        fmt(tx.completedAt),
        tx.classTitle || "—",
        tx.studentName || "—",
        `$${tx.amount.toFixed(2)}`,
        tx.status,
        tx.paymentMethod || "—",
        tx.paidAt ? fmt(tx.paidAt) : "—",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${teacher.firstName}_${teacher.lastName}_payments.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bg = isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white";
  const textPrimary = isDarkMode ? "text-white" : "text-gray-900";
  const textSecondary = isDarkMode ? "text-gray-400" : "text-gray-500";
  const cardBg = isDarkMode ? "bg-gray-700/60" : "bg-gray-50";
  const inputCls = isDarkMode
    ? "bg-gray-700 border-gray-600 text-white"
    : "bg-white border-gray-300 text-gray-900";
  const thCls = isDarkMode ? "bg-gray-700 text-gray-300" : "bg-gray-50 text-gray-500";
  const trHover = isDarkMode ? "hover:bg-gray-700/50" : "hover:bg-gray-50";
  const tdCls = isDarkMode ? "border-gray-700 text-gray-300" : "border-gray-100 text-gray-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-3xl rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] ${bg}`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
          <div>
            <h3 className={`text-lg font-bold ${textPrimary}`}>Payment History</h3>
            <p className={`text-sm ${textSecondary}`}>
              {teacher.firstName} {teacher.lastName} · {teacher.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary strip */}
        {summary && (
          <div className={`grid grid-cols-3 gap-3 px-6 py-4 border-b ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
            <div className={`rounded-xl p-3 ${cardBg}`}>
              <p className={`text-xs font-medium ${textSecondary}`}>Total Pending</p>
              <p className="text-lg font-bold text-amber-500">${summary.totalPending.toFixed(2)}</p>
              <p className={`text-xs ${textSecondary}`}>{summary.pendingCount} transaction{summary.pendingCount !== 1 ? "s" : ""}</p>
            </div>
            <div className={`rounded-xl p-3 ${cardBg}`}>
              <p className={`text-xs font-medium ${textSecondary}`}>Total Paid</p>
              <p className="text-lg font-bold text-emerald-500">${summary.totalPaid.toFixed(2)}</p>
              <p className={`text-xs ${textSecondary}`}>{summary.paidCount} transaction{summary.paidCount !== 1 ? "s" : ""}</p>
            </div>
            <div className={`rounded-xl p-3 ${cardBg}`}>
              <p className={`text-xs font-medium ${textSecondary}`}>Total Earned</p>
              <p className={`text-lg font-bold ${isDarkMode ? "text-blue-300" : "text-blue-600"}`}>${summary.totalEarned.toFixed(2)}</p>
              <p className={`text-xs ${textSecondary}`}>{transactions.length} total</p>
            </div>
          </div>
        )}

        {/* Filters + export */}
        <div className={`flex flex-wrap gap-3 items-center px-6 py-3 border-b ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
          <div className="flex items-center gap-2">
            <label className={`text-xs font-medium ${textSecondary}`}>From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`text-sm px-2 py-1.5 rounded-lg border ${inputCls}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-xs font-medium ${textSecondary}`}>To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={`text-sm px-2 py-1.5 rounded-lg border ${inputCls}`}
            />
          </div>
          <div className="flex-1" />
          <button
            onClick={handleCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className={`text-sm ${textSecondary}`}>Loading payment history…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <FileText className={`w-10 h-10 ${isDarkMode ? "text-gray-600" : "text-gray-300"}`} />
              <p className={`text-sm font-medium ${textPrimary}`}>No transactions found</p>
              <p className={`text-xs ${textSecondary}`}>
                {fromDate || toDate ? "Try adjusting the date range." : "No payment records for this teacher yet."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className={`${thCls} text-xs uppercase tracking-wider`}>
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Class</th>
                  <th className="px-3 py-2 text-left font-semibold">Student</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Paid On</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? "divide-gray-700" : "divide-gray-100"}`}>
                {filtered.map((tx) => (
                  <tr key={tx._id} className={`${trHover} transition-colors`}>
                    <td className={`px-3 py-3 whitespace-nowrap ${tdCls}`}>{fmt(tx.completedAt)}</td>
                    <td className={`px-3 py-3 max-w-[140px] truncate ${tdCls}`} title={tx.classTitle}>
                      {tx.classTitle || <span className="opacity-40">—</span>}
                    </td>
                    <td className={`px-3 py-3 max-w-[120px] truncate ${tdCls}`} title={tx.studentName}>
                      {tx.studentName || <span className="opacity-40">—</span>}
                    </td>
                    <td className={`px-3 py-3 text-right font-semibold ${tx.status === "paid" ? "text-emerald-500" : "text-amber-500"}`}>
                      ${tx.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className={`px-3 py-3 whitespace-nowrap ${tdCls}`}>
                      {tx.paidAt ? fmt(tx.paidAt) : <span className="opacity-40">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
          <p className={`text-xs ${textSecondary}`}>
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            {(fromDate || toDate) && " (filtered)"}
          </p>
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-xl text-sm font-semibold border transition-all ${
              isDarkMode ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
