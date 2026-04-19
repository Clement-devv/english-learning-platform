// src/pages/teacher/TeacherDashboard.jsx
// Shell router — reads branding.teacherDashboardTheme and lazy-loads the correct design.
// Each design lives in its own folder under dashboard-shells/ for independent editing.
// Defaults to 'sunshine' if no theme is assigned.

import { lazy, Suspense } from 'react';
import { useBranding } from '../../context/BrandingContext';

const SHELLS = {
  sunshine: lazy(() => import('./dashboard-shells/sunshine/SunshineShell')),
  playful:  lazy(() => import('./dashboard-shells/playful/PlayfulShell')),
};

function LoadingFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff8f0' }}>
      <style>{`@keyframes tdspin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 36, height: 36, border: '4px solid #ffe8cc', borderTopColor: '#f97316', borderRadius: '50%', animation: 'tdspin .7s linear infinite' }} />
    </div>
  );
}

export default function TeacherDashboard() {
  const { branding } = useBranding();
  const Shell = SHELLS[branding.teacherDashboardTheme] || SHELLS.sunshine;
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Shell />
    </Suspense>
  );
}
