/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./apps/**/*.{js,ts,jsx,tsx,html}",
    "./packages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "rgb(var(--color-primary-rgb) / <alpha-value>)", // Tenant-configured primary
        "primary-hover": "rgb(var(--color-primary-hover-rgb) / <alpha-value>)",
        "secondary": "rgb(var(--color-secondary-rgb) / <alpha-value>)", // Tenant-configured secondary
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
        "surface-tint": "rgb(var(--color-primary-rgb) / <alpha-value>)",
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
        "2xl": "var(--radius-card)",
        "full": "9999px"
      },
      width: {
        "sidebar": "var(--sidebar-width)",
      },
      height: {
        "header": "var(--header-height)",
      },
      spacing: {
        "page": "var(--spacing-page)",
        "card": "var(--spacing-card)",
        "section": "var(--spacing-section)",
      },
      boxShadow: {
        "card": "var(--shadow-card)",
        "elevated": "var(--shadow-elevated)",
      },
      transitionDuration: {
        "fast": "150ms",
        "base": "200ms",
        "slow": "300ms",
      },
    },
  },
  plugins: [],
}
