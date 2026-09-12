import { defineConfig, devices } from '@playwright/test'

import { executablePath, FAKE_MIC_ARGS } from './e2e/fake-audio.ts'

/**
 * Base path to exercise. The suite runs twice in CI: at the site root, and under
 * the subpath GitHub Pages actually serves. Tests navigate with relative URLs
 * (`./privacy`, not `/privacy`) so both resolve against this base.
 */
const basePath = process.env['BASE_PATH'] ?? '/'
const port = basePath === '/' ? 4173 : 4174
const baseURL = `http://localhost:${port}${basePath}`

export default defineConfig({
  testDir: './e2e',
  // Writes the silent-audio fixture that e2e/guards.spec.ts feeds Chromium.
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          ...(executablePath === undefined ? {} : { executablePath }),
          args: FAKE_MIC_ARGS,
        },
        permissions: ['microphone'],
      },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
})
