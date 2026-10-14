// src/pages/admin/components/TeacherCard.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  MoreHorizontal, Edit3, Trash2, UserX, UserCheck,
  BookOpen, DollarSign, Copy, RotateCcw, Globe,
  Mail, TrendingUp, Eye, EyeOff, MinusCircle,
  History, Send, Clock, Video, Award, ChevronDown, FileDown, Star,
} from "lucide-react";
import { downloadTeacherCard } from "../../../utils/teacherPdf";
import { useCurrencySymbol } from "../../../hooks/useCurrencySymbol";
import { useTranslation } from "react-i18next";

function getInitials(firstName = "", lastName = "") {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// Deterministic avatar tint based on name — soft tile + dark initials, not a loud gradient
const AVATAR_TINTS = [
  { light: "bg-orange-50 text-orange-700 ring-orange-100",   dark: "bg-orange-500/15 text-orange-300 ring-orange-400/20" },
  { light: "bg-sky-50 text-sky-700 ring-sky-100",            dark: "bg-sky-500/15 text-sky-300 ring-sky-400/20" },
  { light: "bg-emerald-50 text-emerald-700 ring-emerald-100", dark: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20" },
  { light: "bg-rose-50 text-rose-700 ring-rose-100",         dark: "bg-rose-500/15 text-rose-300 ring-rose-400/20" },
  { light: "bg-amber-50 text-amber-700 ring-amber-100",      dark: "bg-amber-500/15 text-amber-300 ring-amber-400/20" },
  { light: "bg-slate-100 text-slate-700 ring-slate-200",     dark: "bg-slate-500/20 text-slate-200 ring-slate-400/20" },
];
function getAvatarTint(name = "", isDarkMode) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const tint = AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
  return isDarkMode ? tint.dark : tint.light;
}

function ContinentBadge({ continent, isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
      isDarkMode ? "bg-gray-700/60 text-gray-300" : "bg-gray-100 text-gray-600"
    }`}>
      <Globe className="w-3 h-3" />
      {continent || tr("teacherCard.unknown")}
    </span>
  );
}

// Renders 5 stars with partial fill via CSS clip trick
function StarRating({ rating, totalRatings, isDarkMode }) {
  const { t: tr } = useTranslation("admin");
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
      <span className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{tr("teacherCard.review", { totalRatings, value: totalRatings !== 1 ? "s" : "" })}</span>
    </div>
  );
}

// One cell of the stats strip — the number carries the weight, the label stays quiet
function Stat({ label, value, isDarkMode }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5 min-w-0">
      <span className={`text-[11px] font-medium uppercase tracking-wide ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums truncate ${isDarkMode ? "text-gray-100" : "text-gray-900"}`}>
        {value}
      </span>
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
  const { t: tr } = useTranslation("admin");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  const sym = useCurrencySymbol();
  const fullName    = `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();
  const displayName = teacher.displayName?.trim() || "";
  const initials    = getInitials(teacher.firstName, teacher.lastName);
  const avatarTint = getAvatarTint(fullName, isDarkMode);
  const isActive = teacher.active;
  const earned = (teacher.earned || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Close dropdown on outside click / Escape; focus the first item when it opens
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") { setMenuOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  // Arrow keys / Home / End move through the menu; Tab closes it
  const onMenuKeyDown = (e) => {
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    const go = (n) => { e.preventDefault(); items[(n + items.length) % items.length]?.focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Tab") setMenuOpen(false);
  };
  const run = (fn) => () => { setMenuOpen(false); fn?.(); };

  // The main button is whatever this teacher most likely needs next
  const isPending = teacher.status === "pending" && !!onResendInvite;
  const primary = isPending
    ? { key: "invite", icon: Send,      label: tr("teacherCard.resendInvite"), onClick: onResendInvite }
    : !isActive
    ? { key: "enable", icon: UserCheck, label: tr("teacherCard.enable"),       onClick: onToggle }
    : { key: "lesson", icon: BookOpen,  label: tr("teacherCard.markLessonShort"), onClick: onMarkLesson };

  const cardBase = isDarkMode
    ? "bg-gray-800 border-gray-700 hover:border-gray-600"
    : "bg-white border-gray-200 hover:border-gray-300 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

  const menuBg = isDarkMode
    ? "bg-gray-900 border-gray-700 shadow-2xl"
    : "bg-white border-gray-200 shadow-xl";

  return (
    <div
      className={`relative rounded-2xl border transition-colors duration-150 ${cardBase} ${
        !isActive ? "opacity-70" : ""
      }`}
    >
      <div className="p-5">
        {/* Header row: avatar + name + status + menu */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Avatar — status dot lives outside the clipped box so it isn't cut off */}
            <div className="relative flex-shrink-0">
            <div
              className={`w-11 h-11 rounded-xl overflow-hidden ring-1 ring-inset ${
                teacher.photo ? (isDarkMode ? "ring-white/10" : "ring-black/5") : `${avatarTint} flex items-center justify-center`
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
                className="font-semibold text-sm w-full h-full items-center justify-center"
                style={{ display: teacher.photo ? "none" : "flex" }}
              >
                {initials}
              </span>
            </div>
              {/* Status dot */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${
                  isDarkMode ? "border-gray-800" : "border-white"
                } ${isActive ? "bg-emerald-400" : "bg-gray-400"}`}
              />
            </div>

            {/* Name + display name + email */}
            <div className="min-w-0">
              <h3 className="font-semibold text-sm leading-tight truncate">
                <button
                  type="button"
                  onClick={onEdit}
                  className={`max-w-full truncate text-left hover:underline underline-offset-2 ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {displayName || fullName || tr("teacherCard.unnamedTeacher")}
                </button>
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

        </div>

        {/* Continent badge + pending setup badge */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ContinentBadge continent={teacher.continent} isDarkMode={isDarkMode} />
          {teacher.status === "pending" && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
              isDarkMode ? "bg-amber-900/50 text-amber-300" : "bg-amber-100 text-amber-700"
            }`}>
              <Clock className="w-3 h-3" />
              {tr("teacherCard.pendingSetup")}
            </span>
          )}
        </div>

        {/* Rating row */}
        <div className="mb-3">
          {teacher.avgRating != null && teacher.totalRatings > 0 ? (
            <StarRating rating={teacher.avgRating} totalRatings={teacher.totalRatings} isDarkMode={isDarkMode} />
          ) : (
            <span className={`text-xs italic ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
              {tr("teacherCard.noReviewsYet")}
            </span>
          )}
        </div>

        {/* Stats strip */}
        <div className={`grid grid-cols-3 mb-4 rounded-xl border divide-x ${
          isDarkMode ? "border-gray-700 divide-gray-700" : "border-gray-100 divide-gray-100 bg-gray-50/60"
        }`}>
          <Stat label={tr("teacherCard.rate")} value={`${sym}${teacher.ratePerClass || 0}`} isDarkMode={isDarkMode} />
          <Stat label={tr("teacherCard.lessons")} value={teacher.lessonsCompleted || 0} isDarkMode={isDarkMode} />
          <Stat label={tr("teacherCard.earned")} value={`${sym}${earned}`} isDarkMode={isDarkMode} />
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
              <span>{tr("teacherCard.profileDetails")}</span>
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
                    <TrendingUp className="w-3 h-3" />{teacher.yearsOfExperience} {tr("teacherCard.yrsExp")}
                  </span>
                )}
              </div>
            )}

            {/* Specializations */}
            {teacher.specializations?.length > 0 && (
              <div>
                <p className={`text-xs font-semibold mb-1.5 flex items-center gap-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                  <BookOpen className="w-3 h-3" /> {tr("teacherCard.specializations")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {teacher.specializations.slice(0, 4).map((s) => (
                    <span key={s} className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDarkMode ? "bg-brand-primary/20 text-brand-primary" : "bg-violet-50 text-violet-700"}`}>
                      {s}
                    </span>
                  ))}
                  {teacher.specializations.length > 4 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDarkMode ? "bg-gray-600 text-gray-300" : "bg-gray-100 text-gray-500"}`}>{tr("teacherCard.more", { value: teacher.specializations.length - 4 })}</span>
                  )}
                </div>
              </div>
            )}

            {/* Certifications */}
            {teacher.certifications?.length > 0 && (
              <div>
                <p className={`text-xs font-semibold mb-1.5 flex items-center gap-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                  <Award className="w-3 h-3" /> {tr("teacherCard.certifications")}
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
                <Video className="w-3 h-3" /> {tr("teacherCard.meetLink")}
              </a>
            )}
            {/* Zoom link */}
            {teacher.zoomLink && (
              <a
                href={teacher.zoomLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-xs font-medium hover:underline ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}
              >
                <span style={{ fontWeight: 900, fontSize: 11, fontFamily: "Arial,sans-serif" }}>Z</span> {tr("teacherCard.zoomLink")}
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
              {tr("teacherCard.temporaryPassword")}
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
                title={tr("teacherCard.copyPassword2")}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Actions: most-likely-next action · Edit · everything else */}
        <div className="flex gap-2">
          <button
            onClick={primary.onClick}
            title={primary.label}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition duration-150 active:scale-[0.97] ${
              isDarkMode
                ? "bg-white hover:bg-gray-200 text-gray-900"
                : "bg-gray-900 hover:bg-gray-800 text-white"
            }`}
          >
            <primary.icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{primary.label}</span>
          </button>

          <button
            onClick={onEdit}
            aria-label={tr("teacherCard.edit")}
            title={tr("teacherCard.edit")}
            className={`flex-shrink-0 flex items-center justify-center px-2.5 rounded-xl border transition duration-150 active:scale-[0.97] ${
              isDarkMode
                ? "border-gray-600 hover:bg-gray-700 text-gray-300"
                : "border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700"
            }`}
          >
            <Edit3 className="w-4 h-4" />
          </button>

          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              ref={triggerRef}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={tr("teacherCard.moreActions")}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={`h-full px-2.5 rounded-xl border transition duration-150 active:scale-[0.97] ${
                isDarkMode
                  ? `border-gray-600 text-gray-300 hover:bg-gray-700 ${menuOpen ? "bg-gray-700" : ""}`
                  : `border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 ${menuOpen ? "bg-gray-50 text-gray-700" : ""}`
              }`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Opens upward from the action row so it never runs off the bottom of the page */}
            {menuOpen && (
              <div
                role="menu"
                onKeyDown={onMenuKeyDown}
                className={`ui-pop-in origin-bottom-right absolute right-0 bottom-full mb-1.5 z-50 min-w-[200px] rounded-xl border ${menuBg} py-1.5 overflow-hidden`}
              >
                <MenuLabel isDarkMode={isDarkMode}>{tr("teacherCard.groupLessonsPay")}</MenuLabel>
                {primary.key !== "lesson" && (
                  <DropdownItem icon={BookOpen} label={tr("teacherCard.markLesson")} isDarkMode={isDarkMode} onClick={run(onMarkLesson)} />
                )}
                <DropdownItem icon={MinusCircle} label={tr("teacherCard.unmarkLesson")} isDarkMode={isDarkMode} onClick={run(onUnmarkLesson)} />
                <DropdownItem icon={DollarSign} label={tr("teacherCard.markAsPaid")} isDarkMode={isDarkMode} onClick={run(onPay)} />
                <DropdownItem icon={History} label={tr("teacherCard.paymentHistory")} isDarkMode={isDarkMode} onClick={run(onPayHistory)} />

                <MenuDivider isDarkMode={isDarkMode} />
                <MenuLabel isDarkMode={isDarkMode}>{tr("teacherCard.groupAccount")}</MenuLabel>
                {teacher.status === "pending" && primary.key !== "invite" && onResendInvite && (
                  <DropdownItem icon={Send} label={tr("teacherCard.resendInvite")} isDarkMode={isDarkMode} onClick={run(onResendInvite)} />
                )}
                <DropdownItem icon={RotateCcw} label={tr("teacherCard.resetPassword")} isDarkMode={isDarkMode} onClick={run(onResetPassword)} />
                {teacher.password && (
                  <DropdownItem icon={Copy} label={tr("teacherCard.copyPassword")} isDarkMode={isDarkMode} onClick={run(onCopyPassword)} />
                )}
                <DropdownItem
                  icon={FileDown}
                  label={tr("teacherCard.downloadPdf")}
                  isDarkMode={isDarkMode}
                  onClick={run(() => downloadTeacherCard(teacher).catch(err => { console.error(err); alert(`Could not create the PDF: ${err?.message || "unknown error"}`); }))}
                />

                <MenuDivider isDarkMode={isDarkMode} />
                {primary.key !== "enable" && (
                  <DropdownItem
                    icon={isActive ? UserX : UserCheck}
                    label={isActive ? tr("teacherCard.disableTeacher") : tr("teacherCard.enableTeacher")}
                    isDarkMode={isDarkMode}
                    onClick={run(onToggle)}
                  />
                )}
                <DropdownItem icon={Trash2} label={tr("teacherCard.deleteTeacher")} color="red" isDarkMode={isDarkMode} onClick={run(onDelete)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuLabel({ isDarkMode, children }) {
  return (
    <div className={`px-3.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
      {children}
    </div>
  );
}

function MenuDivider({ isDarkMode }) {
  return <div role="separator" className={`my-1 h-px ${isDarkMode ? "bg-gray-700" : "bg-gray-100"}`} />;
}

// Menu items are neutral; only destructive actions get colour
function DropdownItem({ icon: Icon, label, color, isDarkMode, onClick }) {
  const tone = color === "red"
    ? (isDarkMode ? "text-red-400 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50")
    : (isDarkMode ? "text-gray-200 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-50");
  const iconTone = color === "red" ? "" : (isDarkMode ? "text-gray-500" : "text-gray-400");

  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-left transition-colors outline-none ${tone} ${
        isDarkMode ? "focus-visible:bg-gray-800" : "focus-visible:bg-gray-50"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconTone}`} />
      {label}
    </button>
  );
}
