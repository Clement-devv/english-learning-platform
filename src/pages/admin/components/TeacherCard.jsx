// src/pages/admin/components/TeacherCard.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  MoreVertical, Edit3, Trash2, UserX, UserCheck,
  BookOpen, DollarSign, Copy, RotateCcw, Globe,
  Mail, TrendingUp, Eye, EyeOff, MinusCircle,
  History, Send, Clock, Video, Award, ChevronDown, FileDown, Star,
} from "lucide-react";
import { downloadTeacherCard } from "../../../utils/teacherPdf";
import { useCurrencySymbol } from "../../../hooks/useCurrencySymbol";

function getInitials(firstName = "", lastName = "") {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// Deterministic avatar color based on name
function getAvatarColor(name = "") {
  const colors = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-cyan-500 to-sky-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function ContinentBadge({ continent, isDarkMode }) {
  const map = {
    Africa: { bg: isDarkMode ? "bg-amber-900/50 text-amber-300" : "bg-amber-100 text-amber-800", emoji: "🌍" },
    Europe: { bg: isDarkMode ? "bg-blue-900/50 text-blue-300" : "bg-blue-100 text-blue-800", emoji: "🌍" },
    Asia: { bg: isDarkMode ? "bg-green-900/50 text-green-300" : "bg-green-100 text-green-800", emoji: "🌏" },
    "North America": { bg: isDarkMode ? "bg-purple-900/50 text-purple-300" : "bg-purple-100 text-purple-800", emoji: "🌎" },
    "South America": { bg: isDarkMode ? "bg-rose-900/50 text-rose-300" : "bg-rose-100 text-rose-800", emoji: "🌎" },
  };
  const style = map[continent] || {
    bg: isDarkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600",
    emoji: "🌐",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg}`}>
      <Globe className="w-3 h-3" />
      {continent || "Unknown"}
    </span>
  );
}

// Renders 5 stars with partial fill via CSS clip trick
function StarRating({ rating, totalRatings, isDarkMode }) {
  const pct = Math.round((rating / 5) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative inline-flex" style={{ fontSize: 13, lineHeight: 1 }}>
        {/* Empty stars */}
        <span style={{ color: isDarkMode ? "#4b5563" : "#d1d5db", letterSpacing: 1 }}>★★★★★</span>
        {/* Filled stars overlay */}
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${pct}%`, color: "#f59e0b", letterSpacing: 1 }}
        >
          ★★★★★
        </span>
      </div>
      <span className={`text-xs font-bold ${isDarkMode ? "text-amber-400" : "text-amber-500"}`}>
        {rating.toFixed(1)}
      </span>
      <span className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
        ({totalRatings} review{totalRatings !== 1 ? "s" : ""})
      </span>
    </div>
  );
}

