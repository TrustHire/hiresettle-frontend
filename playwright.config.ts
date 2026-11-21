import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'PLAYWRIGHT_E2E=1 NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api/v1 NEXT_PUBLIC_USDC_ADDRESS=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA npm run dev -- --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3001/auth/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
