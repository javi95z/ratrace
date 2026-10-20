import type { ReactNode } from 'react';
import { Image, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dots from '../../assets/ui/dots.png';
import { COLORS, GUTTER, SHELL_WIDTH } from './theme';

/** The ground: dots.png (6 pt tile; @2x/@3x picked by the device) repeated, never stretched. */
export const PAGE_GROUND = { source: dots, resizeMode: 'repeat', tile: 6 } as const;

/**
 * The web's body (globals.css): night-800 with a weave of single pixels (dots.png, one 6 pt tile in three
 * densities), and the top safe inset painted night-900 over everything (the web's body::before), so nothing scrolls
 * by under the status bar. No column here: each screen is its own (`Screen`, the web's `main`), and a `BottomBar`
 * spans the whole width under it, as the web's fixed bars do.
 */
export function Page({ children }: { children: ReactNode }) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: COLORS['night-900'] }}>
      {/* The ground has no padding of its own: the image filling it is then the whole screen, to its foot. */}
      <View style={{ flex: 1, backgroundColor: COLORS['night-800'] }}>
        <Image
          source={PAGE_GROUND.source}
          resizeMode={PAGE_GROUND.resizeMode}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
        />
        <View style={{ flex: 1, paddingTop: inset.top }}>{children}</View>
      </View>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: inset.top, backgroundColor: COLORS['night-900'], zIndex: 60 }}
      />
    </View>
  );
}

/** The web's `mx-auto w-full max-w-md px-3`: a column at most 448 wide, centred, the 12 gutter inside it. */
const COLUMN: ViewStyle = { width: '100%', maxWidth: SHELL_WIDTH, alignSelf: 'center', paddingHorizontal: GUTTER };

/**
 * A page's column, scrolling (the web's `main`). The gutter is inside what scrolls, never round it: a scroll clips what
 * it holds, and the outer 2 pt edge of a frame against the gutter (its 4 pt drop) must still show. The scroll stands in
 * from the side insets (the web's body padding); its foot leaves room for a frame's drop and the home indicator.
 * `contentStyle` is the column's own spacing (a gap, the room on top). `bar` is the screen's `BottomBar`, under the
 * scroll and across the whole width; it clears the home indicator itself, so then the scroll's foot leaves room for a
 * frame's drop only. `fixed` is what stands over the page and does not scroll with it, the web's `position: fixed` (a
 * Toast): placed in the screen's whole box, not in the column. `sticky` lists which of the children stick to the top
 * of the scroll once they reach it (see `StickyScreen`, which uses it), and `onScroll` hears how far the page has
 * scrolled, in points.
 */
export function Screen({
  children,
  contentStyle,
  fixed,
  bar,
  sticky,
  onScroll,
}: {
  children: ReactNode;
  contentStyle?: ViewStyle;
  fixed?: ReactNode;
  bar?: ReactNode;
  sticky?: number[];
  onScroll?: (y: number) => void;
}) {
  const inset = useSafeAreaInsets();
  // A bar that is not shown this time (`false`, `null`) is no bar: the scroll then clears the home indicator itself.
  const barred = Boolean(bar);
  const scroll = (
    <ScrollView
      stickyHeaderIndices={sticky}
      onScroll={onScroll ? (event) => onScroll(event.nativeEvent.contentOffset.y) : undefined}
      scrollEventThrottle={onScroll ? 16 : undefined}
      style={{ flex: 1, marginLeft: inset.left, marginRight: inset.right }}
      contentContainerStyle={[COLUMN, { paddingTop: 16, paddingBottom: barred ? 16 : 16 + inset.bottom }, contentStyle]}
    >
      {children}
    </ScrollView>
  );
  if (fixed === undefined && !barred) return scroll;
  return (
    <View style={{ flex: 1 }}>
      {scroll}
      {bar}
      {fixed}
    </View>
  );
}

/**
 * A bar on the bottom edge, under a screen's `Screen` (the web's `fixed inset-x-0 bottom-0 bg-night-900 pt-3 pb-safe`
 * round `mx-auto w-full max-w-md px-3`): night-900 across the whole width, its side insets padded, 12 on top and the
 * larger of 12 and the bottom inset below, and what it holds in the 448 column with the gutter.
 */
export function BottomBar({ children }: { children: ReactNode }) {
  const inset = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: COLORS['night-900'],
        paddingTop: 12,
        paddingBottom: Math.max(12, inset.bottom),
        paddingLeft: inset.left,
        paddingRight: inset.right,
      }}
    >
      <View style={COLUMN}>{children}</View>
    </View>
  );
}
