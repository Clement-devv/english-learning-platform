# FRONTEND BRANDING SKILL
# English Learning Platform — White Label & Per-Center Design
# This skill is SEPARATE from MULTI_TENANT_SKILL.md
# It covers ONLY the frontend: how to apply per-center branding dynamically.
# The backend branding API is already built. This skill tells Claude
# how to consume it correctly in the React app.

---

## CODEBASE CONTEXT — READ FIRST

### Frontend Stack
- React 18 + Vite
- React Router DOM (BrowserRouter already wraps App in src/App.jsx)
- Tailwind CSS + custom CSS in src/index.css
- Entry point: src/main.jsx
- API base URL: `import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'`
- Tokens stored in localStorage:
  adminToken, teacherToken, studentToken, subAdminToken

### Existing CSS Variables in src/index.css
The app already uses CSS custom properties on :root:
```css
:root {
  --brand-primary:   #6D28D9;
  --brand-secondary: #7C3AED;
  --brand-accent:    #F59E0B;
  --glass:           rgba(255,255,255,0.6);
}
```
These are the variables branding must override. Do NOT add new
variable names — extend and replace these existing ones.

### Existing Dark Mode Pattern
Dashboards (TeacherDashboard, StudentDashboard, AdminDashboard) use
an inline `colors()` function that returns hardcoded hex values based
on a `dark` boolean. Branding must work alongside dark mode, not conflict.

### Important: API Calls in This App Use
```javascript
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
// OR
import.meta.env.VITE_API_URL || 'http://localhost:5000'
// Check which pattern the component already uses before adding fetch calls
```

---

## WHAT THE BACKEND ALREADY PROVIDES

The backend already has this endpoint (built, tested, working):
```
GET /api/center/config
Headers: x-center-slug: {slug}  OR  via subdomain
Response:
{
  success: true,
  center: {
    centerName: "Greenfield Academy",
    slug: "greenfield",
    plan: "basic"
  },
  branding: {
    logo:           "https://cdn.../logo.png" | null,
    primaryColor:   "#2E7D32",
    secondaryColor: "#A5D6A7",
    fontFamily:     "Poppins",
    favicon:        "https://cdn.../favicon.ico" | null
  }
}
```

---

## CORE BRANDING UTILITY — CREATE THIS FILE FIRST

### `src/utils/branding.js` (NEW FILE)

This is the single source of truth for branding in the frontend.
All other files import from here. Never duplicate this logic.

```javascript
// src/utils/branding.js

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Default branding — matches src/index.css :root values
// Used as fallback if fetch fails or center has no custom branding
export const DEFAULT_BRANDING = {
  logo:           null,
  primaryColor:   '#6D28D9',
  secondaryColor: '#7C3AED',
  fontFamily:     'Inter',
  favicon:        null,
  centerName:     'English Learning Platform',
};

/**
 * Fetch branding from backend for the current center.
 * Center is identified by subdomain OR x-center-slug header.
 * Returns branding object — never throws, falls back to defaults.
 */
export const fetchBranding = async () => {
  try {
    // In development: pass slug via env var or hardcode for testing
    const slug = import.meta.env.VITE_CENTER_SLUG || null;

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
    console.warn('⚠️ Branding fetch failed, using defaults:', err.message);
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

  // 3. Page title
  if (center?.centerName) {
    document.title = center.centerName;
  }

  // 4. Favicon
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
```

---

## APPLYING BRANDING AT APP STARTUP

### Update `src/main.jsx`

The branding fetch must happen BEFORE React renders so the first
paint already has the correct colors. Replace current main.jsx content:

```javascript
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { fetchBranding, applyBranding, setCachedBranding } from './utils/branding.js';

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
      <App />
    </React.StrictMode>
  );
});
```

---

## BRANDING CONTEXT — FOR COMPONENTS THAT NEED BRANDING DATA

Some components need to READ the branding values (e.g. to show the
center logo in the header, or use brand color in a chart).
Create a React context for this:

### `src/context/BrandingContext.jsx` (NEW FILE)

