// src/pages/admin/AdminLogin.jsx
// Shell picker — delegates to the theme assigned to this center.
import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useBranding }    from '../../context/BrandingContext';
import { fetchBranding }  from '../../utils/branding';

const THEMES = {
  executive:         lazy(() => import('./login-themes/ExecutiveTheme')),
  'corporate-slate': lazy(() => import('./login-themes/CorporateSlateTheme')),
};

const LoadingScreen = () => (
  <div style={{ minHeight: '100vh', background: '#060a14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 34, height: 34, border: '3px solid rgba(34,211,238,.15)', borderTopColor: '#22d3ee', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export default function AdminLogin() {
  const { branding: cached } = useBranding();
  // Start with the cached theme so there's no flash, then confirm with a fresh fetch
  const [themeId, setThemeId] = useState(cached.adminLoginTheme);

  useEffect(() => {
    fetchBranding()
      .then(({ branding }) => setThemeId(branding.adminLoginTheme))
      .catch(() => {});
  }, []);

  const Theme = THEMES[themeId] || THEMES.executive;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Theme />
    </Suspense>
  );
}
