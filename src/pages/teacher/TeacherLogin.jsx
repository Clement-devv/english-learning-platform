// src/pages/teacher/TeacherLogin.jsx
// Theme router — delegates to the theme component assigned by super admin.
// Each theme is lazy-loaded so only one bundle is downloaded per visit.
import React, { lazy, Suspense } from 'react';
import { useBranding } from '../../context/BrandingContext';

const THEMES = {
  'classroom-space':  lazy(() => import('./login-themes/ClassroomSpaceTheme')),
  'ocean-current':    lazy(() => import('./login-themes/OceanCurrentTheme')),
  'enchanted-grove':  lazy(() => import('./login-themes/EnchantedGroveTheme')),
};

// Fallback shown while the theme chunk loads
const LoadingScreen = () => (
  <div style={{ minHeight: '100vh', background: '#06091a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 36, height: 36, border: '4px solid rgba(255,255,255,.15)', borderTopColor: '#22d3ee', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export default function TeacherLogin() {
  const { branding } = useBranding();
  const Theme = THEMES[branding.teacherLoginTheme] || THEMES['classroom-space'];
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Theme />
    </Suspense>
  );
}
