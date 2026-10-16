// src/data/loginThemes.js
// Login page theme definitions.
// Each theme is exclusive — only one center can hold it at a time.
// Super admin assigns themes from their dashboard.
// Add new themes here; no backend changes needed.

export const LOGIN_THEMES = [
  {
    // id stays 'space' so centers already holding this slot keep it; the design is
    // the Sunshine login (SunshineTheme.jsx). It's also the default when none is assigned.
    id:          'space',
    name:        'Sunshine Login',
    description: 'Warm glows · frosted glass · student stickers · matches the Sunshine dashboard (default)',
    preview: {
      bgStart: '#fdf8f4',
      bgEnd:   '#fb7185',
      accent:  '#cf4b08',
    },
    emoji: '☀️',
  },
  {
    id:          'ocean',
    name:        'Ocean Depths',
    description: 'Deep navy & teal · submarine mascot · floating bubbles',
    preview: {
      bgStart: '#0c1445',
      bgEnd:   '#0891b2',
      accent:  '#22d3ee',
    },
    emoji: '🌊',
  },
  {
    id:          'forest',
    name:        'Enchanted Forest',
    description: 'Deep green & amber · glowing fireflies · reading tree',
    preview: {
      bgStart: '#052e16',
      bgEnd:   '#92400e',
      accent:  '#4ade80',
    },
    emoji: '🌿',
  },
  {
    id:          'minimal',
    name:        'Clean Minimal',
    description: 'Light & elegant · centered card · no illustration · professional',
    preview: {
      bgStart: '#f8fafc',
      bgEnd:   '#e2e8f0',
      accent:  '#6366f1',
    },
    emoji: '✨',
  },
];

export const getLoginThemeById = (id) => LOGIN_THEMES.find(t => t.id === id) || null;

// ── Teacher login themes ──────────────────────────────────────────────────────
// Each theme is exclusive — only one center can hold it at a time.

export const TEACHER_LOGIN_THEMES = [
  {
    // id stays 'classroom-space' so centers already holding this slot keep it; the
    // design is the Sunshine teacher login (SunshineTeacherTheme.jsx). Default slot.
    id:          'classroom-space',
    name:        'Sunshine Login',
    description: 'Warm glows · frosted glass · sunrise rings · matches the Sunshine teacher dashboard (default)',
    preview: {
      bgStart: '#fdf8f4',
      bgEnd:   '#fb7185',
      accent:  '#cf4b08',
    },
    emoji: '☀️',
  },
  {
    id:          'ocean-current',
    name:        'Ocean Current',
    description: 'Underwater ocean · sailing teaching materials · jellyfish · bioluminescent glow',
    preview: {
      bgStart: '#0ea5e9',
      bgEnd:   '#030f1e',
      accent:  '#22d3ee',
    },
    emoji: '🌊',
  },
  {
    id:          'enchanted-grove',
    name:        'Enchanted Grove',
    description: 'Magical forest night · bark chalkboard · owl · woodland creatures · fireflies & mist',
    preview: {
      bgStart: '#052e16',
      bgEnd:   '#010d04',
      accent:  '#4ade80',
    },
    emoji: '🌿',
  },
];

export const getTeacherLoginThemeById = (id) => TEACHER_LOGIN_THEMES.find(t => t.id === id) || null;

// ── Admin login themes ────────────────────────────────────────────────────────
// Each theme is exclusive — only one center can hold it at a time.
// 'executive' is the default (no assignment needed).

export const ADMIN_LOGIN_THEMES = [
  {
    // id stays 'executive' so centers already holding this slot keep it; the design is
    // the Sunshine admin login (SunshineAdminTheme.jsx). Default slot. The super admin
    // login uses the same design (components/auth/SunshineLoginShell.jsx).
    id:          'executive',
    name:        'Sunshine Login',
    description: 'Warm glows · frosted glass · sunrise rings · matches the Sunshine admin dashboard (default)',
    preview: {
      bgStart: '#fdf8f4',
      bgEnd:   '#fb7185',
      accent:  '#cf4b08',
    },
    emoji: '☀️',
  },
  {
    id:          'corporate-slate',
    name:        'Corporate Slate',
    description: 'Deep slate · geometric grid · flowing org-chart nodes · indigo accent · professional',
    preview: {
      bgStart: '#0f172a',
      bgEnd:   '#1e293b',
      accent:  '#818cf8',
    },
    emoji: '🏢',
  },
];

export const getAdminLoginThemeById = (id) => ADMIN_LOGIN_THEMES.find(t => t.id === id) || null;
