import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode, type Ref } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { measure, useAnimatedReaction, useAnimatedRef, useAnimatedStyle, useSharedValue, type AnimatedRef, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SCREEN_TOP, Screen, type ScreenScroller } from './Page';
import { SCROLL_STICKS, StickyBlock } from './StickyBlock';
import { COLORS, GUTTER } from './theme';

/**
 * How far the page has scrolled, as React is told it: a mirror of the offset the UI thread follows, written only when the answer to a question
 * asked of it changes (a point the page has gone past or come back over: `useScrolledPast`), never for a scroll that leaves
 * every answer as it was. With it, where the `lead` ends (the bottom of the lead in the column, in points; null while there is no lead, or it has
 * not been laid out), and the points asked about, which the UI thread watches (`marks`).
 */
interface ScrollOffset {
  get(): number;
  set(y: number): void;
  lead(): number | null;
  setLead(bottom: number | null): void;
  /** A point asked about, watched for as long as it is asked: the page going past it or back over it tells React. */
  watch(px: number): () => void;
  subscribe(notify: () => void): () => void;
}

/** `onMarks` hears the points to watch each time they change: the lead's foot and every point asked about. */
function scrollOffset(onMarks: (marks: number[]) => void = () => {}): ScrollOffset {
  let y = 0;
  let leadBottom: number | null = null;
  const asked = new Map<number, number>();
  let nextAsk = 0;
  const watchers = new Set<() => void>();
  const notify = () => watchers.forEach((watcher) => watcher());
  const marks = () => onMarks([...(leadBottom === null ? [] : [leadBottom]), ...asked.values()]);
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
      marks();
      notify();
    },
    watch(px) {
      const id = nextAsk++;
      asked.set(id, px);
      marks();
      return () => {
        asked.delete(id);
        marks();
      };
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
 * Whether the page of the `StickyScreen` this stands in has scrolled past `px` points (what a web page asks an `IntersectionObserver`): it
 * draws again when the answer changes, never for a scroll that leaves it as it was (React is not even told of such a scroll).
 */
export function useScrolledPast(px: number): boolean {
  const offset = useContext(Offset);
  useEffect(() => offset.watch(px), [offset, px]);
  return useSyncExternalStore(offset.subscribe, () => offset.get() > px, () => false);
}

/** One sticky row: night-800 across the page's width, out over the gutter so that a frame's outline passing under it is hidden. */
const ROW: ViewStyle = { backgroundColor: COLORS['night-800'], marginHorizontal: -GUTTER, paddingHorizontal: GUTTER };

/**
 * The second row, and what stands above it under the first (`between`, the gap), which close the room under the first as the page scrolls up
 * under it: they ride up by the part of the room the page has scrolled since the sticky block reached the top (`stuckAt`), until the second row
 * has met the first. Until then they are where they would be if the page were scrolling past the stuck header, which is what the web's two
 * sticky rows do, with what is between them scrolling with the page under the first. Worked out on the UI thread from the page's offset, frame
 * by frame with the scroll, and never drawn again by React for it. It takes no touch where it draws nothing.
 */
function Closing({ scrollY, stuckAt, room, children }: { scrollY: SharedValue<number>; stuckAt: SharedValue<number>; room: SharedValue<number>; children: ReactNode }) {
  const closing = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.min(room.value, Math.max(0, scrollY.value - stuckAt.value)) }] }));
  return (
    <Animated.View pointerEvents="box-none" style={[{ pointerEvents: 'box-none' }, closing]}>
      {children}
    </Animated.View>
  );
}

