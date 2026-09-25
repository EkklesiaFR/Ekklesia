import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 180000,
  expect: { timeout: 30000 },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
  },
  webServer: {
    command: 'npx next dev -p 3100',
    url: 'http://127.0.0.1:3100/login',
    timeout: 240000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
      FIREBASE_PROJECT_ID: 'demo-ekklesia-test',
      PV_SALT: 'local-test-only-not-a-production-secret',
    },
  },
});
