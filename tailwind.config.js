// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#6D28D9",     // deep purple
          secondary: "#7C3AED",   // lighter purple
          accent: "#F59E0B",      // amber
          success: "#10B981",
          danger: "#EF4444",
          muted: "#6B7280",
        },
        glass: "rgba(255,255,255,0.6)",
        // Admin dashboard tokens — values live in src/index.css (.as-root), so they
        // follow the center's brand colour and flip with dark mode automatically.
        ad: {
          bg:             "var(--a-bg)",
          surface:        "var(--a-surface)",
          raised:         "var(--a-raised)",
          line:           "var(--a-line)",
          "line-strong":  "var(--a-line-strong)",
          ink:            "var(--a-ink)",
          "ink-2":        "var(--a-ink-2)",
          muted:          "var(--a-muted)",
          accent:         "var(--a-accent)",
          "on-accent":    "var(--a-on-accent)",
          "accent-hover": "var(--a-accent-hover)",
          "accent-soft":  "var(--a-accent-soft)",
          "accent-line":  "var(--a-accent-line)",
          "accent-ink":   "var(--a-accent-ink)",
        },
      },
      boxShadow: {
        "soft-lg": "0 10px 30px rgba(16,24,40,0.10)",
      },
      borderRadius: {
        "xl-2": "1rem",
      },
    },
  },
  plugins: [],
};
