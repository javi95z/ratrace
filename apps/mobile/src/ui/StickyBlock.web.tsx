import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

/** On the web the page's own scroll keeps the sticky block at its top (`stickyHeaderIndices`, the browser's `position: sticky`): the phone's is `StickyBlock.tsx`. */
export const SCROLL_STICKS = true;

/** The sticky block of a `StickyScreen` on the web: the page sticks it, and it takes no touch where it draws nothing. */
export function StickyBlock({ children }: { scrollY: SharedValue<number>; stuckAt: SharedValue<number>; children: ReactNode }) {
  // `pointerEvents` as a style too: React Native's sticky header takes its child's style as its own, and must let a press through.
  return (
    <View pointerEvents="box-none" style={{ pointerEvents: 'box-none' }}>
      {children}
    </View>
  );
}
