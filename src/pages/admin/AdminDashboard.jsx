// src/pages/admin/AdminDashboard.jsx
// Shell router — reads branding.adminDashboardTheme and lazy-loads the correct design.
// Each design lives in its own folder under dashboard-shells/ for independent editing.
// Defaults to 'sunshine' if no theme is assigned.

import { lazy, Suspense } from 'react';
import { useBranding } from '../../context/BrandingContext';
import { adminAccent } from '../../utils/adminAccent';

const SHELLS = {
  sunshine: lazy(() => import('./dashboard-shells/sunshine/SunshineShell')),
};

function LoadingFallback({ accent }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f4' }}>
      <style>{`@keyframes adspin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 32, height: 32, border: '3px solid #f1e5da', borderTopColor: accent, borderRadius: '50%', animation: 'adspin .7s linear infinite' }} />
    </div>
  );
}

export default function AdminDashboard() {
  const { branding } = useBranding();
  const Shell = SHELLS[branding.adminDashboardTheme] || SHELLS.sunshine;
  return (
    <Suspense fallback={<LoadingFallback accent={adminAccent(branding)} />}>
      <Shell />
    </Suspense>
  );
}
