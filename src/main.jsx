import { init as initSentry, browserTracingIntegration, addIntegration } from "@sentry/react";
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './i18n/i18n.js';
import { fetchBranding, applyBranding, setCachedBranding, loadStoredBranding, storeBranding } from './utils/branding.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { installClientErrorReporting } from './utils/reportClientError.js';
import { installSafeWindowOpen } from './utils/safeWindowOpen.js';

installSafeWindowOpen(); // no javascript:/data: links from the database (utils/safeWindowOpen.js)

// ── Handle impersonation hand-off ────────────────────────────────────────────
// Super admin "Enter as Admin" opens a new tab with #imp_token=xxx&imp_center=slug.
// The token travels in the URL *fragment*, which browsers never send to a server
// (so it can't land in proxy/server logs or a Referer header). This runs BEFORE
// Sentry.init so the URL is already clean when Sentry records the page load.
// (?imp_token= is still read so a tab opened by an older dashboard keeps working.)
const _imp = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
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

// Blank out credentials if a URL carrying one is ever captured (errors,
// navigation breadcrumbs, request spans).
const SECRET_PARAM_RE = /([?&#](?:imp_token|token|sessionToken|access_token|resetToken)=)[^&#\s]*/gi;
const scrubUrl = (u) => (typeof u === 'string' ? u.replace(SECRET_PARAM_RE, '$1[redacted]') : u);

// App Health: tell the platform owner when a page crashes (utils/reportClientError.js)
installClientErrorReporting();

const sentryEnabled =
  !!import.meta.env.VITE_SENTRY_DSN && import.meta.env.VITE_SENTRY_ENABLED === 'true';

initSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    browserTracingIntegration(),
    // Session replay is added below, after the page has loaded (it is ~300 KB).
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  // Off unless VITE_SENTRY_ENABLED=true (set in .env / .env.production), so
  // development doesn't use up the Sentry quota. Nothing is sent while off.
  enabled: sentryEnabled,
  beforeSend(event) {
    if (event.request?.url) event.request.url = scrubUrl(event.request.url);
    return event;
  },
  beforeSendTransaction(event) {
    if (event.request?.url) event.request.url = scrubUrl(event.request.url);
    if (typeof event.transaction === 'string') event.transaction = scrubUrl(event.transaction);
    return event;
  },
  beforeBreadcrumb(crumb) {
    if (crumb?.data) {
      for (const k of ['url', 'from', 'to']) if (crumb.data[k]) crumb.data[k] = scrubUrl(crumb.data[k]);
    }
    return crumb;
  },
});

// Session replay (~300 KB) is downloaded after the page has loaded instead of
// in the main bundle. It still honours the replay sample rates set above.
// Replays record what's on screen. Students' names, messages and grades are
// personal data (often of minors), so all text, inputs and media are masked.
if (sentryEnabled) {
  window.addEventListener('load', () => {
    import('./lib/sentryReplay.js')
      .then(({ replayIntegration }) => addIntegration(
        replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
      ))
      .catch(() => {});
  });
}

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
  // A notification was clicked while this tab was open (public/sw.js): go to its page
  // inside the app (React Router follows popstate) — e.g. /teacher/dashboard?tab=messages
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type !== 'notification-click' || typeof e.data.url !== 'string' || !e.data.url.startsWith('/')) return;
    window.history.pushState({}, '', e.data.url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

const renderApp = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
};

// Branding picks each center's colours, logo AND which login/dashboard theme to
// show, so rendering with the wrong branding would flash the wrong design.
//  • Returning visitor: render NOW with the branding saved from last visit, and
//    refresh it in the background (applied live if it changed).
//  • First visit: wait for the fetch, as before (5 s timeout, then defaults).
const stored = loadStoredBranding();
if (stored) {
  applyBranding(stored.branding, stored.center);
  setCachedBranding(stored.branding, stored.center);
  renderApp();
}

fetchBranding().then(({ branding, center, authoritative }) => {
  // A failed request returns defaults — never let that replace good saved branding.
  if (stored && !authoritative) return;
  const changed = !stored || JSON.stringify(stored) !== JSON.stringify({ branding, center });
  if (changed) {
    applyBranding(branding, center);
    setCachedBranding(branding, center);
  }
  if (authoritative) storeBranding(branding, center);
}).catch(() => {
  // Silent fail — defaults apply, app renders normally
}).finally(() => {
  // Always render — branding failure must never block the app
  if (!stored) renderApp();
});
