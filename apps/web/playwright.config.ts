import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests drive the built game in the Chrome already on this machine, so no browser is
 * downloaded. Three screens are covered: a phone, which is the screen the game is designed for;
 * a laptop at the very width where the three columns begin and are tightest; and a wide desktop.
 */
// Another checkout of the game may be running its own tests on this machine: RATRACE_PORT keeps the two apart.
const PORT = Number(process.env.RATRACE_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  timeout: 240_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
    { name: 'laptop', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    // Always a fresh build: a server left running would be testing yesterday's game.
    // Set RATRACE_REUSE=1 to skip the build while working on the tests themselves.
    reuseExistingServer: process.env.RATRACE_REUSE === '1',
    timeout: 240_000,
    // The game under test has no cloud, whatever this checkout's `.env.local` says: these tests
    // are about the game on its device, and must never write to a real project. The build puts
    // these two values into the page, so blank here is blank in the browser.
    env: { NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' },
  },
});
