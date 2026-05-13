// src/pages/sub-admin/SubAdminLogin.jsx
// Shell picker — mirrors the admin login theme so both always look the same.
import React, { lazy, Suspense } from 'react';
import { useBranding } from '../../context/BrandingContext';

const THEMES = {
  executive:          lazy(() => import('./login-themes/ExecutiveTheme')),
  'corporate-slate':  lazy(() => import('./login-themes/CorporateSlateTheme')),
};

const LoadingScreen = () => (
  <div style={{ minHeight: '100vh', background: '#060a14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 34, height: 34, border: '3px solid rgba(99,102,241,.15)', borderTopColor: '#818cf8', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export default function SubAdminLogin() {
  const { branding } = useBranding();
  // Sub-admin always mirrors the admin login theme
  const Theme = THEMES[branding.adminLoginTheme] || THEMES.executive;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Theme />
    </Suspense>
  );
}