```javascript
// src/context/BrandingContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import {
  getCachedBranding,
  getCachedCenter,
  DEFAULT_BRANDING,
} from '../utils/branding.js';

const BrandingContext = createContext({
  branding: DEFAULT_BRANDING,
  center:   null,
});

export const BrandingProvider = ({ children }) => {
  // Read from cache set during startup (avoids second fetch)
  const [branding] = useState(getCachedBranding);
  const [center]   = useState(getCachedCenter);

  return (
    <BrandingContext.Provider value={{ branding, center }}>
      {children}
    </BrandingContext.Provider>
  );
};

// Hook for any component that needs branding data
export const useBranding = () => useContext(BrandingContext);
```

### Wrap App in BrandingProvider — Update `src/App.jsx`

Find the top-level return in App.jsx and wrap with BrandingProvider:
```javascript
// Add import at top of App.jsx:
import { BrandingProvider } from './context/BrandingContext.jsx';

// Wrap the Router with BrandingProvider:
return (
  <BrandingProvider>
    <Router>
      {/* existing App content unchanged */}
    </Router>
  </BrandingProvider>
);
```

---

## USING BRANDING IN COMPONENTS

### Reading Brand Colors in a Component

```javascript
import { useBranding } from '../../context/BrandingContext';

export default function DashboardHeader() {
  const { branding, center } = useBranding();

  return (
    <header style={{ backgroundColor: branding.primaryColor }}>
      {branding.logo
        ? <img src={branding.logo} alt={center?.centerName} className="h-8" />
        : <span className="font-bold text-white">{center?.centerName}</span>
      }
    </header>
  );
}
```

### Using Brand Colors as CSS Variables in JSX

```javascript
// These work automatically because applyBranding() set them on :root
<button style={{ background: 'var(--brand-primary)' }}>
  Save
</button>

// Or with opacity using the rgb version:
<div style={{ background: 'rgba(var(--brand-primary-rgb), 0.1)' }}>
  Card
</div>
```

### In Tailwind — Use Arbitrary Values with CSS Vars

```jsx
// Tailwind can use CSS variables in arbitrary value syntax:
<div className="bg-[var(--brand-primary)] text-white">
  Primary button
</div>

<div className="border-[var(--brand-secondary)]">
  Branded border
</div>
```

---

## CENTER LOGO COMPONENT — `src/components/CenterLogo.jsx` (NEW FILE)

Reusable logo component used in all dashboard headers:

```javascript
// src/components/CenterLogo.jsx
import { useBranding } from '../context/BrandingContext';

export default function CenterLogo({ size = 'md', showName = false }) {
  const { branding, center } = useBranding();

  const sizes = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12',
  };

  return (
    <div className="flex items-center gap-2">
      {branding.logo ? (
        <img
          src={branding.logo}
          alt={center?.centerName || 'Logo'}
          className={`${sizes[size]} w-auto object-contain`}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div
          className={`${sizes[size]} aspect-square rounded-lg flex items-center justify-center text-white font-bold text-sm`}
          style={{ backgroundColor: branding.primaryColor }}
        >
          {(center?.centerName || 'EL').charAt(0).toUpperCase()}
        </div>
      )}
      {showName && center?.centerName && (
        <span className="font-semibold text-gray-900 dark:text-white">
          {center.centerName}
        </span>
      )}
    </div>
  );
}
```

---

## BRANDING SETTINGS PAGE — FOR CENTER ADMIN

Center admins update their own branding from their dashboard.
Add a BrandingSettings tab to AdminDashboard:

### `src/pages/admin/tabs/BrandingTab.jsx` (NEW FILE)

