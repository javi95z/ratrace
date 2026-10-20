import type { ReactNode } from 'react';
import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dots from '../../assets/ui/dots.png';
import { COLORS, SHELL_WIDTH } from './theme';

/** The ground: dots.png (6 pt tile; @2x/@3x picked by the device) repeated, never stretched. */
export const GROUND = { source: dots, resizeMode: 'repeat', tile: 6 } as const;

/**
 * The web's body (globals.css): night-800 with a weave of single pixels (dots.png, one 6 pt tile in three
 * densities), the left and right safe insets padded, the column at most 448 wide and centred (its 12 gutter is the screens'),
 * and the top safe inset painted night-900 over everything (the web's body::before), so nothing scrolls
 * by under the status bar.
 */
export function Page({ children }: { children: ReactNode }) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: COLORS['night-900'] }}>
      {/* The ground has no padding of its own: the image filling it is then the whole screen, to its foot. */}
      <View style={{ flex: 1, backgroundColor: COLORS['night-800'] }}>
        <Image
          source={GROUND.source}
          resizeMode={GROUND.resizeMode}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
        />
        <View style={{ flex: 1, paddingTop: inset.top, paddingLeft: inset.left, paddingRight: inset.right }}>
          {/* The 12 gutter is each screen's own (navigation's SCREENS), inside the screen's box: a screen clips what it
              holds, and a gutter outside it cut off the outer edge of every frame that stood against the side. */}
          <View style={{ flex: 1, width: '100%', maxWidth: SHELL_WIDTH, alignSelf: 'center' }}>
            {children}
          </View>
        </View>
      </View>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: inset.top, backgroundColor: COLORS['night-900'], zIndex: 60 }}
      />
    </View>
  );
}

/**
 * A bar on the bottom edge (the web's pb-safe), placed OUTSIDE Page (Page already pads the side insets for what it
 * holds; this bar spans the screen, so it pads them itself): padded by the larger of 12 and the bottom inset, on night-900. */
export function BottomBar({ children }: { children: ReactNode }) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: COLORS['night-900'], paddingBottom: Math.max(12, inset.bottom), paddingLeft: inset.left, paddingRight: inset.right }}>
      {children}
    </View>
  );
}
