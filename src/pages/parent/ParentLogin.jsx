// src/pages/parent/ParentLogin.jsx
// Reuses the same visual theme as students on this center —
// parents feel at home on the same platform as their child.
import React, { lazy, Suspense } from 'react';
import { useBranding } from '../../context/BrandingContext';
import { useParentLoginLogic } from './login-themes/useParentLoginLogic';

const THEMES = {
  space:   lazy(() => import('../student/login-themes/SunshineTheme')),   // 'Sunshine Login' — the default slot
  ocean:   lazy(() => import('../student/login-themes/OceanTheme')),
  forest:  lazy(() => import('../student/login-themes/ForestTheme')),
  minimal: lazy(() => import('../student/login-themes/MinimalTheme')),
};

const LoadingScreen = () => (
  <div style={{ minHeight: '100vh', background: '#fdf8f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 36, height: 36, border: '4px solid rgba(207,75,8,.18)', borderTopColor: '#cf4b08', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export default function ParentLogin() {
  const { branding } = useBranding();
  const Theme = THEMES[branding.loginTheme] || THEMES.space;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Theme loginHook={useParentLoginLogic} audience="parent" />
    </Suspense>
  );
}
