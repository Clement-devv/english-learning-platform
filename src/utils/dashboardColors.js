/**
 * Shared color palette for all role dashboards (Admin, Teacher, Student,
 * Sub-Admin, Super-Admin).  Pass `isDarkMode` and destructure what you need.
 *
 * Usage:
 *   import { dashboardColors } from '../../utils/dashboardColors'
 *   const c = dashboardColors(isDarkMode)
 */
export function dashboardColors(dark) {
  return {
    bg:        dark ? "linear-gradient(135deg, #0f0f1a 0%, #1a1030 40%, #0a1628 100%)"
                    : "linear-gradient(135deg, #e8eeff 0%, #f0e8ff 40%, #e8f4ff 100%)",
    card:      dark ? "#1a1d27" : "#ffffff",
    sidebar:   dark ? "#13161f" : "#ffffff",
    border:    dark ? "#1e2235" : "#e8ecf4",
    heading:   dark ? "#e2e8f0" : "#1e293b",
    text:      dark ? "#94a3b8" : "#475569",
    muted:     dark ? "#374151" : "#94a3b8",
    activeBg:  dark ? "#252d4a" : "rgba(var(--brand-primary-rgb), 0.08)",
    activeClr: dark ? "#a5b4fc" : "var(--brand-primary)",
  };
}
