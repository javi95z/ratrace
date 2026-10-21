import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode, type Ref } from 'react';
import { View, type ViewStyle } from 'react-native';
import { SCREEN_TOP, Screen, type ScreenScroller } from './Page';
import { COLORS, GUTTER } from './theme';

/**
 * How far the page has scrolled, kept outside React so that a scroll does not draw every screen: only what asks about it. With it, where the
 * `lead` ends (the bottom of the lead in the column, in points; null while there is no lead, or it has not been laid out).
 */
interface ScrollOffset {
  get(): number;
  set(y: number): void;
  lead(): number | null;
  setLead(bottom: number | null): void;
  subscribe(notify: () => void): () => void;
}

function scrollOffset(): ScrollOffset {
  let y = 0;
  let leadBottom: number | null = null;
  const watchers = new Set<() => void>();
  const notify = () => watchers.forEach((watcher) => watcher());
  return {
    get: () => y,
    set(next) {
      y = next;
      notify();
    },
    lead: () => leadBottom,
    setLead(bottom) {
      if (bottom === leadBottom) return;
      leadBottom = bottom;
      notify();
    },
    subscribe(notify) {
      watchers.add(notify);
      return () => void watchers.delete(notify);
    },
  };
}

/** What a `StickyScreen` holds out to what is inside it; a screen that is not one has never scrolled. */
const Offset = createContext<ScrollOffset>(scrollOffset());

/**
 * Whether the page of the `StickyScreen` this stands in has scrolled past `px` points. This is what the web's
 * `IntersectionObserver` is for the Hud's "away" strip: it draws again when the answer changes, never for a scroll that
 * leaves it as it was.
 */
export function useScrolledPast(px: number): boolean {
  const offset = useContext(Offset);
  return useSyncExternalStore(offset.subscribe, () => offset.get() > px, () => false);
}

/**
 * Whether the page of the `StickyScreen` this stands in has scrolled past its `lead`: the lead's last point has gone off the top of the page.
 * For a header that cannot measure the lead above it (the Hud's figures, whose "away" strip says whose life it is once the portrait has
 * gone): the screen knows where its lead ends, and follows it when it grows or shrinks. Never, with no lead.
 */
export function useScrolledPastLead(): boolean {
  const offset = useContext(Offset);
  return useSyncExternalStore(
    offset.subscribe,
    () => {
      const bottom = offset.lead();
      return bottom !== null && offset.get() > bottom;
    },
    () => false,
  );
}

/** One sticky row: night-800 across the page's width, out over the gutter so that a frame's outline passing under it is hidden. */
const ROW: ViewStyle = { backgroundColor: COLORS['night-800'], marginHorizontal: -GUTTER, paddingHorizontal: GUTTER };

/**
 * The second row, which closes the room under the first as the page scrolls up under it: it rides up by the part of the
 * room the page has scrolled since the sticky block reached the top, until it has met the first row. Until then it is where
 * it would be if the page were scrolling past the stuck header, which is what the web's two sticky rows do.
 */
function Closing({ room, stuckAt, children }: { room: number; stuckAt: () => number; children: ReactNode }) {
  const offset = useContext(Offset);
  const closed = useSyncExternalStore(
    offset.subscribe,
    () => Math.min(room, Math.max(0, offset.get() - stuckAt())),
    () => 0,
  );
  return <View style={{ transform: [{ translateY: -closed }] }}>{children}</View>;
}

/**
 * A `Screen` whose `header` stays at the top, under the top inset, while the column scrolls (the web's `sticky top-safe`):
 * the scroll's sticky child is the header's block (`stickyHeaderIndices`). What is above it in the column is the `lead`,
 * which scrolls away (the Hud's portrait and settings row, above the figures that stay); `useScrolledPastLead()` says when it
 * has (and `useScrolledPast(px)` when the page has gone past any other point). `subHeader` is a second row under the header that stays with it (the Finance tabs under the Hud).
 * React Native's sticky rows do not stack, the next one pushes the last off, so both rows are one sticky child.
 * `subGap` is the room the web leaves between them at scroll 0 (the 12 of `main pt-3`): it is empty, the page's ground
 * shows in it, and it closes as they stick, as two sticky rows meet. (It is part of the sticky child, so the 12 points under
 * the second row take no touch while it is stuck, and show what scrolls under them.) `onScroll` hears the offset in points;
 * a header that only needs to know whether the page has gone past a point asks `useScrolledPast`. `fixed`, `bar`,
 * `contentStyle` and `scroller` (how a screen asks its page to scroll: Play takes a new stage back to the top) are the Screen's own.
 */
export function StickyScreen({
  lead,
  header,
  subHeader,
  subGap = 0,
  children,
  fixed,
  bar,
  contentStyle,
  onScroll,
  scroller,
}: {
  lead?: ReactNode;
  header: ReactNode;
  subHeader?: ReactNode;
  subGap?: number;
  children?: ReactNode;
  fixed?: ReactNode;
  bar?: ReactNode;
  contentStyle?: ViewStyle;
  onScroll?: (y: number) => void;
  scroller?: Ref<ScreenScroller>;
}) {
  const offset = useRef<ScrollOffset | null>(null);
  offset.current ??= scrollOffset();
  const store = offset.current;
  // Where the sticky row stands in the column while it is not stuck: under the column's top padding, or, with a lead, under
  // the lead (as tall as it has said it is) and the gap between children.
  const gap = typeof contentStyle?.gap === 'number' ? contentStyle.gap : 0;
  const paddingTop = typeof contentStyle?.paddingTop === 'number' ? contentStyle.paddingTop : SCREEN_TOP;
  const stuckAt = () => (lead ? (store.lead() ?? 0) + gap : paddingTop);
  // A lead taken away leaves nothing to have scrolled past.
  const hasLead = Boolean(lead);
  useEffect(() => {
    if (!hasLead) store.setLead(null);
  }, [hasLead, store]);
  return (
    <Offset.Provider value={store}>
      <Screen
        sticky={[lead ? 1 : 0]}
        onScroll={(y) => {
          store.set(y);
          onScroll?.(y);
        }}
        fixed={fixed}
        bar={bar}
        contentStyle={contentStyle}
        scroller={scroller}
      >
        {lead ? (
          <View onLayout={(event) => store.setLead(event.nativeEvent.layout.y + event.nativeEvent.layout.height)}>{lead}</View>
        ) : null}
        <View pointerEvents="box-none">
          <View style={ROW}>{header}</View>
          {subHeader ? (
            <>
              {subGap > 0 ? <View style={{ height: subGap }} /> : null}
              <Closing room={subGap} stuckAt={stuckAt}>
                <View style={ROW}>{subHeader}</View>
              </Closing>
            </>
          ) : null}
        </View>
        {children}
      </Screen>
    </Offset.Provider>
  );
}
