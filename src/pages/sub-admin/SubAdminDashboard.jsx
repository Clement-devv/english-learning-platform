// src/pages/sub-admin/SubAdminDashboard.jsx
// Shell router — reads the center's active theme and loads the correct shell.
// Falls back through: subAdminDashboardTheme → dashboardTheme (center primary) → sunshine.
import React, { lazy, Suspense } from 'react';
import { useBranding } from '../../context/BrandingContext';

const SHELLS = {
  sunshine: lazy(() => import('./dashboard-shells/sunshine/SunshineShell')),
};

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fff8f0' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #ffe8cc', borderTopColor: '#f97316', animation: 'spin .75s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function SubAdminDashboard() {
  const { branding } = useBranding();
  // Prefer a sub-admin-specific theme; fall back to the center's primary theme.
  const themeKey = branding.subAdminDashboardTheme || branding.dashboardTheme;
  const Shell = SHELLS[themeKey] || SHELLS.sunshine;
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Shell />
    </Suspense>
  );
}
