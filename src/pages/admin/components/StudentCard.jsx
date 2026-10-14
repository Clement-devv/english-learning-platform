// src/pages/admin/components/StudentCard.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  MoreHorizontal,
  Edit3,
  Trash2,
  UserX,
  UserCheck,
  BookOpen,
  DollarSign,
  Ticket,
  Copy,
  RotateCcw,
  Mail,
  Eye,
  EyeOff,
  History,
  Receipt,
  AlertTriangle,
  GraduationCap,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  Phone,
  Globe,
  Award,
  Calendar,
  FileDown,
  KeyRound,
  BellRing,
} from "lucide-react";
import { downloadStudentCard } from "../../../utils/studentPdf";
import { useTranslation } from "react-i18next";
import { dateLocale } from "../../../i18n/dateLocale.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(firstName = "", lastName = "") {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// Soft tile + dark initials (same palette as TeacherCard)
const AVATAR_TINTS = [
  { light: "bg-orange-50 text-orange-700 ring-orange-100",   dark: "bg-orange-500/15 text-orange-300 ring-orange-400/20" },
  { light: "bg-sky-50 text-sky-700 ring-sky-100",            dark: "bg-sky-500/15 text-sky-300 ring-sky-400/20" },
  { light: "bg-emerald-50 text-emerald-700 ring-emerald-100", dark: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20" },
  { light: "bg-rose-50 text-rose-700 ring-rose-100",         dark: "bg-rose-500/15 text-rose-300 ring-rose-400/20" },
  { light: "bg-amber-50 text-amber-700 ring-amber-100",      dark: "bg-amber-500/15 text-amber-300 ring-amber-400/20" },
  { light: "bg-stone-100 text-stone-700 ring-stone-200",     dark: "bg-stone-500/20 text-stone-200 ring-stone-400/20" },
];
function getAvatarTint(name = "", isDarkMode) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const tint = AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
  return isDarkMode ? tint.dark : tint.light;
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
  return d.toLocaleDateString(dateLocale("en-GB"), { day: "numeric", month: "short", year: "2-digit" });
}

// Classes remaining urgency level
function getClassesUrgency(count) {
  if (count <= 0) return "empty";
  if (count <= 3) return "critical";
  if (count <= 6) return "low";
  return "ok";
}

