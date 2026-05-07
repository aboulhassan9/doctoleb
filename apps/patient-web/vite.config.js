import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packagesPath = path.resolve(__dirname, '../../packages')

// ─────────────────────────────────────────────
// Patient-Web — standalone Vite app
// Serves: landing, login, signup, patient portal
// Domain: doctoleb.com (or patient subdomain)
// ─────────────────────────────────────────────

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      // ── Canonical package aliases ──
      '@core': path.resolve(packagesPath, 'core'),
      '@ui': path.resolve(packagesPath, 'ui'),

      // ── Backward-compat aliases for existing imports ──
      '@/services': path.resolve(packagesPath, 'core/services'),
      '@/schemas': path.resolve(packagesPath, 'core/schemas'),
      '@/lib': path.resolve(packagesPath, 'core/lib'),
      '@/contexts': path.resolve(packagesPath, 'ui/contexts'),
      '@/components': path.resolve(packagesPath, 'ui/components'),
      '@/hooks': path.resolve(packagesPath, 'core/hooks'),
      '@shared-ui': path.resolve(packagesPath, 'ui'),

      // ── Root catch-all ──
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3001,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
  },
})
