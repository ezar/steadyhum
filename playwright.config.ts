import { defineConfig, devices } from '@playwright/test'

/**
 * Use an already-installed Chromium instead of Playwright's own download when
 * the environment provides one (CI images, sandboxes). Unset locally.
 */
const executablePath = process.env['CHROMIUM_PATH']

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
          // The whole product is a microphone. Every e2e run needs a fake one.
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
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
