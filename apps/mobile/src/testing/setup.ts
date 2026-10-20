import { afterEach, vi } from 'vitest';
import { resetFakes } from './fakes';

/*
 * Run before every test of the phone's game (see vitest.config.ts): puts `fakes.ts` in place of the native modules the game
 * reaches, which cannot be loaded in a test, and puts them back as they were after each test. A test that wants another
 * answer from one of them mocks it itself; its own mock is the one in force.
 */

// jsdom has no media queries, and react-native-web then takes the phone to be asking for reduced motion: here it never does.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }),
  });
}

vi.mock('expo-router', async () => (await import('./fakes')).expoRouter);
vi.mock('expo-localization', async () => (await import('./fakes')).expoLocalization);
vi.mock('expo-sqlite/kv-store', async () => (await import('./fakes')).expoKeyValueStore);
vi.mock('expo-audio', async () => (await import('./fakes')).expoAudio);
vi.mock('../ui/soundSources', async () => (await import('./fakes')).soundSources);
vi.mock('react-native-safe-area-context', async () => (await import('./fakes')).safeArea);
vi.mock('../ui/Sprite', async () => (await import('./fakes')).spriteModule);
// Reanimated needs the worklets runtime: the shared reactive fake stands in for it.
vi.mock('react-native-reanimated', async () => (await import('../ui/testing/reanimated')).reanimatedFake());

afterEach(resetFakes);
