// src/data/classroomThemes.js
// Classroom video-tab theme definitions.
// Unlike login themes these are NOT exclusive — multiple centers can share a theme.
// Super admin assigns them per-center from the dashboard.
// Add new themes here; no backend changes needed beyond the data file.

export const CLASSROOM_THEMES = [
  {
    id:          'sunshine',
    name:        'Sunshine Friends',
    description: 'Bright yellow & orange · warm, cheerful, cartoonish · best for young children',
    emoji:       '🌟',
    preview: {
      bgStart: '#fbbf24',
      bgEnd:   '#f97316',
      accent:  '#ef4444',
    },
  },
  {
    id:          'explorer',
    name:        'Space Explorer',
    description: 'Cosmic purple & teal · rockets & stars · adventure-themed classroom',
    emoji:       '🚀',
    preview: {
      bgStart: '#6d28d9',
      bgEnd:   '#0f172a',
      accent:  '#2dd4bf',
    },
  },
];

export const getClassroomThemeById = (id) =>
  CLASSROOM_THEMES.find(t => t.id === id) || null;
