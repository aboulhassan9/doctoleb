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
        "primary": "rgb(var(--color-primary-rgb) / <alpha-value>)",
        "primary-hover": "rgb(var(--color-primary-hover-rgb) / <alpha-value>)",
        "secondary": "rgb(var(--color-secondary-rgb) / <alpha-value>)",
        "background": "#ffffff",
        "background-light": "#fafafa",
        "background-dark": "#09090b",
        "surface": "#ffffff",
        "error": "#ef4444",
        "success": "#10b981",
        "warning": "#f59e0b",
        "critical": "#dc2626",
        "outline": "#e2e8f0",
        "primary-container": "#e0f2fe",
        "on-primary": "#ffffff",
        "on-secondary": "#f8fafc",
        "surface-tint": "rgb(var(--color-primary-rgb) / <alpha-value>)",
        "tertiary": "#0ea5e9",
      },
      fontFamily: {
        "display": ["Inter", "system-ui", "sans-serif"],
        "headline": ["Inter", "system-ui", "sans-serif"],
        "body": ["Inter", "system-ui", "sans-serif"],
        "label": ["SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "sm": "0.375rem",
        "md": "0.5rem",
        "lg": "0.75rem",
        "xl": "1rem",
        "2xl": "1.5rem",
        "full": "9999px"
      },
      width: {
        "sidebar": "16rem",
      },
      height: {
        "header": "4rem",
      },
      spacing: {
        "page": "2rem",
        "card": "1.5rem",
        "section": "2.5rem",
      },
      boxShadow: {
        "card": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "elevated": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
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
