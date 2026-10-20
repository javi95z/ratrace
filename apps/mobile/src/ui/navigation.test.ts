import { expect, test, vi } from 'vitest';

// The real theme carries React Navigation's light grey (#f2f2f2) and a dark one of its own: the stand-in has both kinds of colour.
vi.mock('expo-router', () => ({
  DarkTheme: { dark: true, colors: { primary: 'p', background: 'rgb(1, 1, 1)', card: 'rgb(2, 2, 2)', text: 't', border: 'b', notification: 'n' }, fonts: {} },
}));
const { GROUND_THEME, SCREENS } = await import('./navigation');

test('no layer of the navigator paints over the ground: the theme\'s background is transparent', () => {
  expect(GROUND_THEME.colors.background).toBe('transparent');
  expect(GROUND_THEME.colors.card).toBe('transparent');
  expect(GROUND_THEME.dark).toBe(true);
});

test('every screen is see-through, has no header, changes at once as a web page does, and holds the 12 gutter itself', () => {
  expect(SCREENS).toEqual({ headerShown: false, animation: 'none', contentStyle: { backgroundColor: 'transparent', paddingHorizontal: 12 } });
});
