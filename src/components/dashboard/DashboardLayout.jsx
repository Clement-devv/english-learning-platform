
/**
 * Shared full-page layout wrapper for all role dashboards.
 * Renders: sidebar | (topBar + scrollable content)
 * Injects shared dashboard CSS under the `db-` class prefix.
 *
 * Props
 * ─────
 * isDarkMode     {boolean}
 * colors         {object}   From dashboardColors(isDarkMode)
 * mounted        {boolean}  Fade-in on first load
 * sidebar        {ReactNode}  <DashboardSidebar />
 * topBar         {ReactNode}  <DashboardTopBar />
 * activeTab      {string}
 * noPaddingTabs  {string[]} Tabs that get zero padding (e.g. ["messages"])
 * children       {ReactNode} Tab content
 */
export default function DashboardLayout({
  isDarkMode,
  colors,
  mounted = true,
  sidebar,
  topBar,
  activeTab,
  noPaddingTabs = [],
  children,
}) {
  const noPad = noPaddingTabs.includes(activeTab);

  return (
    <>
      <style>{sharedCSS(isDarkMode)}</style>
      <div style={{
        display: "flex",
        height: "100vh",
        background: colors.bg,
        fontFamily: "var(--font-body)",
        overflow: "hidden",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}>
        {/* Sidebar */}
        {sidebar}

        {/* Main column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
          {/* Top bar */}
          {topBar}

          {/* Scrollable content */}
          <main
            className="db-scroll"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: noPad ? "0" : "24px",
              background: colors.bg,
            }}
          >
            <div
              key={activeTab}
              className="db-content"
              style={{
                background: colors.card,
                borderRadius: "20px",
                border: `1px solid ${colors.border}`,
                boxShadow: isDarkMode ? "none" : "0 4px 24px rgba(108,99,255,0.07), 0 1px 4px rgba(0,0,0,0.04)",
                minHeight: "calc(100vh - 112px)",
                padding: noPad ? "0" : "24px",
                overflow: noPad ? "hidden" : "visible",
              }}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

// ── Shared CSS injected once per dashboard render ─────────────────────────────
function sharedCSS(dark) {
  return `
    * { box-sizing: border-box; }

    .db-scroll::-webkit-scrollbar       { width: 4px; }
    .db-scroll::-webkit-scrollbar-track { background: transparent; }
    .db-scroll::-webkit-scrollbar-thumb { background: ${dark ? "#1e2235" : "#e0e4f4"}; border-radius: 4px; }

    .db-nav-btn:hover {
      background: ${dark ? "rgba(var(--brand-primary-rgb),0.12)" : "rgba(var(--brand-primary-rgb),0.08)"} !important;
      color: var(--brand-primary) !important;
    }
    .db-logout-btn:hover { background: rgba(239,68,68,0.08) !important; }

    @keyframes db-slide-up {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .db-content { animation: db-slide-up 0.35s ease both; }
    @keyframes db-spin { to { transform: rotate(360deg); } }
    @keyframes db-ping { 0%,100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(2.2); opacity: 0; } }
  `;
}
