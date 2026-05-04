---
name: englearn-frontend
description: >
  Design and build production-grade, pixel-perfect frontend components and pages
  for Clement's English Learning Platform. Use this skill ANY TIME the user asks
  to build, redesign, style, or improve a UI component, page, dashboard, or any
  visual element in the English Learning Platform. This includes: creating new
  pages (login, register, dashboard, lessons, progress, speaking, courses), building
  React components, writing Tailwind/CSS styles, designing cards, charts, sidebars,
  navbars, modals, forms, leaderboards, homework trackers, or any other UI element.
  Trigger also when the user says "make it look good", "style this", "improve the UI",
  "match the design", "redesign", "build a component", or any variant. This skill
  ensures every piece of UI matches the platform's premium glassmorphic soft-pastel
  aesthetic — clean, modern, and visually stunning. Never skip this skill for UI work.
---

# English Learning Platform — Frontend Design Skill

## Platform Identity

This is a premium English learning SaaS platform. The design language is:

> **Soft Glassmorphic · Pastel-Gradient · Clean Modern · Friendly Professional**

Think Duolingo meets Notion meets a high-end EdTech SaaS. Every screen should feel
calm, focused, and motivating — like a learning sanctuary.

---

## Design System

### 1. Color Palette

Always use CSS custom properties. Never hardcode colors inline.

```css
:root {
  /* Backgrounds */
  --bg-page: linear-gradient(135deg, #e8eeff 0%, #f0e8ff 40%, #e8f4ff 100%);
  --bg-sidebar: #ffffff;
  --bg-card: #ffffff;
  --bg-card-hover: #f8f9ff;
  --bg-nav-icon: #1a1a2e;
  --bg-nav-icon-active: #1a1a2e;

  /* Course card accent backgrounds */
  --card-blue: #dce8ff;
  --card-green: #dcf5e8;
  --card-purple: #eedcff;
  --card-yellow: #fff8dc;
  --card-pink: #ffdce8;

  /* Text */
  --text-primary: #1a1a2e;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --text-white: #ffffff;

  /* Brand / Accent */
  --accent-primary: #6c63ff;
  --accent-secondary: #48cae4;
  --accent-success: #06d6a0;
  --accent-warning: #ffd166;
  --accent-danger: #ef476f;

  /* Progress bar colors */
  --progress-1: linear-gradient(90deg, #4ade80, #22d3ee);
  --progress-2: linear-gradient(90deg, #60a5fa, #a78bfa);
  --progress-3: linear-gradient(90deg, #f59e0b, #ef4444);
  --progress-4: linear-gradient(90deg, #34d399, #059669);

  /* Borders & Shadows */
  --border-card: 1px solid rgba(255, 255, 255, 0.8);
  --shadow-card: 0 4px 24px rgba(108, 99, 255, 0.07), 0 1px 4px rgba(0,0,0,0.04);
  --shadow-card-hover: 0 8px 32px rgba(108, 99, 255, 0.12);
  --shadow-sidebar: 2px 0 24px rgba(0,0,0,0.06);

  /* Radius */
  --radius-card: 20px;
  --radius-pill: 50px;
  --radius-icon: 14px;
  --radius-avatar: 50%;
  --radius-btn: 12px;
  --radius-input: 12px;
}
```

### 2. Typography

Use **Outfit** (display/headings) + **DM Sans** (body). Load from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

```css
/* Headings */
h1 { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 2rem; color: var(--text-primary); }
h2 { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1.4rem; }
h3 { font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 1.1rem; }

/* Body */
body, p, span { font-family: 'DM Sans', sans-serif; font-weight: 400; }
.label { font-family: 'DM Sans', sans-serif; font-size: 0.78rem; color: var(--text-secondary); }
```

