// src/pages/student/dashboard-shells/PendingConfirmationBanners.jsx
// "Attendance confirmation needed" banners for classes the teacher marked
// complete. Shared by student shells so every shell lets the student open the
// confirm / dispute dialog (ClassConfirmation) before the class auto-confirms.
export default function PendingConfirmationBanners({ d }) {
  if (!d.pendingConfirmations?.length) return null;
  const dark = d.isDarkMode;
  return d.pendingConfirmations.map(conf => (
    <div key={conf.id} role="status" style={{
      background: dark ? "rgba(234,179,8,0.1)" : "#fffbeb",
      border: `1px solid ${dark ? "rgba(234,179,8,0.3)" : "#fcd34d"}`,
      borderRadius: 16, padding: "14px 18px", marginBottom: 14,
      display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <strong style={{ color: dark ? "#FCD34D" : "#92400e", fontSize: 14 }}>Attendance confirmation needed</strong>
        </div>
        <p style={{ margin: "0 0 3px", color: dark ? "#FDE68A" : "#b45309", fontSize: 13 }}>
          Your teacher marked <strong>"{conf.title}"</strong> as complete.
        </p>
        {conf.autoConfirmAt && (
          <p style={{ margin: 0, color: dark ? "#F59E0B" : "#d97706", fontSize: 12 }}>
            ⏰ Auto-confirms in: <strong>{d.getTimeRemaining(conf.autoConfirmAt)}</strong>
          </p>
        )}
      </div>
      <button onClick={() => { d.setSelectedConfirmation(conf); d.setShowConfirmationModal(true); }}
        style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#fff", border: "none", borderRadius: 12, padding: "9px 16px", fontWeight: 800, cursor: "pointer", fontSize: 13, flexShrink: 0, fontFamily: "inherit" }}>
        Review 👀
      </button>
    </div>
  ));
}
