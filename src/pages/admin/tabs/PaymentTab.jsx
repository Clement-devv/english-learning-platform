// src/pages/admin/tabs/PaymentsTab.jsx - ADMIN PAYMENT MANAGEMENT
import { useState, useEffect, useRef } from "react";
import {
  DollarSign,
  Users,
  CheckCircle,
  Clock,
  TrendingUp,
  CreditCard,
  Banknote,
  AlertCircle,
} from "lucide-react";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import Pagination from "../../../components/Pagination";
import { useCurrencySymbol, fmtMoney } from "../../../hooks/useCurrencySymbol";
import AnalyticsPinPrompt from "../../../components/admin/analytics/AnalyticsPinPrompt";
import { isAnalyticsLocked } from "../../../utils/analyticsPin";
import { useTranslation } from "react-i18next";
import { dateLocale } from "../../../i18n/dateLocale.js";

// ─── Pay-all confirmation modal ───────────────────────────────────────────────
function PayAllModal({ target, onConfirm, onCancel, isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
  if (!target) return null;
  const { teacherName, pendingAmount, pendingCount, paymentMethod, notes } = target;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${isDarkMode ? "bg-stone-800 border border-stone-700" : "bg-white"}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-stone-900"}`}>
              {tr("paymentTab.confirmSalaryPayment")}
            </h3>
            <p className={`text-sm ${isDarkMode ? "text-stone-400" : "text-stone-500"}`}>
              {tr("paymentTab.thisWillMarkAllPending")}
            </p>
          </div>
        </div>

        <div className={`rounded-xl p-4 mb-5 space-y-2 ${isDarkMode ? "bg-emerald-900/20 border border-emerald-800/40" : "bg-emerald-50 border border-emerald-100"}`}>
          <div className="flex justify-between">
            <span className={`text-sm ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>{tr("paymentTab.teacher")}</span>
            <span className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-stone-900"}`}>{teacherName}</span>
          </div>
          <div className="flex justify-between">
            <span className={`text-sm ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>{tr("paymentTab.pendingLessons")}</span>
            <span className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-stone-900"}`}>{pendingCount}</span>
          </div>
          <div className="flex justify-between">
            <span className={`text-sm ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>{tr("paymentTab.paymentMethod")}</span>
            <span className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-stone-900"}`}>{paymentMethod.replace("_", " ")}</span>
          </div>
          {notes && (
            <div className="flex justify-between">
              <span className={`text-sm ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>{tr("paymentTab.notes")}</span>
              <span className={`text-sm ${isDarkMode ? "text-stone-300" : "text-stone-600"}`}>{notes}</span>
            </div>
          )}
          <div className={`flex justify-between pt-2 border-t ${isDarkMode ? "border-emerald-800/40" : "border-emerald-200"}`}>
            <span className={`text-sm font-semibold ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>{tr("paymentTab.totalPayout")}</span>
            <span className={`text-xl font-bold ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`}>{fmtMoney(pendingAmount, sym)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${isDarkMode ? "border-stone-600 text-stone-300 hover:bg-stone-700" : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}
          >
            {tr("paymentTab.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
          >{tr("paymentTab.pay", { fmtMoney: fmtMoney(pendingAmount, sym) })}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentsTab({ isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
  const [teachers, setTeachers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [txPage,  setTxPage]  = useState(1);
  const [txPager, setTxPager] = useState({ total: 0, totalPages: 1, limit: 25 });
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
  const [pinLocked, setPinLocked] = useState(false);

  useEffect(() => {
    loadPaymentData();
  }, [txPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live: refresh quietly (no spinner) when the server says this data changed
  const quietRef = useRef(false);
  useOnDataChanged(["payments"], () => { quietRef.current = true; loadPaymentData(); });

  const loadPaymentData = async () => {
    try {
      if (!quietRef.current) setLoading(true);
    quietRef.current = false;
      
      // Load payment summary
      const summaryRes = await api.get("/payment-transactions/summary");
      setTeacherSummary(summaryRes.data.teachers);
      setTotals(summaryRes.data.totals);

      // One page of transactions (newest first)
      const txRes = await api.get("/payment-transactions/all", { params: { page: txPage, limit: 25 } });
      setTransactions(txRes.data.transactions);
      if (txRes.data.pagination) {
        setTxPager(txRes.data.pagination);
        // e.g. the last item on the last page went away — step back
        if (txRes.data.transactions.length === 0 && txPage > 1) setTxPage(Math.max(1, txRes.data.pagination.totalPages));
      }

    } catch (err) {
      if (isAnalyticsLocked(err)) {
        setPinLocked(true);   // no PIN entered yet, or the unlock expired / PIN changed
      } else {
        console.error("Error loading payment data:", err);
        showToast(tr("paymentTab.errorLoadingPaymentData"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePaySingleTransaction = async (transactionId) => {
    if (!window.confirm(tr("paymentTab.markThisPaymentAsPaid"))) return;

    try {
      await api.patch(`/payment-transactions/${transactionId}/pay`, {
        paymentMethod,
        notes: paymentNotes
      });

      showToast(tr("paymentTab.paymentProcessedSuccessfully"));
      loadPaymentData();
      setPaymentNotes("");

    } catch (err) {
      console.error("Error processing payment:", err);
      showToast(tr("paymentTab.errorProcessingPayment"));
    }
  };

  const handlePayAllForTeacher = (teacherId, teacherName) => {
    const teacher = teacherSummary.find(t => t.teacherId === teacherId);
    if (!teacher || teacher.pendingAmount <= 0) {
      showToast(tr("paymentTab.noPendingPaymentsForThis"));
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
      const res = await api.patch(`/payment-transactions/teacher/${teacherId}/pay-all`, {
        paymentMethod,
        notes: paymentNotes,
      });
      showToast(tr("paymentTab.successfullyPaidTo", { fmtMoney: fmtMoney(res.data.totalAmount, sym), teacherName }));
      loadPaymentData();
      setPaymentNotes("");
    } catch (err) {
      console.error("Error processing bulk payment:", err);
      showToast(tr("paymentTab.errorProcessingBulkPayment"));
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(dateLocale('en-US'), {
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

  // Payroll and revenue sit behind the admin's analytics PIN (if one is set)
  if (pinLocked) {
    return (
      <AnalyticsPinPrompt
        inline
        isDarkMode={isDarkMode}
        title={tr("paymentTab.paymentsAreLocked")}
        onUnlocked={() => { setPinLocked(false); loadPaymentData(); }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ad-accent"></div>
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
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 ui-toast-in" role="status">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
          {tr("paymentTab.paymentManagement")}
        </h2>
        <button
          onClick={loadPaymentData}
          className="px-4 py-2 bg-ad-accent text-ad-on-accent rounded-lg hover:bg-ad-accent-hover transition-colors"
        >
          {tr("paymentTab.refreshData")}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pending */}
        <div className="cat-amber relative overflow-hidden rounded-xl border border-ad-line p-5 flex items-center gap-4 shadow-[var(--a-shadow)]" style={{ background: "radial-gradient(120% 100% at 100% 0%, var(--cat-soft) 0%, transparent 60%), var(--a-surface)" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: "var(--cat)", boxShadow: "0 6px 14px -6px var(--cat)" }}>
            <Clock className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ad-muted">{tr("paymentTab.totalPending")}</p>
            <p className="text-2xl font-bold tabular-nums text-ad-ink mt-0.5">{fmtMoney(totals.totalPending, sym)}</p>
          </div>
        </div>

        {/* Total Paid */}
        <div className="cat-green relative overflow-hidden rounded-xl border border-ad-line p-5 flex items-center gap-4 shadow-[var(--a-shadow)]" style={{ background: "radial-gradient(120% 100% at 100% 0%, var(--cat-soft) 0%, transparent 60%), var(--a-surface)" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: "var(--cat)", boxShadow: "0 6px 14px -6px var(--cat)" }}>
            <CheckCircle className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ad-muted">{tr("paymentTab.totalPaid")}</p>
            <p className="text-2xl font-bold tabular-nums text-ad-ink mt-0.5">{fmtMoney(totals.totalPaid, sym)}</p>
          </div>
        </div>

        {/* Active Teachers */}
        <div className="cat-teal relative overflow-hidden rounded-xl border border-ad-line p-5 flex items-center gap-4 shadow-[var(--a-shadow)]" style={{ background: "radial-gradient(120% 100% at 100% 0%, var(--cat-soft) 0%, transparent 60%), var(--a-surface)" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: "var(--cat)", boxShadow: "0 6px 14px -6px var(--cat)" }}>
            <Users className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ad-muted">{tr("paymentTab.activeTeachers")}</p>
            <p className="text-2xl font-bold tabular-nums text-ad-ink mt-0.5">{totals.totalTeachers}</p>
          </div>
        </div>

        {/* Total Lessons */}
        <div className="cat-accent relative overflow-hidden rounded-xl border border-ad-line p-5 flex items-center gap-4 shadow-[var(--a-shadow)]" style={{ background: "radial-gradient(120% 100% at 100% 0%, var(--cat-soft) 0%, transparent 60%), var(--a-surface)" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: "var(--cat)", boxShadow: "0 6px 14px -6px var(--cat)" }}>
            <TrendingUp className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ad-muted">{tr("paymentTab.totalLessons")}</p>
            <p className="text-2xl font-bold tabular-nums text-ad-ink mt-0.5">{totals.totalLessons}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-200 dark:border-stone-700">
        {['overview', 'transactions', 'bank details'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-semibold transition-colors capitalize ${
              activeTab === tab
                ? isDarkMode
                  ? 'border-b-2 border-ad-accent text-ad-accent-ink'
                  : 'border-b-2 border-ad-accent text-ad-accent-ink'
                : isDarkMode
                  ? 'text-stone-400 hover:text-stone-200'
                  : 'text-stone-600 hover:text-stone-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Payment Method Selection */}
      <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-stone-800' : 'bg-white'} shadow-md`}>
        <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
          {tr("paymentTab.paymentSettings")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>
              {tr("paymentTab.paymentMethod2")}
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg border ${
                isDarkMode
                  ? 'bg-stone-700 border-stone-600 text-white'
                  : 'bg-white border-stone-300 text-stone-900'
              }`}
            >
              <option value="bank_transfer">{tr("paymentTab.bankTransfer")}</option>
              <option value="paypal">{tr("paymentTab.paypal")}</option>
              <option value="cash">{tr("paymentTab.cash")}</option>
              <option value="check">{tr("paymentTab.check")}</option>
              <option value="other">{tr("paymentTab.other")}</option>
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>
              {tr("paymentTab.paymentNotesOptional")}
            </label>
            <input
              type="text"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder={tr("paymentTab.eGTransactionIdReference")}
              className={`w-full px-4 py-2 rounded-lg border ${
                isDarkMode
                  ? 'bg-stone-700 border-stone-600 text-white placeholder-stone-400'
                  : 'bg-white border-stone-300 text-stone-900 placeholder-stone-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
            {tr("paymentTab.teacherPaymentOverview")}
          </h3>
          
          <div className={`rounded-lg shadow-md overflow-hidden ${isDarkMode ? 'bg-stone-800' : 'bg-white'}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200 dark:divide-stone-700">
                <thead className={isDarkMode ? 'bg-stone-700' : 'bg-stone-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                      {tr("paymentTab.teacher")}
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                      {tr("paymentTab.rateClass")}
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                      {tr("paymentTab.completedLessons")}
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                      {tr("paymentTab.pendingPayment")}
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                      {tr("paymentTab.totalPaid")}
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                      {tr("paymentTab.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-stone-700' : 'divide-stone-200'}`}>
                  {teacherSummary.map(teacher => (
                    <tr key={teacher.teacherId} className={isDarkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-50'}>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-stone-300' : 'text-stone-900'}`}>
                        <div className="font-medium">{teacher.teacherName}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-stone-500' : 'text-stone-500'}`}>
                          {teacher.email}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-stone-300' : 'text-stone-900'}`}>
                        {sym}{teacher.ratePerClass}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-stone-300' : 'text-stone-900'}`}>
                        {tr("paymentTab.classes", { lessonsCompleted: teacher.lessonsCompleted })}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-yellow-600">
                          {fmtMoney(teacher.pendingAmount, sym)}
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-stone-500' : 'text-stone-500'}`}>
                          {tr("paymentTab.pending", { pendingCount: teacher.pendingCount })}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-green-600">
                          {fmtMoney(teacher.paidAmount, sym)}
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-stone-500' : 'text-stone-500'}`}>
                          {tr("paymentTab.paid", { paidCount: teacher.paidCount })}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handlePayAllForTeacher(teacher.teacherId, teacher.teacherName)}
                          disabled={teacher.pendingAmount <= 0}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            teacher.pendingAmount > 0
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                          }`}
                        >{tr("paymentTab.payAll", { fmtMoney: fmtMoney(teacher.pendingAmount, sym) })}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "bank details" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
                {tr("paymentTab.teacherBankDetails")}
              </h3>
              <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                {tr("paymentTab.bankInformationSavedByEach")}
              </p>
            </div>
            <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
              <Banknote className="w-4 h-4" />
              {teacherSummary.filter(t => t.bankName || t.accountNumber).length} {tr("paymentTab.of")} {teacherSummary.length} {tr("paymentTab.saved")}
            </div>
          </div>

          <div className={`rounded-xl shadow-md overflow-hidden ${isDarkMode ? 'bg-stone-800' : 'bg-white'}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200 dark:divide-stone-700">
                <thead className={isDarkMode ? 'bg-stone-700' : 'bg-stone-50'}>
                  <tr>
                    {['Teacher', 'Account Holder Name', 'Bank Name', 'Account Number', 'Status'].map(h => (
                      <th key={h} className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-stone-700' : 'divide-stone-100'}`}>
                  {teacherSummary.map(teacher => {
                    const hasBankDetails = teacher.bankName || teacher.accountNumber;
                    return (
                      <tr key={teacher.teacherId} className={isDarkMode ? 'hover:bg-stone-700/50' : 'hover:bg-stone-50'}>
                        <td className={`px-6 py-4 ${isDarkMode ? 'text-stone-200' : 'text-stone-900'}`}>
                          <p className="font-semibold text-sm">{teacher.teacherName}</p>
                          <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>{teacher.email}</p>
                        </td>
                        <td className={`px-6 py-4 text-sm ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>
                          {teacher.accountName || <span className={isDarkMode ? 'text-stone-600' : 'text-stone-300'}>—</span>}
                        </td>
                        <td className={`px-6 py-4 text-sm ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>
                          {teacher.bankName || <span className={isDarkMode ? 'text-stone-600' : 'text-stone-300'}>—</span>}
                        </td>
                        <td className={`px-6 py-4 text-sm font-mono ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>
                          {teacher.accountNumber || <span className={`font-sans ${isDarkMode ? 'text-stone-600' : 'text-stone-300'}`}>—</span>}
                        </td>
                        <td className="px-6 py-4">
                          {hasBankDetails ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isDarkMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                              <CheckCircle className="w-3 h-3" /> {tr("paymentTab.saved2")}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isDarkMode ? 'bg-stone-700 text-stone-400' : 'bg-stone-100 text-stone-500'}`}>
                              <AlertCircle className="w-3 h-3" /> {tr("paymentTab.notSet")}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {teacherSummary.length === 0 && (
                    <tr>
                      <td colSpan={5} className={`px-6 py-12 text-center text-sm ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>
                        {tr("paymentTab.noTeachersFound")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="space-y-4">
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
            {tr("paymentTab.allPaymentTransactions")}
          </h3>
          
          <div className={`rounded-lg shadow-md overflow-hidden ${isDarkMode ? 'bg-stone-800' : 'bg-white'}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200 dark:divide-stone-700">
                <thead className={isDarkMode ? 'bg-stone-700' : 'bg-stone-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                      {tr("paymentTab.teacher")}
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                      {tr("paymentTab.classStudent")}
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                      {tr("paymentTab.completed")}
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                      {tr("paymentTab.amount")}
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                      {tr("paymentTab.status")}
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-stone-300' : 'text-stone-500'}`}>
                      {tr("paymentTab.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-stone-700' : 'divide-stone-200'}`}>
                  {transactions.map(tx => (
                    <tr key={tx._id} className={isDarkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-50'}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-stone-300' : 'text-stone-900'}`}>
                        {tx.teacherId.firstName} {tx.teacherId.lastName}
                      </td>
                      <td className={`px-6 py-4 text-sm ${isDarkMode ? 'text-stone-300' : 'text-stone-900'}`}>
                        <div className="font-medium">{tx.classTitle}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-stone-500' : 'text-stone-500'}`}>
                          {tx.studentName}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                        {formatDate(tx.completedAt)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                        tx.status === 'paid' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {fmtMoney(tx.amount, sym)}
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
                            {tr("paymentTab.markAsPaid")}
                          </button>
                        ) : (
                          <span className={`text-xs ${isDarkMode ? 'text-stone-500' : 'text-stone-500'}`}>{tr("paymentTab.paid2", { formatDate: formatDate(tx.paidAt) })}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={txPage} totalPages={txPager.totalPages} total={txPager.total} pageSize={txPager.limit}
            onPage={(p) => { setTxPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} isDarkMode={isDarkMode} />
        </div>
      )}
    </div>
  );
}
