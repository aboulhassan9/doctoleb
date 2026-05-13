import { defineConfig, devices } from '@playwright/test'

// Local E2E config for tests/e2e/. Runs against a `npm run preview`-style
// server. Used by the `npm run test:e2e:local` script and the
// verify-full CI lane.
//
// The deployed-flow-smoke scripts in scripts/*.mjs target the production
// Vercel URLs — they are separate from this config.

const PORT = Number(process.env.E2E_PORT || 4173)

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['junit', { outputFile: 'output/playwright/results.xml' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx vite preview --config apps/marketing/vite.config.js --port ${PORT} --strictPort`,
    port: PORT,
    timeout: 90_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