/**
 * A `Screen` whose `header` stays at the top, under the top inset, while the column scrolls (the web's `sticky top-safe`):
 * the header's block keeps itself at the top of the scroll on the phone (`StickyBlock`, moved down on the UI thread by as far as the page has
 * scrolled past it), and is the scroll's sticky child on the web (`stickyHeaderIndices`). What is above it in the column is the `lead`,
 * which scrolls away (the Hud's portrait and settings row, above the figures that stay); `useScrolledPast(px)` says when the page
 * has gone past a point. `subHeader` is a second row under the header that stays with it (the Finance tabs under the Hud).
 * Both rows are one block that sticks (React Native's sticky rows do not stack, the next one pushes the last off).
 * `subGap` is the room the web leaves between them at scroll 0 (the 12 of `main pt-3`): it is empty, the page's ground
 * shows in it, and it closes as they stick, as two sticky rows meet. `between` is what the web's page has between the two rows besides
 * that room (the strip of a crisis under the Hud, a tip of the guide over the Finance tabs): it stands under the header, over the gap, and
 * scrolls up under the header with the page, the second row following it until the rows meet; the room that closes is then all there is
 * between them, measured (where the second row stands). The header is drawn over what passes under it. What sticks is a block as tall as
 * the rows and the room together: where it draws nothing (the room left under the second row once it has closed) it takes no touch, and
 * the page under it is pressed.
 *
 * The page's offset is followed on the UI thread (the Screen's `scrollY`, a Reanimated scroll handler): the rows close there, frame by frame
 * with the scroll, and React hears of a scroll only when a point asked about has been passed. `fixed`, `bar`, `contentStyle` and `scroller`
 * (how a screen asks its page to scroll: Play takes a new stage back to the top) are the Screen's own.
 */
export function StickyScreen({
  lead,
  header,
  subHeader,
  subGap = 0,
  between,
  children,
  fixed,
  bar,
  contentStyle,
  scroller,
}: {
  lead?: ReactNode;
  header: ReactNode;
  subHeader?: ReactNode;
  subGap?: number;
  between?: ReactNode;
  children?: ReactNode;
  fixed?: ReactNode;
  bar?: ReactNode;
  contentStyle?: ViewStyle;
  scroller?: Ref<ScreenScroller>;
}) {
  // The page's offset, on the UI thread; where the sticky block sticks; how far the second row rides up; the points React is to be told of.
  const scrollY = useSharedValue(0);
  const stuckAt = useSharedValue(0);
  const room = useSharedValue(subGap);
  const marks = useSharedValue<number[]>([]);
  const offset = useRef<ScrollOffset | null>(null);
  offset.current ??= scrollOffset((now) => {
    marks.value = now;
  });
  const store = offset.current;

  // Where the sticky row stands in the column while it is not stuck: under the column's top padding, or, with a lead, under
  // the lead (as tall as it has said it is) and the gap between children.
  const gap = typeof contentStyle?.gap === 'number' ? contentStyle.gap : 0;
  const paddingTop = typeof contentStyle?.paddingTop === 'number' ? contentStyle.paddingTop : SCREEN_TOP;
  const hasLead = Boolean(lead);
  const stickAt = useCallback(() => {
    stuckAt.value = hasLead ? (store.lead() ?? 0) + gap : paddingTop;
  }, [hasLead, gap, paddingTop, store, stuckAt]);
  useEffect(() => stickAt(), [stickAt]);
  // A lead taken away leaves nothing to have scrolled past.
  useEffect(() => {
    if (!hasLead) store.setLead(null);
  }, [hasLead, store]);

  // With nothing between the rows, the gap alone closes; with something, all there is between them, once it is laid out (where the second row stands).
  const hasBetween = Boolean(between);
  useEffect(() => {
    if (!hasBetween) room.value = subGap;
  }, [hasBetween, subGap, room]);

  // React is told the offset only when the page goes past a point asked about, or back over it, or when the points themselves change (a lead
  // that grows while the page is far down: the answer may change with no point crossed): the points and which side of each it is on, as one word.
  const mirror = useCallback((y: number) => store.set(y), [store]);
  useAnimatedReaction(
    () => {
      const y = scrollY.value;
      let sides = '';
      for (const mark of marks.value) sides += y > mark ? '1' : '0';
      return `${marks.value.join(',')}:${sides}`;
    },
    (sides, before) => {
      if (sides !== before) scheduleOnRN(mirror, scrollY.value);
    },
  );

  return (
    <Offset.Provider value={store}>
      <Screen sticky={SCROLL_STICKS ? [lead ? 1 : 0] : undefined} scrollY={scrollY} fixed={fixed} bar={bar} contentStyle={contentStyle} scroller={scroller}>
        {lead ? (
          <View
            onLayout={(event) => {
              store.setLead(event.nativeEvent.layout.y + event.nativeEvent.layout.height);
              stickAt();
            }}
          >
            {lead}
          </View>
        ) : null}
        <StickyBlock scrollY={scrollY} stuckAt={stuckAt}>
          <View style={[ROW, { zIndex: 1 }]}>{header}</View>
          {subHeader ? (
            <Closing scrollY={scrollY} stuckAt={stuckAt} room={room}>
              {between}
              {subGap > 0 ? <View pointerEvents="none" style={{ height: subGap, pointerEvents: 'none' }} /> : null}
              <View style={ROW} onLayout={hasBetween ? (event) => void (room.value = event.nativeEvent.layout.y) : undefined}>
                {subHeader}
              </View>
            </Closing>
          ) : null}
        </StickyBlock>
        {children}
      </Screen>
    </Offset.Provider>
  );
}

