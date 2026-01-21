// src/pages/teacher/tabs/PaymentTab.jsx - TEACHER PAYMENT DASHBOARD
import { useState, useEffect } from "react";
import { DollarSign, Clock, CheckCircle, Calendar, TrendingUp, Award } from "lucide-react";
import api from "../../../api";

export default function PaymentTab({ teacher, isDarkMode }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    totalPending: 0,
    totalPaid: 0,
    totalEarned: 0,
    pendingCount: 0,
    paidCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all"); // all, pending, paid

  useEffect(() => {
    if (teacher?._id) {
      loadPaymentData();
    }
  }, [teacher]);

  const loadPaymentData = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/payments/teacher/${teacher._id}`);
      setTransactions(data.transactions);
      setSummary(data.summary);
    } catch (err) {
      console.error("Error loading payment data:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (activeFilter === "all") return true;
    return tx.status === activeFilter;
  });

  const formatDate = (date) => {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Payment Dashboard
        </h2>
        <button
          onClick={loadPaymentData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Rate Per Class */}
        <div className={`rounded-lg shadow-md p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border-l-4 border-purple-500`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Rate Per Class</p>
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} mt-1`}>
                ${teacher?.ratePerClass || 0}
              </p>
            </div>
            <Award className="w-12 h-12 text-purple-500 opacity-20" />
          </div>
        </div>

        {/* Current Earnings (Pending) */}
        <div className={`rounded-lg shadow-md p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border-l-4 border-yellow-500`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Pending Payment</p>
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} mt-1`}>
                ${summary.totalPending.toFixed(2)}
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'} mt-1`}>
                {summary.pendingCount} {summary.pendingCount === 1 ? 'class' : 'classes'}
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
                ${summary.totalPaid.toFixed(2)}
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'} mt-1`}>
                {summary.paidCount} {summary.paidCount === 1 ? 'payment' : 'payments'}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>

        {/* Lessons Completed */}
        <div className={`rounded-lg shadow-md p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border-l-4 border-blue-500`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Classes Completed</p>
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} mt-1`}>
                {teacher?.lessonsCompleted || 0}
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'} mt-1`}>
                This billing cycle
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {['all', 'pending', 'paid'].map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeFilter === filter
                ? isDarkMode
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'border-b-2 border-blue-600 text-blue-600'
                : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
            {filter === 'pending' && summary.pendingCount > 0 && (
              <span className="ml-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                {summary.pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Payment History Table */}
      <div className={`rounded-lg shadow-md overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Date Completed
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Class Details
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Student
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Amount
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Status
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Paid Date
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <DollarSign className={`w-16 h-16 mx-auto ${isDarkMode ? 'text-gray-600' : 'text-gray-400'} mb-4`} />
                    <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      No {activeFilter === 'all' ? '' : activeFilter} payments yet
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => (
                  <tr key={tx._id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        {formatDate(tx.completedAt)}
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                      <div className="font-medium">{tx.classTitle}</div>
                      {tx.description && (
                        <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {tx.description}
                        </div>
                      )}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                      {tx.studentName}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                      tx.type === 'deduction' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {tx.type === 'deduction' ? '-' : ''}${tx.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {tx.paidAt ? formatDate(tx.paidAt) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Note */}
      <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
        <div className="flex items-start">
          <DollarSign className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
          <div>
            <h4 className={`font-semibold ${isDarkMode ? 'text-blue-300' : 'text-blue-900'} mb-1`}>
              Payment Information
            </h4>
            <p className={`text-sm ${isDarkMode ? 'text-blue-400' : 'text-blue-800'}`}>
              • Payments are processed by admin after class completion<br />
              • Your rate per class: ${teacher?.ratePerClass || 0}<br />
              • Pending earnings will be paid in the next billing cycle<br />
              • Contact admin if you have any payment questions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
