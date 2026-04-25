// src/data/subAdminDashboardThemes.js
// Sub-admin dashboard shell theme definitions.
// Super admin assigns exclusively — no two centers share the same shell.
// Add new themes here; register the lazy import in SubAdminDashboard.jsx.

export const SUBADMIN_DASHBOARD_THEMES = [
  {
    id:          'sunshine',
    name:        'Sunshine Explorer',
    emoji:       '☀️',
    description: 'Warm amber/orange palette · permission-gated sidebar nav · Nunito font · dark mode support',
    preview:     { bg: '#fff8f0', accent: '#f97316', card: '#ffffff', text: '#3d2e20', nav: '#f97316' },
  },
];

export const getSubAdminDashboardThemeById = (id) =>
  SUBADMIN_DASHBOARD_THEMES.find(t => t.id === id) || SUBADMIN_DASHBOARD_THEMES[0];
