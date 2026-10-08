import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 30_000, forbidOnly: !!process.env.CI, retries: 0, workers: 1,
  outputDir: 'test-results/browser',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['junit', { outputFile: 'test-results/browser.xml' }]],
  use: { baseURL: 'http://localhost:15173', ignoreHTTPSErrors: true, trace: 'retain-on-failure', screenshot: 'only-on-failure', ...devices['Desktop Chrome'] },
  webServer: [
    { command: 'pnpm --filter api exec node --import tsx scripts/checks/integration/test-server.ts', url: 'http://127.0.0.1:18787/health', reuseExistingServer: false, timeout: 60_000 },
    { command: 'pnpm --filter web exec vite --host 127.0.0.1 --port 15173 --strictPort', url: 'http://127.0.0.1:15173', reuseExistingServer: false,
      env: { VITE_API_BASE_URL: 'http://localhost:18787', VITE_GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com', VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' } },
  ],
});