function StatPill({ label, value, color, isDarkMode }) {
  const colorMap = {
    blue: isDarkMode ? "bg-blue-900/40 text-blue-300" : "bg-blue-50 text-blue-700",
    green: isDarkMode ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-50 text-emerald-700",
    amber: isDarkMode ? "bg-amber-900/40 text-amber-300" : "bg-amber-50 text-amber-700",
  };
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${colorMap[color]}`}>
      <span className="text-xs font-medium opacity-70">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

export default function TeacherCard({
  teacher,
  isDarkMode,
  onEdit,
  onDelete,
  onToggle,
  onMarkLesson,
  onUnmarkLesson,
  onPay,
  onCopyPassword,
  onResetPassword,
  onPayHistory,
  onResendInvite,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const menuRef = useRef(null);

  const sym = useCurrencySymbol();
  const fullName    = `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();
  const displayName = teacher.displayName?.trim() || "";
  const initials    = getInitials(teacher.firstName, teacher.lastName);
  const avatarGradient = getAvatarColor(fullName);
  const isActive = teacher.active;
  const earned = (teacher.earned || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Close dropdown on outside click
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

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-200 hover:shadow-lg ${cardBase} ${
        !isActive ? "opacity-70" : ""
      }`}
    >
      {/* Status stripe */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${
          teacher.status === "pending"
            ? "bg-gradient-to-r from-amber-400 to-orange-400"
            : isActive
            ? "bg-gradient-to-r from-emerald-400 to-teal-500"
            : "bg-gradient-to-r from-gray-300 to-gray-400"
        }`}
      />

      <div className="p-5 pt-6">
        {/* Header row: avatar + name + status + menu */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div
              className={`relative w-12 h-12 rounded-xl flex-shrink-0 shadow-md overflow-hidden ${
                teacher.photo ? "" : `bg-gradient-to-br ${avatarGradient} flex items-center justify-center`
              }`}
            >
              {teacher.photo ? (
                <img
                  src={teacher.photo}
                  alt={fullName}
                  className="w-full h-full object-cover"
                  onError={e => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextSibling.style.display = "flex";
                  }}
                />
              ) : null}
              {/* Fallback initials — shown when no photo or photo fails to load */}
              <span
                className="text-white font-bold text-sm w-full h-full items-center justify-center"
                style={{ display: teacher.photo ? "none" : "flex" }}
              >
                {initials}
              </span>
              {/* Status dot */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${
                  isDarkMode ? "border-gray-800" : "border-white"
                } ${isActive ? "bg-emerald-400" : "bg-gray-400"}`}
              />
            </div>

            {/* Name + display name + email */}
            <div className="min-w-0">
              <h3
                className={`font-semibold text-sm leading-tight truncate ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                {displayName || fullName || "Unnamed Teacher"}
              </h3>
              {displayName && (
                <p className={`text-xs truncate mt-0.5 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                  {fullName}
                </p>
              )}
              <p
                className={`text-xs truncate flex items-center gap-1 mt-0.5 ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                <Mail className="w-3 h-3 flex-shrink-0" />
                {teacher.email}
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

            {/* Dropdown */}
            {menuOpen && (
              <div
                className={`absolute right-0 top-full mt-1 z-50 min-w-[170px] rounded-xl border ${menuBg} py-1.5 overflow-hidden`}
              >
                {teacher.status === "pending" && (
                  <>
                    <DropdownItem
                      icon={Send}
                      label="Resend Invite"
                      color="amber"
                      isDarkMode={isDarkMode}
                      onClick={() => {
                        onResendInvite?.();
                        setMenuOpen(false);
                      }}
                    />
                    <div className={`my-1 h-px ${isDarkMode ? "bg-gray-700" : "bg-gray-100"}`} />
                  </>
                )}
                <DropdownItem
                  icon={BookOpen}
                  label="Mark Lesson"
                  color="blue"
                  isDarkMode={isDarkMode}
                  onClick={() => {
                    onMarkLesson();
                    setMenuOpen(false);
                  }}
                />
                <DropdownItem
                  icon={MinusCircle}
                  label="Unmark Lesson"
                  color="rose"
                  isDarkMode={isDarkMode}
                  onClick={() => {
                    onUnmarkLesson();
                    setMenuOpen(false);
                  }}
                />
                <DropdownItem
                  icon={DollarSign}
                  label="Mark as Paid"
                  color="emerald"
                  isDarkMode={isDarkMode}
                  onClick={() => {
                    onPay();
                    setMenuOpen(false);
                  }}
                />
                <DropdownItem
                  icon={History}
                  label="Payment History"
                  color="indigo"
                  isDarkMode={isDarkMode}
                  onClick={() => {
                    onPayHistory?.();
                    setMenuOpen(false);
                  }}
                />
                <DropdownItem
                  icon={RotateCcw}
                  label="Reset Password"
                  color="purple"
                  isDarkMode={isDarkMode}
                  onClick={() => {
                    onResetPassword();
                    setMenuOpen(false);
                  }}
                />
                {teacher.password && (
                  <DropdownItem
                    icon={Copy}
                    label="Copy Password"
                    color="indigo"
                    isDarkMode={isDarkMode}
                    onClick={() => {
                      onCopyPassword();
                      setMenuOpen(false);
                    }}
                  />
                )}

                <DropdownItem
                  icon={FileDown}
                  label="Download PDF"
                  color="indigo"
                  isDarkMode={isDarkMode}
                  onClick={() => { downloadTeacherCard(teacher); setMenuOpen(false); }}
                />

                {/* Divider */}
                <div
                  className={`my-1 h-px ${
                    isDarkMode ? "bg-gray-700" : "bg-gray-100"
                  }`}
                />

                <DropdownItem
                  icon={Trash2}
                  label="Delete Teacher"
                  color="red"
                  isDarkMode={isDarkMode}
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Continent badge + pending setup badge */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ContinentBadge continent={teacher.continent} isDarkMode={isDarkMode} />
          {teacher.status === "pending" && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
              isDarkMode ? "bg-amber-900/50 text-amber-300" : "bg-amber-100 text-amber-700"
            }`}>
              <Clock className="w-3 h-3" />
              Pending Setup
            </span>
          )}
        </div>

        {/* Rating row */}
        <div className="mb-3">
          {teacher.avgRating != null && teacher.totalRatings > 0 ? (
            <StarRating rating={teacher.avgRating} totalRatings={teacher.totalRatings} isDarkMode={isDarkMode} />
          ) : (
            <span className={`text-xs italic ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
              No reviews yet
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatPill
            label="Rate"
            value={`${sym}${teacher.ratePerClass || 0}`}
            color="blue"
            isDarkMode={isDarkMode}
          />
          <StatPill
            label="Lessons"
            value={teacher.lessonsCompleted || 0}
            color="amber"
            isDarkMode={isDarkMode}
          />
          <StatPill
            label="Earned"
            value={`${sym}${earned}`}
            color="green"
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Professional profile extras */}
        {(teacher.bio || teacher.specializations?.length > 0 || teacher.certifications?.length > 0 || teacher.timezone || teacher.yearsOfExperience > 0) && (
          <div className={`mb-4 rounded-xl overflow-hidden ${isDarkMode ? "bg-gray-700/40" : "bg-gray-50"}`}>

            {/* Toggle header */}
            <button
              type="button"
              onClick={() => setProfileExpanded(v => !v)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors ${
                isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span>Profile Details</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${profileExpanded ? "rotate-180" : ""}`}
              />
            </button>

            {/* Collapsible content */}
            {profileExpanded && (
          <div className="px-3 pb-3 space-y-2.5">

            {/* Bio */}
            {teacher.bio && (
              <p className={`text-xs leading-relaxed line-clamp-2 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                {teacher.bio}
              </p>
            )}

            {/* Timezone + Experience row */}
            {(teacher.timezone || teacher.yearsOfExperience > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {teacher.timezone && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isDarkMode ? "bg-blue-900/40 text-blue-300" : "bg-blue-50 text-blue-700"}`}>
                    <Clock className="w-3 h-3" />{teacher.timezone}
                  </span>
                )}
                {teacher.yearsOfExperience > 0 && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isDarkMode ? "bg-purple-900/40 text-purple-300" : "bg-purple-50 text-purple-700"}`}>
                    <TrendingUp className="w-3 h-3" />{teacher.yearsOfExperience} yrs exp
                  </span>
                )}
              </div>
            )}

            {/* Specializations */}
            {teacher.specializations?.length > 0 && (
              <div>
                <p className={`text-xs font-semibold mb-1.5 flex items-center gap-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                  <BookOpen className="w-3 h-3" /> Specializations
                </p>
                <div className="flex flex-wrap gap-1">
                  {teacher.specializations.slice(0, 4).map((s) => (
                    <span key={s} className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDarkMode ? "bg-brand-primary/20 text-brand-primary" : "bg-violet-50 text-violet-700"}`}>
                      {s}
                    </span>
                  ))}
                  {teacher.specializations.length > 4 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDarkMode ? "bg-gray-600 text-gray-300" : "bg-gray-100 text-gray-500"}`}>
                      +{teacher.specializations.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Certifications */}
            {teacher.certifications?.length > 0 && (
              <div>
                <p className={`text-xs font-semibold mb-1.5 flex items-center gap-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                  <Award className="w-3 h-3" /> Certifications
                </p>
                <div className="flex flex-wrap gap-1">
                  {teacher.certifications.map((c) => (
                    <span key={c} className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDarkMode ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Google Meet link */}
            {teacher.googleMeetLink && (
              <a
                href={teacher.googleMeetLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-xs font-medium hover:underline ${isDarkMode ? "text-cyan-400" : "text-cyan-600"}`}
              >
                <Video className="w-3 h-3" /> Meet / Zoom Link
              </a>
            )}
          </div>
            )}
          </div>
        )}

        {/* Temp password display */}
        {teacher.showTempPassword && teacher.password && (
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
                className={`flex-1 text-xs font-mono px-2 py-1 rounded-lg ${
                  isDarkMode
                    ? "bg-gray-900 text-amber-300"
                    : "bg-white text-amber-800 border border-amber-200"
                }`}
              >
                {showPassword ? teacher.password : "••••••••"}
              </code>
              <button
                onClick={() => setShowPassword((v) => !v)}
                className={`p-1.5 rounded-lg ${
                  isDarkMode
                    ? "hover:bg-amber-800/40 text-amber-400"
                    : "hover:bg-amber-100 text-amber-600"
                }`}
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={onCopyPassword}
                className={`p-1.5 rounded-lg ${
                  isDarkMode
                    ? "hover:bg-amber-800/40 text-amber-400"
                    : "hover:bg-amber-100 text-amber-600"
                }`}
                title="Copy password"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Primary action buttons */}
        <div className="flex gap-2">
          {/* Edit - primary */}
          <button
            onClick={onEdit}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-150 ${
              isDarkMode
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            } shadow-sm`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>

          {/* Toggle active/disabled */}
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
              <>
                <UserX className="w-3.5 h-3.5" />
                Disable
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                Enable
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DropdownItem({ icon: Icon, label, color, isDarkMode, onClick }) {
  const colorMap = {
    blue: isDarkMode ? "text-blue-400 hover:bg-blue-900/40" : "text-blue-600 hover:bg-blue-50",
    emerald: isDarkMode ? "text-emerald-400 hover:bg-emerald-900/40" : "text-emerald-600 hover:bg-emerald-50",
    purple: isDarkMode ? "text-purple-400 hover:bg-purple-900/40" : "text-purple-600 hover:bg-purple-50",
    indigo: isDarkMode ? "text-indigo-400 hover:bg-indigo-900/40" : "text-indigo-600 hover:bg-indigo-50",
    red: isDarkMode ? "text-red-400 hover:bg-red-900/40" : "text-red-600 hover:bg-red-50",
    rose: isDarkMode ? "text-rose-400 hover:bg-rose-900/40" : "text-rose-600 hover:bg-rose-50",
    amber: isDarkMode ? "text-amber-400 hover:bg-amber-900/40" : "text-amber-600 hover:bg-amber-50",
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
