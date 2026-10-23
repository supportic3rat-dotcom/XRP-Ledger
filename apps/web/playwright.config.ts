import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3300',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: { command: 'pnpm dev', url: 'http://localhost:3300', reuseExistingServer: true, timeout: 120_000 },
});
