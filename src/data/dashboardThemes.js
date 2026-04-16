// src/data/dashboardThemes.js
// Each entry represents a full dashboard shell design.
// Super admin assigns exclusively — no two centers share the same shell.
//
// id        → matches key in StudentDashboard SHELLS map
// preview   → used in super admin modal to render a mini mockup

export const DASHBOARD_THEMES = [
  // ── 1. Sunshine (original playful design) ─────────────────────────────────
  {
    id:          'sunshine',
    name:        'Sunshine Explorer',
    emoji:       '☀️',
    description: 'Warm & playful · rounded cards · Nunito font · dark mode support',
    preview:     { bg: '#fff8f0', accent: '#f97316', card: '#ffffff', text: '#2d1f6e', nav: '#f97316' },

    // These values are still consumed by SunshineShell internally
    palette: (dark) => ({
      bg:       dark ? '#0f1117' : '#fff8f0',
      card:     dark ? '#1a1d2e' : '#ffffff',
      cardAlt:  dark ? '#1f2235' : '#fffbf5',
      border:   dark ? '#2a2d40' : '#ffe8cc',
      heading:  dark ? '#f0f4ff' : '#2d1f6e',
      body:     dark ? '#c8cce0' : '#4a4060',
      muted:    dark ? '#6b7090' : '#9b8ab0',
      accent:   dark ? '#fbbf24' : '#f97316',
      accentBg: dark ? 'rgba(251,191,36,0.12)' : '#fff7ed',
      blue:     dark ? '#60a5fa' : '#3b82f6',
      green:    dark ? '#34d399' : '#10b981',
      pink:     dark ? '#f472b6' : '#ec4899',
      purple:   dark ? '#a78bfa' : '#7c3aed',
    }),
    tabGradient:     'linear-gradient(135deg,#f97316,#fb923c)',
    tabShadow:       'rgba(249,115,22,0.4)',
    welcomeGradient: 'linear-gradient(135deg,#f97316,#ec4899,#8b5cf6)',
    welcomeShadow:   'rgba(249,115,22,0.3)',
    accentGradient:  'linear-gradient(135deg,#f97316,#ec4899)',
    loadingEmoji:    '🚀',
    loadingText:     'Loading your adventure...',
    font:            'Nunito',
    fontImport:      'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap',
    scrollbarThumb:  (dark) => dark ? '#2a2d40' : '#ffd0a8',
    cssExtra:        '',
  },

  // ── 2. Island Academy (nature/floating island adventure design) ─────────────
  {
    id:          'crm',
    name:        'Island Academy',
    emoji:       '🏝️',
    description: 'Floating island cards · green sidebar · donut progress · Nunito font',
    preview:     { bg: '#F0FBF4', accent: '#22C55E', card: '#ffffff', text: '#1A3328', nav: '#1A7A4A' },

    palette: () => ({
      bg: '#F0FBF4', card: '#ffffff', cardAlt: '#fafffe',
      border: '#D1EDD9', heading: '#1A3328', body: '#4A7A5E',
      muted: '#7FAF90', accent: '#22C55E', accentBg: '#f0fdf4',
      blue: '#38BDF8', green: '#22C55E', pink: '#EC4899', purple: '#8B5CF6',
    }),
    tabGradient:     'linear-gradient(135deg,#1A7A4A,#0D9488)',
    tabShadow:       'rgba(26,122,74,0.3)',
    welcomeGradient: 'linear-gradient(135deg,#1A7A4A,#0D9488)',
    welcomeShadow:   'rgba(26,122,74,0.25)',
    accentGradient:  'linear-gradient(135deg,#22C55E,#0D9488)',
    loadingEmoji:    '🌿',
    loadingText:     'Loading your academy...',
    font:            'Nunito',
    fontImport:      'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap',
    scrollbarThumb:  () => '#D1EDD9',
    cssExtra:        '',
  },
  // ── 3. Academy LMS (clean warm-orange LMS design) ─────────────────────────────
  {
    id:          'academy',
    name:        'Academy LMS',
    emoji:       '🎓',
    description: 'Warm orange sidebar · clean white layout · assignment cards · donut stats · grade pills',
    preview:     { bg: '#F5F6FA', accent: '#F97316', card: '#FFFFFF', text: '#1A1D2E', nav: '#F97316' },

    palette: () => ({
      bg: '#F5F6FA', card: '#FFFFFF', cardAlt: '#FFF7F0',
      border: '#E8EAF0', heading: '#1A1D2E', body: '#374151',
      muted: '#9CA3AF', accent: '#F97316', accentBg: '#FFF7F0',
      blue: '#3B82F6', green: '#10B981', pink: '#EC4899', purple: '#F97316',
    }),
    tabGradient:     'linear-gradient(160deg,#F97316,#FB923C)',
    tabShadow:       'rgba(249,115,22,0.3)',
    welcomeGradient: 'linear-gradient(135deg,#F97316,#FDBA74)',
    welcomeShadow:   'rgba(249,115,22,0.25)',
    accentGradient:  'linear-gradient(135deg,#F97316,#FCD34D)',
    loadingEmoji:    '🎓',
    loadingText:     'Loading your classes...',
    font:            'Inter',
    fontImport:      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    scrollbarThumb:  () => '#E8EAF0',
    cssExtra:        '',
  },
  // ── 4. Playful Platform (vivid kids-first gamified design) ───────────────────
  {
    id:          'playful',
    name:        'Playful Platform',
    emoji:       '🎮',
    description: 'Dark icon sidebar · hero banner · colorful category tiles · What\'s New panel · Poppins font',
    preview:     { bg: '#F4F5FF', accent: '#FF6B9D', card: '#FFFFFF', text: '#13131F', nav: '#13131F' },

    palette: () => ({
      bg: '#F4F5FF', card: '#FFFFFF', cardAlt: '#FFF1EE',
      border: '#E8EAFF', heading: '#13131F', body: '#5A5B72',
      muted: '#9899B0', accent: '#FF6B9D', accentBg: '#FFF0F6',
      blue: '#4D96FF', green: '#4ADE80', pink: '#FF6B9D', purple: '#818CF8',
    }),
    tabGradient:     'linear-gradient(135deg,#FF6B9D,#FF8E53)',
    tabShadow:       'rgba(255,107,157,0.35)',
    welcomeGradient: 'linear-gradient(135deg,#FF6B9D,#FF8E53)',
    welcomeShadow:   'rgba(255,107,157,0.3)',
    accentGradient:  'linear-gradient(135deg,#FF6B9D,#FF6B6B)',
    loadingEmoji:    '🎮',
    loadingText:     'Loading your adventure...',
    font:            'Poppins',
    fontImport:      'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap',
    scrollbarThumb:  () => '#E8EAFF',
    cssExtra:        '',
  },
];

export const getDashboardThemeById = (id) =>
  DASHBOARD_THEMES.find(t => t.id === id) || DASHBOARD_THEMES[0];
