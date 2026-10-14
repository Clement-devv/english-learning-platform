// src/pages/admin/modals/TeacherPaymentHistoryModal.jsx
import { useState, useEffect } from "react";
import { X, DollarSign, Clock, CheckCircle, FileText, Download } from "lucide-react";
import api from "../../../api";
import { useCurrencySymbol, fmtMoney } from "../../../hooks/useCurrencySymbol";
import { useTranslation } from "react-i18next";
import { dateLocale } from "../../../i18n/dateLocale.js";

function StatusBadge({ status }) {
  const { t: tr } = useTranslation("admin");
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle className="w-3 h-3" /> {tr("teacherPaymentHistoryModal.paid")}
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <X className="w-3 h-3" /> {tr("teacherPaymentHistoryModal.cancelled")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      <Clock className="w-3 h-3" /> {tr("teacherPaymentHistoryModal.pending")}
    </span>
  );
}

export default function TeacherPaymentHistoryModal({ teacher, onClose, isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
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
      ? new Date(date).toLocaleDateString(dateLocale("en-US"), {
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
        fmtMoney(tx.amount, sym),
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

  const bg = isDarkMode ? "bg-stone-800 border-stone-700" : "bg-white";
  const textPrimary = isDarkMode ? "text-white" : "text-stone-900";
  const textSecondary = isDarkMode ? "text-stone-400" : "text-stone-500";
  const cardBg = isDarkMode ? "bg-stone-700/60" : "bg-stone-50";
  const inputCls = isDarkMode
    ? "bg-stone-700 border-stone-600 text-white"
    : "bg-white border-stone-300 text-stone-900";
  const thCls = isDarkMode ? "bg-stone-700 text-stone-300" : "bg-stone-50 text-stone-500";
  const trHover = isDarkMode ? "hover:bg-stone-700/50" : "hover:bg-stone-50";
  const tdCls = isDarkMode ? "border-stone-700 text-stone-300" : "border-stone-100 text-stone-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-3xl rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] ${bg}`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? "border-stone-700" : "border-stone-100"}`}>
          <div>
            <h3 className={`text-lg font-bold ${textPrimary}`}>{tr("teacherPaymentHistoryModal.paymentHistory")}</h3>
            <p className={`text-sm ${textSecondary}`}>
              {teacher.firstName} {teacher.lastName} · {teacher.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? "hover:bg-stone-700 text-stone-400" : "hover:bg-stone-100 text-stone-500"}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary strip */}
        {summary && (
          <div className={`grid grid-cols-3 gap-3 px-6 py-4 border-b ${isDarkMode ? "border-stone-700" : "border-stone-100"}`}>
            <div className={`rounded-xl p-3 ${cardBg}`}>
              <p className={`text-xs font-medium ${textSecondary}`}>{tr("teacherPaymentHistoryModal.totalPending")}</p>
              <p className="text-lg font-bold text-amber-500">{fmtMoney(summary.totalPending, sym)}</p>
              <p className={`text-xs ${textSecondary}`}>{tr("teacherPaymentHistoryModal.transaction", { pendingCount: summary.pendingCount, value: summary.pendingCount !== 1 ? "s" : "" })}</p>
            </div>
            <div className={`rounded-xl p-3 ${cardBg}`}>
              <p className={`text-xs font-medium ${textSecondary}`}>{tr("teacherPaymentHistoryModal.totalPaid")}</p>
              <p className="text-lg font-bold text-emerald-500">{fmtMoney(summary.totalPaid, sym)}</p>
              <p className={`text-xs ${textSecondary}`}>{tr("teacherPaymentHistoryModal.transaction2", { paidCount: summary.paidCount, value: summary.paidCount !== 1 ? "s" : "" })}</p>
            </div>
            <div className={`rounded-xl p-3 ${cardBg}`}>
              <p className={`text-xs font-medium ${textSecondary}`}>{tr("teacherPaymentHistoryModal.totalEarned")}</p>
              <p className={`text-lg font-bold ${isDarkMode ? "text-blue-300" : "text-blue-600"}`}>{fmtMoney(summary.totalEarned, sym)}</p>
              <p className={`text-xs ${textSecondary}`}>{tr("teacherPaymentHistoryModal.total", { transactionsCount: transactions.length })}</p>
            </div>
          </div>
        )}

        {/* Filters + export */}
        <div className={`flex flex-wrap gap-3 items-center px-6 py-3 border-b ${isDarkMode ? "border-stone-700" : "border-stone-100"}`}>
          <div className="flex items-center gap-2">
            <label className={`text-xs font-medium ${textSecondary}`}>{tr("teacherPaymentHistoryModal.from")}</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`text-sm px-2 py-1.5 rounded-lg border ${inputCls}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-xs font-medium ${textSecondary}`}>{tr("teacherPaymentHistoryModal.to")}</label>
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
            {tr("teacherPaymentHistoryModal.exportCsv")}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className={`text-sm ${textSecondary}`}>{tr("teacherPaymentHistoryModal.loadingPaymentHistory")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <FileText className={`w-10 h-10 ${isDarkMode ? "text-stone-600" : "text-stone-300"}`} />
              <p className={`text-sm font-medium ${textPrimary}`}>{tr("teacherPaymentHistoryModal.noTransactionsFound")}</p>
              <p className={`text-xs ${textSecondary}`}>
                {fromDate || toDate ? tr("teacherPaymentHistoryModal.tryAdjustingTheDateRange") : tr("teacherPaymentHistoryModal.noPaymentRecordsForThis")}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className={`${thCls} text-xs uppercase tracking-wider`}>
                  <th className="px-3 py-2 text-left font-semibold">{tr("teacherPaymentHistoryModal.date")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{tr("teacherPaymentHistoryModal.class")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{tr("teacherPaymentHistoryModal.student")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{tr("teacherPaymentHistoryModal.amount")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{tr("teacherPaymentHistoryModal.status")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{tr("teacherPaymentHistoryModal.paidOn")}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? "divide-stone-700" : "divide-stone-100"}`}>
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
                      {fmtMoney(tx.amount, sym)}
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
        <div className={`flex items-center justify-between px-6 py-4 border-t ${isDarkMode ? "border-stone-700" : "border-stone-100"}`}>
          <p className={`text-xs ${textSecondary}`}>
            {tr("teacherPaymentHistoryModal.record", { filteredCount: filtered.length, value: filtered.length !== 1 ? "s" : "", value2: (fromDate || toDate) && " (filtered)" })}
          </p>
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-xl text-sm font-semibold border transition ${
              isDarkMode ? "border-stone-600 text-stone-300 hover:bg-stone-700" : "border-stone-300 text-stone-700 hover:bg-stone-50"
            }`}
          >
            {tr("teacherPaymentHistoryModal.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
