import { afterEach, vi } from 'vitest';
import { backHandler, resetFakes } from './fakes';

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
vi.mock('expo-file-system', async () => (await import('./fakes')).expoFileSystem);
vi.mock('expo-sharing', async () => (await import('./fakes')).expoSharing);
vi.mock('../ui/soundSources', async () => (await import('./fakes')).soundSources);
vi.mock('react-native-safe-area-context', async () => (await import('./fakes')).safeArea);
vi.mock('../ui/Sprite', async () => (await import('./fakes')).spriteModule);
vi.mock('react-native-gesture-handler', async () => (await import('./fakes')).gestureHandler);
// What a screen draws with Skia itself (a portrait's backdrop of rays, the kit's charts): pieces that say what they were asked to draw.
vi.mock('@shopify/react-native-skia', async () => (await import('../ui/testing/skia')).skiaFake());
// Reanimated needs the worklets runtime: the shared reactive fake stands in for it.
vi.mock('react-native-reanimated', async () => (await import('../ui/testing/reanimated')).reanimatedFake());
// A list that draws only the rows near the screen has none laid out in jsdom: it draws them all (`everyRow`).
vi.mock('react-native', async (original) => {
  const native = await original<typeof import('react-native')>();
  return { ...native, FlatList: (await import('./fakes')).everyRow(native.FlatList as never) };
});

// Android's Back: react-native-web has none (it says so on every listener); the fake keeps who listens, for `pressBack`. Loaded only now, after
// the media queries are in place: react-native-web reads them as it loads, and with none it takes the phone to be asking for reduced motion.
const { BackHandler } = await import('react-native');
Object.assign(BackHandler, backHandler);

afterEach(resetFakes);
