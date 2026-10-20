import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

/** The phone's tests that draw the game: they get the native modules' stand-ins (apps/mobile/src/testing/setup.ts). */
const PHONE_GAME = 'apps/mobile/src/{game,app,testing}/**/*.test.{ts,tsx}';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // The web app imports its own files as `@/...`.
      { find: /^@\//, replacement: fileURLToPath(new URL('./apps/web/src', import.meta.url)) + '/' },
      // The phone app's components are tested on react-native-web, in jsdom.
      { find: /^react-native$/, replacement: 'react-native-web' },
    ],
  },
  test: {
    // A test is given half a minute, not five seconds: two sessions at work on one machine slow everything several times over,
    // and a test that only ran out of time says nothing about the game. Whole lives ask for more where they are played.
    testTimeout: 30_000,
    // next-intl's middleware imports `next/server` without the extension Node asks of an ES module: run through Vite, it resolves.
    server: { deps: { inline: ['next-intl'] } },
    projects: [
      {
        extends: true,
        test: {
          name: 'repo',
          include: ['packages/*/src/**/*.test.ts', 'tools/*/src/**/*.test.ts', 'apps/*/src/**/*.test.{ts,tsx}', 'apps/*/scripts/**/*.test.ts'],
          exclude: [...configDefaults.exclude, PHONE_GAME],
        },
      },
      {
        // The phone's game, its screens and its routes run on the phone's native modules, which a test cannot load (the router, the
        // device's store, the sound, the safe area, the sprites' canvas): every one of these tests has stand-ins for them, made once.
        // The kit's own tests (apps/mobile/src/ui) mock what they need themselves: some of them test the very modules faked here.
        extends: true,
        test: { name: 'phone', include: [PHONE_GAME], setupFiles: ['apps/mobile/src/testing/setup.ts'] },
      },
    ],
  },
});
