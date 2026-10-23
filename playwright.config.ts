import { defineConfig, devices } from '@playwright/test';
const testDatabase = `/tmp/crown-e2e-${process.pid}.sqlite`;
export default defineConfig({
  testDir: 'tests/e2e',
  metadata: { testDatabase },
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['iPhone 13'],
    defaultBrowserType: 'chromium',
  },
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:5174',
      timeout: 60000,
      reuseExistingServer: false,
      env: {
        PORT: '3101',
        WEB_PORT: '5174',
        CROWN_DB: testDatabase,
        CROWN_DEMO: 'true',
        CROWN_ADMIN_TOOLS: 'true',
      },
    },
    {
      command: 'npm run start',
      url: 'http://127.0.0.1:3102',
      timeout: 60000,
      reuseExistingServer: false,
      env: {
        PORT: '3102',
        CROWN_DB: `/tmp/crown-pwa-${process.pid}.sqlite`,
        CROWN_DEMO: 'true',
        CROWN_ADMIN_TOOLS: 'false',
      },
    },
  ],
});