/**
 * The page a part of it sticks in (`StickyPart`): how far it has scrolled, written on the UI thread (a `Screen`'s `scrollY`), the column the part
 * stands in, as Reanimated measures it, how far below the top of what scrolls that column starts (the `Screen`'s room on top, `SCREEN_TOP`), and a
 * count the page moves on each time its column is laid out again (anything in it grew or shrank): a part is measured again then, never per frame.
 */
export interface PageScrolling {
  scrollY: SharedValue<number>;
  column: AnimatedRef<View>;
  top: number;
  laid: SharedValue<number>;
}
export const PageScroll = createContext<PageScrolling | null>(null);

/**
 * A part of a page whose first row (`head`) stays at the top of the page while the rest of the part scrolls under it, and goes with the part once
 * its foot comes up: the web's `sticky top-0` on a row inside a part of the page (the rat and its tabs over the choices of PlayerProfile's editor),
 * not the page's own header (`StickyScreen`). Where the part starts in what scrolls and how far its row may go are measured on the UI thread each
 * time the part, its row or the page's column is laid out again (a tab of other choices, a form opened above it), with no scroll needed; each frame
 * of a scroll is then arithmetic on the UI thread, and React is never told of it. Outside a `PageScroll` (a part drawn on a page of its own) it is
 * the rows as they are. The head is drawn over what passes under it; `gap` is the room between it and the rest, `style` the part's own.
 */
export function StickyPart({ head, gap = 0, style, children }: { head: ReactNode; gap?: number; style?: ViewStyle; children: ReactNode }) {
  const page = useContext(PageScroll);
  const part = useAnimatedRef<View>();
  const row = useAnimatedRef<View>();
  // Where the part starts in what scrolls (far below, until measured: nothing moves), how far its row may go down it, and its own layouts' count.
  const at = useSharedValue(Number.MAX_SAFE_INTEGER);
  const room = useSharedValue(0);
  const own = useSharedValue(0);
  const scrollY = page?.scrollY;
  const column = page?.column;
  const laid = page?.laid;
  const top = page?.top ?? 0;
  useAnimatedReaction(
    () => (laid?.value ?? 0) + own.value,
    () => {
      if (column === undefined) return;
      const box = measure(part);
      const sheet = measure(column);
      const held = measure(row);
      if (box === null || sheet === null || held === null) return;
      // The part's place in the column, and the column's in what scrolls: the scroll moves both alike on the screen.
      at.value = top + box.pageY - sheet.pageY;
      room.value = Math.max(0, box.height - held.height);
    },
  );
  const stuck = useAnimatedStyle(() => ({ transform: [{ translateY: scrollY === undefined ? 0 : Math.max(0, Math.min(room.value, scrollY.value - at.value)) }] }));
  const relaid = page === null ? undefined : () => void (own.value = own.value + 1);
  return (
    <Animated.View ref={part} collapsable={false} onLayout={relaid} style={[{ gap }, style]}>
      <Animated.View ref={row} collapsable={false} onLayout={relaid} style={[{ zIndex: 1 }, stuck]}>
        {head}
      </Animated.View>
      {children}
    </Animated.View>
  );
}
