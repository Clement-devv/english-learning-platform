// src/pages/admin/components/StudentCard.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Edit3,
  Trash2,
  UserX,
  UserCheck,
  BookOpen,
  DollarSign,
  Copy,
  RotateCcw,
  Mail,
  Eye,
  EyeOff,
  History,
  Receipt,
  AlertTriangle,
  GraduationCap,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(firstName = "", surname = "") {
  return `${firstName.charAt(0)}${surname.charAt(0)}`.toUpperCase();
}

function getAvatarColor(name = "") {
  const colors = [
    "from-sky-500 to-blue-600",
    "from-fuchsia-500 to-purple-600",
    "from-teal-500 to-emerald-600",
    "from-orange-500 to-amber-600",
    "from-rose-500 to-pink-600",
    "from-indigo-500 to-violet-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatLastPayment(dateStr) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

// Classes remaining urgency level
function getClassesUrgency(count) {
  if (count <= 0) return "empty";
  if (count <= 3) return "critical";
  if (count <= 6) return "low";
  return "ok";
}

function ClassesBadge({ count, isDarkMode }) {
  const urgency = getClassesUrgency(count);

  const styles = {
    empty: {
      bg: isDarkMode ? "bg-red-900/50 border-red-700/50" : "bg-red-50 border-red-200",
      text: isDarkMode ? "text-red-300" : "text-red-700",
      label: "No classes left",
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    critical: {
      bg: isDarkMode ? "bg-orange-900/40 border-orange-700/40" : "bg-orange-50 border-orange-200",
      text: isDarkMode ? "text-orange-300" : "text-orange-700",
      label: `${count} class${count === 1 ? "" : "es"} left`,
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    low: {
      bg: isDarkMode ? "bg-amber-900/40 border-amber-700/40" : "bg-amber-50 border-amber-200",
      text: isDarkMode ? "text-amber-300" : "text-amber-700",
      label: `${count} classes left`,
      icon: <BookOpen className="w-3 h-3" />,
    },
    ok: {
      bg: isDarkMode ? "bg-emerald-900/30 border-emerald-700/30" : "bg-emerald-50 border-emerald-200",
      text: isDarkMode ? "text-emerald-300" : "text-emerald-700",
      label: `${count} classes`,
      icon: <BookOpen className="w-3 h-3" />,
    },
  };

  const s = styles[urgency];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

function StatPill({ label, value, color, isDarkMode }) {
  const colorMap = {
    blue: isDarkMode ? "bg-blue-900/40 text-blue-300" : "bg-blue-50 text-blue-700",
    amber: isDarkMode ? "bg-amber-900/40 text-amber-300" : "bg-amber-50 text-amber-700",
    purple: isDarkMode ? "bg-purple-900/40 text-purple-300" : "bg-purple-50 text-purple-700",
  };
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${colorMap[color]}`}>
      <span className="text-xs font-medium opacity-70">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function StudentCard({
  student,
  isDarkMode,
  onEdit,
  onDelete,
  onToggle,
  onMarkLesson,
  onManualPayment,
  onViewPayment,
  onViewLessons,
  onResetPassword,
  onCopyPassword,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const menuRef = useRef(null);

  const fullName = `${student.firstName || ""} ${student.surname || ""}`.trim();
  const initials = getInitials(student.firstName, student.surname);
  const avatarGradient = getAvatarColor(fullName);
  const isActive = student.active;
  const urgency = getClassesUrgency(student.noOfClasses ?? 0);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const cardBase = isDarkMode
    ? "bg-gray-800 border-gray-700 hover:border-gray-600"
    : "bg-white border-gray-200 hover:border-gray-300";

  const menuBg = isDarkMode
    ? "bg-gray-900 border-gray-700 shadow-2xl"
    : "bg-white border-gray-200 shadow-xl";

  // Top stripe color
  const stripeColor =
    urgency === "empty"
      ? "bg-gradient-to-r from-red-400 to-rose-500"
      : urgency === "critical"
      ? "bg-gradient-to-r from-orange-400 to-amber-500"
      : isActive
      ? "bg-gradient-to-r from-sky-400 to-blue-500"
      : "bg-gradient-to-r from-gray-300 to-gray-400";

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-200 hover:shadow-lg ${cardBase} ${
        !isActive ? "opacity-70" : ""
      }`}
    >
      {/* Status stripe */}
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${stripeColor}`} />

      <div className="p-5 pt-6">
        {/* ── Header: avatar + name + menu ── */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
            <div
              className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center flex-shrink-0 shadow-md`}
            >
              <span className="text-white font-bold text-sm">{initials}</span>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${
                  isDarkMode ? "border-gray-800" : "border-white"
                } ${isActive ? "bg-emerald-400" : "bg-gray-400"}`}
              />
            </div>

            {/* Name + email */}
            <div className="min-w-0">
              <h3
                className={`font-semibold text-sm leading-tight truncate ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                {fullName || "Unnamed Student"}
              </h3>
              <p
                className={`text-xs truncate flex items-center gap-1 mt-0.5 ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                <Mail className="w-3 h-3 flex-shrink-0" />
                {student.email}
              </p>
            </div>
          </div>

          {/* 3-dot menu */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                isDarkMode
                  ? "hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                  : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className={`absolute right-0 top-full mt-1 z-50 min-w-[185px] rounded-xl border ${menuBg} py-1.5 overflow-hidden`}
              >
                {/* History group */}
                <div
                  className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                    isDarkMode ? "text-gray-500" : "text-gray-400"
                  }`}
                >
                  History
                </div>
                <DropdownItem
                  icon={Receipt}
                  label="Payment History"
                  color="green"
                  isDarkMode={isDarkMode}
                  onClick={() => { onViewPayment(); setMenuOpen(false); }}
                />
                <DropdownItem
                  icon={History}
                  label="Lesson History"
                  color="blue"
                  isDarkMode={isDarkMode}
                  onClick={() => { onViewLessons(); setMenuOpen(false); }}
                />

                <div className={`my-1 h-px ${isDarkMode ? "bg-gray-700" : "bg-gray-100"}`} />

                {/* Actions group */}
                <div
                  className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                    isDarkMode ? "text-gray-500" : "text-gray-400"
                  }`}
                >
                  Actions
                </div>
                <DropdownItem
                  icon={DollarSign}
                  label="Manual Payment"
                  color="emerald"
                  isDarkMode={isDarkMode}
                  onClick={() => { onManualPayment(); setMenuOpen(false); }}
                />
                <DropdownItem
                  icon={BookOpen}
                  label="Mark Lesson"
                  color="purple"
                  isDarkMode={isDarkMode}
                  onClick={() => { onMarkLesson(); setMenuOpen(false); }}
                />
                <DropdownItem
                  icon={RotateCcw}
                  label="Reset Password"
                  color="amber"
                  isDarkMode={isDarkMode}
                  onClick={() => { onResetPassword(); setMenuOpen(false); }}
                />
                {student.tempPassword && (
                  <DropdownItem
                    icon={Copy}
                    label="Copy Password"
                    color="indigo"
                    isDarkMode={isDarkMode}
                    onClick={() => { onCopyPassword(); setMenuOpen(false); }}
                  />
                )}

                <div className={`my-1 h-px ${isDarkMode ? "bg-gray-700" : "bg-gray-100"}`} />

                {/* Danger zone */}
                <DropdownItem
                  icon={Trash2}
                  label="Delete Student"
                  color="red"
                  isDarkMode={isDarkMode}
                  onClick={() => { onDelete(); setMenuOpen(false); }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Classes remaining badge ── */}
        <div className="mb-4">
          <ClassesBadge count={student.noOfClasses ?? 0} isDarkMode={isDarkMode} />
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatPill
            label="Age"
            value={student.age ? `${student.age}y` : "—"}
            color="blue"
            isDarkMode={isDarkMode}
          />
          <StatPill
            label="Classes"
            value={student.noOfClasses ?? 0}
            color="amber"
            isDarkMode={isDarkMode}
          />
          <StatPill
            label="Last Pay"
            value={formatLastPayment(student.lastPaymentDate)}
            color="purple"
            isDarkMode={isDarkMode}
          />
        </div>

        {/* ── No-classes warning banner ── */}
        {urgency === "empty" && isActive && (
          <div
            className={`mb-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
              isDarkMode
                ? "bg-red-900/30 border border-red-700/40 text-red-300"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Needs top-up — account will disable
          </div>
        )}

        {/* ── Temp password display ── */}
        {student.showTempPassword && student.tempPassword && (
          <div
            className={`mb-4 p-3 rounded-xl border ${
              isDarkMode
                ? "bg-amber-900/30 border-amber-700/50"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <p
              className={`text-xs font-semibold mb-1.5 ${
                isDarkMode ? "text-amber-300" : "text-amber-700"
              }`}
            >
              🔑 Temporary Password
            </p>
            <div className="flex items-center gap-2">
              <code
                className={`flex-1 text-xs font-mono px-2 py-1 rounded-lg truncate ${
                  isDarkMode
                    ? "bg-gray-900 text-amber-300"
                    : "bg-white text-amber-800 border border-amber-200"
                }`}
              >
                {showPassword ? student.tempPassword : "••••••••"}
              </code>
              <button
                onClick={() => setShowPassword((v) => !v)}
                className={`p-1.5 rounded-lg flex-shrink-0 ${
                  isDarkMode ? "hover:bg-amber-800/40 text-amber-400" : "hover:bg-amber-100 text-amber-600"
                }`}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onCopyPassword}
                className={`p-1.5 rounded-lg flex-shrink-0 ${
                  isDarkMode ? "hover:bg-amber-800/40 text-amber-400" : "hover:bg-amber-100 text-amber-600"
                }`}
                title="Copy password"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Primary action buttons ── */}
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-150 shadow-sm ${
              isDarkMode
                ? "bg-sky-600 hover:bg-sky-500 text-white"
                : "bg-sky-600 hover:bg-sky-700 text-white"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>

          <button
            onClick={onToggle}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-150 shadow-sm ${
              isActive
                ? isDarkMode
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                : isDarkMode
                ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {isActive ? (
              <><UserX className="w-3.5 h-3.5" />Disable</>
            ) : (
              <><UserCheck className="w-3.5 h-3.5" />Enable</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dropdown item ─────────────────────────────────────────────────────────────
function DropdownItem({ icon: Icon, label, color, isDarkMode, onClick }) {
  const colorMap = {
    green: isDarkMode ? "text-green-400 hover:bg-green-900/40" : "text-green-600 hover:bg-green-50",
    blue: isDarkMode ? "text-blue-400 hover:bg-blue-900/40" : "text-blue-600 hover:bg-blue-50",
    emerald: isDarkMode ? "text-emerald-400 hover:bg-emerald-900/40" : "text-emerald-600 hover:bg-emerald-50",
    purple: isDarkMode ? "text-purple-400 hover:bg-purple-900/40" : "text-purple-600 hover:bg-purple-50",
    amber: isDarkMode ? "text-amber-400 hover:bg-amber-900/40" : "text-amber-600 hover:bg-amber-50",
    indigo: isDarkMode ? "text-indigo-400 hover:bg-indigo-900/40" : "text-indigo-600 hover:bg-indigo-50",
    red: isDarkMode ? "text-red-400 hover:bg-red-900/40" : "text-red-600 hover:bg-red-50",
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition-colors ${colorMap[color]}`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {label}
    </button>
  );
}
