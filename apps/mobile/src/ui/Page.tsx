import type { ReactNode } from 'react';
import { ImageBackground, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dots from '../../assets/ui/dots.png';
import { COLORS, SHELL_WIDTH } from './theme';

/**
 * The web's body (globals.css): night-800 with a weave of single pixels (dots.png, one 6 pt tile in three
 * densities), the left and right safe insets padded, the column at most 448 wide and centred with a 12 gutter,
 * and the top safe inset painted night-900 over everything (the web's body::before), so nothing scrolls
 * by under the status bar.
 */
export function Page({ children }: { children: ReactNode }) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: COLORS['night-900'] }}>
      <ImageBackground
        source={dots}
        resizeMode="repeat"
        style={{
          flex: 1,
          backgroundColor: COLORS['night-800'],
          paddingTop: inset.top,
          paddingLeft: inset.left,
          paddingRight: inset.right,
        }}
      >
        <View style={{ flex: 1, width: '100%', maxWidth: SHELL_WIDTH, alignSelf: 'center', paddingHorizontal: 12 }}>
          {children}
        </View>
      </ImageBackground>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: inset.top, backgroundColor: COLORS['night-900'], zIndex: 60 }}
      />
    </View>
  );
}

/** A bar on the bottom edge (the web's pb-safe): padded by the larger of 12 and the bottom inset, on night-900. */
export function BottomBar({ children }: { children: ReactNode }) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: COLORS['night-900'], paddingBottom: Math.max(12, inset.bottom), paddingLeft: inset.left, paddingRight: inset.right }}>
      {children}
    </View>
  );
}
