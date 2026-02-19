// src/pages/teacher/tabs/PaymentTab.jsx
// Complete salary & earnings dashboard for teachers
// Drop-in replacement — same props: { teacher, isDarkMode }

import { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  Clock,
  CheckCircle,
  TrendingUp,
  Award,
  RefreshCw,
  BookOpen,
  User,
  Calendar,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Info,
  Wallet,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
} from "lucide-react";
import api from "../../../api";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(n) {
  if (n == null) return "$0.00";
  return `$${Number(n).toFixed(2)}`;
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [year, month] = key.split("-");
  return new Date(year, month - 1).toLocaleString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent, isDarkMode }) {
  const accents = {
    purple: {
      ring: isDarkMode ? "border-purple-700/50" : "border-purple-200",
      iconBg: isDarkMode ? "bg-purple-900/50 text-purple-300" : "bg-purple-100 text-purple-600",
      val: isDarkMode ? "text-purple-300" : "text-purple-700",
      bg: isDarkMode ? "bg-gray-800" : "bg-white",
    },
    amber: {
      ring: isDarkMode ? "border-amber-700/50" : "border-amber-200",
      iconBg: isDarkMode ? "bg-amber-900/50 text-amber-300" : "bg-amber-100 text-amber-600",
      val: isDarkMode ? "text-amber-300" : "text-amber-700",
      bg: isDarkMode ? "bg-gray-800" : "bg-white",
    },
    emerald: {
      ring: isDarkMode ? "border-emerald-700/50" : "border-emerald-200",
      iconBg: isDarkMode ? "bg-emerald-900/50 text-emerald-300" : "bg-emerald-100 text-emerald-600",
      val: isDarkMode ? "text-emerald-300" : "text-emerald-700",
      bg: isDarkMode ? "bg-gray-800" : "bg-white",
    },
    blue: {
      ring: isDarkMode ? "border-blue-700/50" : "border-blue-200",
      iconBg: isDarkMode ? "bg-blue-900/50 text-blue-300" : "bg-blue-100 text-blue-600",
      val: isDarkMode ? "text-blue-300" : "text-blue-700",
      bg: isDarkMode ? "bg-gray-800" : "bg-white",
    },
  };
  const c = accents[accent] || accents.blue;

  return (
    <div className={`rounded-2xl border p-5 ${c.bg} ${c.ring} shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-medium mb-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            {label}
          </p>
          <p className={`text-2xl font-bold tracking-tight ${c.val}`}>{value}</p>
          {sub && (
            <p className={`text-xs mt-1 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{sub}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// ─── Mini bar chart (CSS only, no recharts needed) ────────────────────────────
function EarningsChart({ transactions, isDarkMode }) {
  const monthlyData = useMemo(() => {
    const map = {};
    transactions.forEach((tx) => {
      const k = monthKey(tx.completedAt);
      if (!map[k]) map[k] = { pending: 0, paid: 0 };
      if (tx.status === "pending") map[k].pending += tx.amount;
      if (tx.status === "paid") map[k].paid += tx.amount;
    });
    // Last 6 months
    const keys = Object.keys(map).sort().slice(-6);
    return keys.map((k) => ({ key: k, label: monthLabel(k), ...map[k] }));
  }, [transactions]);

  if (monthlyData.length === 0) return null;

  const maxVal = Math.max(...monthlyData.map((d) => d.pending + d.paid), 1);

  return (
    <div className={`rounded-2xl border p-5 ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} shadow-sm`}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className={`w-4 h-4 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
        <p className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
          Monthly Earnings
        </p>
        <div className="flex items-center gap-3 ml-auto">
          <span className="flex items-center gap-1.5 text-xs text-amber-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Pending
          </span>
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Paid
          </span>
        </div>
      </div>

      <div className="flex items-end gap-2 h-28">
        {monthlyData.map((d) => {
          const total = d.pending + d.paid;
          const paidH = Math.round((d.paid / maxVal) * 100);
          const pendingH = Math.round((d.pending / maxVal) * 100);
          return (
            <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: "88px" }}>
                {d.pending > 0 && (
                  <div
                    title={`Pending: ${fmtMoney(d.pending)}`}
                    className="w-full rounded-t bg-amber-400/80 transition-all"
                    style={{ height: `${pendingH}%`, minHeight: "4px" }}
                  />
                )}
                {d.paid > 0 && (
                  <div
                    title={`Paid: ${fmtMoney(d.paid)}`}
                    className="w-full rounded-b bg-emerald-400/80 transition-all"
                    style={{ height: `${paidH}%`, minHeight: "4px" }}
                  />
                )}
                {total === 0 && (
                  <div
                    className={`w-full rounded ${isDarkMode ? "bg-gray-700" : "bg-gray-100"}`}
                    style={{ height: "4px" }}
                  />
                )}
              </div>
              <p className={`text-[10px] font-medium truncate w-full text-center ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                {d.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, isDarkMode }) {
  const map = {
    pending: {
      cls: isDarkMode ? "bg-amber-900/40 text-amber-300 border-amber-700/40" : "bg-amber-50 text-amber-700 border-amber-200",
      icon: <Clock className="w-3 h-3" />,
    },
    paid: {
      cls: isDarkMode ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/40" : "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: <CheckCircle className="w-3 h-3" />,
    },
    cancelled: {
      cls: isDarkMode ? "bg-gray-700 text-gray-400 border-gray-600" : "bg-gray-100 text-gray-500 border-gray-200",
      icon: null,
    },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.cls}`}>
      {s.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Expandable transaction row ───────────────────────────────────────────────
function TxRow({ tx, isDarkMode }) {
  const [open, setOpen] = useState(false);

  const tdCls = `px-4 py-3.5 text-sm border-t ${isDarkMode ? "border-gray-700 text-gray-300" : "border-gray-100 text-gray-700"}`;

  return (
    <>
      <tr
        className={`cursor-pointer transition-colors ${
          isDarkMode ? "hover:bg-gray-700/50" : "hover:bg-gray-50"
        } ${open ? (isDarkMode ? "bg-gray-700/30" : "bg-blue-50/40") : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Date */}
        <td className={tdCls}>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
            <span>{fmtDate(tx.completedAt)}</span>
          </div>
        </td>

        {/* Class */}
        <td className={tdCls}>
          <p className="font-medium truncate max-w-[160px]">{tx.classTitle || "—"}</p>
          {tx.description && (
            <p className={`text-xs truncate ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
              {tx.description}
            </p>
          )}
        </td>

        {/* Student */}
        <td className={tdCls}>
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
            <span className="truncate max-w-[120px]">{tx.studentName || "—"}</span>
          </div>
        </td>

        {/* Amount */}
        <td className={tdCls}>
          <span
            className={`font-bold ${
              tx.type === "deduction"
                ? "text-red-500"
                : isDarkMode
                ? "text-emerald-400"
                : "text-emerald-600"
            }`}
          >
            {tx.type === "deduction" ? "-" : "+"}
            {fmtMoney(tx.amount)}
          </span>
        </td>

        {/* Status */}
        <td className={tdCls}>
          <StatusBadge status={tx.status} isDarkMode={isDarkMode} />
        </td>

        {/* Expand chevron */}
        <td className={tdCls}>
          <div className={`flex justify-end ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {open && (
        <tr className={isDarkMode ? "bg-gray-800/80" : "bg-blue-50/30"}>
          <td colSpan={6} className={`px-6 py-4 border-t ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <Detail label="Completed At" value={fmtDateTime(tx.completedAt)} isDarkMode={isDarkMode} />
              <Detail
                label="Paid At"
                value={tx.paidAt ? fmtDateTime(tx.paidAt) : "Not yet paid"}
                isDarkMode={isDarkMode}
              />
              <Detail
                label="Payment Method"
                value={tx.paymentMethod ? tx.paymentMethod.replace(/_/g, " ") : "—"}
                isDarkMode={isDarkMode}
              />
              <Detail
                label="Paid By"
                value={
                  tx.paidBy
                    ? `${tx.paidBy.firstName || ""} ${tx.paidBy.lastName || ""}`.trim()
                    : "—"
                }
                isDarkMode={isDarkMode}
              />
              {tx.notes && (
                <div className="col-span-2 sm:col-span-4">
                  <Detail label="Notes" value={tx.notes} isDarkMode={isDarkMode} />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ label, value, isDarkMode }) {
  return (
    <div>
      <p className={`font-semibold uppercase tracking-wide mb-0.5 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`} style={{ fontSize: "10px" }}>
        {label}
      </p>
      <p className={`font-medium ${isDarkMode ? "text-gray-200" : "text-gray-700"}`}>{value}</p>
    </div>
  );
}

// ─── Hero pending card ────────────────────────────────────────────────────────
function PendingHero({ amount, count, isDarkMode }) {
  return (
    <div className={`rounded-2xl p-6 ${
      isDarkMode
        ? "bg-gradient-to-br from-amber-900/60 to-amber-800/30 border border-amber-700/40"
        : "bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200"
    } shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-sm font-medium mb-1 ${isDarkMode ? "text-amber-400" : "text-amber-700"}`}>
            💰 Current Pending Balance
          </p>
          <p className={`text-4xl font-bold tracking-tight ${isDarkMode ? "text-amber-300" : "text-amber-800"}`}>
            {fmtMoney(amount)}
          </p>
          <p className={`text-sm mt-2 ${isDarkMode ? "text-amber-500" : "text-amber-600"}`}>
            {count} class{count !== 1 ? "es" : ""} awaiting payment
          </p>
        </div>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
          isDarkMode ? "bg-amber-800/60" : "bg-amber-100"
        }`}>
          <Wallet className={`w-7 h-7 ${isDarkMode ? "text-amber-300" : "text-amber-600"}`} />
        </div>
      </div>

      {amount > 0 && (
        <div className={`mt-4 flex items-start gap-2 text-xs ${isDarkMode ? "text-amber-500/80" : "text-amber-600/80"}`}>
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Your pending balance is paid out by admin. Contact admin if you have payment questions.
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function PaymentTab({ teacher, isDarkMode }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    totalPending: 0,
    totalPaid: 0,
    totalEarned: 0,
    pendingCount: 0,
    paidCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all"); // all | pending | paid | cancelled
  const [search, setSearch] = useState("");

  const load = async (silent = false) => {
    if (!teacher?._id) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const { data } = await api.get(`/api/payments/teacher/${teacher._id}`);
      setTransactions(data.transactions || []);
      setSummary(
        data.summary || {
          totalPending: 0,
          totalPaid: 0,
          totalEarned: 0,
          pendingCount: 0,
          paidCount: 0,
        }
      );
    } catch (err) {
      console.error("PaymentTab load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [teacher?._id]);

  // ── Filtered transactions ──
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesFilter = filter === "all" || tx.status === filter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        (tx.classTitle || "").toLowerCase().includes(q) ||
        (tx.studentName || "").toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [transactions, filter, search]);

  // ── Total all-time ──
  const allTimePaid = transactions
    .filter((t) => t.status === "paid")
    .reduce((s, t) => s + t.amount, 0);

  // ── UI tokens ──
  const pageBg = isDarkMode ? "bg-gray-900" : "bg-gray-50";
  const cardBg = isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const textPrimary = isDarkMode ? "text-white" : "text-gray-900";
  const textSecondary = isDarkMode ? "text-gray-400" : "text-gray-500";
  const inputCls = isDarkMode
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-purple-500 focus:border-purple-500"
    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-purple-400 focus:border-purple-400";
  const thCls = `px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${
    isDarkMode ? "text-gray-400 bg-gray-700/60" : "text-gray-500 bg-gray-50"
  }`;

  const filterTabs = [
    { key: "all", label: "All", count: transactions.length },
    { key: "pending", label: "Pending", count: summary.pendingCount },
    { key: "paid", label: "Paid", count: summary.paidCount },
    { key: "cancelled", label: "Cancelled", count: transactions.filter((t) => t.status === "cancelled").length },
  ];

  if (loading) {
    return (
      <div className={`${pageBg} rounded-2xl p-8 flex items-center justify-center gap-3 min-h-[400px]`}>
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span className={`text-sm ${textSecondary}`}>Loading your earnings…</span>
      </div>
    );
  }

  return (
    <div className={`${pageBg} rounded-2xl p-6 space-y-6`}>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className={`text-2xl font-bold ${textPrimary}`}>Salary & Earnings</h2>
          <p className={`text-sm mt-0.5 ${textSecondary}`}>
            Track your completed classes and payment history
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
            isDarkMode
              ? "border-gray-600 text-gray-300 hover:bg-gray-700"
              : "border-gray-200 text-gray-600 hover:bg-gray-100"
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Pending hero + stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <PendingHero
            amount={summary.totalPending}
            count={summary.pendingCount}
            isDarkMode={isDarkMode}
          />
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-2 gap-4">
          <StatCard
            icon={Award}
            label="Rate Per Class"
            value={fmtMoney(teacher?.ratePerClass)}
            sub="Your hourly rate"
            accent="purple"
            isDarkMode={isDarkMode}
          />
          <StatCard
            icon={CheckCircle}
            label="Total Paid Out"
            value={fmtMoney(allTimePaid)}
            sub={`${summary.paidCount} payments received`}
            accent="emerald"
            isDarkMode={isDarkMode}
          />
          <StatCard
            icon={BookOpen}
            label="Classes Completed"
            value={teacher?.lessonsCompleted || 0}
            sub="Current billing cycle"
            accent="blue"
            isDarkMode={isDarkMode}
          />
          <StatCard
            icon={TrendingUp}
            label="Total Earned"
            value={fmtMoney(summary.totalEarned)}
            sub="Pending + paid combined"
            accent="amber"
            isDarkMode={isDarkMode}
          />
        </div>
      </div>

      {/* ── Monthly earnings chart ── */}
      {transactions.length > 0 && (
        <EarningsChart transactions={transactions} isDarkMode={isDarkMode} />
      )}

      {/* ── Transaction table ── */}
      <div className={`rounded-2xl border overflow-hidden ${cardBg} shadow-sm`}>
        {/* Table toolbar */}
        <div className={`flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 border-b ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
          {/* Filter tabs */}
          <div className={`flex gap-1 p-1 rounded-lg ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`}>
            {filterTabs.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  filter === key
                    ? "bg-purple-600 text-white shadow-sm"
                    : isDarkMode
                    ? "text-gray-400 hover:text-gray-200"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    filter === key
                      ? "bg-white/25 text-white"
                      : isDarkMode
                      ? "bg-gray-700 text-gray-400"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Search */}
          <input
            type="text"
            placeholder="Search class or student…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full sm:w-52 px-3 py-2 text-sm rounded-lg border transition-colors ${inputCls}`}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={thCls}>Date Completed</th>
                <th className={thCls}>Class</th>
                <th className={thCls}>Student</th>
                <th className={thCls}>Amount</th>
                <th className={thCls}>Status</th>
                <th className={thCls} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`text-center py-16 text-sm ${textSecondary}`}>
                    <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    {transactions.length === 0
                      ? "No earnings yet. Complete a class to see your salary here."
                      : "No transactions match your search."}
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <TxRow key={tx._id} tx={tx} isDarkMode={isDarkMode} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer summary */}
        {filtered.length > 0 && (
          <div className={`flex items-center justify-between px-4 py-3 border-t text-xs ${isDarkMode ? "border-gray-700 text-gray-400" : "border-gray-100 text-gray-500"}`}>
            <span>
              {filtered.length} record{filtered.length !== 1 ? "s" : ""}
              {search && ` matching "${search}"`}
            </span>
            <span className="font-semibold">
              Subtotal:{" "}
              <span className={isDarkMode ? "text-emerald-400" : "text-emerald-600"}>
                {fmtMoney(filtered.reduce((s, t) => s + t.amount, 0))}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── Info note ── */}
      <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl text-xs ${
        isDarkMode ? "bg-blue-900/20 border border-blue-800/40 text-blue-300" : "bg-blue-50 border border-blue-100 text-blue-700"
      }`}>
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Each completed class automatically adds your rate (
          <strong>{fmtMoney(teacher?.ratePerClass)}</strong>) to your pending balance. 
          Admin marks transactions as <strong>Paid</strong> once the transfer is sent. 
          Click any row to see full payment details.
        </span>
      </div>
    </div>
  );
}