### 3. Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  TOPNAV  [Logo]  [Dashboard] [Speaking] [Progress] [Courses]    │
│          [Search Bar]  [🔔]  [Avatar]                           │
├──────┬──────────────────────────────────────────────────────────┤
│ SIDE │  MAIN CONTENT AREA                                        │
│ BAR  │  ┌──────────────────────────────────────────────────┐    │
│ 60px │  │ Page Title (h1)                                   │    │
│      │  ├───────────────────┬──────────────────────────────┤    │
│ icon │  │  LEFT COLUMN      │  RIGHT AREA (2/3 width)      │    │
│ nav  │  │  (Course list /   │  [Performance Chart]         │    │
│      │  │   Select Course)  │  [Homework]  [Friends Score] │    │
│      │  └───────────────────┴──────────────────────────────┘    │
└──────┴──────────────────────────────────────────────────────────┘
```

**Grid**: `grid-template-columns: 60px 1fr` for sidebar + content.
**Content grid**: Left card 30%, right area 70% split into `1fr 1fr` for homework/friends.

### 4. Component Specifications

#### 4.1 Top Navigation Bar

```css
.topnav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  height: 68px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255,255,255,0.6);
  position: sticky;
  top: 0;
  z-index: 100;
}

/* Nav links */
.nav-link { font-family: 'DM Sans'; font-weight: 500; color: var(--text-secondary); padding: 8px 16px; border-radius: var(--radius-pill); transition: all 0.2s; }
.nav-link.active { background: var(--text-primary); color: white; font-weight: 600; }

/* Search bar */
.search-bar { background: #f1f3f9; border-radius: var(--radius-pill); padding: 8px 16px; display: flex; align-items: center; gap: 8px; width: 200px; }
```

#### 4.2 Sidebar Icon Navigation

```css
.sidebar {
  width: 60px;
  background: white;
  border-right: 1px solid #f0f0f7;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0;
  gap: 8px;
  position: fixed;
  top: 68px;
  left: 0;
  height: calc(100vh - 68px);
  box-shadow: var(--shadow-sidebar);
}

.sidebar-icon {
  width: 40px; height: 40px;
  border-radius: var(--radius-icon);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}
.sidebar-icon:hover, .sidebar-icon.active {
  background: var(--bg-nav-icon);
  color: white;
}
/* Dark mode toggle sits at the bottom of sidebar */
.sidebar-icon.dark-toggle { margin-top: auto; margin-bottom: 8px; }
```

#### 4.3 Course Cards

Cards have a colored soft background (blue, green, purple etc.), bold title, subtitle, date badge with calendar icon, and stacked avatar group.

```css
.course-card {
  background: var(--card-blue); /* swap per course */
  border-radius: var(--radius-card);
  padding: 1.4rem;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
}
.course-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-card-hover);
}
.course-card h3 { font-family: 'Outfit'; font-weight: 700; font-size: 1.15rem; margin-bottom: 0.3rem; }
.course-card p { font-size: 0.83rem; color: var(--text-secondary); line-height: 1.4; }

/* Date badge */
.date-badge {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.6);
  border-radius: var(--radius-pill);
  padding: 4px 12px;
  font-size: 0.78rem; font-weight: 500;
  color: var(--text-primary);
  margin-top: 1rem;
}

/* Avatar group */
.avatar-group { display: flex; }
.avatar-group img {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 2px solid white;
  margin-left: -8px;
  object-fit: cover;
}
.avatar-group img:first-child { margin-left: 0; }

