import type { ReactNode } from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/**
 * Whether the page's own scroll keeps the sticky block at its top (React Native's `stickyHeaderIndices`). Not on the phone: there the block keeps
 * itself there (`StickyBlock`). React Native's sticky header tells the screen's tree where it stands (the tree a press is measured in) a moment after
 * it moves, and drops the move that takes it back to its place in the column when the page comes back over its top in one step (a long tab left
 * for a short one, a fling to the top): it sees that 0 as the first value of a new animation, and the tree keeps the last place it stuck at. The
 * block is drawn where it should be all the same, but on Android a finger that moves at all while pressing is checked against the tree's place,
 * and every press in the block (the Hud's figures, the finances' tabs) is lost; on iOS, a press that moves. (The web's twin: the page's own.)
 */
export const SCROLL_STICKS = false;

/**
 * The sticky block of a `StickyScreen` on the phone: moved down by as much as the page has scrolled past where it sticks (`stuckAt`), so it stays at
 * the top, worked out on the UI thread frame by frame with the scroll (`scrollY`), as the second row's closing is. Reanimated writes each place into
 * the screen's tree too, so a press is measured where the block is drawn. Drawn over the page that passes under it, as React Native's sticky header
 * is (its `zIndex`); it takes no touch where it draws nothing.
 */
export function StickyBlock({ scrollY, stuckAt, children }: { scrollY: SharedValue<number>; stuckAt: SharedValue<number>; children: ReactNode }) {
  const stuck = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(0, scrollY.value - stuckAt.value) }] }));
  return (
    <Animated.View pointerEvents="box-none" style={[{ zIndex: 10, pointerEvents: 'box-none' }, stuck]}>
      {children}
    </Animated.View>
  );
}
