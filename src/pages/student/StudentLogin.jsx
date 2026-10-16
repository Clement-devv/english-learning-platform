// src/pages/student/StudentLogin.jsx
// Theme router — delegates to the theme component assigned by super admin.
// Each theme is lazy-loaded so only one bundle is downloaded per visit.
import React, { lazy, Suspense } from 'react';
import { useBranding } from '../../context/BrandingContext';

const THEMES = {
  space:   lazy(() => import('./login-themes/SunshineTheme')),   // 'Sunshine Login' — the default slot
  ocean:   lazy(() => import('./login-themes/OceanTheme')),
  forest:  lazy(() => import('./login-themes/ForestTheme')),
  minimal: lazy(() => import('./login-themes/MinimalTheme')),
};

// Fallback shown while the theme chunk loads (matches the sunshine theme bg colour)
const LoadingScreen = () => (
  <div style={{ minHeight: '100vh', background: '#fdf8f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 36, height: 36, border: '4px solid rgba(207,75,8,.18)', borderTopColor: '#cf4b08', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
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
