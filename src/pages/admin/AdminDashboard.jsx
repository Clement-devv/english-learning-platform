// src/pages/admin/AdminDashboard.jsx
// Shell router — reads branding.adminDashboardTheme and lazy-loads the correct design.
// Each design lives in its own folder under dashboard-shells/ for independent editing.
// Defaults to 'sunshine' if no theme is assigned.

import { lazy, Suspense } from 'react';
import { useBranding } from '../../context/BrandingContext';

const SHELLS = {
  sunshine: lazy(() => import('./dashboard-shells/sunshine/SunshineShell')),
};

function LoadingFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff8f0' }}>
      <style>{`@keyframes adspin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 36, height: 36, border: '4px solid #ffe8cc', borderTopColor: '#f97316', borderRadius: '50%', animation: 'adspin .7s linear infinite' }} />
    </div>
  );
}

export default function AdminDashboard() {
  const { branding } = useBranding();
  const Shell = SHELLS[branding.adminDashboardTheme] || SHELLS.sunshine;
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Shell />
    </Suspense>
  );
}
