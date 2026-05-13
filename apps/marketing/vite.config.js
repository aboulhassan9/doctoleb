import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packagesPath = path.resolve(__dirname, '../../packages')

// ─────────────────────────────────────────────
// Marketing — standalone Vite app for doctoleb.com
// Serves the SaaS marketing surface: landing, features, pricing,
// FAQ, lead capture. Public, no tenant context, no PHI.
// ─────────────────────────────────────────────

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@core': path.resolve(packagesPath, 'core'),
      '@ui': path.resolve(packagesPath, 'ui'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
  },
})
