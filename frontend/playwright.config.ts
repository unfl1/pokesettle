import { defineConfig } from '@playwright/test';
const port = process.env.PLAYWRIGHT_PORT ?? '5173';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL,
    browserName: 'chromium',
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ??
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    },
    screenshot: 'off',
    trace: 'off',
  },
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1' ? undefined : {
    command: 'cp -R public .next/standalone/ && cp -R .next/static .next/standalone/.next/ && node .next/standalone/server.js',
    env: { HOSTNAME: '127.0.0.1', PORT: port },
    url: baseURL,
    reuseExistingServer: true,
  },
});