```javascript
// src/pages/admin/tabs/BrandingTab.jsx
import { useState } from 'react';
import { useBranding } from '../../../context/BrandingContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const FONT_OPTIONS = ['Inter', 'Poppins', 'Roboto', 'Lato', 'Montserrat', 'Open Sans'];

export default function BrandingTab({ isDarkMode }) {
  const { branding } = useBranding();
  const token = localStorage.getItem('adminToken');

  const [form, setForm] = useState({
    primaryColor:   branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    fontFamily:     branding.fontFamily,
    logo:           branding.logo || '',
    favicon:        branding.favicon || '',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error,   setError]   = useState('');

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const res = await fetch(`${API_BASE}/center/branding`, {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Failed to save branding');
        return;
      }

      // Apply changes immediately without page reload
      document.documentElement.style.setProperty('--brand-primary',   form.primaryColor);
      document.documentElement.style.setProperty('--brand-secondary', form.secondaryColor);

      setSuccess('Branding updated! Changes are live immediately.');
    } catch (err) {
      setError('Failed to save branding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const base = isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900';

  return (
    <div className={`${base} rounded-2xl p-6 max-w-2xl`}>
      <h2 className="text-xl font-bold mb-6">Branding & Appearance</h2>

      {/* Color Pickers */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Primary Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              className="h-10 w-16 rounded cursor-pointer border-0"
            />
            <span className="text-sm font-mono">{form.primaryColor}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Secondary Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.secondaryColor}
              onChange={(e) => setForm(f => ({ ...f, secondaryColor: e.target.value }))}
              className="h-10 w-16 rounded cursor-pointer border-0"
            />
            <span className="text-sm font-mono">{form.secondaryColor}</span>
          </div>
        </div>
      </div>

      {/* Font Picker */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Font Family</label>
        <select
          value={form.fontFamily}
          onChange={(e) => setForm(f => ({ ...f, fontFamily: e.target.value }))}
          className={`w-full border rounded-lg px-3 py-2 ${
            isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
          }`}
        >
          {FONT_OPTIONS.map(f => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </select>
      </div>

      {/* Logo URL */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Logo URL</label>
        <input
          type="url"
          value={form.logo}
          onChange={(e) => setForm(f => ({ ...f, logo: e.target.value }))}
          placeholder="https://your-cdn.com/logo.png"
          maxLength={500}
          className={`w-full border rounded-lg px-3 py-2 ${
            isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
          }`}
        />
        {form.logo && (
          <img
            src={form.logo}
            alt="Logo preview"
            className="mt-2 h-10 object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
      </div>

      {/* Favicon URL */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Favicon URL</label>
        <input
          type="url"
          value={form.favicon}
          onChange={(e) => setForm(f => ({ ...f, favicon: e.target.value }))}
          placeholder="https://your-cdn.com/favicon.ico"
          maxLength={500}
          className={`w-full border rounded-lg px-3 py-2 ${
            isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
          }`}
        />
      </div>

      {/* Live Preview */}
      <div className="mb-6 p-4 rounded-xl border-2 border-dashed border-gray-300">
        <p className="text-xs text-gray-500 mb-2 font-medium">LIVE PREVIEW</p>
        <button
          style={{ backgroundColor: form.primaryColor }}
          className="text-white px-4 py-2 rounded-lg mr-2 text-sm font-medium"
        >
          Primary Button
        </button>
        <button
          style={{ backgroundColor: form.secondaryColor }}
          className="text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Secondary Button
        </button>
        <p style={{ fontFamily: form.fontFamily }} className="mt-2 text-sm">
          This text uses {form.fontFamily}
        </p>
      </div>

      {/* Feedback */}
      {error   && <p className="text-red-500 text-sm mb-3">{error}</p>}
      {success && <p className="text-green-500 text-sm mb-3">{success}</p>}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={loading}
        style={{ backgroundColor: form.primaryColor }}
        className="w-full text-white py-3 rounded-xl font-semibold disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Branding'}
      </button>
    </div>
  );
}
```

---

## ADDING BRANDING TAB TO ADMIN DASHBOARD

In `src/pages/admin/AdminDashboard.jsx`, add the Branding tab to the
existing nav group structure. Find where tabs are defined and add:

```javascript
// Add import at top:
import BrandingTab from './tabs/BrandingTab';

// Add to the nav items array (find the settings/config group):
{ id: 'branding', label: 'Branding', icon: Palette }

// Add to the tab render switch/conditions:
{activeTab === 'branding' && (
  <BrandingTab isDarkMode={isDarkMode} />
)}
```

Import Palette icon from lucide-react (already installed):
```javascript
import { ..., Palette } from 'lucide-react';
```

---

## ENVIRONMENT VARIABLES — FRONTEND