/* Bottom row of card: date badge + avatar group */
.card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 1rem; }
```

#### 4.4 Performance Chart Card

Use **Chart.js** or **Recharts** for the area/line chart. Three datasets: Theory, Practice, Lexicon.

```js
// Chart.js config
const chartConfig = {
  type: 'line',
  data: {
    labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    datasets: [
      {
        label: 'Theory',
        data: [40, 55, 60, 75, 65, 80, 85],
        borderColor: '#48cae4',
        backgroundColor: 'rgba(72,202,228,0.12)',
        fill: true, tension: 0.4, pointRadius: 4,
      },
      {
        label: 'Practice',
        data: [30, 45, 50, 60, 55, 70, 72],
        borderColor: '#a78bfa',
        backgroundColor: 'rgba(167,139,250,0.10)',
        fill: true, tension: 0.4, pointRadius: 4,
      },
      {
        label: 'Lexicon',
        data: [20, 35, 45, 55, 60, 65, 78],
        borderColor: '#f87171',
        backgroundColor: 'rgba(248,113,113,0.08)',
        fill: true, tension: 0.4, pointRadius: 4,
      }
    ]
  },
  options: {
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { /* custom dark pill */ } },
    scales: {
      y: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#f0f0f7' } },
      x: { grid: { display: false } }
    }
  }
};

// Tooltip: show "+12 More practise" in dark pill bubble
```

Chart card wrapper:
```css
.chart-card {
  background: white;
  border-radius: var(--radius-card);
  padding: 1.5rem;
  box-shadow: var(--shadow-card);
  border: var(--border-card);
}
.chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
.chart-legend { display: flex; gap: 12px; font-size: 0.8rem; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 4px; }
/* Weekly dropdown */
.time-selector {
  border: 1.5px solid #e5e7eb; border-radius: var(--radius-pill);
  padding: 6px 14px; font-size: 0.82rem; font-family: 'DM Sans';
  background: white; cursor: pointer; display: flex; align-items: center; gap: 6px;
}
```

#### 4.5 Homework Card

```css
.homework-card { background: white; border-radius: var(--radius-card); padding: 1.4rem; box-shadow: var(--shadow-card); }
.task-item { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }

/* Task icon: dark rounded square */
.task-icon { width: 38px; height: 38px; background: var(--bg-nav-icon); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }

/* Progress bar */
.progress-wrap { flex: 1; }
.progress-label { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 0.82rem; }
.progress-pct { font-weight: 700; font-size: 0.9rem; color: var(--text-primary); }
.progress-bar-bg { height: 6px; background: #f0f0f7; border-radius: 99px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 99px; background: var(--progress-1); /* rotate per task */ }
```

#### 4.6 Friends Score / Leaderboard Card

```css
.leaderboard-card { background: white; border-radius: var(--radius-card); padding: 1.4rem; box-shadow: var(--shadow-card); }
.friend-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f5f5f9; }
.friend-row:last-child { border-bottom: none; }

.friend-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.friend-name { font-weight: 600; font-size: 0.88rem; }
.friend-meta { display: flex; gap: 10px; margin-top: 2px; }
.friend-stat { font-size: 0.72rem; color: var(--text-secondary); display: flex; align-items: center; gap: 3px; }
.friend-score { margin-left: auto; font-family: 'Outfit'; font-weight: 700; font-size: 1.05rem; color: var(--text-primary); }

