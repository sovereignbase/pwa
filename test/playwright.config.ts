import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  testDir: 'e2e',
  outputDir: fileURLToPath(new URL('./test-results', import.meta.url)),
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  webServer: {
    cwd: '..',
    command: 'node test/e2e/server.mjs',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 1_000 },
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
})
