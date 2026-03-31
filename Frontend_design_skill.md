# FRONTEND DESIGN SKILL
# English Learning Platform — Beautiful UI Guidelines
# Read /mnt/skills/public/frontend-design/SKILL.md FIRST,
# then read this file completely before touching any UI component.
# This skill extends the public design skill with codebase-specific
# patterns, constraints, and reference guidance.

---

## STEP 1 — ALWAYS READ THE PUBLIC SKILL FIRST

```
Read /mnt/skills/public/frontend-design/SKILL.md
```

That skill teaches the design philosophy — bold aesthetic direction,
distinctive typography, motion, spatial composition. This file tells
you how to apply that philosophy specifically to THIS codebase.

---

## PLATFORM CONTEXT — DESIGN WITH THIS IN MIND

This is an English Learning Platform used by:

```
Students:  Vietnamese children aged 8-15
           → Warm, encouraging, slightly playful, NOT childish
           → Progress feels rewarding, learning feels exciting

Teachers:  ESL teachers across Africa, Asia, Europe
           → Professional, efficient, clean
           → They live in this dashboard daily — it must be fast to navigate

Admins:    Center directors and managers
           → Data-rich, authoritative, trustworthy
           → They make financial and scheduling decisions here
```

Every design decision must serve the actual user of that page.
A student dashboard and an admin dashboard should feel like
different products even though they share the same codebase.

---

## EXISTING TECH STACK — CRITICAL CONSTRAINTS

### Styling Approach Used in This Codebase
The app uses TWO coexisting styling patterns — match whichever
pattern the file you're working in already uses:

**Pattern A — Inline styles with CSS-in-JS (Dashboards)**
Used in: TeacherDashboard.jsx, StudentDashboard.jsx, SubAdminLogin.jsx
```javascript
// Colors computed from dark mode state
const c = colors(isDarkMode); // returns { bg, card, border, heading, text, muted }

// Styles defined as JS objects
const styles = {
  sidebar: { background: c.card, borderRight: `1px solid ${c.border}` }
};

// Applied inline
<aside style={styles.sidebar}>
```

**Pattern B — Tailwind utility classes (Login pages, modals)**
Used in: TeacherLogin.jsx, ResetPassword.jsx, most modals
```jsx
<div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
  <button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg">
```

**Rule:** Match the pattern already in the file.
Never mix both patterns in the same component.
Never introduce styled-components or CSS modules — not used here.

### Fonts Already in Use
- **Plus Jakarta Sans** — primary font in TeacherDashboard
  (loaded via Google Fonts import in globalCSS function)
- **System fonts** — some older components
- **Rule for new designs:** Use Google Fonts via @import in globalCSS
  or a `<link>` tag. Always pair a display font with a body font.

### Icons — lucide-react ONLY
```javascript
import { Home, Settings, Users, BookOpen, ... } from 'lucide-react';
// NEVER use other icon libraries — only lucide-react is installed
```

### Dark Mode Pattern
Dashboards support dark mode via a `colors()` helper:
```javascript
function colors(dark) {
  return {
    bg:      dark ? "#0f1117" : "#f4f6fb",
    card:    dark ? "#1a1d27" : "#ffffff",
    border:  dark ? "#1e2235" : "#e8ecf4",
    heading: dark ? "#e2e8f0" : "#1e293b",
    text:    dark ? "#94a3b8" : "#475569",
    muted:   dark ? "#374151" : "#94a3b8",
  };
}
```
Every new dashboard component MUST respect dark mode.
Never hardcode colors that ignore the `dark` boolean.

### CSS Variables (src/index.css)
```css
:root {
  --brand-primary:   #6D28D9;
  --brand-secondary: #7C3AED;
  --brand-accent:    #F59E0B;
}
```
Use these for brand-colored elements. Per-center branding
overrides these at runtime via `applyBranding()`.

---

## DESIGN SYSTEM FOR THIS APP

### Color Philosophy
```
Admin portal:   Deep navy + electric blue accents
                Professional, data-rich, authoritative
                Dark mode is primary for admins

Teacher portal: Deep purple + violet gradient
                Clean, focused, efficient
                Current: Plus Jakarta Sans, #7c3aed primary

Student portal: Warm orange + deep purple
                Inviting, encouraging, achievement-focused
                Current accent: #f97316 orange, #2d1f6e heading
```

