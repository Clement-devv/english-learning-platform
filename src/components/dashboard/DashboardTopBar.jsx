import React from "react";
import { Menu, ChevronRight } from "lucide-react";

/**
 * Shared top bar used by Admin, Teacher, Student, Sub-Admin, Super-Admin.
 *
 * Props
 * ─────
 * sidebarOpen  {boolean}
 * onToggle     {fn}         Toggle sidebar open/closed
 * roleName     {string}     e.g. "Teacher", "Admin" — shown in breadcrumb
 * activeLabel  {string}     Current tab label — shown in breadcrumb
 * colors       {object}     From dashboardColors(isDarkMode)
 * userInitial  {string}     Single letter for avatar, e.g. "T"
 * onAvatarClick {fn}        Opens settings sidebar
 * actions      {ReactNode}  Role-specific buttons (stat chips, "New Class", bell, etc.)
 */
export default function DashboardTopBar({
  sidebarOpen,
  onToggle,
  roleName,
  activeLabel,
  colors,
  userInitial = "?",
  onAvatarClick,
  actions,
}) {
  return (
    <header style={{
      height: "64px",
      background: colors.card,
      borderBottom: `1px solid ${colors.border}`,
      display: "flex",
      alignItems: "center",
      padding: "0 24px",
      gap: "16px",
      flexShrink: 0,
    }}>
      {/* Hamburger */}
      <button
        onClick={onToggle}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: colors.muted, padding: "6px", borderRadius: "8px",
          display: "flex", alignItems: "center",
        }}
        className="db-nav-btn"
      >
        <Menu size={20} />
      </button>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "12.5px", color: colors.muted, fontWeight: "500" }}>{roleName}</span>
        <ChevronRight size={13} color={colors.muted} />
        <span style={{ fontSize: "13px", color: colors.heading, fontWeight: "700" }}>{activeLabel}</span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Role-specific action buttons */}
      {actions}

      {/* Avatar */}
      <div
        onClick={onAvatarClick}
        style={{
          width: "34px", height: "34px", borderRadius: "10px",
          background: "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "13px", fontWeight: "800", color: "white",
          flexShrink: 0, cursor: onAvatarClick ? "pointer" : "default",
        }}
      >
        {userInitial}
      </div>
    </header>
  );
}