Add to `.env` (development):
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_CENTER_SLUG=your-test-center-slug
```

Add to `.env.production`:
```env
VITE_API_BASE_URL=https://api.yourdomain.com/api
# VITE_CENTER_SLUG is NOT set in production
# In production, slug is read from subdomain automatically
```

`VITE_CENTER_SLUG` is ONLY for local development so you can test
a specific center's branding without setting up subdomains locally.
In production, the backend reads the slug from the subdomain or
`x-center-slug` header automatically.

---

## FILE STRUCTURE — ALL NEW FILES

```
src/
├── utils/
│   └── branding.js                    ← NEW: fetch, apply, cache branding
├── context/
│   └── BrandingContext.jsx            ← NEW: React context + useBranding hook
├── components/
│   └── CenterLogo.jsx                 ← NEW: reusable logo/fallback component
└── pages/
    └── admin/
        └── tabs/
            └── BrandingTab.jsx        ← NEW: admin branding settings UI
```

Files to UPDATE (minimal changes only):
```
src/main.jsx      ← Add branding fetch before React.render()
src/App.jsx       ← Wrap Router with <BrandingProvider>
```

---

## RULES CLAUDE MUST FOLLOW

1. NEVER refetch branding inside individual components —
   use getCachedBranding() or useBranding() hook only
2. NEVER store branding in localStorage — always fetch fresh on load
3. ALWAYS wrap new API calls in try/catch —
   a branding failure must never crash or block the app
4. NEVER hardcode brand colors in new components —
   always use var(--brand-primary) or useBranding()
5. ALWAYS preserve dark mode — branding colors apply on TOP of dark mode,
   never replace the dark mode logic in existing dashboards
6. NEVER remove the DEFAULT_BRANDING fallback —
   the app must work perfectly even if /api/center/config is unreachable
7. ALWAYS test the logo with an onError handler —
   broken image URLs must fall back to the initials avatar gracefully
8. VITE_CENTER_SLUG is development only —
   never reference it in production logic
9. applyBranding() is called ONCE at startup in main.jsx —
   never call it again inside components
10. BrandingTab saves to the backend ONLY —
    never mutate the BrandingContext state after initial load

---

## INTEGRATION CHECKLIST

- [ ] `src/utils/branding.js` created with fetchBranding, applyBranding,
      setCachedBranding, getCachedBranding exported
- [ ] `src/context/BrandingContext.jsx` created with BrandingProvider
      and useBranding hook
- [ ] `src/main.jsx` updated — branding fetched BEFORE ReactDOM.render()
- [ ] `src/App.jsx` updated — Router wrapped with BrandingProvider
- [ ] `src/components/CenterLogo.jsx` created
- [ ] `src/pages/admin/tabs/BrandingTab.jsx` created
- [ ] BrandingTab added to AdminDashboard nav and tab render
- [ ] VITE_CENTER_SLUG added to .env for local testing
- [ ] VITE_CENTER_SLUG NOT in .env.production
- [ ] All new components tested with logo load failure (onError)
- [ ] App tested with /api/center/config returning 500 (defaults apply)
- [ ] Dark mode tested — branding colors don't break dark dashboards

---

## HOW TO USE IN CLAUDE CODE TERMINAL

### Build everything from scratch:
```
Read FRONTEND_BRANDING_SKILL.md completely then implement
the full branding system — start with src/utils/branding.js,
then context, then main.jsx, then App.jsx. Show me each file
before moving to the next.
```

### Add branding to a specific component:
```
Read FRONTEND_BRANDING_SKILL.md then add branding support
to the DashboardHeader component — use the useBranding hook
to show the center logo and apply primaryColor to the header bar
```

### Add the admin settings tab only:
```
Read FRONTEND_BRANDING_SKILL.md then add the BrandingTab
to AdminDashboard — follow the exact tab integration pattern
already used by the other tabs in that dashboard
```

### Debug branding not applying:
```
Read FRONTEND_BRANDING_SKILL.md then check why branding is
not applying — verify main.jsx calls applyBranding before render,
check the /api/center/config response, and trace the CSS variable
being set on document.documentElement
```

---

*This skill is FRONTEND ONLY.*
*Do not modify anything in server/ when working from this skill.*
*The backend /api/center/config endpoint is already built and working.*
*If the backend endpoint is not responding, check MULTI_TENANT_SKILL.md.*