// src/utils/branding.js

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// Default branding — matches src/index.css :root values
// Used as fallback if fetch fails or center has no custom branding
export const DEFAULT_BRANDING = {
  logo:           null,
  primaryColor:   '#6D28D9',
  secondaryColor: '#7C3AED',
  fontFamily:     'Inter',
  favicon:        null,
  loginBackground:    null,
  loginBgOverlay:     0.45,
  loginTheme:             null,
  teacherLoginTheme:      null,
  teacherDashboardTheme:  null,
  adminLoginTheme:           'executive',
  adminDashboardTheme:       null,
  subAdminDashboardTheme:    null,
  centerName:        'English Learning Platform',
  borderRadius:   '8px',
  shadowStyle:    'soft',
  spacing:        'comfortable',
  theme:          null,
  classroomTheme: null,
};

/**
 * Fetch branding from backend for the current center.
 * Center is identified by subdomain OR x-center-slug header.
 * Returns branding object — never throws, falls back to defaults.
 *
 * `authoritative` is true when the result reflects what the server says (or
 * there is definitely no center), false when it is only a fallback because the
 * request failed. Callers use it to decide whether to overwrite saved branding.
 */
export const fetchBranding = async () => {
  try {
    // In production: server identifies the center from the Host header (custom domain).
    // x-center-slug header is only sent as a fallback for:
    //   1. Super admin impersonation (imp_center session)
    //   2. Local development (VITE_CENTER_SLUG env var)
    // Never send it if we're on a real custom domain — it would override Host-based routing.
    const impersonationSlug = sessionStorage.getItem('impersonationCenterSlug');
    const devSlug = import.meta.env.DEV ? (import.meta.env.VITE_CENTER_SLUG || null) : null;

    // In production on a subdomain (mannie-english.clemify.com), API calls go to
    // clemify.com so the server can't detect the center from the Host header.
    // Extract the slug from the subdomain and send it as x-center-slug.
    // For custom domains the Host header IS the custom domain, so no slug needed.
    const subdomainSlug = (() => {
      const h = window.location.hostname;
      if (h.endsWith('.clemify.com')) return h.replace(/\.clemify\.com$/, '');
      return null;
    })();

    const slug = impersonationSlug || devSlug || subdomainSlug;

    // Detect if we're on the platform root domain (clemify.com itself).
    // If no slug is available and we're not on a potential center custom domain,
    // skip the fetch — there's no center to identify and the request would 400.
    const platformHost = (() => {
      try { return new URL(API_BASE).hostname; } catch { return 'localhost'; }
    })();
    const isOnPlatformRoot = !slug && (
      window.location.hostname === platformHost ||
      window.location.hostname === `www.${platformHost}`
    );
    if (isOnPlatformRoot) return { branding: DEFAULT_BRANDING, center: null, authoritative: true };

    const headers = {};
    if (slug) headers['x-center-slug'] = slug;

    const res = await fetch(`${API_BASE}/center/config`, {
      headers,
      // 5 second timeout — branding should never block the app
      signal: AbortSignal.timeout(5000),
    });

    // 4xx = the server says there is no such center; 5xx = temporary failure.
    if (!res.ok) return { branding: DEFAULT_BRANDING, center: null, authoritative: res.status < 500 };

    const data = await res.json();
    if (!data.success) return { branding: DEFAULT_BRANDING, center: null, authoritative: true };

    // If the center has a verified custom domain and we're on the old subdomain, redirect.
    const { customDomain, domainVerified } = data.center || {};
    if (customDomain && domainVerified && !import.meta.env.DEV) {
      const currentHost = window.location.hostname;
      if (currentHost !== customDomain && currentHost !== `www.${customDomain}`) {
        window.location.replace(
          `https://${customDomain}${window.location.pathname}${window.location.search}`
        );
        return { branding: DEFAULT_BRANDING, center: null, authoritative: false };
      }
    }

    return {
      branding: { ...DEFAULT_BRANDING, ...data.branding },
      center:   data.center,
      authoritative: true,
    };
  } catch (err) {
    // AbortError = component unmounted before fetch completed — not a real failure
    if (err.name === 'AbortError') return { branding: DEFAULT_BRANDING, center: null, authoritative: false };
    if (import.meta.env.DEV) console.warn('Branding fetch failed, using defaults:', err.message);
    return { branding: DEFAULT_BRANDING, center: null, authoritative: false };
  }
};

/**
 * Apply branding to the DOM.
 * Call this once at app startup, before React renders.
 * Updates CSS variables, page title, logo, and favicon.
 */
