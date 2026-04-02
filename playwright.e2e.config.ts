/**
 * Playwright config for comprehensive E2E tests against the live PM2 app.
 * Targets: http://127.0.0.1:3001/family-ledger-web
 * No webServer directive — app must already be running via PM2.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/specs',
  testMatch: ['comprehensive-e2e.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer — PM2 manages family-ledger-web on port 3001
})
