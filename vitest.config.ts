import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The web app imports its own files as `@/...`.
    alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) },
  },
  test: {
    // A test is given half a minute, not five seconds: two sessions at work on one machine slow everything several times over,
    // and a test that only ran out of time says nothing about the game. Whole lives ask for more where they are played.
    testTimeout: 30_000,
    // next-intl's middleware imports `next/server` without the extension Node asks of an ES module: run through Vite, it resolves.
    server: { deps: { inline: ['next-intl'] } },
    include: [
      'packages/*/src/**/*.test.ts',
      'tools/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.{ts,tsx}',
      'apps/*/scripts/**/*.test.ts',
    ],
  },
});
