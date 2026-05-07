import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const srcPath = fileURLToPath(new URL('./src', import.meta.url))
const packagesPath = fileURLToPath(new URL('./packages', import.meta.url))
const appsPath = fileURLToPath(new URL('./apps', import.meta.url))

// ─────────────────────────────────────────────────────
// DoctoLeb Monorepo — Root dev server
//
// This config serves ALL routes during development.
// In production, apps/patient-web and apps/clinic-ops
// build independently via their own vite.config.js files.
//
// Canonical aliases (new code MUST use these):
//   @core/*          → packages/core/*
//   @ui/*            → packages/ui/*
//   @patient-web/*   → apps/patient-web/src/*
//   @clinic-ops/*    → apps/clinic-ops/src/*
//
// Legacy backward-compat aliases (will be removed):
//   @/services/*     → packages/core/services/*
//   @/schemas/*      → packages/core/schemas/*
//   @/lib/*          → packages/core/lib/*
//   @/contexts/*     → packages/ui/contexts/*
//   @/components/*   → packages/ui/components/*
//   @/hooks/*        → packages/core/hooks/*
// ─────────────────────────────────────────────────────

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // ── Canonical package aliases ──
      '@core': path.resolve(packagesPath, 'core'),
      '@ui': path.resolve(packagesPath, 'ui'),

      // ── App aliases ──
      '@patient-web': path.resolve(appsPath, 'patient-web/src'),
      '@clinic-ops': path.resolve(appsPath, 'clinic-ops/src'),

      // ── Legacy backward-compat aliases ──
      '@/services': path.resolve(packagesPath, 'core/services'),
      '@/schemas': path.resolve(packagesPath, 'core/schemas'),
      '@/lib': path.resolve(packagesPath, 'core/lib'),
      '@/contexts': path.resolve(packagesPath, 'ui/contexts'),
      '@/components': path.resolve(packagesPath, 'ui/components'),
      '@/hooks': path.resolve(packagesPath, 'core/hooks'),

      // ── Shared-UI alias (used by some proxy files) ──
      '@shared-ui': path.resolve(packagesPath, 'ui'),

      // ── Root catch-all (must be LAST) ──
      '@': srcPath,
    },
  },
})