function ClassesBadge({ count, isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  const urgency = getClassesUrgency(count);

  const styles = {
    empty: {
      bg: isDarkMode ? "bg-red-900/50 border-red-700/50" : "bg-red-50 border-red-200",
      text: isDarkMode ? "text-red-300" : "text-red-700",
      label: tr("studentCard.noClassesLeft"),
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    critical: {
      bg: isDarkMode ? "bg-orange-900/40 border-orange-700/40" : "bg-orange-50 border-orange-200",
      text: isDarkMode ? "text-orange-300" : "text-orange-700",
      label: tr("studentCard.classLeft", { count, value: count === 1 ? "" : "es" }),
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    low: {
      bg: isDarkMode ? "bg-amber-900/40 border-amber-700/40" : "bg-amber-50 border-amber-200",
      text: isDarkMode ? "text-amber-300" : "text-amber-700",
      label: tr("studentCard.classesLeft", { count }),
      icon: <BookOpen className="w-3 h-3" />,
    },
    ok: {
      bg: isDarkMode ? "bg-emerald-900/30 border-emerald-700/30" : "bg-emerald-50 border-emerald-200",
      text: isDarkMode ? "text-emerald-300" : "text-emerald-700",
      label: tr("studentCard.classes", { count }),
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

// One cell of the stats strip — the number carries the weight, the label stays quiet
function Stat({ label, value, isDarkMode }) {
  return (
    <div className="flex flex-col gap-0.5 px-2.5 py-2.5 min-w-0">
      <span className={`text-[11px] font-medium uppercase tracking-wide ${isDarkMode ? "text-stone-500" : "text-stone-400"}`}>
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums truncate ${isDarkMode ? "text-stone-100" : "text-stone-900"}`}>
        {value}
      </span>
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
  onUnmarkLesson,
  onManualPayment,
  onSellPoints,
  onViewPayment,
  onViewLessons,
  onResetPassword,
  onCopyPassword,
  onResendInvite,
  onConvert,
  onNotifications,
}) {
  const { t: tr } = useTranslation("admin");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  const fullName = `${student.firstName || ""} ${student.lastName || ""}`.trim();
  const initials = getInitials(student.firstName, student.lastName);
  const avatarTint = getAvatarTint(fullName, isDarkMode);
  const isActive = student.active;
  const urgency = getClassesUrgency(student.classCredits ?? 0);

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

  // The main button is whatever this student most likely needs next:
  // finish the invite → re-enable → top up when running low → otherwise log a lesson
  const isPendingInvite = student.status === "pending" && !student.isManaged && !!onResendInvite;
  const primary = isPendingInvite
    ? { key: "invite",  icon: Mail,       label: tr("studentCard.resendInvite"), onClick: onResendInvite }
    : !isActive
    ? { key: "enable",  icon: UserCheck,  label: tr("studentCard.enable"),       onClick: onToggle }
    : urgency === "empty" || urgency === "critical"
    ? { key: "payment", icon: DollarSign, label: tr("studentCard.addPayment"),   onClick: onManualPayment }
    : { key: "lesson",  icon: BookOpen,   label: tr("studentCard.markLessonShort"), onClick: onMarkLesson };

  const cardBase = isDarkMode
    ? "bg-stone-800 border-stone-700 hover:border-stone-600"
    : "bg-white border-stone-200 hover:border-stone-300 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

  const menuBg = isDarkMode
    ? "bg-stone-900 border-stone-700 shadow-2xl"
    : "bg-white border-stone-200 shadow-xl";

  return (
    <div
      className={`relative rounded-2xl border transition-colors duration-150 ${cardBase} ${
        !isActive ? "opacity-70" : ""
      }`}
    >
      <div className="p-5">
        {/* ── Header: avatar + name + menu ── */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Avatar */}
            <div
              className={`relative w-11 h-11 rounded-xl ring-1 ring-inset ${avatarTint} flex items-center justify-center flex-shrink-0`}
            >
              <span className="font-semibold text-sm">{initials}</span>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${
                  isDarkMode ? "border-stone-800" : "border-white"
                } ${isActive ? "bg-emerald-400" : "bg-stone-400"}`}
              />
            </div>

            {/* Name + email */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm leading-tight truncate min-w-0">
                  <button
                    type="button"
                    onClick={onEdit}
                    className={`max-w-full truncate text-left hover:underline underline-offset-2 ${
                      isDarkMode ? "text-white" : "text-stone-900"
                    }`}
                  >
                    {fullName || tr("studentCard.unnamedStudent")}
                  </button>
                </h3>
                {student.status === "pending" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300 flex-shrink-0">
                    {tr("studentCard.pendingSetup")}
                  </span>
                )}
                {student.isManaged && (
                  <span
                    title={tr("studentCard.adminManagedStudentWithNo")}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${
                      isDarkMode ? "bg-amber-900/40 text-amber-300 border-amber-700/50" : "bg-amber-50 text-amber-700 border-amber-300"
                    }`}
                  >
                    {tr("studentCard.managed")}
                  </span>
                )}
              </div>
              {student.studentId && (
                <p className={`text-[10px] font-mono font-medium mt-0.5 ${
                  isDarkMode ? "text-stone-500" : "text-stone-400"
                }`}>
                  {student.studentId}
                </p>
              )}
              <p
                className={`text-xs truncate flex items-center gap-1 mt-0.5 ${
                  isDarkMode ? "text-stone-400" : "text-stone-500"
                }`}
              >
                {student.isManaged ? (
                  <span className="italic">{tr("studentCard.noLoginManagedByAdmin")}</span>
                ) : (
                  <>
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    {student.email}
                  </>
                )}
              </p>
            </div>
          </div>

        </div>

        {/* ── Classes remaining badge ── */}
        <div className="mb-4">
          <ClassesBadge count={student.classCredits ?? 0} isDarkMode={isDarkMode} />
          {(student.groupPoints ?? 0) > 0 && (
            <span className={`ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isDarkMode ? "bg-sky-900/30 text-sky-300" : "bg-sky-50 text-sky-700"}`}>
              <Ticket size={12} /> {tr("studentCard.groupPoints", { count: student.groupPoints })}
            </span>
          )}
        </div>

        {/* ── Stats strip ── */}
        <div className={`grid grid-cols-3 mb-4 rounded-xl border divide-x ${
          isDarkMode ? "border-stone-700 divide-stone-700" : "border-stone-100 divide-stone-100 bg-stone-50/60"
        }`}>
          <Stat label={tr("studentCard.age")} value={student.age ? `${student.age}y` : "—"} isDarkMode={isDarkMode} />
          <Stat label={tr("studentCard.classes2")} value={student.classCredits ?? 0} isDarkMode={isDarkMode} />
          <Stat label={tr("studentCard.lastPay")} value={formatLastPayment(student.lastPaymentDate)} isDarkMode={isDarkMode} />
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
            {tr("studentCard.needsTopUpAccountWill")}
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
              {tr("studentCard.temporaryPassword")}
            </p>
            <div className="flex items-center gap-2">
              <code
                className={`flex-1 text-xs font-mono px-2 py-1 rounded-lg truncate ${
                  isDarkMode
                    ? "bg-stone-900 text-amber-300"
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
                title={tr("studentCard.copyPassword2")}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Profile details (collapsible) ── */}
        {(student.phone || student.country || student.rank || student.dateOfBirth) && (
          <div className={`mb-4 rounded-xl border overflow-hidden ${isDarkMode ? "border-stone-700" : "border-stone-100"}`}>
            {/* Toggle header */}
            <button
              type="button"
              onClick={() => setProfileExpanded(v => !v)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors ${
                isDarkMode
                  ? "bg-stone-700/60 hover:bg-stone-700 text-stone-300"
                  : "bg-stone-50 hover:bg-stone-100 text-stone-500"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" />
                {tr("studentCard.profileDetails")}
              </span>
              {profileExpanded
                ? <ChevronUp className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Collapsible body */}
            {profileExpanded && (
              <div className={`px-3 py-3 space-y-2 ${isDarkMode ? "bg-stone-800/40" : "bg-white"}`}>
                {student.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className={`w-3 h-3 flex-shrink-0 ${isDarkMode ? "text-stone-500" : "text-stone-400"}`} />
                    <span className={`text-xs ${isDarkMode ? "text-stone-300" : "text-stone-600"}`}>{student.phone}</span>
                  </div>
                )}
                {student.country && (
                  <div className="flex items-center gap-2">
                    <Globe className={`w-3 h-3 flex-shrink-0 ${isDarkMode ? "text-stone-500" : "text-stone-400"}`} />
                    <span className={`text-xs ${isDarkMode ? "text-stone-300" : "text-stone-600"}`}>{student.country}</span>
                  </div>
                )}
                {student.rank && (
                  <div className="flex items-center gap-2">
                    <Award className={`w-3 h-3 flex-shrink-0 ${isDarkMode ? "text-stone-500" : "text-stone-400"}`} />
                    <span className={`text-xs ${isDarkMode ? "text-stone-300" : "text-stone-600"}`}>{student.rank}</span>
                  </div>
                )}
                {student.dateOfBirth && (
                  <div className="flex items-center gap-2">
                    <Calendar className={`w-3 h-3 flex-shrink-0 ${isDarkMode ? "text-stone-500" : "text-stone-400"}`} />
                    <span className={`text-xs ${isDarkMode ? "text-stone-300" : "text-stone-600"}`}>
                      {new Date(student.dateOfBirth).toLocaleDateString(dateLocale("en-GB"), { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Actions: most-likely-next action · Edit · everything else ── */}
        <div className="flex gap-2">
          <button
            onClick={primary.onClick}
            title={primary.label}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition duration-150 active:scale-[0.97] bg-ad-accent-soft text-ad-accent-ink ring-1 ring-inset ring-ad-accent-line hover:bg-ad-accent-line"
          >
            <primary.icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{primary.label}</span>
          </button>

          <button
            onClick={onEdit}
            aria-label={tr("studentCard.edit")}
            title={tr("studentCard.edit")}
            className={`flex-shrink-0 flex items-center justify-center px-2.5 rounded-xl border transition duration-150 active:scale-[0.97] ${
              isDarkMode
                ? "border-stone-600 hover:bg-stone-700 text-stone-300"
                : "border-stone-200 hover:bg-stone-50 text-stone-500 hover:text-stone-700"
            }`}
          >
            <Edit3 className="w-4 h-4" />
          </button>

          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              ref={triggerRef}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={tr("studentCard.moreActions")}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={`h-full px-2.5 rounded-xl border transition duration-150 active:scale-[0.97] ${
                isDarkMode
                  ? `border-stone-600 text-stone-300 hover:bg-stone-700 ${menuOpen ? "bg-stone-700" : ""}`
                  : `border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-700 ${menuOpen ? "bg-stone-50 text-stone-700" : ""}`
              }`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Opens upward from the action row so it never runs off the bottom of the page */}
            {menuOpen && (
              <div
                role="menu"
                onKeyDown={onMenuKeyDown}
                className={`ui-pop-in origin-bottom-right absolute right-0 bottom-full mb-1.5 z-50 min-w-[210px] rounded-xl border ${menuBg} py-1.5 overflow-hidden`}
              >
                <MenuLabel isDarkMode={isDarkMode}>{tr("studentCard.groupLessons")}</MenuLabel>
                {primary.key !== "lesson" && (
                  <DropdownItem icon={BookOpen} label={tr("studentCard.markLesson")} isDarkMode={isDarkMode} onClick={run(onMarkLesson)} />
                )}
                <DropdownItem icon={MinusCircle} label={tr("studentCard.unmarkLesson")} isDarkMode={isDarkMode} onClick={run(onUnmarkLesson)} />
                <DropdownItem icon={History} label={tr("studentCard.lessonHistory")} isDarkMode={isDarkMode} onClick={run(onViewLessons)} />
                {onNotifications && (
                  <DropdownItem icon={BellRing} label={tr("studentCard.notificationsReminders")} isDarkMode={isDarkMode} onClick={run(onNotifications)} />
                )}

                <MenuDivider isDarkMode={isDarkMode} />
                <MenuLabel isDarkMode={isDarkMode}>{tr("studentCard.groupPayments")}</MenuLabel>
                {primary.key !== "payment" && (
                  <DropdownItem icon={DollarSign} label={tr("studentCard.manualPayment")} isDarkMode={isDarkMode} onClick={run(onManualPayment)} />
                )}
                {onSellPoints && (
                  <DropdownItem icon={Ticket} label={tr("studentCard.sellGroupPoints")} isDarkMode={isDarkMode} onClick={run(onSellPoints)} />
                )}
                <DropdownItem icon={Receipt} label={tr("studentCard.paymentHistory")} isDarkMode={isDarkMode} onClick={run(onViewPayment)} />

                <MenuDivider isDarkMode={isDarkMode} />
                <MenuLabel isDarkMode={isDarkMode}>{tr("studentCard.groupAccount")}</MenuLabel>
                {student.status === "pending" && !student.isManaged && primary.key !== "invite" && onResendInvite && (
                  <DropdownItem icon={Mail} label={tr("studentCard.resendInvite")} isDarkMode={isDarkMode} onClick={run(onResendInvite)} />
                )}
                {student.isManaged && onConvert && (
                  <DropdownItem icon={KeyRound} label={tr("studentCard.giveLoginAccess")} isDarkMode={isDarkMode} onClick={run(onConvert)} />
                )}
                {!student.isManaged && (
                  <DropdownItem icon={RotateCcw} label={tr("studentCard.resetPassword")} isDarkMode={isDarkMode} onClick={run(onResetPassword)} />
                )}
                {student.tempPassword && !student.isManaged && (
                  <DropdownItem icon={Copy} label={tr("studentCard.copyPassword")} isDarkMode={isDarkMode} onClick={run(onCopyPassword)} />
                )}
                <DropdownItem icon={FileDown} label={tr("studentCard.downloadPdf")} isDarkMode={isDarkMode} onClick={run(() => downloadStudentCard(student).catch(console.error))} />

                <MenuDivider isDarkMode={isDarkMode} />
                {primary.key !== "enable" && (
                  <DropdownItem
                    icon={isActive ? UserX : UserCheck}
                    label={isActive ? tr("studentCard.disableStudent") : tr("studentCard.enableStudent")}
                    isDarkMode={isDarkMode}
                    onClick={run(onToggle)}
                  />
                )}
                <DropdownItem icon={Trash2} label={tr("studentCard.deleteStudent")} color="red" isDarkMode={isDarkMode} onClick={run(onDelete)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Menu pieces ───────────────────────────────────────────────────────────────
function MenuLabel({ isDarkMode, children }) {
  return (
    <div className={`px-3.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider ${isDarkMode ? "text-stone-500" : "text-stone-400"}`}>
      {children}
    </div>
  );
}

function MenuDivider({ isDarkMode }) {
  return <div role="separator" className={`my-1 h-px ${isDarkMode ? "bg-stone-700" : "bg-stone-100"}`} />;
}

// Menu items are neutral; only destructive actions get colour
function DropdownItem({ icon: Icon, label, color, isDarkMode, onClick }) {
  const tone = color === "red"
    ? (isDarkMode ? "text-red-400 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50")
    : (isDarkMode ? "text-stone-200 hover:bg-stone-800" : "text-stone-700 hover:bg-stone-50");
  const iconTone = color === "red" ? "" : (isDarkMode ? "text-stone-500" : "text-stone-400");

  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-left transition-colors outline-none ${tone} ${
        isDarkMode ? "focus-visible:bg-stone-800" : "focus-visible:bg-stone-50"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconTone}`} />
      {label}
    </button>
  );
}
