import React from "react";
import { Settings, LogOut, GraduationCap } from "lucide-react";

/**
 * Shared sidebar used by Admin, Teacher, Student, Sub-Admin, Super-Admin.
 *
 * Props
 * ─────
 * nav            {Array}   Flat: [{key, label, icon}]
 *                          OR grouped: [{group, items:[{key,label,icon}]}]
 * activeTab      {string}
 * onTabChange    {fn}
 * sidebarOpen    {boolean}
 * colors         {object}  From dashboardColors(isDarkMode)
 * isDarkMode     {boolean}
 * branding       {object}  { logo }
 * centerName     {string}
 * portalLabel    {string}  e.g. "Teacher Portal"
 * portalIcon     {Component} Lucide icon for the logo fallback (default: GraduationCap)
 * badges         {object}  { [navKey]: count } — shows red badge on that nav item
 * widths         {object}  { open, closed } — defaults to { open:"240px", closed:"64px" }
 * onDarkModeToggle {fn}
 * onSettings     {fn}
 * onLogout       {fn}
 */
export default function DashboardSidebar({
  nav = [],
  activeTab,
  onTabChange,
  sidebarOpen,
  colors,
  isDarkMode,
  branding = {},
  centerName = "",
  portalLabel = "Portal",
  portalIcon: PortalIcon = GraduationCap,
  badges = {},
  widths = { open: "240px", closed: "64px" },
  onDarkModeToggle,
  onSettings,
  onLogout,
}) {
  // Normalise flat nav to grouped format so one render path handles both
  const groups = nav[0]?.items
    ? nav
    : [{ group: null, items: nav }];

  const btnStyle = (active) => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: sidebarOpen ? "9px 10px" : "9px 14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    background: active ? colors.activeBg : "transparent",
    color: active ? colors.activeClr : colors.muted,
    fontFamily: "inherit",
    fontSize: "13.5px",
    fontWeight: active ? "700" : "500",
    textAlign: "left",
    marginBottom: "2px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    position: "relative",
    transition: "all 0.15s",
  });

  const utilBtnStyle = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: sidebarOpen ? "9px 10px" : "9px 14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    background: "transparent",
    color: colors.muted,
    fontFamily: "inherit",
    fontSize: "13.5px",
    fontWeight: "500",
    textAlign: "left",
    marginBottom: "4px",
    whiteSpace: "nowrap",
  };

  return (
    <aside
      className="db-sidebar"
      style={{
        width: sidebarOpen ? widths.open : widths.closed,
        background: colors.sidebar,
        borderRight: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
        zIndex: 40,
      }}
    >
      {/* ── Logo ── */}
      <div style={{
        height: "64px",
        display: "flex",
        alignItems: "center",
        padding: sidebarOpen ? "0 18px" : "0 14px",
        borderBottom: `1px solid ${colors.border}`,
        gap: "10px",
        flexShrink: 0,
      }}>
        {branding.logo ? (
          <img
            src={branding.logo}
            alt={centerName}
            style={{ height: 32, maxWidth: 32, objectFit: "contain", borderRadius: 6, flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0,
            background: "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <PortalIcon size={15} color="white" />
          </div>
        )}
        {sidebarOpen && (
          <div style={{ overflow: "hidden" }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", color: colors.heading, whiteSpace: "nowrap", fontFamily: "var(--font-display)" }}>
              {centerName}
            </p>
            <p style={{ margin: 0, fontSize: "9px", color: colors.muted, fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {portalLabel}
            </p>
          </div>
        )}
      </div>

      {/* ── Nav items ── */}
      <div
        className="db-scroll"
        style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "10px 6px" }}
      >
        {groups.map(({ group, items }, gi) => (
          <div key={group ?? gi} style={{ marginBottom: group ? "8px" : 0 }}>
            {/* Group label (hidden when collapsed) */}
            {group && sidebarOpen && (
              <p style={{
                margin: "0 0 4px 8px",
                fontSize: "10px",
                fontWeight: "700",
                color: colors.muted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                whiteSpace: "nowrap",
              }}>
                {group}
              </p>
            )}

            {items.map(({ key, label, icon: Icon }) => {
              const active     = activeTab === key;
              const badgeCount = badges[key] ?? 0;
              return (
                <button
                  key={key}
                  onClick={() => onTabChange(key)}
                  title={!sidebarOpen ? label : undefined}
                  style={btnStyle(active)}
                  className="db-nav-btn"
                >
                  {active && (
                    <div style={{
                      position: "absolute", left: 0, top: "20%", bottom: "20%",
                      width: "3px", borderRadius: "0 3px 3px 0",
                      background: "var(--brand-secondary)",
                    }} />
                  )}

                  {/* Icon + collapsed-badge dot */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Icon size={16} />
                    {badgeCount > 0 && !sidebarOpen && (
                      <div style={{
                        position: "absolute", top: "-5px", right: "-5px",
                        minWidth: "15px", height: "15px", borderRadius: "8px",
                        background: "#ef4444", color: "white",
                        fontSize: "9px", fontWeight: "800",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "0 3px",
                      }}>
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </div>
                    )}
                  </div>

                  {sidebarOpen && <span style={{ flex: 1 }}>{label}</span>}

                  {/* Expanded badge */}
                  {sidebarOpen && badgeCount > 0 && (
                    <span style={{
                      minWidth: "20px", height: "20px", borderRadius: "10px",
                      background: "#ef4444", color: "white",
                      fontSize: "10px", fontWeight: "800",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 5px", flexShrink: 0,
                    }}>
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Group divider */}
            {group && sidebarOpen && (
              <div style={{ height: "1px", background: colors.border, margin: "8px 4px" }} />
            )}
          </div>
        ))}
      </div>

      {/* ── Bottom controls ── */}
      <div style={{ borderTop: `1px solid ${colors.border}`, padding: "10px 6px", flexShrink: 0 }}>
        <button onClick={onDarkModeToggle} style={utilBtnStyle} className="db-nav-btn"
          title={isDarkMode ? "Light Mode" : "Dark Mode"}>
          <span style={{ fontSize: "15px", flexShrink: 0 }}>{isDarkMode ? "☀️" : "🌙"}</span>
          {sidebarOpen && <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        <button onClick={onSettings} style={utilBtnStyle} className="db-nav-btn" title="Settings">
          <Settings size={16} style={{ flexShrink: 0 }} />
          {sidebarOpen && <span>Settings</span>}
        </button>

        <button
          onClick={onLogout}
          title="Logout"
          style={{ ...utilBtnStyle, color: "#ef4444", marginBottom: 0 }}
          className="db-logout-btn"
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
