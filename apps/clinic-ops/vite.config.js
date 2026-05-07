import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packagesPath = path.resolve(__dirname, '../../packages')

// ─────────────────────────────────────────────
// Clinic-Ops — standalone Vite app
// Serves: staff login, doctor/secretary/predoctor dashboards
// Domain: ops.doctoleb.com (or clinic subdomain)
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

      // ── Self-alias for encounter hooks/components barrel proxies ──
      '@clinic-ops': path.resolve(__dirname, 'src'),

      // ── Backward-compat aliases ──
      '@/services': path.resolve(packagesPath, 'core/services'),
      '@/schemas': path.resolve(packagesPath, 'core/schemas'),
      '@/lib': path.resolve(packagesPath, 'core/lib'),
      '@/contexts': path.resolve(packagesPath, 'ui/contexts'),
      '@/components': path.resolve(packagesPath, 'ui/components'),
      '@/hooks': path.resolve(packagesPath, 'core/hooks'),
      '@shared-ui': path.resolve(packagesPath, 'ui'),

      // ── Patient-web cross-app (for DashboardPage fallback) ──
      '@patient-web': path.resolve(__dirname, '../patient-web/src'),

      // ── Root catch-all ──
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3002,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
  },
})
