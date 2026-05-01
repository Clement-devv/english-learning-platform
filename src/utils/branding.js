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
};

/**
 * Fetch branding from backend for the current center.
 * Center is identified by subdomain OR x-center-slug header.
 * Returns branding object — never throws, falls back to defaults.
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
    const slug = impersonationSlug || devSlug;

    const headers = {};
    if (slug) headers['x-center-slug'] = slug;

    const res = await fetch(`${API_BASE}/center/config`, {
      headers,
      // 5 second timeout — branding should never block the app
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return { branding: DEFAULT_BRANDING, center: null };

    const data = await res.json();
    if (!data.success) return { branding: DEFAULT_BRANDING, center: null };

    return {
      branding: { ...DEFAULT_BRANDING, ...data.branding },
      center:   data.center,
    };
  } catch (err) {
    // Branding fetch failed — app still works with defaults
    console.warn('Branding fetch failed, using defaults:', err.message);
    return { branding: DEFAULT_BRANDING, center: null };
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
 * Never store in localStorage — branding can change, always fetch fresh.
 */
let _cachedBranding = DEFAULT_BRANDING;
let _cachedCenter   = null;

export const setCachedBranding = (branding, center) => {
  _cachedBranding = branding;
  _cachedCenter   = center;
};

export const getCachedBranding = () => _cachedBranding;
export const getCachedCenter   = () => _cachedCenter;
