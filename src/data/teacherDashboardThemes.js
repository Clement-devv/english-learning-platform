// src/data/teacherDashboardThemes.js
// Teacher dashboard shell theme definitions.
// Super admin assigns exclusively — no two centers share the same shell.
// Add new themes here; register the lazy import in TeacherDashboard.jsx.

export const TEACHER_DASHBOARD_THEMES = [
  {
    id:          'sunshine',
    name:        'Sunshine Explorer',
    emoji:       '☀️',
    description: 'Warm amber/orange palette · grouped sidebar nav · Nunito font · dark mode support',
    preview:     { bg: '#fff8f0', accent: '#f97316', card: '#ffffff', text: '#2d1f6e', nav: '#f97316' },
  },
  {
    id:          'playful',
    name:        'Playful Platform',
    emoji:       '🎮',
    description: 'Dark icon sidebar · hero banner · colorful category tiles · right-panel stats · Poppins font',
    preview:     { bg: '#F4F5FF', accent: '#FF6B9D', card: '#FFFFFF', text: '#13131F', nav: '#13131F' },
  },
];

export const getTeacherDashboardThemeById = (id) =>
  TEACHER_DASHBOARD_THEMES.find(t => t.id === id) || TEACHER_DASHBOARD_THEMES[0];
