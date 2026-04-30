/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#0891b2", // Clinical Teal/Cyan
        "primary-hover": "#0e7490",
        "secondary": "#0f172a", // Midnight Blue Authority
        "background": "#f4f7fa", // Icy sterile white
        "background-light": "#f4f7fa", // Alias for legacy usages
        "background-dark": "#0f172a", // Dark panel used in auth pages
        "surface": "#ffffff",
        "error": "#e11d48", // Deep Rose
        "success": "#059669", // Emerald/Sage
        "warning": "#d97706", // Muted Amber
        "critical": "#be123c",
        "outline": "#cbd5e1", // Soft cooler gray
        // Legacy overrides mapped to new palettes:
        "primary-container": "#cffafe",
        "on-primary": "#ffffff",
        "on-secondary": "#f8fafc",
        "surface-tint": "#0891b2",
        "tertiary": "#14b8a6", // Teal/Mint
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"],
        "headline": ["Inter", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Inter", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
    },
  },
  plugins: [],
}