### Typography Scale (use consistently)
```
Page title:     24-32px, weight 800, letter-spacing -0.5px
Section heading: 18-20px, weight 700
Card title:     14-15px, weight 700
Body text:      13.5-14px, weight 400-500
Label/caption:  11-12px, weight 600-700, uppercase + letter-spacing
```

### Spacing Rhythm
```
Card padding:   24px (desktop), 16px (mobile)
Section gap:    24-32px
Element gap:    12-16px
Tight gap:      6-8px
Border radius:  10-14px (cards), 8px (inputs), 20px+ (pills/badges)
```

### Animation Patterns Already Used
```javascript
// Fade in on mount — already in TeacherDashboard + StudentDashboard
opacity: mounted ? 1 : 0,
transition: "opacity 0.3s ease"

// Slide in from side
transform: mounted ? "translateX(0)" : "translateX(-20px)",
transition: "all 0.6s ease"

// Hover lift (Tailwind components)
hover:shadow-md hover:-translate-y-0.5 transition-all

// Loading spinner
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
```

---

## REFERENCE SOURCES — HOW TO GET DESIGN INSPIRATION

This is the "how to get references" you asked about.
Claude can use these sources for inspiration before designing.

### Method 1 — Tell Claude to Search for References First
```
"Before designing, search for 'ESL learning platform dashboard UI'
and 'edtech student portal design' on the web for visual inspiration,
then apply what you find to this component"
```

### Method 2 — Give Claude a Direct Reference URL
```
"Design this page inspired by the clean aesthetic at
https://dribbble.com/tags/edtech — use the spatial
composition and color confidence you find there"
```

### Method 3 — Name a Reference App
```
"Design this with the same premium feel as Duolingo's
web dashboard — playful but structured, with clear
progress indicators and warm encouraging colors"
```

### Method 4 — Describe the Vibe
```
"This should feel like a premium fintech app but for education —
clean data visualization, confident typography, no clutter"
```

### Best Reference Apps for Your Use Case
These are real apps Claude knows well — reference them by name:

```
For Student Dashboard:
→ "Like Duolingo web" — gamified progress, streaks, warm
→ "Like Khan Academy" — clean educational, trustworthy
→ "Like Headspace app" — calm, encouraging, minimal

For Teacher Dashboard:
→ "Like Linear app" — ultra clean, keyboard-friendly, fast
→ "Like Notion" — structured, data-rich, sidebar navigation
→ "Like Vercel dashboard" — dark mode, developer-clean

For Admin Dashboard:
→ "Like Stripe dashboard" — data-dense but clear, authoritative
→ "Like Mixpanel" — analytics-forward, confident charts
→ "Like Retool" — power user friendly, no hand-holding

For Login Pages:
→ "Like Clerk auth pages" — split layout, premium feel
→ "Like Loom login" — clean, one-focus, trust signals
```

---

## PAGE-BY-PAGE DESIGN GUIDE

### Login Pages (Pattern B — Tailwind)
All 4 login pages (admin, teacher, student, sub-admin) should be:
```
Layout:     Split screen — branding/illustration left, form right
            (SubAdminLogin.jsx already does this well — use as reference)
Left side:  Brand color gradient background
            App logo + portal name
            3-4 feature bullets with emoji icons
            Stats or social proof
Right side: Clean white card
            Form with floating labels or clear labels
            Primary CTA button with gradient
            Forgot password link
Mobile:     Stack vertically, left panel collapses to header banner
```

**Font pairing for login pages:**
```javascript
// Add to the component:
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500&display=swap');
// Sora for headings, DM Sans for body
```

### Student Dashboard Home Tab
```
Tone:       Warm, rewarding, slightly gamified
Layout:     Hero welcome banner with student name + streak
            Quick stats row (classes remaining, completed, streak)
            Next class card (prominent, with countdown timer)
            Recent activity feed
            Teacher card with photo + message button

Colors:     Warm orange accents on white/cream cards
            Celebration micro-animations on stats
            Progress bars with gradient fills

Font:       Fredoka One or Nunito for display, DM Sans for body
            (fun but readable for young learners)
```

