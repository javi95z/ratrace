import { expect, test, vi } from 'vitest';

// The real theme carries React Navigation's light grey (#f2f2f2) and a dark one of its own: the stand-in has both kinds of colour.
vi.mock('expo-router', () => ({
  DarkTheme: { dark: true, colors: { primary: 'p', background: 'rgb(1, 1, 1)', card: 'rgb(2, 2, 2)', text: 't', border: 'b', notification: 'n' }, fonts: {} },
}));
// The ground is drawn by the phone's own views: what is checked here is what the navigator is told.
vi.mock('react-native', () => ({ Image: () => null, View: () => null }));
vi.mock('./Page', () => ({ PAGE_GROUND: { source: 1, resizeMode: 'repeat', tile: 6 } }));
const { GROUND_THEME, SCREENS } = await import('./navigation');
const { COLORS } = await import('./theme');

test('no layer of the navigator paints grey behind a screen: the theme\'s background is transparent', () => {
  expect(GROUND_THEME.colors.background).toBe('transparent');
  expect(GROUND_THEME.colors.card).toBe('transparent');
  expect(GROUND_THEME.dark).toBe(true);
});

test('on the phone a screen moves as the platform moves its own: pushed and popped by its animation, taken back by a swipe from the edge only, opaque on its ground', () => {
  expect(SCREENS({ route: { name: '[locale]/collection' } })).toEqual({
    headerShown: false,
    animation: 'default',
    gestureEnabled: true,
    fullScreenGestureEnabled: false,
    contentStyle: { backgroundColor: COLORS['night-800'] },
  });
});

test('the front door comes as it is: the screen the app opens on, and the one every way home lands on', () => {
  expect(SCREENS({ route: { name: '[locale]/index' } }).animation).toBe('none');
  expect(SCREENS({ route: { name: '[locale]/play' } }).animation).toBe('default');
});
