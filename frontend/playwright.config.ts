import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ??
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    },
    screenshot: 'off',
    trace: 'off',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
});
