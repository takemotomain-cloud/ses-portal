import { defineConfig, devices } from '@playwright/test';

const apiCommand =
  'DATABASE_URL=postgresql://ses_dev:ses_dev_password@127.0.0.1:5433/ses_portal?schema=public ' +
  'CORS_ORIGIN=http://127.0.0.1:3002 PORT=3001 node_modules/.bin/nest start';

const webCommand =
  'NEXT_PUBLIC_API_URL=http://127.0.0.1:3001 NEXTAUTH_URL=http://127.0.0.1:3002 ' +
  'node_modules/.bin/next dev --hostname 127.0.0.1 --port 3002';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html'], ['github']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: apiCommand,
      cwd: 'apps/api',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: webCommand,
      cwd: 'apps/web',
      url: 'http://127.0.0.1:3002/login',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
