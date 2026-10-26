import { DarkTheme } from 'expo-router';
import type { ReactElement } from 'react';
import { Image, View } from 'react-native';
import { PAGE_GROUND } from './Page';
import { COLORS } from './theme';

/**
 * The navigator's theme: React Navigation paints its theme's background behind every stack (the ScreenStack's container) and under every screen,
 * light grey by default. Transparent here: each screen brings its own ground (`ScreenGround`), and nothing grey shows behind a screen as it moves.
 */
export const GROUND_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: 'transparent', card: 'transparent' },
};

/** The front door's route in the stack: the first screen, and the one the game lands on. */
const FRONT_DOOR = '[locale]/index';

/**
 * Every screen of the stack, as the phone moves between its own: no header, and the platform's own push and pop (iOS slides the new screen in from
 * the right over the last, which a swipe from the left edge takes back with the finger; Android plays the system's own). The swipe back is the edge's
 * only, never the whole screen's (iOS 26's default): a card is swiped, and a strip of tabs scrolled, sideways. The front door comes as it is: it is
 * the screen the app opens on (the bare address led to it), and the one every way home lands on, whose pages slide away off it as they go. Each
 * screen is opaque, on its own ground, so the one under it never shows through as it moves.
 */
export const SCREENS = ({ route }: { route: { name: string } }) =>
  ({
    headerShown: false,
    animation: route.name === FRONT_DOOR ? 'none' : 'default',
    gestureEnabled: true,
    fullScreenGestureEnabled: false,
    contentStyle: { backgroundColor: COLORS['night-800'] },
  }) as const;

/**
 * The ground under every screen (the navigator's `screenLayout`): the page's own, night-800 and its weave of single pixels (`Page`), so a screen
 * that slides in covers the one under it whole, and looks the same at rest as the page did.
 */
export function ScreenGround({ children }: { children: ReactElement }): ReactElement {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS['night-800'] }}>
      <Image
        source={PAGE_GROUND.source}
        resizeMode={PAGE_GROUND.resizeMode}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
      />
      {children}
    </View>
  );
}
