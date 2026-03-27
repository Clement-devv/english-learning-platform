// src/pages/admin/tabs/PaymentsTab.jsx - ADMIN PAYMENT MANAGEMENT
import { useState, useEffect } from "react";
import {
  DollarSign,
  Users,
  CheckCircle,
  Clock,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import api from "../../../api";

// ─── Pay-all confirmation modal ───────────────────────────────────────────────
function PayAllModal({ target, onConfirm, onCancel, isDarkMode }) {
  if (!target) return null;
  const { teacherName, pendingAmount, pendingCount, paymentMethod, notes } = target;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white"}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              Confirm Salary Payment
            </h3>
            <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              This will mark all pending lessons as paid
            </p>
          </div>
        </div>

        <div className={`rounded-xl p-4 mb-5 space-y-2 ${isDarkMode ? "bg-emerald-900/20 border border-emerald-800/40" : "bg-emerald-50 border border-emerald-100"}`}>
          <div className="flex justify-between">
            <span className={`text-sm ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>Teacher</span>
            <span className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>{teacherName}</span>
          </div>
          <div className="flex justify-between">
            <span className={`text-sm ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>Pending lessons</span>
            <span className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>{pendingCount}</span>
          </div>
          <div className="flex justify-between">
            <span className={`text-sm ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>Payment method</span>
            <span className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>{paymentMethod.replace("_", " ")}</span>
          </div>
          {notes && (
            <div className="flex justify-between">
              <span className={`text-sm ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>Notes</span>
              <span className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>{notes}</span>
            </div>
          )}
          <div className={`flex justify-between pt-2 border-t ${isDarkMode ? "border-emerald-800/40" : "border-emerald-200"}`}>
            <span className={`text-sm font-semibold ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>Total payout</span>
            <span className={`text-xl font-bold ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`}>${pendingAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${isDarkMode ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
          >
            Pay ${pendingAmount.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentsTab({ isDarkMode }) {
  const [teachers, setTeachers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [teacherSummary, setTeacherSummary] = useState([]);
  const [totals, setTotals] = useState({
    totalPending: 0,
    totalPaid: 0,
    totalTeachers: 0,
    totalLessons: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // overview, transactions, teachers
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [toast, setToast] = useState("");
  const [payAllTarget, setPayAllTarget] = useState(null); // { teacherId, teacherName, pendingAmount, pendingCount, paymentMethod, notes }

  useEffect(() => {
    loadPaymentData();
  }, []);

  const loadPaymentData = async () => {
    try {
      setLoading(true);
      
      // Load payment summary
      const summaryRes = await api.get("/api/payments/summary");
      setTeacherSummary(summaryRes.data.teachers);
      setTotals(summaryRes.data.totals);

      // Load all transactions
      const txRes = await api.get("/api/payments/all");
      setTransactions(txRes.data.transactions);

    } catch (err) {
      console.error("Error loading payment data:", err);
      showToast("Error loading payment data");
    } finally {
      setLoading(false);
    }
  };

  const handlePaySingleTransaction = async (transactionId) => {
    if (!window.confirm("Mark this payment as paid?")) return;

    try {
      await api.patch(`/api/payments/${transactionId}/pay`, {
        paymentMethod,
        notes: paymentNotes
      });

      showToast("Payment processed successfully!");
      loadPaymentData();
      setPaymentNotes("");

    } catch (err) {
      console.error("Error processing payment:", err);
      showToast("Error processing payment");
    }
  };

  const handlePayAllForTeacher = (teacherId, teacherName) => {
    const teacher = teacherSummary.find(t => t.teacherId === teacherId);
    if (!teacher || teacher.pendingAmount <= 0) {
      showToast("No pending payments for this teacher");
      return;
    }
    setPayAllTarget({
      teacherId,
      teacherName,
      pendingAmount: teacher.pendingAmount,
      pendingCount: teacher.pendingCount,
      paymentMethod,
      notes: paymentNotes,
    });
  };

  const handleConfirmPayAll = async () => {
    if (!payAllTarget) return;
    const { teacherId, teacherName, pendingAmount } = payAllTarget;
    setPayAllTarget(null);
    try {
      const res = await api.patch(`/api/payments/teacher/${teacherId}/pay-all`, {
        paymentMethod,
        notes: paymentNotes,
      });
      showToast(`Successfully paid $${res.data.totalAmount.toFixed(2)} to ${teacherName}!`);
      loadPaymentData();
      setPaymentNotes("");
    } catch (err) {
      console.error("Error processing bulk payment:", err);
      showToast("Error processing bulk payment");
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pay-all confirmation modal */}
      <PayAllModal
        target={payAllTarget}
        onConfirm={handleConfirmPayAll}
        onCancel={() => setPayAllTarget(null)}
        isDarkMode={isDarkMode}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Payment Management
        </h2>
        <button
          onClick={loadPaymentData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pending */}
        <div className={`rounded-lg shadow-md p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border-l-4 border-yellow-500`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Pending</p>
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} mt-1`}>
                ${totals.totalPending.toFixed(2)}
              </p>
            </div>
            <Clock className="w-12 h-12 text-yellow-500 opacity-20" />
          </div>
        </div>

        {/* Total Paid */}
        <div className={`rounded-lg shadow-md p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border-l-4 border-green-500`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Paid</p>
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} mt-1`}>
                ${totals.totalPaid.toFixed(2)}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>

        {/* Active Teachers */}
        <div className={`rounded-lg shadow-md p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border-l-4 border-blue-500`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Active Teachers</p>
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} mt-1`}>
                {totals.totalTeachers}
              </p>
            </div>
            <Users className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        {/* Total Lessons */}
        <div className={`rounded-lg shadow-md p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border-l-4 border-purple-500`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Lessons</p>
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} mt-1`}>
                {totals.totalLessons}
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {['overview', 'transactions', 'teachers'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-semibold transition-colors capitalize ${
              activeTab === tab
                ? isDarkMode
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'border-b-2 border-blue-600 text-blue-600'
                : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Payment Method Selection */}
      <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
        <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Payment Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg border ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="paypal">PayPal</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Payment Notes (Optional)
            </label>
            <input
              type="text"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="e.g., Transaction ID, Reference number..."
              className={`w-full px-4 py-2 rounded-lg border ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Teacher Payment Overview
          </h3>
          
          <div className={`rounded-lg shadow-md overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Teacher
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Rate/Class
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Completed Lessons
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Pending Payment
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Total Paid
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {teacherSummary.map(teacher => (
                    <tr key={teacher.teacherId} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        <div className="font-medium">{teacher.teacherName}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {teacher.email}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        ${teacher.ratePerClass}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        {teacher.lessonsCompleted} classes
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-yellow-600">
                          ${teacher.pendingAmount.toFixed(2)}
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {teacher.pendingCount} pending
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-green-600">
                          ${teacher.paidAmount.toFixed(2)}
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {teacher.paidCount} paid
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handlePayAllForTeacher(teacher.teacherId, teacher.teacherName)}
                          disabled={teacher.pendingAmount <= 0}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            teacher.pendingAmount > 0
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          Pay All (${teacher.pendingAmount.toFixed(2)})
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="space-y-4">
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            All Payment Transactions
          </h3>
          
          <div className={`rounded-lg shadow-md overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Teacher
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Class / Student
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Completed
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Amount
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Status
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {transactions.map(tx => (
                    <tr key={tx._id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        {tx.teacherId.firstName} {tx.teacherId.lastName}
                      </td>
                      <td className={`px-6 py-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        <div className="font-medium">{tx.classTitle}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {tx.studentName}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {formatDate(tx.completedAt)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                        tx.status === 'paid' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        ${tx.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(tx.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {tx.status === 'pending' ? (
                          <button
                            onClick={() => handlePaySingleTransaction(tx._id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Mark as Paid
                          </button>
                        ) : (
                          <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            Paid {formatDate(tx.paidAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