/* All / Week tabs */
.tab-group { display: flex; border: 1.5px solid #e5e7eb; border-radius: var(--radius-pill); overflow: hidden; }
.tab-btn { padding: 5px 14px; font-size: 0.8rem; background: none; border: none; cursor: pointer; font-family: 'DM Sans'; }
.tab-btn.active { background: var(--text-primary); color: white; }
```

#### 4.7 White Card (general wrapper)

```css
.card {
  background: var(--bg-card);
  border-radius: var(--radius-card);
  padding: 1.5rem;
  box-shadow: var(--shadow-card);
  border: var(--border-card);
  transition: box-shadow 0.2s ease;
}
.card:hover { box-shadow: var(--shadow-card-hover); }
.card-title { font-family: 'Outfit'; font-weight: 700; font-size: 1.2rem; margin-bottom: 0.2rem; }
.card-subtitle { font-size: 0.8rem; color: var(--text-secondary); }
```

#### 4.8 Buttons

```css
.btn-primary {
  background: var(--text-primary);
  color: white;
  border: none;
  border-radius: var(--radius-btn);
  padding: 10px 20px;
  font-family: 'DM Sans'; font-weight: 600; font-size: 0.88rem;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
}
.btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

.btn-ghost {
  background: transparent;
  border: 1.5px solid #e5e7eb;
  border-radius: var(--radius-btn);
  padding: 9px 18px;
  font-family: 'DM Sans'; font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-ghost:hover { background: #f5f5fb; }

.btn-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  border: 1.5px solid #e5e7eb;
  background: white;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}
```

#### 4.9 Input Fields & Search

```css
.input {
  width: 100%;
  background: #f4f5fb;
  border: 1.5px solid transparent;
  border-radius: var(--radius-input);
  padding: 10px 14px;
  font-family: 'DM Sans'; font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
}
.input:focus { border-color: var(--accent-primary); background: white; }

.search-input {
  background: #f1f3f9;
  border: none;
  border-radius: var(--radius-pill);
  padding: 9px 16px 9px 40px; /* left padding for icon */
  font-family: 'DM Sans'; font-size: 0.88rem;
  outline: none;
  width: 200px;
  transition: width 0.3s ease, box-shadow 0.2s;
}
.search-input:focus { width: 260px; box-shadow: 0 0 0 3px rgba(108,99,255,0.12); }
```

---

## React Component Conventions

Since the project uses **React + Node.js/Express + MongoDB**, follow these conventions:

### File Naming
```
src/
  components/
    dashboard/
      DashboardPage.jsx
      CourseCard.jsx
      PerformanceChart.jsx
      HomeworkCard.jsx
      LeaderboardCard.jsx
    shared/
      Sidebar.jsx
      TopNav.jsx
      Avatar.jsx
      ProgressBar.jsx
      Badge.jsx
  styles/
    globals.css     ← CSS variables live here
    components.css  ← Component-level styles
```

### Component Template

```jsx
// Example: CourseCard.jsx
import React from 'react';

const CARD_COLORS = {
  blue: '#dce8ff',
  green: '#dcf5e8',
  purple: '#eedcff',
  yellow: '#fff8dc',
};

export default function CourseCard({ title, description, date, avatars = [], color = 'blue', onClick }) {
  return (
    <div
      className="course-card"
      style={{ background: CARD_COLORS[color] }}
      onClick={onClick}
    >
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="card-footer">
        <span className="date-badge">
          <CalendarIcon size={13} />
          {date}
        </span>
        <div className="avatar-group">
          {avatars.map((src, i) => (
            <img key={i} src={src} alt="" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Tailwind (if using)

Map design system tokens to Tailwind in `tailwind.config.js`:
```js
module.exports = {
  theme: {
    extend: {
      colors: {
        accent: '#6c63ff',
        success: '#06d6a0',
        surface: '#f8f9ff',
      },
      borderRadius: { card: '20px', pill: '50px' },
      fontFamily: { display: ['Outfit', 'sans-serif'], body: ['DM Sans', 'sans-serif'] },
      boxShadow: { card: '0 4px 24px rgba(108,99,255,0.07)' },
    }
  }
}
```

---

## Page-Specific Design Rules

### Dashboard Page
- Top: h1 "Dashboard" in Outfit 800
- 3-column layout: [Course List | Performance Chart | (Homework + Friends stacked)]
- Performance chart takes 2/5 of the width; homework and friends split the remaining space
- Sticky topnav always visible

### Login / Register Pages
- Full-page gradient background: `var(--bg-page)`
- Centered card (max-width 420px) with white background, large border-radius (28px)
- Prominent logo at top
- Friendly, welcoming heading: "Welcome back 👋" or "Start learning today"
- Social login buttons (Google) styled as ghost buttons
- Soft divider "or continue with email"
- Form fields with `var(--input)` styles
- Primary CTA button full-width

### Progress / Speaking / Courses Pages
- Consistent topnav + sidebar
- Hero stat cards at top (total lessons, streak days, vocab learned)
- Grid of content cards below
- Charts use the same Chart.js theme (Theory/Practice/Lexicon palette)

### Teacher / Admin Dashboard
- Same design system but with data-dense tables
- Table rows on `#f9f9ff` background, alternating with white
- Action buttons use `btn-icon` style

---

## Animation & Motion

```css
/* Page load stagger for cards */
.card { animation: slideUp 0.4s ease both; }
.card:nth-child(1) { animation-delay: 0.05s; }
.card:nth-child(2) { animation-delay: 0.1s; }
.card:nth-child(3) { animation-delay: 0.15s; }

@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Progress bar fill animation */
.progress-bar-fill {
  width: 0%;
  animation: fillBar 1s ease-out forwards;
  animation-delay: 0.3s;
}
@keyframes fillBar { to { width: var(--target-width); } }

/* Hover lift on cards */
.course-card, .card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.course-card:hover, .card:hover {
  transform: translateY(-3px);
}
```

---

## Dark Mode

Support dark mode using a `.dark` class on `<body>` (toggle via the sidebar button):

```css
body.dark {
  --bg-page: linear-gradient(135deg, #0f0f1a 0%, #1a1030 40%, #0a1628 100%);
  --bg-card: #1e1e2e;
  --bg-card-hover: #252535;
  --bg-sidebar: #161622;
  --bg-nav-icon: #2d2d45;
  --text-primary: #f0f0ff;
  --text-secondary: #a0a0c0;
  --text-muted: #6060a0;
  --border-card: 1px solid rgba(255,255,255,0.06);
  --shadow-card: 0 4px 24px rgba(0,0,0,0.3);
  --card-blue: #1e2a40;
  --card-green: #1a2e24;
  --card-purple: #251a35;
}
```

---

## Quality Checklist

Before finishing any UI task, verify:

- [ ] CSS variables used (no hardcoded hex colors)
- [ ] Google Fonts loaded (Outfit + DM Sans)
- [ ] All cards have `border-radius: var(--radius-card)` — no sharp corners
- [ ] Consistent spacing: padding 1.2rem–1.5rem inside cards
- [ ] Progress bars are colorful (gradient fills, not solid grey)
- [ ] Avatars are circular (`border-radius: 50%`)
- [ ] Topnav is sticky with backdrop blur
- [ ] Sidebar icons use the dark rounded square style
- [ ] Hover states on all interactive elements
- [ ] Slide-up animation on page load
- [ ] Dark mode variables defined if toggling is involved
- [ ] Chart uses three colored area lines (Theory=blue, Practice=purple, Lexicon=red)
- [ ] Mobile: stack layout to single column on < 768px
- [ ] No Inter/Roboto/Arial fonts
- [ ] No pure white or grey backgrounds on the page root (must use gradient)

---

## Reference Visual Description

The target aesthetic (derived from design reference images):

1. **Page background**: Soft 3-stop gradient — light blue → lavender → light blue. Never flat white.
2. **Cards**: Pure white, very rounded corners (20px+), whisper-soft shadow. Float over the gradient.
3. **Course cards**: Each has a distinct soft-colored tinted background (blue, green, purple etc.) — pastel, not vivid.
4. **Topnav**: Glass/frosted effect. Active nav item is a dark pill (black background, white text).
5. **Sidebar**: Minimal icon-only strip. Icons are small dark rounded squares. Dark/light toggle at bottom.
6. **Progress bars**: Thin (6px), rounded, colorful gradient fills. Always animated on load.
7. **Chart**: Soft filled area chart. Legend dots inline with labels. Custom dark tooltip pill.
8. **Leaderboard**: Clean list. Big score number right-aligned in Outfit Bold. Small stat badges under name.
9. **Typography hierarchy**: Large bold Outfit heading → small DM Sans subtitle → body text.
10. **Overall feel**: Soft, airy, premium. Like an expensive meditation app crossed with Notion.

---

## See Also

- `references/component-examples.md` — Full JSX code for every major component
- `references/api-integration.md` — How to wire components to the Express/MongoDB backend