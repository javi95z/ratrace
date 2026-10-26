import { expect, test, vi } from 'vitest';

vi.mock('expo-router', () => ({
  DarkTheme: { dark: true, colors: { primary: 'p', background: 'rgb(1, 1, 1)', card: 'rgb(2, 2, 2)', text: 't', border: 'b', notification: 'n' }, fonts: {} },
}));
const { GROUND_THEME, SCREENS, ScreenGround } = await import('./navigation');

test('no layer of the navigator paints over the ground: the theme\'s background is transparent', () => {
  expect(GROUND_THEME.colors.background).toBe('transparent');
  expect(GROUND_THEME.colors.card).toBe('transparent');
});

test('on the web every page is see-through, has no header and changes at once, as a web page does, over the one ground', () => {
  expect(SCREENS({ route: { name: '[locale]/collection' } })).toEqual({ headerShown: false, animation: 'none', contentStyle: { backgroundColor: 'transparent' } });
  const page = { type: 'main' } as never;
  expect(ScreenGround({ children: page })).toBe(page);
});
