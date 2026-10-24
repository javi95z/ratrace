// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

// Beside app/, not in it: every file there is a route. The shell's pieces as marked boxes: what is asked here is only what holds what.
const box = (name: string) => ({ children, style }: { children?: ReactNode; style?: object }) => (
  <div data-piece={name} data-style={JSON.stringify(style ?? null)}>{children}</div>
);
vi.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: box('gestures') }));
vi.mock('expo-router', () => ({
  SplashScreen: { preventAutoHideAsync: async () => undefined, hideAsync: async () => undefined },
  Stack: () => <div data-piece="stack" />,
  ThemeProvider: box('theme'),
  DarkTheme: { dark: true, colors: {}, fonts: {} },
}));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('./ui/gameFonts', () => ({ useGameFonts: () => true }));
vi.mock('./game/context', () => ({ GameProvider: box('game') }));
vi.mock('./ui/Page', () => ({ Page: box('page') }));

const { default: RootLayout } = await import('./app/_layout');

test('the whole app is inside one gesture root that fills the screen, so a drag can be read anywhere (a card\'s swipe)', () => {
  const { container } = render(<RootLayout />);
  const root = container.firstElementChild as HTMLElement;
  expect(root.dataset.piece).toBe('gestures');
  expect(JSON.parse(root.dataset.style!)).toMatchObject({ flex: 1 });
  expect(root.querySelector('[data-piece="stack"]')).not.toBeNull();
});
