import { afterEach, vi } from 'vitest';
import { backHandler, resetAlso, resetFakes } from './fakes';

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
vi.mock('expo-media-library', async () => (await import('./fakes')).expoMediaLibrary);
vi.mock('expo-network', async () => (await import('./fakes')).expoNetwork);
vi.mock('expo-web-browser', async () => (await import('./fakes')).expoWebBrowser);
vi.mock('expo-constants', async () => (await import('./fakes')).expoConstants);
vi.mock('expo-clipboard', async () => (await import('./fakes')).expoClipboard);
vi.mock('react-native-webview', async () => (await import('./fakes')).reactNativeWebView);
// The phone's notices, counted as they are loaded: the push loads them only where the phone can be told (online/push.ts).
vi.mock('expo-notifications', async () => {
  const fakes = await import('./fakes');
  fakes.notices.loads += 1;
  return fakes.expoNotifications;
});
vi.mock('expo-device', async () => (await import('./fakes')).expoDevice);
vi.mock('../ui/soundSources', async () => (await import('./fakes')).soundSources);
vi.mock('react-native-safe-area-context', async () => (await import('./fakes')).safeArea);
vi.mock('../ui/Sprite', async () => (await import('./fakes')).spriteModule);
vi.mock('react-native-gesture-handler', async () => (await import('./fakes')).gestureHandler);
// What a screen draws with Skia itself (a portrait's backdrop of rays, the kit's charts): pieces that say what they were asked to draw.
vi.mock('@shopify/react-native-skia', async () => (await import('../ui/testing/skia')).skiaFake());
// Reanimated needs the worklets runtime: the shared reactive fake stands in for it.
vi.mock('react-native-reanimated', async () => (await import('../ui/testing/reanimated')).reanimatedFake());
// A list that draws only the rows near the screen has none laid out in jsdom: it draws them all (`everyRow`). And the app is in front, or not, as
// a test says (`appState`): react-native-web's follows the page's visibility, which jsdom never changes.
vi.mock('react-native', async (original) => {
  const native = await original<typeof import('react-native')>();
  const fakes = await import('./fakes');
  return { ...native, FlatList: fakes.everyRow(native.FlatList as never), AppState: fakes.appStateModule };
});

// Android's Back: react-native-web has none (it says so on every listener); the fake keeps who listens, for `pressBack`. Loaded only now, after
// the media queries are in place: react-native-web reads them as it loads, and with none it takes the phone to be asking for reduced motion.
const { BackHandler } = await import('react-native');
Object.assign(BackHandler, backHandler);

// The phone's connection, listened to once for the whole app: forgotten with the stand-ins, so no test reads another's.
const { forgetConnection } = await import('../online/page');
resetAlso(forgetConnection);
// And every sheet free to open again, should a test end while the game was shutting them to start again.
const { openSheetsAgain } = await import('../ui/back');
resetAlso(openSheetsAgain);
// And no turn held by a sheet a test took away while it was shown (on iOS or Android, `endTurnOnceGone`): the next test's sheets wait for none.
const { letHeldTurnsGo } = await import('../ui/back');
resetAlso(letHeldTurnsGo);

afterEach(resetFakes);
