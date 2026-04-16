// src/pages/student/StudentLogin.jsx
// Theme router — delegates to the theme component assigned by super admin.
// Each theme is lazy-loaded so only one bundle is downloaded per visit.
import React, { lazy, Suspense } from 'react';
import { useBranding } from '../../context/BrandingContext';

const THEMES = {
  space:   lazy(() => import('./login-themes/SpaceTheme')),
  ocean:   lazy(() => import('./login-themes/OceanTheme')),
  forest:  lazy(() => import('./login-themes/ForestTheme')),
  minimal: lazy(() => import('./login-themes/MinimalTheme')),
};

// Fallback shown while the theme chunk loads (matches the space theme bg colour)
const LoadingScreen = () => (
  <div style={{ minHeight: '100vh', background: '#1a0533', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 36, height: 36, border: '4px solid rgba(255,255,255,.2)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export default function StudentLogin() {
  const { branding } = useBranding();
  const Theme = THEMES[branding.loginTheme] || THEMES.space;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Theme />
    </Suspense>
  );
}
