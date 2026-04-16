// src/data/loginThemes.js
// Login page theme definitions.
// Each theme is exclusive — only one center can hold it at a time.
// Super admin assigns themes from their dashboard.
// Add new themes here; no backend changes needed.

export const LOGIN_THEMES = [
  {
    id:          'space',
    name:        'Space Explorer',
    description: 'Deep purple cosmos · rocket mascot · stars & orbiting books',
    preview: {
      bgStart: '#1a0533',
      bgEnd:   '#ea580c',
      accent:  '#a855f7',
    },
    emoji: '🚀',
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
