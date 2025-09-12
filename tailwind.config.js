export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#6D28D9", // Deep Purple
          secondary: "#9333EA", // Lighter Purple
          accent: "#F59E0B", // Amber
          danger: "#EF4444", // Red for delete
          success: "#10B981", // Green for success
        },
      },
    },
  },
  plugins: [],
};