### Teacher Dashboard Home Tab
```
Tone:       Professional, efficient, at-a-glance
Layout:     Stats row (earnings this month, classes today, pending)
            Today's schedule (timeline view)
            Pending actions (bookings to accept, homework to grade)
            Quick links

Colors:     Purple primary, clean white cards
            Red/amber for pending actions that need attention
            Green for completed/earnings

Font:       Plus Jakarta Sans already used — keep it
```

### Admin Dashboard Overview Tab
```
Tone:       Data-rich, authoritative, executive summary
Layout:     KPI cards row (revenue, active students, active teachers)
            Revenue chart (weekly/monthly)
            Recent activity feed
            Teacher payment pending alerts

Colors:     Deep navy sidebar, clean white content area
            Blue/indigo accents for data
            Amber for warnings, green for success

Font:       Inter Display or DM Sans for numbers, clear hierarchy
```

---

## COMPONENT DESIGN PATTERNS

### Stat/KPI Cards
```javascript
// Pattern — always include: icon, value, label, trend
<div style={{
  background: c.card,
  borderRadius: "14px",
  padding: "20px",
  border: `1px solid ${c.border}`,
  display: "flex",
  flexDirection: "column",
  gap: "8px",
}}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
    <div style={{
      width: "40px", height: "40px",
      borderRadius: "10px",
      background: "linear-gradient(135deg, #7c3aed20, #7c3aed40)",
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <Icon size={18} color="#7c3aed" />
    </div>
    <span style={{
      fontSize: "11px", fontWeight: "700", padding: "3px 8px",
      borderRadius: "20px", background: "#10b98120", color: "#10b981"
    }}>+12%</span>
  </div>
  <p style={{ fontSize: "28px", fontWeight: "800", color: c.heading, margin: 0 }}>
    {value}
  </p>
  <p style={{ fontSize: "12px", color: c.muted, margin: 0, fontWeight: "600" }}>
    {label}
  </p>
</div>
```

### Empty States
Never show a blank area. Always show an encouraging empty state:
```javascript
// Pattern for empty states
<div style={{ textAlign: "center", padding: "48px 24px" }}>
  <div style={{
    width: "64px", height: "64px", borderRadius: "20px",
    background: isDarkMode ? "#1e1730" : "#f5f0ff",
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 16px"
  }}>
    <Icon size={28} color="#7c3aed" />
  </div>
  <p style={{ fontSize: "16px", fontWeight: "700", color: c.heading, margin: "0 0 8px" }}>
    No {itemName} yet
  </p>
  <p style={{ fontSize: "13.5px", color: c.muted, margin: "0 0 20px" }}>
    {encouragingMessage}
  </p>
  {/* Optional CTA button */}
</div>
```

### Loading States
```javascript
// Skeleton loading — not just a spinner
<div style={{ padding: "24px" }}>
  {[1,2,3].map(i => (
    <div key={i} style={{
      height: "64px", borderRadius: "12px",
      background: isDarkMode ? "#1e2235" : "#f1f5f9",
      marginBottom: "12px",
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  ))}
</div>
```

### Buttons
```javascript
// Primary button
<button style={{
  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
  color: "white",
  border: "none",
  borderRadius: "10px",
  padding: "10px 20px",
  fontSize: "13.5px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s",
  boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
}}>
  Button Label
</button>

// Ghost/secondary button
<button style={{
  background: isDarkMode ? "#1e1730" : "#f5f0ff",
  color: "#7c3aed",
  border: `1px solid ${isDarkMode ? "#2d1f4a" : "#ddd6fe"}`,
  borderRadius: "10px",
  padding: "10px 20px",
}}>
  Button Label
</button>
```

---

## GOLDEN RULES FOR THIS CODEBASE

1. **NEVER break existing logic** — redesigns change visual only.
   All state, hooks, API calls, event handlers stay 100% intact.
   Before redesigning a component, list every function and state
   that must be preserved and verify it's still there after.

