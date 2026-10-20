import { DarkTheme } from 'expo-router';

/**
 * The navigator's theme: React Navigation paints its theme's background behind every stack (the
 * ScreenStack's container) and under every screen, light grey by default. Transparent here, so the
 * one ground of `Page` shows through every screen, as the web's body does under every page.
 */
export const GROUND_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: 'transparent', card: 'transparent' },
};

/** Every screen of the stack: see-through, no header, and changed at once (the web has no page transition). */
export const SCREENS = { headerShown: false, animation: 'none', contentStyle: { backgroundColor: 'transparent' } } as const;
