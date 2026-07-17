import { defineConfig, devices } from '@playwright/test';

const VITE_PORT = 5173;
const API_URL = process.env['VITE_API_URL'] ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${VITE_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `VITE_API_URL=${API_URL} npm run dev -- --port ${VITE_PORT}`,
    url: `http://localhost:${VITE_PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
  },
});
