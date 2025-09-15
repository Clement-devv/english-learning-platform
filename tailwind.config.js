// tailwind.config.js
module.exports = {
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
