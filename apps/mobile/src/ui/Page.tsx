import { useImperativeHandle, useRef } from 'react';
import type { ReactNode, Ref } from 'react';
import { Image, ScrollView, View, type ScrollViewInstance, type ViewStyle } from 'react-native';
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

/** The room a Screen leaves above its first child. */
export const SCREEN_TOP = 16;

/** The web's `mx-auto w-full max-w-md px-3`: a column at most 448 wide, centred, the 12 gutter inside it. */
const COLUMN: ViewStyle = { width: '100%', maxWidth: SHELL_WIDTH, alignSelf: 'center', paddingHorizontal: GUTTER };

/** What a screen can ask of the page it stands in, through `Screen`'s `scroller`. */
export interface ScreenScroller {
  /**
   * Scrolls the page, if it needs to, so that what stands at `y` (from the top of what scrolls) and is `height` tall is in view: the web's `scrollIntoView({ block: 'nearest' })`.
   * It slides unless told not to (`animated` false: where motion is to be left out).
   */
  reveal(y: number, height: number, animated?: boolean): void;
}

/**
 * Where to scroll a page to, from where it is, to show a box: nothing (null) when it is in view already, the least that brings it in view otherwise (its top at the
 * top, or its foot at the bottom), with `margin` to spare; a box taller than the page shows its top. `offset` is how far the page is scrolled, `viewport` how tall it is.
 */
export function scrollToShow(offset: number, viewport: number, y: number, height: number, margin = 0): number | null {
  if (viewport <= 0) return null;
  const top = Math.max(0, y - margin);
  if (top < offset) return top;
  const foot = y + height + margin;
  if (foot <= offset + viewport) return null;
  return height + 2 * margin >= viewport ? top : foot - viewport;
}

/**
 * A page's column, scrolling (the web's `main`). The gutter is inside what scrolls, never round it: a scroll clips what
 * it holds, and the outer 2 pt edge of a frame against the gutter (its 4 pt drop) must still show. The scroll stands in
 * from the side insets (the web's body padding); its foot leaves room for a frame's drop and the home indicator.
 * `scroller` is how a screen asks the page to scroll (`ScreenScroller`): the page then follows how far it is scrolled, as it does for `onScroll`.
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
  scroller,
}: {
  children: ReactNode;
  contentStyle?: ViewStyle;
  fixed?: ReactNode;
  bar?: ReactNode;
  sticky?: number[];
  onScroll?: (y: number) => void;
  scroller?: Ref<ScreenScroller>;
}) {
  const inset = useSafeAreaInsets();
  const scrolling = useRef<ScrollViewInstance>(null);
  /** How far it is scrolled and how tall it is: followed only for a screen that asks to scroll it. */
  const where = useRef({ offset: 0, viewport: 0 });
  useImperativeHandle(
    scroller,
    () => ({
      reveal(y, height, animated = true) {
        const to = scrollToShow(where.current.offset, where.current.viewport, y, height, GUTTER);
        if (to !== null) scrolling.current?.scrollTo({ y: to, animated });
      },
    }),
    [],
  );
  // A bar that is not shown this time (`false`, `null`) is no bar: the scroll then clears the home indicator itself.
  const barred = Boolean(bar);
  const follows = onScroll !== undefined || scroller !== undefined;
  const scroll = (
    <ScrollView
      ref={scrolling}
      stickyHeaderIndices={sticky}
      onScroll={
        follows
          ? (event) => {
              where.current.offset = event.nativeEvent.contentOffset.y;
              onScroll?.(event.nativeEvent.contentOffset.y);
            }
          : undefined
      }
      onLayout={scroller ? (event) => void (where.current.viewport = event.nativeEvent.layout.height) : undefined}
      scrollEventThrottle={follows ? 16 : undefined}
      style={{ flex: 1, marginLeft: inset.left, marginRight: inset.right }}
      contentContainerStyle={[COLUMN, { paddingTop: SCREEN_TOP, paddingBottom: barred ? 16 : 16 + inset.bottom }, contentStyle]}
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