export const applyBranding = (branding, center) => {
  // 1. CSS variables — all Tailwind/inline styles that use var() will update
  document.documentElement.style.setProperty('--brand-primary',   branding.primaryColor);
  document.documentElement.style.setProperty('--brand-secondary', branding.secondaryColor);

  // Also set rgb versions for use in rgba() — useful for transparent overlays
  document.documentElement.style.setProperty(
    '--brand-primary-rgb',
    hexToRgb(branding.primaryColor)
  );

  // 2. Font family
  document.documentElement.style.setProperty(
    '--brand-font',
    `'${branding.fontFamily}', sans-serif`
  );

  // 3. Border radius
  document.documentElement.style.setProperty('--brand-radius', branding.borderRadius || '8px');

  // 4. Box shadow preset
  const SHADOWS = {
    none:   'none',
    soft:   '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    medium: '0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)',
    strong: '0 10px 30px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.1)',
  };
  document.documentElement.style.setProperty(
    '--brand-shadow',
    SHADOWS[branding.shadowStyle] || SHADOWS.soft
  );

  // 5. Spacing scale multiplier
  const SPACINGS = { compact: '0.85', comfortable: '1', spacious: '1.2' };
  document.documentElement.style.setProperty(
    '--brand-spacing',
    SPACINGS[branding.spacing] || '1'
  );

  // 6. Login background overlay opacity
  document.documentElement.style.setProperty('--brand-login-overlay', branding.loginBgOverlay ?? 0.45);

  // If font is not system font, load it from Google Fonts
  const systemFonts = ['Inter', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman'];
  if (!systemFonts.includes(branding.fontFamily)) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${
      branding.fontFamily.replace(/ /g, '+')
    }:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }

  // 7. Page title
  if (center?.centerName) {
    document.title = center.centerName;
  }

  // 8. Favicon
  if (branding.favicon) {
    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = branding.favicon;
  }

  // 9. Apple touch icon — iOS uses this for the home screen and ignores the manifest icons.
  // The server makes a square 180px PNG from the center's logo (or its initial on the brand
  // colour) — a raw logo is often not square. ?v= refreshes it when the branding changes.
  if (center?.centerName) {
    let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    const v = encodeURIComponent([branding.logo, branding.favicon, branding.primaryColor, center.centerName].join('|')).slice(0, 120);
    appleIcon.href = `/pwa-icon/180.png?v=${v}`;

    // 10. iPhone home-screen name (defaults to "Clemify" in index.html)
    let appTitle = document.querySelector("meta[name='apple-mobile-web-app-title']");
    if (!appTitle) {
      appTitle = document.createElement('meta');
      appTitle.name = 'apple-mobile-web-app-title';
      document.head.appendChild(appTitle);
    }
    appTitle.content = center.centerName;
  }
};

/**
 * Convert hex color to "r, g, b" string for CSS rgba() use
 */
export const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '109, 40, 217'; // default purple fallback
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
};

/**
 * Store branding in memory so components can read it without refetching.
 * BrandingProvider subscribes, so a later update (the background refresh in
 * main.jsx) reaches components that are already on screen.
 */
let _cachedBranding = DEFAULT_BRANDING;
let _cachedCenter   = null;
const _listeners    = new Set();

export const setCachedBranding = (branding, center) => {
  _cachedBranding = branding;
  _cachedCenter   = center;
  _listeners.forEach((fn) => fn());
};

export const subscribeBranding = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};

/**
 * Last branding this browser saw for this site, so a returning visitor's page
 * can render immediately instead of waiting for /center/config. main.jsx always
 * refetches in the background and updates it, so a branding change still shows
 * up on the same visit. Keyed by hostname (+ impersonated center) so centers
 * never mix.
 */
const storedBrandingKey = () =>
  `branding:v1:${window.location.hostname}:${sessionStorage.getItem('impersonationCenterSlug') || ''}`;

export const loadStoredBranding = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(storedBrandingKey()));
    return saved?.branding ? saved : null;
  } catch {
    return null;
  }
};

export const storeBranding = (branding, center) => {
  try {
    if (center) localStorage.setItem(storedBrandingKey(), JSON.stringify({ branding, center }));
    else        localStorage.removeItem(storedBrandingKey());
  } catch { /* storage full or blocked — next visit just waits for the fetch */ }
};

export const getCachedBranding = () => _cachedBranding;
export const getCachedCenter   = () => _cachedCenter;