2. **NEVER remove dark mode support** — every dashboard component
   must work in both light and dark. Test both before submitting.

3. **NEVER use a font not loaded** — if using a Google Font,
   add the @import in the globalCSS function or component head.
   Do not reference a font that isn't imported.

4. **ALWAYS add the mounted animation** — all dashboard pages
   use `opacity: mounted ? 1 : 0` fade-in. New pages must too.
   ```javascript
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   ```

5. **NEVER use emoji as icons** in dashboards — use lucide-react.
   Emoji are acceptable in student-facing encouraging messages only.

6. **ALWAYS handle mobile** — sidebar collapses, cards stack,
   font sizes reduce. Dashboards hide sidebar on small screens.

7. **CSS animations in globalCSS function** — if adding keyframe
   animations, add them to the globalCSS() string function,
   not as separate CSS files.

8. **Match the user's font** — Teachers use Plus Jakarta Sans,
   Students can use warmer fonts (Nunito, Fredoka),
   Admin uses clean sans (DM Sans, Inter Display).

---

## HOW TO PROMPT CLAUDE FOR BEST RESULTS

### Template prompt for redesigning a component:
```
Read /mnt/skills/public/frontend-design/SKILL.md then
read FRONTEND_DESIGN_SKILL.md completely.

Redesign: [filename e.g. src/pages/student/StudentLogin.jsx]

User:     [who uses this — student / teacher / admin]
Goal:     [what this page does]
Feel:     [aesthetic reference e.g. "like Duolingo, warm and encouraging"]
Keep:     ALL existing logic, state, API calls, and handlers intact
Change:   Visual design only — layout, colors, typography, animations

Before writing code:
1. State what aesthetic direction you're committing to
2. List all functions/state you're preserving
3. Then write the full redesigned component
```

### Template prompt for building a new component:
```
Read /mnt/skills/public/frontend-design/SKILL.md then
read FRONTEND_DESIGN_SKILL.md completely.

Build: [component name and purpose]
Lives in: [which dashboard — admin / teacher / student]
Data: [what props/data it receives]
Actions: [what the user can do with it]
Feel: [aesthetic reference]

Use Pattern [A or B] — match the dashboard it lives in.
Support dark mode if Pattern A.
```

### Template prompt for a full page redesign:
```
Read /mnt/skills/public/frontend-design/SKILL.md then
read FRONTEND_DESIGN_SKILL.md completely.

Full redesign of: [page]
Reference:        [app or URL to draw inspiration from]
Preserve exactly:
  - [list every function that must stay]
  - [list every API call]
  - [list every state variable]
Design direction: [your aesthetic brief]
```

---

## FILE STRUCTURE REFERENCE

```
src/
├── pages/
│   ├── admin/
│   │   ├── AdminDashboard.jsx      ← Pattern A, dark mode, lucide icons
│   │   └── tabs/                   ← Individual tab content components
│   ├── teacher/
│   │   ├── TeacherDashboard.jsx    ← Pattern A, Plus Jakarta Sans, purple
│   │   ├── TeacherLogin.jsx        ← Pattern A (inline styles), split layout
│   │   └── components/             ← Sub-components per feature
│   ├── student/
│   │   ├── StudentDashboard.jsx    ← Pattern A, warm orange accent
│   │   └── StudentLogin.jsx        ← Pattern B (Tailwind)
│   └── sub-admin/
│       ├── SubAdminDashboard.jsx   ← Pattern A, indigo theme
│       └── SubAdminLogin.jsx       ← Pattern A, navy/blue, split layout ← BEST REFERENCE
├── components/                     ← Shared components (Pattern B mostly)
├── index.css                       ← Tailwind base + CSS variables
└── App.css                         ← Navigation bar styles
```

**Best reference file in the codebase:**
`src/pages/sub-admin/SubAdminLogin.jsx`
This is the most polished login page — split layout, gradient left panel,
clean right form, mounted animations. Use it as the template when
redesigning other login pages.

---

*Read /mnt/skills/public/frontend-design/SKILL.md FIRST.*
*Then read this file completely.*
*Then state your aesthetic direction before writing a single line of code.*
*Never break logic. Never skip dark mode. Never reference unloaded fonts.*