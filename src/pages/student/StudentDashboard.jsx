// src/pages/student/StudentDashboard.jsx
// Shell router — reads branding.dashboardTheme and lazy-loads the correct design.
// Each design lives in its own folder under dashboard-shells/ for easy independent editing.

import { lazy, Suspense } from "react";
import { useBranding } from "../../context/BrandingContext";

const SHELLS = {
  sunshine: lazy(() => import("./dashboard-shells/sunshine/SunshineShell")),
  crm:      lazy(() => import("./dashboard-shells/crm/CRMShell")),
  academy:  lazy(() => import("./dashboard-shells/academy/AcademyShell")),
  playful:  lazy(() => import("./dashboard-shells/playful/PlayfulShell")),
};

function LoadingFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: "36px", height: "36px", border: "3px solid #e5e7eb", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

export default function StudentDashboard() {
  const { branding } = useBranding();
  const Shell = SHELLS[branding.dashboardTheme] || SHELLS.sunshine;
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Shell />
    </Suspense>
  );
}
