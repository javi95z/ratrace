import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The platform a test says, and the library's stand-in: what it was given, and the actions a test presses.
const phone = vi.hoisted(() => ({
  OS: 'ios',
  environment: 'standalone',
  items: [] as unknown[],
  initial: null as { params?: Record<string, unknown> } | null,
  listeners: new Set<(action: { params?: Record<string, unknown> }) => void>(),
}));
vi.mock('react-native', () => ({ Platform: { get OS() { return phone.OS; } } }));
vi.mock('expo-constants', () => ({ default: { get executionEnvironment() { return phone.environment; } } }));
vi.mock('expo-quick-actions', () => ({
  setItems: async (items: unknown[]) => void (phone.items = items),
  get initial() {
    return phone.initial;
  },
  addListener: (listener: (action: { params?: Record<string, unknown> }) => void) => {
    phone.listeners.add(listener);
    return { remove: () => void phone.listeners.delete(listener) };
  },
}));

beforeEach(() => vi.resetModules());
afterEach(() => {
  phone.OS = 'ios';
  phone.environment = 'standalone';
  phone.items = [];
  phone.initial = null;
  phone.listeners.clear();
});
const settle = () => new Promise((done) => setTimeout(done, 0));

test('on iOS each shortcut is the page it opens, its title, and one of the system\'s own symbols', async () => {
  const { setShortcuts } = await import('./shortcuts');
  setShortcuts([{ page: 'play', title: 'Continue your life' }, { page: 'new', title: 'New life' }]);
  await settle();
  expect(phone.items).toEqual([
    { id: 'play', title: 'Continue your life', icon: 'symbol:play.fill', params: { page: 'play' } },
    { id: 'new', title: 'New life', icon: 'symbol:plus', params: { page: 'new' } },
  ]);
});

test('on Android its icon is the game\'s own sprite, drawn by app.json\'s plugin', async () => {
  phone.OS = 'android';
  const { setShortcuts } = await import('./shortcuts');
  setShortcuts([{ page: 'challenge', title: 'Weekly challenge' }, { page: 'rankings', title: 'Rankings' }]);
  await settle();
  expect(phone.items).toEqual([
    { id: 'challenge', title: 'Weekly challenge', icon: 'shortcut_challenge', params: { page: 'challenge' } },
    { id: 'rankings', title: 'Rankings', icon: 'shortcut_rankings', params: { page: 'rankings' } },
  ]);
});

test('opens the page of the shortcut that opened the app once, then of each pressed; a shortcut to no page of the game opens nothing', async () => {
  phone.initial = { params: { page: 'challenge' } };
  const { shortcutTaps } = await import('./shortcuts');
  const opened: string[] = [];
  const stop = shortcutTaps.onTap(({ page }) => void opened.push(page));
  await settle();
  for (const listener of phone.listeners) listener({ params: { page: 'new' } });
  for (const listener of phone.listeners) listener({ params: { page: 'nowhere' } });
  expect(opened).toEqual(['challenge', 'new']);
  stop();
  // The game started again listens again, and is not opened again on the shortcut that opened the app.
  shortcutTaps.onTap(({ page }) => void opened.push(page));
  await settle();
  expect(opened).toEqual(['challenge', 'new']);
});

test('nothing of it in Expo Go, which has no such library, nor on the web', async () => {
  phone.environment = 'storeClient';
  const { setShortcuts, shortcutTaps } = await import('./shortcuts');
  setShortcuts([{ page: 'new', title: 'New life' }]);
  shortcutTaps.onTap(() => undefined);
  await settle();
  expect(phone.items).toEqual([]);
  expect(phone.listeners.size).toBe(0);
});
