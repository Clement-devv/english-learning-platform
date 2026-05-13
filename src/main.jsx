import * as Sentry from "@sentry/react";
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './i18n/i18n.js';
import { fetchBranding, applyBranding, setCachedBranding } from './utils/branding.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
});

// ── Handle impersonation URL params ──────────────────────────────────────────
// Super admin "Enter as Admin" opens a new tab with ?imp_token=xxx&imp_center=slug
const _imp = new URLSearchParams(window.location.search);
const _impToken  = _imp.get('imp_token');
const _impCenter = _imp.get('imp_center');
const _impName   = _imp.get('imp_name');
const _impExp    = _imp.get('imp_exp');
if (_impToken && _impCenter) {
  sessionStorage.setItem('adminToken', _impToken);
  sessionStorage.setItem('adminInfo', JSON.stringify({
    role: 'admin', firstName: 'Viewing', lastName: `(${_impName || _impCenter})`,
    impersonation: true, centerName: _impName || _impCenter,
    centerSlug: _impCenter, expiresAt: _impExp,
  }));
  sessionStorage.setItem('impersonationCenterSlug', _impCenter);
  if (_impExp) sessionStorage.setItem('impersonationExpiresAt', _impExp);
  // Clean URL so the token isn't visible or shareable
  window.history.replaceState({}, '', '/admin');
}
// ─────────────────────────────────────────────────────────────────────────────

// PWA launch shortcut — when the installed app opens to `/`, skip the landing
// page and go directly to the user's role route. AuthGuard handles the
// session check: valid token → dashboard, no token → login page.
const _isPWA = window.matchMedia('(display-mode: standalone)').matches ||
               !!window.navigator.standalone;
if (_isPWA && window.location.pathname === '/') {
  const _lastRole = localStorage.getItem('pwa-last-role');
  const _roleRoutes = {
    admin:       '/admin',
    'sub-admin': '/sub-admin/dashboard',
    teacher:     '/teacher/dashboard',
    student:     '/student/dashboard',
    parent:      '/parent/dashboard',
  };
  if (_roleRoutes[_lastRole]) {
    window.location.replace(_roleRoutes[_lastRole]);
  }
}

// Register service worker early so Chrome counts this visit toward installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

// Fetch and apply branding BEFORE rendering React
// If fetch fails, defaults from index.css are already applied
fetchBranding().then(({ branding, center }) => {
  applyBranding(branding, center);
  setCachedBranding(branding, center);
}).catch(() => {
  // Silent fail — defaults apply, app renders normally
}).finally(() => {
  // Always render — branding failure must never block the app
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
});
